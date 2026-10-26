'use server';

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { cookies } from "next/headers";
import { encryptId, extractCustomerIdFromUrl, parseStringify } from "../utils";
import { CountryCode, ProcessorTokenCreateRequest, ProcessorTokenCreateRequestProcessorEnum, Products } from "plaid";

import { plaidClient } from '@/lib/plaid';
import { revalidatePath } from "next/cache";
import { addFundingSource, createDwollaCustomer } from "./dwolla.actions";
import {
  getLocalBank,
  getLocalBankByAccountId,
  getLocalBanks,
  getLocalUser,
  saveLocalBankAccount,
  saveLocalUser,
} from "./local-store";

const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
  APPWRITE_BANK_COLLECTION_ID: BANK_COLLECTION_ID,
} = process.env;

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database, user } = await createAdminClient();

    let userDoc = null;
    try {
      const result = await database.listDocuments(
        DATABASE_ID!,
        USER_COLLECTION_ID!,
        [Query.equal('userId', [userId])]
      );

      if (result && result.documents && result.documents.length > 0) {
        userDoc = result.documents[0];
      }
    } catch {
      // Document reading may fail if database scope is not granted; check local store
      userDoc = getLocalUser(userId);
    }

    if (!userDoc) {
      userDoc = getLocalUser(userId);
    }

    if (userDoc) {
      return parseStringify(userDoc);
    }

    // Fallback: Fetch user details directly from Appwrite Auth
    const authUser = await user.get(userId);
    if (authUser) {
      const [firstName = 'User', ...lastNameParts] = (authUser.name || '').trim().split(' ');
      const fallback = {
        $id: authUser.$id,
        userId: authUser.$id,
        email: authUser.email,
        name: authUser.name || 'User',
        firstName: firstName || 'User',
        lastName: lastNameParts.join(' ') || '',
      };
      saveLocalUser(fallback);
      return parseStringify(fallback);
    }

    return null;
  } catch {
    return parseStringify(getLocalUser(userId));
  }
}

export const signIn = async ({ email, password }: signInProps) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    const user = await getUserInfo({ userId: session.userId });

    return parseStringify(user || { ...session, $id: session.userId, email });
  } catch (error: any) {
    console.error('Error signing in:', error);
    return { error: error?.message || 'Invalid email or password. Please try again.' };
  }
}

export const signUp = async ({ password, ...userData }: SignUpParams) => {
  const { email, firstName, lastName } = userData;
  
  let newUserAccount;

  try {
    const { account, database } = await createAdminClient();

    newUserAccount = await account.create(
      ID.unique(), 
      email, 
      password, 
      `${firstName} ${lastName}`
    );

    if(!newUserAccount) throw new Error('Error creating user');

    let dwollaCustomerId = '';
    let dwollaCustomerUrl = '';
    try {
      dwollaCustomerUrl = (await createDwollaCustomer({
        ...userData,
        type: 'personal'
      })) || '';
      if (dwollaCustomerUrl) {
        dwollaCustomerId = extractCustomerIdFromUrl(dwollaCustomerUrl);
      }
    } catch (dwollaErr) {
      console.warn('Dwolla customer creation skipped or failed:', dwollaErr);
    }

    let newUser;
    try {
      newUser = await database.createDocument(
        DATABASE_ID!,
        USER_COLLECTION_ID!,
        ID.unique(),
        {
          ...userData,
          userId: newUserAccount.$id,
          dwollaCustomerId,
          dwollaCustomerUrl
        }
      );
      saveLocalUser(newUser);
    } catch {
      // If database scopes not yet granted in Appwrite console, persist locally
      newUser = saveLocalUser({
        $id: newUserAccount.$id,
        userId: newUserAccount.$id,
        ...userData,
        dwollaCustomerId,
        dwollaCustomerUrl,
      });
    }

    const session = await account.createEmailPasswordSession(email, password);

    cookies().set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return parseStringify(newUser);
  } catch (error: any) {
    console.error('Error signing up:', error);
    return { error: error?.message || 'Failed to create account. Please check your information and try again.' };
  }
}

export async function getLoggedInUser() {
  try {
    const sessionClient = await createSessionClient();
    if (!sessionClient) return null;

    const { account } = sessionClient;
    const result = await account.get();

    const user = await getUserInfo({ userId: result.$id });

    if (user) return parseStringify(user);

    const [firstName = 'User', ...lastNameParts] = (result.name || '').trim().split(' ');
    const fallbackUser = {
      ...result,
      userId: result.$id,
      firstName: firstName || 'User',
      lastName: lastNameParts.join(' ') || '',
    };

    saveLocalUser(fallbackUser);
    return parseStringify(fallbackUser);
  } catch {
    return null;
  }
}

export const logoutAccount = async () => {
  try {
    const sessionClient = await createSessionClient();

    cookies().delete('appwrite-session');

    if (sessionClient) {
      await sessionClient.account.deleteSession('current');
    }
    return true;
  } catch {
    return false;
  }
}

export const createLinkToken = async (user: User) => {
  try {
    const tokenParams = {
      user: {
        client_user_id: user.$id
      },
      client_name: `${user.firstName || 'User'} ${user.lastName || ''}`.trim(),
      products: ['auth', 'transactions'] as Products[],
      language: 'en',
      country_codes: ['US'] as CountryCode[],
    }

    const response = await plaidClient.linkTokenCreate(tokenParams);

    return parseStringify({ linkToken: response.data.link_token })
  } catch (error) {
    console.log(error);
  }
}

