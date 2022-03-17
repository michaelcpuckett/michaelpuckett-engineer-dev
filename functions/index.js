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

const signAndSendToForeignActorInbox = async (foreignActor, message) => {
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
        firebaseAdmin.database().ref(`/as/log/foreign/inbox/post/${Date.now()}`).set({responseBody});
    }).catch((error) => {
        console.log('ERROR...');
        console.log({error});
    });
};

const sendAcceptMessage = async (foreignActor, followRequest) => {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `https://michaelpuckett.engineer/as/${guid}`,
      'type': 'Accept',
      'actor': localActor,
      'object': followRequest,
    };
    await signAndSendToForeignActorInbox(foreignActor, message);
};

const sendFollowMessage = async (foreignActor) => {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      'id': `https://michaelpuckett.engineer/as/${guid}`,
      'type': 'Follow',
      'actor': localActor,
      'object': foreignActor
    };
    await signAndSendToForeignActorInbox(foreignActor, message);
}

const handleInboxPostRequest = async (req, res) => {
    try {
        const data = JSON.parse(req.body.toString());
        const {
            id,
            type,
            actor: foreignActor,
            object
        } = data;

        // record request
        firebaseAdmin.database().ref(`/as/log/inbox/post/${Date.now()}`).set(data);

        if (type === 'Follow' && object === localActor) {
            console.log('Follow....');

            await sendAcceptMessage(foreignActor, data);

            // record response
            firebaseAdmin.database().ref(`/as/followers/${Date.now()}`).set({
                id: foreignActor
            });

            res.status(200).send({
                "@context": "https://www.w3.org/ns/activitystreams"
            });
        } else if (type === 'Undo' && object.type === 'Follow') {
            console.log('Undo Follow....');

            firebaseAdmin.database().ref('/as/followers').once('value').then(snapshot => {
                const value = (snapshot.exists() ? snapshot.val() : null) || {};
                const [timestamp] = Object.entries(value).find(([, child]) => child.id === foreignActor);
                firebaseAdmin.database().ref(`/as/followers/${timestamp}`).set(null);

                res
                    .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                    .status(200)
                    .send({
                        "@context": "https://www.w3.org/ns/activitystreams"
                    });
            });
        } else if (type === 'Create') {
            firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(object);

            res
                .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                .status(200)
                .send({
                    "@context": "https://www.w3.org/ns/activitystreams"
                });
        } else if (type === 'Like') {
            firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(data);

            res
                .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                .status(200)
                .send({
                    "@context": "https://www.w3.org/ns/activitystreams"
                });
        } else if (type === 'Accept') {
            console.log('ACCEPT...');
            res
                .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
                .status(200)
                .send({
                    "@context": "https://www.w3.org/ns/activitystreams"
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
        firebaseAdmin.database().ref(`/as/log/inbox/get/${Date.now()}`).set(data);
    } catch (error) {
        console.log(req.body);
    }
    
    firebaseAdmin.database().ref('/as/inbox').once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const inbox = Object.values(value);

        res
            .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
            .status(200)
            .send({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "OrderedCollection",
                "totalItems": inbox.length,
                "id": `https://michaelpuckett.engineer/as/inbox`,
                "first": {
                    "id": `https://michaelpuckett.engineer/as/inbox?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": inbox.length,
                    "partOf": 'https://michaelpuckett.engineer/as/inbox',
                    "orderedItems": inbox
                }
            });
    });
};

const handleFollowersGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/followers').once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const followers = Object.values(value).map(child => child.id);

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

const handleFollowingGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/following').once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const following = Object.values(value).map(child => child.id);

        res
            .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
            .status(200)
            .send({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "OrderedCollection",
                "totalItems": following.length,
                "id": `https://michaelpuckett.engineer/as/following`,
                "first": {
                    "id": `https://michaelpuckett.engineer/as/following?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": following.length,
                    "partOf": 'https://michaelpuckett.engineer/as/following',
                    "orderedItems": following
                }
            });
    });
};

const handleLikesGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/likes').once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const likes = Object.values(value).map(child => child.id);

        res
            .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
            .status(200)
            .send({
                "@context": "https://www.w3.org/ns/activitystreams",
                "type": "OrderedCollection",
                "totalItems": likes.length,
                "id": `https://michaelpuckett.engineer/as/likes`,
                "first": {
                    "id": `https://michaelpuckett.engineer/as/likes?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": likes.length,
                    "partOf": 'https://michaelpuckett.engineer/as/likes',
                    "orderedItems": likes
                }
            });
    });
};

app.post('/as/inbox', handleInboxPostRequest);
app.get('/as/inbox', handleInboxGetRequest);
app.get('/as/followers', handleFollowersGetRequest);
app.get('/as/following', handleFollowingGetRequest);
app.get('/as/likes', handleLikesGetRequest);
app.get('/as/admin/follow/:user', async (req, res) => {
    const foreignActor = `https://mastodon.social/users/${req.params.user}`;

    await sendFollowMessage(foreignActor);

    firebaseAdmin.database().ref(`/as/following/${Date.now()}`).set({
        id: foreignActor
    });
    
    res
        .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
        .status(200)
        .send({
            "@context": "https://www.w3.org/ns/activitystreams"
        });
});
app.get('/as/admin/like', async (req, res) => {
    // TODO get original post author's actor
    const foreignActor = `https://mastodon.social/users/mpuckett`;
    const guid = crypto.randomBytes(16).toString('hex');

    const message = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `https://michaelpuckett.engineer/as/${guid}`,
        type: "Like",
        actor: localActor,
        object: "https://mastodon.social/users/mpuckett/statuses/107971356804521081"
    };
    
    firebaseAdmin.database().ref(`/as/likes/${Date.now()}`).set({
        id: message.object
    });

    await signAndSendToForeignActorInbox(foreignActor, message);

    res
        .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
        .status(200)
        .send({
            "@context": "https://www.w3.org/ns/activitystreams"
        });
});
app.post('/as/admin/create', async (req, res) => {
    // TODO get all followers
    const foreignActor = `https://mastodon.social/users/mpuckett`;
    const guid = crypto.randomBytes(16).toString('hex');

    const message = {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: `https://michaelpuckett.engineer/as/${guid}`,
        type: "Create",
        actor: localActor,
        object: {
            id: `https://michaelpuckett.engineer/as/notes/${guid}`,
            url: `https://michaelpuckett.engineer/posts/${guid}`,
            type: 'Note',
            content: req.body.content,
            contentMap: {
                en: req.body.content
            },
            cc: [
                'https://michaelpuckett.engineer/as/followers'
            ],
            to: [
                "https://www.w3.org/ns/activitystreams#Public"
            ],
            sensitive: false,
            attributedTo: 'https://michaelpuckett.engineer/as/actor',
            published: new Date().toUTCString()
        }
    };
    
    firebaseAdmin.database().ref(`/as/outbox/${Date.now()}`).set(message.object);

    await signAndSendToForeignActorInbox(foreignActor, message);
    
    res
        .setHeader('Content-Type', 'application/ld+json; profile="https://www.w3.org/ns/activitystreams"')
        .status(200)
        .send({
            "@context": "https://www.w3.org/ns/activitystreams"
        });
});

exports.as = functions.https.onRequest(app);
