const socket = require('./socket')

const config = require('../config')
const log = require('./log')('sendPng')

module.exports = sendPng

function sendPng (imageData, callback) {
	log.info(`sending ${imageData.length} bytes in ${imageData.length / config.chunkSize} chunks`)

	if (config.sendOrdered) {
		sendPngOrdered(imageData, callback)
	} else if (config.throttleTimeout) {
		sendPngThrottled(imageData, callback)
	} else {
		sendPngSimple(imageData, callback)
	}
}

function sendPngSimple (imageData, callback) {
	for (let i = 0; i < imageData.length; i += config.chunkSize) {
		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk)
	}

	callback()
}

function sendPngThrottled (imageData, callback) {
	log.info(`sending png in throttled chunks with ${config.throttleTimeout} ms timeouts`)

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			return callback()
		}

		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk)

		setTimeout(() => {
			sendNextChunk(i + config.chunkSize)
		}, config.throttleTimeout)
	}
}

function sendPngOrdered (imageData, callback) {
	log.info('sending png in ordered chunks')

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			return callback()
		}

		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk, err => {
			if (err) {
				log.info(`error at ${i} while sending ordered: ${err}`)
				sendNextChunk(i)
			}

			sendNextChunk(i + config.chunkSize)
		})
	}
}

function sendChunk (chunk, callback) {
	socket.send(chunk, config.remotePort, config.remoteAddress, callback)
}
