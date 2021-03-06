import * as d3 from 'd3';

let rawData = "";
let rawTitles = [], titles = [];
let rawLinks = [], links = [];
let rawImageUrls = [], imageUrls = [];
let rawSales = [], sales = [];
let rawWeekend = [], weekend = [];
let rawBigImageUrls = [], bigImageUrls = [];
let testImageUrls = [], testLinks = [];
let dataCollection  = [];
let defaultView = true;

// d3 variables
let simulation;
let max, min, range;
let cirlces = null;
let baseSize = 50;
let width = 1200;
let height = 700;
let forceStrength = 0.07;
let center = {x: width/2, y: height/2};

// button function
document.getElementById("toggle").addEventListener('click', toggleSize);

function toggleSize() {
  if (defaultView == true) {
    document.getElementById("toggle").value = "Size by Gross Sales";
    document.getElementById("toggle").className = "gross";
    document.getElementById("top-line").innerHTML = "Current top 10 box office hits sized by current hotness (weekend sales).";
    d3.selectAll('.circle').attr('r', d => (d.weekend * range / max) + baseSize);
    defaultView = false;
    simulation.force("collide", d3.forceCollide(d => (d.weekend * range / max) + baseSize + 1));
  } else {
    document.getElementById("toggle").value = "Size by HOTNESS!";
    document.getElementById("toggle").className = "hotness";
    document.getElementById("top-line").innerHTML = "Current top 10 box office hits sized by gross sales.";
    d3.selectAll('.circle').attr('r', d => baseSize + (d.sales / 3));
    defaultView = true;
    simulation.force("collide", d3.forceCollide(d => (d.sales / 3) + baseSize + 1));
  }
}

// scrape data
$.get('https://cors-anywhere.herokuapp.com/http://www.imdb.com/chart/boxoffice', function(data) {

  rawData = data.match(/<h1 class="header">[\s\S]*?<\/table>/g)[0];

  rawTitles = rawData.match(/ >.*?</g);
  titles = rawTitles.map(title => title.slice(2, -1))

  rawLinks = rawData.match(/href="\/title.*?"\n>/g);
  links = rawLinks.map(link => "http://www.imdb.com/" + link.slice(6, -3))

  rawImageUrls = rawData.match(/img src=".*?@\._/g);
  imageUrls = rawImageUrls.map(img => img.slice(9) + "V1_SY500_CR0,0,337,500_AL_.jpg");

  rawSales = rawData.match(/\$.*</g);
  sales = rawSales.map(sale  => parseFloat(sale.slice(1, -2)));

  rawWeekend = rawData.match(/ \$.*?M/g);
  weekend = rawWeekend.map(sale  => parseFloat(sale.slice(2, -1)));

  for (var i = 0; i < 10; i++) {
    dataCollection[i] = {
              rank: `${(i+1)}`,
              titles: `${titles[i]}`,
              links: `${links[i]}`,
              imageUrls: `${imageUrls[i]}`,
              sales: `${sales[i]}`,
              weekend: `${weekend[i]}`
            }
  }

  min = dataCollection[9].weekend;
  max = dataCollection[0].weekend;
  range = max - min + 40;

// helpers
  const hoverText = d3.select("body").append("div")
    .attr("class", "hover")
    .text("hoverText");

// dragging helpers
  function dragStart(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x, d.fy = d.y;
    d3.select(this).raise().classed("active", true);
  }

  function dragged(d) {
    d.fx = d3.event.x, d.fy = d3.event.y;
  }

  function dragOver(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null, d.fy = null;
    d3.select(this).classed("active", false);
  }

// attr test helper
  function changer(d) {
    console.log('changify');
    console.log(this.d3.select("#1"));
  }

//d3 function
  var svg = d3.select("body").append("svg")
    .attr("id", "chart")
    .attr("width", width)
    .attr("height", height)
    .attr('fill', 'blue');

// image mapping helpers
  var defs = svg.append("defs");

  defs.selectAll(".poster-art")
    .data(dataCollection)
    .enter().append("pattern")
    .attr("class", "poster-art")
    .attr("id", d => d.rank)
    .attr("height", "100%")
    .attr("width", "100%")
    .attr("patternContentUnits", "objectBoundingBox")
    .append("image")
    .attr("height", 1.5)
    .attr("width", 1)
    .attr("preserveAspectRatio", "none")
    .attr("xlink:href", d => d.imageUrls);

// simulation
  simulation = d3.forceSimulation()
  .force("x", d3.forceX(center.x).strength(forceStrength))
  .force("y", d3.forceY(center.y).strength(forceStrength))
  .force("collide", d3.forceCollide(d => (d.sales / 3) + baseSize + 1))
  .on("tick", ticked); //KEY LINE FOR ACTIATION

// draw circles
  var circles = svg.selectAll(".circle") //circle element
    .data(dataCollection)
    .enter().append("circle")
    .attr("class", "circle")
    .attr("id", d => d.rank)
    .attr("cx", d => center.x) // positions!
    .attr("cy", d => center.y)
    .attr("r", d => baseSize + (d.sales / 3))
    .attr("text", d => d.titles)
    .attr("fill", d => `url(#${d.rank})`) // fill content target id of rank
    .on("mouseover", (d,i) => { //mouseover hoverText
      hoverText.html(
        `Name: ${d.titles}<br/>
         Gross Sales: $${d.sales}M<br/>
         Weekend Sales: $${d.weekend}M<br/>
         Hotness Rank: ${d.rank} (based on weekend)<br/>`
      );
      hoverText.style("visibility", "visible");
    })
    .on("mousemove", () => {
      return hoverText
        .style("top", (d3.event.pageY+10)+"px")
        .style("left",(d3.event.pageX+10)+"px");
    })
    .on("mouseout", () => hoverText.style("visibility", "hidden"))
    .call(
      d3.drag()
        .on("start", dragStart)
        .on("drag", dragged)
        .on("end", dragOver)
    )
    .on('click', d => {
      if (d3.event.defaultPrevented) return;
        window.open(d.links,'_blank');
    })
    .attr('stroke', 'white')
    .attr('stroke-width', '1px')

// nodes and ticked
  simulation.nodes(dataCollection)
    .on('tick', ticked)

  function ticked() {
    circles
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
  }

});
