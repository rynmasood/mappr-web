/*!
 * Mappr — Marketing Site Controller
 * Implements floating pill navigation states (unscrolled, scrolled,
 * smart auto-hide on scroll down, active section IntersectionObserver, mobile drawer,
 * and top scroll progress bar) + initializes the map backdrop and interactive phones.
 */
(function (global) {
  'use strict';
  var MP = global.MP, U = MP.ui, $ = U.$, $$ = U.$$;

  document.addEventListener('DOMContentLoaded', function () {
    U.fitPhones();

    /* 1. CallDO-Style Header Navigation State Machine */
    var navWrap = $('#cd-nav-wrap');
    var nav = $('#cd-nav');
    var progBar = $('#cd-progress-bar');
    var menuToggle = $('#cd-menu-toggle');
    var mobileDrawer = $('#cd-mobile-drawer');
    var lastScrollY = global.scrollY || 0;
    var mobileMenuOpen = false;

    function setMobileMenu(open) {
      mobileMenuOpen = !!open;
      if (!menuToggle || !mobileDrawer) return;
      menuToggle.setAttribute('aria-expanded', mobileMenuOpen ? 'true' : 'false');
      var icMenu = $('.ic-menu', menuToggle);
      var icClose = $('.ic-close', menuToggle);
      if (icMenu) icMenu.style.display = mobileMenuOpen ? 'none' : '';
      if (icClose) icClose.style.display = mobileMenuOpen ? '' : 'none';
      if (mobileMenuOpen) {
        mobileDrawer.removeAttribute('hidden');
        if (navWrap) navWrap.classList.remove('nav-hidden');
      } else {
        mobileDrawer.setAttribute('hidden', '');
      }
    }

    if (menuToggle) {
      menuToggle.addEventListener('click', function () {
        setMobileMenu(!mobileMenuOpen);
      });
    }

    if (mobileDrawer) {
      $$('a', mobileDrawer).forEach(function (link) {
        link.addEventListener('click', function () {
          setMobileMenu(false);
        });
      });
    }

    function updateNavScroll() {
      if (document.body.classList.contains('mobile-fs-open')) return;
      var y = global.scrollY || 0;

      // State 1 & 2: Unscrolled (y <= 24) vs Scrolled frosted pill (y > 24)
      if (nav) {
        nav.classList.toggle('scrolled', y > 24);
      }

      // State 3: Smart auto-hide when scrolling down past 200px
      if (navWrap) {
        var shouldHide = y > 200 && y > lastScrollY + 2 && !mobileMenuOpen;
        if (shouldHide) {
          navWrap.classList.add('nav-hidden');
        } else if (y < lastScrollY - 2 || y <= 200) {
          navWrap.classList.remove('nav-hidden');
        }
      }

      // Top 3px Scroll Progress Bar
      if (progBar) {
        var docH = document.documentElement.scrollHeight - global.innerHeight;
        var pct = docH > 0 ? Math.min(100, Math.max(0, (y / docH) * 100)) : 0;
        progBar.style.width = pct.toFixed(2) + '%';
      }

      lastScrollY = y;
    }

    global.addEventListener('scroll', updateNavScroll, { passive: true });
    updateNavScroll();

    // State 4: Active Section Link Highlighting (IntersectionObserver)
    var navLinks = $$('[data-nav-sec]');
    function setActiveSection(id) {
      navLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-nav-sec') === id);
      });
    }

    if (global.IntersectionObserver) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.target.id) {
            setActiveSection(entry.target.id);
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px' });

      ['hero-demo', 'route-lab', 'how-it-works', 'features', 'faq'].forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) obs.observe(sec);
      });
    }

    /* 1b. CallDO-Style Initial Load & First-Scroll Reveal Observer */
    var revealEls = $$('.cd-reveal');
    if (revealEls.length) {
      if (global.IntersectionObserver) {
        var revealObs = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-shown');
              revealObs.unobserve(entry.target);
            }
          });
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

        // Defer observation by one frame so initial load transitions play smoothly on tab open/reload
        requestAnimationFrame(function () {
          revealEls.forEach(function (el) {
            revealObs.observe(el);
          });
        });
      } else {
        revealEls.forEach(function (el) {
          el.classList.add('is-shown');
        });
      }
    }

    /* 1c. CallDO-Style Bento Card Radial Spotlight Hover */
    $$('.bento-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - rect.left) + 'px');
        card.style.setProperty('--my', (e.clientY - rect.top) + 'px');
      });
    });

    /* 1d. CallDO-Style Single-Open FAQ Accordion (0fr -> 1fr grid animation) */
    var faqItems = $$('#faq-list .faq-item');
    faqItems.forEach(function (item) {
      var trigger = $('.faq-trigger', item);
      if (!trigger) return;
      trigger.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');
        faqItems.forEach(function (other) {
          var isTarget = other === item && !wasOpen;
          other.classList.toggle('is-open', isTarget);
          var btn = $('.faq-trigger', other);
          var body = $('.cd-faq-body', other);
          if (btn) btn.setAttribute('aria-expanded', isTarget ? 'true' : 'false');
          if (body) body.classList.toggle('open', isTarget);
        });
      });
    });

    /* 1e-fs. Mobile Full-Screen Interactive Phone Modal */
    var fsModal = document.getElementById('mobile-fs-modal');
    var fsSlot = document.getElementById('mobile-fs-slot');
    var fsCloseBtn = document.getElementById('mobile-fs-close');
    var currentActivePhone = null;
    var currentPlaceholder = null;

    function openMobileFullscreen(stage) {
      if (!fsModal || !fsSlot || !stage) return;
      var phoneFit = $('.phone-fit', stage);
      if (!phoneFit) return;

      if (typeof setMobileMenu === 'function') {
        setMobileMenu(false);
      }

      // Preserve layout in-page with a matching invisible placeholder so nothing shifts
      var placeholder = document.createElement('div');
      placeholder.className = 'phone-fit-placeholder';
      placeholder.style.width = (phoneFit.offsetWidth || 380) + 'px';
      placeholder.style.height = (phoneFit.offsetHeight || 760) + 'px';
      placeholder.setAttribute('aria-hidden', 'true');

      phoneFit.parentNode.insertBefore(placeholder, phoneFit);
      fsSlot.innerHTML = '';
      fsSlot.appendChild(phoneFit);

      currentActivePhone = phoneFit;
      currentPlaceholder = placeholder;

      fsModal.removeAttribute('hidden');
      document.documentElement.classList.add('mobile-fs-open');
      document.body.classList.add('mobile-fs-open');

      U.fitPhones();
      global.dispatchEvent(new Event('resize'));
    }

    function closeMobileFullscreen() {
      if (!fsModal || !currentActivePhone || !currentPlaceholder) return;

      if (currentPlaceholder.parentNode) {
        currentPlaceholder.parentNode.insertBefore(currentActivePhone, currentPlaceholder);
        currentPlaceholder.parentNode.removeChild(currentPlaceholder);
      }
      currentPlaceholder = null;
      currentActivePhone = null;

      fsModal.setAttribute('hidden', '');
      document.documentElement.classList.remove('mobile-fs-open');
      document.body.classList.remove('mobile-fs-open');

      U.fitPhones();
      global.dispatchEvent(new Event('resize'));
    }

    $$('[data-fs-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var stage = btn.closest('.phone-stage');
        openMobileFullscreen(stage);
      });
    });

    if (fsCloseBtn) {
      fsCloseBtn.addEventListener('click', closeMobileFullscreen);
    }

    if (fsModal) {
      fsModal.addEventListener('click', function (e) {
        if (e.target === fsModal || e.target.id === 'mobile-fs-slot') {
          closeMobileFullscreen();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && fsModal && !fsModal.hasAttribute('hidden')) {
        closeMobileFullscreen();
      }
    });

    global.addEventListener('resize', function () {
      if (fsModal && !fsModal.hasAttribute('hidden') && global.innerWidth > 768) {
        closeMobileFullscreen();
      }
    });

    /* 1e. CallDO-Style Simple Onboarding Tap Switcher (Change Location vs Route Simulation) */
    var onboardTabs = $$('[data-onboard-tab]');
    var onboardPanels = $$('[data-onboard-panel]');
    onboardTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var targetKey = tab.getAttribute('data-onboard-tab');
        onboardTabs.forEach(function (t) {
          var isMatch = t === tab;
          t.classList.toggle('active', isMatch);
          t.setAttribute('aria-selected', isMatch ? 'true' : 'false');
        });
        onboardPanels.forEach(function (panel) {
          var isMatch = panel.getAttribute('data-onboard-panel') === targetKey;
          if (isMatch) {
            panel.removeAttribute('hidden');
            panel.classList.remove('is-switching');
            // Force reflow so staggered cd-pop animation replays cleanly on every tap
            void panel.offsetWidth;
            panel.classList.add('is-switching');
          } else {
            panel.setAttribute('hidden', '');
            panel.classList.remove('is-switching');
          }
        });
      });
    });

    /* 2. Ambient Hero Procedural Map Backdrop */
    var heroBg = $('#hero-bg-map');
    if (heroBg) {
      var bgView = new MP.map.MapView(heroBg, {
        style: 'hero',
        draggable: false,
        fps: 30,
        drift: [14, -9],
        overscan: 1
      });
      var pNyc = MP.map.geo.place('nyc');
      bgView.cam.x = pNyc.wx;
      bgView.cam.y = pNyc.wy;
      bgView.cam.scale = 0.95;
    }

    /* 3. Hero Interactive Phone: Change Location */
    var locScreen = $('#phone-location');
    if (locScreen) {
      new MP.LocationDemo(locScreen);
    }

    /* 4. Route Simulation Phone */
    var routeScreen = $('#phone-route');
    if (routeScreen) {
      new MP.RouteDemo(routeScreen, {
        place: 'dubai',
        seed: 5
      });
    }
  });
})(window);
