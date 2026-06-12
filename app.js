// Global variables
let dashboardData = null;
let charts = {
  daily: null,
  hourly: null,
  payment: null,
  topMenu: null
};
let miniCharts = {
  time: null,
  product: null,
  business: null,
  marketing: null,
  instagram: null,
  predictive: null
};

// -----------------------------------------
// Predictive Analytics (Linear Regression)
// -----------------------------------------
function calculateLinearRegression(values) {
  const n = values.length;
  if (n === 0) return 0;
  if (n === 1) return values[0];
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Predict the next value (index n)
  return Math.max(0, slope * n + intercept); // Ensure prediction is not negative
}

// Generate historical data array for regression
const ALL_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function getHistoricalSales(cabang, currentMonth) {
  const dataMap = dashboardData.data;
  const currentMonthIdx = ALL_MONTHS.indexOf(currentMonth);
  if (currentMonthIdx <= 0) return []; // No previous history if January or 'Semua Bulan'
  
  let history = [];
  for (let i = 0; i <= currentMonthIdx; i++) {
    const key = `${cabang}|${ALL_MONTHS[i]}`;
    if (dataMap[key] && dataMap[key].totalSales) {
      history.push(dataMap[key].totalSales);
    } else {
      // Missing data handling (could interpolate, but here we just push 0 or skip)
      // Since it's continuous, let's break if we encounter a gap before current month?
      // Actually we know data is contiguous.
      history.push(0); 
    }
  }
  return history;
}

// Formatters
const formatCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

