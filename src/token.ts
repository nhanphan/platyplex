import { Argument, Command, Option, program } from 'commander'
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import log from 'loglevel'
import { PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js'

import { loadConfig, registerPrefix } from './config'
import { fatalError } from './lib/error'


const transfer = (program: Command) => {
  registerPrefix(program.command('transfer'))
    .argument('<recipient>', 'recipient of the tokens')
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
          const token = new Token(config.connection, new PublicKey(mint), TOKEN_PROGRAM_ID, config.keypair)

          log.debug('Creating associated accounts')
          const toAccount = await token.getOrCreateAssociatedAccountInfo(rKey)
          const fromAccount = await token.getOrCreateAssociatedAccountInfo(config.keypair.publicKey)

          const transaction = new Transaction().add(
            Token.createTransferInstruction(
              TOKEN_PROGRAM_ID,
              fromAccount.address,
              toAccount.address,
              config.keypair.publicKey,
              [],
              1
            )
          )
          log.debug('Submitting transactions')
          const sig = await sendAndConfirmTransaction(
            config.connection,
            transaction,
            [config.keypair],
            {
              commitment: 'confirmed'
            }
          )

          log.info(`Successfully transferred ${mint} from ${config.keypair.publicKey.toBase58()} to ${recipient} tx: ${sig}`)
        } catch (e) {
          log.error(`Failed to transfer ${mint}`)
        }
      }
    })
}

export const registerCommand = (program: Command) => {
  const tokenProgram = program.command('token')
  transfer(tokenProgram)
}