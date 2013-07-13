'use strict';

process.env.NODE_ENV = 'test';

var should = require('should');
var Prohibition = require('../main');

var p = new Prohibition({
  meta: {
    address: null,
    phone: null
  },
  db: './test/db'
});

var id;
var secId;

var message = {
  user: 'jen@test.com',
  name: 'test location',
  content: {
    ratings: []
  },
  location: '37.3882807, -122.0828559'
};

var messageMerged = {
  meta: {
    address: null,
    phone: null
  },
  user: 'jen@test.com',
  name: 'test location',
  content: {
    ratings: []
  },
  location: '37.3882807, -122.0828559'
};

p.flush('./test/db');

describe('prohibition', function () {
  describe('.create',  function () {
    it('creates an invalid message', function (done) {
      message.name = null;
      p.create(message, function (err, m) {
        should.exist(err);
        done();
      });
    });

    it('creates a valid message', function (done) {
      message.name = 'test location';
      p.create(message, function (err, m) {
        should.exist(m);
        id = m.id;
        m.content.should.equal(message.content);
        p.getAll(0, function (err, mArr) {
          mArr.length.should.equal(1);
          mArr[0].user.should.eql(messageMerged.user);
          mArr[0].content.ratings.length.should.equal(0);
          mArr[0].location.should.equal(messageMerged.location);
          should.exist(mArr[0].content.created);
          done();
        });
      });
    });
  });

  describe('.get', function () {
    it('gets a message', function (done) {
      p.get(id, function (err, m) {
        should.exist(m);
        done();
      });
    });

    it('does not get a message', function (done) {
      p.get(1111, function (err, m) {
        should.exist(err);
        done();
      });
    });
  });

  describe('.update', function () {
    it('updates a message', function (done) {
      p.get(id, function (err, m) {
        message.name = 'new location!';
        message.meta = {};
        message.meta.phone = '12345';

        setTimeout(function () {
          p.update(message, id, function (err, mt) {
            mt.name.should.equal(message.name);
            mt.meta.phone.should.equal(message.meta.phone);
            done();
          });
        }, 500);
      });
    });
  });

  describe('.getAll', function () {
    it('get all messages', function (done) {
      p.getAll(0, function (err, mArr) {
        should.exist(mArr);
        mArr.length.should.equal(1);
        done();
      });
    });
  });

  describe('.del', function () {
    it('deletes a message', function (done) {
      p.create(message, function (err, m) {
        secId = m.id;
        p.del(id, function (err, status) {
          setTimeout(function () {
            p.get(id, function (err, msg) {
              should.not.exist(msg);
              p.getAll(0, function (err, mArr) {
                mArr.length.should.equal(1);
                done();
              });
            });
          }, 500);
        });
      });
    });
  });
});
