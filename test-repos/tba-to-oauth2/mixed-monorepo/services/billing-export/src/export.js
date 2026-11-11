import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { accessToken, restBase } from './token.js';

const s3 = new S3Client({});

async function suiteql(q, offset = 0) {
  const res = await fetch(`${restBase}/query/v1/suiteql?limit=1000&offset=${offset}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken()}`, Prefer: 'transient', 'Content-Type': 'application/json' },
    body: JSON.stringify({ q }),
  });
  if (!res.ok) throw new Error(`SuiteQL ${res.status}`);
  return res.json();
}

export async function run(day) {
  const q = `SELECT id, tranid, entity, total FROM transaction WHERE type = 'CustInvc' AND trandate = TO_DATE('${day}', 'YYYY-MM-DD')`;
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await suiteql(q, offset);
    rows.push(...page.items);
    if (!page.hasMore) break;
  }
  await s3.send(new PutObjectCommand({
    Bucket: process.env.LAKE_BUCKET,
    Key: `netsuite/invoices/${day}.json`,
    Body: JSON.stringify(rows),
  }));
}
