const http = require('http')

const config = require('../config')
const log = require('./log')('controlClient')

exports.sendConfig = sendConfig
exports.sendDone = sendDone
exports.sendMetadata = sendMetadata

// TODO return promises

function sendMetadata (metadata) {
  request('POST', '/metadata', metadata)
}

function sendConfig (config) {
  request('POST', '/config', config)
}

function sendDone () {
  request('POST', '/done')
}

function request (method, path, data) {
	log.info(`${method} ${config.remoteAddress}:${config.remoteControlPort}${path}`)

  const req = http.request(`http://${config.remoteAddress}:${config.remoteControlPort}${path}`, {
		method
	})
	req.on('error', err => {
    log.info(`error ${method} ${path}: ${err}`)
  })
  if (data) req.write(JSON.stringify(data))
	req.end()
}
