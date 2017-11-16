require 'open-uri'
require 'Nokogiri'

doc = Nokogiri::HTML(open("http://www.imdb.com/chart/boxoffice"))

return doc
