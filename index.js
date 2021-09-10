const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const asciichart = require('asciichart')

const LimitTransform = require('./limit')

// parserFactory is a function that takes argv and the raw data stream
// and returns a stream of record objects
const parserFactories = {
  csv: require('./csvParser'),
  jsonl: require('./jsonlParser'),
  json: require('./jsonParser'),
  ascii: require('./asciiTableParser')
  // TODO: fixed width tables
}

const argv = yargs(hideBin(process.argv))
  .group(['format'], 'Options:')
  .option('format', {
    alias: 'f',
    describe: 'The format of the incoming data',
    choices: [...Object.keys(parserFactories), 'tsv', 'md', 'psql']
  })
  .demandOption(['format']) // TODO: auto-detect
  .middleware(argv => {
    // higher-order parsers
    if (argv.format === 'tsv') {
      return { ...argv, format: 'csv', delimiter: '\t' }
    }
    if (argv.format === 'md') {
      return { ...argv, format: 'ascii', delimiter: '|', horizontalSeparator: '-' }
    }
    if (argv.format === 'psql') {
      return { ...argv, format: 'ascii', delimiter: '|' }
    }
    return argv
  })

  .group(['xaxis', 'series', 'sort'], 'Axis Options')
  .option('xaxis', {
    alias: 'x',
    describe: 'The column to use as the independent variable. If not supplied, the axis is assumed to be the row index. Can be the column name or the column index.'
  })
  .option('series', {
    alias: 'y',
    describe: 'The column(s) to use as the dependant variable. Defaults to all numeric columns. Can be the column name or the column index.',
    type: 'array'
  })
  .option('sort', {
    alias: 's',
    describe: 'Sort the data by the independent variable. Only applicable if an xaxis is supplied.',
    type: 'boolean',
    default: false
    // implies: 'xaxis' // breaks with default
  })

  .group(['height', 'offset', 'padding', 'colors'], 'Display Options:')
  .option('width', {
    alias: 'w',
    describe: 'The maximum width of the graph. Actual width is determined by the amount of data. Additional data points will be truncated. Defaults to terminal width.',
    default: process.stdout.columns
  })
  .option('height', {
    alias: 'h',
    describe: 'The height of the graph. Defaults to terminal height.',
    default: process.stdout.rows - 1
  })
  .option('colors', {
    alias: 'c',
    type: 'array',
    choices: [
      'black',
      'red',
      'green',
      'yellow',
      'blue',
      'magenta',
      'cyan',
      'lightgray',
      'default',
      'darkgray',
      'lightred',
      'lightgreen',
      'lightyellow',
      'lightblue',
      'lightmagenta',
      'lightcyan',
      'white'
    ]
  })
  .middleware(argv => {
    // can't use coerce for this because it runs before choices
    if (argv.colors !== undefined) {
      return { ...argv, colors: argv.colors.map(c => asciichart[c]) }
    }
    return argv
  })

  .group(['delimiter', 'borders', 'horizontal_separator'], 'ASCII Table Parser:')
  .boolean('borders')
  .boolean('headers')
  .default('headers', true)
  .option('horizontal_separator')

  .group([
    'delimiter',
    'comment',
    'encoding',
    'escape',
    'ltrim',
    'rtrim',
    'trim',
    'skip_empty_lines',
    'skip_lines_with_error'
  ], 'CSV Parser:')
  .option('delimiter')
  .option('comment')
  .option('encoding')
  .option('escape')
  .boolean('ltrim')
  .boolean('rtrim')
  .boolean('trim')
  .boolean('skip_empty_lines')
  .boolean('skip_lines_with_error')
  .default('skip_empty_lines', true)

  .argv

function main () {
  const parserFactory = parserFactories[argv.format]
  const rows = []
  let stream = parserFactory(argv, process.stdin)

  if (argv.width) {
    stream = stream.pipe(new LimitTransform(argv.width))
  }

  stream.on('data', d => rows.push(d))
  stream.on('error', e => { throw e })
  stream.on('end', () => draw(rows))
}

function draw (rows) {
  if (rows.length === 0) {
    console.error('No data to display.')
    process.exit(1)
  }
  let columns = Object.keys(rows[0])
  if (columns.length === 0) {
    console.error('No columns to display.')
    process.exit(1)
  }
  if (argv.xaxis !== undefined) {
    const index = findColumnIndex(columns, argv.xaxis)
    if (index === null) {
      console.error(`Unknown xaxis column: '${argv.xaxis}'. Columns: ${columns.join(', ')}`)
      process.exit(1)
    }
    const xaxis = columns.splice(index, 1)[0]
    if (argv.sort) {
      rows.sort(sortByColumn(xaxis))
    }
  }

  if (argv.series !== undefined) {
    columns = argv.series.map(s => {
      const index = findColumnIndex(columns, s)
      if (index === null) {
        console.error(`Unknown series column: '${s}'. Columns: ${columns.join(', ')}`)
        process.exit(1)
      }
      return columns[index]
    })
  } else {
    // assume all columns which can be cast to numbers
    columns = columns.filter(c => isFinite(parseFloat(rows[0][c])))
  }

  // after filtering, we need to check again if there are still columns
  if (columns.length === 0) {
    console.error('No columns to display.')
    process.exit(1)
  }

  // TODO: breakdown, allowing a column to be used as a series selector

  const data = columns.reduce((data, column) => ({ [column]: [], ...data }), {})
  for (const rowIndex in rows) {
    for (const column of columns) {
      const value = parseFloat(rows[rowIndex][column])
      if (!isFinite(value)) {
        console.error(`Invalid value in column '${column}' of row ${rowIndex}: '${rows[rowIndex][column]}' (coerced to ${value})`)
        process.exit(1)
      }
      data[column].push(value)
    }
  }

  // TODO: show graph in ncurses so you can scroll through
  console.log(asciichart.plot(Object.values(data), {
    height: argv.height,
    colors: argv.colors
  }))
}

function findColumnIndex (columns, value) {
  const index = columns.indexOf(value)
  if (index > -1) {
    return index
  }
  const asIndex = parseInt(value, 10)
  if (isFinite(asIndex) && asIndex >= 0 && asIndex < columns.length) {
    return asIndex
  }
  return null
}

function sortByColumn (column) {
  return (a, b) => {
    const aval = a[column]
    const bval = b[column]
    if (aval < bval) {
      return -1
    }
    if (aval > bval) {
      return 1
    }
    return 0
  }
}

main()
