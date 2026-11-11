"""Nightly AR aging export: NetSuite -> finance warehouse.

Run by cron at 02:15 (see deploy/crontab).
"""
import datetime as dt
import logging
from pathlib import Path

import psycopg
import yaml

from nsclient import run_suiteql

AR_QUERY = """
SELECT t.id, t.tranid, t.entity, BUILTIN.DF(t.entity) AS customer,
       t.trandate, t.duedate, t.foreigntotal, t.foreignamountremaining
FROM transaction t
WHERE t.type = 'CustInvc' AND t.foreignamountremaining > 0
"""


def main():
    logging.basicConfig(level=logging.INFO)
    settings = yaml.safe_load((Path(__file__).resolve().parent.parent / "settings.yaml").read_text())
    rows = list(run_suiteql(AR_QUERY))
    snapshot = dt.date.today()
    with psycopg.connect(settings["warehouse"]["dsn"]) as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM ar_open WHERE snapshot = %s", (snapshot,))
        cur.executemany(
            "INSERT INTO ar_open (snapshot, ns_id, tranid, customer, trandate, duedate, total, remaining)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            [
                (snapshot, r["id"], r["tranid"], r["customer"], r["trandate"], r["duedate"],
                 r["foreigntotal"], r["foreignamountremaining"])
                for r in rows
            ],
        )
    logging.info("loaded %d open invoices", len(rows))


if __name__ == "__main__":
    main()
