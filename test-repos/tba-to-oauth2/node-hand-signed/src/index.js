'use strict';

require('dotenv').config();
const cron = require('node-cron');
const axios = require('axios');
const config = require('config');
const log = require('pino')({ name: 'order-bridge' });
const { pushOrder } = require('./clients/orderRestlet');
const { stockLevels } = require('./clients/inventoryRestlet');

const store = config.get('store');

async function syncOrders() {
  const { data } = await axios.get(`${store.apiBase}/orders?status=paid&exported=false`);
  for (const order of data.orders) {
    await pushOrder(order);
    await axios.post(`${store.apiBase}/orders/${order.number}/exported`);
  }
}

async function syncStock() {
  const { data } = await axios.get(`${store.apiBase}/products?fields=sku`);
  const levels = await stockLevels(data.products.map((p) => p.sku));
  await axios.put(`${store.apiBase}/inventory`, levels);
}

cron.schedule(`*/${store.pollMinutes} * * * *`, () => syncOrders().catch((e) => log.error(e)));
cron.schedule('15 * * * *', () => syncStock().catch((e) => log.error(e)));
log.info('order bridge started');
