const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const privkey = require('./private-key.js').key;

firebaseAdmin.initializeApp({
    apiKey: "AIzaSyB6ocubyR0Ddg7NdmA1bIFiuOH4nnVSI4w",
    projectId: "pickpuck-com",
    databaseURL: "https://pickpuck-com.firebaseio.com",
});

const app = express();
app.use(express.json({strict: false}));

const localActor = 'https://michaelpuckett.engineer/as/actor';

const signAndSendToActorInbox = async (message) => {
    firebaseAdmin.database().ref(`/as/outbox/${Date.now()}`).set(message);
    const foreignActor = message.object.actor;
    const foreignActorInbox = `${foreignActor}/inbox`;
    const foreignDomain = new URL(foreignActorInbox).hostname;
    const foreignPathName = new URL(foreignActorInbox).pathname;

    // sign
    const digestHash = crypto.createHash('sha256').update(JSON.stringify(message)).digest('base64');
    const signer = crypto.createSign('sha256');
    const dateString = new Date().toUTCString();
    const stringToSign = `(request-target): post ${foreignPathName}\nhost: ${foreignDomain}\ndate: ${dateString}\ndigest: SHA-256=${digestHash}`;
    signer.update(stringToSign);
    signer.end();
    const signature = signer.sign(privkey);
    const signature_b64 = signature.toString('base64');
    const signatureHeader = `keyId="${localActor}#main-key",headers="(request-target) host date digest",signature="${signature_b64}"`;
    
    // send
    await fetch(foreignActorInbox, {
        method: 'post',
        body: JSON.stringify(message),
        headers: {
            'Content-Type': 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
            'Host': foreignDomain,
            'Date': dateString,
            'Digest': `SHA-256=${digestHash}`,
            'Signature': signatureHeader
        }
    }).then(async (response) => {
        const responseBody = await response.text();
        console.log({responseBody});
        // record response
        firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set({responseBody});
    }).catch((error) => {
        console.log('ERROR...');
        console.log({error});
    });
};

const sendAcceptMessage = async (object) => {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `https://michaelpuckett.engineer/as/${guid}`,
      'type': 'Accept',
      'actor': localActor,
      'object': object,
    };
    await signAndSendToActorInbox(message);
};

const handleInboxPostRequest = async (req, res) => {
    try {
        const data = JSON.parse(req.body.toString());
        const {
            id,
            type,
            actor,
            object
        } = data;

        // record request
        firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(data);

        if (type === 'Follow' && object === localActor) {
            await sendAcceptMessage(data);

            // record response
            firebaseAdmin.database().ref(`/as/followers/${Date.now()}`).set({
                id: actor
            });

            res.status(200).send({
                "@context": "https://www.w3.org/ns/activitystreams"
            });
        } else if (type === 'Undo') {
            firebaseAdmin.database().ref('/as/followers').once('value').then(snapshot => {
                const [timestamp] = Object.entries(snapshot.val() || {}).find(([, child]) => child.id === actor);
                firebaseAdmin.database().ref(`/as/followers/${timestamp}`).set(null);

                res
                    .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                    .status(200)
                    .send({
                        "@context": "https://www.w3.org/ns/activitystreams"
                    });
            });
        } else {
            console.log('OTHER...');
            res
                .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                .status(200)
                .send({
                    "@context": "https://www.w3.org/ns/activitystreams"
                });
        }
    } catch (error) {
        console.log({error});
        console.log(req.body);
        res
            .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
            .status(200)
            .send({
                "@context": "https://www.w3.org/ns/activitystreams"
            });
    }
};

const handleInboxGetRequest = (req, res) => {
    try {
        const data = JSON.parse(req.body.toString());
        // record request
        firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(data);
    } catch (error) {
        console.log(req.body);
    }
    
    res
        .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
        .status(200)
        .send({
            "@context": "https://www.w3.org/ns/activitystreams"
        });
};

const handleFollowersGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/followers').once('value').then(snapshot => {
        const followers = Object.values(snapshot.val() || {}).map(child => child.id);

        res
            .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
            .status(200)
            .send({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "OrderedCollection",
                "totalItems": followers.length,
                "id": `https://michaelpuckett.engineer/as/followers`,
                "first": {
                    "id": `https://michaelpuckett.engineer/as/followers?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": followers.length,
                    "partOf": 'https://michaelpuckett.engineer/as/followers',
                    "orderedItems": followers
                }
            });
    });
};

app.post('/as/inbox', handleInboxPostRequest);
app.get('/as/inbox', handleInboxGetRequest);
app.get('/as/followers', handleFollowersGetRequest);

exports.as = functions.https.onRequest(app);
