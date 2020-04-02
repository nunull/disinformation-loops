const WebSocket = require('ws')

const config = require('../config')
const log = require('./log')('websocketServer')

const websocket = new WebSocket.Server({ port: config.websocketPort })

exports.broadcast = broadcast

websocket.on('connection', ws => {
	log.info('client connected')
})

function broadcast (data) {
  log.info(`broadcasting '${data}'`)

	websocket.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data)
    }
  })
}
