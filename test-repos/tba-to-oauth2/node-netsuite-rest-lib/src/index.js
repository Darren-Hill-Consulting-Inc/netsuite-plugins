const { BigQuery } = require('@google-cloud/bigquery');
const { customers, customerDetail } = require('./jobs/exportCustomers');

const bq = new BigQuery();
const table = bq.dataset(process.env.BQ_DATASET).table('customers');

async function run() {
  const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const batch = [];
  for await (const c of customers(since)) {
    const detail = await customerDetail(c.id);
    batch.push({ ...c, terms: detail.terms && detail.terms.refName });
    if (batch.length === 500) await table.insert(batch.splice(0));
  }
  if (batch.length) await table.insert(batch);
}

setInterval(() => run().catch(console.error), 60 * 60 * 1000);
run().catch(console.error);
