// Legacy accounting API client, signed with our OAuth 1.0a helper below.
// Kept for the UK entity's quarterly VAT pull until that moves to the new ledger.
const crypto = require('crypto');
const axios = require('axios');

const BASE = 'https://api.xero.com/api.xro/2.0';

const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

function sign(method, url, params) {
  const oauth = {
    oauth_consumer_key: process.env.XERO_CONSUMER_KEY,
    oauth_token: process.env.XERO_TOKEN,
    oauth_nonce: crypto.randomBytes(12).toString('hex'),
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_version: '1.0',
  };
  const all = { ...params, ...oauth };
  const paramString = Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&');
  const base = [method, enc(url), enc(paramString)].join('&');
  const key = `${enc(process.env.XERO_CONSUMER_SECRET)}&${enc(process.env.XERO_TOKEN_SECRET)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  const realm = process.env.XERO_TENANT;
  return `OAuth realm="${realm}", ` + Object.keys(oauth).map((k) => `${k}="${enc(oauth[k])}"`).join(', ');
}

async function vatReturn(from, to) {
  const url = `${BASE}/Reports/BASReport`;
  const params = { fromDate: from, toDate: to };
  const res = await axios.get(url, { params, headers: { Authorization: sign('GET', url, params), Accept: 'application/json' } });
  return res.data.Reports[0];
}

module.exports = { vatReturn };
