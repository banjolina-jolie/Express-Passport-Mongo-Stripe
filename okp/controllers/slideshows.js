"use strict";
require('sugar');

let async = require('async');
let logger = require('../common/logger').forFile('controllers/slideshows');
let authProjectUser = require('../common/projections').authUser;
let User = require('../models/user');
let Storage = require('../common/storage');
let shortId = require('shortid');
let util = require('util');

function deleteSlideshow(req, res){
  let storage;
  let slideshowId = req.params.slideshow_id;
  let userId = req.user._id;

  async.waterfall([
    (cb) => {
      storage = new Storage("okprecious");
      storage.on("error", function(err){
        cb(err);
      });
      storage.on("ready", function(){
        cb();
      });
    },
    (cb) => {
      let key = util.format("%s/%s/%s", userId, 'slideshows', slideshowId);
      storage.deleteObject(key, cb);
    },
    (cb) => {
      User.removeSlideshow(userId, req.params.slideshow_id, cb);
    }],
    function(err, _user){
      if(err)
        return res.status(500).json({message: err});
      res.status(201).json(authProjectUser(_user));
    });
}

function extractPDF(payload){
  let parts = payload.split(',');
  if(parts.length < 2)
    return null;
  return parts[1].trim();
}

function create(req, res){
  logger.info("slideshows POST /api/slideshows");
  let storage;
  let userId = req.user._id;
  let id = shortId();

  let slideshow = {title: req.body.title,
                   id: id,
                   uploaded : Date.now(),
                   url : userId + '/slideshows/' + id};

  async.waterfall([
    (cb) => {
      storage = new Storage("okprecious");
      storage.on("error", function(err){
        cb(err);
      });
      storage.on("ready", function(){
        cb();
      });
    },
    (cb) => {
      let pdf = extractPDF(req.body.slideshow);
      if(!pdf)
        return cb(new Error("unable to extract payload from PDF"));
      storage.putSlideshow(slideshow.url, pdf, cb);
    },
    (cb) => {
      User.addSlideshow(userId, slideshow, cb);
    }],
    function(err){
      if(err){
        logger.error("slideshows.create " + err);
        return res.status(500).json({err: err});
      }
      res.status(201).json(slideshow);
    });
}

module.exports = function(router){
  router.route('/api/slideshows/:slideshow_id')
    .delete(deleteSlideshow);
  router.route('/api/slideshows')
    .post(create);
};
