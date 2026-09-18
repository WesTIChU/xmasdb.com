# Twice-Monthly Private Catalog Refresh

The public website remains local-only. Run the following private command from
the project directory. It refreshes Collection and approved Coming Soon movies
through the same TMDB pipeline:

```sh
TMDB_API_KEY="your-key" npm run catalog:refresh
```

To schedule it with cron at 03:00 on the 1st and 15th of each month, edit the
user crontab with `crontab -e` and add:

```cron
0 3 1,15 * * cd /home/polza/Desktop/fgfgfg && npm run catalog:refresh >> /home/polza/Desktop/fgfgfg/catalog-refresh.log 2>&1
```

Prefer storing the key in `.env` instead of putting it directly in the
crontab. The command reads `TMDB_API_KEY`, `TMDB_TOKEN`, `TMDB_KEY`, or
`TMDB_BEARER_TOKEN`, creates non-overwriting source backups before writing,
refreshes Collection and approved Coming Soon metadata, preserves valid local
data when TMDB is incomplete, regenerates derived data once, and continues
processing if an individual movie fails.

For a bounded sample or dry run, pass explicit IDs:

```sh
TMDB_API_KEY="your-key" npm run catalog:refresh -- --ids=638806,549313,1729134 --dry-run
```

The command exits nonzero if any requested movie fails. It does not run
automatically inside the web application.
