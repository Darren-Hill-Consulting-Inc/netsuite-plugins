const express = require('express');
const axios = require('axios');
const { oauth, restletBase } = require('../netsuite/oauthClient');
const db = require('../db');

const router = express.Router();
const CASE_RESTLET = `${restletBase}/app/site/hosting/restlet.nl?script=customscript_acme_cs_cases&deploy=1`;

async function userToken(userId) {
  const { rows } = await db.query('SELECT token_id, token_secret FROM netsuite_tokens WHERE user_id = $1', [userId]);
  if (!rows.length) return null;
  return { key: rows[0].token_id, secret: rows[0].token_secret };
}

// Runs as the signed-in rep, so NetSuite applies their role and logs their name on the case.
router.get('/cases', async (req, res, next) => {
  try {
    const token = await userToken(req.session.userId);
    if (!token) return res.redirect('/netsuite/connect');
    const url = `${CASE_RESTLET}&assigned=me`;
    const r = await axios.get(url, { headers: oauth.toHeader(oauth.authorize({ url, method: 'GET' }, token)) });
    res.render('cases', { cases: r.data.cases });
  } catch (err) {
    next(err);
  }
});

router.post('/cases/:id/reply', express.json(), async (req, res, next) => {
  try {
    const token = await userToken(req.session.userId);
    const request = { url: CASE_RESTLET, method: 'POST' };
    const body = { caseId: req.params.id, message: req.body.message };
    const r = await axios.post(CASE_RESTLET, body, { headers: oauth.toHeader(oauth.authorize(request, token)) });
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
