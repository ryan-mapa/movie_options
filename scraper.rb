require 'open-uri'
require 'Nokogiri'

doc = Nokogiri::HTML(open("http://www.imdb.com/chart/boxoffice"))

chart = doc.at_css('.chart').children[5].children

items = []
data = []
links2 = []

chart.children.each_with_index do |child, idx|
  items.push(child.content.strip)
  links2.push(child)
end


items.each {|item| data.push(item) unless item.empty?}

titles = []
weekend = []
gross = []

data.each_with_index do |datum, idx|
  if idx % 4 == 0
    titles.push(datum.strip)
  elsif idx % 4 == 1
    weekend.push(datum.strip)
  elsif idx % 4 == 2
    gross.push(datum.strip)
  end
end

# puts data
testy = []
chart.children.each {|el| testy.push(el.to_s)}

long = testy.select {|el| el.strip.length > 200}


links = []
image_urls = []
long.each do |el|
  if el.include?("titleColumn")
    links.push("http://www.imdb.com/" + el.strip.split(" ")[3][6..-2])
  else el.include?("posterColumn")
    image_urls.push(el.strip.split(" ")[5][5..-2])
  end
end

puts image_urls
