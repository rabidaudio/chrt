const { Transform } = require('stream')

class LimitTransform extends Transform {
  constructor (limit) {
    super({ writableObjectMode: true, readableObjectMode: true })
    this.limit = limit
    this.rowIndex = -1
  }

  _transform (data, encoding, callback) {
    this.rowIndex += 1
    if (this.rowIndex < this.limit) {
      this.push(data)
    }
    callback()
  }
}

module.exports = LimitTransform
