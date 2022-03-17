const functions = require('firebase-functions');
const firebaseAdmin = require('firebase-admin');
const crypto = require('crypto');
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const privkey = require('./private-key.js').key;
const firebaseConfig = require('./firebase-config.js').config;
const {
    localDomain,
    localActor
} = require('./as-config.js').config;

firebaseAdmin.initializeApp(firebaseConfig);

const ACTIVITYSTREAMS_CONTEXT = 'https://www.w3.org/ns/activitystreams';
const CONTENT_TYPE_HEADER = `application/ld+json; profile="${ACTIVITYSTREAMS_CONTEXT}"`;
const OK_MESSAGE = {
    "@context": ACTIVITYSTREAMS_CONTEXT
};

const app = express();
app.use(express.json({strict: false}));

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
            'Content-Type': CONTENT_TYPE_HEADER,
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
      '@context': ACTIVITYSTREAMS_CONTEXT,
      'id': `${localDomain}/as/${guid}`,
      'type': 'Accept',
      'actor': localActor,
      'object': followRequest,
    };
    await signAndSendToForeignActorInbox(foreignActor, message);
};

const sendFollowMessage = async (foreignActor) => {
    const guid = crypto.randomBytes(16).toString('hex');
    const message = {
      '@context': ACTIVITYSTREAMS_CONTEXT,
      'id': `${localDomain}/as/${guid}`,
      'type': 'Follow',
      'actor': localActor,
      'object': foreignActor
    };
    await signAndSendToForeignActorInbox(foreignActor, message);
};

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

            res
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        } else if (type === 'Undo' && object.type === 'Follow') {
            console.log('Undo Follow....');
            console.log(data);
            
            firebaseAdmin.database().ref('/as/followers').limitToLast(100).once('value').then(snapshot => {
                const value = (snapshot.exists() ? snapshot.val() : null) || {};
                const [timestamp] = Object.entries(value).find(([, child]) => child.id === foreignActor);

                if (timestamp) {
                    firebaseAdmin.database().ref(`/as/followers/${timestamp}`).set(null);
                }
            
                res
                    .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                    .status(200)
                    .send(OK_MESSAGE);
            });
        } else if (type === 'Create') {
            firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(object);

            res
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        } else if (type === 'Like') {
            firebaseAdmin.database().ref(`/as/inbox/${Date.now()}`).set(data);

            res
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        } else if (type === 'Accept') {
            console.log('ACCEPT...');
            res  
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        } else {
            console.log('OTHER...');
            res
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        }
    } catch (error) {
        console.log({error});
        console.log(req.body);
        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send(OK_MESSAGE);
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
    
    firebaseAdmin.database().ref('/as/inbox').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const inbox = Object.values(value).reverse();

        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send({
                "@context": ACTIVITYSTREAMS_CONTEXT,
                "type": "OrderedCollection",
                "totalItems": inbox.length,
                "id": `${localDomain}/as/inbox`,
                "first": {
                    "id": `${localDomain}/as/inbox?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": inbox.length,
                    "partOf": `${localDomain}/as/inbox`,
                    "orderedItems": inbox
                }
            });
    });
};

const handleOutboxGetRequest = (req, res) => {
    try {
        const data = JSON.parse(req.body.toString());
        // record request
        firebaseAdmin.database().ref(`/as/log/outbox/get/${Date.now()}`).set(data);
    } catch (error) {
        console.log(req.body);
    }
    
    firebaseAdmin.database().ref('/as/outbox').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const outbox = Object.values(value).reverse();

        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send({
                "@context": ACTIVITYSTREAMS_CONTEXT,
                "type": "OrderedCollection",
                "totalItems": outbox.length,
                "id": `${localDomain}/as/outbox`,
                "first": {
                    "id": `${localDomain}/as/outbox?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": outbox.length,
                    "partOf": `${localDomain}/as/outbox`,
                    "orderedItems": outbox
                }
            });
    });
};

const handleFollowersGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/followers').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const followers = Object.values(value).map(child => child.id).reverse();

        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send({
                "@context": ACTIVITYSTREAMS_CONTEXT,
                "type": "OrderedCollection",
                "totalItems": followers.length,
                "id": `${localDomain}/as/followers`,
                "first": {
                    "id": `${localDomain}/as/followers?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": followers.length,
                    "partOf": `${localDomain}/as/followers`,
                    "orderedItems": followers
                }
            });
    });
};

const handleFollowingGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/following').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const following = Object.values(value).map(child => child.id).reverse();

        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send({
                "@context": ACTIVITYSTREAMS_CONTEXT,
                "type": "OrderedCollection",
                "totalItems": following.length,
                "id": `${localDomain}/as/following`,
                "first": {
                    "id": `${localDomain}/as/following?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": following.length,
                    "partOf": `${localDomain}/as/following`,
                    "orderedItems": following
                }
            });
    });
};

const handleLikesGetRequest = (req, res) => {
    firebaseAdmin.database().ref('/as/likes').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const likes = Object.values(value).map(child => child.id).reverse();

        res
            .setHeader('Content-Type', CONTENT_TYPE_HEADER)
            .status(200)
            .send({
                "@context": ACTIVITYSTREAMS_CONTEXT,
                "type": "OrderedCollection",
                "totalItems": likes.length,
                "id": `${localDomain}/as/likes`,
                "first": {
                    "id": `${localDomain}/as/likes?page=1`,
                    "type": "OrderedCollectionPage",
                    "totalItems": likes.length,
                    "partOf": `${localDomain}/as/likes`,
                    "orderedItems": likes
                }
            });
    });
};

app.post('/as/inbox', handleInboxPostRequest);
app.get('/as/inbox', handleInboxGetRequest);
app.get('/as/outbox', handleOutboxGetRequest);
app.get('/as/followers', handleFollowersGetRequest);
app.get('/as/following', handleFollowingGetRequest);
app.get('/as/likes', handleLikesGetRequest);
app.post('/as/admin/follow', async (req, res) => {
    const foreignActor = req.params.actor;

    await sendFollowMessage(foreignActor);

    firebaseAdmin.database().ref(`/as/following/${Date.now()}`).set({
        id: foreignActor
    });
    
    res
        .setHeader('Content-Type', CONTENT_TYPE_HEADER)
        .status(200)
        .send(OK_MESSAGE);
});
app.post('/as/admin/like', async (req, res) => {
    const foreignActor = req.body.actor;
    const guid = crypto.randomBytes(16).toString('hex');

    const message = {
        "@context": ACTIVITYSTREAMS_CONTEXT,
        id: `${localDomain}/as/${guid}`,
        type: "Like",
        actor: localActor,
        object: req.body.id
    };
    
    firebaseAdmin.database().ref(`/as/likes/${Date.now()}`).set({
        id: message.object
    });

    await signAndSendToForeignActorInbox(foreignActor, message);

    res
        .setHeader('Content-Type', CONTENT_TYPE_HEADER)
        .status(200)
        .send(OK_MESSAGE);
});
app.post('/as/admin/create', (req, res) => {
    firebaseAdmin.database().ref('/as/followers').limitToLast(100).once('value').then(snapshot => {
        const value = (snapshot.exists() ? snapshot.val() : null) || {};
        const followers = Object.values(value).map(child => child.id).reverse();
        const guid = crypto.randomBytes(16).toString('hex');

        const message = {
            "@context": ACTIVITYSTREAMS_CONTEXT,
            id: `${localDomain}/as/${guid}`,
            type: "Create",
            actor: localActor,
            object: {
                id: `${localDomain}/as/notes/${guid}`,
                url: `${localDomain}/posts/${guid}`,
                type: 'Note',
                content: req.body.content,
                contentMap: {
                    en: req.body.content
                },
                cc: [
                    `${localDomain}/as/followers`
                ],
                to: [
                    "https://www.w3.org/ns/activitystreams#Public"
                ],
                sensitive: false,
                attributedTo: `${localDomain}/as/actor`,
                published: new Date().toUTCString()
            }
        };
    
        firebaseAdmin.database().ref(`/as/outbox/${Date.now()}`).set(message.object);

        const signAndSendPromises = [];

        for (const foreignActor of followers) {
            signAndSendPromises.push(signAndSendToForeignActorInbox(foreignActor, message));
        }

        Promise.all(signAndSendPromises).then(() => {
            res
                .setHeader('Content-Type', CONTENT_TYPE_HEADER)
                .status(200)
                .send(OK_MESSAGE);
        });
    });
});

exports.as = functions.https.onRequest(app);
