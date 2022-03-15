const functions = require('firebase-functions');
const crypto = require('crypto');
const express = require('express');
const app = express();

app.use(express.json({strict: false}));

({
    '@context': 'https://www.w3.org/ns/activitystreams',
    'id': 'https://mastodon.social/users/mpuckett#follows/6123457/undo',
    'type': 'Undo',
    'actor': 'https://mastodon.social/users/mpuckett',
    'object': {
        'id': 'https://mastodon.social/9424d702-1db3-42f0-8f11-bde5bf2cba2c',
        'type': 'Follow',
        'actor': 'https://mastodon.social/users/mpuckett',
        'object': 'https://michaelpuckett.engineer/as/actor'
    }
});

const localActor = 'https://michaelpuckett.engineer/as/actor';

app.post('*', (req, res) => {
    try {
        const data = JSON.parse(req.body.toString());
        const {
            id,
            type,
            actor,
            object
        } = data;

        if (type === 'Follow' && object === localActor) {
            console.log(`SAVE TO DB HERE ${actor} from ${req.domain}`);
            const body = {
                "@context": "https://www.w3.org/ns/activitystreams",
                "id": "https://michaelpuckett.engineer/as/accept/",
                "type": "Accept",
                "actor": localActor,
                "object": {
                    id,
                    type,
                    actor,
                    object,
                }
            };
            const dateString = new Date().toUTCString();
            const digestHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('base64');
            const stringToSign = `keyId="https://michaelpuckett.engineer/as/actor#main-key",headers="(request-target) host date digest",signature="${signature_b64}"`;
            const signer = crypto.createSign('sha256');
            signer.update(stringToSign);
            signer.end();
            const privkey = ''//
            const signature = signer.sign(privkey);
            const signature_b64 = signature.toString('base64');
            const header = `keyId="https://michaelpuckett.engineer/as/actor#main-key",headers="(request-target) host date digest",signature="${signature_b64}"`;
            res.headers({
                'Host': req.domain,
                'Date': dateString,
                'Digest': `SHA-256=${digestHash}`,
                'Signature': header
            });
            res.method('POST');
            res.status(200);
            res.send(body);
        } else if (type === 'Undo') {
            console.log('UNDO...');
            console.log({object});
            res.status(200).send({
                "@context": "https://www.w3.org/ns/activitystreams"
            });
        }
    } catch {
        console.log(req.body);
        res.status(200).send({
            "@context": "https://www.w3.org/ns/activitystreams"
        });
    }
});

app.get('*', (req, res) => {
    console.log(req.body);
    res.status(200).send({
        "@context": "https://www.w3.org/ns/activitystreams"
    });
});

exports.inbox = functions.https.onRequest(app);
