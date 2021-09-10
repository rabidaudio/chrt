const parse = require('csv-parse')

module.exports = function (argv, stream) {
  return stream.pipe(parse({ columns: true, ...argv }))
}
