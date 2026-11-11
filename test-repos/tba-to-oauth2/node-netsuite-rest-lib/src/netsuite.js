const NsApiWrapper = require('netsuite-rest');

const ns = new NsApiWrapper({
  consumer_key: process.env.NS_CONSUMER_KEY,
  consumer_secret_key: process.env.NS_CONSUMER_SECRET,
  token: process.env.NS_TOKEN,
  token_secret: process.env.NS_TOKEN_SECRET,
  realm: process.env.NS_ACCOUNT_ID,
  base_url: process.env.NS_BASE_URL,
});

module.exports = ns;
