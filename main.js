'use strict';

var level = require('level');
var Places = require('level-places');
var through = require('through');
var Sublevel = require('level-sublevel');

var KEY = 'prohibition!';
var WHITELIST = ['meta', 'name', 'user', 'location'];
var RADIUS = 6371 // km

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

  var openDb = function openDb(callback) {
    if (!self.db || self.db.isClosed()) {
      Sublevel(level(self.dbPath, {
        createIfMissing: true,
        keyEncoding: 'binary',
        valueEncoding: 'json'
      }, function (err, lp) {
        if (lp) {
          self.db = lp;
          self.geoDb = Places(self.db.sublevel('geohash'));
          callback();
        } else {
          openDb(callback);
        }
      }));
    } else {
      callback();
    }
  };

  var addToArray = function addToArray(i, callback) {
    self.get(self.ids[i], function (err, m) {
      if (err) {
        callback(err);
      } else {
        self.messageArray.push(m);
      }

      if (self.messageArray.length === self.ids.length) {
        callback(null, self.messageArray);
      }
    });
  };

  var setAll = function setAll(message, id, callback) {
    self.db.get(KEY + 'ids', function (err, ids) {
      var opts = [];

      if (err) {
        // Not created, so create a new array
        ids = [id];
      } else {
        if (ids.indexOf(id) === -1) {
          ids.unshift(id);
        }
      }

      message.id = id;
      message.content.created = Math.round(new Date() / 1000);

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
          delete self.message[attr];
        }
      }

      self.geoDb.add(id, message.location[0], message.location[1]);

      opts.push({
        type: 'put',
        key: KEY + 'ids',
        value: ids
      });

      opts.push({
        type: 'put',
        key: KEY + id,
        value: message
      });

      self.db.batch(opts, function (err) {
        if (err) {
          callback(err);
        } else {
          callback(null, message);
        }
      });
    });
  };

  var loadAll = function loadAll(ids, callback) {
    self.messageArray = [];
    self.ids = ids;

    if (self.ids.length > 0) {
      for (var i = 0; i < self.ids.length; i ++) {
        addToArray(i, callback);
      }
    } else {
      callback(null, self.messageArray);
    }
  };

  var validateProperties = function validateProperties(message, callback) {
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

  this.create = function create(message, callback) {
    validateProperties(message, function (err, msg) {
      if (err) {
        callback(err);
      } else {
        openDb(function () {
          self.db.get(KEY + 'ids', function (err, id) {
            if (err) {
              id = 1;
            } else {
              id ++;
            }

            // A new message should not have any rating data set.
            msg.content = self.message.content;

            setAll(msg, id, callback);
          });
        });
      }
    });
  };

  this.get = function get(id, callback) {
    openDb(function () {
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
    });
  };

  var validateRatings = function validateRatings(ratings, callback) {
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

  this.update = function update(message, id, callback) {
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

            validateRatings(message.content.ratings || [], callback);
          }
        });
      }
    });
  };

  this.del = function del(id, callback) {
    openDb(function () {
      id = parseInt(id, 10);
      var opts = [];

      opts.push({
        type: 'del',
        key: KEY + id
      });

      self.db.get(KEY + 'ids', function (err, ids) {
        if (err) {
          callback(err);
        } else {
          ids.splice(ids.indexOf(id), 1);
          opts.push({
            type: 'put',
            key: KEY + 'ids',
            value: ids
          });

          self.db.batch(opts);
          callback(null);
        }
      });
    });
  };

  this.getAll = function getAll(start, callback) {
    openDb(function () {
      start = parseInt(start, 10);

      if (isNaN(start)) {
        start = 0;
      }

      self.db.get(KEY + 'ids', function (err, ids) {
        if (err) {
          callback(err);
        } else {
          self.totalAll = ids.length;
          loadAll(ids.slice(start, self.limit + start + 1), callback);
        }
      });
    });
  };

  this.getNearest = function getNearest(location, callback) {
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

  this.flush = function flush(dbPath) {
    level.destroy(dbPath || self.dbPath, function (err) {
      console.log('Deleted database');
    });
  };
};

module.exports = Prohibition;
