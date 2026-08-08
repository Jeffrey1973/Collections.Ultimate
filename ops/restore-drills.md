# Restore drill log

A backup that has never been restored is not a backup. Every drill gets logged here
with its real elapsed time — that number, not the backup schedule, is your actual RTO.

---

## 2026-08-08 — First drill. PASSED.

**Backup under test:** `full_20260808T203753Z.bak` (34.9 MB), taken from production
`cu-sqlserver` and transported to a Windows workstation. Uploads archive
`uploads_20260808T203801Z.tar.gz` (57.1 MB, 396 files) taken at the same time.

**Target:** `mcr.microsoft.com/mssql/server:2022-latest` → SQL Server 2022 (RTM-CU26)
16.0.4265, in Docker on the dev workstation. Deliberately a *different machine* from
production — transporting the file is part of what is being tested.

### Result: VERIFIED

| Step | Time |
|---|---|
| Pull SQL Server 2022 image (one-time; cached after) | 115 s |
| Container start → accepting connections | ~30 s |
| Copy `.bak` into container | 4 s |
| `RESTORE DATABASE` (4,458 pages) | 2 s (0.361 s engine time) |
| `DBCC CHECKDB WITH NO_INFOMSGS, DATA_PURITY` | 2 s — **clean, no output** |
| `verify.sql` on restored copy vs production | **byte-identical** |

**Realistic RTO: ~5 minutes cold** (dominated by the image pull), **~1 minute** with the
image already cached. The data itself restores in under a second at current scale.

### What the drill caught

1. **`WITH COMPRESSION` fails on Express** — *Msg 1844*. The backup script had it and
   would have failed on its first scheduled run. Fixed in `cu-backup.sh`.
2. **SQL Server 2025 LocalDB cannot restore a 2022 backup.** Pages restore, then the
   upgrade step aborts with *Msg 1855 — System table sysfiles1 is corrupted*, leaving
   `RECOVERY_PENDING`. The backup was fine — `VERIFYONLY ... WITH CHECKSUM` passed both
   before and after transport. **Restore target must be SQL Server 2022**, and "newer
   is fine" is wrong. This is the single most valuable thing the drill found: it would
   otherwise have been discovered mid-incident, on the machine you'd naturally reach for.
3. **Backups are not encrypted** (Express cannot encrypt them; `TDEThumbprint` is NULL).
   Restoring needs no production password — so the `.env` is required to redeploy the
   *stack*, not to recover the *data*. Corollary: treat the `.bak` as sensitive.

### Checked and cleared (not problems)

- **Collation.** All **77** `dbo` string columns use a single collation,
  `SQL_Latin1_General_CP1_CI_AS` (the standard default). An initial scan appeared to show
  four collations including `SQL_Latin1_General_CP437_CS_AS`, but every non-default column
  belongs to SQL Server's own internal catalog tables (`sysrts`, `sysxmitqueue`,
  `sysftproperties`, …), which are identical in every SQL Server database. **No collation
  hazard for the Azure SQL move.**
- **Integrity.** `DBCC CHECKDB` with `DATA_PURITY` reported nothing.

### Not yet covered — next drill must add these

- [ ] **Boot the API against the restored database.** Data fidelity is proven; the
      application working against it is not.
- [ ] **Restore the uploads archive** and re-run the DB↔blob referential check. The
      volume holds 396 files against 334 `CustomCoverUrl` references, so ~62 are
      orphans — confirm that gap is orphans and not missing covers.
- [ ] **Point-in-time restore.** Needs `RECOVERY FULL` plus the log-backup chain, which
      is not yet installed. Only a full-backup restore has been proven.
- [ ] **Restore from the offsite copy** (restic/B2), not a hand-carried file. The
      offsite leg is currently unproven — this drill used a manual `scp`.

### Reproduce

```bash
docker run -d --name cu-drill -e ACCEPT_EULA=Y \
  -e 'MSSQL_SA_PASSWORD=<scratch>' -e MSSQL_PID=Express -p 14330:1433 \
  mcr.microsoft.com/mssql/server:2022-latest

docker cp <backup>.bak cu-drill:/var/opt/mssql/restore/full.bak

docker exec cu-drill /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '<scratch>' -C -b -Q "
RESTORE DATABASE CollectionsUltimate FROM DISK=N'/var/opt/mssql/restore/full.bak'
WITH MOVE N'CollectionsUltimate'     TO N'/var/opt/mssql/data/CU_restore.mdf',
     MOVE N'CollectionsUltimate_log' TO N'/var/opt/mssql/data/CU_restore_log.ldf',
     RECOVERY, CHECKSUM, STATS=50;"
```

Then run `ops/verify.sql` against both production and the restore, and `diff` the output.

> On Git Bash, prefix docker commands with `MSYS_NO_PATHCONV=1`, or `/opt/...` is
> rewritten to `C:/Program Files/Git/opt/...` and `docker exec` fails confusingly.
