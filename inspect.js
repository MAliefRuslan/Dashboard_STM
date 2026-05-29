const XLSX = require('xlsx');
const wb = XLSX.readFile('Master_Data.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);

console.log('Sheet names:', wb.SheetNames);
console.log('Total rows:', data.length);
console.log('Columns:', Object.keys(data[0]));
console.log('\n--- First 3 rows ---');
for (let i = 0; i < 3; i++) {
  console.log(JSON.stringify(data[i], null, 2));
}

// Unique values for key columns
const cols = ['cabang', 'month', 'day', 'Hour', 'visit purpose', 'payment methode'];
cols.forEach(col => {
  const vals = [...new Set(data.map(r => r[col]).filter(v => v !== undefined))];
  console.log(`\n${col} unique (${vals.length}):`, vals.slice(0, 15));
});

// Check sales/total columns
const numCols = Object.keys(data[0]);
console.log('\n--- Sample values for numeric cols ---');
numCols.forEach(col => {
  const sample = data.slice(0, 3).map(r => r[col]);
  console.log(`${col}: ${JSON.stringify(sample)}`);
});
