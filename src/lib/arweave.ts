// adapted from metaplex cli

import * as anchor from '@project-serum/anchor'
import FormData from 'form-data'
import fs from 'fs'
import path from 'path'
import log from 'loglevel'
import fetch from 'node-fetch'
import { stat } from 'fs/promises'
import { calculate } from '@metaplex/arweave-cost'
import { sendTransactionWithRetryWithKeypair } from './transaction'

import { Connection, Keypair, PublicKey } from '@solana/web3.js'
import { ArweaveUploadResult } from '@metaplex/js'

export const ARWEAVE_PAYMENT_WALLET = new PublicKey(
  '6FKvsq4ydWFci6nGq9ckbjYMtnmaqAoatz5c9XWjiDuS',
)

const ARWEAVE_UPLOAD_ENDPOINT =
  'https://us-central1-metaplex-studios.cloudfunctions.net/uploadFile'

async function fetchAssetCostToStore(fileSizes: number[]) {
  const result = await calculate(fileSizes)
  log.debug('Arweave cost estimates:', result)

  return result.solana * anchor.web3.LAMPORTS_PER_SOL
}

async function upload(data: FormData, file: string): Promise<ArweaveUploadResult> {
  log.debug(`trying to upload ${file}`)
  return await (
    await fetch(ARWEAVE_UPLOAD_ENDPOINT, {
      method: 'POST',
      // @ts-ignore
      body: data,
    })
  ).json() as ArweaveUploadResult
}

function estimateManifestSize(filenames: string[]) {
  const paths: any = {}

  for (const name of filenames) {
    paths[name] = {
      id: 'artestaC_testsEaEmAGFtestEGtestmMGmgMGAV438',
      ext: path.extname(name).replace('.', ''),
    }
  }

  const manifest = {
    manifest: 'arweave/paths',
    version: '0.1.0',
    paths,
    index: {
      path: 'metadata.json',
    },
  }

  const data = Buffer.from(JSON.stringify(manifest), 'utf8')
  log.debug('Estimated manifest size:', data.length)
  return data.length
}

export async function arweaveUpload(
  walletKeyPair: Keypair,
  connection: Connection,
  env: string,
  image: string,
  metadataBuffer: Buffer,
) {
  const fsStat = await stat(image)
  const estimatedManifestSize = estimateManifestSize([
    'image.png',
    'metadata.json',
  ])
  const storageCost = await fetchAssetCostToStore([
    fsStat.size,
    metadataBuffer.length,
    estimatedManifestSize,
  ])
  log.debug(`lamport cost to store ${image}: ${storageCost}`)

  const instructions = [
    anchor.web3.SystemProgram.transfer({
      fromPubkey: walletKeyPair.publicKey,
      toPubkey: ARWEAVE_PAYMENT_WALLET,
      lamports: storageCost,
    }),
  ]

  const tx = await sendTransactionWithRetryWithKeypair(
    connection,
    walletKeyPair,
    instructions,
    [],
    'confirmed',
  )
  log.debug(`solana transaction (${env}) for arweave payment:`, tx)

  const data = new FormData()
  data.append('transaction', tx['txid'])
  data.append('env', env)
  data.append('file[]', fs.createReadStream(image), {
    filename: `image.png`,
    contentType: 'image/png',
  })
  data.append('file[]', metadataBuffer, 'metadata.json')

  const result = await upload(data, image)

  const metadataFile = result.messages?.find(
    m => m.filename === 'manifest.json',
  )
  const imageFile = result.messages?.find(m => m.filename === 'image.png')
  if (metadataFile?.transactionId && imageFile) {
    const link = `https://arweave.net/${metadataFile.transactionId}`
    const imageLink = `https://arweave.net/${imageFile.transactionId}?ext=png`
    log.debug(`File uploaded: ${link}`)
    return [link, imageLink]
  } else {
    // @todo improve
    throw new Error(`No transaction ID for upload: ${image}`)
  }
}
