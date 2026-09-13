#!/usr/bin/env node
// Rebuilds data/boxoffice.json.
//
// Figures come from The Numbers, which still server-renders its weekend chart.
// Box Office Mojo's /weekend/ route moved to client-side rendering in Sept 2026
// and now returns a shell page with no table, so it can no longer be scraped;
// its /release/ pages still render server-side and remain the source for
// posters and IMDb ids.

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const COUNT = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'boxoffice.json');

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const strip = s => s.replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&nbsp;| /g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ').trim();

const rowsOf = html => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const cellsOf = row => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => strip(m[1]));

const millions = s => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round((n / 1e6) * 100) / 100 : null;
};

// Titles are compared across two sites, so ignore punctuation and case.
const key = t => t.toLowerCase().replace(/[^a-z0-9]+/g, '');

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

// The Numbers keys each weekend chart on that weekend's Friday.
function mostRecentFriday(from = new Date()) {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - 5 + 7) % 7));
  return d;
}

function parseWeekendChart(html) {
  const rows = rowsOf(html);
  const header = rows.map(cellsOf).find(c => c.some(x => x.toLowerCase() === 'rank'));
  if (!header) return [];

  // Resolve by header text so a column reorder fails loudly instead of
  // silently swapping the weekend and lifetime figures.
  const col = name => {
    const i = header.findIndex(h => h.toLowerCase() === name);
    if (i === -1) throw new Error(`Column "${name}" missing. Headers: ${header.join(' | ')}`);
    return i;
  };
  const iTitle = col('title'), iWeekend = col('gross'), iTotal = col('total gross');

  const out = [];
  for (const row of rows) {
    const c = cellsOf(row);
    if (c.length !== header.length || !/^\d+$/.test(c[0])) continue;
    const weekend = millions(c[iWeekend]);
    const sales = millions(c[iTotal]);
    if (!c[iTitle] || weekend === null || sales === null) continue;
    out.push({ rank: String(out.length + 1), titles: c[iTitle], sales, weekend });
    if (out.length >= COUNT) break;
  }
  return out;
}

// Box Office Mojo's daily page lists the same films with /release/ links.
async function mojoReleaseLinks(friday) {
  const map = new Map();
  try {
    const html = await get(`https://www.boxofficemojo.com/date/${iso(friday)}/`);
    for (const row of rowsOf(html)) {
      const link = (row.match(/href="(\/release\/[^"?]+)/) || [])[1];
      const c = cellsOf(row);
      if (link && c[2]) map.set(key(c[2]), `https://www.boxofficemojo.com${link}`);
    }
  } catch (err) {
    console.warn(`  ! could not load Box Office Mojo daily chart: ${err.message}`);
  }
  return map;
}

function posterFrom(page) {
  // Preferred: the resizable form, trimmed at the "@._" marker so a consistent
  // size can be requested.
  const sized = (page.match(/https:\/\/m\.media-amazon\.com\/images\/M\/[^"']*?@+\._/) || [])[0];
  if (sized) return `${sized.replace(/@+\._$/, '@._')}V1_SY500_CR0,0,337,500_AL_.jpg`;

  // Re-releases and older entries sometimes carry only a plain image URL.
  const plain = (page.match(/https:\/\/m\.media-amazon\.com\/images\/M\/[^"']+?\.(?:jpg|jpeg|png)/i) || [])[0];
  if (plain) return plain;

  const og = (page.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
    || page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i) || [])[1];
  return og && /^https?:/.test(og) ? og : '';
}

// Mojo lists genres newline-separated inside a single span.
function genreFrom(page) {
  const block = (page.match(/<span[^>]*>\s*Genres?\s*<\/span>([\s\S]{0,400}?)<\/div>/i) || [])[1];
  if (!block) return '';
  // Split before strip(), which collapses the newlines that separate them.
  return block
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map(g => strip(g))
    .filter(Boolean)
    .join(', ');
}

async function artworkFor(relUrl) {
  const page = await get(relUrl);
  const tt = (page.match(/\/title\/(tt\d+)/) || [])[1];
  return {
    links: tt ? `https://www.imdb.com/title/${tt}/` : null,
    imageUrls: posterFrom(page),
    genre: genreFrom(page),
  };
}

async function main() {
  let friday = mostRecentFriday();
  let movies = [];

  // Step back a week at a time if a chart is not published yet.
  for (let attempt = 0; attempt < 3 && movies.length < COUNT; attempt++) {
    const d = new Date(friday);
    d.setUTCDate(d.getUTCDate() - attempt * 7);
    const url = `https://www.the-numbers.com/box-office-chart/weekend/` +
      `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
    try {
      const parsed = parseWeekendChart(await get(url));
      if (parsed.length >= COUNT) { movies = parsed; friday = d; break; }
      console.warn(`  ! ${iso(d)}: only ${parsed.length} rows, trying the previous weekend`);
    } catch (err) {
      console.warn(`  ! ${iso(d)}: ${err.message}`);
    }
  }
  if (movies.length < COUNT) throw new Error(`Could not parse a weekend chart with ${COUNT} films.`);

  const sunday = new Date(friday);
  sunday.setUTCDate(sunday.getUTCDate() + 2);
  const weekendLabel = friday.getUTCMonth() === sunday.getUTCMonth()
    ? `Weekend of ${MONTHS[friday.getUTCMonth()]} ${friday.getUTCDate()}-${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`
    : `Weekend of ${MONTHS[friday.getUTCMonth()]} ${friday.getUTCDate()} - ` +
      `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}, ${sunday.getUTCFullYear()}`;

  const links = await mojoReleaseLinks(friday);
  for (const m of movies) {
    const rel = links.get(key(m.titles));
    m.links = `https://www.imdb.com/find/?q=${encodeURIComponent(m.titles)}`;
    m.imageUrls = '';
    m.genre = '';
    if (rel) {
      try {
        const art = await artworkFor(rel);
        if (art.links) m.links = art.links;
        m.imageUrls = art.imageUrls;
        m.genre = art.genre;
      } catch (err) {
        console.warn(`  ! ${m.titles}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 250)); // be polite
    }
    console.log(`  ${m.rank}. ${m.titles} - weekend $${m.weekend}M / total $${m.sales}M` +
      `${m.imageUrls ? '' : '  [no poster]'}`);
  }

  const withArt = movies.filter(m => m.imageUrls).length;
  if (!withArt) throw new Error('No posters resolved - the artwork source has changed.');
  console.log(`\n  posters: ${withArt}/${movies.length}`);

  // Only rewrite when the figures move, so the daily job does not commit a
  // fresh timestamp every run.
  let previous = null;
  try { previous = JSON.parse(await readFile(outFile, 'utf8')); } catch { /* first run */ }
  const same = previous
    && previous.weekend === weekendLabel
    && JSON.stringify(previous.movies) === JSON.stringify(movies);
  if (same) {
    console.log(`\nNo change since ${previous.updated} - leaving data/boxoffice.json alone.`);
    return;
  }

  await writeFile(outFile, JSON.stringify({
    weekend: weekendLabel,
    updated: new Date().toISOString(),
    sources: {
      figures: 'https://www.the-numbers.com/box-office-chart/weekend/',
      artwork: 'https://www.boxofficemojo.com/',
    },
    movies,
  }, null, 2) + '\n');
  console.log(`\nWrote ${movies.length} movies for "${weekendLabel}" to data/boxoffice.json`);
}

main().catch(err => { console.error(`refresh-data failed: ${err.message}`); process.exit(1); });
