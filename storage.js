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

function appendPeers(peers) {
  if (!peers.length) return
  const data = peers.filter(x => x !== address).join('\r\n') + '\r\n'
  fs.appendFile(file, data, { flag: 'a+' }, (err) => {
    if (err) throw err
  })
}

module.exports = { readPeers, removePeer, appendPeers }