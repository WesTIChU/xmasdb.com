# XmasDB

XmasDB.com is a curated Christmas movie database and archive covering Hallmark, Lifetime, Great American Family (GAF), UPtv, and other holiday networks.

The site provides:

- Movie pages with cast, release information, trailers, artwork, and metadata.
- Actor pages showing Christmas movie filmographies.
- Search and browsing by brand, year, and catalogue.
- A Coming Soon section for upcoming releases.
- Radarr / StevenLu-compatible JSON feeds for the full catalogue, brands, and years.
- Locally cached movie posters, backdrops, and actor artwork where available.
- Movie and people metadata integrated with TMDB.

## Local Development

### Requirements

- Node.js
- npm

### Setup

```bash
npm install
cp .env.example .env
```

Set the values in `.env` as needed:

- `APP_URL` — the public site URL.
- `TMDB_API_KEY` — required by the TMDB refresh and catalogue scripts.

Start the local server with:

```bash
npm run dev
```

The site is served at `http://localhost:3000`.

## Checks and Production Build

```bash
npm run lint
npm test
npm run build
npm start
```

`npm run build` creates the Vite client build and bundled Express server in `dist/`. `npm start` serves that production build.

## Catalogue and Data Scripts

The repository includes scripts for refreshing TMDB and actor data, importing or discovering GAF and Lifetime catalogue entries, auditing local artwork, and reconciling catalogue changes. See the corresponding npm scripts in `package.json` before running a data operation.

## Feeds

The web app exposes public JSON feeds under `/json/`, including the full catalogue, brand feeds such as `/json/hallmark.json` and `/json/uptv.json`, and year feeds such as `/json/year/2025.json`. These feeds are compatible with Radarr's StevenLu Custom list provider.

Movie information and artwork may be sourced from third-party services including TMDB. XmasDB's catalogue selection and organisation are maintained as a curated archive.
