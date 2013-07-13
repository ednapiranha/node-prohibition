'use strict';

var levelup = require('levelup');
var leveldown = require('leveldown');

var KEY = 'prohibition:';

var Prohibition = function (options) {
  var self = this;

  if (!options) {
    options = {};
  }

  this.dbPath = options.db;
  this.limit = options.limit - 1 || 10;
  this.message = {};
  this.message.meta = options.meta || {};

  var openDb = function openDb(callback) {
    if (!self.db || self.db.isClosed()) {
      levelup(self.dbPath, {
        createIfMissing: true,
        keyEncoding: 'binary',
        valueEncoding: 'json'
      }, function (err, lp) {
        if (lp) {
          self.db = lp;
          callback();
        } else {
          openDb(callback);
        }
      });
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

      for (var attr in self.message.meta) {
        if (message.meta && !message.meta[attr]) {
          message.meta[attr] = self.message.meta[attr];
        }
      }

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

  this.create = function create(message, callback) {
    if (!message || !message.name || !message.user) {
      callback(new Error('Post invalid - you are missing mandatory fields'));
    } else {
      openDb(function () {
        self.db.get(KEY + 'ids', function (err, id) {
          if (err) {
            id = 1;
          } else {
            id ++;
          }

          setAll(message, id, callback);
        });
      });
    }
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

  this.update = function update(message, id, callback) {
    self.get(id, function (err, msg) {
      if (err) {
        callback(err);
      } else {
        var currId = msg.id;
        msg = message;
        msg.id = currId;

        for (var attr in msg) {
          self.message[attr] = msg[attr];
        }

        var opts = [];

        opts.push({
          type: 'put',
          key: KEY + id,
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
          callback(null, true);
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

  this.flush = function flush(dbPath) {
    leveldown.destroy(dbPath || self.dbPath, function (err) {
      console.log('Deleted database');
    });
  };
};

module.exports = Prohibition;
