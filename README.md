# Charhdikala ePaper

A newspaper archive for the Charhdikala Group: the newsroom uploads the day's
PDFs, readers get a paper they can zoom, clip, share, search and download, and
nothing is ever deleted to stay under a storage cap.

Built to replace a hosted Epaper CMS that charges per year and caps storage at
5 to 6 GB, which is why only about 79 days of their archive still exists.

## Running it locally

```bash
pnpm install
cp .env.example .env.local     # fill in AUTH_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
pnpm seed                      # creates the nine publications
pnpm dev
```

Then sign in at `/admin/login/` and drop a PDF.

For production see [DEPLOY.md](DEPLOY.md).

## How it fits together

```
PDF upload ──▶ render (pdfjs + canvas + sharp) ──▶ 3 WebP sizes per page ──▶ object storage
                                                                              │
                                        issue + page rows ◀────────────────────┘
                                                │
                            background indexer ──┴──▶ OCR ──▶ FTS5 (trigram)
```

An edition is **readable as soon as it is rendered**. Text indexing runs behind
that, so search catches up a few minutes later.

### Three renders per page

A newspaper page is looked at three ways, so there are three files: a 320px
thumbnail for the strip, a 1200px render for reading, and a 2400px one that is
only fetched once someone zooms past 1.4x. Serving the zoom render for all
three is what makes most epaper sites painful on mobile data.

### Why search needs OCR

Their PDFs carry a text layer written in legacy ASCII-mapped fonts: Satluj and
Nanak for Gurmukhi, Chanakya for Devanagari. The page looks like Punjabi but
the stored text is meaningless — `ਚੜ੍ਹਦੀਕਲਾ` extracts as `⁄Û∑Á∆’Ò≈`, and across
four real editions the text layer is 0% Gurmukhi.

OCR was chosen over reverse-engineering those font tables because it does not
care which font was used, survives the newsroom changing one, and handles a
scanned page too.

Run `scripts/check-pdf-text.mts` against any PDF to see which case it is.

### Why trigram, not the usual tokenizer

SQLite's `unicode61` treats Gurmukhi matras as word separators, so `ਪਟਿਆਲਾ`
indexes as `ਪਟ` / `ਆ` / `ਆਲ` and Punjabi search returns fragments and false
positives. `trigram` keeps matras and subjoined characters intact and matches
mid-word.

Text and queries are both folded the same way, dropping the vertically stacked
marks. Those are the characters a thin ToUnicode map loses *and* the ones OCR
most often misreads, since they are a few pixels tall on newsprint, so folding
makes a search tolerant of both failures at once.

## Layout

| Path | What it is |
|---|---|
| `src/app/[publication]/[date]/` | The reader |
| `src/app/[publication]/archive/` | Calendar of past editions |
| `src/app/search/` | Full-text search |
| `src/app/admin/` | Newsroom upload and index status |
| `src/lib/ingest/` | Render, OCR, the background indexer |
| `src/lib/storage/` | Local disk and S3, behind one interface |
| `src/lib/gurmukhi.ts` | Text repair and folding |
| `src/lib/filename.ts` | Reads publication and date off a filename |

## Commands

```bash
pnpm check                                   # typecheck + lint
pnpm seed                                    # create or correct publications
npx tsx scripts/check-pdf-text.mts FILE.pdf  # will this PDF's text extract?
npx tsx scripts/migrate-vedanta.mts --dry-run
scripts/backup.sh /srv/backups
```

## Things worth knowing

- **Storage** grows about 22 MB per edition, measured on real files. At nine
  papers a day that is roughly 64 GB a year.
- **Indexing is in-process**, so this needs a container or a VPS. It cannot run
  on a serverless host.
- **Uploads bypass `proxy.ts`** and check the session themselves. Next buffers
  the whole body in memory for any route behind the proxy, capped at 10 MB,
  and their largest paper is a 20 MB PDF.
- **Re-uploading the same publication and date replaces that edition**, which
  is the normal way to correct a bad file.
