const functions = require('firebase-functions');

// Listens for new messages added to /messages/:pushId/original and creates an
// uppercase version of the message to /messages/:pushId/uppercase
exports.inbox = functions.https.onRequest((req, res) => {
    res.status(200).send('HELLO WORLD!');
});