const formatNumber = (value) => {
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatCompactCurrency = (value) => {
  return new Intl.NumberFormat('id-ID', { 
    style: 'currency', 
    currency: 'IDR', 
    notation: 'compact', 
    maximumFractionDigits: 1 
  }).format(value);
};

// DOM Elements (initialized in init())
let elements = {};

// Init Application
async function init() {
  // Initialize DOM elements after DOM is ready
  elements = {
    filterCabang: document.getElementById('filterCabang'),
    filterMonth: document.getElementById('filterMonth'),
    kpiRevenue: document.getElementById('kpiRevenue'),
    kpiBills: document.getElementById('kpiBills'),
    kpiAvg: document.getElementById('kpiAvg'),
    kpiVisitTypes: document.getElementById('kpiVisitTypes'),
    visitCards: document.getElementById('visitCards'),
    lastUpdate: document.getElementById('lastUpdate'),
    loadingOverlay: document.getElementById('loadingOverlay')
  };

  try {
    showLoading();
    
    // Fetch preprocessed data
    const response = await fetch('dashboard_data.json');
    if (!response.ok) throw new Error('Failed to load data');
    
    dashboardData = await response.json();
    
    // Populate filters
    populateFilters();
    
    // Set initial date
    elements.lastUpdate.textContent = `Updated: ${new Date().toLocaleString('id-ID')}`;
    
    // Add event listeners
    elements.filterCabang.addEventListener('change', updateDashboard);
    elements.filterMonth.addEventListener('change', updateDashboard);
    
    // Initial render
    updateDashboard();
    
  } catch (error) {
    console.error('Error init:', error);
    alert('Gagal memuat data dashboard. Pastikan dashboard_data.json tersedia.');
  } finally {
    hideLoading();
  }
}

function populateFilters() {
  // Cabang
  elements.filterCabang.innerHTML = '';
  dashboardData.cabangs.forEach(cabang => {
    const option = document.createElement('option');
    option.value = cabang;
    option.textContent = cabang;
    elements.filterCabang.appendChild(option);
  });
  
  // Month
  elements.filterMonth.innerHTML = '';
  dashboardData.months.forEach(month => {
    const option = document.createElement('option');
    option.value = month;
    option.textContent = month;
    elements.filterMonth.appendChild(option);
  });
}

function resetFilters() {
  elements.filterCabang.value = dashboardData.cabangs[0];
  elements.filterMonth.value = dashboardData.months[0];
  updateDashboard();
}

function toggleMobileMenu() {
  const menu = document.getElementById('navbarMenu');
  if (menu) {
    menu.classList.toggle('show');
  }
}

function showLoading() {
  if (elements.loadingOverlay) elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  setTimeout(() => {
    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
  }, 300); // small delay for smoother transition
}

// Update Dashboard
function updateDashboard() {
  const cabang = elements.filterCabang.value;
  const month = elements.filterMonth.value;
  const key = `${cabang}|${month}`;
  
  const data = dashboardData.data[key];
  if (!data) {
    console.warn('No data for key:', key);
    return;
  }
  
  updateKPIs(data);
  updateVisitPurpose(data);
  generateInsights(data, cabang, month);
  renderCharts(data);
}

function updateKPIs(data) {
  const revenue = data.totalSales || 0;
  const bills = data.totalBills || 0;
  const avg = bills > 0 ? revenue / bills : 0;
  const visitTypes = Object.keys(data.visitPurpose).length;
  
  // Animate numbers
  animateValue(elements.kpiRevenue, revenue, true);
  animateValue(elements.kpiBills, bills, false);
  animateValue(elements.kpiAvg, avg, true);
  
  elements.kpiVisitTypes.textContent = visitTypes;
}

function updateVisitPurpose(data) {
  elements.visitCards.innerHTML = '';
  
  const total = data.totalSales || 1; // avoid div by 0
  
  // Sort by count
  const sorted = Object.entries(data.visitPurpose)
    .sort((a, b) => b[1] - a[1]);
    
  sorted.forEach(([purpose, count]) => {
    const pct = ((count / total) * 100).toFixed(1);
    
    const card = document.createElement('div');
    card.className = 'visit-card';
    card.innerHTML = `
      <div class="visit-card-label">${purpose}</div>
      <div class="visit-card-value">${formatCompactCurrency(count)}</div>
      <div class="visit-card-pct">${pct}%</div>
    `;
    elements.visitCards.appendChild(card);
  });
  
  if (sorted.length === 0) {
    elements.visitCards.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center;">Tidak ada data</p>';
  }
}

const MONTH_ORDER = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// AI Insights Generator (Makassar F&B Context - Tempat Makan)
function generateInsights(data, cabang, month) {
  // Get Previous Data for MoM
  let prevData = null;
  let prevMonthName = null;
  if (month !== 'Semua Bulan') {
    const monthIdx = MONTH_ORDER.indexOf(month);
    if (monthIdx > 0) {
      prevMonthName = MONTH_ORDER[monthIdx - 1];
      const prevKey = `${cabang}|${prevMonthName}`;
      prevData = dashboardData.data[prevKey];
    }
  }

  // Get Next Month for predictive text
  let nextMonthName = 'Bulan Depan';
  if (month !== 'Semua Bulan') {
    const monthIdx = MONTH_ORDER.indexOf(month);
    if (monthIdx >= 0 && monthIdx < MONTH_ORDER.length - 1) {
      nextMonthName = MONTH_ORDER[monthIdx + 1];
    }
  }

  // 1. Time Analysis
  let peakHour = null;
  let maxSales = 0;
  if (data.hourlySales) {
    for (const [hour, sales] of Object.entries(data.hourlySales)) {
      if (sales > maxSales) {
        maxSales = sales;
        peakHour = parseInt(hour, 10);
      }
    }
  }

  let timeText = 'Data historis belum cukup untuk membuat perencanaan jam operasional.';
  if (peakHour !== null) {
    timeText = `<strong>Perencanaan Operasional (${nextMonthName}):</strong> Berdasarkan lonjakan trafik di pukul <strong>${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00</strong> pada bulan ${month}, `;
    if (peakHour >= 16 && peakHour <= 18) {
      timeText += 'jadwalkan <em>staff briefing</em> dan finalisasi <em>prep</em> dapur selambatnya pukul 15.30. Alokasikan kru tambahan di area depan untuk mengatur antrean awal buka.';
    } else if (peakHour >= 19 && peakHour <= 21) {
      timeText += 'alokasikan jumlah kru kasir dan pelayan maksimal (Full Team) pada rentang "Prime Dinner Time" ini. Siapkan meja panjang untuk rombongan keluarga agar <em>turnover</em> meja tetap cepat.';
    } else {
      timeText += 'atur jadwal <em>shift</em> kru untuk memastikan layanan cepat di larut malam. Fokuskan perencanaan pada penerangan area parkir dan keamanan pengunjung.';
    }
  }

  if (prevData && prevData.hourlySales) {
    let prevMax = 0;
    let prevPeak = null;
    for (const [hour, sales] of Object.entries(prevData.hourlySales)) {
      if (sales > prevMax) { prevMax = sales; prevPeak = parseInt(hour, 10); }
    }
    if (prevPeak !== null && prevPeak !== peakHour) {
      timeText += `<br><br>⚠️ <em>Action Item:</em> Antisipasi pergeseran trafik pengunjung. Sesuaikan jadwal istirahat karyawan agar tidak bentrok dengan jam ${String(peakHour).padStart(2, '0')}:00.`;
    }
  }

  document.getElementById('insightTime').innerHTML = timeText;

  // 2. Product Prediction & Bundling
  let productText = 'Data belum cukup untuk membuat perencanaan inventory.';
  if (data.topMenu && data.topMenu.length >= 2) {
    const top1 = data.topMenu[0].menu;
    const top2 = data.topMenu[1].menu;
    const isTaichan = top1.toLowerCase().includes('taichan') || top1.toLowerCase().includes('sate');
    productText = `<strong>Perencanaan Menu & Inventory (${nextMonthName}):</strong> Prioritaskan pengadaan pasokan bahan baku (<em>supply chain</em>) untuk <strong>${top1}</strong> dan <strong>${top2}</strong>. `;
    if (isTaichan) {
      productText += 'Siapkan skema <strong>Paket Makan Bundling</strong> (Sate + Minuman) bulan depan sebagai standar <i>upselling</i> kasir guna mendongkrak rata-rata pembelian per struk.';
    } else {
      productText += 'Rancang paket promosi bundling kedua menu unggulan ini untuk di-<em>push</em> pada materi pemasaran bulan depan.';
    }

    if (prevData && prevData.topMenu && prevData.topMenu.length > 0) {
      const prevTop1 = prevData.topMenu[0].menu;
      if (top1 !== prevTop1) {
        productText += `<br><br>📦 <em>Action Item:</em> Kalibrasi ulang rasio belanja stok bahan baku ke supplier karena terdapat pergantian tren dari ${prevTop1} ke ${top1}.`;
      } else {
        productText += `<br><br>📦 <em>Action Item:</em> Negosiasikan harga bahan baku grosir untuk <strong>${top1}</strong> dengan supplier (karena volume stabil tinggi), guna memperlebar margin profit bulan depan.`;
      }
    }
  }
  document.getElementById('insightProduct').innerHTML = productText;

  // 3. Business Decision & Location Context
  let businessText = `<strong>Perencanaan Bisnis Eksekutif:</strong><br><br>`;
  let topPayment = null;
  let maxPay = 0;
  if (data.paymentMethod) {
    for (const [method, count] of Object.entries(data.paymentMethod)) {
      if (count > maxPay) {
        maxPay = count;
        topPayment = method;
      }
    }
  }

  if (topPayment) {
    const isEwallet = topPayment.toLowerCase().includes('qris') || topPayment.toLowerCase().includes('gopay') || topPayment.toLowerCase().includes('ovo') || topPayment.toLowerCase().includes('shopee');
    if (isEwallet) {
      businessText += `💳 <em>Strategi Transaksi:</em> Cetak dan tempatkan ulang materi QRIS/E-Wallet di setiap meja agar pelanggan bisa order & bayar langsung (self-ordering system) untuk mengurangi antrean di kasir utama. `;
    } else {
      businessText += `💳 <em>Strategi Transaksi:</em> Siapkan uang kembalian (receh) yang memadai sebagai persiapan lonjakan pelanggan, karena <strong>${topPayment}</strong> mendominasi transaksi. `;
    }
  }

  if (prevData && data.totalSales && prevData.totalSales > 0) {
    const currentSales = data.totalSales;
    const prevSales = prevData.totalSales;
    const diff = currentSales - prevSales;
    const pct = (diff / prevSales * 100).toFixed(1);
    if (diff > 0) {
      businessText += `<br><br>🎯 <em>Action Plan Keuangan:</em> Alokasikan surplus omzet (+${pct}%) bulan ini untuk budget marketing digital bulan depan (Ads/KOL) guna mengunci momentum pertumbuhan.`;
    } else {
      businessText += `<br><br>⚠️ <em>Action Plan Keuangan:</em> Bentuk tim audit kecil untuk mengevaluasi *food waste* dan menekan *operational cost*, merespons tren penurunan omzet ${pct}%.`;
    }
  }

  if (cabang.toLowerCase().includes('pettarani')) {
    businessText += '<br><br>📍 <em>Taktik Cab. Pettarani:</em> Implementasikan promo "After Office Hour" (16.30-18.30). Siapkan media promosi berupa spanduk depan yang terlihat jelas oleh karyawan ruko yang pulang kerja, tawarkan tempat persinggahan nyaman anti-macet.';
  } else if (cabang.toLowerCase().includes('mappanyukki')) {
    businessText += '<br><br>📍 <em>Taktik Cab. Mappanyukki:</em> Fokuskan pada percepatan <em>table turnover</em> (rotasi meja) di atas jam 21.00. Hindari paket "nongkrong". Terapkan alur pesanan ekspres dan tawarkan "Paket Makan Cepat" agar pelanggan segera berganti. Pastikan koordinasi parkir berjalan cepat untuk mencegah kemacetan pengunjung.';
  } else {
    businessText += '<br><br>📍 <em>Taktik Operasional:</em> Rencanakan pengadaan *packaging* khusus pesan-antar skala besar dengan penahan panas (*thermal*) untuk memastikan standar kualitas pengiriman tetap kompetitif di jam-jam larut malam.';
  }
  
  document.getElementById('insightBusiness').innerHTML = businessText || 'Data belum cukup.';

  // 4. Marketing Analysis (4P) & Real-time Trends
  let marketingText = '';
  let topProductForMkt = 'Sate Taichan';
  if (data.topMenu && data.topMenu.length > 0) {
    topProductForMkt = data.topMenu[0].menu;
  }
  
  const avgBill = data.totalBills > 0 ? (data.totalSales / data.totalBills) : 0;

  marketingText += `<strong>Rencana Eksekusi Marketing (Strategi 4P):</strong><br><br>`;
  marketingText += `<strong>1. Product Action:</strong> Standarisasi ulang estetika *plating* (penyajian) untuk <em>${topProductForMkt}</em>. Buat SOP baru untuk kru dapur agar setiap porsi yang keluar "Camera Ready" untuk mendorong pemasaran organik dari pelanggan.<br><br>`;
  
  if (avgBill > 0 && avgBill < 35000) {
    marketingText += `<strong>2. Price Action:</strong> Gaungkan *tagline* "Makan Kenyang, Harga Tenang" di semua banner digital bulan depan, memaksimalkan fakta bahwa *Average Bill* sangat ramah kantong masyarakat Makassar.<br><br>`;
  } else {
    marketingText += `<strong>2. Price Action:</strong> Rancang satu menu *entry-level* (Harga Pelajar/Mahasiswa) untuk bulan depan guna mengakuisisi target pasar anak muda Makassar yang sensitif terhadap harga.<br><br>`;
  }
  
  marketingText += `<strong>3. Place Action:</strong> Siapkan denah (*layout*) baru bulan depan untuk secara fisik memisahkan jalur antrean/pengambilan *driver* Ojol dan antrean pelanggan *dine-in* agar tidak terjadi penumpukan (*bottleneck*) di jam sibuk.<br><br>`;
  marketingText += `<strong>4. Promotion Action:</strong> Terapkan sistem *Loyalty Program* digital (Kumpulkan 5 stamp = 1 porsi gratis). Cetak materi promo *table-tent* untuk diletakkan di setiap meja agar kasir mudah menawarkannya.`;

  document.getElementById('insightMarketing').innerHTML = marketingText;

  // 5. Instagram Content Strategy (@satetaichanmappanyukki)
  let igText = '';
  const igHandle = '@satetaichanmappanyukki';

  // Determine top menu for content focus
  let contentFocusMenu = 'Sate Taichan';
  let secondMenu = '';
  if (data.topMenu && data.topMenu.length >= 2) {
    contentFocusMenu = data.topMenu[0].menu;
    secondMenu = data.topMenu[1].menu;
  }

  // Determine peak hour for posting schedule
  let bestPostHour = '17:00';
  let peakLabel = 'sore';
  if (data.hourlySales && data.hourlySales.length > 0) {
    const peakEntry = data.hourlySales.reduce((a, b) => a.total > b.total ? a : b);
    const peakHr = parseInt(peakEntry.hour);
    // Post 2 hours before peak to build anticipation
    const postHr = peakHr >= 2 ? peakHr - 2 : peakHr;
    bestPostHour = postHr.toString().padStart(2, '0') + ':00';
    if (peakHr >= 19) peakLabel = 'malam';
    else if (peakHr >= 16) peakLabel = 'sore';
  }

  // Calculate takeaway ratio for content angle
  let takeawayPct = 0;
  if (data.visitPurpose) {
    const entries = Object.entries(data.visitPurpose);
    const totalVisit = entries.reduce((s, [k, v]) => s + v, 0);
    const takeawaySum = entries
      .filter(([k, v]) => {
        const type = k.toLowerCase();
        return type.includes('take') || type.includes('ojol') || type.includes('grab') || type.includes('gofood') || type.includes('shopee');
      })
      .reduce((s, [k, v]) => s + v, 0);

    if (totalVisit > 0) {
      takeawayPct = Math.round((takeawaySum / totalVisit) * 100);
    }
  }

  igText += `<strong>📱 Content Plan & Timeline ${igHandle}:</strong><br><br>`;

  igText += `<strong>1. Produksi Video Pilar:</strong> Jadwalkan syuting video ASMR proses <em>pembakaran ${contentFocusMenu}</em> minggu depan. Gunakan lensa *close-up* untuk menangkap detail "api & sizzling" yang terbukti ampuh meraih algoritma *FoodTok* Makassar.`;
  if (secondMenu) {
    igText += ` Masukkan <em>${secondMenu}</em> sebagai cameo/konten pendamping.`;
  }
  igText += `<br><br>`;

  igText += `<strong>2. Penjadwalan Posting Otomatis:</strong> Setel *scheduler* (misal: Meta Business Suite) untuk mengunggah materi Reels/Stories secara rutin pada pukul <strong>${bestPostHour} WITA</strong>. Ini adalah rentang *golden time* ± 2 jam sebelum kedatangan massa ${peakLabel}.<br><br>`;

  igText += `<strong>3. Kalender Editorial Bulan Depan:</strong><br>`;
  igText += `&nbsp;&nbsp;• <em>Setiap Senin:</em> Posting format "Behind the Kitchen" untuk validasi kebersihan masakan.<br>`;
  igText += `&nbsp;&nbsp;• <em>Setiap Rabu:</em> Kurasi UGC (User Generated Content) dan Repost ke IG Story.<br>`;
  igText += `&nbsp;&nbsp;• <em>Jumat & Sabtu:</em> Eksekusi iklan berbayar (Boost Post) untuk paket promosi *weekend*.<br><br>`;

  if (takeawayPct > 30) {
    igText += `<strong>4. Kampanye Pesan-Antar:</strong> Siapkan materi visual berseri (foto karousel) dengan konsep <em>"Quality Delivery"</em>—menonjolkan *packaging* yang aman dan anti-tumpah, menargetkan pelanggan rumahan Ojol.<br><br>`;
  } else {
    igText += `<strong>4. Kampanye FOMO Dine-in:</strong> Kumpulkan *footage* suasana restoran yang ramai/antre. Edit menjadi satu kompilasi *social proof* untuk *Pinned Post* guna menciptakan efek FOMO (Fear Of Missing Out) bagi pengikut baru.<br><br>`;
  }

  igText += `<strong>5. Optimasi Bio & Link:</strong> Update teks Bio Instagram dan tautan (Linktree) minggu ini. Buat SOP *Caption* baku yang wajib diakhiri CTA: <em>"Malam ini buka jam 16.00! Meluncur ke lokasi atau klik link di bio 🔥"</em>.`;

  document.getElementById('insightInstagram').innerHTML = igText;

  // -----------------------------------------
  // Render Mini Charts for Insights
  // -----------------------------------------
  
  const defaultOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    layout: { padding: 0 }
  };

  // 1. Mini Chart Time (Sparkline of hourly sales)
  if (miniCharts.time) miniCharts.time.destroy();
  if (data.hourlySales) {
    const labels = Object.keys(data.hourlySales).map(h => `${h}:00`);
    const values = Object.values(data.hourlySales);
    const ctxTime = document.getElementById('miniChartTime').getContext('2d');
    miniCharts.time = new Chart(ctxTime, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderWidth: 3,
          tension: 0.4,
          pointRadius: 0,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: { 
          x: { display: true, ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { display: false } }, 
          y: { display: false } 
        },
        layout: { padding: { top: 10, bottom: 5 } }
      }
    });
  }

  // 2. Mini Chart Product (Doughnut: Top 2 vs Others)
  if (miniCharts.product) miniCharts.product.destroy();
  if (data.topMenu && data.topMenu.length >= 2) {
    const top2Sales = data.topMenu[0].total + data.topMenu[1].total;
    const others = data.totalSales - top2Sales;
    const ctxProd = document.getElementById('miniChartProduct').getContext('2d');
    miniCharts.product = new Chart(ctxProd, {
      type: 'doughnut',
      data: {
        labels: [data.topMenu[0].menu, data.topMenu[1].menu, 'Lainnya'],
        datasets: [{
          data: [data.topMenu[0].total, data.topMenu[1].total, others > 0 ? others : 0],
          backgroundColor: ['#f59e0b', '#fbbf24', 'rgba(255,255,255,0.2)'],
          borderWidth: 0,
          cutout: '65%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { display: true, position: 'right', labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12, padding: 10 } },
          tooltip: { enabled: true } 
        },
        layout: { padding: 0 }
      }
    });
  }

  // 3. Mini Chart Business (Bar: Prev Month vs Current Month)
  if (miniCharts.business) miniCharts.business.destroy();
  const ctxBiz = document.getElementById('miniChartBusiness').getContext('2d');
  if (prevData) {
    miniCharts.business = new Chart(ctxBiz, {
      type: 'bar',
      data: {
        labels: [prevMonthName, month],
        datasets: [{
          data: [prevData.totalSales, data.totalSales],
          backgroundColor: ['rgba(255,255,255,0.3)', '#10b981'],
          borderColor: ['rgba(255,255,255,0.6)', '#34d399'],
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: { ...defaultOpts, scales: { x: { display: true, grid: {display: false}, ticks: {color: '#94a3b8'} }, y: { display: false } } }
    });
  } else {
    miniCharts.business = new Chart(ctxBiz, {
      type: 'bar',
      data: {
        labels: [month],
        datasets: [{
          data: [data.totalSales],
          backgroundColor: ['#10b981'],
          borderRadius: 4
        }]
      },
      options: { ...defaultOpts, scales: { x: { display: true, grid: {display: false}, ticks: {color: '#94a3b8'} }, y: { display: false } } }
    });
  }

  // 4. Mini Chart Marketing (Horizontal Bar: Avg Bill)
  if (miniCharts.marketing) miniCharts.marketing.destroy();
  const ctxMkt = document.getElementById('miniChartMarketing').getContext('2d');
  miniCharts.marketing = new Chart(ctxMkt, {
    type: 'bar',
    data: {
      labels: ['Avg Bill'],
      datasets: [
        {
          label: 'Avg Bill Saat Ini',
          data: [avgBill],
          backgroundColor: '#a855f7',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: '#d8b4fe'
        },
        {
          label: 'Target Upsell (+50%)',
          data: [avgBill * 0.5],
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true, position: 'bottom', labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12 } },
        tooltip: { enabled: true } 
      },
      scales: { 
        x: { display: false, stacked: true }, 
        y: { display: false, stacked: true } 
      },
      layout: { padding: { bottom: 5 } }
    }
  });

  // 5. Mini Chart Instagram (Pie: Takeaway vs Dine-in)
  if (miniCharts.instagram) miniCharts.instagram.destroy();
  const ctxIg = document.getElementById('miniChartInstagram').getContext('2d');
  miniCharts.instagram = new Chart(ctxIg, {
    type: 'pie',
    data: {
      labels: ['Takeaway/Ojol', 'Dine-In/Lainnya'],
      datasets: [{
        data: [takeawayPct, 100 - takeawayPct],
        backgroundColor: ['#e1306c', 'rgba(255,255,255,0.2)'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { display: true, position: 'right', labels: { color: '#ccc', font: { size: 10 }, boxWidth: 12, padding: 10 } },
        tooltip: { enabled: true } 
      },
      layout: { padding: 0 }
    }
  });

  // ==========================================================
  // EXECUTIVE HIGHLIGHT & PREDICTIVE ANALYTICS
  // ==========================================================

  // --- Executive Highlight ---
  const execEl = document.getElementById('executiveHighlight');
  if (execEl) {
    let execText = '';
    const cabangLabel = cabang.replace('Cab.', 'Cabang ').replace('Cab. ', 'Cabang ');
    
    if (month === 'Semua Bulan') {
      execText = `<strong>${cabangLabel}</strong> mencatatkan total omzet <strong>${formatCurrency(data.totalSales)}</strong> dari <strong>${formatNumber(data.totalBills)}</strong> struk sepanjang seluruh periode data. `;
      execText += `Menu andalan adalah <strong>${data.topMenu && data.topMenu[0] ? data.topMenu[0].menu : '-'}</strong>. `;
      execText += `Rata-rata pembelanjaan per struk: <strong>${formatCurrency(avgBill)}</strong>.`;
    } else {
      execText = `Performa <strong>${cabangLabel}</strong> pada bulan <strong>${month}</strong>: Total omzet <strong>${formatCurrency(data.totalSales)}</strong> dari <strong>${formatNumber(data.totalBills)}</strong> struk. `;
      
      if (prevData) {
        const diff = data.totalSales - prevData.totalSales;
        const diffPct = ((diff / prevData.totalSales) * 100).toFixed(1);
        if (diff >= 0) {
          execText += `📈 Terjadi <strong style="color:#10b981;">pertumbuhan +${diffPct}%</strong> dibanding bulan ${prevMonthName}. `;
        } else {
          execText += `📉 Terjadi <strong style="color:#ef4444;">penurunan ${diffPct}%</strong> dibanding bulan ${prevMonthName}. `;
        }
      }
      
      if (data.topMenu && data.topMenu[0]) {
        execText += `Menu terlaris: <strong>${data.topMenu[0].menu}</strong>. `;
      }
      execText += `Rata-rata bill: <strong>${formatCurrency(avgBill)}</strong>.`;
    }
    execEl.innerHTML = `<p>${execText}</p>`;
  }

  // --- Predictive Analytics Chart ---
  const predictiveTextEl = document.getElementById('insightPredictiveText');
  const predictiveChartEl = document.getElementById('chartPredictive');
  
  if (predictiveTextEl && predictiveChartEl) {
    if (miniCharts.predictive) miniCharts.predictive.destroy();
    
    if (month === 'Semua Bulan') {
      // Show all months overview
      const cabangKey = cabang;
      let labels = [];
      let values = [];
      for (let i = 0; i < ALL_MONTHS.length; i++) {
        const key = `${cabangKey}|${ALL_MONTHS[i]}`;
        if (dashboardData.data[key] && dashboardData.data[key].totalSales) {
          labels.push(ALL_MONTHS[i].substring(0, 3));
          values.push(dashboardData.data[key].totalSales);
        }
      }
      
      if (values.length >= 2) {
        const predicted = calculateLinearRegression(values);
        const nextMonthIdx = labels.length < 12 ? labels.length : 11;
        const nextMonthLabel = ALL_MONTHS[nextMonthIdx] ? ALL_MONTHS[nextMonthIdx].substring(0, 3) : 'Next';
        
        // Predicted data array (nulls for past, value for next)
        const predictedData = new Array(values.length).fill(null);
        predictedData[predictedData.length - 1] = values[values.length - 1]; // Connect from last real value
        predictedData.push(predicted);
        
        const realData = [...values, null]; // Add null for the prediction month
        labels.push(nextMonthLabel + ' (Est.)');
        
        const ctxPred = predictiveChartEl.getContext('2d');
        miniCharts.predictive = new Chart(ctxPred, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Realisasi Omzet',
                data: realData,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#38bdf8',
                fill: true
              },
              {
                label: 'Proyeksi (Regresi Linier)',
                data: predictedData,
                borderColor: '#d946ef',
                borderWidth: 3,
                borderDash: [8, 4],
                tension: 0,
                pointRadius: 6,
                pointBackgroundColor: '#d946ef',
                pointStyle: 'triangle',
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true, padding: 16 }
              },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: function(ctx) {
                    return ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
                  }
                }
              }
            },
            scales: {
              x: { display: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
              y: {
                display: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                  color: '#94a3b8',
                  callback: function(v) { return formatCompactCurrency(v); }
                }
              }
            }
          }
        });
        
        const diffPred = predicted - values[values.length - 1];
        const diffPredPct = ((diffPred / values[values.length - 1]) * 100).toFixed(1);
        let predText = `Berdasarkan <strong>regresi linier sederhana</strong> dari ${values.length} bulan data historis, `;
        predText += `estimasi omzet untuk bulan <strong>${ALL_MONTHS[nextMonthIdx] || 'berikutnya'}</strong> adalah <strong style="color:#d946ef;">${formatCurrency(predicted)}</strong>. `;
        if (diffPred >= 0) {
          predText += `Ini menunjukkan potensi <strong style="color:#10b981;">kenaikan +${diffPredPct}%</strong> dari bulan terakhir.`;
        } else {
          predText += `Ini menunjukkan potensi <strong style="color:#ef4444;">penurunan ${diffPredPct}%</strong> dari bulan terakhir.`;
        }
        predText += `<br><br><em style="color:#94a3b8;font-size:0.85rem;">⚠️ Disclaimer: Angka proyeksi menggunakan model regresi linier sederhana dan merupakan estimasi tren matematis, bukan kepastian bisnis.</em>`;
        predictiveTextEl.innerHTML = predText;
      } else {
        predictiveTextEl.innerHTML = '<em style="color:#94a3b8;">Diperlukan minimal 2 bulan data historis untuk menghasilkan proyeksi. Pilih cabang dengan data lebih lengkap.</em>';
      }
      
    } else {
      // Specific month selected
      const history = getHistoricalSales(cabang, month);
      
      if (history.length >= 2) {
        const predicted = calculateLinearRegression(history);
        const currentMonthIdx = ALL_MONTHS.indexOf(month);
        const nextMonthName = ALL_MONTHS[currentMonthIdx + 1] || 'Berikutnya';
        
        let labels = [];
        for (let i = 0; i < history.length; i++) {
          labels.push(ALL_MONTHS[i].substring(0, 3));
        }
        
        const predictedData = new Array(history.length).fill(null);
        predictedData[predictedData.length - 1] = history[history.length - 1];
        predictedData.push(predicted);
        
        const realData = [...history, null];
        labels.push(nextMonthName.substring(0, 3) + ' (Est.)');
        
        const ctxPred = predictiveChartEl.getContext('2d');
        miniCharts.predictive = new Chart(ctxPred, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Realisasi Omzet',
                data: realData,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.15)',
                borderWidth: 3,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#38bdf8',
                fill: true
              },
              {
                label: 'Proyeksi (Regresi Linier)',
                data: predictedData,
                borderColor: '#d946ef',
                borderWidth: 3,
                borderDash: [8, 4],
                tension: 0,
                pointRadius: 6,
                pointBackgroundColor: '#d946ef',
                pointStyle: 'triangle',
                fill: false
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: true,
                position: 'top',
                labels: { color: '#94a3b8', font: { size: 11 }, usePointStyle: true, padding: 16 }
              },
              tooltip: {
                enabled: true,
                callbacks: {
                  label: function(ctx) {
                    return ctx.dataset.label + ': ' + formatCurrency(ctx.raw);
                  }
                }
              }
            },
            scales: {
              x: { display: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
              y: {
                display: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                  color: '#94a3b8',
                  callback: function(v) { return formatCompactCurrency(v); }
                }
              }
            }
          }
        });
        
        const diffPred = predicted - history[history.length - 1];
        const diffPredPct = ((diffPred / history[history.length - 1]) * 100).toFixed(1);
        let predText = `Berdasarkan <strong>regresi linier sederhana</strong> dari ${history.length} bulan data (Jan–${month.substring(0,3)}), `;
        predText += `estimasi omzet untuk bulan <strong style="color:#d946ef;">${nextMonthName}</strong> adalah <strong style="color:#d946ef;">${formatCurrency(predicted)}</strong>. `;
        if (diffPred >= 0) {
          predText += `Proyeksi menunjukkan potensi <strong style="color:#10b981;">kenaikan +${diffPredPct}%</strong> dari bulan ${month}.`;
        } else {
          predText += `Proyeksi menunjukkan potensi <strong style="color:#ef4444;">penurunan ${diffPredPct}%</strong> dari bulan ${month}.`;
        }
        predText += `<br><br><em style="color:#94a3b8;font-size:0.85rem;">⚠️ Disclaimer: Angka proyeksi menggunakan model regresi linier sederhana dan merupakan estimasi tren matematis, bukan kepastian bisnis.</em>`;
        predictiveTextEl.innerHTML = predText;
      } else {
        predictiveTextEl.innerHTML = '<em style="color:#94a3b8;">Diperlukan minimal 2 bulan data historis untuk menghasilkan proyeksi. Coba pilih bulan yang lebih lanjut (misal Maret ke atas).</em>';
      }
    }
  }
}

