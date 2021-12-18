import { Argument, Command, Option, program } from 'commander'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import log from 'loglevel'
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'

import { loadConfig, registerPrefix } from './config'
import { fatalError } from './lib/error'
import { loadJson } from './lib/fs'
import { sendTransactionWithRetryWithKeypair } from './lib/transaction'


const doTransfer = async (connection: Connection, mint: string, from: Keypair, to: string | PublicKey) => {
  const rKey = new PublicKey(to)
  const token = new Token(connection, new PublicKey(mint), TOKEN_PROGRAM_ID, from)

  log.debug('Creating associated accounts')
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
          log.error(`Failed to transfer ${mint}`)
        }
      }
    })
}

const airdrop = (program: Command) => {
  registerPrefix(program.command('transfer'))
    .argument('<json>', 'JSON file for airdrop config of format: [{mint: "mmmmmm..", to: "aaaaa..."}, {...}, ...] The owner of the NFTs must be the same as the keypair provided in the env or .platyplex config')
    .action(async (json, options) => {
      const config = loadConfig(options)
      const airdrops = loadJson(json)

      if (!Array.isArray(airdrops)) {
        fatalError('Invalid airdrop config format, expect array')
      }
      for (const a of airdrops) {
        if (!a.mint || !a.to) {
          fatalError(`Invalid airdrop array item. Expected "mint" and "to" fields. Found: ${a}`)
        }
      }
      for (const a of airdrops) {
        try {
          const { txid } = await doTransfer(config.connection, a.mint, config.keypair, a.to)
          log.info(`Successfully transferred ${a.mint} from ${config.keypair.publicKey.toBase58()} to ${a.to} tx: ${txid}`)
        } catch (e) {
          log.error(`Failed to transfer ${a.mint}`)
        }
      }
    })
}

export const registerCommand = (program: Command) => {
  const tokenProgram = program.command('nft')
  transfer(tokenProgram)
}