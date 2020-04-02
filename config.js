function getenv (name, opts = { bool: false, optional: false }) {
	const value = process.env[name]
	if (opts.bool) return value === '1' || value === 'true'
	if (!opts.optional && !value) throw new Error(`missing ${name}`)
	return value
}

function readConfigValue (c, instanceName, key) {
	const value = getenv(key, { optional: true })
	return value || c[instanceName][key] || c[key]
}

function readConfig (configFile, instanceName) {
	const c = require(`./${configFile}`)

	const otherInstanceName = instanceName === 'a' ? 'b' : 'a'

	const config = {
		instanceName,

		outputFile: 'data/result.png',
		startupTimeout: 2000,

		port: readConfigValue(c, instanceName, 'PORT'),
		controlPort: readConfigValue(c, instanceName, 'CONTROL_PORT'),
		websocketPort: readConfigValue(c, instanceName, 'WEBSOCKET_PORT'),
		remotePort: readConfigValue(c, otherInstanceName, 'PORT'),
		remoteControlPort: readConfigValue(c, otherInstanceName, 'CONTROL_PORT'),
		remoteAddress: readConfigValue(c, otherInstanceName, 'ADDRESS'),
		sendOrdered: readConfigValue(c, instanceName, 'SEND_ORDERED'),
		throttleTimeout: readConfigValue(c, instanceName, 'TIMEOUT'),
		doneTimeout: readConfigValue(c, instanceName, 'DONE_TIMEOUT'),
		chunkSize: parseInt(readConfigValue(c, instanceName, 'CHUNK_SIZE')),
		inputFile: readConfigValue(c, instanceName, 'INPUT_FILE')
	}

	console.log(`[${instanceName}]`, 'config', config)

	return config
}

if (process.argv.length !== 4) {
	console.log('Usage: node index.js <config file> <instance name>')
	process.exit(1)
}

const configFile = process.argv[process.argv.length - 2]
const instanceName = process.argv[process.argv.length - 1]

module.exports = readConfig(configFile, instanceName)
