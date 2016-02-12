'use strict';
require('sugar');
let async = require('async');
let logger = require('../common/logger.js').forFile('controllers/deals.js');
let ObjectId = require('mongodb').ObjectID;
let utilities = require('../common/utilities');
let projectDeal = require('../common/projections').deal;
let authProjectUser = require('../common/projections').authUser;


let Seq = require('seq');
let Deal = require('../models/deal');
let User = require('../models/user');

function getDeal(req, res){
  Deal.findById(req.params.deal_id, function(err, _deal){
    if(err)
      return res.status(500).send();
    if(!_deal)
      return res.status(404).send();
    return res.status(200).json(_deal);
  });
}

function fetchDealsByPresenter(user, res){
  Deal.findByPresenter(user, function(err, _deals){
    if(err)
      res.status(500).json({message : err});
    else
      res.status(200).json(_deals);
  });
}


function searchDeals(req, res){
	if (!req.query || Object.size(req.query) === 0) {
		fetchDealsByPresenter(req.user, res);
	}
	else {
		req.query.ids = req.query.ids.map(function (id) {
      return new ObjectId.createFromHexString(id);
    });
    let query = { _id: { $in: req.query.ids }};

    Deal.find(query, function (err, deals) {
      if(err) {
        res.status(500).json({message: err});
      }
      else {
        Seq(deals)
          // iterate through each deal
          .seqEach(function (deal) {
            var that = this;
            // deal.presenter starts as an ID
            User.findById(deal.presenter, function (err, presenter) {
              // set presenter object in place of ID
              deal.presenter = authProjectUser(presenter);
              that();
            });
          })
          .seq(function () {
            res.status(200).json(deals.map(projectDeal));
          })
          .catch(function(err){
            res.status(500).json({message: err});
          });
      }
    });
	}
}

function updateDeal(req, res){
  let updatedDeal;
  Seq()
    .seq(function(){
      Deal.findById(req.params.deal_id, this);
    })
    .seq(function(_deal){
      if(!_deal)
        return res.status(500).json({error :'no deal with that id'});
      Deal.update(req.params.deal_id, req.body, this);
    })
    .seq(function(_updatedDeal){
      res.status(200).json(_updatedDeal);
      updatedDeal = _updatedDeal;
    })
    .catch(function(err){
      res.status(500).json({error : err});
    });
}


module.exports = function(router) {

  router.route('/api/deals')
    .get(searchDeals);

  router.route('/api/deals/:deal_id')
    .get(getDeal)
    .put(updateDeal);
};
