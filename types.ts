import { createHash } from './utilities'
import merkle from 'merkle'

export interface Storage<T> {
  readAsync: () => Promise<T[]>
  tryAppendAsync: (objects: T[]) => Promise<boolean>
  deleteFile: () => void
}

export interface LedgerStorage extends Storage<Block> {
  readFromAsync: (fromHash: string) => Promise<Block[]>
}

export interface StringStorage extends Storage<string> {
  remove: (objects: string[]) => void
}

export interface QueryParams {
  ip: string
}

const BlockChainDifficulty = 4
const HashStart = "0".repeat(BlockChainDifficulty)

export class Block {
  index: number // Number in blockchain
  previousHash: string // Hashed value of block preceding this one
  timestamp: string // Time when block was created
  nounce: number // 
  hash: string
  merkle: string //
  transactions: Transaction[]

  constructor(index: number, transactions: Transaction[], previousHash: string) {
    this.index = index
    this.previousHash = previousHash
    this.timestamp = new Date().toISOString()
    this.transactions = transactions
    this.merkle = merkle('sha256').sync(transactions).root()
    this.nounce = 0
    this.hash = this.mine()
  }

  mine = () => {
    let computedHash = Block.createHash(this)
    while (!computedHash.startsWith(HashStart)) {
      this.nounce += 1
      computedHash = Block.createHash(this)
    }
    return computedHash
  }

  static createHash = (block: Block): string => {
    const transactions = block.transactions.map(x => `${x.from}_${x.to}_${x.amount}_${x.timestamp}`)
    const identifier = `${block.previousHash}_${block.timestamp}_${transactions}_${block.nounce}`
    return createHash(identifier)
  }
}

export interface Transaction {
  from: string
  to: string
  amount: number
  timestamp: string
}