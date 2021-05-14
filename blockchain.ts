import { BlockStorage } from "./storage";
import { Block, Transaction } from "./types";
import { createHash } from "./utilities";

export const createBlock = async (transactions: Record<string, Transaction>): Promise<Block | null> => {
  const ledger = await BlockStorage.readAsync()
  const index = ledger.length
  const previousHash = index > 0 ? createHash(Block.stringify(ledger[index - 1])) : undefined

  let legal_transactions: Transaction[] = []
  for (const signature in transactions) {
    const transaction = transactions[signature]
    if (ledger.some(b => b.transactions.some(t => t == transaction))) {
      continue // Don't add transactions that are already in the blockchain.
    }

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

  return Transaction.verify(signature, transaction)
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

    if (currentBlock.hash != createHash(Block.stringify(currentBlock))) {
      return false
    }

    if (currentBlock.previousHash != previousBlock.hash) {
      return false
    }
  }

  return true
}