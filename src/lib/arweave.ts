import Bundlr from '@bundlr-network/client'
import BundlrTransaction from '@bundlr-network/client/build/common/transaction'
import { Keypair } from '@solana/web3.js'
import log from 'loglevel'
import { sleep } from './util'
const { getType } = require('mime')

const LAMPORTS = 1_000_000_000

export interface DataItem {
  name: string
  data: Buffer | string
  contentType?: string
}

export interface DataItemResult extends DataItem {
  tx: BundlrTransaction
}

export const upload = async (
  payer: Keypair,
  items: DataItem[],
  rpcUrl: string,
  retries = 3
) => {
  const bundlr = new Bundlr('https://node1.bundlr.network', 'solana', payer.secretKey, {
    providerUrl: rpcUrl
  })

  const results = items.map((item) => {
    const tx = bundlr.createTransaction(item.data, {
      tags: [{
        name: 'Content-Type',
        value: item.contentType || getType(item.name)
      }]
    })
    return {
      ...item,
      tx
    }
  })

  const bytes = results.reduce((prev, item) => prev + item.tx.data.length, 0)
  const cost = await bundlr.utils.getPrice('solana', bytes)
  log.info(`${cost.toNumber() / LAMPORTS} SOL to upload`)
  await bundlr.fund(cost.toNumber())

  await Promise.all(results.map(async ({ tx }) => {
    return tx.sign()
  }))

  for (const { tx, name } of results) {
    let attempts = 0
    log.info(`uploading ${name}`)
    const uploadTransaction = async () => {
      await tx.upload().catch(async (err: Error) => {
        attempts++
        if (attempts >= retries) {
          throw err
        }

        log.warn(
          `Failed bundlr upload, automatically retrying transaction in 10s (attempt: ${attempts})`,
          err,
        )
        await sleep(10 * 1000)
        await uploadTransaction()
      })
    }

    await uploadTransaction()

  }
  return results
}

