const { Transform } = require('stream')
const split2 = require('split2')
const csvParse = require('csv-parse')

class RowToObjectTransform extends Transform {
  constructor(opts) {
    super({ writableObjectMode: true, readableObjectMode: true, ...opts })
    this.horizontalSeparator = opts.horizontal_separator
    this.hasHeaders = opts.headers !== false
    this.headers = null
  }

  _transform(row, encoding, callback) {
    if (this.headers === null) {
      if (this.hasHeaders) {
        this.headers = row
        return callback()
      }
      // generate column names
      this.headers = row.map((v, i) => `col_${i}`)
    }
    // zip with headers to object
    if (this.horizontalSeparator) {
      for (const element of row) {
        const isHorizontalSeparator = element.split('').filter(c => c !== this.horizontalSeparator).length === 0
        if (isHorizontalSeparator) {
          return callback() // skip
        }
      }
    }
    const data = row.reduce((data, v, i) => ({ [this.headers[i]]: v,  ...data }), {})
    this.push(data)
    callback()
  }
}

class RemoveBorderTransform extends Transform {
  constructor(opts) {
    super(opts)
    this.horizontalBorder = null
    this.delimiter = opts.delimiter
  }

  _transform(line, encoding, callback) {
    line = line.toString()
    if (this.horizontalBorder === null) {
      this.horizontalBorder = line
      return callback()
    }
    if (line === this.horizontalBorder) {
      return callback()
    }
    // remove left and right borders
    if (line.startsWith(this.delimiter)) {
      line = line.substr(this.delimiter.length)
    }
    if (line.endsWith(this.delimiter)) {
      line = line.substr(0, line.length - this.delimiter.length)
    }
    line += "\n" // re-add the linebreak removed by split2
    this.push(Buffer.from(line))
    callback()
  }
}

module.exports = function(argv, stream) {
  argv.delimiter = argv.delimiter || '|'

  if (argv.borders) {
    stream = stream.pipe(split2()).pipe(new RemoveBorderTransform(argv))
  }
  return stream.pipe(csvParse({
    ...argv,
    trim: true, // remove fixed whitespace
    skip_lines_with_error: true, // need to ignore horizontal separators
    headers: false // handled in next step
  })).pipe(new RowToObjectTransform(argv))
}
