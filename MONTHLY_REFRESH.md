# Monthly Private Catalog Refresh

The public website remains local-only. Run the following private command once
per month from the project directory:

```sh
TMDB_API_KEY="your-key" npm run catalog:refresh
```

To schedule it with cron at 03:00 on the first day of every month, edit the
user crontab with `crontab -e` and add:

```cron
0 3 1 * * cd /home/polza/Desktop/fgfgfg && npm run catalog:refresh >> /home/polza/Desktop/fgfgfg/catalog-refresh.log 2>&1
```

Prefer storing the key in `.env` instead of putting it directly in the
crontab. The command reads `TMDB_API_KEY`, `TMDB_TOKEN`, `TMDB_KEY`, or
`TMDB_BEARER_TOKEN`, refreshes the stored TMDB review score and vote count, and
continues processing if an individual movie or person refresh fails.
