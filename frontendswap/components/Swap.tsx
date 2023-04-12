import {
    Box,
    Select,
    Button,
    FormControl,
    FormLabel,
    NumberInput,
    NumberInputField,
} from "@chakra-ui/react"
import { FC, useState } from "react"
import * as Web3 from "@solana/web3.js"
import { Program } from "@project-serum/anchor";
import { PublicKey, Connection, Commitment } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import {
    MoveCoinMint,
    wSolanaMint,
    tokenSwapStateAccount,
    swapAuthority,
    poolMoveAccount,
    poolWSOLAccount,
    TOKEN_SWAP_PROGRAM_ID,
    poolMint,
    feeAccount,
} from "../utils/constants"
import ammIdl from "./target/idl/amm.json";

import { Idl, } from "@project-serum/anchor/dist/cjs/idl"; 

import { TokenSwap } from "@solana/spl-token-swap"
import * as token from "@solana/spl-token"
import { TOKEN_PROGRAM_ID } from "@solana/spl-token"

export const SwapToken: FC = () => {
    const [amount, setAmount] = useState(0)
    const [mint, setMint] = useState("")

    // const programId = new PublicKey("6VL38pW6bCq2muuCmnF7Hcb1HHwFZ5KPLm4kfEPTLDjH");
    // const program = new Program(ammIdl as unknown as Idl, programId, provider);

    const { connection } = useConnection()
    const { publicKey, sendTransaction } = useWallet()

    const handleSwapSubmit = (event: any) => {
        event.preventDefault()
        handleTransactionSubmit()
    }

    const handleTransactionSubmit = async () => {
        if (!publicKey) {
            alert("Please connect your wallet!")
            return
        }

        const kryptMintInfo = await token.getMint(connection, MoveCoinMint)
        const ScroogeCoinMintInfo = await token.getMint(
            connection,
            wSolanaMint
        )

        const kryptATA = await token.getAssociatedTokenAddress(
            MoveCoinMint,
            publicKey
        )
        const scroogeATA = await token.getAssociatedTokenAddress(
            wSolanaMint,
            publicKey
        )
        const tokenAccountPool = await token.getAssociatedTokenAddress(
            poolMint,
            publicKey
        )

        const transaction = new Web3.Transaction()

        let account = await connection.getAccountInfo(tokenAccountPool)

        if (account == null) {
            const createATAInstruction =
                token.createAssociatedTokenAccountInstruction(
                    publicKey,
                    tokenAccountPool,
                    publicKey,
                    poolMint
                )
            transaction.add(createATAInstruction)
        }

        if (mint == "option1") {
            const instruction = TokenSwap.swapInstruction(
                tokenSwapStateAccount,
                swapAuthority,
                publicKey,
                kryptATA,
                poolMoveAccount,
                poolWSOLAccount,
                scroogeATA,
                poolMint,
                feeAccount,
                null,
                TOKEN_SWAP_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                amount * 10 ** kryptMintInfo.decimals,
                0
            )

            transaction.add(instruction)
        } else if (mint == "option2") {
            const instruction = TokenSwap.swapInstruction(
                tokenSwapStateAccount,
                swapAuthority,
                publicKey,
                scroogeATA,
                poolWSOLAccount,
                poolMoveAccount,
                kryptATA,
                poolMint,
                feeAccount,
                null,
                TOKEN_SWAP_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                amount * 10 ** ScroogeCoinMintInfo.decimals,
                0
            )

            transaction.add(instruction)
        }

        try {
            let txid = await sendTransaction(transaction, connection)
            alert(
                `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=testnet`
            )
            console.log(
                `Transaction submitted: https://explorer.solana.com/tx/${txid}?cluster=testnet`
            )
        } catch (e) {
            console.log(JSON.stringify(e))
            alert(JSON.stringify(e))
        }
    }

    return (
        <Box
            p={4}
            display={{ md: "flex" }}
            maxWidth="32rem"
            margin={2}
            justifyContent="center"
        >
            <form onSubmit={handleSwapSubmit}>
                <FormControl isRequired>
                    <FormLabel color="gray.200">Swap Amount</FormLabel>
                    <NumberInput
                        max={1000}
                        min={1}
                        onChange={(valueString) =>
                            setAmount(parseInt(valueString))
                        }
                    >
                        <NumberInputField id="amount" color="gray.400" />
                    </NumberInput>
                    <div style={{ display: "felx" }}>
                        <Select
                            display={{ md: "flex" }}
                            justifyContent="center"
                            placeholder="Token to Swap"
                            color="white"
                            variant="outline"
                            dropShadow="#282c34"
                            onChange={(item) =>
                                setMint(item.currentTarget.value)
                            }
                        >
                            <option
                                style={{ color: "#282c34" }}
                                value="option1"
                            >
                                {" "}
                                MOVE{" "}
                            </option>
                            <option
                                style={{ color: "#282c34" }}
                                value="option2"
                            >
                                {" "}
                                wSOL{" "}
                            </option>
                        </Select>
                    </div>
                </FormControl>
                <Button width="full" mt={4} type="submit">
                    Swap ⇅
                </Button>
            </form>
        </Box>
    )
}