// Utility for animating number changes
function animateValue(obj, end, isCurrency = false, duration = 800) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    // easeOutQuart
    const easeProgress = 1 - Math.pow(1 - progress, 4);
    
    const current = Math.floor(easeProgress * end);
    obj.innerHTML = isCurrency ? formatCurrency(current) : formatNumber(current);
    
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = isCurrency ? formatCurrency(end) : formatNumber(end);
    }
  };
  window.requestAnimationFrame(step);
}

// Chart Configurations
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 20, 35, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.bodyColor = '#f1f5f9';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(148, 163, 184, 0.2)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.legend.labels.color = '#94a3b8';

function renderCharts(data) {
  renderDailyChart(data.dailySales);
  renderHourlyChart(data.hourlySales);
  renderPaymentChart(data.paymentMethod);
  renderTopMenuChart(data.topMenu);
}

function renderDailyChart(dailyData) {
  const ctx = document.getElementById('chartDaily').getContext('2d');
  
  // Sort days
  const labels = Object.keys(dailyData).map(Number).sort((a, b) => a - b);
  const values = labels.map(day => dailyData[day]);
  
  // Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(220, 38, 38, 0.8)');
  gradient.addColorStop(1, 'rgba(220, 38, 38, 0.1)');

  if (charts.daily) charts.daily.destroy();
  
  charts.daily = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Penjualan (Rp)',
        data: values,
        backgroundColor: gradient,
        borderColor: '#dc2626',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#ef4444'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
          ticks: {
            callback: (val) => {
              if (val >= 1000000) return (val / 1000000) + 'M';
              if (val >= 1000) return (val / 1000) + 'k';
              return val;
            }
          }
        },
        x: {
          grid: { display: false },
          title: { display: true, text: 'Tanggal' }
        }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });
}

