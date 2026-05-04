// ══ ADMIN PANEL LOGIC (ADVANCED SORTING & PREMIUM CALENDAR) ══

const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

// 🔥 Inisialisasi Kalender Premium (Google Style)
const configFP = {
    altInput: true,
    altFormat: "j F Y",
    dateFormat: "Y-m-d",
};
const fpStart = flatpickr("#j_tgl_mulai", configFP);
const fpEnd = flatpickr("#j_tgl_selesai", configFP);

// State Global
let currentSortCol = 'tglMulai';
let currentSortDir = 'asc';
let cachedJadwalData = [];
let cachedMateriData = [];
let deleteTargetId = null; 
let deleteTargetType = 'jadwal'; // 'jadwal' or 'materi'

const imageMap = {
  PAUD:       'https://i.ibb.co.com/gMjGGm9C/1.png',
  SD:         'https://i.ibb.co.com/cSzbGvqw/4.png',
  SMP:        'https://i.ibb.co.com/rGbzLkJq/5.png',
  SMA:        'https://i.ibb.co.com/RpN4hpBc/6.png',
  SLB:        'https://i.ibb.co.com/PGpNCK4v/7.png',
  Kesetaraan: 'https://i.ibb.co.com/5hRPDY5w/Salinan-dari-Pelatihan-dan-Pengembangan-Pendidik-jenjang-PAUD.png',
  SMK:        'https://i.ibb.co.com/MkcVSZX5/8.png',
};

const bulanMap = {'Januari':1,'Februari':2,'Maret':3,'April':4,'Mei':5,'Juni':6,'Juli':7,'Agustus':8,'September':9,'Oktober':10,'November':11,'Desember':12};

function parseTanggalManual(str) {
    if(!str) return new Date(0);
    try {
        const parts = str.split(/[–-]/).map(s => s.trim());
        const lastPart = parts[parts.length - 1]; 
        const tokens = lastPart.split(/\s+/);
        let year = tokens.find(t => t.length === 4 && !isNaN(t));
        let monthName = tokens.find(t => bulanMap[t]);
        let day = tokens.find(t => !isNaN(t) && t.length <= 2);
        if(day && monthName && year) return new Date(parseInt(year), bulanMap[monthName]-1, parseInt(day));
    } catch(e) {}
    return new Date(0);
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        dashboardScreen.classList.remove('hidden');
        
        // 1. Listen to JADWAL
        db.collection("jadwal").onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
                let item = doc.data();
                item.id = doc.id;
                list.push(item);
            });
            cachedJadwalData = list;
            loadTable();
        });

        // 2. Listen to MATERI (Unified for Dashboard & Table)
        db.collection("materi").onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
                let item = doc.data();
                item.id = doc.id;
                list.push(item);
            });
            cachedMateriData = list;
            
            updateDashboard(); // Update Statistik Dashboard
            loadTableMateri(); // Update Tabel Materi
            
            // Auto-seed if empty
            if (list.length === 0) {
                console.log("Database materi kosong, memulai impor otomatis...");
                autoSeedMateri();
            }
        });

        // 3. Listen to WEBINAR
        db.collection("webinars").onSnapshot((snapshot) => {
            const list = [];
            snapshot.forEach(doc => {
                let item = doc.data();
                item.id = doc.id;
                list.push(item);
            });
            cachedWebinarData = list;
            loadTableWebinar();

            // Auto-seed if empty
            if (list.length === 0) {
                console.log("Database webinar kosong, memulai impor otomatis...");
                autoSeedWebinars();
            }
        });

    } else {
        loginScreen.classList.remove('hidden');
        dashboardScreen.classList.add('hidden');
    }
});

function formatTrainingDate(startStr, endStr) {
    if(!startStr || !endStr) return "";
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const d1 = start.getDate();
    const m1 = months[start.getMonth()];
    const y1 = start.getFullYear();
    const d2 = end.getDate();
    const m2 = months[end.getMonth()];
    const y2 = end.getFullYear();
    if (m1 === m2 && y1 === y2) return `${d1} – ${d2} ${m1} ${y1}`;
    if (y1 === y2) return `${d1} ${m1} – ${d2} ${m2} ${y1}`;
    return `${d1} ${m1} ${y1} – ${d2} ${m2} ${y2}`;
}

const tbodyJadwal = document.getElementById('tbody-jadwal');

window.toggleStatus = async function(id, isChecked) {
    try {
        await db.collection("jadwal").doc(id).update({ manualStatus: isChecked ? 'buka' : 'tutup' });
    } catch(e) { alert("Gagal: " + e.message); }
}

function getEffectiveStatus(d) {
    if(d.manualStatus) return d.manualStatus === 'buka';
    const dateEnd = d.tglSelesai ? new Date(d.tglSelesai) : parseTanggalManual(d.tanggal);
    return dateEnd >= new Date();
}

