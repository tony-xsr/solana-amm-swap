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


## Big Thanks to Anchor Example: Token Swap AMM

SPL [Token-swap](https://github.com/solana-labs/solana-program-library/tree/master/token-swap) (AMM) implemented in Anchor.
