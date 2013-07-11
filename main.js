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

  var openDb = function (callback) {
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

  var addToArray = function (i, callback) {
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

  var setAll = function (message, id, callback) {
    self.db.get(KEY + 'all:ids' + self.keyId, function (err, ids) {
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

      opts.push({
        type: 'put',
        key: KEY + 'ids',
        value: id
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

  this.create = function (message, callback) {
    if (!message) {
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

  this.get = function (id, callback) {
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

  this.update = function (message, id, callback) {
    self.get(id, function (err, msg) {
      if (err) {
        callback(err);
      } else {
        msg.name = message.name;
        msg.location = message.location;

        var opts = [];

        opts.push({
          type: 'put',
          key: KEY + id,
          value: msg
        });

        self.db.batch(opts, function (err) {
          if (err) {
            callback(err);
          } else {
            callback(null, msg);
          }
        });
      }
    });
  };

  this.del = function (id, callback) {
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

          callback(null, true);
        }
      });
    });
  };

  this.getAll = function (start, callback) {
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

  this.flush = function (dbPath) {
    leveldown.destroy(dbPath || self.dbPath, function (err) {
      console.log('Deleted database');
    });
  };
};

module.exports = Prohibition;
