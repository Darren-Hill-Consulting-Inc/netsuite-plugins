"""AP automation: the scheduler runs this every morning at 06:00 under the integration user."""
import json
import sys

from ns_soap.vendors import open_bills, vendor_bill

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(json.dumps(vendor_bill(sys.argv[1]), default=str, indent=2))
    else:
        result = open_bills()
        print(f"{result.totalRecords} open bills")
