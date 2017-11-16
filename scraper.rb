require 'open-uri'
require 'Nokogiri'

doc = Nokogiri::HTML(open("http://www.imdb.com/chart/boxoffice"))

chart = doc.at_css('.chart').children[5].children

items = []
data = []

chart.children.each_with_index do |child, idx|
  items.push(child.content.strip)
end

items.each {|item| data.push(item) unless item.empty?}

titles = []
weekend = []
gross = []

# puts data
testy = []
chart.children.each {|el| testy.push(el.to_s)}

long = testy.select {|el| el.strip.length > 200}

# long.each do |el|
#   puts "#{el}"
#   puts
# end

links = []
image_urls = []
long.each do |el|
  if el.include?("titleColumn")
    links.push(el.strip)
  else
    image_urls.push(el.strip)
  end
end

puts links
