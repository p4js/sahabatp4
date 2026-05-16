/**
 * ══ Sahabat P4 Shared Script ══
 */

function initShared() {
    injectHeader();
    setupPopup();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShared);
} else {
    initShared();
}

/**
 * Injects a common navigation header into all pages.
 * Looks for <header id="main-header"></header>
 */
function injectHeader() {
    const headerPlaceholder = document.getElementById('main-header');
    if (!headerPlaceholder) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    const navItems = [
        { name: 'Beranda', link: 'index.html' },
        { name: 'Jadwal Pelatihan', link: 'jadwal-pelatihan.html' },
        { name: 'Jelajah Materi', link: 'jelajah-materi.html' },
        { name: 'Webinar', link: 'webinar.html' },
        { name: 'Tentang', link: 'tentang-p4.html' }
    ];

    let navHtml = '';
    navItems.forEach(item => {
        const isActive = currentPage === item.link ? 'active' : '';
        navHtml += `<li><a href="${item.link}" class="${isActive}">${item.name}</a></li>`;
    });

    headerPlaceholder.innerHTML = `
        <nav class="main-header">
            <a href="index.html" class="header-logo">
                <img src="https://i.ibb.co.com/JwPJjtf7/Folder-Google-Drive.png" alt="Logo" style="height: 50px; width: auto; object-fit: contain;">
                <span>Sahabat P4</span>
            </a>
            
            <!-- Hamburger Menu for Mobile -->
            <button class="menu-toggle" id="menuToggle" aria-label="Buka Menu">
                <i class="fas fa-bars"></i>
            </button>

            <ul class="nav-links" id="navLinks">
                ${navHtml}
                <!-- Admin link moved inside menu for mobile if needed, 
                     but we'll keep the button outside for now or sync it -->
            </ul>

            <div class="header-right desktop-only">
                <a href="admin.html" class="btn-admin-header" target="_blank">
                    <i class="fas fa-user-shield"></i>
                    <span>Admin</span>
                </a>
            </div>
        </nav>
    `;

    // Toggle Mobile Menu
    const menuToggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.querySelector('i').classList.toggle('fa-bars');
            menuToggle.querySelector('i').classList.toggle('fa-times');
        });
    }
}

/**
 * ══ POPUP LOGIC ══
 * Tampil sekali per sesi (sessionStorage)
 */
function setupPopup() {
    const overlay = document.getElementById('popupOverlay');
    if (!overlay) return;

    // Show popup
    if (!sessionStorage.getItem('p4_popup_shown')) {
        setTimeout(() => {
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        }, 300);
    }

    // Close function (attached to window for global access from HTML)
    window.closePopup = function() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        sessionStorage.setItem('p4_popup_shown', '1');
    };

    // Overlay click
    overlay.addEventListener('click', function(event) {
        if (event.target === overlay) {
            window.closePopup();
        }
    });
}
