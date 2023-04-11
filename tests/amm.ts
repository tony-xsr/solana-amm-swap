import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet"; 
import ammIdl from "../target/idl/amm.json";
import { PublicKey, Connection, Commitment } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, Token, u64 } from "@solana/spl-token";
import * as BufferLayout from "buffer-layout";
import { assert } from "chai";
import { TypeDef } from "@project-serum/anchor/dist/cjs/program/namespace/types";
import { Idl, } from "@project-serum/anchor/dist/cjs/idl"; 
import dotenv from "dotenv";
dotenv.config();

const CurveType = Object.freeze({
  ConstantProduct: 0, // Constant product curve, Uniswap-style
  ConstantPrice: 1, // Constant price curve, always X amount of A token for 1 B token, where X is defined at init
  Offset: 3, // Offset curve, like Uniswap, but with an additional offset on the token B side
});

describe("amm", async () => {
  const commitment: Commitment = "processed";
    
  const connection = new Connection(process.env.SOLANA_RPC, commitment)
  const options = anchor.Provider.defaultOptions();
  const wallet = NodeWallet.local();
  const provider = new anchor.Provider(connection, wallet, options);

  anchor.setProvider(provider);

  const programId = new PublicKey(process.env.PROGRAM_ID!);
  const program = new Program(ammIdl as unknown as Idl, programId, provider);

  let authority: PublicKey;
  let bumpSeed: number;
  let tokenPool: Token;
  let tokenAccountPool: PublicKey;
  let feeAccount: PublicKey;
  const SWAP_PROGRAM_OWNER_FEE_ADDRESS =
    process.env.SWAP_PROGRAM_OWNER_FEE_ADDRESS;
  let mintA: Token;
  let mintB: Token;
  let tokenAccountA: PublicKey;
  let tokenAccountB: PublicKey;
 
  // Initial amount in each swap token
  // As pool initial 1000 token A
  // and 100 token B
  let currentSwapTokenA = 1000;
  let currentSwapTokenB = 100;

  //Swap 10 token B
  const SWAP_AMOUNT_IN = 10;
  // const SLIPPAGE_MAX = 0;

  // 10 Token B = 1 Token A
  // MIN OUT base on SLIPPAGE
  // Swap to get 1 token A
  const SWAP_AMOUNT_OUT = SWAP_AMOUNT_IN/10
  // - SLIPPAGE_MAX*(SWAP_AMOUNT_IN/10);
  

  const ammAccount = anchor.web3.Keypair.generate();
  const payer = anchor.web3.Keypair.generate();
  const owner = anchor.web3.Keypair.generate();
 
  it("Initialize AMM", async () => { 
    const sig = await provider.connection.requestAirdrop(
      payer.publicKey,
      1000000000
    );
    await provider.connection.confirmTransaction(sig, "singleGossip");
      
    [authority, bumpSeed] = await PublicKey.findProgramAddress(
      [ammAccount.publicKey.toBuffer()],
      program.programId
    );

    // creating pool mint

    tokenPool = await Token.createMint(
      provider.connection,
      payer,
      authority,
      null,
      2,
      TOKEN_PROGRAM_ID
    );

    // creating pool account
    tokenAccountPool = await tokenPool.createAccount(owner.publicKey);
    const ownerKey =
      SWAP_PROGRAM_OWNER_FEE_ADDRESS || owner.publicKey.toString();
    feeAccount = await tokenPool.createAccount(new PublicKey(ownerKey));

    // creating token A
    mintA = await Token.createMint(
      provider.connection,
      payer,
      owner.publicKey,
      null,
      2,
      TOKEN_PROGRAM_ID
    );

    // creating token A account
    tokenAccountA = await mintA.createAccount(authority);
    // minting token A to swap
    await mintA.mintTo(tokenAccountA, owner, [], currentSwapTokenA);


    // creating token B
    mintB = await Token.createMint(
      provider.connection,
      payer,
      owner.publicKey,
      null,
      2,
      TOKEN_PROGRAM_ID
    );

    // creating token B account
    tokenAccountB = await mintB.createAccount(authority);
    // minting token B to swap
    await mintB.mintTo(tokenAccountB, owner, [], currentSwapTokenB);

    const commandDataLayout = BufferLayout.struct([
      BufferLayout.nu64("tradeFeeNumerator"),
      BufferLayout.nu64("tradeFeeDenominator"),
      BufferLayout.nu64("ownerTradeFeeNumerator"),
      BufferLayout.nu64("ownerTradeFeeDenominator"),
      BufferLayout.nu64("ownerWithdrawFeeNumerator"),
      BufferLayout.nu64("ownerWithdrawFeeDenominator"),
      BufferLayout.nu64("hostFeeNumerator"),
      BufferLayout.nu64("hostFeeDenominator"),
      BufferLayout.u8("curveType"),
      BufferLayout.nu64("curveParameters"),
      // BufferLayout.blob(32, 'curveParameters'),
    ]);
    let data = Buffer.alloc(1024);
    const encodeLength = commandDataLayout.encode(
 
      data
    );
    data = data.slice(0, encodeLength);
 

    await program.rpc.initialize({
        accounts: {
          authority: authority,
          amm: ammAccount.publicKey,
          tokenA: tokenAccountA,
          tokenB: tokenAccountB,
          poolMint: tokenPool.publicKey,
          feeAccount: feeAccount,
          destination: tokenAccountPool,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
        instructions: [await program.account.amm.createInstruction(ammAccount)],
        signers: [ammAccount],
      });

    let fetchedAmmAccount = await program.account.amm.fetch(
      ammAccount.publicKey
    );

    assert(fetchedAmmAccount.tokenProgramId.equals(TOKEN_PROGRAM_ID));
    assert(fetchedAmmAccount.tokenAAccount.equals(tokenAccountA));
    assert(fetchedAmmAccount.tokenBAccount.equals(tokenAccountB));
    assert(fetchedAmmAccount.tokenAMint.equals(mintA.publicKey));
    assert(fetchedAmmAccount.tokenBMint.equals(mintB.publicKey));
    assert(fetchedAmmAccount.poolMint.equals(tokenPool.publicKey));
    assert(fetchedAmmAccount.poolFeeAccount.equals(feeAccount));
  });

  // In this test, i will
  // trying to Swap 1 token B
  // and i should receive 10 token A.
  it("Swap", async () => {
    // Creating swap token a account
    let userAccountA = await mintA.createAccount(owner.publicKey);
    // Mint amount of SWAP_AMOUNT_IN token A 
    // send to a user Token Account.
    await mintA.mintTo(userAccountA, owner, [], SWAP_AMOUNT_IN);
    const userTransferAuthority = anchor.web3.Keypair.generate();
    await mintA.approve(
      userAccountA,
      userTransferAuthority.publicKey,
      owner,
      [],
      SWAP_AMOUNT_IN
    );
    // Creating Token Account for B token.
    let userAccountB = await mintB.createAccount(owner.publicKey);
    
    let infoTokenAccountA = await mintA.getAccountInfo(tokenAccountA);
 
    let infoUserAccountA = await mintA.getAccountInfo(userAccountA);
    let infoUserAccountB = await mintB.getAccountInfo(userAccountB);
     
    
    //Wallet should hodl amount of SWAP_AMOUNT_IN token A
    assert(infoUserAccountA.amount.toNumber() == SWAP_AMOUNT_IN);

    //Wallet is empty amount of token B . Its should Zero 
    assert(infoUserAccountB.amount.toNumber() == 0); 
    
    // Swapping SWAP_AMOUNT_IN token A 
    // Its should received amount toke B 
    // Base on Const Curve Price of 
    // 10 token A = 1 token B
    await program.rpc.swap(
      new anchor.BN(SWAP_AMOUNT_IN), 
      new anchor.BN(SWAP_AMOUNT_OUT),
      {
        accounts: {
          authority: authority,
          amm: ammAccount.publicKey,
          userTransferAuthority: userTransferAuthority.publicKey,
          sourceInfo: userAccountA,
          destinationInfo: userAccountB,
          swapSource: tokenAccountA,
          swapDestination: tokenAccountB,
          poolMint: tokenPool.publicKey,
          feeAccount: feeAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          hostFeeAccount: PublicKey.default,
        },
        signers: [userTransferAuthority],
      }
    ); 
    infoUserAccountA = await mintA.getAccountInfo(userAccountA);
 
    //After successfully swapped , wallet should empty amount of A token
    assert(infoUserAccountA.amount.toNumber() == 0);
    
    infoUserAccountB = await mintB.getAccountInfo(userAccountB);
 
    //After successfully swapped , wallet should hodl
    //amount of B token base on SWAP_AMOUNT_OUT = SWAP_AMOUNT_IN/10
    //Its mean 10 token A = 1 token B 
    assert(infoUserAccountB.amount.toNumber() == SWAP_AMOUNT_OUT);


    infoTokenAccountA = await mintA.getAccountInfo(tokenAccountA);

    // Swap Pool should hodl amount of currentSwapTokenA + SWAP_AMOUNT_IN
    assert(infoTokenAccountA.amount.toNumber() == currentSwapTokenA + SWAP_AMOUNT_IN);
    // currentSwapTokenA += SWAP_AMOUNT_IN;
  
    const infoTokenAccountB = await mintB.getAccountInfo(tokenAccountB);
    // Swap Pool should hodl amount of currentSwapTokenB - SWAP_AMOUNT_OUT
    // Because SWAP_AMOUNT_OUT in pool already send to user Token wallet.
    assert(infoTokenAccountB.amount.toNumber() == currentSwapTokenB - SWAP_AMOUNT_OUT);
    currentSwapTokenB -= SWAP_AMOUNT_OUT;
    
  });

});
