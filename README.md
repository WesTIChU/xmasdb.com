# XmasDB.com

XmasDB.com is a fan-curated database of Hallmark Christmas movies. It
provides searchable movie and cast information, year browsing, ratings,
canonical movie and actor pages, and Radarr-compatible JSON feeds.

## Features

- Browse, search, sort, and filter the movie catalog.
- Explore movie details, ratings, synopsis, cast, and character links.
- Browse actor filmographies and popular actors.
- Browse the catalog by release year.
- Generate Radarr-compatible movie feeds and actor-specific JSON feeds.
- Generate SEO-friendly movie, actor, year, sitemap, and robots pages.
- Use the local management tools to maintain movies and upcoming titles.

## Requirements

- Node.js 18 or newer
- npm

## Local Development

```sh
npm install
npm run dev
```

Open `http://localhost:3000` in a browser. The Vite development server
provides the site and local management API.

## Production Build

```sh
npm run build
npm run preview
```

The build first regenerates SEO pages and data feeds, then creates the
production site in `dist/`. Deploy the contents of `dist/` to a static host.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start local development server on port 3000 |
| `npm run build` | Generate SEO output and build `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run TypeScript checks |
| `npm test` | Run the automated data-pipeline tests |
| `npm run catalog:refresh` | Refresh the private TMDB catalog data |
| `npm run cast:inspect` | Inspect cast data without rebuilding it |
| `npm run cast:rebuild` | Rebuild cast data from TMDB |
| `npm run cast:refresh` | Refresh cached cast data |
| `npm run assets:migrate` | Migrate local image assets |

## Catalog Refresh

Catalog refreshes require a TMDB API key. Keep credentials in a local `.env`
file, which is ignored by Git.

```sh
TMDB_API_KEY="your-key" npm run catalog:refresh
```

The refresh updates stored movie metadata, ratings, vote counts, cast data,
and related public JSON files. See [MONTHLY_REFRESH.md](MONTHLY_REFRESH.md)
for the scheduled monthly workflow.

## Generated Files

`npm run build` generates or updates:

- `dist/` production assets and pages
- Movie pages under `dist/movie/`
- Actor pages under `dist/actor/`
- Year pages under `dist/year/`
- `sitemap.xml` and `robots.txt`
- Radarr and actor JSON feeds

Generated build output is not committed; it is recreated during deployment.

## Project Structure

- `index.html`, `app.js`: movie catalog and homepage
- `movie.html`, `movie.js`, `movie.css`: dynamic movie detail page
- `actor.html`, `actor.js`, `actor.css`: dynamic actor page
- `radarr.html`, `radarr.js`: Radarr and JSON feed tools
- `js/site-layout.js`: shared header, footer, disclaimer modal, and top button
- `scripts/generate-seo.js`: static SEO page and sitemap generation
- `scripts/enrich-cast.js`: cast and actor data pipeline
- `movie-storage.js`: local catalog and feed storage
- `public/`: public data, assets, and generated static source files

## Testing Before Deployment

```sh
npm run lint
npm test
npm run build
```

The project is an independent fan-made site and is not affiliated with or
endorsed by Hallmark or TMDB.
