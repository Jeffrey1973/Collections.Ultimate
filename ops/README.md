# Operations — backup, restore, and diagnostics

> **Priority order:** get a copy off the box today; prove you can restore it; only
> then change anything else. Every later step in the productization plan assumes
> this is in place.

Three things in this system can be **permanently lost**:

1. The SQL Server database.
2. The `api_uploads` volume — cover photos, the **only** data that cannot be
   re-fetched from any external API.
3. `/opt/collections~/.env` — the single copy of `SA_PASSWORD`. Lose it and every
   `.bak` you managed to copy off is a brick.

Everything else (Meilisearch index, Caddy certs, container images, browser
localStorage) is rebuildable from those three plus source control.

---

## Why the current setup is not a backup

The procedure in `docs/DEPLOY_VPS.md` writes the `.bak` to
`/var/opt/mssql/backup/`, which `docker-compose.prod.yml` mounts **from the same
volume as the live `.mdf` and `.ldf` files**. Backup and primary share one failure
domain, on one disk, on one VPS. The uploads volume has never had a backup
procedure at all — not even prose.

---

## One-time setup

### 1. Give the backups their own failure domain

In `docker-compose.prod.yml`, add a **host bind mount** to the `sqlserver` service:

```yaml
    volumes:
      - sqlserver_data:/var/opt/mssql
      - /opt/cu/backups:/backups          # <-- host dir, NOT the data volume
```

While you are in there, add log rotation to **every** service. Today no service
sets `logging:` options, so Docker's json-file driver grows without bound — and a
full disk on a box running SQL Server risks torn writes:

```yaml
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "5" }
```

Recreating the container does **not** touch the named volume. Confirm the volume
ID is unchanged with `docker volume ls` before and after.

### 2. Put the database in FULL recovery model

Required for log backups and therefore for point-in-time restore.

```bash
docker exec cu-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "$SA_PASSWORD" -C \
  -Q "ALTER DATABASE CollectionsUltimate SET RECOVERY FULL;"
```

### 3. Create `/opt/cu/backup.env` (chmod 600)

```bash
SA_PASSWORD=...
DB_NAME=CollectionsUltimate
SQL_CONTAINER=cu-sqlserver
UPLOADS_VOLUME=...          # docker volume ls -q | grep api_uploads
RESTIC_REPOSITORY=b2:cu-backups:/prod
RESTIC_PASSWORD=...         # ALSO store in your password manager
B2_ACCOUNT_ID=...
B2_ACCOUNT_KEY=...          # APPEND-ONLY key — see below
HC_URL=https://hc-ping.com/...
```

> **The B2 key must be append-only.** A compromised or confused VPS must not be
> able to delete backup history. Run `restic forget --prune` from your workstation
> with a separate, fuller-privilege key.
>
> **`RESTIC_PASSWORD` belongs in your password manager.** An encrypted backup you
> cannot decrypt is not a backup.

### 4. Install the schedule

```bash
install -m 700 ops/cu-backup.sh /opt/cu/bin/cu-backup.sh
```

```cron
*/15 *  * * *   /opt/cu/bin/cu-backup.sh log     >> /var/log/cu-backup.log 2>&1
0     2  * * 1-6 /opt/cu/bin/cu-backup.sh diff   >> /var/log/cu-backup.log 2>&1
0     1  * * 0  /opt/cu/bin/cu-backup.sh full    >> /var/log/cu-backup.log 2>&1
30    3  * * *  /opt/cu/bin/cu-backup.sh uploads >> /var/log/cu-backup.log 2>&1
```

That gives **RPO 15 minutes** for the database, 24 hours for cover photos. Move
uploads hourly if cover uploads are frequent — restic dedupes, so unchanged runs
are nearly free.

---

## The restore drill — do this before trusting any of the above

**A backup that has never been restored is a hypothesis.** Run this on your
Windows workstation, *not* the VPS: transporting the file is part of the test.

```bash
docker run -d --name cu-restore-test -p 14330:1433 \
  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='LocalTest!2026x' -e MSSQL_PID=Developer \
  mcr.microsoft.com/mssql/server:2022-latest
```

