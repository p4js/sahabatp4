// ══ BERANDA LOGIC (FINAL SYNC) ══

const bulanMap = {'Januari':1,'Februari':2,'Maret':3,'April':4,'Mei':5,'Juni':6,'Juli':7,'Agustus':8,'September':9,'Oktober':10,'November':11,'Desember':12};

function parseDateManual(str) {
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

function isItemPast(item) {
  if(item.manualStatus === 'tutup') return true;
  if(item.manualStatus === 'buka') return false;
  const dateEnd = item.tglSelesai ? new Date(item.tglSelesai) : parseDateManual(item.tanggal);
  return dateEnd < new Date();
}

async function loadBerandaData() {
    // 1. TUNGGU DATABASE
    if (typeof db === 'undefined') {
        setTimeout(loadBerandaData, 50);
        return;
    }

    try {
        // 2. LISTEN KE WEBINAR (Untuk Stats)
        db.collection("webinars").onSnapshot((snapshot) => {
            document.getElementById('stat-webinar').textContent = snapshot.size;
        });

        // 3. LISTEN KE JADWAL PELATIHAN
        db.collection("jadwal").onSnapshot((snapshot) => {
            // Update Total Pelatihan
            document.getElementById('stat-pelatihan').textContent = snapshot.size;

            const list = [];
            snapshot.forEach(doc => {
                let item = doc.data();
                item.id = doc.id;
                list.push(item);
            });

            // 4. UPDATE PENGUMUMAN
            let upcoming = list.filter(d => !isItemPast(d));
            upcoming.sort((a, b) => {
                const dateA = a.tglMulai ? new Date(a.tglMulai) : parseDateManual(a.tanggal);
                const dateB = b.tglMulai ? new Date(b.tglMulai) : parseDateManual(b.tanggal);
                return dateA - dateB;
            });

            const top3 = upcoming.slice(0, 3);
            const listEl = document.getElementById('pengumuman-list');
            
            if (top3.length === 0) {
                listEl.innerHTML = `
                    <div class="pengumuman-item">
                        <div class="pengumuman-text">
                            <p class="pengumuman-title">Belum ada pelatihan aktif saat ini.</p>
                            <p class="pengumuman-meta">Nantikan jadwal terbaru di Sahabat P4.</p>
                        </div>
                    </div>`;
            } else {
                listEl.innerHTML = top3.map(item => `
                    <div class="pengumuman-item" style="cursor:pointer;" onclick="location.href='jadwal-pelatihan.html'">
                        <div class="pengumuman-dot"></div>
                        <div class="pengumuman-text">
                            <p class="pengumuman-title">Pendaftaran Dibuka: ${item.judul}</p>
                            <p class="pengumuman-meta">${item.tanggal} · Jenjang ${item.jenjang}</p>
                        </div>
                    </div>
                `).join('');
            }
        });

        // 5. LISTEN KE MATERI (Untuk Stats)
        db.collection("materi").onSnapshot((snapshot) => {
            document.getElementById('stat-materi').textContent = snapshot.size;
        });
    } catch (e) {
        console.error("Beranda DB Error:", e);
    }
}

// Jalankan
loadBerandaData();
