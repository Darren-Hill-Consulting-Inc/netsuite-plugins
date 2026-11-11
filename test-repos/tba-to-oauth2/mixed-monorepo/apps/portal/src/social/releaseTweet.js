// Posts the portal release notes to the company Twitter account.
const crypto = require('crypto');
const axios = require('axios');
const OAuth = require('oauth-1.0a');

const oauth = OAuth({
  consumer: { key: process.env.TWITTER_API_KEY, secret: process.env.TWITTER_API_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(baseString, key) {
    return crypto.createHmac('sha1', key).update(baseString).digest('base64');
  },
});

const token = { key: process.env.TWITTER_ACCESS_TOKEN, secret: process.env.TWITTER_ACCESS_SECRET };

async function tweetRelease(version, notes) {
  const request = { url: 'https://api.twitter.com/2/tweets', method: 'POST' };
  const text = `Portal ${version} is live: ${notes}`.slice(0, 280);
  await axios.post(request.url, { text }, {
    headers: { ...oauth.toHeader(oauth.authorize(request, token)), 'Content-Type': 'application/json' },
  });
}

module.exports = { tweetRelease };