> Must be **2022**. A 2022 `.bak` will not restore to 2019.

1. Copy the backup in, then run `RESTORE FILELISTONLY` **first** to get the real
   logical file names — do not guess them.
2. `RESTORE DATABASE ... WITH MOVE ..., NORECOVERY, REPLACE, CHECKSUM`, then each
   diff `WITH NORECOVERY`, then each `log_*.trn` **in timestamp order** `WITH
   NORECOVERY`, then `RESTORE DATABASE ... WITH RECOVERY`.
3. `DBCC CHECKDB('CU_RestoreTest') WITH NO_INFOMSGS;`
4. Run [`verify.sql`](verify.sql) against **both** production and the restore, and
   diff the two outputs. They must be identical.
5. Extract the uploads tarball and confirm every `/uploads/` reference from
   verify.sql section 5 has a matching file.
6. **Boot the real application against the restored database:**

```bash
$env:ConnectionStrings__Collections="Server=localhost,14330;Database=CU_RestoreTest;User Id=sa;Password=LocalTest!2026x;TrustServerCertificate=True;Encrypt=False;"
dotnet run --project api/Api
```

Log in, open the library, open a book, confirm covers render and the event
timeline is populated.

**Record the result and the elapsed time in `ops/restore-drills.md`.** Your RTO is
not a number you assume; it is the number you measured today.

---

## Files

| File | Purpose |
|---|---|
| [`cu-backup.sh`](cu-backup.sh) | Backup driver — `full` \| `diff` \| `log` \| `uploads`. Verifies every backup, cross-checks cover references, pushes offsite, pings a dead-man's switch. |
| [`verify.sql`](verify.sql) | Fidelity assertions. Run against two databases and diff. Used for restore drills **and** the Azure SQL cutover. |
| [`diagnose.sql`](diagnose.sql) | Read-only production profile: real schema, Express headroom, identifier/contributor divergence, malformed JSON blobs, tenancy blast radius. |

---

## Edition constraints (verified against production)

- **No `WITH COMPRESSION`.** Express rejects it: *Msg 1844 — BACKUP DATABASE WITH
  COMPRESSION is not supported on Express Edition*. `cu-backup.sh` omits it; restic
  compresses on the way to the offsite repo anyway.
- **`.bak` files are not encrypted**, and backup encryption is unavailable on
  Express. Two consequences: (1) a `.bak` can be restored to any SQL Server 2022
  instance **without** the original `SA_PASSWORD` — so the `.env` is needed to
  redeploy the stack, not to recover the data; (2) treat the `.bak` itself as
  sensitive, because anyone holding it holds the whole library.
- Restore target must be **SQL Server 2022**, and this is narrower than it sounds:
  - A 2022 `.bak` will not restore to **2019** or earlier (backups never restore
    downward).
  - It also fails **upward** onto **SQL Server 2025 LocalDB (17.0.4025.3)**. Verified
    2026-08-08: pages restore, then the upgrade step aborts with
    *Msg 1855 — System table sysfiles1 is corrupted*, leaving the database in
    `RECOVERY_PENDING`. The backup is fine (`RESTORE VERIFYONLY ... WITH CHECKSUM`
    passes on both the source and the transported copy) — the 2022→2025 upgrade path
    is what fails.
  - **Use `mcr.microsoft.com/mssql/server:2022-latest`.** Do not assume a newer local
    engine will do; it will not.

## Known issues this tooling surfaces

- **Express 10 GB ceiling.** `MSSQL_PID: Express` caps the database at 10 GB, after
  which inserts fail with error 1105 — new user data silently rejected. `diagnose.sql`
  section 1 reports headroom.
- **DB and images drift silently.** They are backed up by two unrelated mechanisms
  and a `.bak` contains zero image bytes. `cu-backup.sh uploads` fails loudly if any
  database cover reference has no corresponding file.
- **Malformed `MetadataJson`.** Migration `0013` built the blob by naive string
  concatenation escaping only `"`, so any title or author containing a backslash
  produced invalid JSON. Those rows' fields are invisible in the UI today, and both
  the frontend parser and the API swallow the parse error. `diagnose.sql` section 6
  counts them.
