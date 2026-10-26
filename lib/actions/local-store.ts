import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

function writeJsonFile<T>(filename: string, data: T) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write local data store ${filename}:`, error);
  }
}

export function saveLocalUser(user: any) {
  const users = readJsonFile<any[]>('users.json', []);
  const index = users.findIndex((u) => u.userId === user.userId || u.$id === user.$id);
  const updatedUser = {
    $id: user.$id || user.userId || `user_${Date.now()}`,
    ...user,
  };
  if (index >= 0) {
    users[index] = { ...users[index], ...updatedUser };
  } else {
    users.push(updatedUser);
  }
  writeJsonFile('users.json', users);
  return updatedUser;
}

export function getLocalUser(userId: string): any | null {
  const users = readJsonFile<any[]>('users.json', []);
  return users.find((u) => u.userId === userId || u.$id === userId) || null;
}

export function saveLocalBankAccount(bank: any) {
  const banks = readJsonFile<any[]>('banks.json', []);
  const generatedId = (bank && bank.$id) || `bank_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const index = banks.findIndex((b) => b.accountId === bank.accountId && b.userId === bank.userId);

  const bankRecord = {
    ...bank,
    $id: (bank && bank.$id) || (index >= 0 && banks[index].$id ? banks[index].$id : generatedId),
    $createdAt: (index >= 0 ? banks[index].$createdAt : undefined) || new Date().toISOString(),
  };

  if (index >= 0) {
    banks[index] = bankRecord;
  } else {
    banks.push(bankRecord);
  }
  writeJsonFile('banks.json', banks);
  return bankRecord;
}

export function getLocalBanks(userId: string): any[] {
  const banks = readJsonFile<any[]>('banks.json', []);
  const users = readJsonFile<any[]>('users.json', []);
  const matchingUser = users.find((u) => u.userId === userId || u.$id === userId);
  const validIds = new Set<string>([userId]);
  if (matchingUser) {
    if (matchingUser.userId) validIds.add(matchingUser.userId);
    if (matchingUser.$id) validIds.add(matchingUser.$id);
  }

  let modified = false;
  const filtered = banks.filter((b) => validIds.has(b.userId)).map((b) => {
    if (!b.$id) {
      b.$id = `bank_${b.accountId || Date.now()}`;
      modified = true;
    }
    return b;
  });

  if (modified) {
    writeJsonFile('banks.json', banks);
  }

  return filtered;
}

export function getLocalBank(documentId: string): any | null {
  const banks = readJsonFile<any[]>('banks.json', []);
  return (
    banks.find(
      (b) =>
        b.$id === documentId ||
        b.accountId === documentId ||
        b.bankId === documentId ||
        b.shareableId === documentId
    ) || null
  );
}

export function getLocalBankByAccountId(accountId: string): any | null {
  const banks = readJsonFile<any[]>('banks.json', []);
  return banks.find((b) => b.accountId === accountId || b.$id === accountId) || null;
}

export function saveLocalTransaction(transaction: any) {
  const txs = readJsonFile<any[]>('transactions.json', []);
  const newTx = {
    $id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    $createdAt: new Date().toISOString(),
    channel: 'online',
    category: 'Transfer',
    ...transaction,
  };
  txs.push(newTx);
  writeJsonFile('transactions.json', txs);
  return newTx;
}

export function getLocalTransactions(bankId: string): { total: number; documents: any[] } {
  const txs = readJsonFile<any[]>('transactions.json', []);
  const matching = txs.filter((t) => t.senderBankId === bankId || t.receiverBankId === bankId);
  return {
    total: matching.length,
    documents: matching,
  };
}
