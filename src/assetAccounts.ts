export type AssetAccount = { name: string; amount: number };

export const numberDuplicateAccounts = (accounts: AssetAccount[]): AssetAccount[] => {
  const counts = new Map<string, number>();
  accounts.forEach(account => counts.set(account.name, (counts.get(account.name) || 0) + 1));
  const occurrences = new Map<string, number>();
  return accounts.map(account => {
    if ((counts.get(account.name) || 0) < 2) return { ...account };
    const number = (occurrences.get(account.name) || 0) + 1;
    occurrences.set(account.name, number);
    return { ...account, name: `${account.name} ${number}` };
  });
};

// Keep savings classification in the existing account table without a schema migration.
const savingsPrefix = "[저축성] ";
export const encodeAssetAccounts = (free: AssetAccount[], savings: AssetAccount[]) => [
  ...free.map(account => ({ ...account })),
  ...savings.map(account => ({ ...account, name: savingsPrefix + account.name })),
];
export const decodeAssetAccounts = (accounts: AssetAccount[]) => ({
  free: accounts.filter(account => !account.name.startsWith(savingsPrefix)),
  savings: accounts.filter(account => account.name.startsWith(savingsPrefix))
    .map(account => ({ ...account, name: account.name.slice(savingsPrefix.length) })),
});

export const normalizeAssetAccounts = (free: AssetAccount[], savings: AssetAccount[]) => {
  // Older imports mixed cash, wallets and savings into the deposit list.
  const isExcluded = (name: string) => /현금|페이|머니|포인트/.test(name);
  const isSavings = (name: string) => /적금|정기예금|청약/.test(name);
  return {
    free: free.filter(account => !isExcluded(account.name) && !isSavings(account.name)),
    savings: [...savings, ...free.filter(account => !isExcluded(account.name) && isSavings(account.name))],
  };
};
