const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const outputDir = process.env.APP_OUTPUT_DIR || path.join(__dirname, "./dist/");


module.exports = {
  mode: 'production',
  entry: {
    'app': './ui.js',
  },
  //devtool: 'inline-source-map',
  output: {
    path: outputDir,
    filename: '[name].js',
    globalObject: 'self',
    libraryTarget: 'self',
  },

  target: "web",

  node: {
    dns: 'empty',
  },

  externals: {
    'WebSocket': 'WebSocket',
  },

  plugins: [
    new MiniCssExtractPlugin(),
    new webpack.DefinePlugin({
        __API_PREFIX__ : JSON.stringify(process.env.API_PREFIX || ""),
    })
  ],

  module: {
    rules: [
    {
      test:  /\.svg$/,
      loader: 'svg-inline-loader'
    },
    {
      test: /ui.scss$/,
      loaders: ['css-loader', 'sass-loader']
    }
    ]
  },

  devServer: {
    compress: true,
    port: 9021,
    publicPath: '/dist/',
    contentBase: './'
  }
};
