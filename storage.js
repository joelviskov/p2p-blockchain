const readline = require('readline');
const fs = require('fs')
const { port, address } = require('./app')

const file = `connections/peers-${port}.txt`

async function readPeers() {
  if (!fs.existsSync('connections')){
    fs.mkdirSync('connections');
  }

  const fileStream = fs.createReadStream(file, { flags: 'a+' });
  const lines = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const peers = []
  for await (const peer of lines) {
    peers.push(peer)
  }

  return peers
}

function removePeer(peer) {
  fs.readFile(file, { encoding: 'utf8', flag: 'r+' }, (err, data) => {
    if (err) throw err
    const lines = data.split('\r\n')
    const newData = lines.filter(val => val !== peer).join('\r\n')
    fs.writeFile(file, newData, (err) => {
      if (err) throw err
    })
  })
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

async function tryAppendPeers(proposed) {
  if (!proposed.length) return

  const knownPeers = await readPeers()
  proposed = [...proposed, ...knownPeers].filter(onlyUnique)
  proposed = proposed.filter(x => x !== address)

  fs.writeFile(file, proposed.join('\r\n'), (err) => {
    if (err) throw err
  })
}

module.exports = { readPeers, removePeer, tryAppendPeers }