function loadTable() {
    const tbodyJadwal = document.getElementById('tbody-jadwal');
    if(!tbodyJadwal) return;
    
    try {
        // 1. UPDATE STATS
        const total = cachedJadwalData.length;
        const active = cachedJadwalData.filter(d => getEffectiveStatus(d)).length;
        const closed = total - active;
        const totalKuota = cachedJadwalData.reduce((acc, d) => acc + (parseInt(d.kuota) || 0), 0);

        const sTotal = document.getElementById('stat-total');
        const sActive = document.getElementById('stat-active');
        const sClosed = document.getElementById('stat-closed');
        const sKuota = document.getElementById('stat-kuota');

        if(sTotal) sTotal.textContent = total;
        if(sActive) sActive.textContent = active;
        if(sClosed) sClosed.textContent = closed;
        if(sKuota) sKuota.textContent = totalKuota.toLocaleString();

        // 2. FILTER DATA
        const searchInput = document.getElementById('adminSearchInput');
        const q = searchInput ? searchInput.value.toLowerCase() : "";
    let list = cachedJadwalData.filter(d => 
        d.judul.toLowerCase().includes(q) || 
        d.jenjang.toLowerCase().includes(q) || 
        d.tanggal.toLowerCase().includes(q)
    );

    // 3. SORT DATA
    list.sort((a, b) => {
        let valA, valB;
        if (currentSortCol === 'tglMulai') {
            valA = a.tglMulai ? new Date(a.tglMulai) : parseTanggalManual(a.tanggal);
            valB = b.tglMulai ? new Date(b.tglMulai) : parseTanggalManual(b.tanggal);
            return currentSortDir === 'asc' ? valA - valB : valB - valA;
        } 
        else if (currentSortCol === 'manualStatus') {
            valA = getEffectiveStatus(a);
            valB = getEffectiveStatus(b);
            return currentSortDir === 'asc' ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
        }
        else {
            valA = a[currentSortCol] || "";
            valB = b[currentSortCol] || "";
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        }
    });

    // 4. RENDER TABLE
    let html = '';
    if(list.length === 0) {
        html = '<tr><td colspan="6">Data tidak ditemukan.</td></tr>';
    } else {
        list.forEach((d) => {
            const isBuka = getEffectiveStatus(d);
            html += `
                <tr>
                    <td><strong>${d.judul}</strong></td>
                    <td>${d.tanggal}</td>
                    <td>${d.jenjang}</td>
                    <td>${d.kuota}</td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" ${isBuka ? 'checked' : ''} onchange="toggleStatus('${d.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="btn-edit" onclick="editJadwal('${d.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteJadwal('${d.id}')">Hapus</button>
                    </td>
                </tr>
            `;
        });
    }
        tbodyJadwal.innerHTML = html;
    } catch(e) { 
        console.error("Error loading table Jadwal:", e); 
    }
}

window.sortAdminTable = function(col) {
    if (currentSortCol === col) {
        currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortCol = col;
        currentSortDir = 'asc';
    }
    loadTable();
}

// ══ MATERI MANAGEMENT ══
const tbodyMateri = document.getElementById('tbody-materi');
const topikListContainer = document.getElementById('topikListContainer');

// State Global Materi
let currentMateriSortCol = 'judul';
let currentMateriSortDir = 'asc';

window.toggleMateriStatus = async function(id, isChecked) {
    try {
        await db.collection("materi").doc(id).update({ status: isChecked ? 'aktif' : 'nonaktif' });
    } catch(e) { alert("Gagal update status: " + e.message); }
}

