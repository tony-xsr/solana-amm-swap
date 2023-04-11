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

  // Pool fees
  const TRADING_FEE_NUMERATOR = 25;
  const TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_TRADING_FEE_NUMERATOR = 5;
  const OWNER_TRADING_FEE_DENOMINATOR = 10000;
  const OWNER_WITHDRAW_FEE_NUMERATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 1;
  const OWNER_WITHDRAW_FEE_DENOMINATOR = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 0 : 6;
  const HOST_FEE_NUMERATOR = 20;
  const HOST_FEE_DENOMINATOR = 100;

  // Initial amount in each swap token
  let currentSwapTokenA = 1000000;
  let currentSwapTokenB = 1000000;
  let currentFeeAmount = 0;

  const SWAP_AMOUNT_IN = 100000;
  const SWAP_AMOUNT_OUT = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 90661 : 90674;
  const SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS ? 22273 : 22277;
  const HOST_SWAP_FEE = SWAP_PROGRAM_OWNER_FEE_ADDRESS
    ? Math.floor((SWAP_FEE * HOST_FEE_NUMERATOR) / HOST_FEE_DENOMINATOR)
    : 0;
  const OWNER_SWAP_FEE = SWAP_FEE - HOST_SWAP_FEE;
  // Pool token amount minted on init
  const DEFAULT_POOL_TOKEN_AMOUNT = 1000000000;
  // Pool token amount to withdraw / deposit
  const POOL_TOKEN_AMOUNT = 10000000;

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
 

  it("Swap", async () => {
    // Creating swap token a account
    let userAccountA = await mintA.createAccount(owner.publicKey);
    await mintA.mintTo(userAccountA, owner, [], SWAP_AMOUNT_IN);
    const userTransferAuthority = anchor.web3.Keypair.generate();
    await mintA.approve(
      userAccountA,
      userTransferAuthority.publicKey,
      owner,
      [],
      SWAP_AMOUNT_IN
    );
    // Creating swap token b account
    let userAccountB = await mintB.createAccount(owner.publicKey);

    let poolAccount = SWAP_PROGRAM_OWNER_FEE_ADDRESS
      ? await tokenPool.createAccount(owner.publicKey)
      : PublicKey.default;

    // Swapping

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

    let info;
    info = await mintA.getAccountInfo(userAccountA);
    assert(info.amount.toNumber() == 0);

    info = await mintB.getAccountInfo(userAccountB);
    assert(info.amount.toNumber() == SWAP_AMOUNT_OUT);

    info = await mintA.getAccountInfo(tokenAccountA);
    assert(info.amount.toNumber() == currentSwapTokenA + SWAP_AMOUNT_IN);
    currentSwapTokenA += SWAP_AMOUNT_IN;

    info = await mintB.getAccountInfo(tokenAccountB);
    assert(info.amount.toNumber() == currentSwapTokenB - SWAP_AMOUNT_OUT);
    currentSwapTokenB -= SWAP_AMOUNT_OUT;

    info = await tokenPool.getAccountInfo(tokenAccountPool);
    assert(
      info.amount.toNumber() == DEFAULT_POOL_TOKEN_AMOUNT - POOL_TOKEN_AMOUNT
    );

    info = await tokenPool.getAccountInfo(feeAccount);
    assert(info.amount.toNumber() == currentFeeAmount + OWNER_SWAP_FEE);

    if (poolAccount != PublicKey.default) {
      info = await tokenPool.getAccountInfo(poolAccount);
      assert(info.amount.toNumber() == HOST_SWAP_FEE);
    }
  });
 
});
