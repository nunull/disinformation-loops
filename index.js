let config = require('./config')

const controlClient = require('./lib/controlClient')
const controlServer = require('./lib/controlServer')
const log = require('./lib/log')('index')
const png = require('./lib/png')
const sendPng = require('./lib/sendPng')
const socket = require('./lib/socket')
const state = require('./lib/state')
const websocketServer = require('./lib/websocketServer')

controlServer.on('config', async newConfig => {
	log.info(`received new config: ${JSON.stringify(newConfig)}`)

	// TODO does this propagate to other modules?
	for (const key in newConfig) {
		config[key] = newConfig[key]
	}

	log.info(`config: ${JSON.stringify(config)}`)
	await reset()
})

controlServer.on('metadata', newMetadata => {
	log.info(`received new metadata: ${JSON.stringify(newMetadata)}`)

	state.metadata = newMetadata
})

controlServer.on('done', async () => {
	log.info('done')

	await png.writePng({ ...state.metadata, data: state.buffer })
	state.iterationCount += 1
	await sendImage()
	state.buffer = Buffer.alloc(0)
})

socket.on('message', chunk => {
	state.buffer = Buffer.concat([state.buffer, chunk])
})

main().catch(err => log.info(`err in main: ${err}`))

async function main () {
	if (config.instanceName === 'b') {
		if (!config.inputFile) throw Error('INPUT_FILE not set')

		log.info('starting')

		await controlClient.sendConfig({
			chunkSize: config.chunkSize,
			doneTimeout: config.doneTimeout,
			throttleTimeout: config.throttleTimeout,
			throttleTimeoutStep: config.throttleTimeoutStep,
			sendOrdered: config.sendOrdered
		})

		const image = await png.readPng(config.inputFile)
		await png.writePng(image)

		state.buffer = Buffer.from(image.data)
		state.metadata = { ...image }
		delete state.metadata.data

		await controlClient.sendMetadata(state.metadata)

		log.info(`waiting ${config.startupTimeout} ms until sending the first image`)
		await timeout(config.startupTimeout)

		await sendImage()
	}
}

async function reset () {
	state.buffer = Buffer.alloc(0)
	state.iterationCount = 0

	// handleDone()
	await png.writePng({ ...state.metadata, data: state.buffer })
	state.currentMessage = ''
	websocketServer.broadcast('refresh')
	// sendPng(buffer)
}

async function sendImage () {
	state.currentMessage = ''
	websocketServer.broadcast('refresh')

	// this is delaying just for visual reasons
	// TODO this is a problem if the image is sent faster than 500 ms
	setTimeout(() => {
		state.currentMessage = 'sending image'
		websocketServer.broadcast(state.currentMessage)
	}, 500)

	await sendPng(state.buffer)
	await sendDone()
}

async function sendDone () {
	state.currentMessage = ''
	websocketServer.broadcast(state.currentMessage)

	log.info(`waiting ${config.doneTimeout} ms to send done`)
	await timeout(config.doneTimeout)
	await controlClient.sendDone()

	if (config.throttleTimeout) {
		log.info(`decreasing throttle timeout by ${config.throttleTimeoutStep} from ${config.throttleTimeout} ms`)
		config.throttleTimeout = config.throttleTimeout - 0.5
		log.info(`new throttle timeout ${config.throttleTimeout} ms`)
	}

	state.currentMessage = 'receiving image'
	websocketServer.broadcast(state.currentMessage)
	log.info('done sent')
}

function timeout (timeout) {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, timeout)
	})
}
