import { BlockStorage } from "./storage";
import { Block, Transaction } from "./types";
import { createVerify } from 'crypto'
import { sshKeys } from "./app";

const GenesisHash = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"

export const createBlock = async (transactions: Record<string, Transaction>): Promise<Block | null> => {
  const ledger = await BlockStorage.readAsync()
  const index = ledger.length
  const previousHash = index > 0 ? Block.createHash(ledger[index - 1]) : GenesisHash

  let legal_transactions: Transaction[] = []
  for (const signature in transactions) {
    const transaction = transactions[signature]
    if (await isLegalTransaction(signature, transaction)) {
      legal_transactions.push(transaction)
    }
  }

  if (!legal_transactions.length) {
    return null
  }
  return new Block(index, legal_transactions, previousHash)
}

const isLegalTransaction = async (signature: string, transaction: Transaction) => {
  if (!transaction.from) {
    return true // Allow creating money out of "thin air".
  }

  if (!transaction.to || transaction.amount <= 0) {
    return false
  }

  const balance = await getBalance(transaction.from)
  if (balance < transaction.amount) {
    return false
  }

  return isValidSignature(signature, transaction)
}

const isValidSignature = (signature: string, tranaction: Transaction) => {
  const verify = createVerify('SHA256');
  verify.write('some data to sign');
  verify.end();
  return verify.verify(sshKeys.publicKey, signature, 'hex')
}

const getBalance = async (subject: string): Promise<number> => {
  let balance = 0
  const ledger = await BlockStorage.readAsync()
  ledger.forEach(block => {
    block.transactions.forEach((transaction) => {
      if (transaction.from == subject) {
        balance -= transaction.amount
      }

      if (transaction.to == subject) {
        balance += transaction.amount
      }
    })
  })

  return balance
}

export const isValidChain = async (ledger: Block[]): Promise<boolean> => {
  for (var i = 1; i < ledger.length; i++) {
    const previousBlock = ledger[i - 1]
    const currentBlock = ledger[i]

    if (currentBlock.hash != Block.createHash(currentBlock)) {
      return false
    }

    if (currentBlock.previousHash != previousBlock.hash) {
      return false
    }
  }

  return true
}