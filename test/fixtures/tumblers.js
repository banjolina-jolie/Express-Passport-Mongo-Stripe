'use strict';

let ObjectId = require('mongodb').ObjectID;

module.exports = {
  'users' : [{"_id" : ObjectId("55df6cdd3c5f922b38153e67"),
              "slideshows":[{"title":"sdfsdf",
                            "id":"VJet-uu2",
                            "uploaded":1440711263664,
                            "url":"55df6cdd3c5f922b38153e67/slideshows/VJet-uu2"
                          },
                          {
                            "title":"another one",
                            "id":"EkUMMud2",
                            "uploaded":1440711413600,
                            "url":"55df6cdd3c5f922b38153e67/slideshows/EkUMMud2"
                          }],
                          "name":"jimmy",
                          "surname":"slick",
                          "username":"slick",
                          "type":1,
                          "meta":{
                            "address":{
                              "line1":"lkjlk",
                              "line2":"jlkj",
                              "city":"lkj",
                              "state":"lkj",
                              "postal_code":"lkj"
                            },
                            "price":{

                            },
                            "dob":{
                              "day":null,
                              "month":null,
                              "year":null
                            },
                            "employer":"kjhlkjh",
                            "jobTitle":"lkhjlkjh",
                            "bio":"lkhjkhj",
                            "telephone":{
                              "areaCode":"888",
                              "number":"8888888"
                            }
                          },
                          "email":"conor@async.london",
                          "created":1440705757593,
                          "hash":"$2a$10$e6j4cOl/WOOVjOfWfTs5helkmonFqXvFM/O59mm/GhdvMh2Nh/duS",
                          "ratings":[

                          ],
                          "validation":{
                            "createdAt":1440705757972,
                            "token":"440ab6a151d4239cc4cddbeb58e145fc9a0c84b4"
                          },
                          "state":3},
                          { "_id" : ObjectId("55df6c1b3c5f922b38153e64"),
                            "slideshows" : [ ],
                            "name" : "kjh",
                            "surname" : "kjh",
                            "username" : "ronoc",
                            "type" : 0,
                            "meta" : { "address" : { "line1" : "36B Bodney rd.", "city" : "London", "state" : "London", "postal_code" : "e8 1ay" },
                            "price" : { "rate" : 100 },
                            "dob" : { "day" : "3", "month" : "2", "year" : "1901" },
                            "employer" : "jkhlkjh", "jobTitle" : "kjhkjh",
                            "telephone" : { "areaCode" : "666", "number" : "6666666" },
                            "bio" : "hshhhhhhhhgfsfgsdrgsdfgsdfg" },
                            "email" : "conor@forwind.net",
                            "created" : 1440705563015,
                            "hash" : "$2a$10$qhSU1RuIIGe3BOHNMRv1SOdkPw07uxSzISYu1krWWGemrcanvfHVu",
                            "ratings" : [ ],
                            "validation" : { "createdAt" : 1440705563200, "token" : "44f4e88dcd253dd43e4bf7bca75c0b70120fdf8b" },
                            "state" : 3,
                            "timezone" : "Hawaii" }
  ],
  'transactors' : [{  "_id" : ObjectId("55df6cdf3c5f922b38153e68"),
                      "userId" : "55df6cdd3c5f922b38153e67",
                      "type" : 1,
                      "logs" : [ ],
                      "ss" : { "currency" : "usd", "state" : {  }, "stripeId" : "cus_6sH8XPfVogZEFu" },
                      "visible" : {  } },
                    { "_id" : ObjectId("55df6c1d3c5f922b38153e65"),
                      "userId" : "55df6c1b3c5f922b38153e64",
                      "type" : 0,
                      "logs" : [ ],
                      "ss" : { "currency" : "usd", "state" : {  },
                                "stripeId" : "acct_16eWWvIoeDcNWHWP",
                                "keys" : { "secret" : "sk_test_WCNPIqdd5JVLnRdUdLxb0Bk6",
                                           "publishable" : "pk_test_oW4o9yJrBxseCsGbH85twCrW" } },
                      "visible" : {  } }
                  ]
};

