'use strict';

process.env.NODE_ENV = 'test';

var should = require('should');
var child = require('child_process');
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
  location: [37.3882807, -122.0828559]
};

var messageMerged = {
  meta: {
    address: false,
    phone: false
  },
  user: 'jen@test.com',
  name: 'test location',
  content: {
    ratings: []
  },
  location: [37.3882807, -122.0828559]
};

describe('prohibition', function () {
  after(function () {
    child.exec('rm -rf ./test/db');
  });

  describe('.create',  function () {
    it('creates an invalid message with no message', function (done) {
      message = null;
      p.create(message, function (err, m) {
        should.exist(err);
        err.toString().should.equal('Error: Post cannot be empty');
        message = {
          user: 'jen@test.com',
          name: 'test location',
          location: [37.3882807, -122.0828559]
        };
        done();
      });
    });

    it('creates an invalid message with a missing field', function (done) {
      message.name = null;
      p.create(message, function (err, m) {
        should.exist(err);
        err.toString().should.equal('Error: Post invalid - you are missing mandatory fields: name, user and/or location');
        done();
      });
    });

    it('creates an invalid message with incorrect coordinates', function (done) {
      message.name = 'test';
      message.location = '37.3882807, -122.0828559';
      p.create(message, function (err, m) {
        should.exist(err);
        err.toString().should.equal('Error: Location coordinates must be in the format of an array [lat, lon]');
        done();
      });
    });

    it('creates a valid message', function (done) {
      message.name = 'test location';
      message.location = [37.3882807, -122.0828559];
      p.create(message, function (err, m) {
        should.exist(m);
        id = m.id;
        m.content.should.equal(message.content);
        p.getAll(0, function (err, mArr) {
          mArr.length.should.equal(1);
          mArr[0].user.should.eql(messageMerged.user);
          mArr[0].meta.should.eql(messageMerged.meta);
          mArr[0].content.ratings.length.should.equal(0);
          mArr[0].location.should.eql(messageMerged.location);
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
        message.meta = {
          phone: '12345',
          address: '123 Street'
        };

        p.update(message, id, function (err, mt) {
          mt.name.should.equal(message.name);
          mt.meta.phone.should.equal(message.meta.phone);
          mt.meta.address.should.equal(message.meta.address);
          done();
        });
      });
    });

    it('adds a new valid rating', function (done) {
      p.get(id, function (err, m) {
        message.content.ratings = [
          {
            user: 'frida@casapartyfuntime.es',
            url: 'This place is literally the best!',
            score: 5
          }
        ];

        p.update(message, id, function (err, mt) {
          mt.content.ratings.should.eql(message.content.ratings);
          mt.content.average.should.equal(5);
          mt.content.totalRatings.should.equal(5);
          done();
        });
      });
    });

    it('adds a second new valid rating', function (done) {
      p.get(id, function (err, m) {
        message.content.ratings = [
          {
            user: 'frida@casapartyfuntime.es',
            url: 'This place is literally not so great',
            score: 1
          }
        ];

        p.update(message, id, function (err, mt) {
          mt.content.ratings.length.should.equal(2);
          mt.content.average.should.equal(3); // 6 / 2
          mt.content.totalRatings.should.equal(6); // 5 + 1
          done();
        });
      });
    });

    it('does not update a message with incorrect coordinates', function (done) {
      p.get(id, function (err, m) {
        message.location = '37.3882807, -122.0828559';

        p.update(message, id, function (err, mt) {
          should.exist(err);
          err.toString().should.equal('Error: Location coordinates must be in the format of an array [lat, lon]');
          done();
        });
      });
    });

    it('does not add an invalid rating with invalid user', function (done) {
      message.location = [37.3882807, -122.0828559];
      p.get(id, function (err, m) {
        message.content.ratings = [
          {
            user: '   ',
            url: 'This place is literally the best!',
            score: 5
          }
        ];

        p.update(message, id, function (err, mt) {
          err.toString().should.equal('Error: Rating field cannot be empty');
          done();
        });
      });
    });

    it('does not add an invalid rating with invalid score', function (done) {
      p.get(id, function (err, m) {
        message.content.ratings = [
          {
            user: 'frida@casapartyfuntime.es',
            url: 'This place is literally the best!',
            score: 'puppy'
          }
        ];

        p.update(message, id, function (err, mt) {
          err.toString().should.equal('Error: Score is not a number');
          done();
        });
      });
    });

    it('does not add an invalid rating with invalid max score', function (done) {
      p.get(id, function (err, m) {
        message.content.ratings = [
          {
            user: 'frida@casapartyfuntime.es',
            url: 'This place is literally the best!',
            score: 100
          }
        ];

        p.update(message, id, function (err, mt) {
          err.toString().should.equal('Error: Score is higher than the maxRating');
          delete message.content.ratings;
          done();
        });
      });
    });

    it('does not inject an average', function (done) {
      p.get(id, function (err, m) {
        message.content.average = 100;

        p.update(message, id, function (err, mt) {
          mt.content.average.should.equal(3); // no change
          done();
        });
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

  describe('.getNearest', function () {
    it('gets the nearest location for all messages', function (done) {
      p.getNearest([37.405992, -122.078515], function (err, mArr) {
        var m = mArr[0];

        p.get(m, function (err, res) {
          res.id.should.equal(m);
          res.location.should.eql(message.location);
          done();
        });
      });
    });

    it('does not get the nearest location for all messages', function (done) {
      p.getNearest('37.405992, -122.078515', function (err, mArr) {
        err.toString().should.equal('Error: Location coordinates must be in the format of an array [lat, lon]');
        done();
      });
    });
  });

  describe('.del', function () {
    it('deletes a message', function (done) {
      p.create(message, function (err, m) {
        secId = m.id;
        p.del(id, function (err) {
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

  describe('.getTotalRecords', function () {
    it('gets total records', function (done) {
      p.getTotalRecords(function (err, records) {
        should.exists(records);
        records.should.not.be.NaN;
        records.should.not.be.below(0);
        done();
      });
    });
  });
});
