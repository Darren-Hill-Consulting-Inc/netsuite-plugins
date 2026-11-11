"""Pull vendor bills for the AP automation tool."""
from .client import client, service, token_passport


def vendor_bill(internal_id: str):
    c = client()
    RecordRef = c.get_type("ns0:RecordRef")
    ref = RecordRef(internalId=internal_id, type="vendorBill")
    resp = service().get(baseRef=ref, _soapheaders={"tokenPassport": token_passport()})
    status = resp.body.readResponse.status
    if not status.isSuccess:
        raise RuntimeError(status.statusDetail[0].message)
    return resp.body.readResponse.record


def open_bills(page_size: int = 200):
    c = client()
    TransactionSearchBasic = c.get_type("ns5:TransactionSearchBasic")
    SearchEnumMultiSelectField = c.get_type("ns0:SearchEnumMultiSelectField")
    criteria = TransactionSearchBasic(
        type=SearchEnumMultiSelectField(searchValue=["_vendorBill"], operator="anyOf"),
    )
    prefs = {"searchPreferences": {"pageSize": page_size, "bodyFieldsOnly": True}}
    resp = service().search(
        searchRecord=criteria,
        _soapheaders={"tokenPassport": token_passport(), **prefs},
    )
    return resp.body.searchResult
