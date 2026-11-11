// "Connect your NetSuite login": the TBA three-step flow.
// The rep signs in to NetSuite, approves the portal, and we keep their access token.
const express = require('express');
const axios = require('axios');
const { oauth, restletBase, uiBase } = require('../netsuite/oauthClient');
const db = require('../db');

const router = express.Router();
const CALLBACK = process.env.NS_CALLBACK_URL;

function parseForm(body) {
  return Object.fromEntries(new URLSearchParams(body));
}

router.get('/netsuite/connect', async (req, res, next) => {
  try {
    const request = { url: `${restletBase}/rest/requesttoken`, method: 'POST', data: { oauth_callback: CALLBACK } };
    const r = await axios.post(request.url, null, { headers: oauth.toHeader(oauth.authorize(request)) });
    const temp = parseForm(r.data);
    req.session.nsRequestSecret = temp.oauth_token_secret;
    res.redirect(`${uiBase}/app/login/secure/authorizetoken.nl?oauth_token=${encodeURIComponent(temp.oauth_token)}`);
  } catch (err) {
    next(err);
  }
});

router.get('/netsuite/callback', async (req, res, next) => {
  try {
    const { oauth_token: token, oauth_verifier: verifier } = req.query;
    const request = { url: `${restletBase}/rest/accesstoken`, method: 'POST', data: { oauth_verifier: verifier } };
    const requestToken = { key: token, secret: req.session.nsRequestSecret };
    const r = await axios.post(request.url, null, { headers: oauth.toHeader(oauth.authorize(request, requestToken)) });
    const access = parseForm(r.data);
    await db.query(
      'INSERT INTO netsuite_tokens (user_id, token_id, token_secret) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET token_id = $2, token_secret = $3',
      [req.session.userId, access.oauth_token, access.oauth_token_secret],
    );
    delete req.session.nsRequestSecret;
    res.redirect('/cases');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
