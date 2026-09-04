#!/usr/bin/env node
// Rebuilds data/boxoffice.json from the Box Office Mojo weekend chart.
// Run locally with `npm run refresh`; CI runs it on a schedule.

import { writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';
const CHART = 'https://www.boxofficemojo.com/weekend/chart/';
const COUNT = 10;

const outFile = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'boxoffice.json');

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

const strip = s => s.replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'")
  .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

const rowsOf = html => [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
const cellsOf = row => [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(m => strip(m[1]));

// Dollars -> millions, matching the units the chart's sizing expects.
const millions = s => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round((n / 1e6) * 100) / 100 : null;
};

async function main() {
  const chartHtml = await get(CHART);

  const weekendLabel = strip((chartHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || 'Latest weekend');

  const rows = rowsOf(chartHtml);
  if (!rows.length) throw new Error('No table rows found - Box Office Mojo markup changed.');

  // Resolve columns by header text so a column reorder can't silently swap gross/weekend.
  const header = cellsOf(rows[0]);
  const col = name => {
    const i = header.findIndex(h => h.toLowerCase() === name);
    if (i === -1) throw new Error(`Column "${name}" missing. Headers: ${header.join(' | ')}`);
    return i;
  };
  const iRank = col('rank'), iTitle = col('release');
  const iWeekend = col('gross'), iTotal = col('total gross');

  const picks = [];
  for (const row of rows.slice(1)) {
    if (picks.length >= COUNT) break;
    const c = cellsOf(row);
    if (c.length < header.length) continue;
    const relLink = (row.match(/href="(\/release\/[^"?]+)/) || [])[1];
    if (!relLink || !c[iTitle]) continue;
    const sales = millions(c[iTotal]), weekend = millions(c[iWeekend]);
    if (sales === null || weekend === null) continue;
    picks.push({
      rank: String(picks.length + 1),
      titles: c[iTitle],
      sales,
      weekend,
      _rel: `https://www.boxofficemojo.com${relLink}`,
    });
  }
  if (picks.length < COUNT) throw new Error(`Only parsed ${picks.length}/${COUNT} rows.`);

  // Each release page carries the poster and the IMDb title id.
  const movies = [];
  for (const m of picks) {
    let links = 'https://www.imdb.com/', imageUrls = '';
    try {
      const page = await get(m._rel);
      const tt = (page.match(/\/title\/(tt\d+)/) || [])[1];
      if (tt) links = `https://www.imdb.com/title/${tt}/`;
      // Trim at the "@._" marker and request a consistent poster size.
      const img = (page.match(/https:\/\/m\.media-amazon\.com\/images\/M\/[^"]*?@\._/) || [])[0];
      if (img) imageUrls = `${img}V1_SY500_CR0,0,337,500_AL_.jpg`;
    } catch (err) {
      console.warn(`  ! ${m.titles}: ${err.message}`);
    }
    const { _rel, ...rest } = m;
    movies.push({ ...rest, links, imageUrls });
    console.log(`  ${m.rank}. ${m.titles} - weekend $${m.weekend}M / total $${m.sales}M`);
    await new Promise(r => setTimeout(r, 250)); // be polite
  }

  const payload = { weekend: weekendLabel, updated: new Date().toISOString(), source: CHART, movies };
  await writeFile(outFile, JSON.stringify(payload, null, 2) + '\n');
  console.log(`\nWrote ${movies.length} movies for "${weekendLabel}" to data/boxoffice.json`);
}

main().catch(err => { console.error(`refresh-data failed: ${err.message}`); process.exit(1); });
