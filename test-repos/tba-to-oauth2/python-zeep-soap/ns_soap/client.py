import base64
import configparser
import hashlib
import hmac
import secrets
import time
from pathlib import Path

from zeep import Client
from zeep.cache import SqliteCache
from zeep.transports import Transport

CONFIG = configparser.ConfigParser()
CONFIG.read(Path(__file__).resolve().parent.parent / "config" / "netsuite.ini")
NS = CONFIG["netsuite"]

HOST = NS["account"].lower().replace("_", "-")
WSDL = f"https://{HOST}.suitetalk.api.netsuite.com/wsdl/v{NS['wsdl_version']}/netsuite.wsdl"

_client = None


def client():
    global _client
    if _client is None:
        _client = Client(WSDL, transport=Transport(cache=SqliteCache(), timeout=300))
    return _client


def token_passport():
    """Build a fresh TokenPassport; NetSuite rejects a reused nonce."""
    c = client()
    nonce = secrets.token_hex(10)
    timestamp = str(int(time.time()))
    base = "&".join([NS["account"], NS["consumer_key"], NS["token_id"], nonce, timestamp])
    key = f"{NS['consumer_secret']}&{NS['token_secret']}"
    digest = hmac.new(key.encode(), base.encode(), hashlib.sha256).digest()
    Signature = c.get_type("ns0:TokenPassportSignature")
    TokenPassport = c.get_type("ns0:TokenPassport")
    return TokenPassport(
        account=NS["account"],
        consumerKey=NS["consumer_key"],
        token=NS["token_id"],
        nonce=nonce,
        timestamp=timestamp,
        signature=Signature(base64.b64encode(digest).decode(), algorithm="HMAC_SHA256"),
    )


def service():
    # Bind to the account-specific endpoint instead of the generic webservices host.
    c = client()
    return c.create_service(
        "{urn:platform_2023_2.webservices.netsuite.com}NetSuiteBinding",
        f"https://{HOST}.suitetalk.api.netsuite.com/services/NetSuitePort_{NS['wsdl_version'][:6]}",
    )
