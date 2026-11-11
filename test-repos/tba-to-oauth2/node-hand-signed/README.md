# acme-order-bridge

Moves paid web-store orders into NetSuite through the order-import RESTlet and pulls
stock levels back every hour.

Copy `.env` and fill in the NetSuite token values from the integration record and the
access token page. `config/default.json` holds the sandbox defaults.
