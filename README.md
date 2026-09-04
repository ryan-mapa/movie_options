# Movie Time

[LIVE SITE](https://ryan-mapa.github.io/movie_options/)

[![Refresh box office data](https://github.com/ryan-mapa/movie_options/actions/workflows/refresh-data.yml/badge.svg)](https://github.com/ryan-mapa/movie_options/actions/workflows/refresh-data.yml)

## Demo
![movie_time_demo](docs/demo.gif)

## Overview
A d3 visualization of the current domestic box office top 10. Each bubble is a film,
filled with its poster and sized by box office takings. Toggle between sizing by
**total gross** and by **hotness** (weekend gross) to see which films are actually
drawing crowds right now versus which have simply been out longest.

- Click a bubble to open its IMDb page
- Hover for gross, weekend and hotness rank
- Drag bubbles around the force layout

## How the data works
`data/boxoffice.json` is committed to the repo and served alongside the page, so the
browser makes a same-origin request with no API key and no CORS proxy:

```javascript
fetch('data/boxoffice.json', { cache: 'no-cache' })
```

A [GitHub Actions workflow](.github/workflows/refresh-data.yml) runs `scripts/refresh-data.mjs`
daily, which scrapes the [Box Office Mojo weekend chart](https://www.boxofficemojo.com/weekend/chart/)
plus each film's release page (for the poster and IMDb id) and commits the result when it
changes. Box office figures only move once a week, so a daily refresh keeps the chart current.
The job commits only when the numbers actually differ, so unchanged weekdays add no history.

Because the data is a committed file rather than a live client-side request, a scraping
failure leaves the last good data in place instead of blanking the chart.

Refresh it by hand with:

```bash
npm run refresh
```

## Running locally
```bash
npm install
npm run build     # bundle movie_time.js -> bundle.js
npm start         # refresh data, build, and serve on :8080
```

`bundle.js` is committed because GitHub Pages serves this repo directly from `master`.
Rebuild and commit it whenever `movie_time.js` changes.

## Technologies used
- JavaScript
- D3.js (v4)
- Webpack 5 + Babel 7
- GitHub Actions
- HTML/CSS

## Data source

Box Office Mojo is used rather than IMDb because it still serves plain HTTP clients,
including GitHub's runners; `imdb.com/chart/boxoffice` answers automated requests with an
empty `202`. Columns are resolved by header text rather than position, so a column reorder
fails loudly instead of silently swapping gross and weekend figures.

There is no free, keyless API for weekend box office numbers, which is why this scrapes
rather than calling an API. TMDB has neither weekend nor reliable gross figures for films
still in theaters.

## What changed from the 2018 version
The original version scraped IMDb in the browser through `cors-anywhere.herokuapp.com`.
That broke on every link in the chain: the public proxy now requires opt-in, IMDb blocks
non-browser traffic and serves a React-rendered page its regexes no longer matched, and the
`http://` request became mixed content once Pages enforced HTTPS. Moving the scrape into a
scheduled job removed the proxy, the CORS constraint and the runtime fragility at once.

Circle sizing also moved to `d3.scaleSqrt`, so area (not radius) is proportional to takings.
The original linear formula gave a $890M film a 347px radius, which no longer fits on screen.

## Future additions
- Expand beyond top 10 hits
- Rotten Tomatoes / critic rating visualization options
- Difference between critic and audience rating
- Snapshots of past data via https://archive.org/web/
