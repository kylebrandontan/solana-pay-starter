import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
    clusterApiUrl,
    Connection,
    PublicKey,
    Transaction
} from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import BigNumber from "bignumber.js";
import products from "./products.json";

// Real USDC
const usdcAddress = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
// Dummy USDC
// const usdcAddress = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr")
const sellerAddress = '97Wyt88ZaVjNQZEDjQ46Pd7sqVPrJ5E8AXNYkMFgefTk';
const sellerPublicKey = new PublicKey(sellerAddress);

const createTransaction = async (req, res) => {
    try {
        const { buyer, orderID, itemID } = req.body;

        if (!buyer) {
            return res.status(400).json({
                message: "Missing buyer address",
            });
        }

        if (!orderID) {
            res.status(400).json({
                message: "Missing order ID",
            });
        }

        const itemPrice = products.find((item) => item.id === itemID).price;

        if (!itemPrice) {
            return res.status(404).json({
                message: "Item not found. please check item ID",
            });
        }

        const bigAmount = BigNumber(itemPrice);
        const buyerPublicKey = new PublicKey(buyer);
        
        const network = WalletAdapterNetwork.Mainnet;
        // const network = WalletAdapterNetwork.Devnet;
        const endpoint = clusterApiUrl(network);
        const connection = new Connection(endpoint);
        
        const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey);
        const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, sellerPublicKey);
        const { blockhash } = await connection.getLatestBlockhash("finalized");

        const usdcMint = await getMint(connection, usdcAddress);

        const tx = new Transaction({
            recentBlockhash: blockhash,
            feePayer: buyerPublicKey,
        });

        const transferInstruction = createTransferCheckedInstruction(
            buyerUsdcAddress,
            usdcAddress,
            shopUsdcAddress,
            buyerPublicKey,
            bigAmount.toNumber() * 10 ** (await usdcMint).decimals,
            usdcMint.decimals
        );

        transferInstruction.keys.push({
            pubkey: new PublicKey(orderID),
            isSigner: false,
            isWritable: false,
        });

        tx.add(transferInstruction);

        const serializedTransaction = tx.serialize({
            requireAllSignatures: false,
        });

        const base64 = serializedTransaction.toString("base64");

        res.status(200).json({
            transaction: base64,
        });
    } catch (err) {
        console.error(err);
        
        res.status(500).json({ error: 'error creating tx'});
        return;
    }
}

export default function handler(req, res) {
    if (req.method === "POST") {
        createTransaction(req, res);
    } else {
        res.status(405).end();
    }
}