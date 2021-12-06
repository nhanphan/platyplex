"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.registerCommand = exports.registerPrefix = void 0;
const commander_1 = require("commander");
const os_1 = __importDefault(require("os"));
const fs_1 = __importDefault(require("fs"));
const error_1 = require("./lib/error");
const DEFAULT_CONFIG_DIR = `${os_1.default.homedir()}/.platyplex`;
const DEFAULT_CONFIG_PATH = `${DEFAULT_CONFIG_DIR}/config`;
const DEFAULT_CONFIG = {
    env: 'mainnet-beta',
};
const readConfig = (path) => {
    return JSON.parse(fs_1.default.readFileSync(path).toString());
};
const saveConfig = (path, obj) => {
    return fs_1.default.writeFileSync(path, JSON.stringify(obj, null, 2));
};
if (!fs_1.default.existsSync(DEFAULT_CONFIG_DIR)) {
    fs_1.default.mkdirSync(DEFAULT_CONFIG_DIR);
    saveConfig(DEFAULT_CONFIG_PATH, DEFAULT_CONFIG);
}
const registerPrefix = (command) => {
    command
        .option('--config <path>', 'Path to the platyplex config', DEFAULT_CONFIG_PATH)
        .option('--keypair <path>', 'Path to keypair for transactions. Overrides config')
        .option('--rpc-url <url>', 'Custom RPC server to use for transactions. Overrides config')
        .addOption(new commander_1.Option('--env <env>', 'Solana environment. Overrides config. Is ignored if rpc-url is specified.')
        .choices(['devnet', 'testnet', 'mainnet-beta'])
        .default('mainnet-beta'));
};
exports.registerPrefix = registerPrefix;
const registerCommand = (command) => {
    command
        .command('config')
        .addArgument(new commander_1.Argument('[mode]', 'list, get or set').choices(['get', 'set', 'list']).default('list'))
        .addArgument(new commander_1.Argument('[name]', 'Config name'))
        .addArgument(new commander_1.Argument('[value]', 'Config value'))
        .action((mode, name, value, options) => {
        const { config } = options;
        const configPath = config || DEFAULT_CONFIG_PATH;
        const configRaw = readConfig(configPath);
        switch (mode) {
            case 'get':
                if (!name) {
                    (0, error_1.fatalError)('Name of config must be specified');
                }
                console.log(`${name}: ${configRaw[name]}`);
                break;
            case 'set':
                if (!name || !value) {
                    (0, error_1.fatalError)('Name and value of must be specified');
                }
                console.log(`Old ${name}: ${configRaw[name]}`);
                console.log(`New ${name}: ${value}`);
                configRaw[name] = value;
                saveConfig(configPath, configRaw);
                break;
            case 'list':
            default:
                Object.keys(configRaw).forEach((k) => {
                    console.log(`${k}: ${configRaw[k]}`);
                });
        }
    });
};
exports.registerCommand = registerCommand;
const loadConfig = (options) => {
    const configPath = options.config || DEFAULT_CONFIG_PATH;
    let configRaw;
    try {
        configRaw = readConfig(configPath);
    }
    catch (e) {
        (0, error_1.fatalError)(`Error reading config at ${configPath}`);
    }
    const keypair = options.keypair || configRaw.keypair;
    if (!keypair) {
        (0, error_1.fatalError)('No keypair found. See https://docs.solana.com/wallet-guide/file-system-wallet for information on how to generate a keypair');
    }
};
exports.loadConfig = loadConfig;
