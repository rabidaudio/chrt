const chai = require('chai')
chai.use(require('chai-as-promised'))
const expect = chai.expect

const { Readable } = require('stream')

const jsonlParserFactory = require('../jsonlParser')
const jsonParserFactory = require('../jsonParser')
const csvParserFactory = require('../csvParser')
const asciiTableParserFactory = require('../asciiTableParser')

async function completelyReadStream(stream) {
  return new Promise((resolve, reject) => {
    const results = []
    stream.on('data', d => results.push(d))
    stream.once('error', reject)
    stream.once('end', () => resolve(results))
  })
}

describe('JSONL Parser', () => {
  it('should parse JSONL', async () => {

    const jsonl = `{"date":"2021-01-01","value":1}
{"date":"2021-02-01","value":2}
{"date":"2021-03-01","value":3}
{"date":"2021-04-01","value":4}
{"date":"2021-05-01","value":5}
`
    const stream = jsonlParserFactory({}, Readable.from(jsonl))
    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"date":"2021-01-01","value":1},
      {"date":"2021-02-01","value":2},
      {"date":"2021-03-01","value":3},
      {"date":"2021-04-01","value":4},
      {"date":"2021-05-01","value":5}
    ])
  })
})

describe('JSON Parser', () => {
  it('should parse JSON arrays', async () => {
    const json = `
[
  {"date":"2021-01-01","value":1},
  {"date":"2021-02-01","value":2},
  {"date":"2021-03-01","value":3},
  {"date":"2021-04-01","value":4},
  {"date":"2021-05-01","value":5}
]
`
    const stream = jsonParserFactory({}, Readable.from(json))
    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"date":"2021-01-01","value":1},
      {"date":"2021-02-01","value":2},
      {"date":"2021-03-01","value":3},
      {"date":"2021-04-01","value":4},
      {"date":"2021-05-01","value":5}
    ])
  })

  it('should error for non-JSON', () => {
    expect(() => {
      completelyReadStream(jsonParserFactory({}, Readable.from('asdfsiwemfwef')))
    }).to.throw
  })

  it('should error for non-arrays', () => {
    const stream = jsonParserFactory({}, Readable.from('{"an":"object"}'))
    return expect(completelyReadStream(stream)).to.eventually.be.rejectedWith('Provided JSON data is not an array')
  })
})

describe('CSV Parser', () => {
  it('should parse CSVs', async () => {
    const csv = `date,value
2021-01-01,1
2021-02-01,2
2021-03-01,3
2021-04-01,4
2021-05-01,5
`
    const stream = csvParserFactory({}, Readable.from(csv))
    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"date":"2021-01-01", "value":"1"},
      {"date":"2021-02-01", "value":"2"},
      {"date":"2021-03-01", "value":"3"},
      {"date":"2021-04-01", "value":"4"},
      {"date":"2021-05-01", "value":"5"}
    ])
  })

  // TODO: test escaping, quoting, etc
})

describe('ASCII Table Parser', () => {
  it('should parse markdown tables', async () => {
    const markdown = `Header   | Another Header | Yet Another Header
---------|----------------|-------------------
Value 11 | Value 12       | Value 13
Value 21 | Value 22       | Value 23
Value 31 | Value 32       | Value 33
`
    const stream = asciiTableParserFactory({
      delimiter: '|',
      horizontal_separator: '-'
    }, Readable.from(markdown))

    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"Header":"Value 11", "Another Header":"Value 12", "Yet Another Header":"Value 13"},
      {"Header":"Value 21", "Another Header":"Value 22", "Yet Another Header":"Value 23"},
      {"Header":"Value 31", "Another Header":"Value 32", "Yet Another Header":"Value 33"},
    ])
  })
  it('should parse header-less tables', async () => {
    const markdown = `Value 11 | Value 12       | Value 13
Value 21 | Value 22       | Value 23
Value 31 | Value 32       | Value 33
`
    const stream = asciiTableParserFactory({
      delimiter: '|',
      horizontalSeparator: '-',
      headers: false
    }, Readable.from(markdown))

    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"col_0":"Value 11", "col_1":"Value 12", "col_2":"Value 13"},
      {"col_0":"Value 21", "col_1":"Value 22", "col_2":"Value 23"},
      {"col_0":"Value 31", "col_1":"Value 32", "col_2":"Value 33"},
    ])
  })
  it('should parse tables with borders', async () => {
    const borderedTable = `+-----+-----+
| one | two |
+-----+-----+
|   1 |   4 |
|   2 |   3 |
|   3 |   2 |
|   4 |   1 |
+-----+-----+`

    const stream = asciiTableParserFactory({
      delimiter: '|',
      horizontalSeparator: '-',
      borders: true
    }, Readable.from(borderedTable))

    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"one":"1", "two": "4"},
      {"one":"2", "two": "3"},
      {"one":"3", "two": "2"},
      {"one":"4", "two": "1"},
    ])
  })

  it('should parse psql', async () => {
    const psql = `  one | two 
    -----+-----
       1 | foo
       2 | foo
       3 | foo
    (3 rows)
    
`

    const stream = asciiTableParserFactory({
      delimiter: '|'
    }, Readable.from(psql))

    const results = await completelyReadStream(stream)

    expect(results).to.deep.equal([
      {"one":"1", "two": "foo"},
      {"one":"2", "two": "foo"},
      {"one":"3", "two": "foo"},
    ])
  })
})
