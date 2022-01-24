import { Command } from 'commander'
import * as error from './lib/error'
import * as config from './config'
import * as metadata from './metadata'
import * as mint from './mint'
import * as nft from './nft'
import * as upload from './upload'

const program = new Command()
program.version('1.0.0')
error.configure(program)
config.registerCommand(program)
mint.registerCommand(program)
nft.registerCommand(program)
metadata.registerCommand(program)
upload.registerCommand(program)

program.parse(process.argv)