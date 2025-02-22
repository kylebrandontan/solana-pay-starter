import React, {useState, useEffect, useMemo} from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { findReference, FindReferenceError } from "@solana/pay";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import IPFSDownload from "./IpfsDownload";
import { addOrder, hasPurchased, fetchItem } from "../lib/api";

const STATUS = {
    Initial: "Initial",
    Submitted: "Submitted",
    Paid: "Paid",
};

export default function Buy({ itemID }) {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const orderID = useMemo(() => Keypair.generate().publicKey, []);

    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(STATUS.Initial);

    const order = useMemo(
        () => ({
            buyer: publicKey.toString(),
            orderID: orderID.toString(),
            itemID: itemID,
        }),
        [publicKey, orderID, itemID]
    );

    // fetch transaction object from server
    const processTransaction = async () => {
        setLoading(true);
        const txResponse = await fetch("../api/createTransaction", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(order),
        });
        const txData = await txResponse.json();

        const tx = Transaction.from(Buffer.from(txData.transaction, "base64"));
        console.log("Tx data is", tx);

        // attempt to send transaction to the network
        try {
            const txHash = await sendTransaction(tx, connection);
            console.log(`Transaction sent: https://solscan.io/tx/${txHash}?cluster=devnet`);
            setStatus(STATUS.Submitted);
        } catch(error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    useEffect(() => {
        //  check if the address has already purchased the item
        // if so, fetch item and set paid to be true
        // async to avoid blocking UI
        async function checkPurchased() {
            const purchased = await hasPurchased(publicKey, itemID);
            if (purchased) {
                setStatus(STATUS.Paid);
                const item = await fetchItem(itemID);
                setItem(item);
            }
        }
        checkPurchased();
    }, [publicKey, itemID]);


    useEffect(() => {
        // Check if transaction was confirmed
        if (status === STATUS.Submitted) {
            setLoading(true);
            const interval = setInterval(async () => {
                try {
                    const result = await findReference(connection, orderID);
                    console.log("Finding tx reference", result.confirmationStatus);
                    if (
                        result.confirmationStatus === "confirmed" || 
                        result.confirmationStatus === "finalized"
                    ) {
                        clearInterval(interval);
                        setStatus(STATUS.Paid);
                        addOrder(order);
                        setLoading(false);
                        alert("Thank you for your purchase!");
                    }
                } catch (e) {
                    if (e instanceof FindReferenceError) {
                        return null;
                    }
                    console.error("Unknown error", e);
                } finally {
                    setLoading(false);
                }
            }, 1000);
            return () => {
                clearInterval(interval);
            };
        }

        async function getItem(itemID) {
            const item = await fetchItem(itemID);
            setItem(item);
        }

        if (status === STATUS.Paid) {
            getItem(itemID);
        }
    }, [status]);

    if (!publicKey) {
        return (
            <div>
                <p>You need to connect your wallet to make transactions.</p>
            </div>
        );
    }

    if (loading) {
        return <p>Loading..</p>;
    }

    return (
        <div>
            { item ? (
                <IPFSDownload filename={item.hash} hash={item.filename} />
            ) : (
                <button disabled={loading} className="buy-button" onClick={processTransaction}>
                    Buy now!
                </button>
            )}
        </div>
    );
}