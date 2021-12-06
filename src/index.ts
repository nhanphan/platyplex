import { Command } from 'commander'
import * as error from './lib/error'
import * as config from './config'

const program = new Command()
program.version('1.0.0')
error.configure(program)
config.registerCommand(program)

program.parse(process.argv)