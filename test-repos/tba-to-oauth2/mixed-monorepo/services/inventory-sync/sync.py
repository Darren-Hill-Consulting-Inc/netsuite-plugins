"""Hourly job: push warehouse on-hand quantities into NetSuite inventory items.

Runs as a Kubernetes CronJob (deploy/helm/inventory-sync). Nobody is logged in when it runs;
it uses the integration user's token.
"""
import logging
import os

import requests
from requests_oauthlib import OAuth1

log = logging.getLogger("inventory-sync")

ACCOUNT = os.environ["NS_ACCOUNT_ID"]
NS_REST = f"https://{ACCOUNT.lower().replace('_', '-')}.suitetalk.api.netsuite.com/services/rest"
WMS = os.environ.get("WMS_URL", "https://wms.example.com/api")

auth = OAuth1(
    os.environ["NS_CONSUMER_KEY"],
    client_secret=os.environ["NS_CONSUMER_SECRET"],
    resource_owner_key=os.environ["NS_TOKEN_ID"],
    resource_owner_secret=os.environ["NS_TOKEN_SECRET"],
    realm=ACCOUNT,
    signature_method="HMAC-SHA256",
)


def on_hand():
    resp = requests.get(f"{WMS}/stock?site=main", timeout=60)
    resp.raise_for_status()
    return resp.json()["items"]


def push(item):
    resp = requests.patch(
        f"{NS_REST}/record/v1/inventoryItem/eid:{item['sku']}",
        json={"custitem_acme_wms_onhand": item["onHand"]},
        auth=auth,
        timeout=60,
    )
    if resp.status_code >= 400:
        log.warning("NetSuite rejected %s: %s %s", item["sku"], resp.status_code, resp.text[:300])
        return False
    return True


def main():
    logging.basicConfig(level=logging.INFO)
    items = on_hand()
    ok = sum(push(i) for i in items)
    log.info("updated %d of %d items", ok, len(items))


if __name__ == "__main__":
    main()
