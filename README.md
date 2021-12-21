# Platyplex

A multitool for the [Metaplex](https://github.com/metaplex-foundation/metaplex) NFT ecosystem, for everything the [Metaplex CLIs](https://github.com/metaplex-foundation/metaplex/tree/master/js/packages/cli) don't do.

## Quickstart

```bash
# Install
npm install -g platyplex-cli

# Config setup
playtplex config set keypair /path/to/my/keypair

# Optional but recommended: Specify a custom RPC provider
platyplex config set rpcUrl mainnet-beta https://my-rpc-server.com

# Get NFT metadata by mint with metadata.uri
platyplex metadata get -m <mint pubkey>

# Get metadata by metadata account, output JSON, also fetch owner, don't fetch uri
platyplex metadata get -a <meta account pubkey> --json --fetch-owner --no-fetch-uri

# List metadata by current NFT owner
platyplex metadata list -o <owner pubkey>

# List metadata by creator, output JSON, also include current owner in output
platyplex metadata list -c <creator pubkey> --json --fetch-owner

# Get mint list & name by candy machine as JSON [[mint, name], ...]
platyplex metadata list -c <candy machine pubkey> --mint-only --json

# Validate metadata from url(s), path(s) and directories
platyplex metadata validate https://mymeta.com/abc /path/to/meta.json /path/to/meta/folder/

# Update metadata
platyplex metadata update -m <mint> https://mymeta.com/abc

# Mint an NFT from a url(s), use retry cache for idempotency
platyplex mint --retry-cache /path/to https://www.arweave.net/abc https://www.arweave.net/abc2

# Transfer NFT(s)
platyplex nft transfer <recipient pubkey> -m <mint1> <mint2> ...

# Airdrop NFT(s) [{"mint": "mmmmm", "to": "aaaaaaa"}]
platyplex nft airdrop <airdropfile> --retry-cache /path/to/cache

```

### Metadata Print Result Format

```
Belugie #1234 (BLGS) [sold] [mutable] [image]

8k collection by a 14 year old artist created for the Whale in all of us.

Image:       https://www.arweave.net/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?ext=png
ExternalUrl: https://belugies.com
Collection:  Belugies, Belugies

URI:        https://arweave.net/uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu
Pubkey:     pppppppppppppppppppppppppppppppppppppppppppp
Mint:       mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm
UpdateAuth: uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu

Creators: (5.00% fees)
  AQCMcX7C2VrGXRWDiim6t78ZAUyVr1t5g7vmHXHRBLjA: 0 [verified]
  FZS444Et8F9e5kAmTNoNiHDkmj6998KAiKGxdi86Gi3K: 100

Files:
  [image/png] https://www.arweave.net/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?ext=png

Attributes:
  Backdrop: Green
  Character: Blue
  Swag: Black hoodie
  Face: Happy
  Head: Water spout
```

```bash
#
```

## Config

Platyplex uses a configuration file to

## Metadata

```

```

## Mint

## NFT
