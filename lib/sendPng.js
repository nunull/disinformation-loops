const socket = require('./socket')

const config = require('../config')
const log = require('./log')('sendPng')

module.exports = sendPng

function sendPng (imageData) {
	log.info(`sending ${imageData.length} bytes in ${imageData.length / config.chunkSize} chunks`)

	if (config.sendOrdered) {
		return sendPngOrdered(imageData)
	} else if (config.throttleTimeout) {
		return sendPngThrottled(imageData)
	} else {
		return sendPngSimple(imageData)
	}
}

function sendPngSimple (imageData) {
	for (let i = 0; i < imageData.length; i += config.chunkSize) {
		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk)
	}

	return Promise.resolve()
}

function sendPngThrottled (imageData) {
	const chunkCount = Math.ceil(imageData.length / config.chunkSize)
	const timeMinutes = (chunkCount * Math.floor(config.throttleTimeout)) / 1000 / 60
	const timeMinutesRounded = Math.round(timeMinutes * 100) / 100
	log.info(`sending png in throttled chunks with ${Math.floor(config.throttleTimeout)} ms timeouts (approx. ${timeMinutesRounded} min)`)

	return new Promise((resolve, reject) => {
		sendNextChunk(0)

		function sendNextChunk (i) {
			if (i >= imageData.length) {
				return resolve()
			}

			const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
			sendChunk(chunk)

			setTimeout(() => {
				sendNextChunk(i + config.chunkSize)
			}, Math.floor(config.throttleTimeout))
		}
	})
}

function sendPngOrdered (imageData) {
	log.info('sending png in ordered chunks')

	return new Promise((resolve, reject) => {
		sendNextChunk(0)

		function sendNextChunk (i) {
			if (i >= imageData.length) {
				return resolve()
			}

			const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
			sendChunk()
				.then(() => { sendNextChunk(i + config.chunkSize) })
				.catch(err => {
					if (err) {
						log.info(`error at ${i} while sending ordered: ${err}`)
						sendNextChunk(i)
					}
				})
		}
	})
}

function sendChunk (chunk) {
	return socket.send(chunk, config.remotePort, config.remoteAddress)
}
