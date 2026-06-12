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
  instagram: null
};

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

  let timeText = 'Data belum cukup.';
  if (peakHour !== null) {
    timeText = `Jam tersibuk adalah pukul <strong>${String(peakHour).padStart(2, '0')}:00 - ${String(peakHour + 1).padStart(2, '0')}:00</strong>. `;
    if (peakHour >= 16 && peakHour <= 18) {
      timeText += 'Traffic tertinggi terjadi tepat di jam-jam awal buka restoran (sore/awal malam). Pastikan persiapan (prep) bahan baku dan kebersihan area makan sudah 100% tuntas sebelum jam buka untuk menyambut lonjakan pengunjung awal.';
    } else if (peakHour >= 19 && peakHour <= 21) {
      timeText += 'Ini adalah jam utama makan malam (Prime Dinner Time). Rekomendasi: Pastikan ketersediaan meja yang cukup, alur pesanan yang cepat, dan berikan promosi "Paket Makan Keluarga" untuk memaksimalkan rombongan yang datang.';
    } else {
      timeText += 'Puncak keramaian ada di larut malam (Late Night Dining). Fokuskan pada layanan cepat dan keamanan parkir, serta buat opsi menu porsi personal yang cocok untuk pengunjung yang datang larut.';
    }
  }

  if (prevData && prevData.hourlySales) {
    let prevMax = 0;
    let prevPeak = null;
    for (const [hour, sales] of Object.entries(prevData.hourlySales)) {
      if (sales > prevMax) { prevMax = sales; prevPeak = parseInt(hour, 10); }
    }
    if (prevPeak !== null && prevPeak !== peakHour) {
      timeText += `<br><br>📊 <em>Bulan ${prevMonthName}:</em> Puncak jam makan ada di <strong>${String(prevPeak).padStart(2, '0')}:00</strong>. Terdapat pergeseran tren waktu kedatangan pelanggan di bulan ${month}.`;
    } else if (prevPeak !== null) {
      timeText += `<br><br>📊 <em>Bulan ${prevMonthName}:</em> Puncak jam makan stabil di jam yang sama. Persiapan staf sudah bisa diprediksi untuk bulan ${month}.`;
    }
  }

  document.getElementById('insightTime').innerHTML = timeText;

  // 2. Product Prediction & Bundling
  let productText = 'Data belum cukup.';
  if (data.topMenu && data.topMenu.length >= 2) {
    const top1 = data.topMenu[0].menu;
    const top2 = data.topMenu[1].menu;
    const isTaichan = top1.toLowerCase().includes('taichan') || top1.toLowerCase().includes('sate');
    productText = `Menu "Bintang" bulan ini adalah <strong>${top1}</strong> dan <strong>${top2}</strong>. `;
    if (isTaichan) {
      productText += 'Masyarakat Makassar menyukai cita rasa pedas gurih, namun butuh penetral. Prediksi: Buat <strong>Paket Makan Bundling</strong> (Sate Taichan + Minuman Manis Laris) untuk <i>upselling</i> otomatis per meja.';
    } else {
      productText += 'Prediksi Bisnis: Buat paket bundling kedua menu ini dengan harga spesial untuk mendongkrak omzet harian.';
    }

    if (prevData && prevData.topMenu && prevData.topMenu.length > 0) {
      const prevTop1 = prevData.topMenu[0].menu;
      if (top1 !== prevTop1) {
        productText += `<br><br>📈 <em>Bulan ${prevMonthName}:</em> Menu terlaris adalah <strong>${prevTop1}</strong>. Terjadi pergeseran selera masakan di bulan ${month} yang perlu diperhatikan persediaan bahannya.`;
      } else {
        productText += `<br><br>📈 <strong>${top1}</strong> berhasil mempertahankan posisi menu terlaris dari bulan ${prevMonthName}. Pastikan stok selalu aman!`;
      }
    }
  }
  document.getElementById('insightProduct').innerHTML = productText;

  // 3. Business Decision & Location Context
  let businessText = '';
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
      businessText += `Mayoritas pengunjung menggunakan <strong>${topPayment}</strong>. Keputusan: Pasang banner promo QRIS/Cashback di meja kasir. `;
    } else {
      businessText += `Metode pembayaran teratas adalah <strong>${topPayment}</strong>. Pastikan kelancaran sistem ini di kasir. `;
    }
  }

  if (prevData && data.totalSales && prevData.totalSales > 0) {
    const currentSales = data.totalSales;
    const prevSales = prevData.totalSales;
    const diff = currentSales - prevSales;
    const pct = (diff / prevSales * 100).toFixed(1);
    if (diff > 0) {
      businessText += `<br><br>💰 <em>${prevMonthName} ke ${month}:</em> Omzet naik <strong>+${pct}%</strong>! Pertahankan kualitas rasa dan kecepatan layanan makanan.`;
    } else {
      businessText += `<br><br>📉 <em>${prevMonthName} ke ${month}:</em> Omzet turun <strong>${pct}%</strong> dibanding bulan ${prevMonthName}. Evaluasi kembali strategi marketing dan paket promo makan di tempat.`;
    }
  }

  if (cabang.toLowerCase().includes('pettarani')) {
    businessText += '<br><br>📍 <em>Konteks AP. Pettarani:</em> Kawasan padat ruko/perkantoran. Opsi strategis: Luncurkan "Promo Maksi" (Makan Siang) khusus untuk menyasar karyawan di sekitar area.';
  } else if (cabang.toLowerCase().includes('mappanyukki')) {
    businessText += '<br><br>📍 <em>Konteks Mappanyukki:</em> Titik kuliner strategis. Keputusan: Pastikan kenyamanan tempat duduk untuk makan bersama keluarga, kebersihan meja, dan area parkir memadai.';
  } else {
    businessText += '<br><br>📍 <em>Opsi Skala Makassar:</em> Tren pesan-antar (Ojol) sangat tinggi. Tingkatkan kualitas kemasan makanan (packaging) agar tetap rapi, hangat, dan aman walau macet di jalan raya.';
  }
  
  document.getElementById('insightBusiness').innerHTML = businessText || 'Data belum cukup.';

  // 4. Marketing Analysis (4P) & Real-time Trends
  let marketingText = '';
  let topProductForMkt = 'Sate Taichan';
  if (data.topMenu && data.topMenu.length > 0) {
    topProductForMkt = data.topMenu[0].menu;
  }
  
  const avgBill = data.totalBills > 0 ? (data.totalSales / data.totalBills) : 0;

  marketingText += `Berdasarkan pantauan tren F&B Makassar terbaru (Kuartal ini):<br><br>`;
  marketingText += `<strong>1. Product:</strong> Tren "Instagramable" sangat kuat. Tingkatkan estetika <em>plating</em> (penyajian) untuk <em>${topProductForMkt}</em> agar konsumen memotret dan mempromosikannya secara organik ke TikTok/Instagram.<br><br>`;
  
  if (avgBill > 0 && avgBill < 35000) {
    marketingText += `<strong>2. Price:</strong> *Smart Consumer* Makassar menyukai "Value for Money". Rata-rata bill Anda cukup terjangkau. Pertahankan ini sebagai *selling point* kuat!<br><br>`;
  } else {
    marketingText += `<strong>2. Price:</strong> Tawarkan menu paket porsi pelajar/mahasiswa agar cakupan pasar lebih luas dan inklusif.<br><br>`;
  }
  
  marketingText += `<strong>3. Place:</strong> Walau ini restoran *dine-in*, tren F&B Makassar menunjukkan lonjakan drastis pada pesanan GoFood/GrabFood. Pisahkan antrean *driver* Ojol dari antrean pelanggan *dine-in* agar sirkulasi lancar.<br><br>`;
  marketingText += `<strong>4. Promotion:</strong> Dominasi sistem transaksi digital (seperti QRIS) membuka peluang besar untuk kampanye *loyalty program* berbasis stempel digital (misal: "Beli 5 kali, gratis 1 porsi").`;

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

  igText += `<strong>📱 Audit Konten ${igHandle}:</strong><br><br>`;

  igText += `<strong>1. Konten Unggulan (AIDA - Attention):</strong> Buat video ASMR proses <em>pembakaran ${contentFocusMenu}</em> dengan angle close-up. Konten jenis ini mendominasi tren FoodTok Makassar dan berpotensi viral karena visual api + suara sizzling yang menggugah selera.`;
  if (secondMenu) {
    igText += ` Selang-seling juga dengan konten <em>${secondMenu}</em> agar feed bervariasi.`;
  }
  igText += `<br><br>`;

  igText += `<strong>2. Jadwal Posting Optimal:</strong> Berdasarkan data penjualan, peak hour Anda berada di waktu <em>${peakLabel}</em>. Posting konten Instagram Reels/Stories pada pukul <strong>${bestPostHour} WITA</strong> (± 2 jam sebelum jam ramai) agar audiens sudah "lapar mata" sebelum datang ke tempat.<br><br>`;

  igText += `<strong>3. Konten Rutin yang Wajib Ada (Kalender Mingguan):</strong><br>`;
  igText += `&nbsp;&nbsp;• <em>Senin:</em> Behind-the-scene persiapan bahan segar (bangun trust & transparansi)<br>`;
  igText += `&nbsp;&nbsp;• <em>Rabu:</em> Repost UGC (User Generated Content) dari pelanggan yang nge-tag ${igHandle}<br>`;
  igText += `&nbsp;&nbsp;• <em>Jumat:</em> Promo weekend atau teaser menu spesial malam Sabtu<br>`;
  igText += `&nbsp;&nbsp;• <em>Sabtu:</em> Instagram Reels ASMR / Cinematic food video<br><br>`;

  if (takeawayPct > 30) {
    igText += `<strong>4. Insight Takeaway (${takeawayPct}% transaksi):</strong> Karena hampir sepertiga transaksi dari pesan antar, buat konten khusus <em>"Unboxing dari rumah"</em> — tunjukkan bahwa packaging tetap rapi & sate tetap hangat walau diantar lewat Ojol. Ini sangat efektif untuk mendorong konversi order online.<br><br>`;
  } else {
    igText += `<strong>4. Ajakan Dine-in:</strong> Karena mayoritas transaksi adalah makan di tempat, buat konten yang menunjukkan <em>suasana restoran yang ramai & nyaman</em> (social proof) agar calon pelanggan yang ragu langsung terdorong datang.<br><br>`;
  }

  igText += `<strong>5. CTA (Call-to-Action) di Setiap Post:</strong> Pastikan setiap caption berakhir dengan CTA jelas. Contoh: <em>"Malam ini buka jam 16.00! Langsung ke Mappanyukki atau order via link di bio 🔥"</em>. Tambahkan link GoFood/GrabFood di bio Instagram.`;

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
      options: defaultOpts
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
          cutout: '70%'
        }]
      },
      options: { ...defaultOpts, plugins: { tooltip: { enabled: true } }, layout: { padding: 5 } }
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
          data: [avgBill],
          backgroundColor: '#a855f7',
          borderRadius: 4,
          borderWidth: 1,
          borderColor: '#d8b4fe'
        },
        {
          data: [avgBill * 0.5],
          backgroundColor: 'rgba(255,255,255,0.1)',
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      ...defaultOpts,
      scales: { 
        x: { display: false, stacked: true }, 
        y: { display: false, stacked: true } 
      }
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
    options: { ...defaultOpts, plugins: { tooltip: { enabled: true } }, layout: { padding: 10 } }
  });
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
