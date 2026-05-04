// ══ JADWAL PELATIHAN LOGIC (ADVANCED FILTERING & SORTING) ══

const firebaseConfig = {
  apiKey: "AIzaSyCXhXyrajishlP0q9j6QggQWtWW3oKuPhc",
  authDomain: "sahabat-p4.firebaseapp.com",
  projectId: "sahabat-p4",
  storageBucket: "sahabat-p4.firebasestorage.app",
  messagingSenderId: "835411215925",
  appId: "1:835411215925:web:51172aa6363bea37bb137c"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
db.settings({ experimentalForceLongPolling: true });

const imageMap = {
  PAUD:       'https://i.ibb.co.com/gMjGGm9C/1.png',
  SD:         'https://i.ibb.co.com/cSzbGvqw/4.png',
  SMP:        'https://i.ibb.co.com/rGbzLkJq/5.png',
  SMA:        'https://i.ibb.co.com/RpN4hpBc/6.png',
  SLB:        'https://i.ibb.co.com/PGpNCK4v/7.png',
  Kesetaraan: 'https://i.ibb.co.com/5hRPDY5w/Salinan-dari-Pelatihan-dan-Pengembangan-Pendidik-jenjang-PAUD.png',
  SMK:        'https://i.ibb.co.com/MkcVSZX5/8.png',
};

const colorMap = {
  PAUD:       { badge: 'badge-paud',       banner: 'banner-paud' },
  SD:         { badge: 'badge-sd',         banner: 'banner-sd' },
  SMP:        { badge: 'badge-smp',        banner: 'banner-smp' },
  SMA:        { badge: 'badge-sma',        banner: 'banner-sma' },
  SMK:        { badge: 'badge-smk',        banner: 'banner-smk' },
  Kesetaraan: { badge: 'badge-kesetaraan', banner: 'banner-kesetaraan' },
  SLB:        { badge: 'badge-slb',        banner: 'banner-slb' },
};

let data = [];
let activeFilter = 'semua';
let statusFilter = 'semua';
let currentSort = 'tanggal';

const bulanMap = {'Januari':1,'Februari':2,'Maret':3,'April':4,'Mei':5,'Juni':6,'Juli':7,'Agustus':8,'September':9,'Oktober':10,'November':11,'Desember':12};

function getEndDate(tanggalStr) {
  if(!tanggalStr) return null;
  const parts = tanggalStr.split(/[–-]/).map(s => s.trim());
  const lastPart = parts[parts.length - 1]; 
  const tokens = lastPart.split(/\s+/);
  const day = parseInt(tokens.find(t => !isNaN(t)));
  const month = bulanMap[tokens.find(t => bulanMap[t])];
  const year = parseInt(tokens.find(t => t.length === 4));
  return (day && month && year) ? new Date(year, month-1, day, 23, 59, 59) : null;
}

function isPast(item) {
  if(item.manualStatus === 'tutup') return true;
  if(item.manualStatus === 'buka') return false;
  if(item.tglSelesai) return new Date(item.tglSelesai) < new Date();
  const end = getEndDate(item.tanggal);
  return end ? end < new Date() : false;
}

function render() {
  const searchInput = document.getElementById('searchInput');
  if(!searchInput) return;
  const q = searchInput.value.toLowerCase();
  
  // 1. FILTERING
  let filtered = data.filter(d => {
    const matchSearch = d.judul.toLowerCase().includes(q) || d.jenjang.toLowerCase().includes(q);
    const matchJenjang = activeFilter === 'semua' || d.jenjang === activeFilter;
    const matchStatus = statusFilter === 'semua' || (statusFilter === 'buka' ? !isPast(d) : isPast(d));
    return matchSearch && matchJenjang && matchStatus;
  });

  // 2. SORTING
  if (currentSort === 'nama') {
    filtered.sort((a, b) => a.judul.localeCompare(b.judul));
  } else {
    // Default: Smart Sort (Aktif dulu, lalu Tidak Aktif, masing-masing kronologis)
    const active = filtered.filter(d => !isPast(d));
    const inactive = filtered.filter(d => isPast(d));
    const sortFn = (a, b) => {
        const dA = a.tglMulai ? new Date(a.tglMulai) : (getEndDate(a.tanggal) || new Date(0));
        const dB = b.tglMulai ? new Date(b.tglMulai) : (getEndDate(b.tanggal) || new Date(0));
        return dA - dB;
    };
    active.sort(sortFn);
    inactive.sort(sortFn);
    filtered = [...active, ...inactive];
  }

  // 3. RENDERING
  let html = '';
  if (filtered.length === 0) {
    html = '<p class="no-result">Pelatihan tidak ditemukan.</p>';
  } else {
    html += `<div class="grid">`;
    filtered.forEach(d => {
        const cm = colorMap[d.jenjang] || colorMap['SLB'];
        const img = imageMap[d.jenjang] || imageMap['SD'];
        const closed = isPast(d);
        html += `
            <div class="card ${closed ? 'card-closed' : ''}">
                <div class="card-img-wrap"><img src="${img}" alt="${d.jenjang}" loading="lazy" /></div>
                <div class="card-banner ${cm.banner}"></div>
                <div class="card-body">
                    <span class="card-badge ${cm.badge}">${d.jenjang}</span>
                    <p class="card-title">${d.judul}</p>
                    <div class="card-info"><div class="card-info-row">${d.tanggal}</div></div>
                    <span class="kuota-badge">Kuota ${d.kuota} peserta</span>
                </div>
                <div class="card-footer">
                    ${closed ? `<span class="btn-daftar ditutup">Pendaftaran Ditutup</span>` : `<a href="${d.link}" class="btn-daftar" target="_blank">Daftar Sekarang</a>`}
                </div>
            </div>
        `;
    });
    html += `</div>`;
  }
  const mainContent = document.getElementById('mainContent');
  if(mainContent) mainContent.innerHTML = html;
}

window.setStatusFilter = function(val, el) {
    statusFilter = val;
    document.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    render();
}

window.setSort = function(val) {
    currentSort = val;
    render();
}

window.setFilter = function(key, el) {
  activeFilter = key;
  document.querySelectorAll('.filter-btn:not(.status-btn)').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  render();
}

function buildFilters() {
  const list = [{key:'semua',label:'Semua',cls:'fb-semua'},{key:'PAUD',label:'PAUD',cls:'fb-paud'},{key:'SD',label:'SD',cls:'fb-sd'},{key:'SMP',label:'SMP',cls:'fb-smp'},{key:'SMA',label:'SMA',cls:'fb-sma'},{key:'SMK',label:'SMK',cls:'fb-smk'},{key:'Kesetaraan',label:'Kesetaraan',cls:'fb-kesetaraan'},{key:'SLB',label:'SLB',cls:'fb-slb'}];
  const wrap = document.getElementById('filterWrap');
  if (wrap) wrap.innerHTML = list.map(f => `<button class="filter-btn ${f.cls}${f.key === 'semua' ? ' active' : ''}" onclick="setFilter('${f.key}', this)">${f.label}</button>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    buildFilters();
    db.collection("jadwal").onSnapshot((snapshot) => {
        const fireData = [];
        snapshot.forEach(doc => {
            let item = doc.data();
            item.id = doc.id;
            fireData.push(item);
        });
        data = fireData;
        render();
    });
});
