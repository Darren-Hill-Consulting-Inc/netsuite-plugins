'use strict';

const axios = require('axios');
const log = require('pino')({ name: 'orderRestlet' });
const { authHeader, restletUrl } = require('../lib/nsAuth');

const ORDER_URL = restletUrl('orders');

/**
 * Sends one web-store order to the order-import RESTlet.
 * Returns the NetSuite sales order internal id.
 */
async function pushOrder(order) {
  const body = {
    externalId: `WEB-${order.number}`,
    customer: { email: order.customer.email, name: order.customer.name },
    lines: order.lines.map((l) => ({ sku: l.sku, qty: l.quantity, rate: l.unitPrice })),
    shipMethod: order.shipping.code,
  };

  try {
    const res = await axios.post(ORDER_URL, body, {
      headers: { Authorization: authHeader('POST', ORDER_URL), 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    log.info({ order: order.number, id: res.data.id }, 'order created');
    return res.data.id;
  } catch (err) {
    log.error({ order: order.number, status: err.response && err.response.status }, 'order push failed');
    throw err;
  }
}

module.exports = { pushOrder };
