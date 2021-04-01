const arguments = process.argv.splice(2)
const port = arguments[0]
const host = require('ip').address()
const address = `${host}:${port}`
module.exports = { host, address, port }

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
  const fromHash = req.params['hash']
  const blocks = await getLedger(fromHash)
  res.send(blocks)
})

app.get('/get-block/:hash', async (req, res) => {
  const blockHash = req.params['hash']
  const blocks = await getLedger(blockHash)
  res.send(blocks[0])
})

app.post('/transaction', async (req, res) => {
  const transactions = req.body
  const block = await createBlock(transactions)
  axios.post(`http://${address}/block?ip=${address}`, block).catch((err) => onPeerError(node, err))
  res.send('Added and distributed.')
})

app.post('/block', async (req, res) => {
  const block = req.body
  const wasAdded = await tryAppendToLedger([block])
  if (wasAdded) {
    const peers = await getPeers()
    for (const node of peers.filter(x => x !== req.query.ip)) {
      axios.post(`http://${node}/block?ip=${address}`, block)
        .catch((err) => onPeerError(node, err))
    }

    res.send('Added and distributed.')
    return
  }
  res.send("Ignored.")
})

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
  const endpoint = await getLedgerEndpoint()
  for (const node of await getPeers()) {
    await axios.get(`http://${node}/${endpoint}`)
      .then(async (response) => await tryAppendToLedger(response.data))
      .catch((err) => onPeerError(node, err))
  }
}, 5000);

async function getLedgerEndpoint() {
  const ledger = await getLedger()
  let base = `get-blocks`
  if (ledger.length) {
    const lastHash = ledger.slice(-1)[0].previousHash
    base += `/${lastHash}`
  }
  return base
}

async function createBlock(transactions) {
  const ledger = await getLedger()
  const index = ledger.length
  return {
    index,
    previousHash: index > 0 ? hash(ledger[index - 1]) : null,
    transactions,
    timestamp: Date.now()
  }
}

function hash(block) {
  return crypto.createHash('sha256').update(JSON.stringify(block)).digest('hex')
}

function onPeerError(endpoint, error) {
  removePeer(endpoint)
}
