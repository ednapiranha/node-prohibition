'use strict';

var level = require('level');
var Places = require('level-places');
var through = require('through');
var paginate = require('level-paginate');
var Sublevel = require('level-sublevel');

var KEY = 'prohibition!';
var WHITELIST = ['meta', 'name', 'user', 'location'];

Number.prototype.toRad = function () {
  return this * Math.PI / 180;
}

var Prohibition = function (options) {
  var self = this;

  if (!options) {
    options = {};
  }

  this.dbPath = options.db;
  this.geoDb;
  this.db = Sublevel(level(this.dbPath, {
    createIfMissing: true,
    valueEncoding: 'json'
  }));
  this.limit = options.limit - 1 || 10;
  this.message = {
    meta: options.meta || {},
    content: {
      ratings: [],
      average: 0,
      maxRating: options.maxRating || 5,
      totalRatings: 0
    }
  };

  this.geoDb = Places(this.db.sublevel('geohash'));

  var setAll = function (message, callback) {
    message.id = Date.now();

    if (!message.meta) {
      message.meta = {};
    }

    for (var attr in self.message.meta) {
      if (!message.meta[attr]) {
        message.meta[attr] = false;
      }
    }

    for (var attr in self.message) {
      if (WHITELIST.indexOf(attr) === -1) {
        delete message[attr];
      }
    }

    // A new message should not have any rating data set.
    message.content = self.message.content;
    message.content.created = Math.round(new Date() / 1000);

    self.geoDb.add(message.id, message.location[0], message.location[1]);
    self.db.put(KEY + message.id, message, function (err) {
      if (err) {
        callback(err);
      } else {
        callback(null, message);
      }
    });
  };

  var validateProperties = function (message, callback) {
    if (!message) {
      callback(new Error('Post cannot be empty'));
    } else if (!message.name || !message.user || !message.location) {
      callback(new Error('Post invalid - you are missing mandatory fields: name, user and/or location'));
    } else if (!(message.location instanceof Array)) {
      callback(new Error('Location coordinates must be in the format of an array [lat, lon]'));
    } else {
      callback(null, message);
    }
  };

  this.create = function (message, callback) {
    validateProperties(message, function (err, msg) {
      if (err) {
        callback(err);
      } else {
        setAll(msg, callback);
      }
    });
  };

  this.get = function (id, callback) {
    self.db.get(KEY + id, function (err, message) {
      if (err || !message) {
        callback(new Error('Not found ', err));
      } else {
        if (typeof message === 'object') {
          callback(null, message);
        } else {
          callback(new Error('Invalid JSON'));
        }
      }
    });
  };

  var validateRatings = function (ratings, callback) {
    var count = 0;
    var ratingLength = ratings.length;

    if (ratingLength > 0) {
      ratings.forEach(function (rating) {
        count ++;
        var user = rating.user.replace(/\s/gi, '');
        var url = rating.url.replace(/\s/gi, '');
        var score = rating.score.toString().replace(/[\s]/gi, '');

        if (!user || !url) {
          callback(new Error('Rating field cannot be empty'));
        } else if (score.match(/[^0-9]+/gi)) {
          callback(new Error('Score is not a number'));
        } else if (parseInt(score, 10) > self.message.content.maxRating) {
          callback(new Error('Score is higher than the maxRating'));
        } else {
          // Update the score total
          self.message.content.ratings.unshift(rating);
          self.message.content.totalRatings += parseInt(score, 10);
          self.message.content.average = self.message.content.totalRatings / self.message.content.ratings.length;

          if (count === ratingLength) {
            var opts = [];

            opts.push({
              type: 'put',
              key: KEY + self.message.id,
              value: self.message
            });

            self.db.batch(opts, function (err) {
              if (err) {
                callback(err);
              } else {
                callback(null, self.message);
              }
            });
          }
        }
      });
    } else {
      callback(null, self.message);
    }
  };

  this.update = function (message, id, callback) {
    validateProperties(message, function (err, msg) {
      if (err) {
        callback(err);
      } else {
        self.message = {
          meta: options.meta || {},
          content: {
            ratings: [],
            average: 0,
            maxRating: options.maxRating || 5,
            totalRatings: 0
          }
        };

        self.get(id, function (err, msg) {
          if (err) {
            callback(err);
          } else {
            self.message = msg;

            for (var attr in message) {
              if (WHITELIST.indexOf(attr) > -1) {
                self.message[attr] = message[attr];
              }
            }

            validateRatings(self.message.content.ratings || [], callback);
          }
        });
      }
    });
  };

  this.del = function (id, callback) {
    id = parseInt(id, 10);

    self.db.del(KEY + id);
    callback(null);
  };

  this.getAll = function getAll(start, callback) {
    start = parseInt(start, 10);

    if (isNaN(start)) {
      start = 0;
    }

    self.messageArray = [];

    paginate(self.db, KEY, {

      page: start,
      num: self.limit
    }).on('data', function (data) {

      self.messageArray.push(data);
    }).on('error', function (err) {

      callback(err);
    }).on('end', function () {
      callback(null, self.messageArray);
    });
  };

  this.getNearest = function (location, callback) {
    if (!(location instanceof Array)) {
      callback(new Error('Location coordinates must be in the format of an array [lat, lon]'));
    } else {
      var locationArr = [];
      var stream = self.geoDb.createReadStream(location[0], location[1], { limit: self.limit });

      var write = function write(data) {
        locationArr.push(data);
      };

      var end = function end() {
        callback(null, locationArr);
      };

      stream.pipe(through(write, end));
    }
  };
};

module.exports = Prohibition;
