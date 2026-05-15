let paketMateri = []; 
const colorMap = {
  PAUD:       { badge: 'badge-paud',       banner: 'banner-paud' },
  SD:         { badge: 'badge-sd',         banner: 'banner-sd' },
  SMP:        { badge: 'badge-smp',        banner: 'banner-smp' },
  SMA:        { badge: 'badge-sma',        banner: 'banner-sma' },
  SMK:        { badge: 'badge-smk',        banner: 'banner-smk' },
  Kesetaraan: { badge: 'badge-kesetaraan', banner: 'banner-kesetaraan' },
  SLB:        { badge: 'badge-slb',        banner: 'banner-slb' },
};

let activeFilter = 'semua';

// ══ INITIALIZATION ══
document.addEventListener('DOMContentLoaded', () => {
    buildFilters();
    initFirestore();
});

function initFirestore() {
    if (typeof db !== 'undefined') {
        // console.log("Menghubungkan ke Firestore...");
        db.collection("materi").onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
                let item = doc.data();
                item.id = doc.id;
                // Pastikan jenjang selalu berupa array
                if (!Array.isArray(item.jenjang)) {
                    item.jenjang = item.jenjang ? [item.jenjang] : [];
                }
                list.push(item);
            });
            
            paketMateri = list;
            // console.log("Data diterima:", list.length, "item");
            
            if (list.length === 0) {
                const grid = document.getElementById('materiGrid');
                if (grid) grid.innerHTML = '<p class="no-result">Database materi kosong. Silakan tambah materi di Admin Panel.</p>';
            } else {
                filterMateri();
            }
        }, (error) => {
            console.error("Firestore Error:", error);
            const grid = document.getElementById('materiGrid');
            if (grid) grid.innerHTML = `<p class="no-result">Gagal memuat data: ${error.message}</p>`;
        });
    } else {
        console.error("Firebase DB is not defined.");
    }
}

function buildBanner(jenjangArr) {
  if (!Array.isArray(jenjangArr) || jenjangArr.length === 0) return '';
  if (jenjangArr.length === 1) {
    return `<div class="card-banner ${colorMap[jenjangArr[0]]?.banner || ''}"></div>`;
  }
  const halves = jenjangArr.map(j => `<div class="card-banner-half ${colorMap[j]?.banner || ''}"></div>`).join('');
  return `<div class="card-banner">${halves}</div>`;
}

function buildBadges(jenjangArr, cls = 'card-badge') {
  if (!Array.isArray(jenjangArr)) return '';
  return jenjangArr.map(j => `<span class="${cls} ${colorMap[j]?.badge || ''}">${j}</span>`).join('');
}

