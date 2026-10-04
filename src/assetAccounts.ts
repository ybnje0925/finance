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

// A workbook can contain several monthly sheets. The sheet date takes priority over its filename.
export const getAssetSourceMonth = (sheetName: string, fileName: string, fallbackYear: number): string | null => {
  const parse = (text: string, year: number) => {
    const named = text.match(/(?<!\d)(1[0-2]|0?[1-9])\s*월/);
    const explicitYear = text.match(/(20\d{2})/);
    if (named) return `${explicitYear ? explicitYear[1] : year}-${String(Number(named[1])).padStart(2, "0")}`;
    const compact = text.match(/(20\d{2})[-_.\s]?(0[1-9]|1[0-2])/);
    return compact ? `${compact[1]}-${compact[2]}` : null;
  };
  const fileMonth = parse(fileName, fallbackYear);
  return parse(sheetName, fileMonth ? Number(fileMonth.slice(0, 4)) : fallbackYear) || fileMonth;
};
