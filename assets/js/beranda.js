// ══ BERANDA LOGIC (FINAL SYNC) ══

function isItemPast(item) {
  return window.checkIsPast(item);
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
                const dateA = a.tglMulai ? new Date(a.tglMulai) : (window.parseDateFromText(a.tanggal) || new Date(0));
                const dateB = b.tglMulai ? new Date(b.tglMulai) : (window.parseDateFromText(b.tanggal) || new Date(0));
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
