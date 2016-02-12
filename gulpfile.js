"use strict";
require('sugar');

let async = require('async');
let gulp = require('gulp');
let nodemon = require('gulp-nodemon');
let mocha = require('gulp-mocha');
let env = require('gulp-env');
let archiver = require('gulp-archiver');
let util = require('util');
let path = require('path');
let exec = require('child_process').exec;
let loggerEntry = require('./okp/common/logger');
let logger = require('./okp/common/logger').forFile('Gulp Goodness');

let identity = require('whoami').split('<').first().trim();

let Storage = require('./okp/common/storage');

loggerEntry.initServer();

require('dotenv').load();

const S3_DEPLOY_BUCKET = "okp-deployments";
const OKP_API = "OKP-backend";
const OKP_API_ENV = "OKP-API";

gulp.task('run', function() {
  nodemon({
    script: "./okp/server.js",
  });
});

gulp.task('test', function() {
  env({
    vars : {
      NODE_ENV : 'test'
    }
  });
  return gulp.src('test/*.js')
            .pipe(mocha({
              bail: true,
              reporter: "spec"
            }).on('error', function(err){
              logger.warn("oh error running tests " + err);
            }));
});

let compressedArchive;
gulp.task('package', function() {
  let archive = util.format("%s%s.zip", 'okp-api-server--',
                            Date.create().format("{yyyy}-{month}-{dd}--{HH}-{mm}-{ss}"));

  compressedArchive = archive;

  return gulp.src(['./**',
                   '!./node_modules/**/*',
                   '!./node_modules',
                   '!**/.git/**',
                   '!**/.git',
                   '!./.DS_Store',
                   '!./.env',
                   '!./.gitignore'],{ dot : true })
            .pipe(archiver(archive))
            .pipe(gulp.dest('/tmp'));
});

gulp.task('upload', ["package"], function(cb) {
  let storage = new Storage(S3_DEPLOY_BUCKET);

  storage.on("error", function(err){
    logger.warn("Storage error :  " + err);
  });

  storage.on("ready", () => {
    storage.uploadStaticAsset(compressedArchive, path.join('/tmp', compressedArchive),
      (err) => {
        if(err)
          return logger.warn("Error uploading deployment to S3 -> " + err);
        cb();
        logger.info("package delivered");
    });
  });
});

gulp.task('deploy', ['upload'], function(cb){
  let version = "0.0.8-" + Date.now();
  async.waterfall([
    (cb) => {
      console.log("Registering payload with EBS application");
      let command = util.format("aws elasticbeanstalk create-application-version %s %s %s %s",
                                util.format('--application-name "%s"', OKP_API),
                                util.format('--version-label "%s"', version),
                                util.format('--description "%s %s"', "Uploaded by", identity),
                                util.format('--source-bundle S3Bucket="%s",S3Key="%s"', S3_DEPLOY_BUCKET, compressedArchive));
      exec(command, cb);
    },
    (stdOut, stdErr, cb) => {
      logger.info(stdOut);
      if(stdErr)
        logger.warn(stdErr);
      logger.info("Updating environment with new deployment");
      let command = util.format("aws elasticbeanstalk update-environment %s %s",
                                util.format("--environment-name %s", OKP_API_ENV),
                                util.format("--version-label %s", version));
      exec(command, cb);
    }],
    (err, stdOut, stdErr) => {
      logger.info(stdOut);
      if(stdErr)
        logger.warn(stdErr);
      if(err)
        return console.log("deploy-dev " + err);
      logger.info("Completed deployment of okp API server to " + OKP_API);
      cb();
    });
});

gulp.task('default', ['run']);