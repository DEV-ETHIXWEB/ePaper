# Running the ePaper in production

## What it needs

A small Linux box, 2 CPU and 2 GB of memory, with Docker. Rendering and OCR
are the heavy parts and both are CPU bound; everything else is light.

Storage grows by roughly **22 MB per edition**, measured on real Charhdikala
files rather than estimated. At eight or nine papers a day that is about
**180 MB a day, 64 GB a year**.

## First run

```bash
cp .env.example .env.production   # then fill it in, see below
docker compose up -d --build
docker compose exec epaper node -e "require('./node_modules/tsx/dist/cli.mjs')" # optional
```

Seed the publication list once:

```bash
docker compose exec epaper node scripts/seed.js
```

Check it came up:

```bash
curl -s localhost:3000/api/health | jq
```

That endpoint touches the database and writes a probe object, so it fails if
the data volume is missing. A process that is up but serving an empty archive
is worse than one that is down, which is why it is not a bare 200.

## Environment

| Variable | Needed | Notes |
|---|---|---|
| `AUTH_SECRET` | yes | 32+ chars. `openssl rand -hex 32` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | yes | Newsroom sign-in |
| `NEXT_PUBLIC_SITE_URL` | yes | Public URL, used for share links and OpenGraph |
| `DATABASE_PATH` | no | Defaults to `/app/data/epaper.db` |
| `STORAGE_DRIVER` | no | `local` (default) or `s3` |
| `S3_*` | if s3 | Endpoint, region, bucket, key id, secret |
| `STORAGE_PUBLIC_URL` | if s3 | CDN or bucket URL pages are served from |

## Storage: local disk or S3

Local disk is the default and is fine to start with: the pages sit on the data
volume and are backed up with everything else.

Move to S3-compatible storage when the volume gets inconvenient to back up.
Backblaze B2 is the cheapest of the ones that matter; at year five, around
320 GB, it is roughly ₹1,900 a year. Set `STORAGE_DRIVER=s3` and the `S3_*`
variables; nothing else changes, because the storage layer is an interface
with two implementations.

## Backups

```bash
scripts/backup.sh /srv/backups
```

Run it nightly from cron. It snapshots the database with SQLite's online
backup API rather than copying the file, because copying a live database with
WAL active can capture a torn one. It then rsyncs the stored pages, hard
linking against the previous backup so an append-only archive costs little to
keep many copies of. Finally it opens the copy and counts rows, so a backup
that silently produced nothing fails loudly.

Restore is a file copy back and a restart.

## How indexing behaves

An uploaded edition is readable immediately and searchable a few minutes
later. OCR runs behind publishing, one edition at a time.

This matters because their PDFs carry a text layer in legacy ASCII-mapped
fonts — Satluj and Nanak for Gurmukhi, Chanakya for Devanagari — which
extracts as 0% Gurmukhi. OCR is what makes the archive searchable at all. See
`scripts/check-pdf-text.mts` to check any PDF.

The admin page shows the queue and can requeue failures or reindex everything,
which is what to use after changing anything in the extraction pipeline.

Because indexing is in-process, **this cannot run on a serverless host**. A
container or a VPS is required. That is also why the Dockerfile caps CPU: a
morning's OCR would otherwise starve the web server.

## Importing the old archive

```bash
docker compose exec epaper npx tsx scripts/migrate-vedanta.mts --dry-run
docker compose exec epaper npx tsx scripts/migrate-vedanta.mts
```

It walks the old Vedanta site's sequential edition ids and imports what is
still there, skipping anything already present, so an interrupted run is
resumed by running it again.

Only about 79 days survive on that site — the oldest is 23 July 2026 — because
their 5 to 6 GB cap deletes older editions. Nothing before that can be
recovered from this source.
