import { Argument, Command, Option } from 'commander'
import os from 'os'
import fs from 'fs'
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js'
import { fatalError } from './lib/error'

const DEFAULT_CONFIG_DIR = `${os.homedir()}/.platyplex`
const DEFAULT_CONFIG_PATH = `${DEFAULT_CONFIG_DIR}/config`

const DEFAULT_CONFIG = {
  env: 'mainnet-beta',
}

export interface Config {
  rpcUrl: string | undefined
  env: string
  keypair: string
}

export interface ConfigContext {
  configRaw: Config
  connection: Connection
  keypair: Keypair
}

const loadJson = (path: string) => {
  return JSON.parse(fs.readFileSync(path).toString())
}

const saveJson = (path: string, obj: any) => {
  return fs.writeFileSync(path, JSON.stringify(obj, null, 2))
}

if (!fs.existsSync(DEFAULT_CONFIG_DIR)) {
  fs.mkdirSync(DEFAULT_CONFIG_DIR)
  saveJson(DEFAULT_CONFIG_PATH, DEFAULT_CONFIG)
}

export const registerPrefix = (command: Command) => {
  return command
    .option('--config <path>', 'Path to the platyplex config', DEFAULT_CONFIG_PATH)
    .option('--keypair <path>', 'Path to keypair for transactions. Overrides config')
    .option('--rpc-url <url>', 'Custom RPC server to use for transactions. Overrides config')
    .addOption(
      new Option('--env <env>', 'Solana environment. Overrides config. Is ignored if rpc-url is specified.')
        .choices(['devnet', 'testnet', 'mainnet-beta'])
        .default('mainnet-beta')
    )
}

export const registerCommand = (command: Command) => {
  command
    .command('config')
    .addArgument(new Argument('[mode]', 'list, get or set').choices(['get', 'set', 'list']).default('list'))
    .addArgument(new Argument('[name]', 'Config name'))
    .addArgument(new Argument('[value]', 'Config value'))
    .action((mode, name, value, options) => {
      const { config } = options
      const configPath = config || DEFAULT_CONFIG_PATH
      const configRaw = loadJson(configPath)
      switch (mode) {
        case 'get':
          if (!name) {
            fatalError('Name of config must be specified')
          }
          console.log(`${name}: ${configRaw[name]}`)
          break
        case 'set':
          if (!name || !value) {
            fatalError('Name and value of must be specified')
          }
          console.log(`Old ${name}: ${configRaw[name]}`)
          console.log(`New ${name}: ${value}`)
          configRaw[name] = value
          saveJson(configPath, configRaw)
          break
        case 'list':
        default:
          Object.keys(configRaw).forEach((k) => {
            console.log(`${k}: ${configRaw[k]}`)
          })
      }

    })
}



export const loadConfig = (options: any): ConfigContext => {
  const configPath = options.config || DEFAULT_CONFIG_PATH

  let configRaw
  try {
    configRaw = loadJson(configPath)
  } catch (e) {
    fatalError(`Error reading config at ${configPath}`)
  }

  const keypairPath = options.keypair || configRaw.keypair
  if (!keypairPath) {
    fatalError('No keypair found. See https://docs.solana.com/wallet-guide/file-system-wallet for information on how to generate a keypair')
  }

  const env = options.env || configRaw.env
  if (!env) {
    fatalError(`env must be defined in the config`)
  }

  const rpcUrl = options.rpcUrl || configRaw.rpcUrl
  const keypair = Keypair.fromSecretKey(new Uint8Array(loadJson(keypairPath)))
  const connection = new Connection(rpcUrl ? rpcUrl : clusterApiUrl(env))

  const ctx: ConfigContext = {
    configRaw: {
      rpcUrl,
      env,
      keypair: keypairPath,
    },
    keypair,
    connection
  }

  return ctx
}