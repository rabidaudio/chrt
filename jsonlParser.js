const split2 = require('split2')

module.exports = function (argv, stream) {
  return stream.pipe(split2(JSON.parse))
}
