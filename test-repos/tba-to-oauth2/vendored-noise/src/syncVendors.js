require('dotenv').config();
const NsApiWrapper = require('netsuite-rest');

// Moved off the generated SOAP client in src/generated (kept until the AP team signs off).
const ns = new NsApiWrapper({
  consumer_key: process.env.NS_CONSUMER_KEY,
  consumer_secret_key: process.env.NS_CONSUMER_SECRET,
  token: process.env.NS_TOKEN_ID,
  token_secret: process.env.NS_TOKEN_SECRET,
  realm: process.env.NS_ACCOUNT_ID,
});

async function activeVendors() {
  const res = await ns.request({
    path: 'query/v1/suiteql?limit=1000',
    method: 'POST',
    body: JSON.stringify({ q: "SELECT id, entityid, email, terms FROM vendor WHERE isinactive = 'F'" }),
  });
  return res.data.items;
}

async function main() {
  const vendors = await activeVendors();
  const resp = await fetch(`${process.env.VENDOR_PORTAL_URL}/vendors/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vendors),
  });
  console.log(`pushed ${vendors.length} vendors: ${resp.status}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
