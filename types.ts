import { createHash } from './utilities'
import merkle from 'merkle'
import { createSign, createVerify, generateKeyPairSync } from 'crypto'

export const {
  privateKey: privateKeyObject,
  publicKey: publicKeyObject,
} = generateKeyPairSync('ec', { namedCurve: 'sect239k1' });

export const publicKey = publicKeyObject.export({ format: 'pem', type: 'spki' }).toString()
console.log(`\n${JSON.stringify(publicKey)}`)

export interface Storage<T> {
  readAsync: () => Promise<T[]>
  tryAppendAsync: (objects: T[]) => Promise<boolean>
  empty: () => void
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

const BlockChainDifficulty = 5
const HashStart = "0".repeat(BlockChainDifficulty)

export class Block {
  index: number // Number in blockchain
  previousHash?: string // Hashed value of block preceding this one
  timestamp: string // Time when block was created
  nounce: number // 
  hash: string
  merkle: string //
  transactions: Transaction[]
  creator: string

  constructor(index: number, transactions: Transaction[], previousHash?: string) {
    this.index = index
    this.previousHash = previousHash
    this.timestamp = new Date().toISOString()
    this.transactions = transactions
    this.merkle = merkle('sha256').sync(transactions).root()
    this.nounce = 0
    this.hash = this.mine()
    this.creator = publicKey
  }

  private mine = () => {
    let computedHash = createHash(Block.stringify(this))
    while (!computedHash.startsWith(HashStart)) {
      this.nounce += 1
      computedHash = createHash(Block.stringify(this))
    }
    return computedHash
  }


  static stringify = (block: Block): string => {
    const transactions = block.transactions.map(x => Transaction.stringify(x))
    return `${block.previousHash}_${block.timestamp}_${transactions}_${block.nounce}`
  }
}

export class Transaction {
  from: string
  to: string
  amount: number
  timestamp: string

  constructor(from: string, to: string, amount: number, timestamp: string) {
    this.from = from
    this.to = to
    this.amount = amount
    this.timestamp = timestamp
  }

  static stringify = (transaction: Transaction): string => {
    return `${transaction.from}_${transaction.to}_${transaction.amount}_${transaction.timestamp}`
  }

  static sign = (transaction: Transaction): string => {
    const sign = createSign('SHA256');
    sign.write(Transaction.stringify(transaction));
    sign.end();
    return sign.sign(privateKeyObject, 'hex');
  }

  static verify = (signature: string, transaction: Transaction) => {
    const verify = createVerify('SHA256');
    verify.write(Transaction.stringify(transaction));
    verify.end();
    return verify.verify(transaction.from, signature, 'hex')
  }
}