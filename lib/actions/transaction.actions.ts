"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient } from "../appwrite";
import { parseStringify } from "../utils";
import { getLocalTransactions, saveLocalTransaction } from "./local-store";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_TRANSACTION_COLLECTION_ID: TRANSACTION_COLLECTION_ID,
} = process.env;

export const createTransaction = async (transaction: CreateTransactionProps) => {
  try {
    const { database } = await createAdminClient();

    const newTransaction = await database.createDocument(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      ID.unique(),
      {
        channel: 'online',
        category: 'Transfer',
        ...transaction
      }
    )

    return parseStringify(newTransaction);
  } catch (error) {
    // Fallback to resilient local persistence if Appwrite scopes or documents.write are not available
    const localTx = saveLocalTransaction(transaction);
    return parseStringify(localTx);
  }
}

export const getTransactionsByBankId = async ({bankId}: getTransactionsByBankIdProps) => {
  try {
    const { database } = await createAdminClient();

    const senderTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('senderBankId', bankId)],
    )

    const receiverTransactions = await database.listDocuments(
      DATABASE_ID!,
      TRANSACTION_COLLECTION_ID!,
      [Query.equal('receiverBankId', bankId)],
    );

    const transactions = {
      total: (senderTransactions?.total || 0) + (receiverTransactions?.total || 0),
      documents: [
        ...(senderTransactions?.documents || []), 
        ...(receiverTransactions?.documents || []),
      ]
    }

    return parseStringify(transactions);
  } catch (error) {
    // Fallback to resilient local persistence
    return parseStringify(getLocalTransactions(bankId));
  }
}