const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  publicPath: './',
  configureWebpack: {
    output: {
      filename: '[name].js',
      chunkFilename: '[name].js'
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.join(__dirname, 'static'),
            to: path.join(__dirname, 'unpackage/dist/build/web/static'),
            globOptions: {
              ignore: [
                '**/.*'
              ]
            }
          }
        ]
      })
    ]
  }
}
