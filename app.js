// Global variables
let dashboardData = null;
let charts = {
  daily: null,
  hourly: null,
  payment: null,
  topMenu: null
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

// DOM Elements
const elements = {
  filterCabang: document.getElementById('filterCabang'),
  filterMonth: document.getElementById('filterMonth'),
  kpiRevenue: document.getElementById('kpiRevenue'),
  kpiBills: document.getElementById('kpiBills'),
  kpiAvg: document.getElementById('kpiAvg'),
  kpiVisitTypes: document.getElementById('kpiVisitTypes'),
  visitCards: document.getElementById('visitCards'),
  lastUpdate: document.getElementById('lastUpdate'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay')
};

// Init Application
async function init() {
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

function toggleSidebar() {
  elements.sidebar.classList.toggle('open');
  elements.sidebarOverlay.classList.toggle('active');
}

function showLoading() {
  elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  setTimeout(() => {
    elements.loadingOverlay.classList.add('hidden');
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
