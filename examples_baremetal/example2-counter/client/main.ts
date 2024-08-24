/**
 * Counter
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import path from "path";
import * as borsh from "borsh";

import {
  getPayer,
  establishConnection,
  checkAccountDeployed,
  checkBinaryExists,
  getBalance,
  establishEnoughSol,
} from "../../../utils/utils";

// directory with binary and keypair
const PROGRAM_PATH = path.resolve(__dirname, "../../target/deploy/");

// Path to program shared object file which should be deployed on chain.
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, "counter.so");

// Path to the keypair of the deployed program (This file is created when running `solana program deploy)
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, "counter-keypair.json");

async function main() {
  console.log("Let's increment counter for an account!");

  let payer: Keypair = await getPayer();

  // Establish connection to the cluster
  let connection: Connection = await establishConnection();

  await establishEnoughSol(connection, payer);

  // balance after top-up
  let [startBalanceSol, startBalanceLamport] = await getBalance(
    connection,
    payer
  );

  // Check if binary exists
  let programID = await checkBinaryExists(PROGRAM_KEYPAIR_PATH);

  if (await checkAccountDeployed(connection, programID)) {
    await deployGreetAccount(programID, connection, payer);

    // Print fees used up
    let [endBalanceSol, endBalanceLamport] = await getBalance(
      connection,
      payer
    );

    console.log(
      `\nIt cost:\n\t${startBalanceSol - endBalanceSol} SOL\n\t${
        startBalanceLamport - endBalanceLamport
      } Lamports\nto perform the call`
    );
  } else {
    console.log(`\nProgram ${PROGRAM_SO_PATH} not deployed!\n`);
  }
}

export async function deployGreetAccount(
  programId: PublicKey,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  // Recreate structure for GreetingAccount
  const GreetingSchema = new Map([
    [GreetingAccount, { kind: "struct", fields: [["counter", "u32"]] }],
  ]);

  console.log("Program ID account: ", programId.toBase58());

  // Incorrect public key
  let incorrectPubkey = new PublicKey("HzThhJAw99274RoKNfdhnskCdh4wAMFG2X4yBt2KDkgg");

  console.log("Using incorrect public key: ", incorrectPubkey.toBase58());

  // Try to use the incorrect public key instead of the correct one
  if (!(await checkAccountDeployed(connection, incorrectPubkey))) {
    console.log(`Incorrect account ${incorrectPubkey} not deployed!`);
  } else {
    // Increment counter within already deployed (incorrect) greeting account
    console.log("Attempting to write to the greeting counter of an incorrect account", incorrectPubkey.toBase58());
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: incorrectPubkey, isSigner: false, isWritable: true }],
      programId,
      data: Buffer.alloc(0), // All instructions are hellos
    });
    await sendAndConfirmTransaction(
      connection,
      new Transaction().add(instruction),
      [payer]
    );
  }
  // Retrieve the account from the network
  const accountInfo = await connection.getAccountInfo(incorrectPubkey);
  if (accountInfo === null) {
    throw "Error: cannot find the incorrect account";
  }
  // Deserialize the account using known schema
  const greeting = borsh.deserialize(
    GreetingSchema,
    GreetingAccount,
    accountInfo.data
  );
  console.log(
    incorrectPubkey.toBase58(),
    "has been greeted",
    greeting.counter,
    "time(s)"
  );
}

/**
 * The state of a greeting account managed by the hello world program
 */
class GreetingAccount {
  counter = 0;

  // Constructor is for reconstructing it back from serialized data
  constructor(fields: { counter: number } | undefined = undefined) {
    if (fields) {
      this.counter = fields.counter;
    }
  }
}

main().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  }
);
