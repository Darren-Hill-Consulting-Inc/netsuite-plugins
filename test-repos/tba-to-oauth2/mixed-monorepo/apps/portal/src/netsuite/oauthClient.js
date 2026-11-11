const crypto = require('crypto');
const OAuth = require('oauth-1.0a');

const account = process.env.NS_ACCOUNT_ID;
const host = account.toLowerCase().replace(/_/g, '-');

const oauth = OAuth({
  consumer: { key: process.env.NS_CONSUMER_KEY, secret: process.env.NS_CONSUMER_SECRET },
  signature_method: 'HMAC-SHA256',
  realm: account,
  hash_function(baseString, key) {
    return crypto.createHmac('sha256', key).update(baseString).digest('base64');
  },
});

module.exports = {
  oauth,
  account,
  restletBase: `https://${host}.restlets.api.netsuite.com`,
  uiBase: `https://${host}.app.netsuite.com`,
};
