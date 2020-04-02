let config = require('./config')
const { port, controlPort, websocketPort, remotePort, remoteControlPort, remoteAddress,
	inputFile } = config

const controlClient = require('./lib/controlClient')
const controlServer = require('./lib/controlServer')
const log = require('./lib/log')('index')
const png = require('./lib/png')
const sendPng = require('./lib/sendPng')
const socket = require('./lib/socket')
const websocketServer = require('./lib/websocketServer')

let buffer = Buffer.alloc(0)
let messagesReceivedCount = 0
let roundtripCount = 0
let metadata

function reset () {
	buffer = Buffer.alloc(0)
	messagesReceivedCount = 0
	roundtripCount = 0

	// handleDone()
	png.writePng({ ...metadata, data: buffer })
	websocketServer.broadcast('refresh')
	// sendPng(buffer)
}

controlServer.on('config', newConfig => {
	log.info(`received new config: ${newConfig}`)

	config = { ...config, ...newConfig }
	log.info(`config: ${config}`)
	reset()
})

controlServer.on('metadata', newMetadata => {
	log.info(`received new metadata: ${newMetadata}`)

	metadata = newMetadata
})

controlServer.on('done', () => {
	log.info('done')

	png.writePng({ ...metadata, data: buffer })
	roundtripCount += 1
	websocketServer.broadcast('refresh')
	sendPng(buffer, () => {
		sendDone()
	})

	messagesReceivedCount = 0
	buffer = Buffer.alloc(0)

})

socket.on('message', chunk => {
	messagesReceivedCount += 1
	buffer = Buffer.concat([buffer, chunk])
})

if (config.instanceName === 'b') {
	controlClient.sendConfig({
		chunkSize: config.chunkSize,
		doneTimeout: config.doneTimeout,
		throttleTimeout: config.throttleTimeout
	})
}

if (inputFile) {
	log.info(`waiting ${config.startupTimeout} ms until starting`)
	setTimeout(() => {
		log.info('starting')

		const image = png.readPng(inputFile)

		metadata = { ...image }
		delete metadata.data

		controlClient.sendMetadata(metadata)

		// TODO
		// writePng(imageData)
		sendPng(image.data, () => {
			sendDone()
		})
	}, config.startupTimeout)
}

function sendDone () {
	log.info(`waiting ${config.doneTimeout} ms to send done`)

	websocketServer.broadcast('')

	setTimeout(() => {
		controlClient.sendDone()

		websocketServer.broadcast('waiting to receive image')
		log.info('done sent')
	}, config.doneTimeout)
}
