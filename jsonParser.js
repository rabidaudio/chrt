const { Transform } = require('stream')

// NOTE: the JSON parser isn't streamable, it has to
// load the entire stream first
class JsonArrayTransform extends Transform {
  constructor (options) {
    super({ readableObjectMode: true, ...options })
    this.chunks = []
  }

  _transform (data, encoding, callback) {
    this.chunks.push(data)
    callback()
  }

  _flush (callback) {
    const data = JSON.parse(Buffer.concat(this.chunks))
    if (!Array.isArray(data)) {
      callback(new Error('Provided JSON data is not an array'))
      return
    }
    data.forEach(r => this.push(r))
    callback()
    this.chunks = []
  }
}

module.exports = function (argv, stream) {
  return stream.pipe(new JsonArrayTransform())
}
