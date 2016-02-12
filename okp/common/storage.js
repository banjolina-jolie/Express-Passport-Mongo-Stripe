"use strict";
let AWS = require('aws-sdk');
let config = require("./config");
let logger = require('../common/logger').forFile('common/storage');
let events = require('events');
let Seq = require('seq');
let util = require('util');
let fs = require('fs');
let zlib = require('zlib');

let Storage = module.exports = function(bucketName){
  this.name_ = null;
  this.s3_ = null;
  this.init(bucketName);
};

util.inherits(Storage, events.EventEmitter);

Storage.prototype.init = function(name) {
  var self = this;

  self.name_ = name;
  console.log("new Storage instance : " + self.name_);

  Seq()
    .seq(function(){
      AWS.config.update({
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_KEY,
        region: config.AWS_REGION
      });
      this();
    })
    .seq(function(){
      self.s3_ = new AWS.S3();
      self.emit('ready');
    })
    .catch(function(err){
      self.emit("error", err);
      console.log("Storage init err " + err);
    })
    ;
};

Storage.prototype.uploadStaticAsset = function(key, assetPath, done){
  let self = this;
  let params = {Bucket : self.name_,
                Key : key,
                Body: fs.createReadStream(assetPath)};

  console.log("uploading new static asset to S3 " + key);
  self.s3_.upload(params)
          .on('httpUploadProgress', (evt) => { console.log(evt); })
          .send((err, data) => {
             done(err, data);
          });
};

Storage.prototype.deleteObject = function(key, done){
  let self = this;
  let params = {Bucket: self.name_,
                Key: key};
  self.s3_.deleteObject(params, function(err, result){
    done(err);
  });
};

// TODO
// refactor all the puts together
Storage.prototype.putSlideshow = function(key, payload, done){
  logger.info("storage put slideshow " + key);
  let self = this;
  let buf = new Buffer(payload, 'base64');
  let data = {Key: key,
              Body: buf,
              ContentEncoding: 'base64',
              Bucket: self.name_,
              ContentType: 'application/pdf',
              ACL:'public-read'};
  self.s3_.putObject(data, function(err, data){
    logger.info("after put object " + err);
    if(err){
      logger.error('Error uploading pdf: ' + err);
      return done(err);
    }
    done();
  });
};

// TODO
// remove public flag post dev
Storage.prototype.put = function(key, payload, done){
  let self = this;
  let buf = new Buffer(payload.replace(/^data:image\/\w+;base64,/, ""),'base64');
  let data = {Key: key,
              Body: buf,
              ContentEncoding: 'base64',
              Bucket: self.name_,
              ContentType: 'image/jpeg',
              ACL:'public-read'};
  self.s3_.putObject(data, function(err, data){
    if(err){
      console.log(util.format('%s : %s, err : %s' , 'Error uploading data: ', data, err));
      done(err);
    }
    else{
      done();
    }
  });
};
