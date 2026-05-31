const XLSX = require('xlsx');
const fs = require('fs');

console.log('Reading Excel file...');
const wb = XLSX.readFile('Master_Data.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws);
console.log(`Loaded ${data.length} rows`);

// Month ordering
const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Convert month number to name (handles both "1" and "January")
function toMonthName(val) {
  if (!val) return null;
  const str = String(val).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return MONTH_ORDER[num - 1];
  }
  // Already a name
  if (MONTH_ORDER.includes(str)) return str;
  return str;
}

// Collect unique values
const cabangs = [...new Set(data.map(r => r['Cabang']).filter(Boolean))].sort();
const months = [...new Set(data.map(r => toMonthName(r['Month'])).filter(Boolean))].sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));

console.log('Cabang:', cabangs);
console.log('Months:', months);

// Build aggregated structure
// Key: "cabang|month" or "ALL|month" or "cabang|ALL" or "ALL|ALL"
function getKey(cabang, month) {
  return `${cabang}|${month}`;
}

const agg = {};

function ensureBucket(key) {
  if (!agg[key]) {
    agg[key] = {
      dailySales: {},
      hourlySales: {},
      billSet: new Set(),
      visitPurpose: {},
      paymentMethod: {},
      menuQty: {},
      menuTotal: {},
      totalSales: 0,
      totalTransactions: 0
    };
  }
  return agg[key];
}

function addToBucket(bucket, row) {
  const day = row['Day'];
  const hour = row['Hour'];
  const total = row['Total'] || 0;
  const salesNum = row['Sales Number'];
  const visitPurpose = row['Visit Purpose'] || 'Unknown';
  const paymentMethod = row['Payment Method'] || 'Unknown';
  const monthRaw = row['Month'];
  const month = toMonthName(monthRaw) || 'Unknown';
  row['Month'] = month; // update row with month name

  const menu = row['Menu'] || 'Unknown';
  const qty = row['Qty'] || 0;

  // Daily sales
  if (day !== undefined && day !== null) {
    bucket.dailySales[day] = (bucket.dailySales[day] || 0) + total;
  }

  // Hourly sales
  if (hour !== undefined && hour !== null) {
    bucket.hourlySales[hour] = (bucket.hourlySales[hour] || 0) + total;
  }

  // Total sales
  bucket.totalSales += total;

  // Bills (unique Sales Number)
  if (salesNum) {
    bucket.billSet.add(salesNum);
  }

  // Visit Purpose
  bucket.visitPurpose[visitPurpose] = (bucket.visitPurpose[visitPurpose] || 0) + total;

  // Payment Method (count by unique bill to avoid counting per item)
  bucket.paymentMethod[paymentMethod] = (bucket.paymentMethod[paymentMethod] || 0) + 1;

  // Menu qty & total
  bucket.menuQty[menu] = (bucket.menuQty[menu] || 0) + qty;
  bucket.menuTotal[menu] = (bucket.menuTotal[menu] || 0) + total;
}

console.log('Aggregating data...');
let count = 0;
data.forEach(row => {
  const cabang = row['Cabang'] || 'Unknown';
  const month = toMonthName(row['Month']) || 'Unknown';

  // Specific cabang + specific month
  addToBucket(ensureBucket(getKey(cabang, month)), row);

  // All cabang + specific month
  addToBucket(ensureBucket(getKey('Semua Cabang', month)), row);

  // Specific cabang + all months
  addToBucket(ensureBucket(getKey(cabang, 'Semua Bulan')), row);

  // All cabang + all months
  addToBucket(ensureBucket(getKey('Semua Cabang', 'Semua Bulan')), row);

  count++;
  if (count % 50000 === 0) console.log(`Processed ${count} rows...`);
});

// Convert sets to counts and sort top menus
const result = {
  cabangs: ['Semua Cabang', ...cabangs],
  months: ['Semua Bulan', ...months],
  data: {}
};

Object.keys(agg).forEach(key => {
  const bucket = agg[key];

  // Sort menu by total revenue and get top 10
  const topMenu = Object.entries(bucket.menuTotal)
    .map(([menu, total]) => ({ menu, total, qty: bucket.menuQty[menu] || 0 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  result.data[key] = {
    dailySales: bucket.dailySales,
    hourlySales: bucket.hourlySales,
    totalBills: bucket.billSet.size,
    totalSales: bucket.totalSales,
    visitPurpose: bucket.visitPurpose,
    paymentMethod: bucket.paymentMethod,
    topMenu: topMenu
  };
});

const json = JSON.stringify(result);
fs.writeFileSync('dashboard_data.json', json);
console.log(`\nDone! Output: dashboard_data.json (${(json.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`Keys: ${Object.keys(result.data).length}`);
