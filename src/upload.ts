import { Argument, Command, Option, program } from 'commander'
import log from 'loglevel'

import { loadConfig, registerPrefix } from './config'
import { findFiles } from './lib/fs'
import { fatalError } from './lib/error'
import { upload, DataItem } from './lib/arweave'
import { readFile } from 'fs/promises'



export const registerCommand = (program: Command) => {
  registerPrefix(program.command('upload'))
    .argument('<files...>', 'files or directories to upload')
    .action(async (files, options) => {
      const config = loadConfig(options)
      if (!files.length) {
        fatalError('no files specified')
      }
      let items: DataItem[] = []
      try {
        const filePaths = findFiles(files)
        items = await Promise.all(filePaths.map(async (f) => {
          return {
            name: f,
            data: (await readFile(f)).toString(),
          }
        }))
      } catch (e) {
        fatalError('error loading files', e)
      }

      try {
        const results = await upload(config.keypair, items, config.configRaw.rpcUrl)
        for (const res of results) {
          log.info(`https://arweave.net/${res.tx.id} ${res.name}`)
        }
      } catch (e) {
        fatalError('error uploading', e)
      }



    })
}