function loadTableMateri() {
    const tbodyMateri = document.getElementById('tbody-materi');
    if(!tbodyMateri) return;

    try {
        // 1. UPDATE STATS MATERI
        const totalPaket = cachedMateriData.length;
        let totalTopik = 0;
        const jenjangCount = {};

        cachedMateriData.forEach(m => {
            totalTopik += (m.topik ? m.topik.length : 0);
            if(m.jenjang) {
                m.jenjang.forEach(j => {
                    jenjangCount[j] = (jenjangCount[j] || 0) + 1;
                });
            }
        });

        let topJenjang = "-";
        let maxC = 0;
        for(let j in jenjangCount) {
            if(jenjangCount[j] > maxC) { maxC = jenjangCount[j]; topJenjang = j; }
        }

        const smTotal = document.getElementById('stat-materi-total');
        const smTopik = document.getElementById('stat-materi-topik');
        const smJenjang = document.getElementById('stat-materi-jenjang');

        if(smTotal) smTotal.textContent = totalPaket;
        if(smTopik) smTopik.textContent = totalTopik;
        if(smJenjang) smJenjang.textContent = topJenjang;

        // 2. FILTER DATA
        const searchInput = document.getElementById('adminMateriSearchInput');
        const q = searchInput ? searchInput.value.toLowerCase() : "";
    let list = cachedMateriData.filter(m => 
        m.judul.toLowerCase().includes(q) || 
        (m.jenjang && m.jenjang.some(j => j.toLowerCase().includes(q)))
    );

    // 3. SORT DATA
    list.sort((a, b) => {
        let valA, valB;
        if (currentMateriSortCol === 'topikCount') {
            valA = a.topik ? a.topik.length : 0;
            valB = b.topik ? b.topik.length : 0;
        } else if (currentMateriSortCol === 'jenjang') {
            valA = a.jenjang ? a.jenjang.join(', ') : "";
            valB = b.jenjang ? b.jenjang.join(', ') : "";
        } else if (currentMateriSortCol === 'status') {
            valA = (a.status !== 'nonaktif');
            valB = (b.status !== 'nonaktif');
            return currentMateriSortDir === 'asc' ? (valA === valB ? 0 : valA ? -1 : 1) : (valA === valB ? 0 : valA ? 1 : -1);
        } else {
            valA = a[currentMateriSortCol] || "";
            valB = b[currentMateriSortCol] || "";
        }

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return currentMateriSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return currentMateriSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    // 4. RENDER TABLE
    let html = '';
    if(list.length === 0) {
        html = '<tr><td colspan="5">Data materi tidak ditemukan.</td></tr>';
    } else {
        list.forEach((m) => {
            const isAktif = m.status !== 'nonaktif';
            html += `
                <tr>
                    <td><strong>${m.judul}</strong></td>
                    <td>${m.jenjang ? m.jenjang.join(', ') : '-'}</td>
                    <td><span class="badge-count">${m.topik ? m.topik.length : 0} Topik</span></td>
                    <td>
                        <label class="switch">
                            <input type="checkbox" ${isAktif ? 'checked' : ''} onchange="toggleMateriStatus('${m.id}', this.checked)">
                            <span class="slider"></span>
                        </label>
                    </td>
                    <td style="white-space: nowrap;">
                        <button class="btn-edit" onclick="editMateri('${m.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteMateri('${m.id}')">Hapus</button>
                    </td>
                </tr>
            `;
        });
    }
        tbodyMateri.innerHTML = html;
    } catch(e) { 
        console.error("Error loading table Materi:", e); 
    }
}

window.sortMateriTable = function(col) {
    if (currentMateriSortCol === col) {
        currentMateriSortDir = currentMateriSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        currentMateriSortCol = col;
        currentMateriSortDir = 'asc';
    }
    loadTableMateri();
}

window.addTopikRow = function(data = {label:'', nama:'', deskripsi:'', link:'', views:0}) {
    const div = document.createElement('div');
    div.className = 'topik-form-item';
    div.style = 'background:#fdfdfd; border:1px solid #e2e8f0; border-radius:10px; padding:15px; margin-bottom:15px; position:relative; transition:0.3s;';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #f1f5f9; padding-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="background:#6366f1; color:white; font-size:10px; font-weight:900; padding:2px 6px; border-radius:4px; text-transform:uppercase;">TOPIK</span>
                <span style="font-size:11px; font-weight:700; color:#475569; letter-spacing:0.5px;">PENGATURAN</span>
            </div>
            <div style="display:flex; gap:6px;">
                <button type="button" onclick="moveTopic(this, 'up')" style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">▲</button>
                <button type="button" onclick="moveTopic(this, 'down')" style="background:#fff; border:1px solid #e2e8f0; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:11px; display:flex; align-items:center; justify-content:center; transition:0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'">▼</button>
                <button type="button" onclick="this.closest('.topik-form-item').remove()" style="background:#fef2f2; color:#ef4444; border:1px solid #fee2e2; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:14px; font-weight:bold; margin-left:5px; transition:0.2s;" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='#fef2f2'">×</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns: 90px 1fr; gap:12px;">
            <div class="input-mini">
                <label style="font-size:10px; font-weight:800; color:#94a3b8; display:block; margin-bottom:4px;">LABEL</label>
                <input type="text" placeholder="Topik 1" class="t-label" value="${data.label || ''}" style="width:100%; font-size:12px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
            <div class="input-mini">
                <label style="font-size:10px; font-weight:800; color:#94a3b8; display:block; margin-bottom:4px;">NAMA TOPIK</label>
                <input type="text" placeholder="Masukkan nama topik..." class="t-nama" value="${data.nama || ''}" style="width:100%; font-size:12px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
            </div>
        </div>
        <div style="margin-top:12px;">
            <label style="font-size:10px; font-weight:800; color:#94a3b8; display:block; margin-bottom:4px;">DESKRIPSI TOPIK</label>
            <textarea placeholder="Jelaskan isi topik ini..." class="t-desc" style="width:100%; font-size:12px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; height:60px; resize:none;">${data.deskripsi || ''}</textarea>
        </div>
        <div style="margin-top:12px;">
            <label style="font-size:10px; font-weight:800; color:#94a3b8; display:block; margin-bottom:4px;">LINK DOKUMEN (GDRIVE/PDF)</label>
            <input type="url" placeholder="https://drive.google.com/..." class="t-link" value="${data.link || ''}" style="width:100%; font-size:12px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;">
        </div>
        <input type="hidden" class="t-views" value="${data.views || 0}">
    `;
    topikListContainer.appendChild(div);
}

window.moveTopic = function(btn, dir) {
    const row = btn.closest('.topik-form-item');
    if (dir === 'up' && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (dir === 'down' && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
    }
}

window.editMateri = async function(id) {
    const doc = cachedMateriData.find(m => m.id === id);
    if (doc) {
        document.getElementById('materiId').value = id;
        document.getElementById('m_judul').value = doc.judul;
        document.getElementById('m_deskripsi').value = doc.deskripsi;
        document.getElementById('m_gambar').value = doc.gambar || '';
        document.getElementById('m_is_featured').checked = doc.isFeatured || false;
        
        // Reset checkboxes
        document.querySelectorAll('input[name="m_jenjang"]').forEach(cb => {
            cb.checked = doc.jenjang && doc.jenjang.includes(cb.value);
        });

        // Reset topik
        topikListContainer.innerHTML = '';
        if(doc.topik && doc.topik.length > 0) {
            doc.topik.forEach(t => addTopikRow(t));
        } else {
            addTopikRow();
        }

        window.openModal('modalMateri', 'Edit Materi');
    }
}

document.getElementById('formMateri').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('.btn-save');
    const id = document.getElementById('materiId').value;
    
    const jenjangArr = Array.from(document.querySelectorAll('input[name="m_jenjang"]:checked')).map(cb => cb.value);
    if(jenjangArr.length === 0) return alert("Pilih minimal satu jenjang!");

    const topikArr = [];
    document.querySelectorAll('.topik-form-item').forEach(item => {
        const label = item.querySelector('.t-label').value;
        const nama = item.querySelector('.t-nama').value;
        if(label && nama) {
            topikArr.push({
                label: label,
                nama: nama,
                deskripsi: item.querySelector('.t-desc').value,
                link: item.querySelector('.t-link').value,
                views: parseInt(item.querySelector('.t-views').value || 0)
            });
        }
    });

    const originalText = btn.textContent;
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    try {
        const newData = {
            judul: document.getElementById('m_judul').value,
            deskripsi: document.getElementById('m_deskripsi').value,
            gambar: document.getElementById('m_gambar').value,
            jenjang: jenjangArr,
            topik: topikArr,
            status: 'aktif',
            isFeatured: document.getElementById('m_is_featured').checked
        };
        if(id) { await db.collection("materi").doc(id).update(newData); } 
        else { await db.collection("materi").add(newData); }
        window.closeModal('modalMateri');
    } catch (error) { alert("Gagal: " + error.message); } 
    finally { btn.textContent = originalText; btn.disabled = false; }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    try {
        btn.textContent = 'Memuat...';
        btn.disabled = true;
        await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
        loginError.textContent = 'Login gagal: ' + error.message;
    } finally {
        btn.textContent = 'Login';
        btn.disabled = false;
    }
});

logoutBtn.addEventListener('click', () => auth.signOut());

const tabLinks = document.querySelectorAll('.sidebar-menu li');
const tabContents = document.querySelectorAll('.tab-content');

tabLinks.forEach(link => {
    link.addEventListener('click', () => {
        tabLinks.forEach(l => l.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        link.classList.add('active');
        const targetId = link.getAttribute('data-tab');
        const el = document.getElementById(targetId);
        if(el) el.classList.add('active');
    });
});

window.openModal = function(modalId, title = "Tambah Jadwal") {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.add('active');
        if(modalId === 'modalJadwal') document.getElementById('modalJadwalTitle').textContent = title;
        if(modalId === 'modalMateri') {
            document.getElementById('modalMateriTitle').textContent = title;
            if(title.includes('Tambah')) {
                topikListContainer.innerHTML = '';
                addTopikRow();
            }
        }
    }
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if(modal) {
        modal.classList.remove('active');
        if(modalId === 'modalJadwal') {
            document.getElementById('formJadwal').reset();
            if(typeof fpStart !== 'undefined') fpStart.clear();
            if(typeof fpEnd !== 'undefined') fpEnd.clear();
            document.getElementById('jadwalId').value = '';
        }
        if(modalId === 'modalMateri') {
            document.getElementById('formMateri').reset();
            document.getElementById('materiId').value = '';
            topikListContainer.innerHTML = '';
        }
    }
}

window.updateImagePreview = function(val) {
    const img = document.getElementById('j_preview_img');
    if(img) img.src = imageMap[val] || '';
}

const formJadwal = document.getElementById('formJadwal');

window.editJadwal = async function(id) {
    const doc = await db.collection("jadwal").doc(id).get();
    if (doc.exists) {
        const d = doc.data();
        document.getElementById('jadwalId').value = id;
        document.getElementById('j_judul').value = d.judul;
        if(d.tglMulai) fpStart.setDate(d.tglMulai);
        if(d.tglSelesai) fpEnd.setDate(d.tglSelesai);
        document.getElementById('j_tanggal').value = d.tanggal;
        document.getElementById('j_jenjang').value = d.jenjang;
        document.getElementById('j_kuota').value = d.kuota;
        document.getElementById('j_link').value = d.link;
        window.openModal('modalJadwal', 'Edit Jadwal');
    }
}

formJadwal.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = formJadwal.querySelector('.btn-save');
    const id = document.getElementById('jadwalId').value;
    const tglMulai = document.getElementById('j_tgl_mulai').value;
    const tglSelesai = document.getElementById('j_tgl_selesai').value;
    const formattedText = formatTrainingDate(tglMulai, tglSelesai);
    const originalText = btn.textContent;
    btn.textContent = 'Menyimpan...';
    btn.disabled = true;

    try {
        const newData = {
            judul: document.getElementById('j_judul').value,
            tanggal: formattedText || document.getElementById('j_tanggal').value,
            tglMulai: tglMulai,
            tglSelesai: tglSelesai,
            jenjang: document.getElementById('j_jenjang').value,
            kuota: parseInt(document.getElementById('j_kuota').value),
            link: document.getElementById('j_link').value
        };
        if(id) { await db.collection("jadwal").doc(id).update(newData); } 
        else { await db.collection("jadwal").add(newData); }
        window.closeModal('modalJadwal');
    } catch (error) { alert("Gagal: " + error.message); } 
    finally { btn.textContent = originalText; btn.disabled = false; }
});

// ══ WEBINAR MANAGEMENT ══
let cachedWebinarData = [];
const tbodyWebinar = document.getElementById('tbody-webinar');
const formWebinar = document.getElementById('formWebinar');

function loadTableWebinar() {
    const tbody = document.getElementById('tbody-webinar');
    if(!tbody) return;

    // Stats
    const total = cachedWebinarData.length;
    const upcoming = cachedWebinarData.filter(w => w.status === 'upcoming' || w.status === 'live').length;
    const done = total - upcoming;

    const sTotal = document.getElementById('stat-webinar-total');
    const sUpcoming = document.getElementById('stat-webinar-upcoming');
    const sDone = document.getElementById('stat-webinar-done');

    if(sTotal) sTotal.textContent = total;
    if(sUpcoming) sUpcoming.textContent = upcoming;
    if(sDone) sDone.textContent = done;

    // Render Table
    let html = '';
    if(cachedWebinarData.length === 0) {
        html = '<tr><td colspan="5">Belum ada data webinar.</td></tr>';
    } else {
        cachedWebinarData.forEach(w => {
            const statusLabel = w.status === 'upcoming' ? 'Segera' : (w.status === 'live' ? 'LIVE' : 'Selesai');
            const statusClass = `badge-${w.status}`;
            html += `
                <tr>
                    <td><strong>${w.judul}</strong></td>
                    <td>${w.tanggal} <br> <small>${w.waktu || ''}</small></td>
                    <td>${w.narasumber || '-'}</td>
                    <td><span class="status-badge ${statusClass}" style="position:static; backdrop-filter:none; box-shadow:none;">${statusLabel}</span></td>
                    <td style="white-space:nowrap;">
                        <button class="btn-edit" onclick="editWebinar('${w.id}')">Edit</button>
                        <button class="btn-delete" onclick="deleteWebinar('${w.id}')">Hapus</button>
                    </td>
                </tr>
            `;
        });
    }
    tbody.innerHTML = html;
}

window.editWebinar = function(id) {
    const doc = cachedWebinarData.find(w => w.id === id);
    if(doc) {
        document.getElementById('webinarId').value = id;
        document.getElementById('w_judul').value = doc.judul;
        document.getElementById('w_tanggal').value = doc.tanggal;
        document.getElementById('w_waktu').value = doc.waktu || '';
        document.getElementById('w_narasumber').value = doc.narasumber || '';
        document.getElementById('w_gambar').value = doc.gambar || '';
        document.getElementById('w_status').value = doc.status || 'upcoming';
        document.getElementById('w_linkDaftar').value = doc.linkDaftar || '';
        document.getElementById('w_linkVideo').value = doc.linkVideo || '';
        document.getElementById('w_linkMateri').value = doc.linkMateri || '';
        openModal('modalWebinar', 'Edit Webinar');
    }
}

window.deleteWebinar = function(id) {
    deleteTargetId = id;
    deleteTargetType = 'webinar';
    openModal('modalConfirm');
}

if(formWebinar) {
    formWebinar.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = formWebinar.querySelector('.btn-save');
        const id = document.getElementById('webinarId').value;
        const originalText = btn.textContent;
        btn.textContent = 'Menyimpan...';
        btn.disabled = true;

        try {
            const newData = {
                judul: document.getElementById('w_judul').value,
                tanggal: document.getElementById('w_tanggal').value,
                waktu: document.getElementById('w_waktu').value,
                narasumber: document.getElementById('w_narasumber').value,
                gambar: document.getElementById('w_gambar').value,
                status: document.getElementById('w_status').value,
                linkDaftar: document.getElementById('w_linkDaftar').value,
                linkVideo: document.getElementById('w_linkVideo').value,
                linkMateri: document.getElementById('w_linkMateri').value
            };
            if(id) { await db.collection("webinars").doc(id).update(newData); }
            else { await db.collection("webinars").add(newData); }
            closeModal('modalWebinar');
        } catch (error) { alert("Gagal: " + error.message); }
        finally { btn.textContent = originalText; btn.disabled = false; }
    });
}

// 🔥 KONFIRMASI HAPUS CUSTOM
window.deleteJadwal = function(id) {
    deleteTargetId = id;
    deleteTargetType = 'jadwal';
    window.openModal('modalConfirm');
}

window.deleteMateri = function(id) {
    deleteTargetId = id;
    deleteTargetType = 'materi';
    window.openModal('modalConfirm');
}

// ══ OTOMATISASI IMPOR (AUTO-SEED) ══
async function autoSeedMateri() {
    const initialData = [
      {
        jenjang: ["SD","SMP","SMA","SMK","Kesetaraan"],
        judul: "Pelatihan Pendidikan Inklusif (Dasar)",
        deskripsi: "Memahami keragaman siswa, strategi pengajaran inklusif, dan penciptaan lingkungan belajar yang ramah bagi semua anak.",
        gambar: "https://i.ibb.co.com/0jXmZXnf/Pelatihan-dan-Pengembangan-Pendidik-jenjang-PAUD-4.png",
        topik: [
          { label:"Topik 1", nama:"Mengenal Keragaman di Kelas", deskripsi:"Identifikasi berbagai keunikan dan karakteristik siswa di dalam kelas.", link:"https://drive.google.com/file/d/1cXjqC2B-UNEfgw0c60CRX5tWK5corx4v/view?usp=drive_link" },
          { label:"Topik 2", nama:"Mengelola Keragaman di Kelas", deskripsi:"Strategi praktis mengatur kelas dengan latar belakang siswa yang berbeda.", link:"https://drive.google.com/file/d/1BHAHO-CCTMz9zHBb5ALNh7AMtCTsHUO5/view?usp=drive_link" },
          { label:"Topik 3", nama:"Memahami Pentingnya Pendidikan Inklusif", deskripsi:"Menelaah mengapa pendidikan inklusif menjadi kunci kesetaraan belajar.", link:"https://drive.google.com/file/d/1WMJWCoqf2Y8CpEZYdtmFrKcc3YXxv144/view?usp=drive_link" },
          { label:"Topik 4", nama:"Desain Universal untuk Pembelajaran (DUP)", deskripsi:"Mengenal Desain Universal untuk Pembelajaran agar materi mudah diakses semua siswa.", link:"https://drive.google.com/file/d/1vJE38lOETQnxcNqiWlWGaMVVvUk_jJZZ/view?usp=drive_link" },
          { label:"Topik 5", nama:"Lingkungan Inklusif Ramah Pembelajaran", deskripsi:"Cara menciptakan suasana kelas yang mendukung kenyamanan belajar setiap anak.", link:"https://drive.google.com/file/d/1yiPj6tgdgyHefx3sSxl_Rwyo0HnJT6Oy/view?usp=drive_link" },
          { label:"Topik 6", nama:"Asesmen Kebutuhan Fungsional", deskripsi:"Cara memetakan kebutuhan nyata siswa untuk menentukan dukungan yang tepat.", link:"https://drive.google.com/file/d/17Dc9kwHV-lc3F0Bf64_WTspAhyHL8Ppr/view?usp=drive_link" },
          { label:"Topik 7", nama:"Strategi Pembelajaran Langsung dan Prompt", deskripsi:"Teknik mengajar langsung dan pemberian bantuan (prompt) yang efektif di kelas.", link:"https://drive.google.com/file/d/1UdLetqvJtieLcA4VTcz-L4QvPLbHaryv/view?usp=drive_link" },
        ]
      },
      {
        jenjang: ["PAUD"],
        judul: "Pelatihan Penguatan Pendidikan Karakter",
        deskripsi: "Pemahaman kebijakan, konsep, strategi, dan aktivitas pengembangan karakter anak usia dini melalui nilai-nilai utama.",
        gambar: "https://i.ibb.co.com/RTvqpCzJ/12.png",
        topik: [
          { label:"Topik 1", nama:"Kebijakan Pendidikan Karakter di Satuan PAUD", deskripsi:"Penjelasan mengenai landasan regulasi dan kebijakan resmi dalam implementasi penguatan karakter di jenjang PAUD.", link:"https://drive.google.com/file/d/1jP0JfgpOuiPZ7xB4_O4vNPSHl8pagAuf/view?usp=drive_link" },
          { label:"Topik 2", nama:"Konsep Pendidikan Karakter", deskripsi:"Pendalaman mengenai teori, prinsip dasar, dan filosofi pembentukan karakter pada anak usia dini.", link:"" },
          { label:"Topik 3", nama:"Strategi Pengembangan Pendidikan Karakter di PAUD", deskripsi:"Pembahasan mengenai berbagai pendekatan dan metode efektif untuk mengintegrasikan nilai karakter dalam pembelajaran.", link:"https://drive.google.com/file/d/1nN3WmL3uKOKjJW2Lxr3SCS-rYKxcojbV/view?usp=drive_link" },
          { label:"Topik 4", nama:"Nilai-Nilai Karakter Yang Dikembangkan 7 KAIH", deskripsi:"Identifikasi dan bedah materi mengenai tujuh nilai karakter utama yang menjadi fokus pengembangan dalam kerangka 7 KAIH.", link:"https://drive.google.com/file/d/17at5PIf2a7k6ZpOzAdIM8lVVL_WMdJiQ/view?usp=drive_link" },
          { label:"Topik 5", nama:"Aktivitas Pengembangan Pendidikan Karakter", deskripsi:"Penyusunan ragam kegiatan konkret dan praktik baik yang dapat diterapkan untuk menstimulasi karakter anak.", link:"https://drive.google.com/file/d/1QV4UbzGqYusZyFT_6K7vv4-7tEkfPb4z/view?usp=drive_link" },
        ]
      },
      {
        jenjang: ["SMP","SMA"],
        judul: "Pelatihan Peningkatan Kompetensi Guru dalam Layanan Bimbingan dan Konseling",
        deskripsi: "Tujuh jurus praktis bagi guru BK untuk mengenali potensi, mengelola emosi, membangun koneksi, dan menciptakan layanan konseling yang efektif.",
        gambar: "https://i.ibb.co.com/xcdwX83/13.png",
        topik: [
          { label:"Topik 1", nama:"Jurus 1: Kenali Potensi", deskripsi:"Pemetaan potensi, minat, dan kebutuhan murid melalui alat asesmen sederhana untuk bimbingan yang tepat sasaran.", link:"https://drive.google.com/file/d/1Lq51YRTo1ZE1te4edAX76rO2cfv3ItBK/view?usp=drive_link" },
          { label:"Topik 2", nama:"Jurus 2: Kelola Emosi", deskripsi:"Pengelolaan emosi guru dan bimbingan regulasi emosi murid demi menciptakan suasana belajar yang tenang dan sehat.", link:"https://drive.google.com/file/d/1iw3nTWB_a-9INDKRinRPceJ8EORZ4vuc/view?usp=drive_link" },
          { label:"Topik 3", nama:"Jurus 3: Tumbuhkan Resiliensi", deskripsi:"Strategi membangun ketangguhan murid agar mampu bangkit menghadapi tantangan dan tekanan di lingkungan sekolah.", link:"https://drive.google.com/file/d/1LmYHrpyS7Hndnxvi4tMryTTNHgSDBneC/view?usp=drive_link" },
          { label:"Topik 4", nama:"Jurus 4: Jaga Konsistensi", deskripsi:"Penerapan sikap konsisten dan adil dalam layanan konseling agar murid merasa aman dan mendapatkan kepastian bimbingan.", link:"https://drive.google.com/file/d/1p6zZzu8fDmiQ3ZsinssKpdNoT5QaaycY/view?usp=drive_link" },
          { label:"Topik 5", nama:"Jurus 5: Jalin Koneksi", deskripsi:"Pembangunan hubungan empatik dan bermakna antara guru dan murid untuk menciptakan rasa percaya serta kenyamanan.", link:"https://drive.google.com/file/d/1WWlr_diQTFpkqiwl-kzhQv1D-DG8iZOJ/view?usp=drive_link" },
          { label:"Topik 6", nama:"Jurus 6: Bangun Kolaborasi", deskripsi:"Inisiasi kerja sama lintas peran (guru dan orang tua) untuk memberikan dukungan holistik bagi perkembangan murid.", link:"https://drive.google.com/file/d/1JBPrP1FFUBoMb4KuF8uWGya4MyksDvHc/view?usp=drive_link" },
          { label:"Topik 7", nama:"Jurus 7: Menata Situasi", deskripsi:"Penciptaan lingkungan sekolah dan layanan bimbingan yang ramah, aman, serta menyenangkan bagi pertumbuhan murid.", link:"https://drive.google.com/file/d/16WWsB5d1EaIBOlVDeNxFA5JrAmgGk5iU/view?usp=drive_link" },
        ]
      }
    ];

    try {
        const batch = db.batch();
        initialData.forEach(data => {
            const docRef = db.collection("materi").doc();
            batch.set(docRef, data);
        });
        await batch.commit();
        console.log("Auto-import data materi berhasil.");
    } catch(e) {
        console.error("Gagal auto-import: ", e);
    }
}

async function autoSeedWebinars() {
    const initialData = [
      {
        judul: "Budaya Sekolah Aman dan Nyaman",
        tanggal: "2024-03-20",
        waktu: "10:00 - 12:00 WIB",
        narasumber: "Tim P4 Jakarta Selatan",
        gambar: "https://img.youtube.com/vi/lVvlh5gR7ZU/maxresdefault.jpg",
        status: "done",
        linkVideo: "https://www.youtube.com/watch?v=lVvlh5gR7ZU",
        linkMateri: "https://drive.google.com/file/d/1nFsC7qJ8oFl2seEbJv4nqXvHxs-0_O4r/view?usp=drive_link",
        linkDaftar: ""
      }
    ];

    try {
        const batch = db.batch();
        initialData.forEach(data => {
            const docRef = db.collection("webinars").doc();
            batch.set(docRef, data);
        });
        await batch.commit();
        console.log("Auto-import data webinar berhasil.");
    } catch(e) {
        console.error("Gagal auto-import webinar: ", e);
    }
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if(!deleteTargetId) return;
    try {
        const collection = deleteTargetType === 'jadwal' ? 'jadwal' : (deleteTargetType === 'webinar' ? 'webinars' : 'materi');
        await db.collection(collection).doc(deleteTargetId).delete();
        window.closeModal('modalConfirm');
    } catch(e) { alert('Gagal: ' + e.message); }
    deleteTargetId = null;
});

// ══ DASHBOARD ANALYTICS ══
function updateDashboard() {
    const totalMateri = cachedMateriData.length;
    let totalViews = 0;
    let featuredCount = 0;
    const jenjangCounts = {};
    const allTopics = [];

    cachedMateriData.forEach(m => {
        if(m.isFeatured) featuredCount++;
        
        // Hitung Views
        if(m.topik) {
            m.topik.forEach(t => {
                const v = parseInt(t.views || 0);
                totalViews += v;
                allTopics.push({ name: t.nama || 'Tanpa Nama', views: v, parent: m.judul });
            });
        }

        // Hitung Jenjang
        if(m.jenjang) {
            m.jenjang.forEach(j => {
                jenjangCounts[j] = (jenjangCounts[j] || 0) + 1;
            });
        }
    });

    // Update Cards
    const dMateri = document.getElementById('dash-total-materi');
    const dViews = document.getElementById('dash-total-views');
    const dFeatured = document.getElementById('dash-total-featured');
    
    if(dMateri) dMateri.innerText = totalMateri;
    if(dViews) dViews.innerText = totalViews;
    if(dFeatured) dFeatured.innerText = featuredCount;

    // Render Jenjang Stats (Progress Bars)
    const jenjangWrap = document.getElementById('jenjang-stats');
    if(jenjangWrap) {
        const sortedJenjang = Object.entries(jenjangCounts).sort((a,b) => b[1] - a[1]);
        jenjangWrap.innerHTML = sortedJenjang.slice(0, 5).map(([name, count]) => {
            const percent = (count / totalMateri) * 100;
            return `
                <div class="progress-item">
                    <div class="progress-label"><span>${name}</span><span>${count} Materi</span></div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percent}%"></div></div>
                </div>
            `;
        }).join('');
    }

    // Render Trending Topics
    const trendingWrap = document.getElementById('trending-stats');
    if(trendingWrap) {
        const sortedTopics = allTopics.sort((a,b) => b.views - a.views);
        trendingWrap.innerHTML = `
            <div class="trending-list">
                ${sortedTopics.slice(0, 5).map((t, idx) => `
                    <div class="trending-item">
                        <div class="trending-rank">${idx + 1}</div>
                        <div class="trending-info">
                            <span class="trending-name">${t.name}</span>
                            <span class="trending-parent">${t.parent}</span>
                        </div>
                        <span class="trending-count">${t.views} Klik</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function logout() {
    auth.signOut().then(() => {
        window.location.reload();
    });
}
window.logout = logout;

// ══ LOGIN FORM HANDLER ══
if(loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const btn = loginForm.querySelector('button');
        
        btn.textContent = 'Membuka Kunci...';
        btn.disabled = true;

        auth.signInWithEmailAndPassword(email, password)
            .catch(error => {
                loginError.textContent = "Email atau Password salah!";
                loginError.classList.remove('hidden');
                btn.textContent = 'Login Admin';
                btn.disabled = false;
            });
    });
}
