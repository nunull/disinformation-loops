let config = require('./config')

const controlClient = require('./lib/controlClient')
const controlServer = require('./lib/controlServer')
const log = require('./lib/log')('index')
const png = require('./lib/png')
const sendPng = require('./lib/sendPng')
const socket = require('./lib/socket')
const state = require('./lib/state')
const websocketServer = require('./lib/websocketServer')

// const state = {
// 	buffer: Buffer.alloc(0),
// 	iterationCount: 0,
// 	metadata: null
// }

function reset () {
	state.buffer = Buffer.alloc(0)
	state.iterationCount = 0

	// handleDone()
	png.writePng({ ...state.metadata, data: state.buffer })
	websocketServer.broadcast('refresh')
	// sendPng(buffer)
}

controlServer.on('config', newConfig => {
	log.info(`received new config: ${newConfig}`)

	// TODO does this propagate to other modules?
	for (const key in newConfig) {
		config[key] = newConfig[key]
	}

	log.info(`config: ${JSON.stringify(config)}`)
	reset()
})

controlServer.on('metadata', newMetadata => {
	log.info(`received new metadata: ${JSON.stringify(newMetadata)}`)

	state.metadata = newMetadata
})

controlServer.on('done', () => {
	log.info('done')

	png.writePng({ ...state.metadata, data: state.buffer })

	state.iterationCount += 1

	websocketServer.broadcast('refresh')
	// this is delaying just for visual reasons
	setTimeout(() => {
		websocketServer.broadcast('sending image')
	}, 500)

	sendPng(state.buffer, () => {
		sendDone()
	})

	state.buffer = Buffer.alloc(0)
})

socket.on('message', chunk => {
	if (!state.buffer) console.log('BUFFER', state, state.buffer)
	state.buffer = Buffer.concat([state.buffer, chunk])
})

if (config.instanceName === 'b') {
	controlClient.sendConfig({
		chunkSize: config.chunkSize,
		doneTimeout: config.doneTimeout,
		throttleTimeout: config.throttleTimeout
	})
}

if (config.inputFile) {
	log.info(`waiting ${config.startupTimeout} ms until starting`)
	setTimeout(() => {
		log.info('starting')

		const image = png.readPng(config.inputFile)

		state.metadata = { ...image }
		delete state.metadata.data

		controlClient.sendMetadata(state.metadata)

		// TODO
		png.writePng(image)
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
