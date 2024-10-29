const defaultSettings = require('../../package.json').name

const name = defaultSettings.title || 'microi.service'
const microiConfig = {
  library: `${name}-[name]`,
  libraryTarget: 'umd',
  jsonpFunction: `webpackJsonp_${name}`
}
const headers = {
  'Access-Control-Allow-Origin': '*'
}
exports = module.exports = { microiConfig, headers }