export const createBankAccount = async ({
  userId,
  bankId,
  accountId,
  accessToken,
  fundingSourceUrl,
  shareableId,
}: createBankAccountProps) => {
  try {
    const { database } = await createAdminClient();

    let bankAccount;
    try {
      bankAccount = await database.createDocument(
        DATABASE_ID!,
        BANK_COLLECTION_ID!,
        ID.unique(),
        {
          userId,
          bankId,
          accountId,
          accessToken,
          fundingSourceUrl,
          shareableId,
        }
      );
    } catch {
      // Appwrite documents.write scope is missing, fallback to local storage
    }

    const savedBank = saveLocalBankAccount({
      $id: bankAccount?.$id,
      userId,
      bankId,
      accountId,
      accessToken,
      fundingSourceUrl,
      shareableId,
    });

    return parseStringify(bankAccount || savedBank);
  } catch {
    const localBank = saveLocalBankAccount({
      userId,
      bankId,
      accountId,
      accessToken,
      fundingSourceUrl,
      shareableId,
    });
    return parseStringify(localBank);
  }
}

export const exchangePublicToken = async ({
  publicToken,
  user,
}: exchangePublicTokenProps) => {
  try {
    // Exchange public token for access token and item ID
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;
    
    // Get account information from Plaid using the access token
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accountData = accountsResponse.data.accounts[0];

    // Create a processor token for Dwolla if user has a Dwolla customer ID
    let fundingSourceUrl = "";
    try {
      const dwollaCustomerId = user?.dwollaCustomerId || getLocalUser(user?.$id || user?.userId)?.dwollaCustomerId;
      if (dwollaCustomerId) {
        const request: ProcessorTokenCreateRequest = {
          access_token: accessToken,
          account_id: accountData.account_id,
          processor: "dwolla" as ProcessorTokenCreateRequestProcessorEnum,
        };

        const processorTokenResponse = await plaidClient.processorTokenCreate(request);
        const processorToken = processorTokenResponse.data.processor_token;

        fundingSourceUrl = (await addFundingSource({
          dwollaCustomerId,
          processorToken,
          bankName: accountData.name,
        })) || "";
      }
    } catch (dwollaError) {
      console.warn("Dwolla funding source creation skipped or failed:", dwollaError);
    }

    // Create a bank account using the user ID, item ID, account ID, access token, funding source URL, and shareableId ID
    await createBankAccount({
      userId: user?.$id || user?.userId,
      bankId: itemId,
      accountId: accountData.account_id,
      accessToken,
      fundingSourceUrl: fundingSourceUrl || "",
      shareableId: encryptId(accountData.account_id),
    });

    // Revalidate the path to reflect the changes
    revalidatePath("/");

    // Return a success message
    return parseStringify({
      publicTokenExchange: "complete",
    });
  } catch (error) {
    console.error("An error occurred while exchanging token:", error);
  }
}

export const getBanks = async ({ userId }: getBanksProps) => {
  try {
    const { database } = await createAdminClient();

    let remoteBanks: any[] = [];
    try {
      const banks = await database.listDocuments(
        DATABASE_ID!,
        BANK_COLLECTION_ID!,
        [Query.equal('userId', [userId])]
      );
      remoteBanks = banks?.documents || [];
    } catch {
      // Appwrite documents.read scope missing; use local store
    }

    const localBanks = getLocalBanks(userId);
    const allBanks = [...remoteBanks];
    for (const lb of localBanks) {
      if (!allBanks.some((b) => b.accountId === lb.accountId || b.$id === lb.$id)) {
        allBanks.push(lb);
      }
    }

    return parseStringify(allBanks);
  } catch {
    return parseStringify(getLocalBanks(userId));
  }
}

export const getBank = async ({ documentId }: getBankProps) => {
  try {
    if (!documentId || documentId === 'undefined') return null;

    const localBank = getLocalBank(documentId);
    if (localBank) return parseStringify(localBank);

    const { database } = await createAdminClient();

    let remoteBank = null;
    try {
      const bank = await database.listDocuments(
        DATABASE_ID!,
        BANK_COLLECTION_ID!,
        [Query.equal('$id', [documentId])]
      );
      if (bank?.documents && bank.documents.length > 0) {
        remoteBank = bank.documents[0];
      }
    } catch {
      // Appwrite documents.read scope missing; fallback to local store
    }

    return parseStringify(remoteBank || localBank);
  } catch {
    return parseStringify(getLocalBank(documentId));
  }
}

export const getBankByAccountId = async ({ accountId }: getBankByAccountIdProps) => {
  try {
    if (!accountId || accountId === 'undefined') return null;

    const localBank = getLocalBankByAccountId(accountId);
    if (localBank) return parseStringify(localBank);

    const { database } = await createAdminClient();

    let remoteBank = null;
    try {
      const bank = await database.listDocuments(
        DATABASE_ID!,
        BANK_COLLECTION_ID!,
        [Query.equal('accountId', [accountId])]
      );
      if (bank?.documents && bank.documents.length > 0) {
        remoteBank = bank.documents[0];
      }
    } catch {
      // Appwrite documents.read scope missing; fallback to local store
    }

    return parseStringify(remoteBank || localBank);
  } catch {
    return parseStringify(getLocalBankByAccountId(accountId));
  }
}