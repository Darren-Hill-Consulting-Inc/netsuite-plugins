'use strict';

const axios = require('axios');
const { authHeader, restletUrl } = require('../lib/nsAuth');

// GET /restlet.nl?script=..&deploy=1&skus=A,B,C
async function stockLevels(skus) {
  const url = `${restletUrl('inventory')}&skus=${encodeURIComponent(skus.join(','))}`;
  const res = await axios.get(url, { headers: { Authorization: authHeader('GET', url) } });
  return res.data.items.reduce((acc, row) => {
    acc[row.sku] = Number(row.available);
    return acc;
  }, {});
}

module.exports = { stockLevels };
