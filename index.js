const udp = require('dgram')
const http = require('http')
const fs = require('fs')
const png = require('@vivaxy/png')
const WebSocket = require('ws')
let config = require('./config')
const { port, controlPort, websocketPort, remotePort, remoteControlPort, remoteAddress, sendOrdered,
	inputFile, debug } = config

const outputFile = 'data/result.png'

const socket = udp.createSocket('udp4')

let buffer = Buffer.alloc(0)
let messagesReceivedCount = 0
let messagesSentCount = 0
let roundtripCount = 0
let metadata

function log (...params) {
	console.log(`[${config.instanceName}]`, ...params)
}

function getIndexHtml () {
	return `<!DOCTYPE html>
		<html>
			<head>
				<style>
					* { font-size: 15pt; }
				</style>
			</head>
			<body>
				<center>
					<p>${roundtripCount} roundtrip${roundtripCount !== 1 ? 's' : ''}</p>
					<img src="/image.png">
					<p id="message"></p>
				</center>
				<script>
					const ws = new WebSocket('ws://localhost:${websocketPort}')
					ws.addEventListener('message', event => {
						log('received', event.data)
						if (event.data === 'refresh') {
							location.reload()
						} else {
							document.getElementById('message').innerText = event.data
						}
					})
				</script>
			</body>
		</html>`
}

function readHttpBody (req, callback) {
	let body = []
	req.on('data', (chunk) => {
		body.push(chunk)
	}).on('end', () => {
		body = Buffer.concat(body).toString()
		callback(null, body)
	})
}

function reset () {
	buffer = Buffer.alloc(0)
	messagesReceivedCount = 0
	messagesSentCount = 0
	roundtripCount = 0
	handleDone()
}

const controlServer = http.createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`)
	log('[control server] request %s %s', req.method, url.pathname)

	if (req.method === 'POST' && url.pathname === '/config') {
		readHttpBody(req, (err, body) => {
			let newConfig = JSON.parse(body)
			log('[control server] received new config', newConfig)

			config = { ...config, ...newConfig }
			log('config', config)
			reset()
		})
	} else if (req.method === 'POST' && url.pathname === '/metadata') {
		readHttpBody(req, (err, body) => {
			metadata = JSON.parse(body)
			log('[control server] received metadata', metadata)

			res.writeHead(200)
			res.end()
		})
	} else if (req.method === 'POST' && url.pathname === '/done') {
		handleDone()
		res.writeHead(200)
		res.end()
	} else if (req.method === 'GET' && url.pathname === '/') {
		res.writeHead(200, {
			'Content-Type': 'text/html'
		})
		res.write(getIndexHtml())
		res.end()
	} else if (req.method === 'GET' && url.pathname === '/image.png') {
		fs.readFile(outputFile, (err, data) => {
			if (err) {
				res.writeHead(404)
				res.end()
				log('[control server] error reading %s', outputFile)
				return
			}

			res.writeHead(200)
			res.write(data)
			res.end()
		})
	}
})

controlServer.listen(controlPort, () => {
	log('[control server] listening on %s', controlPort)
	log('[control server] visit http://localhost:%s', controlPort)
})

const websocket = new WebSocket.Server({ port: websocketPort })

websocket.on('connection', ws => {
	log('[websocket] client connected')
})

socket.on('message', (msg, info) => { handleChunk(msg) })
socket.on('listening', () => { log('[udp socket] listening on %s', port) })
socket.on('close', () => { log('[udp socket] socket closed') })
socket.on('error', err => {
	log('[udp socket] error', err)
	socket.close()
})
socket.bind(port)

if (config.instanceName === 'b') {
	sendConfig()
}

if (inputFile) {
	const imageData = readPng(inputFile)
	writePng(imageData)
	sendPng(imageData)
}

function sendConfig () {
	log('[control server] sending config to %s:%d', remoteAddress, remoteControlPort)
	const req = http.request(`http://${remoteAddress}:${remoteControlPort}/config`, {
		method: 'POST'
	})
	req.on('error', err => { log('[control server] error POST /config', err) })
	req.write(JSON.stringify({
		chunkSize: config.chunkSize,
		doneTimeout: config.doneTimeout,
		throttleTimeout: config.throttleTimeout
	}))
	req.end()
}

function handleChunk (chunk) {
	messagesReceivedCount += 1
	if (debug) log('[udp socket] received %d chunks', messagesReceivedCount)
	buffer = Buffer.concat([buffer, chunk])
}

function handleDone () {
	log('done')

	writePng(buffer)
	sendToClients('refresh')
	sendPng(buffer)

	messagesReceivedCount = 0
	buffer = Buffer.alloc(0)
}

function sendChunk (chunk, callback) {
	socket.send(chunk, remotePort, remoteAddress, err => {
		if (err) log('[udp socket] send chunk error', err)
		if (callback) callback(err)
	})

	messagesSentCount += 1
	if (debug) log('[udp socket] sent %d chunks', messagesSentCount)
}

function sendDone () {
	log('[control server] waiting %d ms to send done', config.doneTimeout)

	sendToClients('')

	setTimeout(() => {
		const req = http.request(`http://${remoteAddress}:${remoteControlPort}/done`, {
			method: 'POST'
		})
		req.on('error', err => { log('[control server] error POST /done error', err) })
		req.end()

		messagesSentCount = 0
		sendToClients('waiting to receive png')
		log('[control server] done')
	}, config.doneTimeout)
}

function readPng (file) {
	log('[png] reading png', file)

	const pngBuffer = fs.readFileSync(file)
	const image = png.decode(pngBuffer)

	metadata = { ...image }
	delete metadata.data

	log('[control server] sending metadata to %s:%d', remoteAddress, remoteControlPort)
	const req = http.request(`http://${remoteAddress}:${remoteControlPort}/metadata`, {
		method: 'POST'
	})
	req.on('error', err => { log('[control server] error POST /metadata error', err) })
	req.write(JSON.stringify(metadata))
	req.end()

	return image.data
}

function writePng (imageData) {
	const image = { ...metadata, data: buffer }

	log('[png] parsing png')
	const pngBuffer = png.encode(image)

	log('[png] read %d bytes', pngBuffer.length)

	log('[png] writing %s', outputFile)
	fs.writeFileSync(outputFile, pngBuffer)

	roundtripCount += 1
}

function sendPng (imageData) {
	log('[udp socket] sending %d bytes in %d chunks', imageData.length, imageData.length / config.chunkSize)

	if (sendOrdered) {
		sendPngOrdered(imageData)
	} else if (config.throttleTimeout) {
		sendPngThrottled(imageData)
	} else {
		sendPngSimple(imageData)
	}
}

function sendPngSimple (imageData) {
	for (let i = 0; i < imageData.length; i += config.chunkSize) {
		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk)
	}

	sendDone()
}

function sendPngThrottled (imageData) {
	log('[udp socket] sending png in throttled chunks')

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			return sendDone()
		}

		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk)

		setTimeout(() => {
			sendNextChunk(i + config.chunkSize)
		}, config.throttleTimeout)
	}
}

function sendPngOrdered (imageData) {
	log('[udp socket] sending png in ordered chunks')

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			return sendDone()
		}

		const chunk = Buffer.from(imageData.slice(i, i + config.chunkSize))
		sendChunk(chunk, err => {
			if (err) {
				log('[udp socket] error', i, err)
				sendNextChunk(i)
			}

			sendNextChunk(i + config.chunkSize)
		})
	}
}

function sendToClients (data) {
	log('[websocket] sending "%s"', data)
	websocket.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
}
