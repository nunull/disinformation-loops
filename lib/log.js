const config = require('../config')

module.exports = module => {
  return {
    info (message) {
      console.log(`[${config.instanceName}] [${module}]`, message)
    }
  }
}
