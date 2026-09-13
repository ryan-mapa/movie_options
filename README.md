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

The canvas sizes itself to the viewport and re-lays out on resize, targeting roughly 30%
of the available area in bubbles. A film whose poster cannot be resolved is drawn as a
labelled solid disc rather than an invisible circle.

## How the data works
`data/boxoffice.json` is committed to the repo and served alongside the page, so the
browser makes a same-origin request with no API key and no CORS proxy:

```javascript
fetch('data/boxoffice.json', { cache: 'no-cache' })
```

A [GitHub Actions workflow](.github/workflows/refresh-data.yml) runs `scripts/refresh-data.mjs`
daily. It reads the weekend chart from [The Numbers](https://www.the-numbers.com/box-office-chart/weekend/)
for rank, title, weekend gross and lifetime gross, then fetches each film's Box Office Mojo
release page for the poster and IMDb id, and commits the result when the figures change.
Box office figures only move once a week, so a daily refresh keeps the chart current.
The job commits only when the numbers actually differ, so unchanged weekdays add no history.

Because the data is a committed file rather than a live client-side request, a scraping
failure leaves the last good data in place instead of blanking the chart. To stop that
degrading silently, the page prints the date it was last updated and warns on the page
once the data is more than ten days old.

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

The figures come from The Numbers because Box Office Mojo moved its `/weekend/` chart to
client-side rendering in September 2026 — the URL still returns 200, but the HTML is a shell
with no table, so scraping it silently yielded nothing. Mojo's `/release/` pages still render
server-side, so they remain the source for posters and IMDb ids; the two sources are matched
on a punctuation- and case-insensitive title key.

IMDb itself is not used: `imdb.com/chart/boxoffice` answers automated requests with an empty
`202`. Columns are resolved by header text rather than position, so a column reorder fails
loudly instead of silently swapping gross and weekend figures.

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
