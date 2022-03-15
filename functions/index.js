const functions = require('firebase-functions');

exports.inbox = functions.https.onRequest((req, res) => {
    res.status(200).send('HELLO WORLD!');
});