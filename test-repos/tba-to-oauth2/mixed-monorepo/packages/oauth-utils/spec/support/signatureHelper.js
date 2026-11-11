// Spec helper: reference OAuth 1.0a signer to check our encoders against
// a request shaped like the worked example in RFC 5849 section 3.4.1.
const crypto = require('crypto');
const { percentEncode, normalizeParams } = require('../../src');

function referenceSignature({ method, url, params, consumerSecret, tokenSecret, algorithm = 'HMAC-SHA1' }) {
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(normalizeParams(params))].join('&');
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret || '')}`;
  const hash = algorithm === 'HMAC-SHA256' ? 'sha256' : 'sha1';
  return { baseString, oauth_signature: crypto.createHmac(hash, key).update(baseString).digest('base64') };
}

const RFC5849_EXAMPLE = {
  method: 'POST',
  url: 'http://example.com/request',
  params: {
    b5: '=%3D', a3: 'a', 'c@': '', a2: 'r b', oauth_consumer_key: 'FAKE_CONSUMER_KEY',
    oauth_token: 'FAKE_TOKEN', oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: '137131201', oauth_nonce: '7d8f3e4a', c2: '',
  },
  consumerSecret: 'FAKE_CONSUMER_SECRET',
  tokenSecret: 'FAKE_TOKEN_SECRET',
};

beforeEach(function () {
  this.referenceSignature = referenceSignature;
  this.rfcExample = RFC5849_EXAMPLE;
});