function renderHourlyChart(hourlyData) {
  const ctx = document.getElementById('chartHourly').getContext('2d');
  
  // Hours 0-23
  const labels = Object.keys(hourlyData).map(Number).sort((a, b) => a - b);
  const values = labels.map(hr => hourlyData[hr]);
  
  // Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.8)');
  gradient.addColorStop(1, 'rgba(245, 158, 11, 0.1)');

  if (charts.hourly) charts.hourly.destroy();
  
  charts.hourly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.map(h => `${String(h).padStart(2, '0')}:00`),
      datasets: [{
        label: 'Penjualan (Rp)',
        data: values,
        backgroundColor: gradient,
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 4,
        hoverBackgroundColor: '#fbbf24'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => formatCurrency(ctx.raw)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.1)' },
          ticks: {
            callback: (val) => {
              if (val >= 1000000) return (val / 1000000) + 'M';
              if (val >= 1000) return (val / 1000) + 'k';
              return val;
            }
          }
        },
        x: {
          grid: { display: false }
        }
      },
      animation: { duration: 1000, easing: 'easeOutQuart' }
    }
  });
}

function renderPaymentChart(paymentData) {
  const ctx = document.getElementById('chartPayment').getContext('2d');
  
  const labels = Object.keys(paymentData);
  const values = Object.values(paymentData);
  
  const colors = [
    '#991b1b', '#dc2626', '#f87171', '#f59e0b', '#fbbf24', '#fcd34d'
  ];

  if (charts.payment) charts.payment.destroy();
  
  charts.payment = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const val = context.raw || 0;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = Math.round((val / total) * 100);
              return ` ${label}: ${formatNumber(val)} bills (${pct}%)`;
            }
          }
        }
      },
      animation: { animateScale: true, animateRotate: true }
    }
  });
}

function renderTopMenuChart(topMenuData) {
  const ctx = document.getElementById('chartTopMenu').getContext('2d');
  
  const labels = topMenuData.map(item => {
    // Truncate long names
    return item.menu.length > 20 ? item.menu.substring(0, 20) + '...' : item.menu;
  });
  const values = topMenuData.map(item => item.total);
  const fullLabels = topMenuData.map(item => item.menu); // For tooltip
  
  // Gradient
  const gradient = ctx.createLinearGradient(0, 0, 400, 0);
  gradient.addColorStop(0, 'rgba(220, 38, 38, 0.8)');
  gradient.addColorStop(1, 'rgba(245, 158, 11, 0.8)');

  if (charts.topMenu) charts.topMenu.destroy();
  
  charts.topMenu = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Total Penjualan',
        data: values,
        backgroundColor: gradient,
        borderRadius: 4,
        hoverBackgroundColor: '#ef4444'
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (ctx) => fullLabels[ctx[0].dataIndex],
            label: (ctx) => ` ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y: {
          grid: { display: false }
        }
      }
    }
  });
}

// Start app
document.addEventListener('DOMContentLoaded', init);
