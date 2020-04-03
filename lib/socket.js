const eventBus = require('js-event-bus')()
const udp = require('dgram')

const config = require('../config')
const log = require('./log')('socket')

const socket = udp.createSocket('udp4')

exports.on = eventBus.on
exports.send = send

socket.on('message', (message, info) => {
  eventBus.emit('message', null, message)
})

socket.on('listening', () => log.info(`listening on ${config.port}`))

socket.on('close', () => log.info('socket closed'))

socket.on('error', err => {
	log.info(`error: ${err}`)
	socket.close()
})

socket.bind(config.port)

function send (chunk, port, address) {
  return new Promise((resolve, reject) => {
    socket.send(chunk, port, address, err => {
  		if (err) {
        log.info(`send chunk error: ${err}`)
        reject(err)
      } else {
        resolve()
      }
  	})
  })
}
