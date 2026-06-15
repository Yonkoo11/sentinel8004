#!/usr/bin/env python3
"""Merge an incremental rescan into the master scan-results.json without losing
prior coverage. Dedups by agentId (newer scan wins on overlap). One-off helper
for the 2026-06-15 rescan (3766 -> 9398 agents). Backs up the master first.
"""
import json, shutil, time

MASTER = "data/scan-results.json"
NEW = "data/scan-new.json"
BACKUP = "data/scan-results-pre-rescan-2026-06-15.json"

master = json.load(open(MASTER))
new = json.load(open(NEW))

shutil.copy(MASTER, BACKUP)

by_id = {r["agentId"]: r for r in master.get("reports", [])}
added = 0
for r in new.get("reports", []):
    if r["agentId"] not in by_id:
        added += 1
    by_id[r["agentId"]] = r

reports = sorted(by_id.values(), key=lambda r: r["agentId"])
out = {
    "totalAgents": max(master.get("totalAgents", 0), new.get("totalAgents", 0), len(reports)),
    "scannedAt": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
    "scanMode": "full-v2 (merged: March 1-3766 + 2026-06-15 rescan 3767-%d)" % new.get("totalAgents", 0),
    "reports": reports,
    "ownerStats": new.get("ownerStats") or master.get("ownerStats"),
}
json.dump(out, open(MASTER, "w"), indent=2)
print(f"merged: {len(master.get('reports',[]))} existing + {added} new = {len(reports)} total")
print(f"totalAgents={out['totalAgents']}  backup={BACKUP}")
