const arguments = process.argv.splice(2)
const port = arguments[0]
const host = require('ip').address()
const address = `${host}:${port}`
module.exports = { address, port }

const crypto = require('crypto');
const { getPeers, tryAppendPeers, removePeer, getLedger, tryAppendToLedger } = require('./storage')

const express = require('express')
const app = express()
app.use(express.json())

const axios = require('axios')
axios.defaults.headers.get['Accept'] = 'application/json'
axios.defaults.headers.post['Accept'] = 'application/json'

app.listen(port, () => {
  console.log(`\r\nStarted listening on ${address}`)
})

app.get('/health', async (req, res) => res.send())

app.get('/get-peers', async (req, res) => {
  await tryAppendPeers([req.query.ip])
  const savedPeers = await getPeers()
  res.send(savedPeers)
})

app.get('/get-blocks', async (req, res) => {
  const blocks = await getLedger()
  res.send(blocks)
})

app.get('/get-blocks/:hash', async (req, res) => {
  const blocks = await getLedger(req.params['hash'])
  res.send(blocks)
})

app.get('/get-block/:hash', async (req, res) => {
  const blocks = await getLedger(hash)
  const block = blocks.find(x => x.hash == req.params['hash'])
  res.send(block)
})

app.post('/transaction', async (req, res) => {
  console.log(`\r\nReceived transaction.\r\n${JSON.stringify(req.body)}`)
  const wasSuccess = await distributeTransaction(req.body, req.query.ip)
  if (wasSuccess) {
    res.send('Added and distributed.')
    return
  }
  res.send("Ignored.")
})

async function distributeTransaction(transaction, origin) {
  // Try adding to yourself and if it's new, broadcast to all.
  const wasSuccess = await tryAppendToLedger([transaction])
  if (wasSuccess) {
    const peers = await getPeers()
    for (const node of peers.filter(x => x !== origin)) {
      console.log(`\r\nDistributing transaction ${transaction.hash} to ${node}.`)
      axios.post(`http://${node}/transaction?ip=${address}`, transaction)
        .catch((err) => onPeerError(node, err))
    }
  }
  return wasSuccess
}

// Fetch unknown connected peers on X interval.
setInterval(async () => {
  for (const node of await getPeers()) {
    axios.get(`http://${node}/get-peers?ip=${address}`)
      .then(async response => {
        const healthyNodes = []
        for (const newNode of response.data) {
          await axios.get(`http://${newNode}/health`)
            .then(() => healthyNodes.push(newNode))
        }
        await tryAppendPeers(healthyNodes)
      })
      .catch((err) => onPeerError(node, err))
  }
}, 5000);

// Fetch full ledger on X interval.
setInterval(async () => {
  for (const node of await getPeers()) {
    const url = await getLedgerEndpoint(node)
    await axios.get(url)
      .then(async (response) => await tryAppendToLedger(response.data))
      .catch((err) => onPeerError(node, err))
  }
}, 5000);

async function getLedgerEndpoint(node) {
  const ledger = await getLedger()
  let base = `http://${node}/get-blocks`
  if (ledger.length) {
    const lastHash = ledger.slice(-1)[0].hash
    base += `/${lastHash}`
  }
  return base
}

function createTransaction() {
  const payload = { timestamp: Date.now() }
  const transaction = {
    hash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    data: payload,
  }
  console.log(`\r\nCreated transaction:\r\n${JSON.stringify(transaction)}`)
  distributeTransaction(transaction)
}

// Create a new transaction on random interval, to simulate real-world.
(function loop() {
  var rand = Math.round(Math.random() * 100000) + 10000
  setTimeout(function () {
    createTransaction()
    loop();
  }, rand);
}());

function onPeerError(endpoint, error) {
  console.error(`\r\nLost connection to ${endpoint}. Removing...`)
  console.error(error)
  removePeer(endpoint)
}
