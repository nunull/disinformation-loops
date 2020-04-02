const png = require('@vivaxy/png')
const fs = require('fs')

const config = require('../config')
const log = require('./log')('png')

exports.readPng = readPng
exports.writePng = writePng

// TODO return promises

function readPng (file) {
	log.info(`reading ${file}`)

	const pngBuffer = fs.readFileSync(file)
	return png.decode(pngBuffer)
}

function writePng (image) {
	log.info(`writing ${config.outputFile}`)

	const pngBuffer = png.encode(image)

	fs.writeFileSync(config.outputFile, pngBuffer)
}
