import { Argument, Command, Option, program } from 'commander'
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import util from 'util'
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
import { exit } from 'process'
import { Wallet } from '@project-serum/anchor'
import { isUrl } from './lib/util'

export interface PrintableMetadata extends MetadataData {
  pubkey: string
  uriData?: MetadataJson
  owner?: string
}

export const fetchPrintable = (connection: Connection, metadata: Metadata, uri?: boolean, owner?: boolean): Promise<PrintableMetadata> => {
  const promises = []
  if (uri) {
    promises.push(utils.metadata.lookup(metadata.data.data.uri))
  }
  if (owner) {
    promises.push(getOwner(connection, metadata.data.mint))
  }

  return Promise.all(promises).then((res) => {
    const [uriData, o] = res
    return {
      pubkey: metadata.pubkey.toBase58(),
      ...metadata.toJSON().data,
      uriData,
      owner: o
    }
  })
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
  log.info(`
${printable.data.name} ${printable.data.symbol ? `(${printable.data.symbol}) ` : ''}${printable.primarySaleHappened ? '[sold] ' : ''}${printable.isMutable ? '[mutable]' : ''}${printable.uriData ? ` [${printable.uriData.properties.category}]` : ''}
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
    log.info(`
Creators: (${(printable.data.sellerFeeBasisPoints / 100).toFixed(2)}% fees)`)
    printable.data.creators?.forEach((c) => {
      log.info(`  ${c.address}: ${c.share} ${c.verified ? '[verified]' : ''}`)
    })
  }

  if (printable.uriData) {
    if (printable.uriData.properties.files?.length) {
      log.info(`
Files:`)
      printable.uriData.properties.files.forEach((f) => {
        log.info(`  [${f.type}] ${f.uri}`)
      })

    }
    if (printable.uriData.attributes) {
      log.info(`
Attributes:`)
      printable.uriData.attributes.forEach((a) => {
        log.info(`  ${a.trait_type}: ${a.value}`)
      })
    }

  }
}

export const validateMetadata = (metadata: MetadataJson) => {
  if (!metadata.name) {
    log.error('invalid name')
    return false
  }
  if (!metadata.image) {
    log.error('invalid image')
    return false
  }
  if (!metadata.properties) {
    log.error('no properties found')
    return false
  }
  if (isNaN(metadata.seller_fee_basis_points)) {
    log.error('invalid seller_fee_basis_points')
    return false
  }
  if (!Array.isArray(metadata.properties.creators)) {
    log.error('invalid creators')
    return false
  }

  const metaCreators = metadata.properties.creators
  if (
    metaCreators.some(creator => !creator.address) ||
    metaCreators.reduce((sum, creator) => creator.share + sum, 0) !== 100
  ) {
    log.error('invalid creator share sum or address')
    return false
  }

  return true
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

        const printable = await fetchPrintable(config.connection, metadata, fetchUri, fetchOwner)

        if (json) {
          log.info(JSON.stringify(printable))
        } else if (jsonMultiline) {
          log.info(JSON.stringify(printable, null, 2))
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
    // TODO update auth only
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
        log.info('----------------- old meta --------------')
        prettyPrint(await fetchPrintable(config.connection, metadata, details))
      }
      let url = uri
      if (!isUrl(uri)) {
        // todo do upload
        fatalError('unimplemented')
      }

      const newMeta = await utils.metadata.lookup(url)
      if (!validateMetadata(newMeta)) {
        fatalError(`Invalid JSON metadata at ${url}`)
      }

      if (details) {
        log.info('----------------- new meta --------------')
        log.info(util.inspect(newMeta))
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
        log.error(e)
        fatalError('Update transaction failed')
      }

    })
}

export const list = (program: Command) => {
  registerPrefix(program.command('list'))
    .option('-m, --mint-list <pubkeys...>', 'find by mint list')
    .option('-o, --owner <pubkey>', 'find by owner')
    .option('-c, --creators <pubkey...>', 'find by creator (can be slow)')
    .option('--mint-only', 'output only mints')
    .option('--fetch-owner', 'fetch owner for output')
    .option('--no-fetch-uri', "don't fetch uri metadata for output")
    .option('--json', 'output json')
    .action(async (options) => {
      const config = loadConfig(options)
      const { mintOnly, owner, creators, mintList, fetchOwner, fetchUri, json } = options

      const filterCount = ['creators', 'mintList', 'owner'].reduce((prev, curr, i) => {
        return prev + (options[curr] ? 1 : 0)
      }, 0)

      if (filterCount !== 1) {
        fatalError('exactly one of: owner, creators list or mint list, must be specified')
      }
      let metas
      if (owner) {
        try {
          metas = await Metadata.findByOwnerV2(config.connection, new PublicKey(owner))
        } catch (e) {
          fatalError(`Could not get metadata for owner: ${owner}`)
        }
      }
      if (creators) {
        try {
          metas = await Metadata.findMany(config.connection, {
            creators
          })
        } catch (e) {
          fatalError(`Could not get metadata for creators: ${creators}`)
        }
      }
      if (mintList) {
        try {
          // TODO batch  requests
          const metas = Promise.all(mintList.map(async (mint: string) => {
            const addr = await Metadata.getPDA(mint)
            return Metadata.load(config.connection, addr)
          }))

        } catch (e) {
          fatalError(`Could not get metadata for owner: ${owner}`)
        }
      }
      const metaList = metas as Metadata[]
      if (mintOnly) {
        if (fetchOwner) {
          const res = await Promise.all(metaList.map(async (meta) => {
            const mint = meta.data.mint
            const o = await getOwner(config.connection, mint)
            return [mint, o, meta.data.data.name]
          }))
          const ownerMap: { [o: string]: string[][] } = {}
          res.forEach((r) => {
            const [mint, o, name] = r
            ownerMap[o] = ownerMap[o] || []
            ownerMap[o].push([mint, name])
          })
          if (json) {
            log.info(JSON.stringify(ownerMap))
          } else {
            Object.keys(ownerMap).forEach((o) => {
              log.info(`owner: ${o}`)
              ownerMap[o].forEach(([mint, name]) => {
                log.info(`  ${mint} ${name}`)
              })
            })
          }
        } else {
          if (json) {
            log.info(JSON.stringify(metaList.map((meta) => [meta.data.mint, meta.data.data.name])))
          } else {
            metaList.forEach((meta) => log.info(`${meta.data.mint} ${meta.data.data.name}`))
          }
        }
      } else {
        const printables = await Promise.all(metaList.map(async (meta) => {
          return fetchPrintable(config.connection, meta, fetchUri, fetchOwner)
        }))
        printables.forEach((p) => prettyPrint(p))
      }
    })
}

export const registerCommand = (program: Command) => {
  const metaProgram = program.command('metadata')
  get(metaProgram)
  update(metaProgram)
  list(metaProgram)
}