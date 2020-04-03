const fs = require('fs')
const png = require('@vivaxy/png')
const util = require('util')

const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const config = require('../config')
const log = require('./log')('png')

exports.readPng = readPng
exports.writePng = writePng

async function readPng (file) {
	log.info(`reading ${file}`)

	const pngBuffer = await readFile(file)
	return png.decode(pngBuffer)
}

async function writePng (image) {
	log.info(`writing ${config.outputFile}`)

	const pngBuffer = png.encode(image)

	await writeFile(config.outputFile, pngBuffer)
}
