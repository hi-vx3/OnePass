const pino = require('pino');

const prettyConfig = {
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      // Use a format string. '{if err.code}[{err.code}] {end}{msg}' means:
      // if `err.code` exists, print `[THE_CODE] `, then print the message.
      messageFormat: '{if err.code}[{err.code}] {end}{msg}',
    },
  },
};

module.exports.initializeLogger = () => pino(process.env.NODE_ENV !== 'production' ? prettyConfig : { level: 'info' });