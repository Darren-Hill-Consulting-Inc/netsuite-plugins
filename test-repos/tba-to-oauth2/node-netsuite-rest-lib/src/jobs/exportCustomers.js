const ns = require('../netsuite');

const PAGE = 1000;

// Pages through SuiteQL; NetSuite caps a page at 1000 rows.
async function* customers(since) {
  let offset = 0;
  for (;;) {
    const res = await ns.request({
      path: `query/v1/suiteql?limit=${PAGE}&offset=${offset}`,
      method: 'POST',
      body: JSON.stringify({
        q: `SELECT id, entityid, companyname, email, lastmodifieddate
            FROM customer
            WHERE lastmodifieddate >= TO_DATE('${since}', 'YYYY-MM-DD')`,
      }),
    });
    for (const row of res.data.items) yield row;
    if (!res.data.hasMore) return;
    offset += PAGE;
  }
}

async function customerDetail(id) {
  const res = await ns.request({ path: `record/v1/customer/${id}?expandSubResources=true` });
  return res.data;
}

module.exports = { customers, customerDetail };
