import { Argument, Command, Option, program } from 'commander'
import fs from 'fs'

import {
  Metadata,
  MetadataData,
  MetadataDataData,
  UpdateMetadata,
} from '@metaplex-foundation/mpl-token-metadata'
import log from 'loglevel'

import { registerPrefix, loadConfig } from './config'
import { fatalError } from './lib/error'
import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js'
import { MetadataJson, programs, utils, actions } from '@metaplex/js'
import { Wallet } from '@project-serum/anchor'
import { mintNFT } from '@metaplex/js/lib/actions'
import { isUrl } from './lib/util'
import { validateMetadata } from './metadata'
import { findTargets, loadJson, saveJson, TargetType } from './lib/fs'

interface MintResult {
  target?: string
  txId?: string
  mint?: string
  metadata?: string
  error?: string
  name?: string
}

const mintResultToString = (result: MintResult): string => {
  if (result.error) {
    return `[error] ${result.error} ${result.target} `
  } else {
    return `[success] ${result.name}
  target: ${result.target}
  mint: ${result.mint}
  metadata: ${result.metadata}
  txId: ${result.txId}
`
  }
}

export const registerCommand = (program: Command) => {
  registerPrefix(program.command('mint'))
    .addArgument(new Argument('<targets...>', 'filepath(s), URI(s), or folder to json metadata'))
    .option('--json', 'output JSON')
    .option('--append <file>', 'append to output file')
    // .option('--ignore-errors', "don't stop on error and instead log it")
    // .option('--immutable', 'mint immutable NFTs. Default is mutable') // TODO
    .action(async (targets, options) => {
      const config = loadConfig(options)
      const { json, append, ignoreErrors, immutable } = options
      if (!targets || !targets.length) {
        fatalError('At least one metadata JSON must be speficied as an argument')
      }

      const metas: {
        path: string,
        type: TargetType
        meta?: MetadataJson
      }[] = findTargets(targets)

      const results: MintResult[] = []

      if (json && !append) {
        // try to print json as we go
        log.info('[')
      }
      for (let i = 0; i < metas.length; i++) {
        const meta = metas[i]
        const result: MintResult = {
          target: meta.path
        }
        if (meta.type === TargetType.File) {
          fatalError('file unimplemented')
        } else {
          try {
            meta.meta = await utils.metadata.lookup(meta.path)
            if (!validateMetadata(meta.meta)) {
              log.warn(`Inavlid metadata at ${meta.path}`)
              meta.meta = undefined
              result.error = 'Invalid metadata'
            }
          } catch (e) {
            log.warn(`Failed to fetch metadata at ${meta.path}`)
            result.error = 'Failed to fetch metadata'
          }
        }

        if (meta.meta) {
          try {
            const response = await actions.mintNFT({
              connection: config.connection,
              uri: meta.path,
              wallet: new Wallet(config.keypair)
            })
            result.name = meta.meta.name
            result.mint = response.mint.toBase58()
            result.metadata = response.metadata.toBase58()
            result.txId = response.txId
          } catch (e) {
            log.warn(`Failed to mint ${meta.path}`)
            result.error = 'Failed to mint'
          }
        }
        results.push(result)
        if (append) {
          const str = mintResultToString(result)
          log.info(str)
          if (!json) {
            fs.appendFileSync(append, str)
          }
        } else if (json) {
          log.info(`${JSON.stringify(result, null, 2)}${i + 1 < metas.length ? ',' : ''}`)
        } else {
          log.info(mintResultToString(result))
        }
      }
      if (json && !append) {
        // try to print json as we go
        log.info(']')
      }

      if (json && append) {
        let appendLog = []
        if (fs.existsSync(append)) {
          appendLog = loadJson(append)
        }
        saveJson(append, appendLog.concat(results))
      }
    })
}
