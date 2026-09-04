const path = require('path');

module.exports = {
  mode: 'production',
  entry: './movie_time.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname),
  },
  devtool: 'source-map',
  resolve: {
    extensions: ['.js'],
  },
  module: {
    rules: [
      {
        // The old config had no `test`, so Babel ran over all 464 modules
        // including d3's already-transpiled output.
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env'] },
        },
      },
    ],
  },
};