function renderCards(data) {
  const grid = document.getElementById('materiGrid');
  if (!grid) return;
  
  if (!data.length) {
    grid.innerHTML = '<p class="no-result">Materi tidak ditemukan untuk kategori/pencarian ini.</p>';
    return;
  }

  grid.innerHTML = data.map(p => {
    // Safety check untuk topik
    const totalTopik = Array.isArray(p.topik) ? p.topik.length : 0;
    
    return `
      <div class="card">
        ${p.gambar ? `<img class="card-img" src="${p.gambar}" alt="${p.judul}" />` : ''}
        ${buildBanner(p.jenjang)}
        <div class="card-body">
          <div class="card-badges">${buildBadges(p.jenjang)}</div>
          <p class="card-title">${p.judul || 'Tanpa Judul'}</p>
          <p class="card-desc">${p.deskripsi || ''}</p>
          <p class="card-meta">${totalTopik} topik tersedia</p>
        </div>
        <div class="card-footer" style="padding: 15px; border-top: 1px solid #f1f5f9;">
          <button class="btn-primary" style="width: 100%; height: 45px;" onclick="openMateriModal('${p.id}')">Pelajari Sekarang</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterMateri() {
  const searchInput = document.getElementById('searchInput');
  const q = searchInput ? searchInput.value.toLowerCase() : '';
  
  // Filter status aktif
  let data = paketMateri.filter(p => p.status !== 'nonaktif');
  
  if (activeFilter !== 'semua') {
      data = data.filter(p => p.jenjang && p.jenjang.includes(activeFilter));
  }
  
  // 🔥 DEEP SEARCH: Mencari di Judul, Deskripsi, DAN Nama Topik
  if (q) {
    data = data.filter(p => {
      const matchHeader = (p.judul && p.judul.toLowerCase().includes(q)) || (p.deskripsi && p.deskripsi.toLowerCase().includes(q));
      const matchTopics = p.topik && p.topik.some(t => t.nama && t.nama.toLowerCase().includes(q));
      return matchHeader || matchTopics;
    });
  }

  // SORTING: Featured di atas
  data.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  
  renderCards(data);
}
window.filterMateri = filterMateri;

// ══ FITUR BERBAGI (SHARE) ══
window.copyShareLink = function(id) {
    const url = window.location.href.split('?')[0] + '?id=' + id;
    navigator.clipboard.writeText(url).then(() => {
        alert("✅ Link materi berhasil disalin ke clipboard!");
    });
}

// ══ DETEKSI ICON LINK ══
function getLinkTypeIcon(url) {
    if (!url) return '🔗';
    if (url.includes('drive.google.com') || url.endsWith('.pdf')) return '📄';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return '🎬';
    return '🌐';
}

// ══ DIRECT DOWNLOAD LINK (GDrive Bypass) ══
function getDirectDownloadLink(url) {
    if (!url || !url.includes('drive.google.com')) return url;
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    return url;
}

// ══ ANALYTICS: Track Click ══
async function trackView(materiId, topikIndex) {
    if (typeof db === 'undefined') return;
    try {
        const docRef = db.collection("materi").doc(materiId);
        const doc = await docRef.get();
        if (doc.exists) {
            const data = doc.data();
            const topics = data.topik || [];
            if (topics[topikIndex]) {
                topics[topikIndex].views = (topics[topikIndex].views || 0) + 1;
                await docRef.update({ topik: topics });
            }
        }
    } catch (e) { console.error("Gagal track view:", e); }
}

function buildFilters() {
  const list = [
    { key: 'semua',      label: 'Semua',      cls: 'fb-semua' },
    { key: 'PAUD',       label: 'PAUD',       cls: 'fb-paud' },
    { key: 'SD',         label: 'SD',         cls: 'fb-sd' },
    { key: 'SMP',        label: 'SMP',        cls: 'fb-smp' },
    { key: 'SMA',        label: 'SMA',        cls: 'fb-sma' },
    { key: 'SMK',        label: 'SMK',        cls: 'fb-smk' },
    { key: 'Kesetaraan', label: 'Kesetaraan', cls: 'fb-kesetaraan' },
    { key: 'SLB',        label: 'SLB',        cls: 'fb-slb' },
  ];
  const wrap = document.getElementById('filterWrap');
  if (wrap) {
      wrap.innerHTML = list.map(f =>
        `<button class="filter-btn ${f.cls}${f.key === 'semua' ? ' active' : ''}" onclick="setFilter('${f.key}', this)">${f.label}</button>`
      ).join('');
  }
}

function setFilter(key, el) {
  activeFilter = key;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  filterMateri();
}
window.setFilter = setFilter;

function openMateriModal(id) {
  const p = paketMateri.find(x => x.id === id);
  if (!p) return;

  const modalBadges = document.getElementById('modalBadges');
  const modalTitle = document.getElementById('modalTitle');
  const modalSubtitle = document.getElementById('modalSubtitle');
  const modalBody = document.getElementById('modalBody');

  if (modalBadges) modalBadges.innerHTML = buildBadges(p.jenjang, 'modal-badge');
  if (modalTitle) modalTitle.textContent = p.judul;
  const totalTopik = Array.isArray(p.topik) ? p.topik.length : 0;
  if (modalSubtitle) modalSubtitle.textContent = totalTopik + ' topik tersedia';
  
  const primJ = Array.isArray(p.jenjang) ? p.jenjang[0] : 'SD';
  const numBadge = colorMap[primJ]?.badge || 'badge-sd';
  
  if (modalBody) {
      if (Array.isArray(p.topik) && p.topik.length > 0) {
          modalBody.innerHTML = p.topik.map((t, idx) => `
            <div class="topik-item" style="border-left: 4px solid ${colorMap[primJ]?.color || '#6366f1'};">
              <span class="topik-num ${numBadge}">${t.label || 'Topik'}</span>
              <div class="topik-info">
                <p class="topik-name">${getLinkTypeIcon(t.link)} ${t.nama || 'Tanpa Nama'}</p>
                <p class="topik-desc">${t.deskripsi || ''}</p>
                <div style="display:flex; gap:10px; margin-top:8px;">
                    <span style="font-size:10px; color:#94a3b8; display:flex; align-items:center; gap:3px;">👁️ ${t.views || 0} views</span>
                </div>
              </div>
              <div class="topik-link" style="display:flex; flex-direction:column; gap:5px;">
                ${t.link
                  ? `
                    <button class="btn-unduh" onclick="trackView('${p.id}', ${idx}); openPdf('${t.link}', '${(t.nama || p.judul).replace(/'/g,"\\'")}')">Buka Materi</button>
                  `
                  : ''}
                ${t.videoLink
                  ? `
                    <button class="btn-video" onclick="trackView('${p.id}', ${idx}); openVideoModal('${t.videoLink}', '${(t.nama || p.judul).replace(/'/g,"\\'")}')"><i class="fab fa-youtube"></i> Tonton Video</button>
                  `
                  : ''}
                ${t.link
                  ? `
                    <a href="${getDirectDownloadLink(t.link)}" target="_blank" class="btn-download-direct" onclick="trackView('${p.id}', ${idx})" title="Download Langsung">Unduh</a>
                  `
                  : ''}
                ${(!t.link && !t.videoLink) ? `<span class="btn-unduh btn-disabled">Segera Hadir</span>` : ''}
              </div>
            </div>
          `).join('');
      } else {
          modalBody.innerHTML = '<p style="text-align:center; padding:20px; color:#64748b;">Belum ada topik tersedia.</p>';
      }
  }
  
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function gdriveToPdfPreview(url) {
  if(!url) return '';
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return url;
}

window.openPdf = function(url, title) {
  const overlay = document.getElementById('pdfOverlay');
  const frame = document.getElementById('pdfFrame');
  const modalTitle = document.getElementById('pdfModalTitle'); // Pastikan ID ini sesuai dengan di HTML
  const btnExternal = document.getElementById('pdfExternalBtn');

  if (overlay && frame) {
    const previewUrl = gdriveToPdfPreview(url);
    frame.src = previewUrl;
    if (modalTitle) {
        modalTitle.innerText = title; // Gunakan innerText agar lebih pasti
    }
    if (btnExternal) btnExternal.href = url;
    overlay.classList.add('open');
  }
}

window.closePdf = function() {
  const overlay = document.getElementById('pdfOverlay');
  const frame = document.getElementById('pdfFrame');
  if (overlay) overlay.classList.remove('open');
  if (frame) frame.src = '';
}

window.closePdfOnBg = function(e) {
    if(e.target.id === 'pdfOverlay') closePdf();
}

function closeModal() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeModal = closeModal;

window.closeOnBg = function(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

function openPdf(link, nama) {
  const previewUrl = gdriveToPdfPreview(link);
  const pdfTitle = document.getElementById('pdfTitle');
  const pdfFrame = document.getElementById('pdfFrame');
  const pdfOpenLink = document.getElementById('pdfOpenLink');
  const pdfOverlay = document.getElementById('pdfOverlay');

  if (pdfTitle) pdfTitle.textContent = nama;
  if (pdfFrame) pdfFrame.src = previewUrl;
  if (pdfOpenLink) pdfOpenLink.href = link;
  if (pdfOverlay) pdfOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openPdf = openPdf;

function closePdfModal() {
  const pdfOverlay = document.getElementById('pdfOverlay');
  const pdfFrame = document.getElementById('pdfFrame');
  if (pdfOverlay) pdfOverlay.classList.remove('open');
  if (pdfFrame) pdfFrame.src = '';
  document.body.style.overflow = '';
}
window.closePdfModal = closePdfModal;

window.closePdfOnBg = function(e) {
  if (e.target === document.getElementById('pdfOverlay')) closePdfModal();
}

// ══ VIDEO MODAL FUNCTIONS ══
function youtubeToEmbed(url) {
  if (!url) return '';
  let videoId = '';
  if (url.includes('youtube.com/watch?v=')) {
    videoId = url.split('v=')[1].split('&')[0];
  } else if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1].split('?')[0];
  } else if (url.includes('youtube.com/embed/')) {
    return url;
  }
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

window.openVideoModal = function(url, title) {
  const overlay = document.getElementById('videoOverlay');
  const frame = document.getElementById('videoFrame');
  const modalTitle = document.getElementById('videoModalTitle');

  if (overlay && frame) {
    frame.src = youtubeToEmbed(url);
    if (modalTitle) modalTitle.innerText = title;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

window.closeVideoModal = function() {
  const overlay = document.getElementById('videoOverlay');
  const frame = document.getElementById('videoFrame');
  if (overlay) overlay.classList.remove('open');
  if (frame) frame.src = '';
  document.body.style.overflow = '';
}

window.closeVideoOnBg = function(e) {
  if (e.target.id === 'videoOverlay') closeVideoModal();
}

document.addEventListener('keydown', e => { 
    if (e.key === 'Escape') { 
        closeModal(); 
        closePdfModal(); 
        closeVideoModal();
    } 
});

