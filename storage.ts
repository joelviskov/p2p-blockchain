import fs from 'fs'
import lockfile from 'proper-lockfile'
import { address, host, port } from "./app"
import { Block, LedgerStorage, StringStorage } from "./types"
import { appendLines, readObjectLines, readStringLines } from "./utilities"

const peerFile = `connections/peers-${port}.txt`
const blockFile = `blocks/blocks-${port}.txt`
const masterNode = `${host}:3000`

const tryAppendPeers = async (objects: string[]): Promise<boolean> => {
  let wasAdded: boolean = false
  let releaseCb: Function

  await lockfile.lock(peerFile, { retries: 3, stale: 5000 })
    .then(async (release: Function) => {
      releaseCb = release
      const knownPeers = await getPeers()
      const newPeers = objects.filter(x => !knownPeers.includes(x) && x !== address)
      if (!newPeers.length) return false

      const join = newPeers.join('\r\n')
      wasAdded = appendLines(peerFile, knownPeers.length ? `\r\n${join}` : join)
    })
    .catch((e: Error) => { })
    .finally(() => {
      if (releaseCb) {
        releaseCb().catch((err: Error) => { })
      }
    })

  return wasAdded
}

const tryAppendBlocks = async (objects: Block[]): Promise<boolean> => {
  let wasSuccess: boolean = false
  let releaseCb: Function

  await lockfile.lock(blockFile, { retries: 3, stale: 5000 })
    .then(async (release: Function) => {
      releaseCb = release
      const knownBlocks = await getBlocks()
      const newBlocks = objects.filter((b: Block) => !knownBlocks.some((y: Block) => y.previousHash === b.previousHash))
      if (!newBlocks.length) return false

      const join = newBlocks.map(b => JSON.stringify(b)).join('\r\n')
      wasSuccess = appendLines(blockFile, knownBlocks.length ? `\r\n${join}` : join)
    })
    .catch((e: Error) => { })
    .finally(() => {
      if (releaseCb) releaseCb().catch((err: Error) => { })
    })

  return wasSuccess
}

const getBlocks = async (): Promise<Block[]> => {
  const folder = blockFile.split('/')[0]
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  return await readObjectLines<Block>(blockFile)
}

const getBlocksFromHash = async (fromHash = ''): Promise<Block[]> => {
  let blocks = await getBlocks()

  if (fromHash) {
    const fromBlock = blocks.find(x => x.previousHash === fromHash) as Block
    const fromIndex = blocks.indexOf(fromBlock) - 1
    blocks = blocks.slice(fromIndex)
  }

  return blocks
}

const getPeers = async (): Promise<string[]> => {
  const folder = peerFile.split('/')[0]
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder)
  }

  if (!fs.existsSync(peerFile)) {
    if (address !== masterNode) {
      appendLines(peerFile, masterNode)
    }
  }

  return await readStringLines(peerFile)
}

const removePeers = async (toRemove: string[]) => {
  let releaseCb: Function

  await lockfile.lock(peerFile, { retries: 3, stale: 5000 })
    .then(async (release: Function) => {
      releaseCb = release
      const existingPeers = await getPeers()
      const newPeers = existingPeers.filter(peer => !toRemove.includes(peer))
      fs.writeFile(peerFile, newPeers.join('\r\n'), () => { })
    })
    .catch((e: Error) => { })
    .finally(() => {
      if (releaseCb) {
        releaseCb().catch((err: Error) => { })
      }
    })
}

const emptyFile = (pathName: string) => {
  fs.writeFile(pathName, '', () => { /* Ignore */ })
}

export const PeerStorage: StringStorage = {
  readAsync: getPeers,
  tryAppendAsync: tryAppendPeers,
  remove: removePeers,
  empty: () => emptyFile(peerFile),
}

export const BlockStorage: LedgerStorage = {
  readAsync: getBlocks,
  readFromAsync: getBlocksFromHash,
  tryAppendAsync: tryAppendBlocks,
  empty: () => emptyFile(blockFile),
}