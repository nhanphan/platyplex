import { Argument, Command, Option, program } from 'commander'
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import { URL } from 'url'
import util from 'util'
import {
  Metadata,
  MetadataData,
  MetadataDataData,
  UpdateMetadata,
} from '@metaplex-foundation/mpl-token-metadata'

import { registerPrefix, loadConfig } from './config'
import { fatalError } from './lib/error'
import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js'
import { MetadataJson, programs, utils, actions } from '@metaplex/js'
import { exit } from 'process'
import { Wallet } from '@project-serum/anchor'

export interface PrintableMetadata extends MetadataData {
  pubkey: string
  uriData?: MetadataJson
  owner?: string
}

export const toPrintable = (metadata: Metadata, metaJson?: MetadataJson, owner?: string): PrintableMetadata => {
  return {
    pubkey: metadata.pubkey.toBase58(),
    ...metadata.toJSON().data,
    uriData: metaJson,
    owner
  }
}

export const getOwner = async (connection: Connection, mint: string) => {
  const p = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: [{
      dataSize: 165
    },
    {
      memcmp: {
        offset: 0,
        bytes: mint
      }
    }]
  })
  let owner: any = null
  p.forEach((pp) => {
    const { owner: o, tokenAmount } = (pp.account.data as ParsedAccountData).parsed.info
    if (tokenAmount.amount > 0) {
      owner = o
    }
  })
  return owner
}

export const prettyPrint = (printable: PrintableMetadata) => {
  console.log(`
${printable.data.name} (${printable.data.symbol}) ${printable.primarySaleHappened ? '[sold] ' : ''}${printable.isMutable ? '[mutable]' : ''}${printable.uriData ? ` [${printable.uriData.properties.category}]` : ''}
${printable.uriData ? `
${printable.uriData.description}

Image:       ${printable.uriData.image} ${printable.uriData.external_url ? `
ExternalUrl: ${printable.uriData.external_url}` : ''} ${printable.uriData.collection ? `
Collection:  ${printable.uriData.collection.name}, ${printable.uriData.collection.family}` : ''} 
` : ''} ${printable.owner ? `
Owner:      ${printable.owner}` : ''}
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

const validateMetadata = (metadata: MetadataJson) => {
  if (!metadata.name) {
    console.error('invalid name')
    return false
  }
  if (!metadata.image) {
    console.error('invalid image')
    return false
  }
  if (!metadata.properties) {
    console.error('no properties found')
    return false
  }
  if (isNaN(metadata.seller_fee_basis_points)) {
    console.error('invalid seller_fee_basis_points')
    return false
  }
  if (!Array.isArray(metadata.properties.creators)) {
    console.error('invalid creators')
    return false
  }

  const metaCreators = metadata.properties.creators
  if (
    metaCreators.some(creator => !creator.address) ||
    metaCreators.reduce((sum, creator) => creator.share + sum, 0) !== 100
  ) {
    console.error('invalid creator share sum or address')
    return false
  }

  return true
}

const stringIsAValidUrl = (s: string) => {
  try {
    new URL(s)
    return true
  } catch (err) {
    return false
  }
}

export const get = (program: Command) => {
  registerPrefix(program.command('get'))
    .option('-m, --mint <mint>', 'mint address')
    .option('-a, --address <address>', 'metadata address')
    .option('--json', 'output single line json')
    .option('--json-multiline', 'output multiline json')
    .option('--no-fetch-uri', `don't fetch and return uri data`)
    .option('--fetch-owner', `fetch owner of NFT`)
    .action(async (options) => {
      const config = loadConfig(options)
      const { address, mint, json, jsonMultiline, fetchUri, fetchOwner } = options
      if ((!mint && !address) || (mint && address)) {
        fatalError('either --address or --mint must be provided')
      }
      const addr = address ? new PublicKey(address) : await Metadata.getPDA(mint)
      try {
        const metadata = await Metadata.load(config.connection, addr)
        if (!metadata) {
          fatalError(`Token metadata not found at: ${addr.toBase58()}`)
        }
        let uriData
        if (fetchUri) {
          try {
            uriData = await utils.metadata.lookup(metadata.data.data.uri)
          } catch (e) {
            // ignore error
          }
        }
        let owner
        if (fetchOwner) {
          owner = await getOwner(config.connection, metadata.data.mint)
        }

        const printable = toPrintable(metadata, uriData, owner)

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

export const update = (program: Command) => {
  registerPrefix(program.command('update'))
    .argument('<json>', 'Path to metadata json or url where the metadata is hosted')
    .option('-m, --mint <mint>', 'mint address')
    .option('-a, --address <address>', 'metadata address')
    .option('--no-details', 'hide metadata before/after')
    .option('--new-update-authority <pubkey>', 'change to a new update authority')
    .addOption(new Option('--upload-provider <provider>', 'storage provider if a local filepath is specified for the metadata json').choices(['arweave']))
    .addHelpText('before', `
Update a mutable Token Metadata. WARNING gas/upload fees will apply!
    `)
    .action(async (uri, options) => {
      const config = loadConfig(options)
      const { address, mint, uploadProvider, details, newUpdateAuthority } = options
      if ((!mint && !address) || (mint && address)) {
        fatalError('either --address or --mint must be provided')
      }
      const addr = address ? new PublicKey(address) : await Metadata.getPDA(mint)
      let metadata
      try {
        metadata = await Metadata.load(config.connection, addr)
      } catch (e) {
        fatalError(`Token metadata not found at: ${addr.toBase58()}`)
      }
      if (!metadata) {
        fatalError(`Token metadata not found at: ${addr.toBase58()}`)
        exit(1) // get rid of annoying type errors
      }
      if (details) {
        const oldMetaJson = await utils.metadata.lookup(metadata.data.data.uri)
        console.log('----------------- old meta --------------')
        prettyPrint(toPrintable(metadata, oldMetaJson))
      }
      let url = uri
      if (!stringIsAValidUrl(uri)) {
        // todo do upload
      }

      const newMeta = await utils.metadata.lookup(url)
      if (!validateMetadata(newMeta)) {
        fatalError(`Invalid JSON metadata at ${url}`)
      }

      if (details) {
        console.log('----------------- new meta --------------')
        console.log(util.inspect(newMeta))
      }
      const data = new MetadataDataData({
        creators: newMeta.properties.creators,
        symbol: newMeta.symbol,
        uri: url,
        sellerFeeBasisPoints: newMeta.seller_fee_basis_points,
        name: newMeta.name,
      })

      const wallet = new Wallet(config.keypair)
      const updateTx = new UpdateMetadata(
        { feePayer: wallet.publicKey },
        {
          metadata: addr,
          updateAuthority: wallet.publicKey,
          metadataData: data,
          newUpdateAuthority,
          // TODO primarySaleHappened?
        }
      )
      try {
        const tx = await actions.sendTransaction({
          connection: config.connection,
          signers: [],
          txs: [updateTx],
          wallet,
        })

        try {
          await config.connection.confirmTransaction(tx, 'confirmed')
        } catch { }
        // force wait for confirmation
        await config.connection.confirmTransaction(tx, 'confirmed')
        console.info(`metadata updated. mint: ${metadata.data.mint} metaAddr: ${address} tx: ${tx}`)
      } catch (e) {
        console.error(e)
        fatalError('Update transaction failed')
      }

    })
}

export const list = (program: Command) => {
  registerPrefix(program.command('update'))
    .option('--mint-only', 'list only mints')
    .action(async (options) => {
      const config = loadConfig(options)
    })
}

export const registerCommand = (program: Command) => {
  const metaProgram = program.command('metadata')
  get(metaProgram)

}