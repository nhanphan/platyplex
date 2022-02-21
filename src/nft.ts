import { Argument, Command, Option, program } from 'commander'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import log from 'loglevel'
import fs from 'fs'
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'

import { loadConfig, registerPrefix } from './config'
import { fatalError } from './lib/error'
import { loadJson, saveJson, toCachePath } from './lib/fs'
import { sendTransactionWithRetryWithKeypair } from './lib/transaction'
import { exit } from 'process'

interface AirdropItem {
  mint: string
  to: string
}

interface RetryCache {
  [mint: string]: {
    to: string
    txid?: string
    date?: string
  }
}

const doTransfer = async (connection: Connection, mint: string, from: Keypair, to: string | PublicKey) => {
  const rKey = new PublicKey(to)
  const token = new Token(connection, new PublicKey(mint), TOKEN_PROGRAM_ID, from)

  log.debug('Creating associated accounts for ' + rKey, from.publicKey.toBase58())
  const toAccount = await token.getOrCreateAssociatedAccountInfo(rKey)
  const fromAccount = await token.getOrCreateAssociatedAccountInfo(from.publicKey)

  // const transaction = new Transaction().add(
  //   Token.createTransferInstruction(
  //     TOKEN_PROGRAM_ID,
  //     fromAccount.address,
  //     toAccount.address,
  //     from.publicKey,
  //     [],
  //     1
  //   )
  // )
  // log.debug('Submitting transactions')
  // return sendAndConfirmTransaction(
  //   connection,
  //   transaction,
  //   [from],
  //   {
  //     commitment: 'confirmed'
  //   }
  // )
  return sendTransactionWithRetryWithKeypair(
    connection,
    from,
    [Token.createTransferInstruction(
      TOKEN_PROGRAM_ID,
      fromAccount.address,
      toAccount.address,
      from.publicKey,
      [],
      1
    )], []
  )

}

const transfer = (program: Command) => {
  registerPrefix(program.command('transfer'))
    .argument('<recipient>', 'recipient of the NFTs')
    .requiredOption('-m, --mints <mints...>', 'mint(s) to transfer')
    .action(async (recipient, options) => {
      const { mints } = options
      const config = loadConfig(options)

      if (!mints?.length) {
        fatalError('At least one mint must be defined')
      }

      let recipientWallet

      try {
        recipientWallet = new PublicKey(recipient)
      } catch (e) {
        fatalError(`Invalid recipient: ${recipient}`, e)
      }
      const rKey = recipientWallet as PublicKey
      for (const mint of mints) {
        try {
          const { txid } = await doTransfer(config.connection, mint, config.keypair, rKey)

          log.info(`Successfully transferred ${mint} from ${config.keypair.publicKey.toBase58()} to ${recipient} tx: ${txid}`)
        } catch (e) {
          log.error(`Failed to transfer ${mint}`, e)
        }
      }
    })
}

const airdrop = (program: Command) => {
  registerPrefix(program.command('airdrop'))
    .argument('<json>', 'JSON file for airdrop config of format: [{"mint": "mmmmmm..", "to": "aaaaa..."}, {...}, ...] The current owner of the NFTs must be the same as the keypair provided in the env or .platyplex config')
    .option('--retry-cache-path <cache>', 'specify cache to retry in an idempotent manner. Default is <json> basename with "-cache.json" appended e.g. for "./dir/airdrop.json", the cache path would be "./dir/aidrop-cache.json"')
    .option('--no-retry-cache', "don't use retry cache")
    .action(async (json, options) => {
      const { retryCache } = options
      const config = loadConfig(options)
      log.info(`Loading airdrop config: ${json}`)
      const airdrops: AirdropItem[] = loadJson(json)

      if (!Array.isArray(airdrops)) {
        fatalError('Invalid airdrop config format, expect array')
      }
      for (const a of airdrops) {
        if (!a.mint || !a.to) {
          fatalError(`Invalid airdrop array item. Expected "mint" and "to" fields. Found: ${a}`)
        }
      }

      let cache: RetryCache = {}
      const retryCachePath = options.retryCachePath || toCachePath(json)
      if (retryCache) {
        log.info(`Using cache: ${retryCachePath}`)
        if (retryCachePath && fs.existsSync(retryCachePath)) {
          try {
            cache = loadJson(retryCachePath)
          } catch (e) {
            fatalError('Could not load cache')
          }
        }
      }
      let errors = 0
      for (const a of airdrops) {
        const { mint, to } = a
        cache[mint] = cache[mint] || {
          to,
          date: new Date().toISOString()
        }
        if (!cache[mint].txid) {
          try {
            const { txid } = await doTransfer(config.connection, mint, config.keypair, to)
            log.info(`Successfully transferred ${mint} from ${config.keypair.publicKey.toBase58()} to ${to} tx: ${txid}`)
            cache[mint].txid = txid
            cache[mint].date = new Date().toISOString()
            if (retryCache) {
              saveJson(retryCachePath, cache)
            }
          } catch (e) {
            log.error(`Failed to transfer ${a.mint}`)
            log.debug(e)
            errors++
          }
        }
      }
      log.info(`Completed with ${errors} errors`)

    })
}

export const registerCommand = (program: Command) => {
  const tokenProgram = program.command('nft')
  transfer(tokenProgram)
  airdrop(tokenProgram)
}