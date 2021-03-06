var async = require('async'),
    _ = require('lodash'),
    App = require('../models/App'),
    User = require('../models/User'),
    PushServiceManager = require('../models/PushServiceManager'),
    PushController = {};


/**
 * Push controller send action.
 * @param {Object} req
 * @param {Object} res
 */
PushController.send = function(req, res) {
    if (!req.body.message) {
        console.log('Error: Bad request, message is missing.');
        return res.status(400).end();
    }

    // Handle if userIds is just string of single user id.
    var userIds = req.body.userIds;
    if (typeof req.body.userIds == 'string')
        userIds = [userIds];

    var matchQuery = {app: res.locals.app};
    if (!!userIds && _.isArray(userIds))
        matchQuery = { userId: {$in: req.body.userIds}, app: res.locals.app };

    // Get push service of the app
    PushServiceManager.get(res.locals.app, function(err, pushService) {
        if (err) {
            console.log('Error: Cannot get push service instance.', err);
            return res.status(500).end();
        }

        // Get devices from target users
        User.aggregate(
            [
                { $match: matchQuery },
                { $group: { _id: '$locale', devices: {$push: '$devices'}}}
            ],
            function (err, response) {
                if (err) {
                    console.log('Error: Mongodb aggregation failed.', err);
                    return res.status(500).end();
                }

                var text = null, payload = null;

                if (typeof req.body.message == 'string')
                    text = req.body.message;

                if (typeof req.body.payload == 'string' || typeof req.body.payload == 'object')
                    payload = req.body.payload;

                response.forEach(function(item) {
                    var locale = item._id,
                        devices = _.flatten(item.devices);

                    console.log('Device count: ' + devices.length);

                    // Handle if message is an object
                    if (req.body.message[locale])
                        text = req.body.message[locale];

                    // Send
                    if (text)
                        pushService.send(devices, text, payload);
                });


                res.status(200).end();
            }
        );
    });

};


module.exports = PushController;
