import { Command } from 'commander'
import * as error from './lib/error'
import * as config from './config'
import * as metadata from './metadata'
import * as mint from './mint'
import * as token from './token'

const program = new Command()
program.version('1.0.0')
error.configure(program)
config.registerCommand(program)
mint.registerCommand(program)
token.registerCommand(program)
metadata.registerCommand(program)

program.parse(process.argv)