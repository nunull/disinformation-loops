const fetch = require('node-fetch')

const config = require('../config')
const log = require('./log')('controlClient')

exports.sendConfig = sendConfig
exports.sendDone = sendDone
exports.sendMetadata = sendMetadata

function sendMetadata (metadata) {
  log.info(`sending metadata: ${JSON.stringify(metadata)}`)
  return fetchControlServer('POST', '/metadata', metadata)
}

function sendConfig (config) {
  return fetchControlServer('POST', '/config', config)
}

function sendDone () {
  return fetchControlServer('POST', '/done')
}

function fetchControlServer (method, path, body) {
	log.info(`${method} ${config.remoteAddress}:${config.remoteControlPort}${path}`)

  return fetch(`http://${config.remoteAddress}:${config.remoteControlPort}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : null
  })
}
