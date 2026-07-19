document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('mobile-nav-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarNav = document.querySelector('.sidebar-nav');

    // Restore sidebar scroll position (helpful for file:/// fallback)
    if (sidebarNav) {
        const savedScroll = sessionStorage.getItem('sidebarScroll');
        if (savedScroll) {
            sidebarNav.scrollTop = parseInt(savedScroll, 10);
        }
        
        // Save scroll position on scroll
        sidebarNav.addEventListener('scroll', () => {
            sessionStorage.setItem('sidebarScroll', sidebarNav.scrollTop);
        });
    }

    toggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 1024) {
            if (!sidebar.contains(e.target) && !toggle.contains(e.target) && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        }
    });

    // Smooth scroll for anchor links
    function initAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth'
                    });
                    
                    // Update URL without jumping
                    history.pushState(null, null, '#' + targetId);
                }
            });
        });
    }

    initAnchorLinks();

    // Scroll to top functionality
    const scrollToTopBtn = document.getElementById('scrollToTop');
    if (scrollToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // --- SPA Routing Logic ---
    let currentPathname = window.location.pathname;

    function updateActiveSidebarLink(url) {
        // Remove active class from all
        document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
        
        // Extract filename from url
        const pathParts = url.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        // Strip any hash or query parameters from the filename to find the right link
        const cleanFilename = (lastPart || 'index.html').split('#')[0].split('?')[0];
        
        const activeLink = document.querySelector(`.sidebar-nav a[href="${cleanFilename}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    async function loadPage(url, pushHistory = true) {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.classList.add('loading');

        try {
            // Fetch the new page
            const response = await fetch(url);
            if (!response.ok) throw new Error('Page not found');
            const html = await response.text();

            // Parse the HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Replace content
            const newContent = doc.querySelector('.main-content');
            if (newContent && mainContent) {
                mainContent.innerHTML = newContent.innerHTML;
            }

            // Update title
            document.title = doc.title;

            // Re-initialize anchor links for the new content
            initAnchorLinks();

            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 1024) {
                sidebar.classList.remove('open');
            }

            // Update URL and History
            if (pushHistory) {
                history.pushState({}, '', url);
                currentPathname = window.location.pathname;
            }
            
            // Scroll to top or specific hash
            const hash = new URL(url, window.location.origin).hash;
            if (hash) {
                const target = document.getElementById(hash.substring(1));
                if (target) {
                    target.scrollIntoView();
                }
            } else {
                window.scrollTo(0, 0);
            }

            // Update Sidebar
            updateActiveSidebarLink(url);

        } catch (error) {
            console.error('Error loading page:', error);
            // Fallback to normal navigation
            window.location.href = url;
        } finally {
            if (mainContent) mainContent.classList.remove('loading');
        }
    }

    // Intercept clicks on links
    document.addEventListener('click', (e) => {
        // Find the closest anchor tag
        const a = e.target.closest('a');
        if (!a) return;

        const href = a.getAttribute('href');
        
        // Ignore external links, anchor links, and mailto/tel
        if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:')) {
            return;
        }

        // Only handle .html files for SPA navigation
        if (href.endsWith('.html') || href.includes('.html#')) {
            // Check if protocol is file: SPA won't work locally due to CORS
            if (window.location.protocol === 'file:') {
                // Fallback to normal navigation, scroll state is saved via sessionStorage
                return;
            }

            e.preventDefault();
            // construct absolute url to safely parse
            const absoluteUrl = new URL(href, window.location.href).href;
            loadPage(absoluteUrl);
        }
    });

    // Handle back/forward buttons
    window.addEventListener('popstate', (e) => {
        if (window.location.protocol === 'file:') return;

        if (window.location.pathname !== currentPathname) {
            currentPathname = window.location.pathname;
            loadPage(window.location.href, false);
        }
    });
});
