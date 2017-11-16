require 'open-uri'
require 'Nokogiri'

doc = Nokogiri::HTML(open("http://www.imdb.com/chart/boxoffice"))

chart = doc.at_css('.chart').children[5].children

chart.children.each_with_index do |child, idx|
  puts "HERER HERERE HEREREE #{idx}"
  puts child
end

# puts chart.at_css('.ratingColumn')
# chart.each do |movie|
#   puts movie
# end

# chart.content.each {|el| puts el.strip}

# puts chart.content

# puts chart.chi
