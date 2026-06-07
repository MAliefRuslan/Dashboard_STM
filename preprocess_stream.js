const ExcelJS = require('exceljs');
const fs = require('fs');

console.log('Reading Excel file with stream...');

const MONTH_ORDER = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function toMonthName(val) {
  if (!val) return null;
  const str = String(val).trim();
  const num = parseInt(str, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) {
    return MONTH_ORDER[num - 1];
  }
  if (MONTH_ORDER.includes(str)) return str;
  return str;
}

const cabangsSet = new Set();
const monthsSet = new Set();
const agg = {};

function getKey(cabang, month) {
  return `${cabang}|${month}`;
}

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

function addToBucket(bucket, rowObj) {
  const day = rowObj['Day'];
  const hour = rowObj['Hour'];
  const total = rowObj['Total'] || 0;
  const salesNum = rowObj['Sales Number'];
  const visitPurpose = rowObj['Visit Purpose'] || 'Unknown';
  const paymentMethod = rowObj['Payment Method'] || 'Unknown';
  const month = rowObj['Month'];
  const menu = rowObj['Menu'] || 'Unknown';
  const qty = rowObj['Qty'] || 0;

  if (day !== undefined && day !== null) {
    bucket.dailySales[day] = (bucket.dailySales[day] || 0) + total;
  }

  if (hour !== undefined && hour !== null) {
    bucket.hourlySales[hour] = (bucket.hourlySales[hour] || 0) + total;
  }

  bucket.totalSales += total;

  if (salesNum) {
    bucket.billSet.add(salesNum);
  }

  bucket.visitPurpose[visitPurpose] = (bucket.visitPurpose[visitPurpose] || 0) + total;
  bucket.paymentMethod[paymentMethod] = (bucket.paymentMethod[paymentMethod] || 0) + 1;

  bucket.menuQty[menu] = (bucket.menuQty[menu] || 0) + qty;
  bucket.menuTotal[menu] = (bucket.menuTotal[menu] || 0) + total;
}

async function run() {
  const options = {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    worksheets: 'emit'
  };

  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader('./Master_Data.xlsx', options);
  
  let headers = [];
  let count = 0;

  for await (const worksheetReader of workbookReader) {
    for await (const row of worksheetReader) {
      if (!row.values) continue;
      
      // row.values is 1-indexed in exceljs
      const rowValues = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values).slice(1);
      
      if (count === 0) {
        // Headers
        headers = rowValues;
      } else {
        // Data row
        const rowObj = {};
        for(let i=0; i<headers.length; i++) {
          rowObj[headers[i]] = rowValues[i];
        }

        const cabang = rowObj['Cabang'] || 'Unknown';
        const monthRaw = rowObj['Month'];
        const month = toMonthName(monthRaw) || 'Unknown';
        rowObj['Month'] = month;

        cabangsSet.add(cabang);
        monthsSet.add(month);

        addToBucket(ensureBucket(getKey(cabang, month)), rowObj);
        addToBucket(ensureBucket(getKey('Semua Cabang', month)), rowObj);
        addToBucket(ensureBucket(getKey(cabang, 'Semua Bulan')), rowObj);
        addToBucket(ensureBucket(getKey('Semua Cabang', 'Semua Bulan')), rowObj);
      }
      
      count++;
      if (count % 10000 === 0) console.log(`Processed ${count} rows...`);
    }
    // Only process first sheet
    break;
  }

  console.log(`Finished streaming. Sorting and saving...`);
  
  const cabangs = Array.from(cabangsSet).sort();
  const months = Array.from(monthsSet).sort((a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b));

  const result = {
    cabangs: ['Semua Cabang', ...cabangs],
    months: ['Semua Bulan', ...months],
    data: {}
  };

  Object.keys(agg).forEach(key => {
    const bucket = agg[key];
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
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
