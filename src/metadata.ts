import { Argument, Command, Option, program } from 'commander'
import util from 'util'

import { registerPrefix, loadConfig } from './config'
import { fatalError } from './lib/error'
import { PublicKey } from '@solana/web3.js'
import { MetadataJson, programs, utils } from '@metaplex/js'

const { metadata: { Metadata } } = programs

export interface PrintableMetadata extends programs.metadata.MetadataData {
  pubkey: string
  uriData?: MetadataJson
}

export const toPrintable = (metadata: programs.metadata.Metadata): PrintableMetadata => {
  return {
    pubkey: metadata.pubkey.toBase58(),
    ...metadata.toJSON().data
  }

}

export const prettyPrint = (printable: PrintableMetadata) => {
  console.log(`
${printable.data.name} (${printable.data.symbol}) ${printable.primarySaleHappened ? '[sold] ' : ''}${printable.isMutable ? '[mutable]' : ''}${printable.uriData ? ` [${printable.uriData.properties.category}]` : ''}
${printable.uriData ? `
${printable.uriData.description}

Image:       ${printable.uriData.image} ${printable.uriData.external_url ? `
ExternalUrl: ${printable.uriData.external_url}` : ''} ${printable.uriData.collection ? `
Collection:  ${printable.uriData.collection.name}, ${printable.uriData.collection.family}` : ''} 
` : ''}
URI:        ${printable.data.uri}
Pubkey:     ${printable.pubkey}
Mint:       ${printable.mint} ${printable.isMutable ? `
UpdateAuth: ${printable.updateAuthority}` : ''}`)
  if (printable.data.creators) {
    console.log(`
Creators: (${(printable.data.sellerFeeBasisPoints / 100).toFixed(2)}% fees)`)
    printable.data.creators?.forEach((c) => {
      console.log(`  ${c.address}: ${c.share} ${c.verified ? '[verified]' : ''}`)
    })
  }

  if (printable.uriData) {
    if (printable.uriData.properties.files.length) {
      console.log(`
Files:`)
      printable.uriData.properties.files.forEach((f) => {
        console.log(`  [${f.type}] ${f.uri}`)
      })

    }
    if (printable.uriData.attributes) {
      console.log(`
Attributes:`)
      printable.uriData.attributes.forEach((a) => {
        console.log(`  ${a.trait_type}: ${a.value}`)
      })
    }

  }
}

export const get = (program: Command) => {
  program.command('get')
    .option('-m, --mint <mint>', 'mint address')
    .option('-a, --address <address>', 'metadata address')
    .option('--json', 'output single line json')
    .option('--json-multiline', 'output multiline json')
    .option('--no-fetch-uri', `don't fetch and return uri data`)
    .action(async (options) => {
      const config = loadConfig(options)
      const { address, mint, json, jsonMultiline, fetchUri } = options
      if ((!mint && !address) || (mint && address)) {
        fatalError('either --address or --mint must be provided')
      }
      const addr = address ? new PublicKey(address) : await Metadata.getPDA(mint)
      try {
        const metadata = await Metadata.load(config.connection, addr)
        if (!metadata) {
          fatalError(`Token metadata not found at: ${addr.toBase58()}`)
        }
        const printable = toPrintable(metadata)
        if (fetchUri) {
          try {
            console.log('fetching', options)
            printable.uriData = await utils.metadata.lookup(printable.data.uri)
          } catch (e) {
            // ignore error
          }
        }
        if (json) {
          console.log(JSON.stringify(printable))
        } else if (jsonMultiline) {
          console.log(JSON.stringify(printable, null, 2))
        } else {
          prettyPrint(printable)
        }
      } catch (e) {
        fatalError(`Token metadata not found at: ${addr.toBase58()}`)
      }

    })
}


export const registerCommand = (program: Command) => {
  const metaProgram = program.command('metadata')
  registerPrefix(metaProgram)
  get(metaProgram)

}