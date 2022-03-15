const functions = require('firebase-functions');
const crypto = require('crypto')

exports.inbox = functions.https.onRequest((req, res) => {
    console.log(req);
    res.status(200).send('{}');
});