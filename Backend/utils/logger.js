const pino = require('pino');

module.exports.logger = () => pino({ level: 'info', timestamp: true });