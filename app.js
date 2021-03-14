
const arguments = process.argv.splice(2)
const port = arguments[0]
const host = 'localhost'
const address = `${host}:${port}`
module.exports = { address, port }

const express = require('express')
const http = require('http')
const { readPeers, appendPeers, removePeer } = require('./storage')



const app = express()

app.listen(port, () => {
  console.log(`Started listening on ${address}`)
})

app.get('/health', async (req, res) => res.send())

app.get('/get-peers', async (req, res) => {
  res.send(await readPeers())
})

async function fetchPeers(endpoint) {
  return new Promise((resolve, reject) => {
    http.get(`http://${endpoint}/get-peers`, (res) => {
      var body = [];
      res.on('data', function (chunk) {
        body.push(chunk);
      });

      res.on('end', function () {
        try {
          resolve(JSON.parse(Buffer.concat(body).toString()));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (error) => {
      console.log(`Error while fetching peers from ${endpoint}.`)
    })
  })
}

// Fetch unknown connected peers on X interval.
setInterval(async () => {
  const knownPeers = await readPeers()
  for (const endpoint of knownPeers) {
    const response = await fetchPeers(endpoint)
    const unkownPeers = response.filter(x => !knownPeers.includes(x) && x !== address)
    if (!!unkownPeers.length) {
      appendPeers(unkownPeers)
    }
  }
}, 10000);

// Perform healthcheck and remove unavailable peers.
setInterval(async () => {
  const knownPeers = await readPeers()
  for (const endpoint of knownPeers) {
    http.get(`http://${endpoint}/health`).on('error', (error) => {
      console.log(`Error while fetching peers from ${endpoint}. Removing...`)
      removePeer(endpoint)
    })
  }
}, 5000);
