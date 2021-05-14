let pendingTransactions: Record<string, Transaction> = {}

import ip from 'ip'
export const port = process.argv.splice(2)[0]
export const host = ip.address()
export const address = `${host}:${port}`

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

app.post('/new-transaction', async (req: ExpressRequest, res: ExpressResponse) => {
  const transaction: Transaction = req.body
  if (!transaction) {
    res.status(400).send("Bad request!")
    return
  }

  transaction.timestamp = new Date().toISOString()
  const signature = Transaction.sign(transaction)
  const newTransaction: Record<string, Transaction> = { [signature]: transaction }
  pendingTransactions = { ...pendingTransactions, ...newTransaction }
  res.send('Transaction pending.')

  // Broadcast new transaction for everyone
  for (const node of await PeerStorage.readAsync()) {
    client.post(`http://${node}/transaction`, newTransaction)
      .catch((err: AxiosError) => onPeerError(node, err))
  }
})

app.post('/transaction', async (req: ExpressRequest, res: ExpressResponse) => {
  const request: Record<string, Transaction> = req.body
  for (const signature in request) {
    const transaction = request[signature]
    if (!transaction.from || Transaction.verify(signature, transaction)) {
      pendingTransactions = { ...pendingTransactions, ...request }
      res.send('Transaction accepted.')
      return
    }
  }

  res.status(400).send('Failed to verify transaction.')
})

app.post('/create-block', async (req: ExpressRequest, res: ExpressResponse) => {
  if (!Object.keys(pendingTransactions).length) {
    res.status(400).send("Nothing pending.")
    return
  }

  const ledger = await BlockStorage.readAsync()
  if (!isValidChain(ledger)) {
    res.status(400).send('Chain is corrupt and new block cannot be added.')
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
  const ourLedger = await BlockStorage.readAsync()
  const isLedgerValid = await isValidChain(ourLedger)

  let otherLedgers: Block[][] = []
  for (const node of await PeerStorage.readAsync()) {
    await client.get(`http://${node}/get-blocks`)
      .then(async (response: AxiosResponse<Block[]>) => {
        const ledger = response.data
        if (!isLedgerValid || (isValidChain(ledger) && ledger.length > ourLedger.length)) {
          otherLedgers.push(response.data)
        }
      })
      .catch((err: AxiosError) => onPeerError(node, err))
  }

  if (otherLedgers.length) {
    console.log('Found longer blockchain.')
    const longestLedger = otherLedgers.sort((a, b) => b.length - a.length)[0]
    await BlockStorage.empty()
    await BlockStorage.tryAppendAsync(longestLedger)
  }
}, 5000);

const onPeerError = (peer: string, error: AxiosError) => {
  PeerStorage.remove([peer])
  console.log(`Peer error: ${error.code}`)
}