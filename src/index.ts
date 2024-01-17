import { AccountLayout, TOKEN_PROGRAM_ID, TokenInstruction, createCloseAccountInstruction, createTransferInstruction, getOrCreateAssociatedTokenAccount } from '@solana/spl-token';
import config from '../config.json';
import web3, { Connection } from "@solana/web3.js"
import base58 from "bs58"

const rpcEndpoint = "https://api.mainnet-beta.solana.com";

async function main() {
  const connection = new Connection(rpcEndpoint, "confirmed");
  const keypair = web3.Keypair.fromSecretKey(base58.decode(config.pk));
  const dest = new web3.PublicKey(config.dest);

  for (const pk of config.walletPKs) {
    const account = web3.Keypair.fromSecretKey(base58.decode(pk))
    const { value: atas } = await connection.getTokenAccountsByOwner(account.publicKey, { programId: TOKEN_PROGRAM_ID })
    console.log("token account length: ", atas.length)
    let tx = new web3.Transaction()
    while (atas.length > 0) {
      for (let i = 0; i < atas.length; i++) {
        try {
          const ata = atas[i].pubkey
          const accountData = AccountLayout.decode(atas[i].account.data)
          console.log(accountData.amount.toString())
          if (accountData.amount.toString() === "0") {
            tx.add(
              createCloseAccountInstruction(ata, dest, account.publicKey, [])
            )
          } else {
            const toATA = await getOrCreateAssociatedTokenAccount(connection, keypair, accountData.mint, dest, true, "confirmed")
            tx.add(
              createTransferInstruction(ata, toATA.address, account.publicKey, accountData.amount, []),
            )
          }
          if ((i > 0 && i % 15 === 0) || i === atas.length - 1) {
            const recentBlockhash = await connection.getLatestBlockhash()
            tx.feePayer = keypair.publicKey
            tx.recentBlockhash = recentBlockhash.blockhash
            const signature = await connection.sendTransaction(tx, [keypair, account])
            console.log({
              signature
            })
            tx = new web3.Transaction()
            await sleep(3000)
          }
        } catch (e) {
          console.error(e)
          console.log("skip error")
        }
      }
    }
  }
}

main()

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
