# Prohibition

A node module that provides a generic API for apps to fulfill tasks such as the following:

* Find a store in a particular location and rate the service
* Find the nearest coffee shop and add a note

## What is this good for?

This is great for building apps that require place, location and rating metadata.

If you plan to build the next Yelp or Foursquare, this might be a good start!

## Prohibition JSON format

    {
        id: 1,
        user: 'jen@myemail.com',
        name: 'An awesome coffee shop',
        content: {
            created: 1368383147,
            ratings: [
                {
                    user: 'frida@casapartyfuntime.es',
                    url: 'This place is literally the best!',
                    created: 1368383147,
                    score: 5
                }
            ],
            maxRating: 5
        },
        location: [37.3882807, -122.0828559]
    }

## How to setup

Install [leveldb](https://code.google.com/p/leveldb/downloads/list) and dependencies

    > npm install

## Prohibition actions

### Setup

    var Prohibition = require('prohibition');

    var prohibition = new Prohibition({
      meta: {
        address: null,
        phone: null
      },
      db: './db',
      maxRating: 5,
      limit: 10
    });

`meta` is a list of extra string fields you would like to include (optional).

`db` is the path where your leveldb database is located (mandatory).

`maxRating` is the highest value for your rating - defaults to 5 (optional).

`limit` is the maximum number of records to return - defaults to 10 (optional).

### Create a new record

    var message = {
      user: 'test@test.com',
      name: 'test location',
      content: {
        ratings: []
      },
      location: [37.3882807, -122.0828559]
    };

    prohibition.create(message, function (err, m) {
      if (!err) {
        console.log(m);
      }
    });

### Get an existing record

    prohibition.get(1, function (err, m) {
      if (!err) {
        console.log(m);
      }
    });

### Update an existing record

    var message = {
      user: 'test@test.com',
      name: 'test location updated'
    };

    prohibition.update(message, 1, function (err, m) {
      if (!err) {
        console.log(m);
      }
    });

### Get a paginated list of the most recent records

    prohibition.getAll(0, function (err, mArr) {
      if (!err) {
        console.log(mArr);
      }
    });

### Get the distance of all records from a specific location

    prohibition.getNearest([37.405992, -122.078515], function (err, mArr) {
      if (!err) {
        console.log(mArr);
      }
    });

### Delete an existing record

    prohibition.del(1, function (err, status) {
      if (!err) {
        console.log('deleted!');
      }
    });

### Delete the database

    prohibition.flush();
