const bodyParser = require('body-parser')
const express = require('express')
const eventBus = require('js-event-bus')()
const fs = require('fs')

const config = require('../config')
const log = require('./log')('controlServer')
const state = require('./state')

const app = express()

exports.on = eventBus.on.bind(eventBus)

app.set('views', './lib/views')
app.set('view engine', 'hbs')

app.use(bodyParser.json())

app.get('/', (req, res) => {
  res.render('index', {
    iterationCount: state.iterationCount,
    websocketPort: config.websocketPort
  })
})

app.get('/image.png', (req, res) => {
  fs.readFile(config.outputFile, (err, data) => {
    if (err) {
      res.status(404)
      res.send()
      log.info(`error reading ${config.outputFile}`)
      return
    }

    res.send(data)
  })
})

app.post('/config', (req, res) => {
  eventBus.emit('config', null, req.body)
  res.status(200)
  res.send()
})

app.post('/metadata', (req, res) => {
  eventBus.emit('metadata', null, req.body)
  res.status(200)
  res.send()
})

app.post('/done', (req, res) => {
  eventBus.emit('done')
  res.status(200)
  res.send()
})

app.listen(config.controlPort, () => {
  log.info(`listening on ${config.controlPort}`)
})
