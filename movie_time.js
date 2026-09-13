import * as d3 from 'd3';

const forceStrength = 0.07;
const POSTERLESS_FILL = '#3f4a5a';

let simulation, circles, svg, hoverText;
let width, height, center;
let grossScale, hotScale;
let radiusFor, showingGross = true;
let movies = [];

const byId = id => document.getElementById(id);
const grossRadius = d => grossScale(d.sales);
const hotRadius = d => hotScale(d.weekend);

// Fit the canvas to whatever space is left under the header rather than a fixed
// 1200x600 box, which left the chart marooned in the middle of a large screen.
function measure() {
  const header = byId('weekend-label').getBoundingClientRect();
  const footer = byId('repo-link');
  const footerH = footer ? footer.getBoundingClientRect().height + 10 : 0;
  width = Math.max(320, window.innerWidth - 32);
  height = Math.max(320, window.innerHeight - header.bottom - 18 - footerH);
  center = { x: width / 2, y: height / 2 };
}

// Scale the bubbles with the canvas so they occupy a similar share of it at any
// size. Area scales with the value, so radius scales with its square root.
function buildScales() {
  // Target roughly 30% of the canvas covered by bubbles, then clamp so a wide
  // or short viewport cannot push the largest circle off the edge.
  const maxR = Math.min(0.16 * Math.sqrt(width * height), height / 4.2, width / 5);
  const range = [maxR * 0.3, maxR];
  const scale = values => d3.scaleSqrt()
    .domain([d3.min(values), d3.max(values)])
    .range(range)
    .clamp(true);
  grossScale = scale(movies.map(m => m.sales));
  hotScale = scale(movies.map(m => m.weekend));
}

function applyLayout({ animate = true } = {}) {
  svg.attr('width', width).attr('height', height);
  simulation
    .force('x', d3.forceX(center.x).strength(forceStrength))
    .force('y', d3.forceY(center.y).strength(forceStrength))
    .force('collide', d3.forceCollide(d => d.rTarget + 1));
  movies.forEach(m => {
    m.rTarget = radiusFor(m);
    if (!animate) m.r = m.rTarget;
  });
  simulation.alpha(0.7).restart();
}

