var path = require('path');

module.exports = {
  entry: './movie_time.js',
  output: {
    filename: 'bundle.js',
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.js']
  },
  module: {
  loaders: [
    {
      loader: 'babel-loader',
      query: {
        presets: ['es2015']
      }
    }]
  }
};
