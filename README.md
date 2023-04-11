## Build, Deploy and Test

First, install dependencies:

```
$ yarn
```

Next, we will build and deploy the program via Anchor.

Get the program ID:

```
$ anchor keys list
anchor_amm: 6VL38pW6bCq2muuCmnF7Hcb1HHwFZ5KPLm4kfEPTLDjH
```

Here, make sure you update your program ID in `Anchor.toml` and `lib.rs`.

Build the program:

```
$ anchor build
```

Let's deploy the program. Notice that `anchor-amm` will be deployed base on provider
It's configured on `Anchor.toml`. 
For example my case

```
[provider]
cluster = "localnet"
wallet = "~/.config/solana/id.json"
```

```
$ anchor deploy
...

Program Id: 6VL38pW6bCq2muuCmnF7Hcb1HHwFZ5KPLm4kfEPTLDjH

Deploy success
```

Finally, run the test:

```
$ anchor test --skip-build --skip-deploy
```

If you run on localnet and already already run 
```
solana-test-validator
```

This one will run test without re-build re-deploy and run validator 
```
 anchor test --skip-build --skip-deploy  --skip-local-validator
```
More terminal on Solana that may you need 

Create new Key and set it to anchor [provider] with wallet address
```
solana-keygen new  
```

```
solana config set --keypair  ~/.config/solana/id.json
```

Get Airdrop SOLANA for enough fee to deploy program
```
solana airdrop 10
```

# Devnet and TestNet

Get Airdrop SOLANA for enough fee to deploy program 
Only request 1 SOL at a time .

```
solana airdrop 1
```

Solana run on devnet

```
solana config set --url https://api.devnet.solana.com
```

Solana run on testnet
```
solana config set --url https://api.testnet.solana.com
```

It's take more than 6 SOL for fee (depending on network)

```
$ anchor deploy
```

My Program ID in Testnet
```
https://solscan.io/account/6VL38pW6bCq2muuCmnF7Hcb1HHwFZ5KPLm4kfEPTLDjH
```

# MOVE Token

```
spl-token create-token
```
Result
```
Creating token 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm

Address:  6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm
Decimals:  9

Signature: 3K1R719WaVUfPnc4c7GCvJ3X29FxpDcUchquUEyGyeUUiBqHBvgdeqtazMaLDTfEwiE7FqYdbHLURVLEQPSnPgjj

```

Create MOVE token Account

```
$ spl-token create-account 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm
 
```
Result
```
Creating account 7KxGLE28LkzSsjyQArCkcGWhyY5xQK1M6CZRs6yGxnsW
Signature: 4J5gR8oBmNR4k8f4TH9Qju15tcdnCUQ9ZdAPpREFMau2v4qViAHS1k4WX8BVyph4W2FWg6TozFbpzUYtRUe7Ci2Q
```

Mint Amount Of Move Token
```
spl-token mint 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm 1000000

```
Result
```
Minting 1000000 tokens
  Token: 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm
  Recipient: 7KxGLE28LkzSsjyQArCkcGWhyY5xQK1M6CZRs6yGxnsW

Signature: HG4RR3Yihk4VUPrvQEYabfVznw56PqUXm6V7fefPv6uq5hhfwpqm7ApUtWSt1CSTkHhjZGJR81c1fbhQiRxSXWn
```

Check Move Token Balance
```
spl-token balance 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm
```

Check Move Token Supply
```
spl-token supply 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm
```

Wrapping SOL in a Token 
```
spl-token wrap 1
```


```
spl-token transfer 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm <AMOUNT> <RECEIVER>
```

# Swap Pool 

```
spl-token transfer 6mSWkE7ef9WyCnHKgPs6CzTNreLxqpSbsfBMrKqzJmMm  5  6VL38pW6bCq2muuCmnF7Hcb1HHwFZ5KPLm4kfEPTLDjH --allow-non-system-account-recipient --fund-recipient
```

## Big Thanks to Anchor Example: Token Swap AMM

SPL [Token-swap](https://github.com/solana-labs/solana-program-library/tree/master/token-swap) (AMM) implemented in Anchor.