function render({ weekend: weekendLabel, updated, movies: data }) {
  movies = data;

  // Stale data used to be invisible: the chart looked healthy while the refresh
  // job had been failing for days. Show the date, and say so when it is old.
  const label = byId('weekend-label');
  const asOf = updated ? new Date(updated) : null;
  let text = weekendLabel;
  if (asOf && !Number.isNaN(asOf.getTime())) {
    const days = Math.floor((Date.now() - asOf.getTime()) / 86400000);
    text += ` · updated ${asOf.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    if (days > 10) {
      text += ` (${days} days ago — the refresh job may be failing)`;
      label.classList.add('stale');
    }
  }
  label.textContent = text;

  measure();
  buildScales();
  radiusFor = grossRadius;

  hoverText = d3.select('body').append('div').attr('class', 'hover');
  svg = d3.select('body').insert('svg', '#repo-link').attr('id', 'chart');

  svg.append('defs').selectAll('.poster-art')
    .data(movies.filter(m => m.imageUrls))
    .enter().append('pattern')
    .attr('class', 'poster-art')
    .attr('id', d => `poster-${d.rank}`)
    .attr('height', '100%')
    .attr('width', '100%')
    .attr('patternContentUnits', 'objectBoundingBox')
    .append('image')
    .attr('height', 1.5)
    .attr('width', 1)
    .attr('preserveAspectRatio', 'none')
    .attr('xlink:href', d => d.imageUrls);

  movies.forEach((m, i) => {
    const angle = (i / movies.length) * 2 * Math.PI;
    m.x = center.x + Math.cos(angle) * 40;
    m.y = center.y + Math.sin(angle) * 40;
    m.r = grossRadius(m);
    m.rTarget = m.r;
  });

  function dragStart(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x, d.fy = d.y;
    d3.select(this).raise().classed('active', true);
  }
  function dragged(d) {
    d.fx = d3.event.x, d.fy = d3.event.y;
  }
  function dragEnd(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null, d.fy = null;
    d3.select(this).classed('active', false);
  }

  simulation = d3.forceSimulation(movies)
    .force('x', d3.forceX(center.x).strength(forceStrength))
    .force('y', d3.forceY(center.y).strength(forceStrength))
    .force('collide', d3.forceCollide(d => d.rTarget + 1))
    .on('tick', ticked);

  const groups = svg.selectAll('.bubble')
    .data(movies)
    .enter().append('g')
    .attr('class', 'bubble')
    .on('mouseover', d => {
      hoverText.html(
        `<strong>${d.titles}</strong><br/>
         ${d.genre ? `Genre: ${d.genre}<br/>` : ''}
         Gross Sales: $${d.sales}M<br/>
         Weekend Sales: $${d.weekend}M<br/>
         Hotness Rank: ${d.rank} (based on weekend)
         <div class="hint">Double-click to open IMDb</div>`
      );
      hoverText.style('visibility', 'visible');
    })
    .on('mousemove', () => hoverText
      .style('top', `${d3.event.pageY + 10}px`)
      .style('left', `${d3.event.pageX + 10}px`))
    .on('mouseout', () => hoverText.style('visibility', 'hidden'))
    .call(d3.drag().on('start', dragStart).on('drag', dragged).on('end', dragEnd))
    .on('dblclick', d => {
      if (d3.event.defaultPrevented) return; // a drag, not a click
      window.open(d.links, '_blank', 'noopener');
    });

  circles = groups.append('circle')
    .attr('class', 'circle')
    .attr('r', d => d.r)
    .attr('fill', d => (d.imageUrls ? `url(#poster-${d.rank})` : POSTERLESS_FILL))
    .attr('stroke', 'white')
    .attr('stroke-width', '1px');

  // A film whose poster could not be resolved would otherwise be an unlabelled
  // blank disc, so name it instead.
  const captions = groups.filter(d => !d.imageUrls)
    .append('text')
    .attr('class', 'bubble-label')
    .attr('text-anchor', 'middle')
    .text(d => d.titles);

  function ticked() {
    groups.attr('transform', d => `translate(${d.x},${d.y})`);
    circles.attr('r', d => {
      if (Math.abs(d.rTarget - d.r) < 0.1) d.r = d.rTarget;
      else d.r += (d.rTarget - d.r) * 0.15;
      return d.r;
    });
    captions
      .attr('font-size', d => Math.max(9, d.r * 0.2))
      .attr('dy', d => d.r * 0.07);
  }

  applyLayout({ animate: false });

  byId('toggle').addEventListener('click', () => {
    showingGross = !showingGross;
    radiusFor = showingGross ? grossRadius : hotRadius;

    const toggle = byId('toggle');
    toggle.value = showingGross ? 'Size by HOTNESS!' : 'Size by Gross Sales';
    toggle.className = showingGross ? 'hotness' : 'gross';
    byId('top-line').textContent = showingGross
      ? 'Top 10 box office hits sized by total gross sales.'
      : 'Top 10 box office hits sized by current hotness (weekend sales).';

    movies.forEach(m => { m.rTarget = radiusFor(m); });
    // Re-setting the force re-runs its cached radius initialization.
    simulation.force('collide', d3.forceCollide(d => d.rTarget + 1));
    simulation.alpha(0.6).restart();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      measure();
      buildScales();
      applyLayout();
    }, 150);
  });
}

function fail(message) {
  byId('toggle').style.display = 'none';
  byId('top-line').textContent = message;
}

// Data is refreshed into data/boxoffice.json on a schedule, so this is a
// same-origin request - no CORS proxy, no API key.
fetch('data/boxoffice.json', { cache: 'no-cache' })
  .then(res => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  })
  .then(data => {
    if (!data.movies || !data.movies.length) throw new Error('no movies in feed');
    render(data);
  })
  .catch(err => {
    console.error('Could not load box office data:', err);
    fail('Sorry - box office data could not be loaded right now.');
  });
