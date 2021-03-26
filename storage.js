const readline = require('readline');
const fs = require('fs')
const lockfile = require('proper-lockfile');
const { port, address } = require('./app')

// Contains peers of {host}:{port}
const peerFile = `connections/peers-${port}.txt`

// Contains blocks of { hash, timestamp }
const blockFile = `blocks/blocks-${port}.txt`

async function tryAppendPeers(proposed) {
  letwasSuccess = false
  let releaseCb

  await lockfile.lock(peerFile, { retries: 3, stale: 5000 })
    .then(async (release) => {
      releaseCb = release
      const knownPeers = await getPeers()
      const newPeers = proposed.filter(x => !knownPeers.includes(x) && x !== address)
      if (!newPeers.length) return false

      const join = newPeers.join('\r\n')
      const lines = knownPeers.length ? `\r\n${join}` : join
      wasSuccess = appendLines(peerFile, lines)
      release()
    })
    .catch((e) => {})
    .finally(() => {
      if (releaseCb) releaseCb().catch((err) => {})
    })

  return wasSuccess
}

async function tryAppendToLedger(proposed) {
  wasSuccess = false
  let releaseCb

  await lockfile.lock(blockFile, { retries: 3, stale: 5000 })
    .then(async (release) => {
      releaseCb = release
      const knownBlocks = await getLedger()
      const newBlocks = proposed.filter(x => !knownBlocks.some(y => y.hash === x.hash))
      if (!newBlocks.length) return false

      const join = newBlocks.map(b => JSON.stringify(b)).join('\r\n')
      const lines = knownBlocks.length ? `\r\n${join}` : join
      wasSuccess = appendLines(blockFile, lines)
      release()
    })
    .catch((e) => {})
    .finally(() => {
      if (releaseCb) releaseCb().catch((err) => {})
    })

  return wasSuccess
}

async function getLedger(fromHash = null) {
  let blocks = await readLines(blockFile, true)

  if (fromHash) {
    const fromBlock = blocks.find(x => x.hash === fromHash)
    blocks = blocks.slice(blocks.indexOf(fromBlock))
  }

  return blocks
}

async function getPeers() {
  return await readLines(peerFile)
}

function removePeer(peer) {
  fs.readFile(peerFile, { encoding: 'utf8', flag: 'r+' }, (err, data) => {
    if (err) {
      console.error(err.message)
      return
    }
    const lines = data.split('\r\n')
    const newData = lines.filter(val => val !== peer).join('\r\n')
    fs.writeFile(peerFile, newData, (err) => {
      if (err) {
        console.error(err.message)
        return
      }
    })
  })
}

async function readLines(filePath, toObjects = false) {
  const folder = filePath.split('/')[0]
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  const fileStream = fs.createReadStream(filePath, { flags: 'a+' });
  const lineStream = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const lines = []
  for await (const line of lineStream) {
    lines.push(toObjects ? JSON.parse(line) : line)
  }

  return lines
}

function appendLines(filePath, lines) {
  try {
    fs.appendFileSync(filePath, lines, { flag: 'a+' })
    console.log(`\r\nSuccessfully appended to ${filePath}\r\n${lines.trim()}.`)
    return true
  } catch {
    return false
  }
}

module.exports = { getPeers, removePeer, tryAppendPeers, getLedger, tryAppendToLedger }