const udp = require('dgram')
const http = require('http')
const fs = require('fs')
const png = require('@vivaxy/png')

function getenv (name, opts = { bool: false, optional: false }) {
	const value = process.env[name]
	if (opts.bool) return value === '1' || value === 'true'
	if (!opts.optional && !value) throw new Error(`missing ${name}`)
	return value
}

const port = getenv('PORT')
const controlPort = getenv('CONTROL_PORT')
const remotePort = getenv('REMOTE_PORT')
const remoteControlPort = getenv('REMOTE_CONTROL_PORT')
const remoteAddress = getenv('REMOTE_ADDRESS')
const sendOrdered = getenv('SEND_ORDERED', { bool: true })
const throttleTimeout = getenv('TIMEOUT', { optional: true })

const outputFile = 'data/result.png'

const inputFile = process.argv.length !== 3 ? null : process.argv[process.argv.length - 1]

const socket = udp.createSocket('udp4')

const done = Buffer.from('\0')
const chunkSize = 2048*4

let buffer = Buffer.alloc(0)
let messagesCount = 0
let metadata

console.log('input', inputFile)
console.log('output', outputFile)
console.log('port', port)
console.log('control port', controlPort)
console.log('remote port', remotePort)
console.log('remote address', remoteAddress)
console.log('send ordered', sendOrdered)
console.log('chunk size', chunkSize)
console.log('throttle timeout', throttleTimeout)

const controlServer = http.createServer((req, res) => {
	const url = new URL(req.url, `http://${req.headers.host}`)
	console.log('request %s %s', req.method, url.pathname)

	if (req.method !== 'POST' || url.pathname !== '/metadata') return

	let body = []
	req.on('data', (chunk) => {
		body.push(chunk)
	}).on('end', () => {
		body = Buffer.concat(body).toString()

		metadata = JSON.parse(body)
		console.log('metadata', metadata)
	  
	  	res.writeHead(200)
		res.end()
	})
})

controlServer.listen(controlPort, () => { console.log('control server listening on %s', controlPort) })

socket.on('message', (msg, info) => {
	if (msg.compare(done) === 0) {
		console.log('done')

		sendPng(buffer)
		writePng(buffer)

		messagesCount = 0
		buffer = Buffer.alloc(0)
	} else {
		messagesCount += 1
		console.log('received %d messages', messagesCount)
		buffer = Buffer.concat([buffer, msg])
	}
})
socket.on('error', err => {
	console.log('socker error', err)
	socket.close()
})

socket.on('listening', () => { console.log('listening on %s', port) })
socket.on('close', () => { console.log('socket closed') })
socket.bind(port)

if (inputFile) {
	const imageData = readPng(inputFile)
	sendPng(imageData)
}

function readPng (file) {
	console.log('reading png', file)

	const pngBuffer = fs.readFileSync(file)
	const image = png.decode(pngBuffer)

	metadata = { ...image }
	delete metadata.data

	console.log('sending metadata to %s:%d', remoteAddress, remoteControlPort)
	const req = http.request(`http://${remoteAddress}:${remoteControlPort}/metadata`, {
		method: 'POST'
	})
	req.write(JSON.stringify(metadata))
	req.end()
	// fs.writeFileSync('meta.json', JSON.stringify(metadata))

	return image.data
}

function writePng (imageData) {
	const image = { ...metadata, data: buffer }

	console.log('parsing png')
	const pngBuffer = png.encode(image)

	console.log('read %d bytes', pngBuffer.length)

	console.log('writing %s', outputFile)
	fs.writeFileSync(outputFile, pngBuffer)
}

function sendPng (imageData) {
	console.log('sending %d bytes in %d chunks', imageData.length, imageData.length / chunkSize)

	if (sendOrdered) {
		sendPngOrdered(imageData)
	} else if (throttleTimeout) {
		sendPngThrottled(imageData)
	} else {
		sendPngSimple(imageData)
	}
}

function sendPngSimple (imageData) {
	for (let i = 0; i < imageData.length; i += chunkSize) {
		const chunk = Buffer.from(imageData.slice(i, i + chunkSize))
		socket.send(chunk, remotePort, remoteAddress, err => {
			if (err) console.log('send error', err)
		})
	}

	socket.send(done, remotePort, remoteAddress, err => {
		if (err) console.log('send error', err)
	})
	console.log('done')
}

function sendPngThrottled (imageData) {
	console.log('sending png in throttled chunks')

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			console.log('done')
			socket.send(done, remotePort, remoteAddress)
			return
		}

		const chunk = Buffer.from(imageData.slice(i, i + chunkSize))
		socket.send(chunk, remotePort, remoteAddress, err => {
			if (err) console.log('error', i, err)
		})

		setTimeout(() => {
			sendNextChunk(i + chunkSize)
		}, throttleTimeout)
	}
}

function sendPngOrdered (imageData) {
	console.log('sending png in ordered chunks')

	sendNextChunk(0)

	function sendNextChunk (i) {
		if (i >= imageData.length) {
			console.log('done')
			socket.send(done, remotePort, remoteAddress)
			return
		}

		const chunk = Buffer.from(imageData.slice(i, i + chunkSize))
		socket.send(chunk, remotePort, remoteAddress, err => {
			if (err) {
				sendNextChunk(i)
				console.log('error', i, err)
			}

			sendNextChunk(i + chunkSize)
		})
	}
}


