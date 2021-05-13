import crypto from 'crypto'
import readline from 'readline'
import fs from 'fs'

export const createHash = (object: string) => {
  return crypto.createHash('sha256').update(object).digest('hex').toUpperCase()
}

export const readObjectLines = async <T>(filePath: string): Promise<T[]> => {
  const fileStream = fs.createReadStream(filePath, { flags: 'a+' });
  const lineStream = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const lines: T[] = []
  for await (const line of lineStream) {
    lines.push(JSON.parse(line))
  }

  return lines
}

export const readStringLines = async (filePath: string): Promise<string[]> => {
  const fileStream = fs.createReadStream(filePath, { flags: 'a+' });
  const lineStream = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const lines: string[] = []
  for await (const line of lineStream) {
    lines.push(line)
  }

  return lines
}

export const appendLines = (filePath: string, lines: string): boolean => {
  try {
    fs.appendFileSync(filePath, lines, { flag: 'a+' })
    return true
  } catch {
    return false
  }
}