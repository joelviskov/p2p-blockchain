let pendingTransactions: Record<string, Transaction> = {}

import ip from 'ip'
export const port = process.argv.splice(2)[0]
export const host = ip.address()
export const address = `${host}:${port}`

import { generateKeyPairSync, createSign } from 'crypto'
export const sshKeys = generateKeyPairSync('ec', { namedCurve: 'sect239k1' });

import { AxiosError, AxiosResponse } from "axios"
import express, { Request as ExpressRequest, Response as ExpressResponse } from "express"
import client from "./client"
import { PeerStorage, BlockStorage } from "./storage"
import { Block, QueryParams, Transaction } from "./types"
import { createBlock, isValidChain } from './blockchain'

const app = express()

app.use(express.json())

app.listen(port, () => {
  console.log(`\r\nStarted listening on ${address}`)
})

app.get('/health', async (req: ExpressRequest, res: ExpressResponse) => res.send())

app.get('/get-peers', async (req: ExpressRequest<any, any, any, QueryParams>, res: ExpressResponse) => {
  await PeerStorage.tryAppendAsync([req.query.ip])
  const savedPeers = await PeerStorage.readAsync()
  res.send(savedPeers)
})

app.get('/get-blocks', async (req: ExpressRequest, res: ExpressResponse) => {
  const blocks = await BlockStorage.readAsync()
  res.send(blocks)
})

app.get('/get-blocks/:hash', async (req: ExpressRequest, res: ExpressResponse) => {
  const fromHash = req.params['hash']
  const blocks = await BlockStorage.readFromAsync(fromHash)
  res.send(blocks)
})

app.get('/get-block/:hash', async (req: ExpressRequest, res: ExpressResponse) => {
  const blockHash = req.params['hash']
  const blocks = await BlockStorage.readFromAsync(blockHash)
  res.send(blocks[0])
})

app.post('/transaction', async (req: ExpressRequest, res: ExpressResponse) => {
  const transaction: Transaction = req.body
  if (!transaction) {
    res.status(400).send("Bad request!")
    return
  }

  transaction.timestamp = new Date().toISOString()
  const sign = createSign('SHA256');
  sign.write('some data to sign');
  sign.end();
  const signature = sign.sign(sshKeys.privateKey, 'hex');
  pendingTransactions = { ...pendingTransactions, [signature]: transaction }
  res.send('Transaction pending.')
})

app.post('/create-block', async (req: ExpressRequest, res: ExpressResponse) => {
  if (!Object.keys(pendingTransactions).length) {
    res.send("Nothing pending.")
    return
  }

  const block = await createBlock(pendingTransactions)
  pendingTransactions = {}

  if (block) {
    client.post(`http://${address}/block?ip=${address}`, block)
    res.send('Added and distributed.')
  } else {
    res.status(400).send("Block couldn't be created.")
  }
})

app.post('/block', async (req: ExpressRequest<any, any, any, QueryParams>, res: ExpressResponse) => {
  const block = req.body
  const wasAdded = await BlockStorage.tryAppendAsync([block])
  if (wasAdded) {
    const peers = await PeerStorage.readAsync()
    for (const node of peers.filter((ip: string) => ip !== req.query.ip)) {
      client.post(`http://${node}/block?ip=${address}`, block)
        .catch((err: AxiosError) => onPeerError(node, err))
    }

    res.send('Added and distributed.')
    return
  }
  res.send("Ignored.")
})

// Fetch unknown connected peers on X interval.
setInterval(async () => {
  for (const node of await PeerStorage.readAsync()) {
    client.get(`http://${node}/get-peers?ip=${address}`)
      .then(async (response: AxiosResponse<string[]>) => {
        const healthyNodes: string[] = []
        for (const newNode of response.data) {
          await client.get(`http://${newNode}/health`)
            .then(() => healthyNodes.push(newNode))
        }
        await PeerStorage.tryAppendAsync(healthyNodes)
      })
      .catch((err: AxiosError) => onPeerError(node, err))
  }
}, 5000);

// Fetch full ledger on X interval.
setInterval(async () => {
  const endpoint = await getLedgerEndpoint()
  for (const node of await PeerStorage.readAsync()) {
    await client.get(`http://${node}/${endpoint}`)
      .then(async (response: AxiosResponse<Block[]>) => {
        await BlockStorage.tryAppendAsync(response.data)
      })
      .catch((err: AxiosError) => onPeerError(node, err))
  }
}, 5000);

const getLedgerEndpoint = async (): Promise<string> => {
  const ledger = await BlockStorage.readAsync()
  let base = `get-blocks`
  if (ledger.length) {
    if (!await isValidChain(ledger)) {
      BlockStorage.deleteFile()
      console.log('Detected corrupt ledger!')
      return base
    }
    const lastHash = ledger.slice(-1)[0].previousHash
    base += `/${lastHash}`
  }
  return base
}

const onPeerError = (peer: string, error: AxiosError) => {
  PeerStorage.remove([peer])
  console.log(`Peer error: ${error.code}`)
}