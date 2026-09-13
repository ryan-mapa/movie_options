import * as d3 from 'd3';

// Layout
const width = 1200;
const height = 600;
const center = { x: width / 2, y: height / 2 };
const forceStrength = 0.07;
const minRadius = 32;
const maxRadius = 105;

let simulation;
let circles;
let radiusFor;          // active accessor: datum -> radius
let showingGross = true;

const byId = id => document.getElementById(id);

// Circle area scales with the value, so radius scales with its square root.
// A linear radius makes a $890M film ~160x the area of a $5M one and blows out the canvas.
function makeRadius(values) {
  return d3.scaleSqrt()
    .domain([d3.min(values), d3.max(values)])
    .range([minRadius, maxRadius])
    .clamp(true);
}

function render({ weekend: weekendLabel, updated, movies }) {
  const grossScale = makeRadius(movies.map(m => m.sales));
  const hotScale = makeRadius(movies.map(m => m.weekend));

  const grossRadius = d => grossScale(d.sales);
  const hotRadius = d => hotScale(d.weekend);
  radiusFor = grossRadius;

  // Stale data used to be invisible: the chart looked healthy while the
  // refresh job had been failing for days. Show the date, and say so when old.
  const label = byId('weekend-label');
  const asOf = updated ? new Date(updated) : null;
  let text = weekendLabel;
  if (asOf && !Number.isNaN(asOf.getTime())) {
    const days = Math.floor((Date.now() - asOf.getTime()) / 86400000);
    text += ` \u00b7 updated ${asOf.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    if (days > 10) {
      text += ` (${days} days ago - the refresh job may be failing)`;
      label.classList.add('stale');
    }
  }
  label.textContent = text;

  const hoverText = d3.select('body').append('div').attr('class', 'hover');

  const svg = d3.select('body').append('svg')
    .attr('id', 'chart')
    .attr('width', width)
    .attr('height', height);

  // Each poster becomes a pattern the matching circle is filled with.
  svg.append('defs').selectAll('.poster-art')
    .data(movies)
    .enter().append('pattern')
    .attr('class', 'poster-art')
    .attr('id', d => `poster-${d.rank}`)
    .attr('height', '100%')
    .attr('width', '100%')
    .attr('patternContentUnits', 'objectBoundingBox')
    .filter(d => d.imageUrls)
    .append('image')
    .attr('height', 1.5)
    .attr('width', 1)
    .attr('preserveAspectRatio', 'none')
    .attr('xlink:href', d => d.imageUrls);

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

  // forceX/forceY are scaled by alpha, which decays to zero long before nodes
  // starting at the phyllotaxis origin can travel to the center. Seeding them
  // on a small ring around the center leaves only collisions to resolve.
  movies.forEach((m, i) => {
    const angle = (i / movies.length) * 2 * Math.PI;
    m.x = center.x + Math.cos(angle) * 40;
    m.y = center.y + Math.sin(angle) * 40;
    m.r = grossRadius(m);
    m.rTarget = m.r;
  });

  simulation = d3.forceSimulation(movies)
    .force('x', d3.forceX(center.x).strength(forceStrength))
    .force('y', d3.forceY(center.y).strength(forceStrength))
    .force('collide', d3.forceCollide(d => d.rTarget + 1))
    .on('tick', ticked);

  circles = svg.selectAll('.circle')
    .data(movies)
    .enter().append('circle')
    .attr('class', 'circle')
    .attr('cx', center.x)
    .attr('cy', center.y)
    .attr('r', d => d.r)
    .attr('fill', d => (d.imageUrls ? `url(#poster-${d.rank})` : '#3f4a5a'))
    .attr('stroke', 'white')
    .attr('stroke-width', '1px')
    .on('mouseover', d => {
      hoverText.html(
        `Name: ${d.titles}<br/>
         Gross Sales: $${d.sales}M<br/>
         Weekend Sales: $${d.weekend}M<br/>
         Hotness Rank: ${d.rank} (based on weekend)<br/>`
      );
      hoverText.style('visibility', 'visible');
    })
    .on('mousemove', () => hoverText
      .style('top', `${d3.event.pageY + 10}px`)
      .style('left', `${d3.event.pageX + 10}px`))
    .on('mouseout', () => hoverText.style('visibility', 'hidden'))
    .call(d3.drag().on('start', dragStart).on('drag', dragged).on('end', dragEnd))
    .on('click', d => {
      if (d3.event.defaultPrevented) return; // a drag, not a click
      window.open(d.links, '_blank', 'noopener');
    });

  function ticked() {
    circles
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => {
        if (Math.abs(d.rTarget - d.r) < 0.1) d.r = d.rTarget;
        else d.r += (d.rTarget - d.r) * 0.15;
        return d.r;
      });
  }

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
