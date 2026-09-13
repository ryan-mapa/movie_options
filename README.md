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
release page for the poster, genre and IMDb id, and commits the result when the figures change.
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

## Monitoring and failure modes

The refresh job is instrumented in three layers, and it is worth knowing which
failures are loud and which are not.

**Hard failures** call `process.exit(1)`, so the run fails, the badge above turns red
and GitHub emails on failed scheduled workflows by default. These are:

| Condition | Where |
|---|---|
| Any non-OK HTTP response | `get()` |
| An expected column missing from the chart header | `parseWeekendChart()` |
| Fewer than 10 films parsed across 3 attempted weekends | `main()` |
| Zero posters resolved | `main()` |

The last also covers Box Office Mojo being unreachable: no release links means no
artwork, which trips the zero-poster guard. That is what surfaced Mojo's markup change.

**Soft degradations** log a warning and still exit 0:

- a single film's poster failing to resolve — the guard only checks for *zero* posters,
  so 9 of 10 could fail and the run stays green
- falling back to an older weekend, which serves last week's figures without flagging
  that the current weekend was unavailable

**The blind spot** is that GitHub disables scheduled workflows in a public repository
after 60 days without repository activity. Nothing fails when that happens: no red
badge, no alert, just a green badge on an increasingly old run. GitHub emails before
disabling, but that is a single message that is easy to miss.

The backstop is client-side: the page prints the date it was last updated and warns
once the data is more than ten days old. That depends on somebody loading the page,
and it waits ten days, so it is a safety net rather than monitoring. There is no
external alerting, no metrics and no dead-man's switch.

## Cost

Nothing, because the repository is public: Actions has unlimited free minutes on
standard runners for public repos, and Pages is free for them. Runs take 10-34
seconds, roughly 103 minutes a year — comfortably inside the free tier's 2,000
minutes per month even if the repo were made private. The job commits only when the
figures move, so it adds about one 4 KB commit per weekend rather than 365 a year.

The real costs are other people's bandwidth (12 outbound requests per run, paced 250ms
apart) and the fact that both sources can change or block at any time, as Mojo did.

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
