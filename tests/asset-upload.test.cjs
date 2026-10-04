const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const xlsx = require('xlsx');
const helpers = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/assetAccounts.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText)(helpers);
assert.equal(helpers.getAssetSourceMonth('7월', '202608(asset)yb.xlsx', 2026), '2026-07');
assert.equal(helpers.getAssetSourceMonth('9월', '202608(asset)yb.xlsx', 2026), '2026-09');
assert.equal(helpers.getAssetSourceMonth('2025년 12월', '202608(asset)yb.xlsx', 2026), '2025-12');
assert.equal(helpers.getAssetSourceMonth('Sheet1', '202608(asset)yb.xlsx', 2026), '2026-08');
const source = fs.readFileSync('src/App.tsx', 'utf8');
const handlerSource = source.slice(source.indexOf('  const handleAssetsExcelUpload ='), source.indexOf('  // Toggle item active state'));
const code = ts.transpileModule(handlerSource, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
const sheet = (amount) => xlsx.utils.aoa_to_sheet([
  ['항목', '상품명', '금액'], ['자유입출금 자산', 'NH주거래우대통장', amount],
  [null, '입출금통장', 6256443], [null, '입출금통장', 7000], ['저축성 자산', 'NH올원e적금', 400000],
  ['투자성 자산', '투자계좌', 100000], ['총자산', '합계', amount + 6763443],
]);
function setup(existing = {}) {
  let result, saveCount = 0; const alerts = [];
  const context = {
    read: xlsx.read, utils: xlsx.utils, uniqueMonths: ['2026-08'], selectedMonth: '2026-08', selectedAssetMonth: '', latestAssetMonth: '', assetSnapshots: existing,
    emptyAssetSnapshot: () => ({freeAssets: [], savingsAssets: [], electronicAssets: [], investmentAssets: []}), cloneAssetSnapshot: value => structuredClone(value),
    getAssetMonthKeyFromText: (text, year) => helpers.getAssetSourceMonth('', text, year), getAssetSourceMonth: helpers.getAssetSourceMonth,
    getOwnerPrefixFromAssetSource: () => '[영범] ', LIABILITY_MORTGAGE: {amount: 600000000, rate: 4.08}, numberDuplicateAccounts: helpers.numberDuplicateAccounts,
    setAssetSnapshots: value => result = value, setSelectedAssetMonth: () => {}, setFreeAssets: () => {}, setSavingsAssets: () => {}, setElectronicAssets: () => {}, setInvestmentAssets: () => {}, setAssetCompareMonths: () => {}, setAssetsFileName: () => {},
    syncAssetsReplaceToSupabase: () => {saveCount++;}, updateHouseholdSettingsInSupabase: () => {}, localStorage: {setItem: () => {}}, alert: message => alerts.push(message),
    FileReader: class {readAsBinaryString(file) {this.onload({target: {result: file.data}});}},
  };
  return {handler: new Function(...Object.keys(context), code + '; return handleAssetsExcelUpload;')(...Object.values(context)), result: () => result, saves: () => saveCount, alerts};
}
function event(workbook) {return {target: {files: [{name: '202608(asset)yb.xlsx', data: xlsx.write(workbook, {type: 'binary', bookType: 'xlsx'})}]}, currentTarget: {value: ''}};}
(async () => {
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet(11640760), '7월');
  xlsx.utils.book_append_sheet(workbook, sheet(9255322), '8월');
  xlsx.utils.book_append_sheet(workbook, sheet(7296387), '9월');
  const snapshot = {freeAssets: [{name: '[영범] 잘못 합산된 통장', amount: 62560354}, {name: '[재은] 통장', amount: 123}], savingsAssets: [], electronicAssets: [], investmentAssets: []};
  const test = setup({'2026-09': snapshot}); await test.handler(event(workbook));
  assert.deepEqual(Object.keys(test.result()).sort(), ['2026-07', '2026-08', '2026-09']);
  const balances = Object.keys(test.result()).sort().map(month => test.result()[month].freeAssets.find(account => account.name === '[영범] NH주거래우대통장').amount);
  assert.deepEqual(balances, [11640760, 9255322, 7296387]);
  const september = test.result()['2026-09'];
  assert(!september.freeAssets.some(account => account.name.includes('잘못 합산')));
  assert(september.freeAssets.some(account => account.name === '[재은] 통장' && account.amount === 123));
  assert.deepEqual(september.freeAssets.filter(account => account.name.includes('[영범] 입출금통장')).map(account => account.amount), [6256443, 7000]);
  assert.equal(september.investmentAssets[0].appraised, 100000);
  const ambiguous = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(ambiguous, sheet(100), '자산'); xlsx.utils.book_append_sheet(ambiguous, sheet(200), '재무현황');
  const rejected = setup(); const originalError = console.error; console.error = () => {};
  try {await rejected.handler(event(ambiguous));} finally {console.error = originalError;}
  assert.equal(rejected.saves(), 0); assert.equal(rejected.result(), undefined); assert(rejected.alerts.some(message => message.includes('중복')));
  const excelAmounts = [1430790, 498559, 41, 2, 7296387, 1107, 126, 5579136, 7000, 41880];
  const names = ['KB Star*t통장-저축예금', 'KB Wise통장-저축예금', 'KB국민ONE통장-저축예금', 'MY 입출금통장', 'NH주거래우대통장', 'U드림 저축예금 (인터넷전용)', 'WON 통장', '입출금통장', '입출금통장', '저금통'];
  const exactRows = [['항목', '상품명', '금액'], ...names.map((name, index) => [index === 0 ? '자유입출금 자산' : null, name, excelAmounts[index]]), ['저축성 자산', 'NH올원e적금', 400000], ['전자금융 자산', '카카오페이 머니', 291157], ['총자산', '합계', 0]];
  const exactWorkbook = xlsx.utils.book_new(); xlsx.utils.book_append_sheet(exactWorkbook, xlsx.utils.aoa_to_sheet(exactRows), '9월');
  const exact = setup(); await exact.handler(event(exactWorkbook)); const exactSnapshot = exact.result()['2026-09'];
  assert.equal(exactSnapshot.freeAssets.reduce((sum, account) => sum + account.amount, 0), 14855028);
  assert.equal(exactSnapshot.savingsAssets.reduce((sum, account) => sum + account.amount, 0), 400000);
  assert(!exactSnapshot.freeAssets.some(account => account.name.includes('페이')));
  console.log('PASS: 시트별 월 분리, 이전 자료 교체, 배우자 자료 보존, 동일명 계좌 보존, 투자 유지, 중복 업로드 저장 차단, 첨부 합계 검증');
})().catch(error => {console.error(error); process.exitCode = 1;});
