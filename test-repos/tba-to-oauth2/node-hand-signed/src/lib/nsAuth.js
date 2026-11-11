'use strict';

// OAuth 1.0a header for NetSuite token-based auth.
// We roll our own because the oauth libs we tried didn't sort the query params
// the way NetSuite wanted for RESTlets (see ticket ERP-412).

const crypto = require('crypto');
const config = require('config');

const ns = config.get('netsuite');

function creds() {
  return {
    account: process.env.NS_ACCOUNT_ID || ns.accountId,
    consumerKey: process.env.NS_CONSUMER_KEY || ns.consumerKey,
    consumerSecret: process.env.NS_CONSUMER_SECRET || ns.consumerSecret,
    tokenId: process.env.NS_TOKEN_ID || ns.tokenId,
    tokenSecret: process.env.NS_TOKEN_SECRET || ns.tokenSecret,
  };
}

// RFC 3986 encoding; encodeURIComponent leaves !'()* alone.
function rfc3986(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function nonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build the Authorization header for a RESTlet call.
 * @param {string} method HTTP method
 * @param {string} url full URL including ?script=...&deploy=...
 */
function authHeader(method, url) {
  const c = creds();
  const u = new URL(url);

  const oauth = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: nonce(),
    oauth_signature_method: 'HMAC-SHA256',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.tokenId,
    oauth_version: '1.0',
  };

  const params = [];
  for (const [k, v] of u.searchParams) params.push([rfc3986(k), rfc3986(v)]);
  for (const [k, v] of Object.entries(oauth)) params.push([rfc3986(k), rfc3986(v)]);
  params.sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const paramString = params.map(([k, v]) => `${k}=${v}`).join('&');

  const baseUrl = `${u.protocol}//${u.host}${u.pathname}`;
  const baseString = [method.toUpperCase(), rfc3986(baseUrl), rfc3986(paramString)].join('&');
  const signingKey = `${rfc3986(c.consumerSecret)}&${rfc3986(c.tokenSecret)}`;
  const signature = crypto.createHmac('sha256', signingKey).update(baseString).digest('base64');

  const header = { realm: c.account, ...oauth, oauth_signature: signature };
  return 'OAuth ' + Object.entries(header).map(([k, v]) => `${k}="${rfc3986(v)}"`).join(', ');
}

function restletUrl(name) {
  const r = ns.restlets[name];
  return `${ns.restletHost}/app/site/hosting/restlet.nl?script=${r.script}&deploy=${r.deploy}`;
}

module.exports = { authHeader, restletUrl };
