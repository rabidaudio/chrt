const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
// const asciichart = require('asciichart');
// const parseColumns = require('parse-columns');

// parserFactory is a function that takes argv and the raw data stream
// and returns a stream of record objects
const parserFactories = {
  'csv': require('./csvParser'),
  'jsonl': require('./jsonlParser'),
  'json': require('./jsonParser')
}

const argv = yargs(hideBin(process.argv))
  .group(['format'], 'Options:')
  .option('format', {
    alias: 'f',
    describe: 'The format of the incoming data',
    choices: [ ...Object.keys(parserFactories), 'tsv']
  })
  .middleware(argv => {
    if (argv.format === 'tsv') {
      return { ...argv, format: 'csv', delimiter: '\t' }
    }
    return argv
  })
  .group([
    'delimiter',
    'comment',
    'encoding',
    'escape',
    'ltrim',
    'rtrim',
    'trim',
    'skip_empty_lines',
    'skip_lines_with_error',
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

  .demandOption(['format'])
  .argv

function main() {
  const parserFactory = parserFactories[argv.format]
  const data = []
  const stream = parserFactory(argv, process.stdin)
  console.log()
  stream.on('data', d => data.push(d))
  stream.on('error', e => { throw e })
  stream.on('end', () => {
    data.forEach(console.log.bind(console))
  })
}

main()
