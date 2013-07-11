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
            ]
        },
        location: '37.3882807, -122.0828559'
    }