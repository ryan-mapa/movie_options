# Movie Time

[LIVE SITE](https://ryan-mapa.github.io/movie_options/)

## Demo
![movie_time_demo](docs/demo.gif)
Changed size?
new line

## Overview
Movie time is a data visualization of live box office data from IMDB using the d3 library. Data is scraped from IMDB. The DOM is parsed through the use of regular expressions(regex).   

Regex action:
```Javascript
rawData = data.match(/<h1 class="header">[\s\S]*?<\/table>/g)[0];

rawTitles = rawData.match(/ >.*?</g);
titles = rawTitles.map(title => title.slice(2, -1))

rawLinks = rawData.match(/href="\/title.*?"\n>/g);
links = rawLinks.map(link => "http://www.imdb.com/" + link.slice(6, -3))

rawImageUrls = rawData.match(/img src=".*?@\._/g);
imageUrls = rawImageUrls.map(img => img.slice(9) + "V1_SY1000_CR0,0,674,1000_AL_.jpg");

rawSales = rawData.match(/\$.*</g);
sales = rawSales.map(sale  => parseFloat(sale.slice(1, -2)));

rawWeekend = rawData.match(/ \$.*?M/g);
weekend = rawWeekend.map(sale  => parseFloat(sale.slice(2, -1)));
```

Use it to help you choose what movie to see in theaters! Clearly see what movies are hot right now based on weekend stats and overall.

Data is pulled form the site using cors-anywhere and jQuery:
```Javascript
$.get('https://cors-anywhere.herokuapp.com/http://www.imdb.com/chart/boxoffice', function(data) { ...
```

## Technologies used
- Javascript
- D3.js
- Webpack
- HTML/CSS
- babel

## Future additions
- Expand beyond top 10 hits
- Rotten tomatoes ratings visualization option
- Critic ratings visualization option
- Difference between critic and rotten tomatoes rating
