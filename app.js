const arguments = process.argv.splice(2)
const port = arguments[0]
const host = require('ip').address()
const address = `${host}:${port}`
module.exports = { address, port }

const express = require('express')
const http = require('http')
const { readPeers, tryAppendPeers, removePeer } = require('./storage')

const app = express()

app.listen(port, () => {
  console.log(`Started listening on ${address}`)
})

app.get('/health', async (req, res) => res.send())

app.get('/get-peers', async (req, res) => {
  tryAppendPeers([req.query.callback])
  res.send(await readPeers())
})

async function fetchPeers(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://${endpoint}/get-peers?callback=${address}`, (res) => {
      var body = [];
      res.on('data', (chunk) => {
        body.push(chunk);
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(body).toString()));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', () => onPeerError(endpoint))
  })
}

// Fetch unknown connected peers on X interval.
setInterval(async () => {
  const knownPeers = await readPeers()
  for (const endpoint of knownPeers) {
    fetchPeers(endpoint)
      .then(res => {
        tryAppendPeers(res)
      })
  }
}, 10000);

// Perform healthcheck and remove unavailable peers.
setInterval(async () => {
  const knownPeers = await readPeers()
  for (const endpoint of knownPeers) {
    http.get(`http://${endpoint}/health`)
      .on('error', () => onPeerError(endpoint))
  }
}, 5000);

function onPeerError(endpoint) {
  console.log(`Error while fetching peers from ${endpoint}. Removing...`)
  removePeer(endpoint)
}
