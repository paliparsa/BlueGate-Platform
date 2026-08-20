/* =========================================================
   BlueGate Store — Standalone Web Application Engine
   Fully wired for catalog rendering, auth modal, cart, orders, wallet, & admin
   ========================================================= */

(function () {
  'use strict';

  /* ── State Management ── */
  const state = {
    user: null,
    is_admin: false,
    categories: [],
    products: [],
    cart: JSON.parse(localStorage.getItem('bg_web_cart') || '[]'),
    wishlist: JSON.parse(localStorage.getItem('bg_web_wishlist') || '[]'),
    recent: JSON.parse(localStorage.getItem('bg_web_recent') || '[]'),
    currentTab: 'shop',
    searchTerm: '',
    activeCategory: 'all',
    shopSort: 'newest',
    filterInStock: false,
    filterWishlist: false,
    bot_username: '',
    support_username: '',
    brand: '',
  };

  /* ── Utility Helpers ── */
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const nf = (n) => Number(n || 0).toLocaleString('fa-IR');
  const priceLabel = (p) => {
    if (typeof p === 'number' || typeof p === 'string') return `${nf(p)} تومان`;
    if (!p) return '0 تومان';
    const maxVarDiscount = (p.variants||[]).reduce((max, v)=>Math.max(max, Number(v.discount_percent||0)), 0);
    const d = Number(p.discount_percent || p.variant_discount_percent || maxVarDiscount || 0);
    if (d > 0 && Number(p.price) > 0) {
      const orig = (p.old_price && Number(p.old_price) > Number(p.price)) ? Number(p.old_price) : Math.round(Number(p.price) / (1 - d / 100));
      return `<s class="muted-strike" style="font-size:0.88em;text-decoration:line-through;color:#9fb0c8;margin-left:4px;">${nf(orig)} تومان</s> <span style="font-weight:900;color:#ffffff;">${nf(p.price)} تومان</span>`;
    }
    return `${nf(p.price || 0)} تومان`;
  };

  /* ── Toast Notifications ── */
  function showToast(msg, type = 'info') {
    const container = $('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `web-toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /* ── API Service Connector ── */
  async function api(action, params = {}, method = 'GET', body = null) {
    const query = new URLSearchParams({ action, ...params }).toString();
    const token = localStorage.getItem('bg_web_token');
    const headers = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Web-Token'] = token;
    }
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

    const candidateUrls = [
      `web/api.php?${query}`,
      `api.php?${query}`,
      `/web/api.php?${query}`,
      `/api.php?${query}`,
      `../api.php?${query}`
    ];

    let res = null, data = null;
    for (const url of candidateUrls) {
      try {
        const r = await fetch(url, {
          method,
          headers,
          body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : null
        });
        if (r.status !== 404) {
          res = r;
          data = await r.json().catch(() => ({}));
          break;
        }
      } catch (err) {}
    }
    return data || { ok: false, error: 'SERVER_ERROR', message: 'خطا در ارتباط با سرور' };
  }

  /* ── Phase 6 Quality & Polish System ── */

  /* Synthesized Chime Audio Feedback */
  function playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.3);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.45);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch(e) {}
  }

  /* Canvas Confetti Particles Animation */
  function fireConfetti() {
    try {
      let canvas = $('confetti-canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        canvas.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; pointer-events:none; z-index:10000;';
        document.body.appendChild(canvas);
      }
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const colors = ['#00f2fe', '#4facfe', '#38ef7d', '#11998e', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'];
      const particles = Array.from({ length: 70 }, () => ({
        x: canvas.width / 2 + (Math.random() * 200 - 100),
        y: canvas.height / 2,
        r: Math.random() * 6 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1.5) * 12 - 4,
        gravity: 0.25,
        opacity: 1
      }));

      let startTime = null;
      function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;

        particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.opacity -= 0.015;

          if (p.opacity > 0) {
            alive = true;
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });

        if (alive) requestAnimationFrame(animate);
        else canvas.remove();
      }
      requestAnimationFrame(animate);
    } catch(e) {}
  }

  function celebrate() {
    playChime();
    fireConfetti();
    if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
  }

  /* First-Time User Onboarding Slides */
  function shouldShowOnboarding() {
    return !localStorage.getItem('bg_web_onboarded');
  }

  function showOnboarding() {
    if (!shouldShowOnboarding()) return;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    const slides = [
      { emoji: '🛍️', title: 'به BlueGate خوش آمدید!', desc: 'مرجع تخصصی خرید اشتراک‌های پرمیوم، اکانت‌های هوش مصنوعی و خدمات دیجیتال با تحویل فوری.' },
      { emoji: '👥', title: 'درآمدزایی واقعی با دعوت دوستان', desc: 'لینک اختصاصی خودتان را به دوستان بفرستید و برای هر عضویت یا خرید، پاداش نقد دریافت کنید.' },
      { emoji: '⚡', title: 'تحویل ۲۴ ساعته & پشتیبانی', desc: 'خرید آسان با کیف پول، کارت‌به‌کارت و رمزارز، همراه با پشتیبانی آنلاین در ۷ روز هفته.' }
    ];

    let curSlide = 0;

    function renderSlide() {
      const s = slides[curSlide];
      modalContainer.innerHTML = `
        <div class="modal-card" style="max-width:440px; text-align:center; padding:32px 24px;">
          <div style="font-size:56px; margin-bottom:14px;">${s.emoji}</div>
          <h3 style="font-size:20px; font-weight:900; color:#fff; margin-bottom:10px;">${s.title}</h3>
          <p style="color:var(--text-muted); font-size:13.5px; line-height:1.7; margin-bottom:24px;">${s.desc}</p>
          
          <div style="display:flex; justify-content:center; gap:8px; margin-bottom:24px;">
            ${slides.map((_, idx) => `
              <span style="width:${idx === curSlide ? '24px' : '8px'}; height:8px; border-radius:10px; background:${idx === curSlide ? 'var(--cyan)' : 'rgba(255,255,255,0.2)'}; transition:0.3s all;"></span>
            `).join('')}
          </div>

          <div style="display:flex; gap:10px;">
            <button id="onb-skip-btn" class="nav-link" style="flex:1; justify-content:center;">رد کردن</button>
            <button id="onb-next-btn" class="user-account-btn" style="flex:1; justify-content:center; background:var(--cyan); color:#000;">${curSlide === slides.length - 1 ? 'شروع خرید ✨' : 'بعدی ›'}</button>
          </div>
        </div>
      `;

      $('onb-skip-btn')?.addEventListener('click', finishOnboarding);
      $('onb-next-btn')?.addEventListener('click', () => {
        if (curSlide < slides.length - 1) {
          curSlide++;
          renderSlide();
        } else {
          finishOnboarding();
        }
      });
    }

    function finishOnboarding() {
      localStorage.setItem('bg_web_onboarded', '1');
      closeModal();
      celebrate();
    }

    renderSlide();
    modalContainer.classList.remove('hidden');
  }

  /* Number Counter Count-up Animation */
  function animateCount(el, endValue, duration = 1000) {
    if (!el) return;
    const startValue = Number(el.dataset.val || 0);
    if (startValue === endValue) return;

    let startTimestamp = null;
    function step(timestamp) {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const current = Math.floor(progress * (endValue - startValue) + startValue);
      el.textContent = current.toLocaleString('fa-IR');
      el.dataset.val = current;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }

  /* Theme Color Palette Selector */
  function applyUserTheme() {
    const color = localStorage.getItem('bg_web_accent') || '#00f2fe';
    document.documentElement.style.setProperty('--cyan', color);
  }

  function openPaletteModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }
    modalContainer.onclick = (e) => {
      if (e.target === modalContainer) closeModal();
    };

    const palettes = [
      { name: 'فیروزه‌ای (پیش‌فرض)', color: '#00f2fe' },
      { name: 'زمردی', color: '#22c55e' },
      { name: 'طلایی', color: '#f59e0b' },
      { name: 'بنفش رویال', color: '#8b5cf6' },
      { name: 'رز پینک', color: '#ec4899' },
      { name: 'آبی یاقوتی', color: '#3b82f6' }
    ];

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🎨 انتخاب رنگ پوسته سایت</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
          رنگ اصلی و هایلایت‌های سایت را انتخاب کنید:
        </p>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px;">
          ${palettes.map(p => `
            <button class="theme-swatch-btn" data-theme-color="${p.color}" style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:12px; display:flex; align-items:center; gap:10px; cursor:pointer;">
              <span style="width:20px; height:20px; border-radius:50%; background:${p.color}; display:inline-block;"></span>
              <span style="color:#fff; font-size:12px; font-weight:700;">${p.name}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    document.querySelectorAll('[data-theme-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.themeColor;
        localStorage.setItem('bg_web_accent', color);
        applyUserTheme();
        showToast('رنگ پوسته تغییر کرد! 🎨', 'success');
        closeModal();
      });
    });
  }

  /* Robust Copy Text with Fallback */
  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        showToast('با موفقیت کپی شد! 📋', 'success');
      }).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('با موفقیت کپی شد! 📋', 'success');
    } catch(e) {
      showToast('خطا در کپی متن.', 'error');
    }
  }

  /* App State Persistence */
  function saveAppLastState() {
    localStorage.setItem('bg_web_last_tab', state.currentTab);
  }

  function restoreAppLastState() {
    const lastTab = localStorage.getItem('bg_web_last_tab');
    if (lastTab && ['shop', 'orders', 'wallet', 'profile', 'admin'].includes(lastTab)) {
      state.currentTab = lastTab;
    }
  }

  /* Admin Data CSV Exporters */
  function exportOrdersCsv(orders = []) {
    if (!orders || !orders.length) return;
    const headers = ['Order_ID', 'User_ID', 'Product', 'Amount_Toman', 'Status', 'Created_At'];
    const rows = orders.map(o => [
      o.id,
      o.user_id || '',
      `"${(o.display_name || o.product_title || '').replace(/"/g, '""')}"`,
      o.final_amount || o.price || 0,
      o.status || '',
      `"${o.created_at || ''}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('خروجی CSV سفارش‌ها دانلود شد! 📥', 'success');
  }

  function exportProductsCsv(products = []) {
    if (!products || !products.length) return;
    const headers = ['Product_ID', 'Name', 'Price_Toman', 'Status', 'Inventory'];
    const rows = products.map(p => [
      p.id,
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.price || 0,
      p.is_active ? 'Active' : 'Inactive',
      p.inventory_available || 0
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_export_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('خروجی CSV محصولات دانلود شد! 📥', 'success');
  }

  /* ── Init App Payload ── */
  async function initApp() {
    applyUserTheme();
    restoreAppLastState();

    $('modal-container')?.addEventListener('click', (e) => {
      if (e.target === $('modal-container')) closeModal();
    });

    const token = localStorage.getItem('bg_web_token');
    let res = null;

    if (token) {
      res = await api('me');
    }
    if (!res || !res.ok) {
      res = await api('guest_dashboard_payload');
    }

    if (res && res.ok) {
      state.categories = res.shop_categories || [];
      state.products = res.shop_products || [];
      state.bot_username = res.bot_username || '';
      state.payment_methods = res.payment_methods || null;
      state.support_username = res.support_username || '';
      state.brand = res.brand || '';
      state.spin_rewards = res.spin_rewards || [];
      state.spin_every = res.spin_every || 5;
      state.missions = res.missions || [];
      state.transactions = res.transactions || [];
      state.achievements = res.achievements || [];
      if (res.user) {
        state.user = res.user;
        state.is_admin = !!res.is_admin;
      }
    }

    if (new URLSearchParams(window.location.search).has('admin') || window.location.hash.includes('admin')) {
      state.currentTab = 'admin';
    }

    renderApp();
    bindGlobalEvents();
    handleDeepLink();
    setTimeout(showOnboarding, 600);
  }

  /* ── Product Deep Link Handler ── */
  function handleDeepLink() {
    const search = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';

    let productId = search.get('p') || search.get('product') || search.get('id');

    if (!productId && hash) {
      const match = hash.match(/product-(\d+)/i) || hash.match(/p=(\d+)/i) || hash.match(/pid=(\d+)/i) || hash.match(/#(\d+)/);
      if (match) productId = match[1];
    }

    if (productId && state.products.length > 0) {
      const p = state.products.find(x => Number(x.id) === Number(productId));
      if (p) {
        state.currentTab = 'shop';
        renderApp();
        setTimeout(() => openProductModal(p.id), 250);
      }
    }
  }

  window.addEventListener('hashchange', handleDeepLink, { passive: true });

  /* ── Auto Responsive Device Detection ── */
  function detectDevice() {
    const w = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const isMobile = w <= 768 || (isTouch && w <= 900) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    return { w, isMobile, isDesktop: !isMobile };
  }

  function applyResponsiveLayout() {
    const d = detectDevice();
    const target = document.body || document.documentElement;
    if (target) {
      target.classList.toggle('is-mobile-view', d.isMobile);
      target.classList.toggle('is-desktop-view', d.isDesktop);
    }
    renderMobileBottomNav(d.isMobile);
  }

  function renderMobileBottomNav(isMobile) {
    let container = $('mobile-bottom-nav');
    if (!isMobile) {
      if (container) container.style.display = 'none';
      return;
    }

    const mount = document.body || document.documentElement;
    if (!mount) return;

    if (!container) {
      container = document.createElement('nav');
      container.id = 'mobile-bottom-nav';
      container.className = 'mobile-bottom-nav';
      mount.appendChild(container);
    }

    container.style.display = 'flex';
    const totalCart = state.cart.reduce((sum, item) => sum + (item.qty || 1), 0);

    container.innerHTML = `
      <button class="mobile-nav-btn ${state.currentTab === 'shop' ? 'active' : ''}" data-tab="shop">
        <span class="mnav-icon">🛍️</span>
        <span class="mnav-label">فروشگاه</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'orders' ? 'active' : ''}" data-tab="orders">
        <span class="mnav-icon">📜</span>
        <span class="mnav-label">سفارش‌ها</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'wallet' ? 'active' : ''}" data-tab="wallet">
        <span class="mnav-icon">💰</span>
        <span class="mnav-label">کیف پول</span>
      </button>
      <button class="mobile-nav-btn" id="mobile-cart-trigger">
        <span class="mnav-icon">🛒 ${totalCart > 0 ? `<b class="mobile-cart-badge">${totalCart}</b>` : ''}</span>
        <span class="mnav-label">سبد خرید</span>
      </button>
      <button class="mobile-nav-btn ${state.currentTab === 'profile' ? 'active' : ''}" id="mobile-user-trigger">
        <span class="mnav-icon">👤</span>
        <span class="mnav-label">${state.user && !state.user.is_guest ? 'حساب' : 'ورود'}</span>
      </button>
    `;

    $('mobile-cart-trigger')?.addEventListener('click', () => openCartDrawer(true));
    $('mobile-user-trigger')?.addEventListener('click', () => {
      if (state.user && !state.user.is_guest) {
        state.currentTab = 'profile';
        renderApp();
      } else {
        openAuthModal();
      }
    });
  }

  window.addEventListener('resize', applyResponsiveLayout, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(applyResponsiveLayout, 150), { passive: true });

  /* ── Main App Renderer ── */
  function renderApp() {
    applyResponsiveLayout();
    updateHeaderNav();
    updateCartCount();

    const app = $('app');
    if (!app) return;

    switch (state.currentTab) {
      case 'orders':
        renderOrdersView(app);
        break;
      case 'wallet':
        renderWalletView(app);
        break;
      case 'profile':
        renderProfileView(app);
        break;
      case 'admin':
        renderAdminView(app);
        break;
      case 'shop':
      default:
        renderShopView(app);
        break;
    }
  }

  function updateHeaderNav() {
    const nav = document.querySelector('.header-nav');
    if (nav && state.is_admin && !$('admin-header-nav-btn')) {
      const btn = document.createElement('button');
      btn.id = 'admin-header-nav-btn';
      btn.className = 'nav-link';
      btn.dataset.tab = 'admin';
      btn.style.color = '#f59e0b';
      btn.innerHTML = `<span>👑</span> مدیریت`;
      nav.appendChild(btn);
    }

    document.querySelectorAll('.nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === state.currentTab);
    });

    const userBtnText = $('user-btn-text');
    if (userBtnText) {
      if (state.user && !state.user.is_guest) {
        userBtnText.textContent = state.user.first_name || state.user.username || 'حساب کاربری';
      } else {
        userBtnText.textContent = 'ورود / ثبت‌نام';
      }
    }
  }

  function updateCartCount() {
    const countEl = $('cart-count');
    if (countEl) {
      const totalQty = state.cart.reduce((sum, item) => sum + (item.qty || 1), 0);
      countEl.textContent = totalQty;
    }
  }

  /* ── Shop View Renderer ── */
  function renderShopView(container) {
    const heroHtml = `
      <section class="web-hero-banner">
        <div class="hero-content">
          <div class="hero-badge">⚡ مرجع تخصصی اشتراک‌های دیجیتال &amp; هوش مصنوعی</div>
          <h1 class="hero-title">دسترسی فوری به <span class="hero-highlight">برترین سرویس‌های دنیا</span></h1>
          <p class="hero-subtitle">خرید مستقیم و بدون واسطه اکانت‌های ChatGPT Plus، تلگرام پرمیوم، اسپاتیفای و سرویس‌های کاربردی با تحویل خودکار ۲۴ ساعته.</p>
          <div class="hero-trust-row">
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>🎡</span><b>گردونه شانس روزانه</b></div>
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>💰</span><b>کیف پول &amp; پاداش دعوت</b></div>
            <div class="trust-chip" data-tab="wallet" style="cursor:pointer;"><span>👥</span><b>درخت زیرمجموعه‌ها</b></div>
          </div>
        </div>
      </section>
    `;

    const filtered = getFilteredProducts();

    const sidebarHtml = `
      <aside class="category-sidebar">
        <div class="sidebar-card">
          <h3 class="sidebar-title">📁 دسته‌بندی محصولات</h3>
          <div class="sidebar-cat-list">
            <button class="sidebar-cat-btn ${state.activeCategory === 'all' ? 'active' : ''}" data-cat="all">
              <span>✨</span><b>همه محصولات</b>
            </button>
            <button class="sidebar-cat-btn ${state.activeCategory === 'featured' ? 'active' : ''}" data-cat="featured">
              <span>⭐</span><b>سرویس‌های ویژه</b>
            </button>
            ${state.categories.map(c => `
              <button class="sidebar-cat-btn ${Number(state.activeCategory) === Number(c.id) ? 'active' : ''}" data-cat="${c.id}">
                ${c.image_url ? `<img src="${esc(c.image_url)}">` : `<span>${esc(c.emoji || '🛒')}</span>`}
                <b>${esc(c.title || c.name || 'دسته')}</b>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="sidebar-card">
          <h3 class="sidebar-title">⚙️ فیلترهای سریع</h3>
          <div class="sidebar-filter-list">
            <button class="sidebar-filter-btn ${state.filterInStock ? 'active' : ''}" id="toggle-instock">
              <span>${state.filterInStock ? '✅' : '📦'}</span> <b>فقط موجودی آنی</b>
            </button>
            <button class="sidebar-filter-btn ${state.filterWishlist ? 'active' : ''}" id="toggle-wishlist">
              <span>${state.filterWishlist ? '❤️' : '🤍'}</span> <b>نشان‌شده‌ها</b>
            </button>
          </div>
        </div>
      </aside>
    `;

    const gridHtml = filtered.length ? `
      <div class="product-grid">
        ${filtered.map(p => renderProductCard(p)).join('')}
      </div>
    ` : `
      <div style="text-align:center; padding:48px 20px; background:var(--card-dark); border-radius:20px;">
        <div style="font-size:48px; margin-bottom:12px;">🕵️‍♂️</div>
        <h3>محصولی پیدا نشد!</h3>
        <p style="color:var(--text-muted); font-size:14px;">با فیلترها و جستجوی فعلی محصولی یافت نشد.</p>
      </div>
    `;

    container.innerHTML = `
      ${heroHtml}
      ${glowingFlashSaleSectionHtml()}
      <div class="storefront-layout">
        ${sidebarHtml}
        <section class="catalog-area">
          ${recentProductsHtml()}
          <div class="catalog-toolbar">
            <span style="font-size:13.5px; font-weight:700; color:var(--text-muted);">
              نمایش <b>${filtered.length}</b> محصول
            </span>
            <div class="sort-pills">
              <button class="sort-pill-btn ${state.shopSort === 'newest' ? 'active' : ''}" data-sort="newest">جدیدترین</button>
              <button class="sort-pill-btn ${state.shopSort === 'price_low' ? 'active' : ''}" data-sort="price_low">ارزان‌ترین</button>
              <button class="sort-pill-btn ${state.shopSort === 'price_high' ? 'active' : ''}" data-sort="price_high">گران‌ترین</button>
            </div>
          </div>
          ${gridHtml}
        </section>
      </div>
    `;
  }

  /* ── Glowing Top Section — Only shows products with real discounts ── */
  /* Shows: active flash sale OR at least one variant with discount_percent > 0 */
  function glowingFlashSaleSectionHtml() {
    let specialProducts = state.products.filter(p => {
      if (flashSaleActive(p)) return true;
      if (Number(p.discount_percent || 0) > 0) return true;
      return (p.variants || []).some(v => Number(v.discount_percent) > 0);
    });

    if (!specialProducts.length) {
      specialProducts = state.products.filter(p => Number(p.is_featured) === 1);
    }
    if (!specialProducts.length) {
      specialProducts = state.products.slice(0, 6);
    }
    if (!specialProducts.length) return '';

    const flashProduct = specialProducts.find(p => flashSaleActive(p));
    const timerText = flashProduct ? getFlashTimeRemaining(flashProduct) : '';

    return `
      <section class="glowing-flash-sale-section">
        <div class="flash-sale-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="glowing-fire-icon">⚡</span>
            <h3 class="flash-sale-title">تخفیف‌های ویژه</h3>
          </div>
          ${timerText ? `
          <div class="flash-sale-timer-pill">
            <span>⏰ زمان باقی‌مانده:</span>
            <b class="flash-sale-timer">${timerText}</b>
          </div>` : ''}
        </div>

        <div class="glowing-flash-products-row">
          ${specialProducts.slice(0, 6).map(p => {
            let realPrice = Number(p.price);
            let crossedPrice = 0;
            let discLabel = '';

            // Find best variant discount
            const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
            if (discountedVariants.length > 0) {
              const bestV = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
              realPrice = Number(bestV.price);
              crossedPrice = Number(bestV.old_price) || (bestV.discount_percent > 0 ? Math.round(realPrice / (1 - Number(bestV.discount_percent) / 100)) : 0);
              if (crossedPrice <= realPrice) crossedPrice = 0;
              discLabel = `🔥 −${bestV.discount_percent}٪`;
            } else if (Number(p.discount_percent || 0) > 0) {
              const d = Number(p.discount_percent);
              crossedPrice = (p.old_price && Number(p.old_price) > realPrice) ? Number(p.old_price) : Math.round(realPrice / (1 - d / 100));
              discLabel = `🔥 −${d}٪`;
            }

            return `
              <div class="glowing-flash-card" data-pid="${p.id}">
                <span class="flash-card-badge">${discLabel || '🔥 ویژه'}</span>
                <div class="flash-card-img">
                  ${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(p.title || p.name)}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'card-fallback-img\\'><span>⚡</span></div>';">` : `<div class="card-fallback-img"><span>⚡</span><b>${esc((p.title || p.name || '').slice(0, 12))}</b></div>`}
                </div>
                <div class="flash-card-title">${esc(p.title || p.name)}</div>
                <div class="flash-card-bottom">
                  <div class="flash-card-price-col">
                    ${crossedPrice > 0 ? `<s class="flash-card-orig-price">${priceLabel(crossedPrice)}</s>` : ''}
                    <b class="flash-card-cur-price">${priceLabel(realPrice)}</b>
                  </div>
                  <button class="card-quick-buy-btn" data-buy="${p.id}" style="padding:6px 12px; font-size:12px;">⚡ خرید</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }

  /* ── Filter Products ── */
  function getFilteredProducts() {
    let list = [...state.products];

    if (state.activeCategory === 'featured') {
      list = list.filter(p => Number(p.is_featured) === 1);
    } else if (state.activeCategory !== 'all') {
      list = list.filter(p => Number(p.category_id) === Number(state.activeCategory));
    }

    if (state.searchTerm) {
      const q = state.searchTerm.toLowerCase();
      list = list.filter(p => {
        const t = (p.title || p.name || '').toLowerCase();
        const d = (p.short_description || p.full_description || '').toLowerCase();
        return t.includes(q) || d.includes(q);
      });
    }

    if (state.filterInStock) {
      list = list.filter(p => Number(p.inventory_available || p.stock || 0) > 0 || (p.variants || []).some(v => Number(v.stock || 1) > 0));
    }

    if (state.filterWishlist) {
      list = list.filter(p => state.wishlist.includes(Number(p.id)));
    }

    if (state.shopSort === 'price_low') {
      list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (state.shopSort === 'price_high') {
      list.sort((a, b) => Number(b.price) - Number(a.price));
    } else {
      list.sort((a, b) => Number(b.id) - Number(a.id));
    }

    return list;
  }

  /* ── Flash Sale Active Check — mirrors miniapp flashSaleActive(p) ── */
  function flashSaleActive(p) { return false; }
  function flashSaleCountdown(p) { return ''; }

  /* ── Product Card Component ── */
  function renderProductCard(p) {
    const title = p.title || p.name || 'محصول بدون عنوان';
    const isWished = state.wishlist.includes(Number(p.id));

    // Find best variant discount (highest %) for display on the card
    const discountedVariants = (p.variants || []).filter(v => Number(v.discount_percent) > 0);
    const bestVariant = discountedVariants.sort((a, b) => Number(b.discount_percent) - Number(a.discount_percent))[0];
    const variantDiscount = bestVariant ? Number(bestVariant.discount_percent) : 0;
    const prodDiscount = Number(p.discount_percent || 0);
    const discPct = Math.max(variantDiscount, prodDiscount);
    const hasSale = discPct > 0;

    let origPrice = 0;   // crossed-out price
    let salePrice = 0;   // actual price to pay

    if (bestVariant) {
      origPrice = Number(bestVariant.old_price) || (bestVariant.discount_percent > 0 ? Math.round(Number(bestVariant.price) / (1 - Number(bestVariant.discount_percent) / 100)) : 0);
      salePrice = Number(bestVariant.price);
      if (origPrice <= salePrice) origPrice = 0;
    } else if (prodDiscount > 0) {
      salePrice = Number(p.price);
      origPrice = (p.old_price && Number(p.old_price) > salePrice) ? Number(p.old_price) : Math.round(salePrice / (1 - prodDiscount / 100));
    } else {
      salePrice = Number(p.price);
    }

    const vTagHtml = bestVariant ? `<span class="variant-tag">${esc(bestVariant.title)}</span>` : '';

    const priceHtml = (origPrice > 0 && salePrice > 0)
      ? `<s style="color:#9fb0c8; font-size:11px; text-decoration:line-through;">${priceLabel(origPrice)}</s>
         <b style="color:#ffffff; font-weight:900; display:block; margin-top:2px;">${priceLabel(salePrice)} ${vTagHtml}</b>`
      : `<b style="color:#ffffff; font-weight:900;">${priceLabel(p.price)} ${vTagHtml}</b>`;

    const badgeHtml = discPct > 0 ? `<span class="card-discount-badge">−${nf(discPct)}٪ تخفیف</span>` : '';

    const imgContent = p.image_url
      ? `<img src="${esc(p.image_url)}" alt="${esc(title)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'card-fallback-img\\'><span>⚡</span><b>${esc(title.slice(0, 15))}</b></div>';">`
      : `<div class="card-fallback-img"><span>⚡</span><b>${esc(title.slice(0, 15))}</b></div>`;

    return `
      <div class="product-card ${hasSale ? 'has-sale' : ''}" data-pid="${p.id}">
        <div class="card-img-wrap">
          ${badgeHtml}
          <button class="card-wishlist-btn" data-wishlist="${p.id}">${isWished ? '❤️' : '🤍'}</button>
          ${imgContent}
        </div>
        <div class="card-content">
          <h3 class="card-title">${esc(title)}</h3>
          <div class="card-price-row">
            <div class="card-price">${priceHtml}</div>
            <div style="display:flex; gap:6px;">
              <button class="user-account-btn" data-share="${p.id}" style="padding:6px 10px; font-size:12px;" title="اشتراک‌گذاری">🔗</button>
              <button class="card-quick-buy-btn" data-buy="${p.id}">⚡ خرید</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ── Phase 4 — Product Experience Helpers ── */
  function pushRecent(pid) {
    const id = Number(pid);
    if (!id) return;
    state.recent = [id, ...state.recent.filter(x => Number(x) !== id)].slice(0, 8);
    localStorage.setItem('bg_web_recent', JSON.stringify(state.recent));
  }

  function getFlashTimeRemaining(p = null) { return ''; }

  function recentProductsHtml() {
    if (!state.recent || !state.recent.length) return '';
    const recentProds = state.recent.map(id => state.products.find(p => Number(p.id) === Number(id))).filter(Boolean);
    if (!recentProds.length) return '';

    return `
      <div class="recently-viewed-section">
        <h3 class="sidebar-title" style="margin-bottom:12px; font-size:14px; color:var(--cyan);">👁️ آخرین بازدیدهای شما</h3>
        <div class="recent-products-row">
          ${recentProds.map(p => `
            <div class="recent-product-card" data-pid="${p.id}">
              <div class="recent-card-img">
                ${p.image_url ? `<img src="${esc(p.image_url)}">` : `<span>🛒</span>`}
              </div>
              <div class="recent-card-info">
                <b>${esc(p.title || p.name)}</b>
                <small style="color:var(--cyan); font-weight:800; font-size:11px;">${priceLabel(p.price)}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function toggleWishlist(pid) {
    const id = Number(pid);
    if (!id) return;
    const idx = state.wishlist.indexOf(id);
    if (idx > -1) {
      state.wishlist.splice(idx, 1);
      showToast('از لیست نشان‌شده‌ها حذف شد', 'info');
    } else {
      state.wishlist.push(id);
      showToast('به لیست نشان‌شده‌ها اضافه شد! ❤️', 'success');
    }
    localStorage.setItem('bg_web_wishlist', JSON.stringify(state.wishlist));
    renderApp();
  }

  function openShareSheet(pid) {
    const p = state.products.find(x => Number(x.id) === Number(pid));
    if (!p) return;
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    modalContainer.onclick = (e) => {
      if (e.target === modalContainer) closeModal();
    };

    const baseUrl = window.location.origin + window.location.pathname;
    const shareUrl = `${baseUrl}?p=${p.id}`;
    const shareTitle = p.title || p.name || 'محصول BlueGate';

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:460px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🔗 اشتراک‌گذاری محصول</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; text-align:right;">
          ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:50px; height:50px; border-radius:10px; object-fit:cover;">` : '<span style="font-size:32px;">🛍️</span>'}
          <div>
            <b style="font-size:14px; color:#fff; display:block;">${esc(shareTitle)}</b>
            <small style="color:var(--cyan); font-weight:800;">${priceLabel(p.price)}</small>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:10px;">
          <a href="https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}" target="_blank" class="user-account-btn" style="width:100%; justify-content:center; background:#229ED9; color:#fff; font-weight:800; text-decoration:none;">
            ✈️ ارسال مستقیم در تلگرام
          </a>
          <button class="user-account-btn" id="btn-copy-share-link" style="width:100%; justify-content:center;">
            📋 کپی لینک مستقیم
          </button>
          ${navigator.share ? `
            <button class="user-account-btn" id="btn-native-share" style="width:100%; justify-content:center; background:rgba(255,255,255,0.08);">
              📱 اشتراک‌گذاری بومی
            </button>
          ` : ''}
        </div>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-copy-share-link')?.addEventListener('click', () => {
      navigator.clipboard.writeText(shareUrl);
      showToast('لینک محصول کپی شد! 📋', 'success');
    });
    $('btn-native-share')?.addEventListener('click', () => {
      navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
    });
  }

  setInterval(() => {
    const timerEls = document.querySelectorAll('.flash-sale-timer');
    if (timerEls.length) {
      const tStr = getFlashTimeRemaining();
      timerEls.forEach(el => el.textContent = tStr);
    }
  }, 1000);

  /* ── Orders View Renderer ── */
  async function renderOrdersView(container) {
    container.innerHTML = `<div style="text-align:center; padding:40px;">⏳ در حال دریافت سفارش‌ها...</div>`;
    const res = await api('my_orders');
    const orders = (res && res.ok) ? (res.orders || []) : [];

    if (!orders.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:var(--card-dark); border-radius:24px;">
          <div style="font-size:56px; margin-bottom:12px;">📜</div>
          <h3>هیچ سفارشی ثبت نشده است!</h3>
          <p style="color:var(--text-muted); margin-bottom:20px;">هنوز هیچ سفارشی در حساب شما ثبت نشده.</p>
          <button class="user-account-btn" data-tab="shop">شروع خرید از فروشگاه</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">📜 تاریخچه سفارش‌های شما</h2>
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${orders.map(o => `
          <div class="order-row-card" data-order-open="${o.id}" style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:20px; cursor:pointer; transition:0.3s;" onmouseover="this.style.borderColor='var(--cyan)'" onmouseout="this.style.borderColor='var(--border-color)'">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--border-color); padding-bottom:10px;">
              <div>
                <b>سفارش #${o.id}</b>
                <small style="color:var(--text-muted); margin-right:10px;">${esc(o.created_at)}</small>
              </div>
              <span style="background:rgba(0,242,254,0.15); color:var(--cyan); font-weight:800; font-size:12px; padding:4px 12px; border-radius:12px;">
                ${esc(o.status_fa || o.status || 'تکمیل شده')}
              </span>
            </div>
            <div style="font-size:14px; font-weight:700; margin-bottom:8px;">${esc(o.display_name || o.product_title || o.name || 'اشتراک دیجیتال')}</div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:var(--cyan);">${priceLabel(o.final_amount || o.price)}</span>
              <span style="font-size:12px; color:var(--text-muted);">مشاهده جزئیات ‹</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ── Order Stepper Helper ── */
  function orderStepperHtml(o) {
    const steps = [
      {label: 'ثبت سفارش', icon: '📝'},
      {label: 'پرداخت', icon: '💳'},
      {label: 'آماده‌سازی', icon: '📦'},
      {label: 'تحویل نهایی', icon: '✅'}
    ];
    const canceled = ['rejected', 'canceled', 'refunded'].includes(o.status);
    if (canceled) {
      return `<div class="order-stepper canceled">
        <div class="stepper-cancel">
          <span class="step-circle cancel">✕</span>
          <div><b>سفارش ${esc(o.status_fa || o.status)}</b><br><small>این سفارش لغو شده است.</small></div>
        </div>
      </div>`;
    }
    let cur = 0;
    if (o.status === 'pending_payment' || o.status === 'receipt_submitted') cur = 1;
    else if (o.status === 'reviewing' || o.status === 'payment_confirmed' || o.status === 'preparing') cur = 2;
    else if (o.status === 'delivered') cur = 3;

    const progressPct = cur === 0 ? 0 : cur === 1 ? 33 : cur === 2 ? 66 : 100;

    return `
      <div class="order-stepper-container">
        <div class="stepper-bar-bg">
          <div class="stepper-bar-fill" style="width:${progressPct}%;"></div>
        </div>
        <div class="stepper-nodes-row">
          ${steps.map((s, i) => `
            <div class="step-node ${i <= cur ? 'done' : ''} ${i === cur ? 'active' : ''}">
              <div class="node-circle">${i < cur ? '✓' : (i === cur ? '⚡' : s.icon)}</div>
              <span class="node-title">${s.label}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Order Detail Modal ── */
  function openOrderDetailModal(orderId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }
    modalContainer.onclick = (e) => {
      if (e.target === modalContainer) closeModal();
    };
    modalContainer.classList.remove('hidden');

    // Fetch order details via API
    api('my_orders').then(res => {
      const orders = (res && res.ok) ? (res.orders || []) : [];
      const o = orders.find(x => Number(x.id) === Number(orderId));
      if (!o) {
        showToast('سفارش یافت نشد', 'error');
        closeModal();
        return;
      }

      modalContainer.innerHTML = `
        <div class="modal-card" style="max-width:620px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
            <div>
              <small style="color:var(--text-muted);">سفارش #${nf(o.id)}</small>
              <h3 style="font-size:18px; font-weight:900;">${esc(o.display_name || 'محصول')}</h3>
            </div>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>

          ${orderStepperHtml(o)}

          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:16px; padding:20px; margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:var(--text-muted); font-size:14px;">مبلغ نهایی پرداخت</span>
              <b style="color:var(--cyan); font-size:16px;">${priceLabel(o.final_amount || o.price)}</b>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
              <span style="color:var(--text-muted); font-size:14px;">روش پرداخت</span>
              <b style="font-size:14px;">${esc(o.payment_method_fa || 'انتخاب نشده')}</b>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted); font-size:14px;">تاریخ ثبت</span>
              <b style="font-size:14px;">${esc(o.created_at || '-')}</b>
            </div>
          </div>

          ${o.license_key ? `
            <div style="background:rgba(34, 197, 94, 0.1); border:1px solid rgba(34, 197, 94, 0.3); border-radius:16px; padding:20px; margin-bottom:16px; text-align:center;">
              <p style="color:#4ade80; font-size:13px; margin-bottom:8px;">✅ کد لایسنس / اطلاعات تحویل:</p>
              <code style="display:block; font-size:18px; font-weight:900; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; margin-bottom:12px;">${esc(o.license_key)}</code>
              <button class="user-account-btn" data-copy="${esc(o.license_key)}" style="background:#22c55e; color:#000; margin:0 auto;">📋 کپی اطلاعات</button>
            </div>
          ` : ''}

          ${o.payment_note ? `<div class="note-box"><b>رسید / توضیحات پرداخت:</b><br>${esc(o.payment_note)}</div>` : ''}
          ${o.customer_note ? `<div class="note-box customer"><b>یادداشت اکانت / توضیحات شما:</b><br>${esc(o.customer_note)}</div>` : ''}
          ${o.delivery_text ? `<div class="note-box" style="border-color:#22c55e; background:rgba(34,197,94,0.06);"><b style="color:#4ade80;">اطلاعات تحویل سفارش:</b><br>${esc(o.delivery_text)}</div>` : ''}

          ${o.timeline && o.timeline.length ? `
            <details class="timeline-details">
              <summary>🗓 تاریخچه کامل تغییرات سفارش (${o.timeline.length})</summary>
              <div class="timeline">
                ${o.timeline.map(t => `<div><b>${esc(t.title)}</b><small>${esc(t.created_at || '')}</small></div>`).join('')}
              </div>
            </details>
          ` : ''}

          <!-- Action Buttons Bar -->
          <div class="order-action-pills-bar">
            <button class="order-pill-btn info" id="btn-order-note-${o.id}">
              <span>📝</span> <b>یادداشت اکانت</b>
            </button>
            ${o.status === 'pending_payment' ? `
              <button class="order-pill-btn primary" id="btn-order-coupon-${o.id}">
                <span>🎟</span> <b>کد تخفیف</b>
              </button>
              <button class="order-pill-btn danger" id="btn-order-cancel-${o.id}">
                <span>❌</span> <b>لغو سفارش</b>
              </button>
            ` : ''}
            ${['rejected', 'canceled', 'refunded'].includes(o.status) ? `
              <button class="order-pill-btn danger" id="btn-order-hide-${o.id}">
                <span>🗑️</span> <b>حذف از لیست</b>
              </button>
            ` : ''}
          </div>

          ${paymentMethodsHtml(o)}
        </div>
      `;

      $('close-modal-btn')?.addEventListener('click', closeModal);
      bindOrderPaymentEvents(o);
    });
  }

  /* ── Payment Gateways Renderer ── */
  function paymentMethodsHtml(o) {
    if (!['pending_payment', 'rejected'].includes(o.status) || Number(o.final_amount || 0) <= 0) {
      return '';
    }

    const methods = state.payment_methods || { wallet: { enabled: true }, card: { enabled: true }, crypto: { enabled: false } };
    const bal = Number(state.user?.balance || 0);

    let html = `
      <div style="margin-top:20px; border-top:1px solid var(--border-color); padding-top:16px;">
        <h4 style="font-size:15px; font-weight:800; margin-bottom:12px;">💳 انتخاب روش پرداخت</h4>
    `;

    // 1. Method Selectors
    if (!o.payment_method || o.payment_method === 'none') {
      html += `<div class="payment-grid">`;
      if (methods.wallet?.enabled !== false) {
        html += `
          <button class="pay-method-card" id="btn-pay-wallet-${o.id}">
            <b>💰 کیف پول</b>
            <span>موجودی: ${priceLabel(bal)}</span>
          </button>
        `;
      }
      if (methods.card?.enabled !== false) {
        html += `
          <button class="pay-method-card" id="btn-pay-card-${o.id}">
            <b>💳 کارت به کارت</b>
            <span>پرداخت دستی با رسید</span>
          </button>
        `;
      }
      if (methods.crypto?.enabled) {
        html += `
          <button class="pay-method-card" id="btn-pay-crypto-${o.id}">
            <b>🪙 رمزارز (USDT / TRX)</b>
            <span>واریز آنی با TXID</span>
          </button>
        `;
      }
      html += `</div>`;
    }

    // 2. Card Payment Panel
    if (o.payment_method === 'card') {
      let accounts = methods.card?.accounts || [];
      if (!accounts.length) {
        accounts = [{ title: 'کارت اصلی فروشگاه', card: '6037997412345678', owner: 'پشتیبانی BlueGate' }];
      }

      html += `
        <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <b style="font-size:15px; color:var(--cyan);">💳 اطلاعات شماره کارت</b>
            <button class="btn-reset-method" id="btn-reset-method-${o.id}">🔄 تغییر روش</button>
          </div>
          ${accounts.map(acc => {
            const rawCard = String(acc.card || '0000000000000000').replace(/\D/g, '');
            const formattedCard = rawCard.length === 16 ? rawCard.match(/.{1,4}/g).join(' - ') : esc(acc.card || '');
            return `
              <div class="luxury-bank-card-v2">
                <div class="bank-card-header">
                  <span class="card-chip-icon">💳</span>
                  <span class="bank-title">${esc(acc.title || 'کارت بانکی سفارشات')}</span>
                </div>
                <div class="bank-number-display">${formattedCard}</div>
                <div class="bank-owner-row">
                  <span>صاحب حساب: <b>${esc(acc.owner || 'پشتیبانی فروشگاه')}</b></span>
                </div>
                <button class="card-copy-btn" data-copy="${esc(acc.card || '')}">📋 کپی شماره کارت</button>
              </div>
            `;
          }).join('')}

          <form id="receipt-upload-form-${o.id}" style="margin-top:18px; border-top:1px solid var(--border-color); padding-top:16px;">
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">توضیحات / شماره پیگیری / ۴ رقم کارت</label>
              <input type="text" id="receipt-note-${o.id}" required placeholder="مثلاً: واریز از کارت علی محمودی کد ۱۲۳۴" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:13px;">
            </div>
            <div style="margin-bottom:16px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">تصویر رسید (اختیاری)</label>
              <label class="custom-file-upload">
                <input type="file" id="receipt-file-${o.id}" accept="image/*" style="display:none;">
                <span class="upload-icon">🖼️</span>
                <span id="receipt-file-label-${o.id}" class="upload-label">انتخاب یا درگ تصویر رسید پرداخت...</span>
              </label>
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px;">📤 ثبت رسید و تایید پرداخت</button>
          </form>
        </div>
      `;
    }

    // 3. Crypto Invoicing Panel
    if (o.payment_method === 'crypto') {
      const wallets = methods.crypto?.wallets || [];
      const cryptoCheck = o.crypto_check;

      html += `
        <div class="crypto-invoice-panel" style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
            <b style="font-size:15px; color:var(--cyan);">🪙 پرداخت رمزارز (Crypto)</b>
            <button class="btn-reset-method" id="btn-reset-method-${o.id}">🔄 تغییر روش</button>
          </div>
          ${!cryptoCheck ? `
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">کیف پول شبکه مورد نظر خود را برای پرداخت انتخاب کنید:</p>
            <div class="crypto-wallet-list">
              ${wallets.map(w => `
                <button class="crypto-wallet-item" data-select-crypto-id="${w.id}">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:22px;">🪙</span>
                    <div>
                      <b style="font-size:14px; color:#fff; display:block;">${esc(w.title || w.asset || 'USDT')}</b>
                      <span style="font-size:11px; color:var(--text-muted);">${esc(w.network || 'TRC20')}</span>
                    </div>
                  </div>
                  <small style="color:var(--cyan); font-weight:800; font-size:13px;">${w.rate_toman ? `۱ ${esc(w.asset || 'USDT')} = ${priceLabel(w.rate_toman)}` : ''}</small>
                </button>
              `).join('')}
            </div>
          ` : `
            <div style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:16px; padding:16px; margin-bottom:16px;">
              <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:6px;">آدرس کیف پول جهت واریز:</small>
              <code style="font-size:14px; color:var(--cyan); word-break:break-all; display:block; margin-bottom:12px; background:rgba(0,0,0,0.4); padding:10px; border-radius:10px;">${esc(cryptoCheck.address)}</code>
              <button class="user-account-btn" data-copy="${esc(cryptoCheck.address)}" style="font-size:12px; padding:8px 16px; background:var(--cyan); color:#000;">📋 کپی آدرس ولت</button>
            </div>
            <form id="crypto-hash-form-${o.id}">
              <div style="margin-bottom:14px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">کد هش تراکنش (TXID / Hash)</label>
                <input type="text" id="crypto-txid-${o.id}" required placeholder="هش تراکنش شبکه..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:13px;">
              </div>
              <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px;">⚡ ثبت TXID جهت استعلام آنی</button>
            </form>
          `}
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /* ── Order Payment Event Binding ── */
  function bindOrderPaymentEvents(o) {
    // Wallet Payment Action -> Open Confirmation Sheet
    $(`btn-pay-wallet-${o.id}`)?.addEventListener('click', () => {
      openWalletConfirmSheet(o.id);
    });

    // Customer Note Action
    $(`btn-order-note-${o.id}`)?.addEventListener('click', async () => {
      const note = prompt('یادداشت جدید برای این سفارش (مثلاً نام کاربری/توضیحات اکانت):', o.customer_note || '');
      if (note === null) return;
      const res = await api('customer_order_note', {}, 'POST', { order_id: o.id, customer_note: note });
      if (res && res.ok) {
        showToast('یادداشت سفارش ذخیره شد 📝', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ذخیره یادداشت.', 'error');
      }
    });

    // Coupon Code Action
    $(`btn-order-coupon-${o.id}`)?.addEventListener('click', async () => {
      const coupon = prompt('کد تخفیف خود را وارد کنید:');
      if (!coupon) return;
      const res = await api('apply_coupon', {}, 'POST', { order_id: o.id, coupon_code: coupon });
      if (res && res.ok) {
        showToast('کد تخفیف اعمال شد! 🎉', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'کد تخفیف نامعتبر یا منقضی است.', 'error');
      }
    });

    // Cancel Order Action
    $(`btn-order-cancel-${o.id}`)?.addEventListener('click', async () => {
      if (!confirm(`آیا از لغو سفارش #${o.id} اطمینان دارید؟`)) return;
      const res = await api('cancel_order', {}, 'POST', { order_id: o.id });
      if (res && res.ok) {
        showToast('سفارش لغو شد', 'info');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در لغو سفارش.', 'error');
      }
    });

    // Hide Order Action
    $(`btn-order-hide-${o.id}`)?.addEventListener('click', async () => {
      if (!confirm(`آیا این سفارش از لیست شما حذف شود؟`)) return;
      const res = await api('hide_order', {}, 'POST', { order_id: o.id });
      if (res && res.ok) {
        showToast('سفارش از لیست حذف شد', 'info');
        closeModal();
        renderApp();
      } else {
        showToast(res.message || 'خطا در حذف سفارش.', 'error');
      }
    });

    // Select Card Payment Action
    $(`btn-pay-card-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'card' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // Select Crypto Payment Action
    $(`btn-pay-crypto-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'crypto' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // Select Crypto Wallet Asset
    document.querySelectorAll(`[data-select-crypto-id]`).forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const wallet_id = e.currentTarget.dataset.selectCryptoId;
        const res = await api('select_crypto_wallet', {}, 'POST', { order_id: o.id, wallet_id });
        if (res && res.ok) openOrderDetailModal(o.id);
      });
    });

    // Reset Payment Method Action
    $(`btn-reset-method-${o.id}`)?.addEventListener('click', async () => {
      const res = await api('select_payment_method', {}, 'POST', { order_id: o.id, method: 'none' });
      if (res && res.ok) openOrderDetailModal(o.id);
    });

    // File label change listener
    const fileInput = $(`receipt-file-${o.id}`);
    const fileLabel = $(`receipt-file-label-${o.id}`);
    if (fileInput && fileLabel) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          fileLabel.textContent = `📎 ${fileInput.files[0].name}`;
          fileLabel.style.color = 'var(--cyan)';
        }
      });
    }

    // Card Receipt Upload Submit
    $(`receipt-upload-form-${o.id}`)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const note = $(`receipt-note-${o.id}`).value.trim();
      const fileInput = $(`receipt-file-${o.id}`);

      let receipt_b64 = null;
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        receipt_b64 = await new Promise(resolve => {
          const r = new FileReader();
          r.onload = () => resolve(r.result);
          r.readAsDataURL(file);
        });
      }

      const res = await api('submit_receipt', {}, 'POST', { order_id: o.id, note, receipt_b64 });
      if (res && res.ok) {
        showToast('رسید با موفقیت ثبت و برای پشتیبانی ارسال شد! 📤', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ثبت رسید.', 'error');
      }
    });

    // Crypto Hash TXID Submit
    $(`crypto-hash-form-${o.id}`)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tx_hash = $(`crypto-txid-${o.id}`).value.trim();
      const res = await api('submit_crypto_hash', {}, 'POST', { order_id: o.id, tx_hash });
      if (res && res.ok) {
        showToast('کد TXID ثبت شد و سیستم شبکه در حال بررسی است ⚡', 'success');
        openOrderDetailModal(o.id);
      } else {
        showToast(res.message || 'خطا در ثبت کد Hash.', 'error');
      }
    });
  }

  function openWalletConfirmSheet(orderId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    api('my_orders').then(res => {
      const orders = (res && res.ok) ? (res.orders || []) : [];
      const o = orders.find(x => Number(x.id) === Number(orderId));
      if (!o) return;
      const bal = Number(state.user?.balance || 0);

      modalContainer.innerHTML = `
        <div class="modal-card" style="max-width:480px; text-align:center;">
          <div style="font-size:42px; margin-bottom:8px;">💰</div>
          <h3 style="font-size:18px; font-weight:900; margin-bottom:8px;">پرداخت از موجودی کیف پول</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
            آیا از کسر مبلغ <b>${priceLabel(o.final_amount || o.price)}</b> بابت سفارش <b>#${nf(o.id)}</b> اطمینان دارید؟<br>
            موجودی کیف پول شما: <b style="color:#4ade80;">${priceLabel(bal)}</b>
          </p>

          <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.3); border-radius:14px; padding:12px; font-size:12px; color:#fde68a; margin-bottom:20px; text-align:right;">
            ⚠️ <b>توجه:</b> موجودی کسرشده تنها در صورت لغو سفارش به کیف پول شما بازگردانده می‌شود.
          </div>

          <div style="display:flex; gap:10px;">
            <button class="user-account-btn" id="btn-confirm-wallet-pay" style="flex:1; justify-content:center; background:#22c55e; color:#000;">تایید و کسر از کیف پول</button>
            <button class="nav-link" id="close-modal-btn" style="flex:1; justify-content:center;">انصراف</button>
          </div>
        </div>
      `;

      modalContainer.classList.remove('hidden');
      $('close-modal-btn')?.addEventListener('click', closeModal);

      $('btn-confirm-wallet-pay')?.addEventListener('click', async () => {
        const res = await api('apply_wallet', {}, 'POST', { order_id: o.id });
        if (res && res.ok) {
          showToast('پرداخت با موفقیت انجام شد! 🎉', 'success');
          closeModal();
          openOrderDetailModal(o.id);
        } else {
          showToast(res.message || 'خطا در پرداخت با کیف پول.', 'error');
        }
      });
    });
  }

  /* ── Wallet View Renderer ── */
  async function renderWalletView(container) {
    const user = state.user || {};
    const isGuest = !user || user.is_guest;
    const refLink = user.referral_link || `${window.location.origin}/?ref=${user.ref_code || ''}`;
    const walletSubTab = state.walletSubTab || 'overview';

    const guestBanner = isGuest ? `
      <div style="background:linear-gradient(135deg, rgba(245,158,11,0.15), rgba(29,155,240,0.15)); border:1px solid rgba(245,158,11,0.4); border-radius:20px; padding:18px 24px; margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <span style="font-size:28px;">👋</span>
          <div>
            <strong style="display:block; font-size:15px; color:#fde68a;">حالت میهمان (حساب باز نشده)</strong>
            <span style="font-size:13px; color:var(--text-muted);">برای مشاهده شانس گردونه، پاداش‌های دعوت، ثبت سفارشات و موجودی خود وارد شوید.</span>
          </div>
        </div>
        <button class="user-account-btn" id="btn-guest-login" style="background:#f59e0b; color:#000; font-weight:800; font-size:13px; padding:10px 20px;">🔑 ورود / ثبت‌نام سریع</button>
      </div>
    ` : '';

    container.innerHTML = `
      ${guestBanner}
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="font-size:24px; font-weight:900;">💰 کیف پول &amp; شبکه همکاری</h2>
        <div style="font-size:13px; color:var(--text-muted);">
          موجودی: <b style="color:var(--cyan); font-size:16px;">${priceLabel(user.balance || 0)}</b>
        </div>
      </div>

      <!-- Wallet Sub Navigation Tabs -->
      <div style="display:flex; gap:8px; margin-bottom:24px; background:rgba(255,255,255,0.04); padding:4px; border-radius:16px; max-width:550px;">
        <button id="wtab-overview" class="nav-link ${walletSubTab === 'overview' ? 'active' : ''}" style="flex:1; justify-content:center;">📊 خلاصه &amp; همکاری</button>
        <button id="wtab-missions" class="nav-link ${walletSubTab === 'missions' ? 'active' : ''}" style="flex:1; justify-content:center;">🎯 گردونه &amp; ماموریت</button>
        <button id="wtab-history" class="nav-link ${walletSubTab === 'history' ? 'active' : ''}" style="flex:1; justify-content:center;">📋 تراکنش‌ها</button>
      </div>

      <!-- Subtab Container -->
      <div id="wallet-subtab-container"></div>
    `;

    const subContainer = $('wallet-subtab-container');
    if (!subContainer) return;

    $('btn-guest-login')?.addEventListener('click', openAuthModal);

    $('wtab-overview')?.addEventListener('click', () => {
      state.walletSubTab = 'overview';
      renderWalletView(container);
    });

    $('wtab-missions')?.addEventListener('click', () => {
      state.walletSubTab = 'missions';
      renderWalletView(container);
    });

    $('wtab-history')?.addEventListener('click', () => {
      state.walletSubTab = 'history';
      renderWalletView(container);
    });

    // Render active subtab content
    if (walletSubTab === 'overview') {
      subContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:24px;">
          <div style="background:linear-gradient(135deg, rgba(0,242,254,0.15), rgba(29,155,240,0.25)); border:1px solid var(--border-cyan); border-radius:24px; padding:28px;">
            <small style="color:var(--text-muted); font-size:13px;">موجودی قابل خرج در سفارش‌ها</small>
            <h1 style="font-size:36px; font-weight:900; color:#fff; margin:8px 0 16px;">${priceLabel(user.balance || 0)}</h1>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="user-account-btn" id="btn-withdraw-req" style="background:#22c55e; color:#000;">🏧 درخواست برداشت نقد</button>
            </div>
          </div>

          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
            <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:6px;">آمار درآمد &amp; دعوتی‌ها</small>
            <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px;">
              <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:14px;">
                <small style="color:var(--text-muted); font-size:11px;">مجموع درآمد</small>
                <b style="display:block; font-size:15px; color:var(--cyan); margin-top:2px;">${priceLabel(user.total_earned || 0)}</b>
              </div>
              <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:14px;">
                <small style="color:var(--text-muted); font-size:11px;">تعداد زیرمجموعه‌ها</small>
                <b style="display:block; font-size:15px; color:#fff; margin-top:2px;">${nf(user.referrals_count || 0)} کاربر</b>
              </div>
            </div>
          </div>
        </div>

        <!-- Referral Link & Network Tools Section -->
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-bottom:24px;">
          <h3 style="font-size:18px; font-weight:800; margin-bottom:8px;">🔗 لینک دعوت اختصاصی شما</h3>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">با ارسال این لینک به دوستانتان، با هر خرید آنها پورسانت آنی دریافت می‌کنید.</p>
          
          <div style="display:flex; gap:10px; margin-bottom:16px; flex-wrap:wrap;">
            <input type="text" readonly value="${esc(refLink)}" style="flex:1; min-width:240px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--cyan); padding:12px; border-radius:12px; font-family:monospace; direction:ltr; text-align:center;">
            <button class="user-account-btn" data-copy="${esc(refLink)}">📋 کپی لینک</button>
            <button class="nav-link" id="btn-qr-modal" style="background:rgba(255,255,255,0.06);">📱 کد QR</button>
            <button class="nav-link" id="btn-promo-modal" style="background:rgba(255,255,255,0.06);">📝 متن تبلیغ آماده</button>
          </div>

          <div id="referrals-tree-container">⏳ در حال بارگذاری لیست زیرمجموعه‌ها...</div>
        </div>

        ${vipProgressHtml()}
        ${achievementsHtml()}

        ${!isGuest ? `
          <!-- Danger Zone: Delete Account -->
          <div style="background:var(--card-dark); border:1px solid rgba(239,68,68,0.3); border-radius:24px; padding:24px; margin-top:24px;">
            <h4 style="color:#ef4444; font-size:16px; font-weight:800; margin-bottom:8px;">⚠️ تنظیمات حساب کاربری (Danger Zone)</h4>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
              در صورت تمایل می‌توانید حساب کاربری خود را به همراه تمام اطلاعات شخصی و موجودی پاک کنید.
            </p>
            <button class="user-account-btn" id="btn-open-delete-account" style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.4);">🗑️ حذف کامل حساب کاربری</button>
          </div>
        ` : ''}
      `;

      $('btn-open-delete-account')?.addEventListener('click', openDeleteAccountModal);

      $('btn-qr-modal')?.addEventListener('click', openQrSheetModal);
      $('btn-promo-modal')?.addEventListener('click', openPromoSheetModal);

      // Withdrawal Request Dialog
      $('btn-withdraw-req')?.addEventListener('click', () => {
        const modalContainer = $('modal-container');
        if (!modalContainer) return;
        modalContainer.innerHTML = `
          <div class="modal-card" style="max-width:480px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:18px; font-weight:900;">🏧 درخواست برداشت موجودی</h3>
              <button class="close-drawer-btn" id="close-modal-btn">✕</button>
            </div>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
              موجودی قابل برداشت: <b style="color:var(--cyan);">${priceLabel(user.balance || 0)}</b>
            </p>
            <form id="withdraw-form">
              <div style="margin-bottom:16px;">
                <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">شماره کارت یا شبا جهت واریز</label>
                <input type="text" id="withdraw-card" required placeholder="IR000000000000000000000000 یا ۶۰۳۷..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
              </div>
              <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ثبت درخواست برداشت</button>
            </form>
          </div>
        `;
        modalContainer.classList.remove('hidden');
        $('close-modal-btn')?.addEventListener('click', closeModal);

        $('withdraw-form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          const card_info = $('withdraw-card').value.trim();
          const res = await api('withdraw', {}, 'POST', { card_info });
          if (res && res.ok) {
            showToast('درخواست برداشت با موفقیت ثبت شد و در صف تایید قرار گرفت. 🏦', 'success');
            closeModal();
            initApp();
          } else {
            showToast(res.message || 'خطا در ثبت درخواست برداشت.', 'error');
          }
        });
      });

      // Fetch Referrals Tree
      const refRes = await api('my_referrals');
      const refs = (refRes && refRes.ok) ? (refRes.referrals || []) : [];
      const treeBox = $('referrals-tree-container');

      if (treeBox) {
        treeBox.innerHTML = referralTreeHtml(refs);
      }
    } else if (walletSubTab === 'missions') {
      subContainer.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px; margin-bottom:24px;">
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; text-align:center;">
            <div style="font-size:48px; margin-bottom:10px;">🎡</div>
            <h3 style="font-size:18px; font-weight:900; margin-bottom:6px;">گردونه شانس روزانه</h3>
            <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
              برای هر ${nf(state.spin_every || 5)} زیرمجموعه جدید، یک شانس چرخاندن می‌گیرید.
              <br>شانس باقی‌مانده شما: <b style="color:var(--cyan); font-size:16px;">${nf(user.spin_balance || 0)}</b>
            </p>
            <button class="user-account-btn" style="margin:0 auto;" id="btn-spin-wheel">🎰 چرخاندن گردونه شانس</button>
          </div>

          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
              <h3 style="font-size:16px; font-weight:800;">🎯 ماموریت‌های امروز</h3>
              <button class="user-account-btn" id="btn-claim-missions" style="font-size:11px; padding:6px 12px; background:#22c55e; color:#000;">🎁 دریافت پاداش‌ها</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${(state.missions || []).map(missionCard).join('') || '<p style="color:var(--text-muted); font-size:13px; text-align:center;">ماموریتی یافت نشد.</p>'}
            </div>
          </div>
        </div>
      `;

      $('btn-spin-wheel')?.addEventListener('click', openSpinWheelModal);

      $('btn-claim-missions')?.addEventListener('click', async () => {
        const res = await api('claim_missions');
        if (res && res.ok) {
          showToast(`🎁 پاداش ماموریت‌ها دریافت شد!`, 'success');
          initApp();
        } else {
          showToast(res ? res.message : 'هیچ پاداش جدیدی آماده دریافت نیست.', 'info');
        }
      });
    } else if (walletSubTab === 'history') {
      const txs = state.transactions || [];
      subContainer.innerHTML = `
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px;">
          <h3 style="font-size:18px; font-weight:800; margin-bottom:16px;">📋 تاریخچه تراکنش‌های کیف پول (${txs.length})</h3>
          ${!txs.length ? `
            <p style="color:var(--text-muted); font-size:13px; text-align:center; padding:30px 0;">تراکنشی یافت نشد.</p>
          ` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${txs.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
                  <div>
                    <b style="font-size:14px;">${esc(t.description || t.type || 'تراکنش')}</b>
                    <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">${esc(t.created_at || '')}</div>
                  </div>
                  <b style="font-size:15px; color:${Number(t.amount || 0) >= 0 ? '#22c55e' : '#ef4444'};">
                    ${Number(t.amount || 0) >= 0 ? '+' : ''}${priceLabel(t.amount || 0)}
                  </b>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    }
  }

  /* ── Phase 2 Helper Functions ── */
  function wheelGradient(rewards = []) {
    const colors = ['#1d9bf0', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];
    const list = rewards.length ? rewards : [{ title: 'جایزه' }];
    const step = 100 / list.length;
    return `conic-gradient(${list.map((_, i) => `${colors[i % colors.length]} ${i * step}% ${(i + 1) * step}%`).join(',')})`;
  }

  function wheelPrizeList(rewards = []) {
    return (rewards || []).slice(0, 8).map(r => `
      <div class="wheel-prize-chip">
        <b>${esc(r.title || 'جایزه')}</b>
        <span>${Number(r.amount || 0) > 0 ? priceLabel(r.amount) : 'جایزه ویژه'}</span>
      </div>
    `).join('') || '<p style="color:var(--text-muted); font-size:12px;">جایزه‌ای تعریف نشده.</p>';
  }

  function referralTreeHtml(refs = []) {
    if (!refs || !refs.length) {
      return `
        <div style="text-align:center; padding:24px 0; color:var(--text-muted);">
          <div style="font-size:36px; margin-bottom:8px;">🌳</div>
          <p style="font-size:13px;">هنوز هیچ زیرمجموعه‌ای ثبت نشده است. لینک فوق را برای دوستانتان ارسال کنید!</p>
        </div>
      `;
    }
    const totalEarned = refs.reduce((s, r) => s + Number(r.reward_amount || r.total_earned || 0), 0);
    return `
      <div style="margin-top:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h4 style="font-size:15px; font-weight:800;">🌳 درخت زیرمجموعه‌ها (${nf(refs.length)})</h4>
          <span style="color:var(--cyan); font-size:13px; font-weight:800;">کل پاداش: ${priceLabel(totalEarned)}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${refs.map(r => {
            const initial = esc(String(r.first_name || r.username || '?').slice(0, 1).toUpperCase());
            const spent = Number(r.total_spent || 0);
            const orders = Number(r.orders_count || 0);
            const reward = Number(r.reward_amount || r.total_earned || 0);
            return `
              <div class="referral-node-v2">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div class="referral-avatar-circle">${initial}</div>
                  <div>
                    <b style="font-size:14px;">${esc(r.first_name || r.username || 'کاربر')}${r.username ? ' (@' + esc(r.username) + ')' : ''}</b>
                    <div style="color:var(--text-muted); font-size:11px; margin-top:2px;">
                      عضویت: ${esc(String(r.created_at || r.joined_at || '').slice(0, 10))} ${orders > 0 ? `· ${nf(orders)} سفارش (${priceLabel(spent)})` : '· بدون سفارش'}
                    </div>
                  </div>
                </div>
                <div class="referral-reward-badge">+${priceLabel(reward)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function missionCard(m) {
    const today = Number(state.user?.today_referrals || 0);
    const target = Math.max(1, Number(m.target || 1));
    const current = Math.min(today, target);
    const pct = Math.max(0, Math.min(100, Math.round(current / target * 100)));
    const doneClass = m.claimed ? 'claimed' : (m.done ? 'done' : 'todo');
    const badgeText = m.claimed ? 'دریافت شد ✅' : (m.done ? 'آماده دریافت 🎁' : 'در حال انجام ⏳');

    return `
      <div class="mission-card-v2 ${doneClass}">
        <div class="mission-top-v2">
          <div>
            <span style="font-size:11px; color:var(--cyan); font-weight:700;">${nf(current)} از ${nf(target)} دعوت</span>
            <h4 style="font-size:15px; font-weight:800; margin-top:2px;">${esc(m.title || `${nf(target)} دعوت امروز`)}</h4>
          </div>
          <b style="color:#22c55e; font-size:14px;">${priceLabel(m.reward || 0)}</b>
        </div>
        <div class="progress-track-v2">
          <div class="progress-fill-v2" style="width:${pct}%;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
          <span>${pct}% تکمیل شده</span>
          <b>${badgeText}</b>
        </div>
      </div>
    `;
  }

  /* ── QR Code Generator Modal ── */
  function openQrSheetModal() {
    const user = state.user || {};
    const refLink = user.referral_link || `${window.location.origin}/web?ref=${user.ref_code || ''}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(refLink)}&margin=8`;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:440px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">📱 کد QR اختصاصی دعوت شما</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">
          این کد QR را اسکن کنید تا مستقیماً به لینک دعوت شما منتقل شوید:
        </p>
        <div style="background:#fff; padding:16px; border-radius:16px; display:inline-block; margin-bottom:16px;">
          <img src="${esc(qrUrl)}" alt="QR Code" style="width:200px; height:200px; display:block;">
        </div>
        <button class="user-account-btn" data-copy="${esc(refLink)}" style="width:100%; justify-content:center;">📋 کپی لینک دعوت</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
  }

  /* ── Promotional Text Modal ── */
  function openPromoSheetModal() {
    const user = state.user || {};
    const refLink = user.referral_link || `${window.location.origin}/web?ref=${user.ref_code || ''}`;
    const brand = state.brand || 'BlueGate';

    const promoText = `💙 با ${brand} جدیدترین اشتراک‌های پرمیوم، اکانت‌های هوش مصنوعی و خدمات دیجیتال را با تحویل فوری دریافت کنید!\n\n👥 با عضویت از طریق لینک زیر، هدیه ورودی دریافت کنید:\n🔗 ${refLink}`;

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:500px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">📝 متن تبلیغاتی آماده جهت ارسال</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">
          این متن را کپی کنید و در کانال‌ها، گروه‌ها یا برای دوستانتان بفرستید:
        </p>
        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); padding:14px; border-radius:14px; font-size:13px; line-height:1.6; white-space:pre-wrap; margin-bottom:16px; direction:rtl; text-align:right;">${esc(promoText)}</div>
        <button class="user-account-btn" data-copy="${esc(promoText)}" style="width:100%; justify-content:center;">📋 کپی متن تبلیغاتی</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
  }

  /* ── VIP Level Progress Component ── */
  function vipProgressHtml() {
    const user = state.user || {};
    const spent = Number(user.customer?.total_spent || 0);
    const tiers = [
      { name: 'Bronze', fa: 'برنز', emoji: '🥉', min: 0 },
      { name: 'Silver', fa: 'نقره', emoji: '🥈', min: 1000000 },
      { name: 'Gold', fa: 'طلایی', emoji: '🥇', min: 5000000 },
      { name: 'Diamond', fa: 'الماس', emoji: '💎', min: 10000000 }
    ];
    let cur = 0, nxt = tiers[1];
    for (let i = 0; i < tiers.length; i++) {
      if (spent >= tiers[i].min) {
        cur = i;
        nxt = tiers[i + 1] || null;
      }
    }
    const curTier = tiers[cur];
    const base = curTier.min;
    const ceiling = nxt ? nxt.min : curTier.min;
    const range = Math.max(1, ceiling - base);
    const pct = nxt ? Math.min(100, Math.round((spent - base) / range * 100)) : 100;

    return `
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-top:20px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
          <span style="font-size:32px;">${curTier.emoji}</span>
          <div>
            <h3 style="font-size:16px; font-weight:800;">سطح همکاری &amp; مشتری: ${esc(curTier.fa)}</h3>
            <p style="color:var(--text-muted); font-size:13px;">
              ${nxt ? `تا ${esc(nxt.fa)} ${nxt.emoji}: ${priceLabel(Math.max(0, ceiling - spent))}` : 'به بالاترین سطح مشتریان رسیده‌اید! 🎉'}
            </p>
          </div>
        </div>
        <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden; margin-bottom:12px;">
          <div style="width:${pct}%; height:100%; background:var(--accent-grad); transition:width 0.5s ease;"></div>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-muted);">
          ${tiers.map(t => `<span style="${t.name === curTier.name ? 'color:var(--cyan); font-weight:800;' : ''}">${t.emoji} ${esc(t.fa)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  /* ── Achievements Component ── */
  function achievementsHtml() {
    const a = state.achievements || [];
    if (!a.length) return '';
    const earned = a.filter(x => x.earned).length;

    return `
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:24px; margin-top:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800;">🏆 نشان‌های افتخار &amp; دستاوردها</h3>
          <span style="font-size:13px; color:var(--cyan); font-weight:700;">${nf(earned)} از ${nf(a.length)} باز شده</span>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:12px;">
          ${a.map(x => `
            <div style="background:${x.earned ? 'rgba(0,242,254,0.08)' : 'rgba(255,255,255,0.02)'}; border:1px solid ${x.earned ? 'rgba(0,242,254,0.3)' : 'var(--border-color)'}; border-radius:14px; padding:12px; text-align:center; opacity:${x.earned ? '1' : '0.4'};">
              <div style="font-size:28px; margin-bottom:4px;">${x.earned ? x.emoji : '🔒'}</div>
              <small style="font-size:11px; font-weight:700; display:block;">${esc(x.title)}</small>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /* ── Spin Wheel Modal ── */
  function openSpinWheelModal() {
    const user = state.user || {};
    const spins = Number(user.spin_balance || 0);
    const rewards = state.spin_rewards || [];

    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:500px; text-align:center;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:18px; font-weight:900;">🎡 گردونه شانس روزانه</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
          برای هر ${nf(state.spin_every || 5)} زیرمجموعه جدید، یک شانس چرخاندن می‌گیرید. جایزه‌ها خودکار به کیف پول اضافه می‌شوند.
        </p>

        <div class="spin-stage-wrap">
          <div class="wheel-pointer-v2">▼</div>
          <div id="spinWheelVisual" class="spin-wheel-v2" style="background:${wheelGradient(rewards)}">
            <div class="wheel-center-v2"><span>SPIN</span></div>
          </div>
        </div>

        <p style="color:var(--text-muted); font-size:14px; margin-bottom:16px;">
          شانس باقی‌مانده شما: <b style="color:var(--cyan); font-size:16px;">${nf(spins)}</b>
        </p>
        <button id="btn-spin-now" class="user-account-btn" style="width:100%; justify-content:center;" ${spins <= 0 ? 'disabled' : ''}>
          ${spins > 0 ? '🎡 چرخاندن گردونه' : 'فعلاً شانسی نداری'}
        </button>

        <div class="spin-prizes-list">
          ${wheelPrizeList(rewards)}
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('btn-spin-now')?.addEventListener('click', async () => {
      const btn = $('btn-spin-now');
      const wheel = $('spinWheelVisual');
      if (!btn || btn.disabled) return;
      btn.disabled = true;
      btn.textContent = 'در حال چرخش...';

      const count = Math.max(1, rewards.length);
      const start = Number(wheel?.dataset.rot || 0);
      const fakeIndex = Math.floor(Math.random() * count);
      const degPer = 360 / count;
      const target = start + 1440 + (360 - (fakeIndex * degPer + degPer / 2));

      if (wheel) {
        wheel.dataset.rot = String(target);
        wheel.style.transform = `rotate(${target}deg)`;
      }

      try {
        const res = await api('spin');
        const prize = res.prize || {};
        const idx = Number(prize.index ?? fakeIndex);
        const finalRot = start + 2160 + (360 - (idx * degPer + degPer / 2));

        if (wheel) {
          wheel.dataset.rot = String(finalRot);
          wheel.style.transform = `rotate(${finalRot}deg)`;
        }

        setTimeout(() => {
          showToast(`🎉 مبارک! جایزه شما: "${prize.title || 'جایزه گردونه'}"`, 'success');
          initApp();
          closeModal();
        }, 2600);
      } catch (e) {
        showToast(e.message || 'خطا در گردونه', 'error');
        btn.disabled = false;
        btn.textContent = 'چرخاندن گردونه';
      }
    });
  }

  /* ── Profile View Renderer ── */
  function renderProfileView(container) {
    const user = state.user || {};
    if (!user || user.is_guest) {
      openAuthModal();
      return;
    }

    container.innerHTML = `
      <h2 style="font-size:24px; font-weight:900; margin-bottom:20px;">👤 حساب کاربری</h2>
      <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:24px; padding:28px; max-width:600px;">
        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:16px;">
          <div style="width:60px; height:60px; background:var(--accent-grad); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; color:#000;">👤</div>
          <div>
            <h3 style="font-size:18px; font-weight:900;">${esc(user.first_name || user.username || 'کاربر')}</h3>
            <p style="color:var(--text-muted); font-size:13px;">کد کاربری: #${user.id || '---'}</p>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:20px;">
          <div style="display:flex; justify-content:space-between; font-size:14px;">
            <span style="color:var(--text-muted);">نام کاربری:</span>
            <b>${esc(user.username || '---')}</b>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:14px;">
            <span style="color:var(--text-muted);">موجودی کیف پول:</span>
            <b style="color:var(--cyan);">${priceLabel(user.balance || 0)}</b>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          <button class="user-account-btn" id="btn-theme-palette" style="width:100%; justify-content:center; background:rgba(255,255,255,0.06); color:#fff;">🎨 تغییر پوسته / رنگ سایت</button>
          <button class="nav-link" style="background:rgba(239,68,68,0.15); color:#ef4444; width:100%; justify-content:center;" id="btn-logout">خروج از حساب کاربری</button>
        </div>
      </div>
    `;

    $('btn-theme-palette')?.addEventListener('click', openPaletteModal);

    $('btn-logout')?.addEventListener('click', () => {
      localStorage.removeItem('bg_web_token');
      state.user = null;
      showToast('از حساب کاربری خارج شدید', 'info');
      initApp();
    });
  }

  /* ── Admin Dashboard & Management System (Phase 5 Admin Parity) ── */
  let adminActiveTab = 'dashboard';
  let adminOrderSearch = '';
  let adminOrderStatusFilter = 'all';
  let selectedAdminOrderIds = new Set();

  /* ── Admin SVG Charts Helpers ── */
  function sparklineHtml(days = []) {
    if (!days || !days.length) return '';
    const vals = days.map(d => Number(d.revenue || 0));
    const max = Math.max(1, ...vals);
    const min = Math.min(...vals);
    const range = Math.max(1, max - min);
    const w = 300, h = 60;
    const pts = vals.map((v, i) => {
      const x = (i / Math.max(1, vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 12) - 6;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    return `
      <div class="admin-chart-card" style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <small style="color:var(--text-muted); font-weight:800; font-size:12px;">📈 روند فروش ۷ روز اخیر</small>
          <b style="color:#22c55e; font-size:13px;">${priceLabel(vals.reduce((a, b) => a + b, 0))} کل</b>
        </div>
        <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:60px; overflow:visible;">
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.4"/>
              <stop offset="100%" stop-color="#00f2fe" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <polygon points="0,${h} ${pts} ${w},${h}" fill="url(#sparkGrad)"/>
          <polyline points="${pts}" fill="none" stroke="var(--cyan)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
  }

  function barChartHtml(topProducts = []) {
    if (!topProducts || !topProducts.length) return '';
    const max = Math.max(1, ...topProducts.map(p => Number(p.total_amount || p.revenue || 0)));

    return `
      <div class="admin-chart-card" style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:18px;">
        <small style="color:var(--text-muted); font-weight:800; font-size:12px; display:block; margin-bottom:12px;">📊 پرفروش‌ترین محصولات</small>
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${topProducts.slice(0, 5).map(p => {
            const rev = Number(p.total_amount || p.revenue || 0);
            const pct = Math.min(100, Math.round((rev / max) * 100));
            return `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                  <span style="color:#fff; font-weight:700;">${esc(p.name || p.title || 'محصول')}</span>
                  <b style="color:var(--cyan);">${priceLabel(rev)}</b>
                </div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.05); border-radius:10px; overflow:hidden;">
                  <div style="width:${pct}%; height:100%; background:linear-gradient(90deg, #00f2fe, #4facfe); border-radius:10px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function pieChartHtml(payMethods = {}) {
    const entries = Object.entries(payMethods || {}).map(([k, v]) => ({ name: k, count: Number(typeof v === 'object' ? v.count : v) }));
    if (!entries.length) return '';
    const total = entries.reduce((s, e) => s + e.count, 0) || 1;
    const colors = ['#00f2fe', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

    return `
      <div class="admin-chart-card" style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:18px;">
        <small style="color:var(--text-muted); font-weight:800; font-size:12px; display:block; margin-bottom:12px;">💳 روش‌های پرداخت</small>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${entries.map((e, idx) => {
            const pct = Math.round((e.count / total) * 100);
            const color = colors[idx % colors.length];
            return `
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="width:10px; height:10px; border-radius:50%; background:${color}; display:inline-block;"></span>
                  <span style="color:#fff;">${esc(e.name)}</span>
                </div>
                <b style="color:${color};">${nf(e.count)} (${pct}٪)</b>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  async function renderAdminView(container) {
    if (!state.user || state.user.is_guest) {
      openAuthModal();
      return;
    }

    container.innerHTML = `<div style="text-align:center; padding:40px;">⏳ در حال دریافت اطلاعات داشبورد مدیریت...</div>`;

    const res = await api('admin_summary');
    if (!res || !res.ok) {
      container.innerHTML = `
        <div style="text-align:center; padding:60px 20px; background:var(--card-dark); border-radius:24px; border:1px solid rgba(239,68,68,0.3);">
          <div style="font-size:48px; margin-bottom:12px;">🚫</div>
          <h3 style="color:#ef4444;">دسترسی غیرمجاز!</h3>
          <p style="color:var(--text-muted); font-size:14px;">شما دسترسی مدیریت را ندارید یا نشست شما منقضی شده است.</p>
        </div>
      `;
      return;
    }

    const report = res.report || {};
    const orders = res.orders || [];
    const products = res.products || [];
    const categories = res.categories || [];
    const inventory = res.inventory || [];
    const coupons = res.coupons || [];
    const activityLog = res.activity_log || [];
    const adminRoles = res.admin_roles || [];
    const backups = res.backups || [];
    const variants = res.variants || [];
    const withdrawals = res.withdrawals || [];
    const settings = res.settings || {};

    const lowStockProds = products.filter(p => Number(p.inventory_available || 0) < 3);

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:24px;">
        <h2 style="font-size:24px; font-weight:900; color:#f59e0b; margin:0;">👑 پنل مدیریت BlueGate</h2>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="user-account-btn" id="btn-admin-broadcast" style="background:#8b5cf6; font-size:12px; padding:8px 14px;">📢 پیام همگانی</button>
          <button class="user-account-btn" id="btn-admin-reward" style="background:#22c55e; color:#000; font-size:12px; padding:8px 14px;">🎁 اهدا پاداش/اعتبار</button>
          <button class="user-account-btn" id="btn-admin-export-orders" style="background:rgba(255,255,255,0.08); font-size:12px; padding:8px 14px;">📥 CSV سفارش‌ها</button>
          <button class="user-account-btn" id="btn-admin-export-prods" style="background:rgba(255,255,255,0.08); font-size:12px; padding:8px 14px;">📥 CSV محصولات</button>
          <button class="user-account-btn" id="btn-refresh-rates" style="background:rgba(255,255,255,0.08); font-size:12px; padding:8px 14px;">⚡ رفرش نرخ ارز</button>
          <button class="user-account-btn" id="btn-refresh-admin" style="font-size:12px; padding:8px 14px;">🔄 رفرش</button>
        </div>
      </div>

      ${lowStockProds.length > 0 ? `
        <div style="background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.4); border-radius:18px; padding:14px 18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; gap:12px; color:#fde68a;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:24px;">⚠️</span>
            <div>
              <b style="font-size:14px; display:block;">هشدار کسر موجودی انبار (${nf(lowStockProds.length)} محصول)</b>
              <small style="opacity:0.8; font-size:12px;">برخی محصولات به کمتر از ۳ عدد موجودی رسیده‌اند.</small>
            </div>
          </div>
          <button class="user-account-btn" id="btn-alert-add-inventory" style="background:#f59e0b; color:#000; font-size:11px; padding:6px 12px;">📦 شارژ انبار</button>
        </div>
      ` : ''}

      <!-- Admin Sub Tabs Header -->
      <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:20px; border-bottom:1px solid var(--border-color); scrollbar-width:none;">
        <button class="nav-link ${adminActiveTab === 'dashboard' ? 'active' : ''}" data-admin-subtab="dashboard">📊 داشبورد</button>
        <button class="nav-link ${adminActiveTab === 'orders' ? 'active' : ''}" data-admin-subtab="orders">📜 سفارش‌ها (${orders.length})</button>
        <button class="nav-link ${adminActiveTab === 'products' ? 'active' : ''}" data-admin-subtab="products">🛒 محصولات (${products.length})</button>
        <button class="nav-link ${adminActiveTab === 'categories' ? 'active' : ''}" data-admin-subtab="categories">📂 دسته‌بندی‌ها (${categories.length})</button>
        <button class="nav-link ${adminActiveTab === 'variants' ? 'active' : ''}" data-admin-subtab="variants">📐 پلن‌ها (${variants.length})</button>
        <button class="nav-link ${adminActiveTab === 'inventory' ? 'active' : ''}" data-admin-subtab="inventory">📦 انبار (${inventory.length})</button>
        <button class="nav-link ${adminActiveTab === 'withdrawals' ? 'active' : ''}" data-admin-subtab="withdrawals">🏧 برداشت‌ها (${withdrawals.length})</button>
        <button class="nav-link ${adminActiveTab === 'coupons' ? 'active' : ''}" data-admin-subtab="coupons">🎟 تخفیف‌ها (${coupons.length})</button>
        <button class="nav-link ${adminActiveTab === 'settings' ? 'active' : ''}" data-admin-subtab="settings">⚙️ تنظیمات</button>
        <button class="nav-link ${adminActiveTab === 'activity' ? 'active' : ''}" data-admin-subtab="activity">📜 لاگ (${activityLog.length})</button>
        <button class="nav-link ${adminActiveTab === 'roles' ? 'active' : ''}" data-admin-subtab="roles">👥 نقش‌ها</button>
        <button class="nav-link ${adminActiveTab === 'backups' ? 'active' : ''}" data-admin-subtab="backups">💾 بکاپ (${backups.length})</button>
      </div>

      <!-- Sub Content Area -->
      <div id="admin-sub-content"></div>
    `;

    function renderActiveTab() {
      const subContent = $('admin-sub-content');
      if (!subContent) return;

      document.querySelectorAll('[data-admin-subtab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.adminSubtab === adminActiveTab);
      });

      if (adminActiveTab === 'dashboard') {
        subContent.innerHTML = renderAdminDashboardTab(report, products, categories);
      } else if (adminActiveTab === 'orders') {
        subContent.innerHTML = renderAdminOrdersTabMarkup(orders);
        bindAdminOrdersTabEvents(orders);
      } else if (adminActiveTab === 'products') {
        subContent.innerHTML = renderAdminProductsTabMarkup(products, categories);
        bindAdminProductsTabEvents(products, categories);
      } else if (adminActiveTab === 'categories') {
        subContent.innerHTML = renderAdminCategoriesTabMarkup(categories);
        bindAdminCategoriesTabEvents(categories);
      } else if (adminActiveTab === 'variants') {
        subContent.innerHTML = renderAdminVariantsTabMarkup(variants, products);
        bindAdminVariantsTabEvents(variants, products);
      } else if (adminActiveTab === 'inventory') {
        subContent.innerHTML = renderAdminInventoryTabMarkup(inventory, products);
        bindAdminInventoryTabEvents(inventory);
      } else if (adminActiveTab === 'withdrawals') {
        subContent.innerHTML = renderAdminWithdrawalsTabMarkup(withdrawals);
        bindAdminWithdrawalsTabEvents(withdrawals);
      } else if (adminActiveTab === 'coupons') {
        subContent.innerHTML = renderAdminCouponsTabMarkup(coupons);
        bindAdminCouponsTabEvents(coupons);
      } else if (adminActiveTab === 'settings') {
        subContent.innerHTML = renderAdminSettingsTabMarkup(settings);
        bindAdminSettingsTabEvents(settings);
      } else if (adminActiveTab === 'activity') {
        subContent.innerHTML = renderAdminActivityTabMarkup(activityLog);
      } else if (adminActiveTab === 'roles') {
        subContent.innerHTML = renderAdminRolesTabMarkup(adminRoles);
      } else if (adminActiveTab === 'backups') {
        subContent.innerHTML = renderAdminBackupsTabMarkup(backups);
        bindAdminBackupsTabEvents(backups);
      }
    }

    renderActiveTab();

    document.querySelectorAll('[data-admin-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        adminActiveTab = btn.dataset.adminSubtab;
        renderActiveTab();
      });
    });

    $('btn-refresh-admin')?.addEventListener('click', () => renderAdminView(container));
    $('btn-admin-broadcast')?.addEventListener('click', openBroadcastModal);
    $('btn-admin-reward')?.addEventListener('click', openPurchaseRewardModal);
    $('btn-admin-export-orders')?.addEventListener('click', () => exportOrdersCsv(orders));
    $('btn-admin-export-prods')?.addEventListener('click', () => exportProductsCsv(products));
    $('btn-alert-add-inventory')?.addEventListener('click', () => openAddInventoryModal(products));
    $('btn-refresh-rates')?.addEventListener('click', async () => {
      showToast('در حال دریافت آخرین نرخ‌های کریپتو...', 'info');
      const rateRes = await api('admin_refresh_crypto_rates');
      if (rateRes && rateRes.ok) {
        showToast('نرخ‌ها رفرش شدند! ⚡', 'success');
        renderAdminView(container);
      } else {
        showToast(rateRes ? rateRes.message : 'خطا در رفرش نرخ‌ها.', 'error');
      }
    });
  }

  function renderAdminBackupsTabMarkup(backups) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="font-size:18px; font-weight:800; margin:0;">💾 مرکز بکاپ و ریستور (${backups.length})</h3>
        <button class="user-account-btn" id="btn-admin-backup-create" style="background:var(--cyan); color:#000; font-size:12px; padding:8px 14px;">📦 ساخت بکاپ جدید</button>
      </div>

      <div style="background:var(--card-dark); border:1px solid rgba(239,68,68,0.3); border-radius:18px; padding:20px; margin-bottom:24px;">
        <h4 style="color:#ef4444; margin-bottom:8px;">♻️ آپلود و ریستور بکاپ (Danger Zone)</h4>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:12px;">ریستور کردن فایل بکاپ، تمام اطلاعات فعلی دیتابیس را جایگزین خواهد کرد. لطفاً فایل .json.gz را انتخاب کنید.</p>
        <div style="display:flex; gap:10px; align-items:center;">
          <input type="file" id="backup-upload-input" accept=".json,.gz,.json.gz" style="background:rgba(255,255,255,0.05); padding:10px; border-radius:12px; font-size:13px; border:1px solid var(--border-color); flex:1;">
          <button class="user-account-btn" id="btn-admin-backup-upload" style="background:#ef4444; color:#fff;">آپلود و ریستور</button>
        </div>
      </div>

      ${!backups.length ? `
        <div style="text-align:center; padding:40px; background:var(--card-dark); border-radius:20px; color:var(--text-muted);">
          بکاپی در سرور وجود ندارد.
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${backups.map(b => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:14px; padding:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
              <div>
                <b style="font-size:14px; color:#fff; display:block; margin-bottom:4px;">${esc(b.filename)}</b>
                <span style="font-size:12px; color:var(--text-muted);">${nf(Math.round(b.size/1024))} KB · ایجاد: ${esc(b.created_at || '-')}</span>
              </div>
              <div style="display:flex; gap:8px;">
                <a href="${esc(b.download_url)}" target="_blank" class="user-account-btn" style="background:rgba(255,255,255,0.08); font-size:12px; text-decoration:none;">📥 دانلود</a>
                <button class="user-account-btn btn-admin-backup-restore" data-filename="${esc(b.filename)}" style="background:rgba(245,158,11,0.2); color:#f59e0b; font-size:12px;">♻️ ریستور</button>
                <button class="user-account-btn btn-admin-backup-delete" data-filename="${esc(b.filename)}" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:12px;">🗑️ حذف</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function bindAdminBackupsTabEvents(backups) {
    $('btn-admin-backup-create')?.addEventListener('click', async () => {
      const res = await api('admin_backup_create', {}, 'POST');
      if (res && res.ok) {
        showToast('بکاپ جدید با موفقیت ساخته شد!', 'success');
        const container = $('app');
        if (container) renderAdminView(container);
      } else {
        showToast(res ? res.message : 'خطا در ساخت بکاپ', 'error');
      }
    });

    document.querySelectorAll('.btn-admin-backup-delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('آیا از حذف این فایل بکاپ مطمئن هستید؟ این عملیات غیرقابل بازگشت است.')) return;
        const res = await api('admin_backup_delete', {}, 'POST', { filename: btn.dataset.filename });
        if (res && res.ok) {
          showToast('بکاپ حذف شد.', 'success');
          const container = $('app');
          if (container) renderAdminView(container);
        } else {
          showToast(res ? res.message : 'خطا در حذف بکاپ', 'error');
        }
      });
    });

    document.querySelectorAll('.btn-admin-backup-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('توجه: ریستور کردن دیتابیس فعلی را جایگزین میکند. مطمئن هستید؟')) return;
        showToast('در حال ریستور دیتابیس...', 'info');
        const res = await api('admin_backup_restore_server', {}, 'POST', { filename: btn.dataset.filename, confirm: 'RESTORE' });
        if (res && res.ok) {
          showToast('دیتابیس با موفقیت ریستور شد! صفحه مجددا بارگذاری میشود...', 'success');
          setTimeout(() => location.reload(), 2000);
        } else {
          showToast(res ? res.message : 'خطا در ریستور بکاپ', 'error');
        }
      });
    });

    $('btn-admin-backup-upload')?.addEventListener('click', async () => {
      const fileInput = $('backup-upload-input');
      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        showToast('ابتدا یک فایل انتخاب کنید.', 'error');
        return;
      }
      if (!confirm('هشدار: دیتابیس فعلی پاک شده و این فایل جایگزین آن می‌شود. ادامه میدهید؟')) return;
      
      const file = fileInput.files[0];
      const fd = new FormData();
      fd.append('confirm', 'RESTORE');
      fd.append('backup', file);

      showToast('در حال آپلود و ریستور...', 'info');
      try {
        const token = localStorage.getItem('bg_web_token');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          headers['X-Web-Token'] = token;
        }
        
        const res = await fetch('/backup_upload.php', { method: 'POST', body: fd, headers });
        const data = await res.json();
        if (data && data.ok) {
          showToast('دیتابیس با موفقیت ریستور شد! ریلود در 2 ثانیه...', 'success');
          setTimeout(() => location.reload(), 2000);
        } else {
          showToast(data.message || 'خطا در آپلود بکاپ', 'error');
        }
      } catch (e) {
        showToast('خطا در ارتباط با سرور آپلود', 'error');
      }
    });
  }

  function renderAdminDashboardTab(report, products, categories) {
    const todayRev = report.today?.revenue || 0;
    const todayOrdersCount = report.today?.c || 0;

    return `
      <!-- Stats Summary Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
        <div style="background:var(--card-dark); border:1px solid rgba(245,158,11,0.3); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">فروش امروز</small>
          <h3 style="font-size:22px; font-weight:900; color:#f59e0b; margin-top:4px;">${priceLabel(todayRev)}</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">سفارش‌های امروز</small>
          <h3 style="font-size:22px; font-weight:900; color:#fff; margin-top:4px;">${nf(todayOrdersCount)} سفارش</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">کل فروش سیستم</small>
          <h3 style="font-size:22px; font-weight:900; color:#22c55e; margin-top:4px;">${priceLabel(report.total_revenue || 0)}</h3>
        </div>
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <small style="color:var(--text-muted); font-size:12px;">محصولات active</small>
          <h3 style="font-size:22px; font-weight:900; color:var(--cyan); margin-top:4px;">${nf(products.length)} محصول</h3>
        </div>
      </div>

      <!-- Analytics Charts Grid -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
        ${sparklineHtml(report.days || [])}
        ${barChartHtml(report.top_products || [])}
        ${pieChartHtml(report.payment_methods || {})}
      </div>
    `;
  }

  function renderAdminOrdersTabMarkup(orders) {
    const statuses = [
      { id: 'all', label: 'همه' },
      { id: 'pending_payment', label: 'در انتظار پرداخت' },
      { id: 'reviewing', label: 'در حال بررسی' },
      { id: 'preparing', label: 'آماده‌سازی' },
      { id: 'delivered', label: 'تحویل‌شده' },
      { id: 'rejected', label: 'رد شده' }
    ];

    let filtered = orders;
    if (adminOrderStatusFilter !== 'all') {
      filtered = filtered.filter(o => o.status === adminOrderStatusFilter);
    }
    if (adminOrderSearch.trim() !== '') {
      const q = adminOrderSearch.trim().toLowerCase();
      filtered = filtered.filter(o => {
        const idStr = String(o.id || '');
        const userIdStr = String(o.user_id || '');
        const name = (o.display_name || o.product_title || '').toLowerCase();
        const note = (o.payment_note || '').toLowerCase();
        return idStr.includes(q) || userIdStr.includes(q) || name.includes(q) || note.includes(q);
      });
    }

    return `
      <!-- Search & Filters Row -->
      <div style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:space-between; align-items:center;">
          <input type="text" id="admin-order-search-input" value="${esc(adminOrderSearch)}" placeholder="🔍 جستجو بر اساس کد سفارش، ID کاربر، نام محصول..." style="flex:1; min-width:240px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:14px; font-family:inherit; outline:none; font-size:13px;">
          
          <!-- Bulk Action Bar -->
          <div id="admin-bulk-actions-bar" style="display:${selectedAdminOrderIds.size > 0 ? 'flex' : 'none'}; align-items:center; gap:8px; background:rgba(0,242,254,0.1); border:1px solid var(--cyan); padding:6px 12px; border-radius:14px;">
            <b style="font-size:12px; color:var(--cyan);">${nf(selectedAdminOrderIds.size)} انتخاب‌شده:</b>
            <button class="user-account-btn" id="bulk-confirm-btn" style="background:#22c55e; color:#000; font-size:11px; padding:4px 10px;">🟢 تایید تجمعی</button>
            <button class="user-account-btn" id="bulk-prepare-btn" style="background:#3b82f6; color:#fff; font-size:11px; padding:4px 10px;">📦 آماده‌سازی</button>
            <button class="user-account-btn" id="bulk-reject-btn" style="background:#ef4444; color:#fff; font-size:11px; padding:4px 10px;">❌ رد تجمعی</button>
          </div>
        </div>

        <!-- Filter Chips -->
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;">
          ${statuses.map(s => `
            <button class="sort-pill-btn ${adminOrderStatusFilter === s.id ? 'active' : ''}" data-admin-filter="${s.id}" style="font-size:12px; white-space:nowrap;">${s.label}</button>
          `).join('')}
        </div>
      </div>

      <!-- Orders List Cards -->
      ${!filtered.length ? `
        <div style="text-align:center; padding:40px; background:var(--card-dark); border-radius:20px; color:var(--text-muted);">
          سفارشی با این فیلترها یافت نشد.
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:14px;">
          ${filtered.map(o => {
            const isChecked = selectedAdminOrderIds.has(Number(o.id));
            return `
              <div style="background:var(--card-dark); border:1px solid ${isChecked ? 'var(--cyan)' : 'var(--border-color)'}; border-radius:18px; padding:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-color); padding-bottom:10px; margin-bottom:12px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" class="admin-order-chk" data-order-id="${o.id}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:var(--cyan);">
                    <b>سفارش #${o.id}</b>
                    <span style="color:var(--text-muted); font-size:12px; margin-right:4px;">کاربر: #${o.user_id || '---'}</span>
                  </div>
                  <span style="background:rgba(245,158,11,0.15); color:#f59e0b; font-weight:800; font-size:12px; padding:4px 12px; border-radius:12px;">
                    ${esc(o.status_fa || o.status)}
                  </span>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                  <div>
                    <h4 style="font-size:15px; font-weight:800; margin-bottom:4px;">${esc(o.display_name || o.product_title || 'محصول')}</h4>
                    <div style="font-size:12px; color:var(--text-muted);">
                      روش: ${esc(o.payment_method_fa || o.payment_method || 'تعیین نشده')} · تاریخ: ${esc(o.created_at || '')}
                    </div>
                  </div>
                  <b style="font-size:16px; color:var(--cyan);">${priceLabel(o.final_amount || o.price)}</b>
                </div>

                ${o.payment_note ? `
                  <div style="background:rgba(255,255,255,0.03); border-radius:10px; padding:10px; font-size:12px; margin-bottom:12px; color:var(--text-muted);">
                    💬 توضیحات کاربر: <span style="color:#fff;">${esc(o.payment_note)}</span>
                  </div>
                ` : ''}

                <!-- Status Action Buttons -->
                <div style="display:flex; flex-wrap:wrap; gap:8px; border-top:1px solid var(--border-color); padding-top:12px;">
                  <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="payment_confirmed" style="background:#22c55e; color:#000; font-size:11px; padding:6px 12px;">🟢 تایید پرداخت</button>
                  <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="preparing" style="background:#3b82f6; color:#fff; font-size:11px; padding:6px 12px;">📦 آماده‌سازی</button>
                  <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="delivered" style="background:var(--cyan); color:#000; font-size:11px; padding:6px 12px;">✅ ثبت تحویل</button>
                  <button class="user-account-btn" data-admin-status-id="${o.id}" data-status="rejected" style="background:#ef4444; color:#fff; font-size:11px; padding:6px 12px;">❌ رد سفارش</button>
                  ${o.user_id ? `
                    <button class="nav-link" data-admin-cust-id="${o.user_id}" style="font-size:11px; padding:6px 12px; background:rgba(255,255,255,0.06);">👤 پروفایل 360 کاربر</button>
                    <button class="user-account-btn data-admin-edit-user-btn" data-admin-edit-user-id="${o.user_id}" style="font-size:11px; padding:6px 12px; background:rgba(245,158,11,0.2); color:#f59e0b;">✏️ ویرایش کاربر</button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  function renderAdminProductsTabMarkup(products, categories) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:16px; font-weight:800; margin:0;">🛒 مدیریت محصولات (${products.length})</h3>
        <button class="user-account-btn" id="btn-add-product" style="background:#22c55e; color:#000; font-size:12px;">➕ افزودن محصول جدید</button>
      </div>
      ${!products.length ? `<p style="color:var(--text-muted); text-align:center; padding:30px;">محصولی ثبت نشده است.</p>` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
          ${products.map(p => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                  <b style="font-size:15px; display:flex; align-items:center; gap:6px;">
                    ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:24px; height:24px; border-radius:6px; object-fit:cover;">` : (p.emoji || '📦')}
                    ${esc(p.name)}
                  </b>
                  <span style="font-size:11px; padding:2px 8px; border-radius:8px; background:${p.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${p.is_active ? '#22c55e' : '#ef4444'};">
                    ${p.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <div style="color:var(--cyan); font-weight:800; font-size:15px; margin-bottom:8px;">${priceLabel(p.price)}</div>
                <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:12px;">${esc(p.short_description || 'بدون توضیح')}</small>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
                <button class="nav-link" data-admin-edit-pid="${p.id}" style="flex:1; justify-content:center; font-size:11px; padding:6px 8px; background:rgba(59,130,246,0.15); color:#60a5fa;">✏️ ویرایش</button>
                <button class="nav-link" data-admin-toggle-pid="${p.id}" style="flex:1; justify-content:center; font-size:11px; padding:6px 8px; background:${p.is_active ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)'}; color:${p.is_active ? '#ef4444' : '#22c55e'};">
                  ${p.is_active ? '🚫 غیرفعال' : '✅ فعال'}
                </button>
                <button class="nav-link" data-admin-delete-pid="${p.id}" style="justify-content:center; font-size:11px; padding:6px 8px; background:rgba(239,68,68,0.2); color:#ef4444;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderAdminCategoriesTabMarkup(categories) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:16px; font-weight:800; margin:0;">📂 مدیریت دسته‌بندی‌ها (${categories.length})</h3>
        <button class="user-account-btn" id="btn-add-category" style="background:#22c55e; color:#000; font-size:12px;">➕ افزودن دسته‌بندی جدید</button>
      </div>
      ${!categories.length ? `<p style="color:var(--text-muted); text-align:center; padding:30px;">دسته‌بندی ثبت نشده است.</p>` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:16px;">
          ${categories.map(c => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:16px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <b style="font-size:15px; display:flex; align-items:center; gap:8px;">
                  <span style="font-size:20px;">${esc(c.emoji || '🛒')}</span>
                  ${esc(c.title)}
                </b>
                <small style="color:var(--text-muted); font-size:12px; display:block; margin-top:4px;">ترتیب: ${c.sort_order} | وضعیت: ${c.is_active ? 'فعال' : 'غیرفعال'}</small>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="nav-link" data-admin-edit-cid="${c.id}" style="padding:6px 10px; font-size:11px; background:rgba(59,130,246,0.15); color:#60a5fa;">✏️</button>
                <button class="nav-link" data-admin-delete-cid="${c.id}" style="padding:6px 10px; font-size:11px; background:rgba(239,68,68,0.2); color:#ef4444;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderAdminVariantsTabMarkup(variants, products) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:12px;">
        <h3 style="font-size:16px; font-weight:800; margin:0;">📐 مدیریت پلن‌ها / متغیرها (${variants.length})</h3>
        <button class="user-account-btn" id="btn-add-variant" style="background:#22c55e; color:#000; font-size:12px;">➕ افزودن پلن جدید</button>
      </div>
      ${!variants.length ? `<p style="color:var(--text-muted); text-align:center; padding:30px;">پلنی ثبت نشده است.</p>` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:16px;">
          ${variants.map(v => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:18px; padding:16px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                  <b style="font-size:14px;">${esc(v.title)}</b>
                  <span style="font-size:11px; padding:2px 8px; border-radius:8px; background:${v.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${v.is_active ? '#22c55e' : '#ef4444'};">
                    ${v.is_active ? 'فعال' : 'غیرفعال'}
                  </span>
                </div>
                <small style="color:var(--cyan); font-weight:700; display:block; margin-bottom:4px;">محصول: ${esc(v.product_name || 'نامشخص')}</small>
                <div style="color:var(--text-color); font-weight:800; font-size:14px;">${priceLabel(v.price)} ${v.discount_percent > 0 ? `<span style="color:#ef4444; font-size:12px;">(${v.discount_percent}٪ تخفیف)</span>` : ''}</div>
                <small style="color:var(--text-muted); font-size:12px; display:block; margin-top:4px;">مدت: ${v.duration_days} روز</small>
              </div>
              <div style="display:flex; gap:6px; margin-top:12px;">
                <button class="nav-link" data-admin-edit-vid="${v.id}" style="flex:1; justify-content:center; font-size:11px; padding:6px; background:rgba(59,130,246,0.15); color:#60a5fa;">✏️ ویرایش</button>
                <button class="nav-link" data-admin-delete-vid="${v.id}" style="padding:6px 10px; font-size:11px; background:rgba(239,68,68,0.2); color:#ef4444;">🗑️</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function webWithdrawalRowHtml(w) {
    const isPaid = w.status === 'paid';
    const isRejected = w.status === 'rejected';
    const isPending = w.status === 'pending';

    return `
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">${isPaid ? '✅' : isRejected ? '❌' : '⏳'}</span>
            <b style="font-size:15px; color:#22c55e;">${priceLabel(w.amount)}</b>
            <small style="color:var(--text-muted); font-size:11px;">#${w.id}</small>
          </div>
          <div style="font-size:13px; color:var(--text-color); margin-top:4px;">
            کاربر: <b>${esc(w.first_name || w.username || w.user_id)}</b> ${w.username ? `(@${esc(w.username)})` : ''} · ID: <code>${w.telegram_id || w.user_id}</code>
          </div>
          <small style="color:var(--text-muted); font-size:12px; display:block; margin-top:4px;">💳 شماره کارت / حساب: <code style="direction:ltr; display:inline-block; color:var(--cyan);">${esc(w.card_info || 'نامشخص')}</code></small>
          <small style="color:var(--text-muted); font-size:11px; display:block; margin-top:2px;">تاریخ: ${esc(w.created_at || '')}</small>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:11px; padding:4px 10px; border-radius:8px; background:${isPaid ? 'rgba(34,197,94,0.15)' : isRejected ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}; color:${isPaid ? '#22c55e' : isRejected ? '#ef4444' : '#f59e0b'}; font-weight:700;">
            ${isPaid ? 'پرداخت‌شده' : isRejected ? 'رد‌شده' : 'در انتظار'}
          </span>
          ${isPending ? `
            <button class="user-account-btn" data-admin-withdraw-act="${w.id}:paid" style="background:#22c55e; color:#000; font-size:11px; padding:6px 12px;">✅ تایید &amp; پرداخت</button>
            <button class="user-account-btn" data-admin-withdraw-act="${w.id}:rejected" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:11px; padding:6px 12px;">❌ رد درخواست</button>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderAdminWithdrawalsTabMarkup(withdrawals) {
    const list = Array.isArray(withdrawals) ? withdrawals : [];
    const pending = list.filter(x => x && x.status === 'pending');
    const paid = list.filter(x => x && x.status === 'paid');
    const rejected = list.filter(x => x && x.status === 'rejected');
    const totalPending = pending.reduce((s, x) => s + Number(x.amount || 0), 0);

    return `
      <div style="margin-bottom:20px;">
        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
          <h3 style="font-size:18px; font-weight:900; margin:0 0 8px 0; color:#fff;">🏧 مدیریت درخواست‌های برداشت (${list.length})</h3>
          <p style="color:var(--text-muted); font-size:13px; margin:0;">${nf(pending.length)} در انتظار · مجموع ${priceLabel(totalPending)}</p>
          
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:16px;">
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:12px; text-align:center;">
              <b style="font-size:18px; color:#f59e0b; display:block;">${nf(pending.length)}</b>
              <small style="color:var(--text-muted); font-size:12px;">در انتظار</small>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:12px; text-align:center;">
              <b style="font-size:18px; color:#22c55e; display:block;">${nf(paid.length)}</b>
              <small style="color:var(--text-muted); font-size:12px;">پرداخت‌شده</small>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:12px; text-align:center;">
              <b style="font-size:18px; color:#ef4444; display:block;">${nf(rejected.length)}</b>
              <small style="color:var(--text-muted); font-size:12px;">رد‌شده</small>
            </div>
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:12px; text-align:center;">
              <b style="font-size:18px; color:var(--cyan); display:block;">${priceLabel(totalPending)}</b>
              <small style="color:var(--text-muted); font-size:12px;">تومان مانده برداشت</small>
            </div>
          </div>
        </div>

        ${pending.length > 0 ? `
          <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:20px; padding:20px; margin-bottom:24px;">
            <h4 style="font-size:15px; font-weight:800; color:#f59e0b; margin:0 0 14px 0;">⏳ نیازمند اقدام (${pending.length})</h4>
            <div style="display:flex; flex-direction:column; gap:12px;">
              ${pending.map(w => webWithdrawalRowHtml(w)).join('')}
            </div>
          </div>
        ` : ''}

        <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px;">
          <h4 style="font-size:15px; font-weight:800; margin:0 0 14px 0; color:#fff;">📋 همه درخواست‌های برداشت (${list.length})</h4>
          ${!list.length ? `<p style="color:var(--text-muted); padding:20px; text-align:center;">هنوز برداشتی ثبت نشده است.</p>` : `
            <div style="display:flex; flex-direction:column; gap:10px;">
              ${list.map(w => webWithdrawalRowHtml(w)).join('')}
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderAdminInventoryTabMarkup(inventory, products) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="font-size:18px; font-weight:800; margin:0;">📦 انبار موجودی اکانت‌ها/کدها (${inventory.length})</h3>
        <button class="user-account-btn" id="btn-add-inventory" style="background:var(--cyan); color:#000; font-size:12px; padding:8px 14px;">📦 افزودن موجودی جدید</button>
      </div>

      ${!inventory.length ? `
        <div style="text-align:center; padding:40px; background:var(--card-dark); border-radius:20px; color:var(--text-muted);">
          موجودی در انبار ثبت نشده است.
        </div>
      ` : `
        <div style="display:flex; flex-direction:column; gap:10px;">
          ${inventory.map(item => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <b style="font-size:14px; color:#fff; display:block;">محصول ID: #${item.product_id}</b>
                <code style="font-size:12px; color:var(--cyan); background:rgba(0,0,0,0.3); padding:4px 8px; border-radius:8px; display:inline-block; margin-top:4px;">${esc(item.content)}</code>
              </div>
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:11px; padding:4px 10px; border-radius:8px; background:${item.status === 'available' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}; color:${item.status === 'available' ? '#22c55e' : '#ef4444'};">
                  ${item.status === 'available' ? 'آماده تحویل' : 'تحویل داده‌شده'}
                </span>
                <button class="nav-link" data-delete-inv-id="${item.id}" style="background:rgba(239,68,68,0.15); color:#ef4444; font-size:11px; padding:6px 10px;">🗑️ حذف</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderAdminCouponsTabMarkup(coupons) {
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h3 style="font-size:18px; font-weight:800; margin:0;">🎟 کدهای تخفیف (${coupons.length})</h3>
        <button class="user-account-btn" id="btn-add-coupon" style="background:#22c55e; color:#000; font-size:12px; padding:8px 14px;">🎟 افزودن کد تخفیف جدید</button>
      </div>

      ${!coupons.length ? `
        <div style="text-align:center; padding:40px; background:var(--card-dark); border-radius:20px; color:var(--text-muted);">
          کد تخفیفی تعریف نشده است.
        </div>
      ` : `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px;">
          ${coupons.map(c => `
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:16px; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <b style="font-size:16px; color:var(--cyan); letter-spacing:1px;">${esc(c.code)}</b>
                <span style="font-size:11px; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.06); color:var(--text-muted);">
                  ${c.discount_type === 'percent' ? 'درصدی' : 'مبلغ ثابت'}
                </span>
              </div>
              <div style="font-size:14px; font-weight:800; margin-bottom:8px;">
                مقدار: ${c.discount_type === 'percent' ? `${c.discount_value}٪` : priceLabel(c.discount_value)}
              </div>
              <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:12px;">
                استفاده: ${nf(c.used_count || 0)} از ${c.max_uses ? nf(c.max_uses) : 'نامحدود'}
              </small>
            </div>
          `).join('')}
        </div>
      `}
    `;
  }

  function renderAdminActivityTabMarkup(log) {
    if (!log || !log.length) return `<p style="color:var(--text-muted); text-align:center; padding:30px;">لاگ فعالیتی ثبت نشده است.</p>`;
    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${log.map(a => `
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:12px; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; font-size:13px;">
            <div>
              <b style="color:#fff;">${esc(a.title || a.action || 'فعالیت')}</b>
              <small style="display:block; color:var(--text-muted); margin-top:2px;">${esc(a.description || a.details || '')}</small>
            </div>
            <small style="color:var(--text-muted);">${esc(a.created_at || '')}</small>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderAdminRolesTabMarkup(roles) {
    if (!roles || !roles.length) return `<p style="color:var(--text-muted); text-align:center; padding:30px;">نقش جدیدی تعریف نشده است.</p>`;
    return `
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${roles.map(r => `
          <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <b style="color:#fff; font-size:14px;">${esc(r.role_name || r.name || 'نقش ادمین')}</b>
              <small style="display:block; color:var(--text-muted); margin-top:2px;">سطح دسترسی: ${esc(r.permissions || 'کامل')}</small>
            </div>
            <span style="font-size:11px; padding:4px 10px; border-radius:8px; background:rgba(0,242,254,0.15); color:var(--cyan);">فعال</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function bindAdminOrdersTabEvents(orders) {
    document.querySelectorAll('[data-admin-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        adminOrderStatusFilter = btn.dataset.adminFilter;
        const subContent = $('admin-sub-content');
        if (subContent) {
          subContent.innerHTML = renderAdminOrdersTabMarkup(orders);
          bindAdminOrdersTabEvents(orders);
        }
      });
    });

    const searchInput = $('admin-order-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        adminOrderSearch = e.target.value;
        const subContent = $('admin-sub-content');
        if (subContent) {
          subContent.innerHTML = renderAdminOrdersTabMarkup(orders);
          bindAdminOrdersTabEvents(orders);
        }
      });
    }

    document.querySelectorAll('.admin-order-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const oid = Number(chk.dataset.orderId);
        if (chk.checked) selectedAdminOrderIds.add(oid);
        else selectedAdminOrderIds.delete(oid);

        const bar = $('admin-bulk-actions-bar');
        if (bar) bar.style.display = selectedAdminOrderIds.size > 0 ? 'flex' : 'none';
      });
    });

    $('bulk-confirm-btn')?.addEventListener('click', () => executeBulkOrders('payment_confirmed'));
    $('bulk-prepare-btn')?.addEventListener('click', () => executeBulkOrders('preparing'));
    $('bulk-reject-btn')?.addEventListener('click', () => executeBulkOrders('rejected'));

    async function executeBulkOrders(status) {
      if (!selectedAdminOrderIds.size) return;
      const count = selectedAdminOrderIds.size;
      showToast(`در حال انجام ${count} تغییر وضعیت...`, 'info');
      for (const oid of selectedAdminOrderIds) {
        await api('admin_order_status', {}, 'POST', { order_id: oid, status });
      }
      selectedAdminOrderIds.clear();
      showToast(`✅ ${count} سفارش تغییر وضعیت داده شدند!`, 'success');
      renderAdminView($('app'));
    }

    document.querySelectorAll('[data-admin-status-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const order_id = btn.dataset.adminStatusId;
        const status = btn.dataset.status;
        const res = await api('admin_order_status', {}, 'POST', { order_id, status });
        if (res && res.ok) {
          showToast('وضعیت سفارش بروزرسانی شد! ⚡', 'success');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در تغییر وضعیت.', 'error');
        }
      });
    });

    document.querySelectorAll('[data-admin-cust-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        openCustomer360Modal(btn.dataset.adminCustId);
      });
    });

    document.querySelectorAll('.data-admin-edit-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = Number(btn.dataset.adminEditUserId);
        showToast('در حال دریافت اطلاعات کاربر...', 'info');
        const res = await api('admin_get_user', { user_id: uid });
        if (res && res.ok && res.user) {
          openAdminEditUserModal(res.user);
        } else {
          openAdminEditUserModal({ id: uid });
        }
      });
    });
  }

  function bindAdminProductsTabEvents(products, categories) {
    $('btn-add-product')?.addEventListener('click', () => openAddProductModal(categories));

    document.querySelectorAll('[data-admin-edit-pid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = Number(btn.dataset.adminEditPid);
        const p = (products || []).find(x => Number(x.id) === pid);
        if (p) openAddProductModal(categories, p);
      });
    });

    document.querySelectorAll('[data-admin-toggle-pid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.adminTogglePid;
        const res = await api('admin_toggle_product', {}, 'POST', { product_id: pid });
        if (res && res.ok) {
          showToast('وضعیت محصول بروزرسانی شد', 'success');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در تغییر وضعیت محصول.', 'error');
        }
      });
    });

    document.querySelectorAll('[data-admin-delete-pid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('آیا از غیرفعال‌سازی این محصول اطمینان دارید؟')) return;
        const pid = btn.dataset.adminDeletePid;
        const res = await api('admin_delete_product', {}, 'POST', { product_id: pid });
        if (res && res.ok) {
          showToast('محصول غیرفعال شد', 'info');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در حذف محصول.', 'error');
        }
      });
    });
  }


  function bindAdminCategoriesTabEvents(categories) {
    $('btn-add-category')?.addEventListener('click', () => openAddCategoryModal());

    document.querySelectorAll('[data-admin-edit-cid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cid = Number(btn.dataset.adminEditCid);
        const c = categories.find(x => Number(x.id) === cid);
        if (c) openAddCategoryModal(c);
      });
    });

    document.querySelectorAll('[data-admin-delete-cid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('آیا از غیرفعال‌سازی این دسته‌بندی اطمینان دارید؟')) return;
        const cid = btn.dataset.adminDeleteCid;
        const res = await api('admin_delete_category', {}, 'POST', { category_id: cid });
        if (res && res.ok) {
          showToast('دسته‌بندی غیرفعال شد', 'info');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در حذف دسته‌بندی.', 'error');
        }
      });
    });
  }

  function bindAdminVariantsTabEvents(variants, products) {
    $('btn-add-variant')?.addEventListener('click', () => openAddVariantModal(products));

    document.querySelectorAll('[data-admin-edit-vid]').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid = Number(btn.dataset.adminEditVid);
        const v = variants.find(x => Number(x.id) === vid);
        if (v) openAddVariantModal(products, v);
      });
    });

    document.querySelectorAll('[data-admin-delete-vid]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('آیا از غیرفعال‌سازی این پلن اطمینان دارید؟')) return;
        const vid = btn.dataset.adminDeleteVid;
        const res = await api('admin_delete_variant', {}, 'POST', { variant_id: vid });
        if (res && res.ok) {
          showToast('پلن غیرفعال شد', 'info');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در حذف پلن.', 'error');
        }
      });
    });
  }

  function bindAdminWithdrawalsTabEvents(withdrawals) {
    document.querySelectorAll('[data-admin-withdraw-act]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const [wid, act] = btn.dataset.adminWithdrawAct.split(':');
        const res = await api('admin_withdraw_action', {}, 'POST', { withdrawal_id: wid, action_type: act });
        if (res && res.ok) {
          showToast(act === 'paid' ? 'برداشت تایید و پرداخت شد' : 'برداشت رد شد', 'success');
          renderAdminView($('app'));
        } else {
          showToast(res ? res.message : 'خطا در ثبت اقدام برداشت.', 'error');
        }
      });
    });
  }

  let webSettingsSubTab = 'general';
  let webAdminCards = [];
  let webAdminWallets = [];
  let webAdminRates = [];
  let webAdminSpinRewards = [];

  function parseWebCardAccounts(raw) {
    if (Array.isArray(raw) && raw.length) return raw;
    const str = String(raw || '').trim();
    if (!str || str.startsWith('[object')) return [];
    try {
      const j = JSON.parse(str);
      if (Array.isArray(j)) return j;
    } catch (e) {}
    return str.split(/\r?\n/).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { title: parts[0] || 'کارت بانکی', card: parts[1] || '', owner: parts[2] || '', sheba: parts[3] || '' };
    }).filter(c => c.card || c.owner || c.sheba);
  }

  function parseWebCryptoWallets(raw) {
    if (Array.isArray(raw) && raw.length) return raw;
    const str = String(raw || '').trim();
    if (!str || str.startsWith('[object')) return [];
    try {
      const j = JSON.parse(str);
      if (Array.isArray(j)) return j;
    } catch (e) {}
    return str.split(/\r?\n/).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { asset: parts[0] || 'USDT', network: parts[1] || 'TRC20', address: parts[2] || '', title: parts[3] || '', rate_symbol: parts[4] || parts[0] || 'USDT', is_active: parts[5] ?? '1' };
    }).filter(w => w.address);
  }

  function parseWebCryptoRates(raw) {
    if (Array.isArray(raw) && raw.length) return raw;
    const str = String(raw || '').trim();
    if (!str || str.startsWith('[object')) return [];
    try {
      const j = JSON.parse(str);
      if (Array.isArray(j)) return j;
    } catch (e) {}
    return str.split(/\r?\n/).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return { asset: (parts[0] || 'USDT').toUpperCase(), rate_toman: Number(parts[1] || 0) };
    }).filter(r => r.asset && r.rate_toman > 0);
  }

  function parseWebSpinRewards(raw) {
    if (Array.isArray(raw) && raw.length) return raw;
    const str = String(raw || '').trim();
    if (!str || str.startsWith('[object')) return [];
    try {
      const j = JSON.parse(str);
      if (Array.isArray(j)) return j;
    } catch (e) {}
    return str.split(/\r?\n/).map(line => {
      const parts = line.split('|').map(s => s.trim());
      return {
        title: parts[0] || 'پاداش',
        amount: Number(parts[1] || 0),
        weight: Number(parts[2] || 10),
        notify_admin: parts[3] === '1' || parts[3] === 'true'
      };
    }).filter(r => r.title);
  }

  function cryptoRateCacheText(settings) {
    const cache = settings.crypto_rate_cache || {};
    const rows = Object.entries(cache);
    const lastRes = settings.crypto_rate_last_result || {};
    let lines = [];
    if (rows.length > 0) {
      lines = rows.map(([symbol, info]) => {
        const r = typeof info === 'object' ? info.rate : info;
        const src = typeof info === 'object' ? (info.source || info.provider || 'Live') : 'Live';
        const time = typeof info === 'object' ? (info.updated_at || '') : '';
        return `📈 1 ${symbol.toUpperCase()} = ${nf(r)} تومان · منبع: ${src}${time ? ' (' + time + ')' : ''}`;
      });
    } else {
      lines.push('⚠️ هنوز نرخ آنلاین از صرافی‌های والکس/رمزینکس/نوبیتکس کش نشده است.');
    }
    if (lastRes.providers && lastRes.providers.length) {
      lines.push(`🔍 اولویت صرافی‌ها: ${lastRes.providers.join(' ← ')}`);
    }
    return lines.join('\n');
  }

  function initSettingsStateFromObj(settings) {
    webAdminCards = parseWebCardAccounts(settings.card_accounts || settings.card_accounts_text);
    webAdminWallets = parseWebCryptoWallets(settings.crypto_wallets || settings.crypto_wallets_text);
    webAdminRates = parseWebCryptoRates(settings.crypto_manual_rates || settings.crypto_manual_rates_text);
    webAdminSpinRewards = parseWebSpinRewards(settings.spin_rewards || settings.spin_rewards_text);
  }

  function renderAdminSettingsTabMarkup(settings) {
    initSettingsStateFromObj(settings);
    const pm = settings.payment_methods_enabled || {};
    const starsActive = pm.stars === true || pm.stars === 1 || pm.stars === '1';
    const cryptoActive = pm.crypto === true || pm.crypto === 1 || pm.crypto === '1';
    const walletActive = pm.wallet !== false && pm.wallet !== 0 && pm.wallet !== '0';
    const cardActive = pm.card !== false && pm.card !== 0 && pm.card !== '0';

    const isGen = webSettingsSubTab === 'general';
    const isPay = webSettingsSubTab === 'payments';
    const isCry = webSettingsSubTab === 'crypto';
    const isApp = webSettingsSubTab === 'appearance';
    const isGam = webSettingsSubTab === 'gamification';

    return `
      <div style="max-width:840px; margin:0 auto;">
        <!-- Sub-Tab Navigation Bar -->
        <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:12px; margin-bottom:20px; border-bottom:1px solid var(--border-color);">
          <button type="button" class="nav-link ${isGen ? 'active' : ''}" data-set-subtab="general" style="border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; background:${isGen ? 'var(--cyan)' : 'var(--card-dark)'}; color:${isGen ? '#000' : 'var(--text-muted)'}; border:1px solid var(--border-color);">🏪 عمومی</button>
          <button type="button" class="nav-link ${isPay ? 'active' : ''}" data-set-subtab="payments" style="border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; background:${isPay ? 'var(--cyan)' : 'var(--card-dark)'}; color:${isPay ? '#000' : 'var(--text-muted)'}; border:1px solid var(--border-color);">💳 کارت &amp; درگاه</button>
          <button type="button" class="nav-link ${isCry ? 'active' : ''}" data-set-subtab="crypto" style="border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; background:${isCry ? 'var(--cyan)' : 'var(--card-dark)'}; color:${isCry ? '#000' : 'var(--text-muted)'}; border:1px solid var(--border-color);">🪙 مدیریت رمزارز</button>
          <button type="button" class="nav-link ${isApp ? 'active' : ''}" data-set-subtab="appearance" style="border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; background:${isApp ? 'var(--cyan)' : 'var(--card-dark)'}; color:${isApp ? '#000' : 'var(--text-muted)'}; border:1px solid var(--border-color);">🎨 رنگ &amp; ظاهر</button>
          <button type="button" class="nav-link ${isGam ? 'active' : ''}" data-set-subtab="gamification" style="border-radius:12px; padding:10px 16px; font-weight:700; font-size:13px; background:${isGam ? 'var(--cyan)' : 'var(--card-dark)'}; color:${isGam ? '#000' : 'var(--text-muted)'}; border:1px solid var(--border-color);">🎡 پاداش &amp; گردونه</button>
        </div>

        <form id="admin-settings-form">
          <!-- PANE 1: GENERAL -->
          <div style="display:${isGen ? 'block' : 'none'};">
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <h3 style="font-size:16px; font-weight:800; margin:0 0 16px 0; color:#fff;">🏪 هویت و تنظیمات عمومی</h3>
              
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">نام برند (Brand Name):</label>
                  <input type="text" id="set-brand-name" value="${esc(settings.brand_name || 'BlueGate')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">یوزرنیم پشتیبانی تلگرام:</label>
                  <input type="text" id="set-support-username" value="${esc(settings.support_username || 'BlueGateSupport')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">حداقل مبلغ برداشت (تومان):</label>
                  <input type="number" id="set-min-withdraw" value="${settings.min_withdraw || 50000}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">پاداش عضویت اولیه (تومان):</label>
                  <input type="number" id="set-start-reward" value="${settings.start_reward || 2000}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">کلید API ایمیل (Resend API Key):</label>
                  <input type="password" id="set-resend-key" value="${esc(settings.resend_api_key || '')}" placeholder="re_..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">ایمیل فرستنده سیستم:</label>
                  <input type="email" id="set-resend-email" value="${esc(settings.resend_from_email || 'onboarding@resend.dev')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>
            </div>

            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <h3 style="font-size:16px; font-weight:800; margin:0 0 6px 0; color:#fff;">🛍️ Storefront V9</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:0 0 16px 0; line-height:1.8;">تنظیمات صفحه فروش اصلی BlueGate. قیمت و بازه Stars از همین بخش مستقیماً روی Storefront اعمال می‌شود.</p>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">زیرعنوان برند:</label>
                  <input type="text" id="set-storefront-subtitle" value="${esc(settings.storefront_brand_subtitle || 'Digital Services')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">تیتر Hero:</label>
                  <input type="text" id="set-storefront-hero-title" value="${esc(settings.storefront_hero_title || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>

              <div style="margin-bottom:16px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">متن Hero:</label>
                <textarea id="set-storefront-hero-text" rows="2" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; font-family:inherit; direction:rtl; text-align:right;">${esc(settings.storefront_hero_text || '')}</textarea>
              </div>

              <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
                <input type="checkbox" id="set-storefront-announcement-enabled" ${settings.storefront_announcement_enabled !== false && settings.storefront_announcement_enabled !== 0 && settings.storefront_announcement_enabled !== '0' ? 'checked' : ''}>
                <label for="set-storefront-announcement-enabled" style="font-size:13px; font-weight:700;">نمایش نوار اطلاع‌رسانی فروشگاه</label>
              </div>
              <div style="margin-bottom:18px;">
                <input type="text" id="set-storefront-announcement-text" value="${esc(settings.storefront_announcement_text || '')}" placeholder="متن اطلاع‌رسانی" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
              </div>

              <div style="border-top:1px solid var(--border-color); padding-top:16px;">
                <div style="font-size:13px; font-weight:800; margin-bottom:12px;">⭐ قیمت‌گذاری Telegram Stars</div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
                  <div>
                    <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">مبنای قیمت</label>
                    <select id="set-storefront-stars-basis" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                      <option value="toman" ${settings.storefront_stars_price_basis !== 'usdt' ? 'selected' : ''}>تومان / Star</option>
                      <option value="usdt" ${settings.storefront_stars_price_basis === 'usdt' ? 'selected' : ''}>USDT / Star</option>
                    </select>
                  </div>
                  <div>
                    <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">فروش هر Star (تومان)</label>
                    <input type="number" step="0.01" id="set-storefront-star-toman" value="${Number(settings.storefront_star_sell_per_unit_toman || 3456)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                  </div>
                  <div>
                    <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">فروش هر Star (USDT)</label>
                    <input type="number" step="0.000001" id="set-storefront-star-usdt" value="${Number(settings.storefront_star_sell_per_unit_usdt || 0.018)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                  </div>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px;">
                  <div><label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">حداقل</label><input type="number" id="set-storefront-stars-min" value="${Number(settings.storefront_stars_min || 50)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;"></div>
                  <div><label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">حداکثر</label><input type="number" id="set-storefront-stars-max" value="${Number(settings.storefront_stars_max || 10000)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;"></div>
                  <div><label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">گام Slider</label><input type="number" id="set-storefront-stars-step" value="${Number(settings.storefront_stars_step || 25)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;"></div>
                </div>
                <div>
                  <label style="display:block; font-size:11px; color:var(--text-muted); margin-bottom:5px;">Presetها — با کاما جدا کن</label>
                  <input type="text" id="set-storefront-stars-presets" value="${esc(Array.isArray(settings.storefront_stars_presets) ? settings.storefront_stars_presets.join(', ') : (settings.storefront_stars_presets || '100, 500, 1000, 2500, 5000'))}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; direction:ltr; text-align:left;">
                </div>
              </div>
            </div>
          </div>

          <!-- PANE 2: PAYMENTS & CARDS -->
          <div style="display:${isPay ? 'block' : 'none'};">
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <h3 style="font-size:16px; font-weight:800; margin:0 0 16px 0; color:#fff;">💳 روش‌های فعال پرداخت</h3>
              
              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:12px; padding:12px; cursor:pointer;">
                  <input type="checkbox" id="set-pay-wallet" ${walletActive ? 'checked' : ''}>
                  <span style="font-size:13px; font-weight:700;">💳 کیف پول داخلی</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:12px; padding:12px; cursor:pointer;">
                  <input type="checkbox" id="set-pay-card" ${cardActive ? 'checked' : ''}>
                  <span style="font-size:13px; font-weight:700;">💳 کارت به کارت</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:12px; padding:12px; cursor:pointer;">
                  <input type="checkbox" id="set-pay-stars" ${starsActive ? 'checked' : ''}>
                  <span style="font-size:13px; font-weight:700;">⭐️ Telegram Stars</span>
                </label>
                <label style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:12px; padding:12px; cursor:pointer;">
                  <input type="checkbox" id="set-pay-crypto" ${cryptoActive ? 'checked' : ''}>
                  <span style="font-size:13px; font-weight:700;">🪙 رمزارز (Crypto)</span>
                </label>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">ارزش هر Telegram Star به تومان:</label>
                  <input type="number" id="set-stars-rate" value="${settings.stars_rate_toman || 3200}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>

              <div style="margin-bottom:20px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">راهنما و دستورالعمل عمومی پرداخت:</label>
                <textarea id="set-payment-instructions" rows="3" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; font-family:inherit; direction:rtl; text-align:right;">${esc(settings.payment_instructions || '')}</textarea>
              </div>
            </div>

            <!-- Bank Cards Builder List -->
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                  <h3 style="font-size:16px; font-weight:800; margin:0; color:#fff;">💳 مدیریت حساب‌های کارت به کارت (${webAdminCards.length})</h3>
                  <small style="color:var(--text-muted);">کارت‌های بانکی برای واریز مستقیم کاربران</small>
                </div>
                <button type="button" class="user-account-btn" id="btn-add-bank-card" style="background:var(--cyan); color:#000; font-size:12px; padding:8px 14px;">➕ افزودن کارت جدید</button>
              </div>

              <div id="web-cards-builder-list" style="display:flex; flex-direction:column; gap:10px;">
                ${!webAdminCards.length ? `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px;">هیچ کارتی ثبت نشده است.</p>` : webAdminCards.map((c, idx) => `
                  <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                      <b style="font-size:14px; color:#fff;">${esc(c.title || 'کارت بانکی')}</b>
                      <code style="display:block; direction:ltr; text-align:left; font-size:14px; color:var(--cyan); margin-top:4px;">${esc(c.card || '')}</code>
                      <small style="color:var(--text-muted); font-size:12px;">صاحب کارت: ${esc(c.owner || 'نامشخص')}${c.sheba ? ` · شبا: ${esc(c.sheba)}` : ''}</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                      <button type="button" class="user-account-btn" data-edit-card-idx="${idx}" style="background:rgba(255,255,255,0.1); color:#fff; font-size:11px; padding:6px 12px;">✏️ ویرایش</button>
                      <button type="button" class="user-account-btn" data-del-card-idx="${idx}" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:11px; padding:6px 12px;">🗑️ حذف</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- PANE 3: CRYPTO MANAGER -->
          <div style="display:${isCry ? 'block' : 'none'};">
            <!-- Live Crypto Price Log Box -->
            <div style="background:rgba(29,155,240,0.06); border:1px solid rgba(29,155,240,0.3); border-radius:20px; padding:20px; margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="font-size:15px; font-weight:800; margin:0; color:var(--cyan);">📊 وضعیت نرخ آنلاین صرافی‌ها (Live Crypto Rates Log)</h3>
                <button type="button" class="user-account-btn" id="btn-refresh-rates-live" style="background:var(--cyan); color:#000; font-size:11px; padding:6px 12px;">🔄 رفرش فوری نرخ‌ها</button>
              </div>
              <pre style="background:rgba(0,0,0,0.3); border:1px solid var(--border-color); border-radius:12px; padding:12px; color:var(--text-color); font-size:12px; font-family:monospace; white-space:pre-wrap; margin:0; direction:rtl; text-align:right;">${esc(cryptoRateCacheText(settings))}</pre>
            </div>

            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <h3 style="font-size:16px; font-weight:800; margin:0 0 16px 0; color:#fff;">🪙 تنظیمات منبع نرخ رمزارز</h3>
              
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">منبع دریافت نرخ live:</label>
                  <select id="set-crypto-source" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                    <option value="auto" ${settings.crypto_rate_source === 'auto' || !settings.crypto_rate_source ? 'selected' : ''}>خودکار (Wallex → Ramzinex → Nobitex)</option>
                    <option value="wallex" ${settings.crypto_rate_source === 'wallex' ? 'selected' : ''}>والکس (Wallex)</option>
                    <option value="ramzinex" ${settings.crypto_rate_source === 'ramzinex' ? 'selected' : ''}>رمزینکس (Ramzinex)</option>
                    <option value="nobitex" ${settings.crypto_rate_source === 'nobitex' ? 'selected' : ''}>نوبیتکس (Nobitex)</option>
                    <option value="manual" ${settings.crypto_rate_source === 'manual' ? 'selected' : ''}>فقط نرخ دستی (Manual)</option>
                  </select>
                </div>
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">درصد احتیاط (Markup %):</label>
                  <input type="number" step="0.1" id="set-crypto-markup" value="${settings.crypto_rate_markup_percent || 1}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                </div>
              </div>
            </div>

            <!-- Crypto Wallets Builder List -->
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                  <h3 style="font-size:16px; font-weight:800; margin:0; color:#fff;">👛 کیف پول‌های دریافت رمزارز (${webAdminWallets.length})</h3>
                  <small style="color:var(--text-muted);">آدرس‌های ولت جهت دریافت USDT, TRX, TON</small>
                </div>
                <button type="button" class="user-account-btn" id="btn-add-crypto-wallet" style="background:var(--cyan); color:#000; font-size:12px; padding:8px 14px;">➕ افزودن ولت رمزارز</button>
              </div>

              <div id="web-wallets-builder-list" style="display:flex; flex-direction:column; gap:10px;">
                ${!webAdminWallets.length ? `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px;">هیچ کیف پول رمزارزی ثبت نشده است.</p>` : webAdminWallets.map((w, idx) => `
                  <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                    <div>
                      <b style="font-size:14px; color:#fff;">${esc(w.title || w.asset || 'کیف پول')}</b>
                      <span style="font-size:11px; padding:2px 8px; border-radius:6px; background:rgba(29,155,240,0.2); color:var(--cyan); margin-right:6px;">${esc(w.asset || 'USDT')} · ${esc(w.network || 'TRC20')}</span>
                      <code style="display:block; direction:ltr; text-align:left; font-size:12px; color:var(--text-muted); margin-top:4px; word-break:break-all;">${esc(w.address || '')}</code>
                    </div>
                    <div style="display:flex; gap:8px;">
                      <button type="button" class="user-account-btn" data-edit-wallet-idx="${idx}" style="background:rgba(255,255,255,0.1); color:#fff; font-size:11px; padding:6px 12px;">✏️ ویرایش</button>
                      <button type="button" class="user-account-btn" data-del-wallet-idx="${idx}" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:11px; padding:6px 12px;">🗑️ حذف</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Manual Rates Builder List -->
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                  <h3 style="font-size:16px; font-weight:800; margin:0; color:#fff;">📈 نرخ دستی رمزارزها (${webAdminRates.length})</h3>
                  <small style="color:var(--text-muted);">در صورت قطعی صرافی‌های آنلاین استفاده می‌شود</small>
                </div>
                <button type="button" class="user-account-btn" id="btn-add-crypto-rate" style="background:rgba(255,255,255,0.1); color:#fff; font-size:12px; padding:8px 14px;">➕ افزودن نرخ دستی</button>
              </div>

              <div id="web-rates-builder-list" style="display:flex; flex-direction:column; gap:8px;">
                ${!webAdminRates.length ? `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:12px;">نرخ دستی تعیین نشده است.</p>` : webAdminRates.map((r, idx) => `
                  <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:10px; padding:10px 14px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <b style="color:var(--cyan); font-size:13px;">1 ${esc((r.asset || 'USDT').toUpperCase())}</b> = 
                      <b style="color:#fff; font-size:13px;">${priceLabel(r.rate_toman || 0)}</b>
                    </div>
                    <button type="button" class="user-account-btn" data-del-rate-idx="${idx}" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:11px; padding:4px 8px;">🗑️ حذف</button>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- PANE 4: APPEARANCE -->
          <div style="display:${isApp ? 'block' : 'none'};">
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <h3 style="font-size:16px; font-weight:800; margin:0 0 16px 0; color:#fff;">🎨 رنگ و تم ظاهری</h3>
              
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div>
                  <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">رنگ اصلی تم (Theme Color):</label>
                  <input type="color" id="set-theme-color" value="${esc(settings.theme_color || '#1d9bf0')}" style="width:100%; height:42px; border:0; background:transparent; cursor:pointer;">
                </div>
              </div>
            </div>
          </div>

          <!-- PANE 5: GAMIFICATION & SPIN REWARDS BUILDER -->
          <div style="display:${isGam ? 'block' : 'none'};">
            <div style="background:var(--card-dark); border:1px solid var(--border-color); border-radius:20px; padding:20px; margin-bottom:20px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                <div>
                  <h3 style="font-size:16px; font-weight:800; margin:0; color:#fff;">🎡 مدیریت پاداش‌های گردونه شانس (${webAdminSpinRewards.length})</h3>
                  <small style="color:var(--text-muted);">تعریف جوایز، شانس احتمال و اعلان ادمین</small>
                </div>
                <button type="button" class="user-account-btn" id="btn-add-spin-reward" style="background:var(--cyan); color:#000; font-size:12px; padding:8px 14px;">➕ افزودن جایزه جدید</button>
              </div>

              <div style="margin-bottom:20px;">
                <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">تعداد زیرمجموعه برای دریافت ۱ شانس گردونه:</label>
                <input type="number" id="set-spin-every" value="${settings.spin_referrals_per_chance || 5}" style="width:100%; max-width:240px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
              </div>

              <!-- Visual Spin Rewards Grid -->
              <div id="web-spin-rewards-builder-list" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
                ${!webAdminSpinRewards.length ? `<p style="color:var(--text-muted); font-size:13px; text-align:center; padding:16px; grid-column:1/-1;">هیچ جایزه‌ای برای گردونه ثبت نشده است.</p>` : webAdminSpinRewards.map((sr, idx) => `
                  <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                    <div>
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <b style="font-size:14px; color:#fff;">${esc(sr.title)}</b>
                        ${sr.notify_admin ? `<span style="font-size:10px; padding:2px 6px; border-radius:6px; background:rgba(245,158,11,0.2); color:#f59e0b;">🔔 اعلان ادمین</span>` : ''}
                      </div>
                      <div style="font-size:13px; color:var(--cyan); margin-top:6px;">
                        💰 مبلغ: <b>${sr.amount > 0 ? priceLabel(sr.amount) : 'بدون مبلغ (پاداش غیرنقدی)'}</b>
                      </div>
                      <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
                        🎲 وزن شانس: <b>${sr.weight}</b>
                      </div>
                    </div>
                    <div style="display:flex; gap:6px; justify-content:flex-end;">
                      <button type="button" class="user-account-btn" data-edit-spin-idx="${idx}" style="background:rgba(255,255,255,0.1); color:#fff; font-size:11px; padding:4px 10px;">✏️ ویرایش</button>
                      <button type="button" class="user-account-btn" data-del-spin-idx="${idx}" style="background:rgba(239,68,68,0.2); color:#ef4444; font-size:11px; padding:4px 10px;">🗑️ حذف</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000; font-weight:800; padding:14px; font-size:15px; border-radius:14px; margin-top:10px;">💾 ذخیره تمامی تنظیمات</button>
        </form>
      </div>
    `;
  }

  function openWebCardBuilderModal(settings, index = null) {
    const card = index === null ? {} : (webAdminCards[index] || {});
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">${index === null ? '➕ افزودن کارت بانکی جدید' : '✏️ ویرایش کارت بانکی'}</h3>
          <button class="ghost" id="modal-close-btn" style="border:0; background:transparent; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="card-builder-form">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">عنوان کارت:</label>
            <input type="text" id="cb-title" value="${esc(card.title || '')}" placeholder="مثلاً کارت اصلی متصل به حساب" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">شماره کارت (۱۶ رقمی):</label>
            <input type="text" id="cb-card" value="${esc(card.card || '')}" placeholder="6037..." required style="width:100%; direction:ltr; text-align:left; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام صاحب کارت:</label>
            <input type="text" id="cb-owner" value="${esc(card.owner || '')}" placeholder="نام و نام خانوادگی" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">شماره شبا (اختیاری):</label>
            <input type="text" id="cb-sheba" value="${esc(card.sheba || '')}" placeholder="IR..." style="width:100%; direction:ltr; text-align:left; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000; font-weight:800; padding:12px;">💾 ذخیره کارت</button>
        </form>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeModal = () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (document.body) {
        document.body.style.overflow = '';
        document.body.classList.remove('has-open-popup');
      }
    };

    $('modal-close-btn')?.addEventListener('click', closeModal);
    $('card-builder-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const obj = {
        title: $('cb-title').value.trim(),
        card: $('cb-card').value.trim(),
        owner: $('cb-owner').value.trim(),
        sheba: $('cb-sheba').value.trim()
      };
      if (index === null) webAdminCards.push(obj);
      else webAdminCards[index] = obj;
      closeModal();
      refreshSettingsPane(settings);
    });
  }

  function openWebWalletBuilderModal(settings, index = null) {
    const w = index === null ? { network: 'TRC20', asset: 'USDT' } : (webAdminWallets[index] || {});
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">${index === null ? '➕ افزودن ولت رمزارز جدید' : '✏️ ویرایش ولت رمزارز'}</h3>
          <button class="ghost" id="modal-close-btn" style="border:0; background:transparent; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="wallet-builder-form">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">ارز رمزنگاری:</label>
            <select id="wb-asset" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
              <option value="USDT" ${w.asset === 'USDT' ? 'selected' : ''}>USDT (تتر)</option>
              <option value="TRX" ${w.asset === 'TRX' ? 'selected' : ''}>TRX (ترون)</option>
              <option value="TON" ${w.asset === 'TON' ? 'selected' : ''}>TON (تن کوین)</option>
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">عنوان ولت:</label>
            <input type="text" id="wb-title" value="${esc(w.title || '')}" placeholder="مثلاً کیف پول اختصاصی تتر" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">شبکه کیف پول:</label>
            <select id="wb-network" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
              <option value="TRC20" ${w.network === 'TRC20' ? 'selected' : ''}>TRC20 (TRON Network)</option>
              <option value="TON" ${w.network === 'TON' ? 'selected' : ''}>TON Network</option>
              <option value="BEP20" ${w.network === 'BEP20' ? 'selected' : ''}>BEP20 (BNB Smart Chain)</option>
              <option value="ERC20" ${w.network === 'ERC20' ? 'selected' : ''}>ERC20 (Ethereum)</option>
            </select>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">آدرس ولت:</label>
            <textarea id="wb-address" rows="3" placeholder="آدرس کیف پول" required style="width:100%; direction:ltr; text-align:left; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px; font-family:monospace;">${esc(w.address || '')}</textarea>
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000; font-weight:800; padding:12px;">💾 ذخیره کیف پول</button>
        </form>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeModal = () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (document.body) {
        document.body.style.overflow = '';
        document.body.classList.remove('has-open-popup');
      }
    };

    $('modal-close-btn')?.addEventListener('click', closeModal);
    $('wallet-builder-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const obj = {
        asset: $('wb-asset').value,
        title: $('wb-title').value.trim(),
        network: $('wb-network').value,
        address: $('wb-address').value.trim(),
        rate_symbol: $('wb-asset').value,
        is_active: '1'
      };
      if (index === null) webAdminWallets.push(obj);
      else webAdminWallets[index] = obj;
      closeModal();
      refreshSettingsPane(settings);
    });
  }

  function openWebRateBuilderModal(settings) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:400px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">➕ افزودن نرخ دستی رمزارز</h3>
          <button class="ghost" id="modal-close-btn" style="border:0; background:transparent; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="rate-builder-form">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نماد ارز (Symbol):</label>
            <input type="text" id="rb-asset" value="USDT" placeholder="USDT" required style="width:100%; direction:ltr; text-align:left; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">قیمت به تومان:</label>
            <input type="number" id="rb-rate" placeholder="95000" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000; font-weight:800; padding:12px;">💾 ذخیره نرخ</button>
        </form>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeModal = () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (document.body) {
        document.body.style.overflow = '';
        document.body.classList.remove('has-open-popup');
      }
    };

    $('modal-close-btn')?.addEventListener('click', closeModal);
    $('rate-builder-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const obj = {
        asset: $('rb-asset').value.trim().toUpperCase(),
        rate_toman: Number($('rb-rate').value)
      };
      webAdminRates.push(obj);
      closeModal();
      refreshSettingsPane(settings);
    });
  }

  function openWebSpinRewardModal(settings, index = null) {
    const sr = index === null ? {} : (webAdminSpinRewards[index] || {});
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-size:16px; font-weight:800; margin:0;">${index === null ? '🎁 افزودن جایزه گردونه جدید' : '✏️ ویرایش جایزه گردونه'}</h3>
          <button class="ghost" id="modal-close-btn" style="border:0; background:transparent; color:#fff; font-size:18px; cursor:pointer;">✕</button>
        </div>
        <form id="spin-reward-form">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">عنوان جایزه:</label>
            <input type="text" id="sr-title" value="${esc(sr.title || '')}" placeholder="مثلاً ۵,۰۰۰ تومان اعتبار کیف پول" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">مبلغ اعتبار کیف پول (تومان):</label>
            <input type="number" id="sr-amount" value="${sr.amount || 0}" placeholder="5000" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            <small style="color:var(--text-muted); font-size:11px;">عدد ۰ یعنی جایزه غیرنقدی است و کیف پول شارژ نمی‌شود.</small>
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">وزن شانس (Probability Weight):</label>
            <input type="number" id="sr-weight" value="${sr.weight || 10}" placeholder="10" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            <small style="color:var(--text-muted); font-size:11px;">هرچه این عدد بالاتر باشد، احتمال برنده شدن این جایزه بیشتر است.</small>
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
              <input type="checkbox" id="sr-notify" ${sr.notify_admin ? 'checked' : ''}>
              <span style="font-size:13px; font-weight:700; color:#fff;">🔔 ارسال پیام به ادمین هنگام برنده شدن</span>
            </label>
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000; font-weight:800; padding:12px;">💾 ذخیره جایزه</button>
        </form>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const closeModal = () => {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
      if (document.body) {
        document.body.style.overflow = '';
        document.body.classList.remove('has-open-popup');
      }
    };

    $('modal-close-btn')?.addEventListener('click', closeModal);
    $('spin-reward-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const obj = {
        title: $('sr-title').value.trim(),
        amount: Number($('sr-amount').value || 0),
        weight: Number($('sr-weight').value || 1),
        notify_admin: $('sr-notify').checked
      };
      if (index === null) webAdminSpinRewards.push(obj);
      else webAdminSpinRewards[index] = obj;
      closeModal();
      refreshSettingsPane(settings);
    });
  }

  function refreshSettingsPane(settings) {
    const subContent = $('admin-sub-content');
    if (subContent) {
      subContent.innerHTML = renderAdminSettingsTabMarkup(settings || window.currentAdminSettings || {});
      bindAdminSettingsTabEvents(settings || window.currentAdminSettings || {});
    } else {
      renderAdminView($('app'));
    }
  }

  function bindAdminSettingsTabEvents(settings) {
    window.currentAdminSettings = settings;

    // Sub-tab switching
    document.querySelectorAll('[data-set-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        webSettingsSubTab = btn.dataset.setSubtab;
        refreshSettingsPane(settings);
      });
    });

    // Cards builder handlers
    $('btn-add-bank-card')?.addEventListener('click', () => openWebCardBuilderModal(settings));
    document.querySelectorAll('[data-edit-card-idx]').forEach(btn => {
      btn.addEventListener('click', () => openWebCardBuilderModal(settings, Number(btn.dataset.editCardIdx)));
    });
    document.querySelectorAll('[data-del-card-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        webAdminCards.splice(Number(btn.dataset.delCardIdx), 1);
        refreshSettingsPane(settings);
      });
    });

    // Crypto Wallets builder handlers
    $('btn-add-crypto-wallet')?.addEventListener('click', () => openWebWalletBuilderModal(settings));
    document.querySelectorAll('[data-edit-wallet-idx]').forEach(btn => {
      btn.addEventListener('click', () => openWebWalletBuilderModal(settings, Number(btn.dataset.editWalletIdx)));
    });
    document.querySelectorAll('[data-del-wallet-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        webAdminWallets.splice(Number(btn.dataset.delWalletIdx), 1);
        refreshSettingsPane(settings);
      });
    });

    // Crypto Rates builder handlers & live refresh button
    $('btn-add-crypto-rate')?.addEventListener('click', () => openWebRateBuilderModal(settings));
    document.querySelectorAll('[data-del-rate-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        webAdminRates.splice(Number(btn.dataset.delRateIdx), 1);
        refreshSettingsPane(settings);
      });
    });

    $('btn-refresh-rates-live')?.addEventListener('click', async () => {
      showToast('در حال دریافت آخرین نرخ‌های آنلاین...', 'info');
      const rateRes = await api('admin_refresh_crypto_rates');
      if (rateRes && rateRes.ok) {
        showToast('نرخ‌ها با موفقیت رفرش شدند! ⚡', 'success');
        renderAdminView($('app'));
      } else {
        showToast(rateRes ? rateRes.message : 'خطا در رفرش نرخ‌ها.', 'error');
      }
    });

    // Spin Rewards builder handlers
    $('btn-add-spin-reward')?.addEventListener('click', () => openWebSpinRewardModal(settings));
    document.querySelectorAll('[data-edit-spin-idx]').forEach(btn => {
      btn.addEventListener('click', () => openWebSpinRewardModal(settings, Number(btn.dataset.editSpinIdx)));
    });
    document.querySelectorAll('[data-del-spin-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        webAdminSpinRewards.splice(Number(btn.dataset.delSpinIdx), 1);
        refreshSettingsPane(settings);
      });
    });

    // Admin settings form submit
    $('admin-settings-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Serialize spin rewards into pipe-separated string lines
      const spinRewardsText = webAdminSpinRewards.map(r => `${r.title}|${r.amount}|${r.weight}|${r.notify_admin ? 1 : 0}`).join('\n');

      const payload = {
        brand_name: $('set-brand-name')?.value.trim() || settings.brand_name || 'BlueGate',
        support_username: $('set-support-username')?.value.trim() || settings.support_username || 'BlueGateSupport',
        min_withdraw: Number($('set-min-withdraw')?.value || settings.min_withdraw || 50000),
        start_reward: Number($('set-start-reward')?.value || settings.start_reward || 2000),
        storefront_brand_subtitle: $('set-storefront-subtitle')?.value.trim() || 'Digital Services',
        storefront_hero_title: $('set-storefront-hero-title')?.value.trim() || '',
        storefront_hero_text: $('set-storefront-hero-text')?.value.trim() || '',
        storefront_announcement_enabled: $('set-storefront-announcement-enabled')?.checked ?? true,
        storefront_announcement_text: $('set-storefront-announcement-text')?.value.trim() || '',
        storefront_stars_price_basis: $('set-storefront-stars-basis')?.value || 'toman',
        storefront_star_sell_per_unit_toman: Number($('set-storefront-star-toman')?.value || 3456),
        storefront_star_sell_per_unit_usdt: Number($('set-storefront-star-usdt')?.value || 0.018),
        storefront_stars_min: Number($('set-storefront-stars-min')?.value || 50),
        storefront_stars_max: Number($('set-storefront-stars-max')?.value || 10000),
        storefront_stars_step: Number($('set-storefront-stars-step')?.value || 25),
        storefront_stars_presets: $('set-storefront-stars-presets')?.value.trim() || '100,500,1000,2500,5000',
        payment_instructions: $('set-payment-instructions')?.value.trim() || '',
        resend_api_key: $('set-resend-key')?.value.trim() || '',
        resend_from_email: $('set-resend-email')?.value.trim() || 'onboarding@resend.dev',
        payment_methods_enabled: {
          wallet: $('set-pay-wallet')?.checked ?? true,
          card: $('set-pay-card')?.checked ?? true,
          stars: $('set-pay-stars')?.checked ?? false,
          crypto: $('set-pay-crypto')?.checked ?? false
        },
        stars_rate_toman: Number($('set-stars-rate')?.value || 3200),
        card_accounts_text: JSON.stringify(webAdminCards),
        crypto_wallets_text: JSON.stringify(webAdminWallets),
        crypto_manual_rates_text: JSON.stringify(webAdminRates),
        crypto_rate_source: $('set-crypto-source')?.value || 'auto',
        crypto_rate_markup_percent: Number($('set-crypto-markup')?.value || 1),
        theme_color: $('set-theme-color')?.value || '#1d9bf0',
        spin_referrals_per_chance: Number($('set-spin-every')?.value || 5),
        spin_rewards_text: spinRewardsText
      };

      const res = await api('admin_save_settings', {}, 'POST', payload);
      if (res && res.ok) {
        showToast('⚙️ تنظیمات با موفقیت ذخیره شد!', 'success');
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ذخیره تنظیمات.', 'error');
      }
    });
  }

  function openAddProductModal(categories, product = null) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:560px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">${product ? '✏️ ویرایش محصول' : '🛒 افزودن محصول جدید'}</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <form id="product-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام محصول:</label>
            <input type="text" id="prod-name" value="${esc(product?.name || '')}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">دسته‌بندی:</label>
              <select id="prod-category" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
                <option value="">بدون دسته‌بندی</option>
                ${categories.map(c => `<option value="${c.id}" ${product && Number(product.category_id) === Number(c.id) ? 'selected' : ''}>${esc(c.emoji || '🛒')} ${esc(c.title)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">قیمت پایه‌ای (تومان):</label>
              <input type="number" id="prod-price" value="${product?.price || 0}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            </div>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">توضیح کوتاه:</label>
            <input type="text" id="prod-short-desc" value="${esc(product?.short_description || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">لینک تصویر:</label>
            <input type="url" id="prod-img" value="${esc(product?.image_url || '')}" placeholder="https://..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000; font-weight:800; padding:12px; margin-top:8px;">${product ? 'ذخیره تغییرات' : 'ایجاد محصول'}</button>
        </form>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('product-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: $('prod-name').value.trim(),
        category_id: $('prod-category').value ? Number($('prod-category').value) : null,
        price: Number($('prod-price').value),
        short_description: $('prod-short-desc').value.trim(),
        image_url: $('prod-img').value.trim()
      };
      if (product) payload.product_id = product.id;
      const action = product ? 'admin_update_product' : 'admin_add_product';
      const res = await api(action, {}, 'POST', payload);
      if (res && res.ok) {
        showToast(product ? 'محصول بروزرسانی شد!' : 'محصول جدید ایجاد شد!', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ثبت اطلاعات.', 'error');
      }
    });
  }

  function openAddCategoryModal(category = null) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:440px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">${category ? '✏️ ویرایش دسته‌بندی' : '📂 افزودن دسته‌بندی جدید'}</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <form id="category-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام دسته:</label>
            <input type="text" id="cat-title" value="${esc(category?.title || '')}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">ایموجی:</label>
              <input type="text" id="cat-emoji" value="${esc(category?.emoji || '🛒')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">ترتیب نمایش:</label>
              <input type="number" id="cat-sort" value="${category?.sort_order || 0}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            </div>
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000; font-weight:800; padding:12px; margin-top:8px;">${category ? 'ذخیره تغییرات' : 'ایجاد دسته'}</button>
        </form>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('category-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: $('cat-title').value.trim(),
        emoji: $('cat-emoji').value.trim(),
        sort_order: Number($('cat-sort').value)
      };
      if (category) payload.category_id = category.id;
      const action = category ? 'admin_update_category' : 'admin_add_category';
      const res = await api(action, {}, 'POST', payload);
      if (res && res.ok) {
        showToast(category ? 'دسته‌بندی بروزرسانی شد!' : 'دسته‌بندی جدید ایجاد شد!', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ثبت دسته.', 'error');
      }
    });
  }

  function openAddVariantModal(products, variant = null) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">${variant ? '✏️ ویرایش پلن / متغیر' : '📐 افزودن پلن جدید'}</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <form id="variant-form" style="display:flex; flex-direction:column; gap:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">محصول مرتبط:</label>
            <select id="var-product" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
              ${products.map(p => `<option value="${p.id}" ${variant && Number(variant.product_id) === Number(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">عنوان پلن (مثلاً 1 ماهه تک کاربره):</label>
            <input type="text" id="var-title" value="${esc(variant?.title || '')}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">قیمت (تومان):</label>
              <input type="number" id="var-price" value="${variant?.price || 0}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            </div>
            <div>
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">مدت زمان (روز):</label>
              <input type="number" id="var-duration" value="${variant?.duration_days || 30}" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
            </div>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">درصد تخفیف (٪):</label>
            <input type="number" id="var-discount" value="${variant?.discount_percent || 0}" min="0" max="100" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:10px;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000; font-weight:800; padding:12px; margin-top:8px;">${variant ? 'ذخیره تغییرات' : 'ایجاد پلن'}</button>
        </form>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);

    $('variant-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        product_id: Number($('var-product').value),
        title: $('var-title').value.trim(),
        price: Number($('var-price').value),
        duration_days: Number($('var-duration').value),
        discount_percent: Number($('var-discount').value)
      };
      if (variant) payload.variant_id = variant.id;
      const action = variant ? 'admin_update_variant' : 'admin_add_variant';
      const res = await api(action, {}, 'POST', payload);
      if (res && res.ok) {
        showToast(variant ? 'پلن بروزرسانی شد!' : 'پلن جدید ایجاد شد!', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ثبت پلن.', 'error');
      }
    });
  }

  function bindAdminInventoryTabEvents(inventory) {
    $('btn-add-inventory')?.addEventListener('click', () => openAddInventoryModal(state.products));
    document.querySelectorAll('[data-delete-inv-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteInvId;
        const res = await api('admin_delete_inventory', {}, 'POST', { inventory_id: id });
        if (res && res.ok) {
          showToast('آیتم از انبار حذف شد', 'info');
          renderAdminView($('app'));
        }
      });
    });
  }

  function bindAdminCouponsTabEvents(coupons) {
    $('btn-add-coupon')?.addEventListener('click', openAddCouponModal);
  }

  /* ── Modals for Admin Actions ── */
  function openBroadcastModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:520px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">📢 ارسال پیام همگانی (Broadcast)</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">
          این متن برای تمام کاربران ربات/سایت ارسال می‌شود:
        </p>
        <textarea id="broadcast-text-input" rows="5" placeholder="متن پیام همگانی به همراه کدهای HTML..." style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; margin-bottom:16px; direction:rtl; text-align:right; font-size:14px;"></textarea>
        <button id="btn-send-broadcast" class="user-account-btn" style="width:100%; justify-content:center; background:#8b5cf6;">🚀 ارسال همگانی به همه کاربران</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-send-broadcast')?.addEventListener('click', async () => {
      const text = $('broadcast-text-input').value.trim();
      if (!text) {
        showToast('لطفاً متن پیام را وارد کنید.', 'error');
        return;
      }
      const res = await api('admin_broadcast', {}, 'POST', { text });
      if (res && res.ok) {
        showToast('📢 پیام همگانی به کاربران ارسال شد!', 'success');
        closeModal();
      } else {
        showToast(res ? res.message : 'خطا در ارسال پیام.', 'error');
      }
    });
  }

  function openPurchaseRewardModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">🎁 اهدا پاداش/شارژ کیف پول کاربر</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">آیدی عددی تلگرام (Telegram ID):</label>
          <input type="number" id="reward-user-tid" placeholder="مثلاً 123456789" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:12px; font-family:inherit; outline:none;">
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">مبلغ پاداش (تومان):</label>
          <input type="number" id="reward-amount" placeholder="مثلاً 50000" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:12px; font-family:inherit; outline:none;">
        </div>
        <button id="btn-submit-reward" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000;">💰 واریز مستقیم به کیف پول کاربر</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-submit-reward')?.addEventListener('click', async () => {
      const tid = Number($('reward-user-tid').value);
      const amount = Number($('reward-amount').value);
      if (!tid || !amount) {
        showToast('لطفاً آیدی کاربر و مبلغ را به درستی وارد کنید.', 'error');
        return;
      }
      const res = await api('admin_add_balance', {}, 'POST', { telegram_id: tid, amount });
      if (res && res.ok) {
        showToast('🎁 پاداش با موفقیت به کیف پول کاربر واریز شد!', 'success');
        closeModal();
      } else {
        showToast(res ? res.message : 'خطا در واریز پاداش.', 'error');
      }
    });
  }

  function openAddCouponModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">🎟 ساخت کد تخفیف جدید</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">کد تخفیف (مثلاً BLUE10)</label>
          <input type="text" id="coupon-code-input" placeholder="BLUE10" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:12px; font-family:inherit; outline:none;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نوع تخفیف</label>
            <select id="coupon-type-select" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
              <option value="percent">درصدی (%)</option>
              <option value="fixed">مبلغ ثابت (تومان)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">مقدار تخفیف</label>
            <input type="number" id="coupon-val-input" placeholder="10" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">حداکثر استفاده (۰ = نامحدود)</label>
          <input type="number" id="coupon-max-input" value="0" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px 14px; border-radius:12px; font-family:inherit; outline:none;">
        </div>
        <button id="btn-submit-coupon" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000;">🎟 ذخیره کد تخفیف جدید</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-submit-coupon')?.addEventListener('click', async () => {
      const code = $('coupon-code-input').value.trim();
      const type = $('coupon-type-select').value;
      const value = Number($('coupon-val-input').value);
      const max_uses = Number($('coupon-max-input').value || 0);
      if (!code || !value) {
        showToast('لطفاً کد تخفیف و مقدار آن را وارد کنید.', 'error');
        return;
      }
      const res = await api('admin_add_coupon', {}, 'POST', { code, type, value, max_uses });
      if (res && res.ok) {
        showToast('🎟 کد تخفیف جدید ساخته شد!', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ثبت کد تخفیف.', 'error');
      }
    });
  }

  function openAddInventoryModal(products = []) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:500px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">📦 شارژ انبار و افزودن کدها/اکانت‌ها</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">انتخاب محصول:</label>
          <select id="inv-product-select" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
            ${(products || []).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">کدها / اطلاعات لایسنس (هر کد در یک خط):</label>
          <textarea id="inv-content-input" rows="5" placeholder="user1:pass1&#10;user2:pass2&#10;license_key_3" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; font-size:13px; direction:ltr; text-align:left;"></textarea>
        </div>
        <button id="btn-submit-inventory" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000;">📦 ذخیره و افزوده شدن به انبار</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-submit-inventory')?.addEventListener('click', async () => {
      const pid = Number($('inv-product-select').value);
      const content = $('inv-content-input').value.trim();
      if (!pid || !content) {
        showToast('لطفاً محصول و حداقل یک کد را وارد کنید.', 'error');
        return;
      }
      const res = await api('admin_add_inventory', {}, 'POST', { product_id: pid, content });
      if (res && res.ok) {
        showToast('📦 انبار با موفقیت شارژ شد!', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ثبت انبار.', 'error');
      }
    });
  }


  /* ── Customer 360 View Modal ── */
  async function openCustomer360Modal(userId) {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:550px; text-align:center;">
        <h3>⏳ در حال بارگذاری اطلاعات کاربر...</h3>
      </div>
    `;
    modalContainer.classList.remove('hidden');

    const res = await api('admin_customer_view', {}, 'POST', { user_id: userId });
    if (!res || !res.ok) {
      showToast('خطا در دریافت پروفایل کاربر', 'error');
      closeModal();
      return;
    }

    const u = res.user || {};
    const stats = res.customer_stats || {};

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:550px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">👤 پروفایل 360 کاربر</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>

        <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px; background:rgba(255,255,255,0.03); padding:16px; border-radius:16px;">
          <div style="width:50px; height:50px; border-radius:50%; background:var(--accent-grad); display:flex; align-items:center; justify-content:center; font-size:24px; color:#000;">👤</div>
          <div>
            <h4 style="font-size:16px; font-weight:800;">${esc(u.first_name || u.username || 'کاربر')}</h4>
            <div style="color:var(--text-muted); font-size:12px;">ID: #${u.id} · ${u.username ? '@' + esc(u.username) : 'بدون یوزرنیم'}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:12px; margin-bottom:20px;">
          <div style="background:var(--card-dark); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
            <small style="color:var(--text-muted); font-size:11px;">موجودی کیف پول</small>
            <b style="display:block; font-size:16px; color:var(--cyan); margin-top:4px;">${priceLabel(u.balance || 0)}</b>
          </div>
          <div style="background:var(--card-dark); border:1px solid var(--border-color); padding:14px; border-radius:14px;">
            <small style="color:var(--text-muted); font-size:11px;">مجموع خریدها</small>
            <b style="display:block; font-size:16px; color:#fff; margin-top:4px;">${priceLabel(res.total_spent || 0)}</b>
          </div>
        </div>
      </div>
    `;

    $('close-modal-btn')?.addEventListener('click', closeModal);
  }

  /* Admin Edit User Modal */
  function openAdminEditUserModal(user) {
    if (!user) return;
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:520px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <h3 style="font-size:18px; font-weight:900;">✏️ ویرایش اطلاعات کاربر #${user.id}</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام:</label>
            <input type="text" id="admin-edit-fname" value="${esc(user.first_name || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام خانوادگی:</label>
            <input type="text" id="admin-edit-lname" value="${esc(user.last_name || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">ایمیل:</label>
            <input type="email" id="admin-edit-email" value="${esc(user.email || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">شماره تماس / موبایل:</label>
            <input type="text" id="admin-edit-phone" value="${esc(user.phone || user.phone_number || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">نام کاربری وب:</label>
            <input type="text" id="admin-edit-web-username" value="${esc(user.web_username || user.username || '')}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
          <div>
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">موجودی کیف پول (تومان):</label>
            <input type="number" id="admin-edit-balance" value="${Number(user.balance || 0)}" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; outline:none;">
          </div>
        </div>

        <button id="btn-submit-admin-edit-user" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000;">💾 ذخیره تغییرات کاربر</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-submit-admin-edit-user')?.addEventListener('click', async () => {
      const first_name = $('admin-edit-fname').value.trim();
      const last_name = $('admin-edit-lname').value.trim();
      const email = $('admin-edit-email').value.trim();
      const phone = $('admin-edit-phone').value.trim();
      const web_username = $('admin-edit-web-username').value.trim();
      const balance = Number($('admin-edit-balance').value || 0);

      const res = await api('admin_edit_user', {}, 'POST', {
        user_id: user.id,
        first_name,
        last_name,
        email,
        phone,
        web_username,
        balance
      });

      if (res && res.ok) {
        showToast('اطلاعات کاربر با موفقیت ویرایش شد! ⚡', 'success');
        closeModal();
        renderAdminView($('app'));
      } else {
        showToast(res ? res.message : 'خطا در ویرایش اطلاعات کاربر.', 'error');
      }
    });
  }

  /* Delete Account Confirmation Modal */
  function openDeleteAccountModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:480px; border:1px solid rgba(239,68,68,0.4);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid rgba(239,68,68,0.3); padding-bottom:12px;">
          <h3 style="font-size:18px; font-weight:900; color:#ef4444;">⚠️ حذف کامل حساب کاربری</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>
        
        <div style="background:rgba(239,68,68,0.1); border-radius:14px; padding:16px; margin-bottom:16px; border:1px solid rgba(239,68,68,0.2);">
          <strong style="color:#ef4444; display:block; font-size:14px; margin-bottom:8px;">عواقب حذف حساب کاربری:</strong>
          <ul style="color:var(--text-muted); font-size:12px; line-height:1.8; margin-right:16px; margin-bottom:0;">
            <li>تمام اطلاعات شخصی (ایمیل، نام کاربری، شماره تماس) پاک خواهد شد.</li>
            <li>موجودی کیف پول و پورسانت‌های شما صفر و غیرقابل بازگشت می‌شود.</li>
            <li>نشست‌های فعال شما در تمام دستگاه‌ها بلافاصله مسدود می‌گردد.</li>
            <li>لینک دعوت شما غیرفعال شده و دیگر پورسانت جدید دریافت نخواهید کرد.</li>
          </ul>
        </div>

        <p style="font-size:13px; color:#fff; margin-bottom:12px;">
          جهت تایید نهایی عبارت <b>DELETE</b> را در کادر زیر تایپ کنید:
        </p>
        <input type="text" id="confirm-delete-text" placeholder="DELETE" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(239,68,68,0.4); color:#ef4444; padding:12px; border-radius:12px; font-family:monospace; outline:none; text-align:center; font-size:16px; margin-bottom:16px;">

        <button id="btn-submit-delete-account" class="user-account-btn" style="width:100%; justify-content:center; background:#ef4444; color:#fff;">🗑️ تایید نهایی و حذف دائم حساب</button>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('btn-submit-delete-account')?.addEventListener('click', async () => {
      const typed = $('confirm-delete-text').value.trim();
      if (typed !== 'DELETE' && typed !== 'حذف') {
        showToast('لطفاً عبارت DELETE را به درستی وارد کنید.', 'error');
        return;
      }
      showToast('در حال حذف حساب کاربری...', 'info');
      const res = await api('delete_my_account', {}, 'POST');
      if (res && res.ok) {
        localStorage.removeItem('bg_web_token');
        state.user = null;
        showToast('حساب شما پاک شد.', 'success');
        closeModal();
        initApp();
      } else {
        showToast(res ? res.message : 'خطا در حذف حساب.', 'error');
      }
    });
  }

  /* ── Auth Modal (Login, Registration & Telegram Widget) ── */
  window.onTelegramAuth = async function (user) {
    const res = await api('telegram_login', {}, 'POST', { auth_data: user });
    if (res && res.ok) {
      if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
      state.user = res.user;
      showToast('ورود با تلگرام با موفقیت انجام شد! 🎉', 'success');
      closeModal();
      initApp();
    } else {
      showToast(res ? res.message : 'تایید هویت تلگرام ناموفق بود.', 'error');
    }
  };

  function openAuthModal() {
    const modalContainer = $('modal-container');
    if (!modalContainer) return;

    const botName = String(state.bot_username || 'BlueGateBot').replace(/^@/, '').trim();

    modalContainer.innerHTML = `
      <div class="modal-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">🔑 ورود / ثبت‌نام در BlueGate</h3>
          <button class="close-drawer-btn" id="close-modal-btn">✕</button>
        </div>

        <div style="display:flex; gap:6px; margin-bottom:20px; background:rgba(255,255,255,0.04); padding:4px; border-radius:14px;">
          <button id="tab-login-btn" class="nav-link active" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px;">ورود</button>
          <button id="tab-register-btn" class="nav-link" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px;">ثبت‌نام</button>
          <button id="tab-telegram-btn" class="nav-link" style="flex:1; justify-content:center; font-size:12px; padding:6px 4px; color:var(--cyan);">✈️ تلگرام</button>
        </div>

        <!-- Login Form -->
        <form id="login-form">
          <div style="margin-bottom:14px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">نام کاربری یا ایمیل</label>
            <input type="text" id="login-username" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <label style="font-size:13px; color:var(--text-muted);">رمز عبور</label>
              <a id="btn-show-forgot-pass" style="font-size:12px; color:var(--cyan); text-decoration:none; cursor:pointer;">فراموشی رمز عبور؟</a>
            </div>
            <input type="password" id="login-password" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ورود به حساب</button>
        </form>

        <!-- Forgot Password Form (Initial Step) -->
        <form id="forgot-pass-form" class="hidden">
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:14px;">ایمیل یا نام کاربری حساب خود را وارد کنید تا کد ۶ رقمی بازیابی ارسال شود:</p>
          <div style="margin-bottom:16px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">ایمیل یا نام کاربری</label>
            <input type="text" id="forgot-email-input" required placeholder="example@mail.com" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:var(--cyan); color:#000;">📧 ارسال کد بازیابی به ایمیل</button>
          <button type="button" id="btn-back-to-login" class="nav-link" style="width:100%; justify-content:center; margin-top:10px;">بازگشت به فرم ورود</button>
        </form>

        <!-- Register Form -->
        <form id="register-form" class="hidden">
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">نام کاربری (انگلیسی)</label>
            <input type="text" id="reg-username" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">رمز عبور</label>
            <input type="password" id="reg-password" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:12px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">ایمیل (جهت ارسال کد OTP)</label>
            <input type="email" id="reg-email" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:4px;">نام یا نام خانوادگی</label>
            <input type="text" id="reg-firstname" style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
          </div>
          <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">ثبت‌نام حساب جدید</button>
        </form>

        <!-- Telegram Auth Container -->
        <div id="telegram-form" class="hidden" style="text-align:center; padding:16px 0;">
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px;">جهت ورود با تلگرام، روی دکمه رسمی زیر کلیک کنید:</p>
          <div id="telegram-widget-wrapper" style="display:flex; justify-content:center; min-height:48px; margin-bottom:16px;"></div>
          
          <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); border-radius:14px; padding:14px; text-align:right;">
            <small style="color:var(--text-muted); font-size:12px; display:block; margin-bottom:8px;">⚠️ پیام «Bot domain invalid» دریافت می‌کنید؟</small>
            <p style="font-size:12px; color:var(--text-muted); line-height:1.5; margin-bottom:12px;">
              مطمئن شوید در @BotFather با دستور <code>/setdomain</code> دامنه دقیق سایت را (بدون https://) برای ربات ثبت کرده‌اید.
            </p>
            <a id="tg-direct-bot-link" href="https://t.me/${botName}" target="_blank" class="user-account-btn" style="width:100%; justify-content:center; text-decoration:none; font-size:12px;">
              ✈️ ورود مستقیم از طریق ربات تلگرام
            </a>
          </div>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }
    $('close-modal-btn')?.addEventListener('click', closeModal);

    const loginTab = $('tab-login-btn');
    const regTab = $('tab-register-btn');
    const tgTab = $('tab-telegram-btn');
    const loginForm = $('login-form');
    const regForm = $('register-form');
    const tgForm = $('telegram-form');

    loginTab?.addEventListener('click', () => {
      loginTab.classList.add('active');
      regTab.classList.remove('active');
      tgTab?.classList.remove('active');
      loginForm.classList.remove('hidden');
      regForm.classList.add('hidden');
      tgForm.classList.add('hidden');
    });

    regTab?.addEventListener('click', () => {
      regTab.classList.add('active');
      loginTab.classList.remove('active');
      tgTab?.classList.remove('active');
      regForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      tgForm.classList.add('hidden');
    });

    tgTab?.addEventListener('click', () => {
      tgTab.classList.add('active');
      loginTab.classList.remove('active');
      regTab.classList.remove('active');
      tgForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      regForm.classList.add('hidden');

      // Get fresh bot name from state (already populated by initApp)
      const freshBotName = String(state.bot_username || botName || '').replace(/^@/, '').trim();
      console.log('[BlueGate] Telegram widget bot:', freshBotName, '| domain:', window.location.hostname);

      const wrapper = $('telegram-widget-wrapper');
      if (wrapper && !wrapper.hasChildNodes() && freshBotName) {
        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', freshBotName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-radius', '12');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.setAttribute('data-request-access', 'write');
        script.async = true;
        script.onerror = () => console.error('[BlueGate] Telegram widget script failed to load');
        wrapper.appendChild(script);
      } else if (!freshBotName) {
        if (wrapper) wrapper.innerHTML = '<p style="color:#f87171;font-size:12px;">نام ربات تنظیم نشده. لطفاً با پشتیبانی تماس بگیرید.</p>';
      }
    });

    let pendingUserId = null;

    function showOtpForm(userId, message) {
      pendingUserId = userId;
      modalContainer.innerHTML = `
        <div class="modal-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
            <h3 style="font-size:18px; font-weight:900;">✉️ تایید ایمیل</h3>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>
          <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px; text-align:center;">${esc(message)}</p>
          <form id="otp-form">
            <div style="margin-bottom:20px;">
              <label style="display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px;">کد تایید ۶ رقمی</label>
              <input type="text" id="otp-code" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:12px; border-radius:12px; font-family:inherit; outline:none; text-align:center; font-size:24px; letter-spacing:4px;">
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center;">تایید کد</button>
          </form>
        </div>
      `;
      $('close-modal-btn')?.addEventListener('click', closeModal);
      $('otp-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = $('otp-code').value.trim();
        const res = await api('verify_email_otp', {}, 'POST', { user_id: pendingUserId, otp });
        if (res && res.ok) {
          if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
          state.user = res.user;
          showToast(res.message || 'ایمیل تایید شد!', 'success');
          closeModal();
          initApp();
        } else {
          showToast(res.message || 'کد تایید نامعتبر است.', 'error');
        }
      });
    }

    // Forgot Password Events
    const forgotForm = $('forgot-pass-form');
    $('btn-show-forgot-pass')?.addEventListener('click', () => {
      loginForm?.classList.add('hidden');
      regForm?.classList.add('hidden');
      tgForm?.classList.add('hidden');
      forgotForm?.classList.remove('hidden');
    });

    $('btn-back-to-login')?.addEventListener('click', () => {
      forgotForm?.classList.add('hidden');
      loginForm?.classList.remove('hidden');
    });

    forgotForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('forgot-email-input').value.trim();
      showToast('در حال ارسال کد بازیابی...', 'info');
      const res = await api('forgot_password_request', {}, 'POST', { email });
      if (res && res.ok) {
        showResetPasswordOtpForm(res.user_id, res.email, res.message);
      } else {
        showToast(res ? res.message : 'خطا در ارسال کد بازیابی.', 'error');
      }
    });

    function showResetPasswordOtpForm(userId, email, message) {
      modalContainer.innerHTML = `
        <div class="modal-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:14px;">
            <h3 style="font-size:18px; font-weight:900;">🔑 تنظیم رمز عبور جدید</h3>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>
          <p style="color:var(--text-muted); font-size:13px; margin-bottom:16px; text-align:center;">${esc(message)}</p>
          <form id="reset-pass-otp-form">
            <div style="margin-bottom:14px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">کد ۶ رقمی ارسال شده به ${esc(email)}</label>
              <input type="text" id="reset-otp-code" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none; text-align:center; font-size:22px; letter-spacing:4px;">
            </div>
            <div style="margin-bottom:20px;">
              <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:6px;">رمز عبور جدید (حداقل ۶ کاراکتر)</label>
              <input type="password" id="reset-new-password" required style="width:100%; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:#fff; padding:10px; border-radius:12px; font-family:inherit; outline:none;">
            </div>
            <button type="submit" class="user-account-btn" style="width:100%; justify-content:center; background:#22c55e; color:#000;">✅ ثبت رمز عبور جدید &amp; ورود</button>
          </form>
        </div>
      `;
      $('close-modal-btn')?.addEventListener('click', closeModal);
      $('reset-pass-otp-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const otp = $('reset-otp-code').value.trim();
        const new_password = $('reset-new-password').value;
        const res = await api('reset_password_submit', {}, 'POST', { user_id: userId, otp, new_password });
        if (res && res.ok) {
          if (res.auth_token) localStorage.setItem('bg_web_token', res.auth_token);
          state.user = res.user;
          showToast(res.message || 'رمز عبور تغییر یافت!', 'success');
          closeModal();
          initApp();
        } else {
          showToast(res ? res.message : 'خطا در ثبت رمز عبور جدید.', 'error');
        }
      });
    }
  }

  function closeModal() {
    const modalContainer = $('modal-container');
    if (modalContainer) {
      modalContainer.classList.add('hidden');
      modalContainer.innerHTML = '';
    }
    const cartDrawer = $('cart-drawer');
    const cartOpen = cartDrawer && cartDrawer.classList.contains('open');
    if (!cartOpen && document.body) {
      document.body.style.overflow = '';
      document.body.classList.remove('has-open-popup');
    }
  }

  /* ── Product Detail Preview Modal ── */
  function openProductModal(pid) {
    const p = state.products.find(item => Number(item.id) === Number(pid));
    if (!p) return;
    pushRecent(pid);

    const modalContainer = $('modal-container');
    if (!modalContainer) return;
    if (document.body) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('has-open-popup');
    }

    modalContainer.onclick = (e) => {
      if (e.target === modalContainer) closeModal();
    };

    const title = p.title || p.name || 'جزئیات محصول';
    const variants = p.variants || [];
    const isWished = state.wishlist.includes(Number(p.id));

    // Description text handling
    const rawDesc = (p.full_description || p.short_description || '').trim();
    const hasDesc = rawDesc && rawDesc !== '-' && rawDesc !== '.';

    let selectedVariant = variants.length > 0 ? variants[0] : null;
    let selectedQty = 1;

    modalContainer.innerHTML = `
      <div class="modal-card" style="max-width:620px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <h3 style="font-size:18px; font-weight:900;">${esc(title)}</h3>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="card-wishlist-btn" id="modal-wish-btn" style="position:static;" title="علاقه‌مندی">${isWished ? '❤️' : '🤍'}</button>
            <button class="user-account-btn" id="modal-share-btn" style="padding:6px 10px; font-size:12px;" title="اشتراک‌گذاری">🔗</button>
            <button class="close-drawer-btn" id="close-modal-btn">✕</button>
          </div>
        </div>

        ${p.image_url ? `
          <div class="product-modal-hero">
            <img src="${esc(p.image_url)}" alt="${esc(title)}">
          </div>
        ` : ''}

        ${hasDesc ? `
          <div class="web-description-box">
            ${esc(rawDesc)}
          </div>
        ` : `
          <div style="display:flex; justify-content:space-around; background:rgba(0,242,254,0.04); border:1px solid rgba(0,242,254,0.2); border-radius:14px; padding:12px; margin-bottom:16px; font-size:12px; color:var(--cyan);">
            <span>⚡ <b>تحویل آنی ۲۴ ساعته</b></span>
            <span>🛡️ <b>ضمانت سلامت اکانت</b></span>
            <span>🎧 <b>پشتیبانی اختصاصی</b></span>
          </div>
        `}

        ${variants.length > 0 ? `
          <div style="margin-bottom:18px;">
            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:8px;">انتخاب پلن / مدت زمان اشتراک:</label>
            <div class="variant-cards-grid">
              ${variants.map((v, idx) => {
                // v.price is already the discounted price (price_runtime_meta applies discount_percent)
                // v.old_price is the original price before discount (computed in API)
                const vDisc = Number(v.discount_percent || 0);
                const vOrig = Number(v.old_price || 0);  // already pre-computed by API
                return `
                  <button class="variant-option-card ${idx === 0 ? 'selected' : ''}" data-v-id="${v.id}" data-v-price="${v.price}" data-v-orig="${vOrig || ''}" data-v-title="${esc(v.title)}">
                    <div class="variant-card-header">
                      <span class="variant-title">${esc(v.title)}</span>
                      <span class="variant-badge">${v.duration_days ? `${v.duration_days} روز` : 'پلن ویژه'}</span>
                    </div>
                    <div class="variant-price">
                      ${vOrig > 0 && vOrig > Number(v.price) ? `<s style="color:var(--text-muted); font-size:11px; margin-left:4px; text-decoration:line-through;">${priceLabel(vOrig)}</s>` : ''}
                      <span>${priceLabel(v.price)}</span>
                      ${vDisc > 0 ? `<span class="flash-pill" style="font-size:10px; background:rgba(239, 68, 68, 0.2); color:#fca5a5; padding:2px 6px; border-radius:6px; margin-right:4px;">−${nf(vDisc)}٪</span>` : ''}
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-color); padding-top:16px; margin-top:10px;">
          <div>
            <small style="color:var(--text-muted); font-size:11px; display:block;">مبلغ کل:</small>
            <b id="modal-price-label" style="font-size:22px; color:var(--cyan); font-weight:900;">
              ${priceLabel((selectedVariant ? selectedVariant.price : p.price) * selectedQty)}
            </b>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="modal-qty-control">
              <button class="qty-btn" id="modal-qty-minus">-</button>
              <span class="qty-val" id="modal-qty-val">1</span>
              <button class="qty-btn" id="modal-qty-plus">+</button>
            </div>
            <button class="user-account-btn" id="btn-buy-modal" style="background:linear-gradient(135deg, var(--cyan), #1d9bf0); color:#000; font-weight:900; padding:12px 20px; font-size:14px;">⚡ افزودن به سبد خرید</button>
          </div>
        </div>
      </div>
    `;

    modalContainer.classList.remove('hidden');
    $('close-modal-btn')?.addEventListener('click', closeModal);
    $('modal-wish-btn')?.addEventListener('click', () => toggleWishlist(p.id));
    $('modal-share-btn')?.addEventListener('click', () => openShareSheet(p.id));

    // Variant Card Selection Handler
    document.querySelectorAll('.variant-option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('.variant-option-card').forEach(c => c.classList.remove('selected'));
        const btn = e.currentTarget;
        btn.classList.add('selected');
        selectedVariant = {
          id: btn.dataset.vId,
          title: btn.dataset.vTitle,
          price: Number(btn.dataset.vPrice),
          origPrice: btn.dataset.vOrig ? Number(btn.dataset.vOrig) : null
        };
        updateModalPrice();
      });
    });

    // Quantity Buttons
    $('modal-qty-plus')?.addEventListener('click', () => {
      selectedQty++;
      $('modal-qty-val').textContent = selectedQty;
      updateModalPrice();
    });

    $('modal-qty-minus')?.addEventListener('click', () => {
      if (selectedQty > 1) {
        selectedQty--;
        $('modal-qty-val').textContent = selectedQty;
        updateModalPrice();
      }
    });

    function updateModalPrice() {
      const basePrice = selectedVariant ? selectedVariant.price : p.price;
      const baseOrig = selectedVariant ? selectedVariant.origPrice : null;

      const totalPrice = basePrice * selectedQty;
      const totalOrig = baseOrig ? baseOrig * selectedQty : null;

      const priceLbl = $('modal-price-label');
      if (priceLbl) {
        priceLbl.innerHTML = `
          ${totalOrig ? `<s style="color:var(--text-muted); font-size:13px; margin-left:6px; text-decoration:line-through; font-weight:normal;">${priceLabel(totalOrig)}</s>` : ''}
          ${priceLabel(totalPrice)}
        `;
      }
    }

    $('btn-buy-modal')?.addEventListener('click', () => {
      for (let i = 0; i < selectedQty; i++) {
        addToCart(
          p.id,
          selectedVariant ? selectedVariant.id : null,
          selectedVariant ? selectedVariant.title : '',
          selectedVariant ? selectedVariant.price : p.price
        );
      }
      closeModal();
    });
  }

  /* ── Global Event Delegation ── */
  function bindGlobalEvents() {
    // Wheel listener for horizontal category carousel & pills
    document.addEventListener('wheel', (e) => {
      const scrollEl = e.target.closest('.sidebar-cat-list, .hero-trust-row, .order-action-pills-bar, .stepper-nodes-row');
      if (scrollEl && e.deltaY !== 0) {
        scrollEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener('click', (e) => {
      // User Account Button -> Open Auth or Profile
      if (e.target.closest('#user-btn')) {
        if (state.user && !state.user.is_guest) {
          state.currentTab = 'profile';
          renderApp();
        } else {
          openAuthModal();
        }
        return;
      }

      if (e.target.closest('#mobile-cart-trigger')) {
        openCartDrawer(true);
        return;
      }

      if (e.target.closest('#mobile-user-trigger')) {
        if (state.user && !state.user.is_guest) {
          state.currentTab = 'profile';
          renderApp();
        } else {
          openAuthModal();
        }
        return;
      }

      // Navigation tabs
      const tabBtn = e.target.closest('[data-tab]');
      if (tabBtn && tabBtn.dataset.tab) {
        state.currentTab = tabBtn.dataset.tab;
        renderApp();
      }

      // Category Sidebar Click
      const catBtn = e.target.closest('.sidebar-cat-btn');
      if (catBtn && catBtn.dataset.cat) {
        state.activeCategory = catBtn.dataset.cat;
        renderApp();
      }

      // Sort Pills
      const sortBtn = e.target.closest('[data-sort]');
      if (sortBtn && sortBtn.dataset.sort) {
        state.shopSort = sortBtn.dataset.sort;
        renderApp();
      }

      // Quick Buy (From Cards)
      const buyBtn = e.target.closest('[data-buy]');
      if (buyBtn && buyBtn.dataset.buy) {
        e.stopPropagation();
        const p = state.products.find(item => Number(item.id) === Number(buyBtn.dataset.buy));
        if (p && p.variants && p.variants.length > 0) {
          openProductModal(p.id);
        } else {
          addToCart(buyBtn.dataset.buy);
        }
      }

      // Wishlist toggle
      const wishBtn = e.target.closest('[data-wishlist]');
      if (wishBtn && wishBtn.dataset.wishlist) {
        e.stopPropagation();
        toggleWishlist(wishBtn.dataset.wishlist);
      }

      // Share sheet
      const shareBtn = e.target.closest('[data-share]');
      if (shareBtn && shareBtn.dataset.share) {
        e.stopPropagation();
        openShareSheet(shareBtn.dataset.share);
      }

      // Recently viewed item click
      const recentCard = e.target.closest('.recent-product-card');
      if (recentCard && recentCard.dataset.pid) {
        openProductModal(recentCard.dataset.pid);
      }

      // Glowing flash card click
      const flashCard = e.target.closest('.glowing-flash-card');
      if (flashCard && flashCard.dataset.pid && !e.target.closest('[data-buy]')) {
        openProductModal(flashCard.dataset.pid);
      }

      // Order Detail
      const orderCard = e.target.closest('[data-order-open]');
      if (orderCard && orderCard.dataset.orderOpen) {
        openOrderDetailModal(orderCard.dataset.orderOpen);
      }
      const card = e.target.closest('.product-card');
      if (card && card.dataset.pid && !e.target.closest('[data-buy]') && !e.target.closest('[data-wishlist]') && !e.target.closest('[data-share]')) {
        openProductModal(card.dataset.pid);
      }

      // Copy buttons
      const copyBtn = e.target.closest('[data-copy]');
      if (copyBtn && copyBtn.dataset.copy) {
        navigator.clipboard.writeText(copyBtn.dataset.copy);
        showToast('کد با موفقیت کپی شد! 📋', 'success');
      }

      // Clear Cart
      const clearBtn = e.target.closest('#clear-cart-btn');
      if (clearBtn) {
        clearCart();
        return;
      }

      // Plus Cart Qty
      const plusBtn = e.target.closest('[data-cart-plus]');
      if (plusBtn) {
        const pid = plusBtn.dataset.cartPlus;
        const vid = plusBtn.dataset.cartVid || null;
        updateCartQty(pid, vid, 1);
        return;
      }

      // Minus Cart Qty
      const minusBtn = e.target.closest('[data-cart-minus]');
      if (minusBtn) {
        const pid = minusBtn.dataset.cartMinus;
        const vid = minusBtn.dataset.cartVid || null;
        updateCartQty(pid, vid, -1);
        return;
      }

      // Remove Cart Item
      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) {
        const pid = removeBtn.dataset.cartRemove;
        const vid = removeBtn.dataset.cartVid || null;
        removeFromCart(pid, vid);
        return;
      }
    });

    // In-Stock & Wishlist quick toggles
    document.addEventListener('click', (e) => {
      if (e.target.closest('#toggle-instock')) {
        state.filterInStock = !state.filterInStock;
        renderApp();
      }
      if (e.target.closest('#toggle-wishlist')) {
        state.filterWishlist = !state.filterWishlist;
        renderApp();
      }
    });

    // Search Input + Live Autocomplete Popover
    const searchInput = $('search-input');
    if (searchInput) {
      let searchTimer;
      searchInput.addEventListener('input', (e) => {
        state.searchTerm = e.target.value.trim();
        if (state.currentTab === 'shop') renderApp();

        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          renderLiveSearchPopover(state.searchTerm);
        }, 150);
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.header-search-box')) {
          const popover = $('live-search-popover');
          if (popover) popover.style.display = 'none';
        }
      });
    }

    // Cart Drawer Toggle
    $('open-cart-btn')?.addEventListener('click', () => openCartDrawer(true));
    $('close-cart-btn')?.addEventListener('click', () => openCartDrawer(false));
    $('cart-backdrop')?.addEventListener('click', () => openCartDrawer(false));
  }

  function renderLiveSearchPopover(query) {
    let popover = $('live-search-popover');
    if (!popover) {
      const searchBox = document.querySelector('.header-search-box');
      if (!searchBox) return;
      popover = document.createElement('div');
      popover.id = 'live-search-popover';
      popover.className = 'live-search-popover';
      searchBox.appendChild(popover);
    }

    const q = (query || '').toLowerCase();
    if (!q || q.length < 2) {
      popover.style.display = 'none';
      return;
    }

    const matches = state.products.filter(p => {
      const title = (p.title || p.name || '').toLowerCase();
      const desc = (p.description || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    }).slice(0, 5);

    if (!matches.length) {
      popover.innerHTML = `<div style="padding:16px; text-align:center; color:var(--text-muted); font-size:13px;">محصولی یافت نشد 🔍</div>`;
      popover.style.display = 'block';
      return;
    }

    popover.innerHTML = matches.map(p => `
      <div class="search-match-item" data-pid="${p.id}" style="padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid rgba(255,255,255,0.06); cursor:pointer;">
        <div style="display:flex; align-items:center; gap:12px; flex:1; overflow:hidden;">
          <div style="width:40px; height:40px; border-radius:10px; overflow:hidden; background:rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:center; flex-shrink:0; border:1px solid rgba(255,255,255,0.1);">
            ${p.image_url ? `<img src="${esc(p.image_url)}" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null; this.parentElement.innerHTML='⚡';">` : `⚡`}
          </div>
          <div style="flex:1; overflow:hidden; text-align:right;">
            <b style="font-size:13.5px; color:#fff; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:2px;">${esc(p.title || p.name)}</b>
            <span style="font-size:11.5px; color:var(--cyan); font-weight:800;">${priceLabel(p.price)}</span>
          </div>
        </div>
        <span style="font-size:14px; color:var(--cyan); opacity:0.8; font-weight:bold;">←</span>
      </div>
    `).join('');

    popover.style.display = 'block';

    popover.querySelectorAll('.search-match-item').forEach(item => {
      item.addEventListener('click', () => {
        openProductModal(item.dataset.pid);
        popover.style.display = 'none';
      });
    });
  }

  function toggleWishlist(pid) {
    const id = Number(pid);
    const idx = state.wishlist.indexOf(id);
    if (idx >= 0) state.wishlist.splice(idx, 1);
    else state.wishlist.push(id);

    localStorage.setItem('bg_web_wishlist', JSON.stringify(state.wishlist));
    showToast(idx >= 0 ? 'از نشان‌شده‌ها حذف شد' : 'به نشان‌شده‌ها اضافه شد ❤️', 'info');
    renderApp();
  }

  function addToCart(pid, vId = null, vTitle = '', vPrice = null) {
    const product = state.products.find(p => Number(p.id) === Number(pid));
    if (!product) return;

    const title = product.title || product.name || 'محصول بدون عنوان';
    const finalTitle = vId ? `${title} — ${vTitle}` : title;
    const finalPrice = vPrice !== null ? vPrice : product.price;

    const existing = state.cart.find(item => Number(item.id) === Number(pid) && item.vid == vId);
    if (existing) {
      existing.qty = (existing.qty || 1) + 1;
    } else {
      state.cart.push({ id: product.id, vid: vId, title: finalTitle, price: finalPrice, qty: 1 });
    }

    localStorage.setItem('bg_web_cart', JSON.stringify(state.cart));
    updateCartCount();
    showToast(`"${finalTitle}" به سبد خرید اضافه شد! 🛒`, 'success');
    openCartDrawer(true);
  }

  function openCartDrawer(open) {
    const drawer = $('cart-drawer');
    const backdrop = $('cart-backdrop');
    if (drawer) drawer.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    if (document.body) {
      if (open) {
        document.body.style.overflow = 'hidden';
        document.body.classList.add('has-open-popup');
      } else {
        const modalContainer = $('modal-container');
        if (!modalContainer || modalContainer.classList.contains('hidden')) {
          document.body.style.overflow = '';
          document.body.classList.remove('has-open-popup');
        }
      }
    }
    if (open) renderCartDrawerContent();
  }

  function updateCartQty(pid, vId, delta) {
    const item = state.cart.find(x => Number(x.id) === Number(pid) && (x.vid == vId || (!x.vid && !vId)));
    if (!item) return;

    item.qty = (item.qty || 1) + delta;
    if (item.qty <= 0) {
      removeFromCart(pid, vId);
      return;
    }

    localStorage.setItem('bg_web_cart', JSON.stringify(state.cart));
    updateCartCount();
    renderCartDrawerContent();
  }

  function removeFromCart(pid, vId) {
    state.cart = state.cart.filter(x => !(Number(x.id) === Number(pid) && (x.vid == vId || (!x.vid && !vId))));
    localStorage.setItem('bg_web_cart', JSON.stringify(state.cart));
    updateCartCount();
    renderCartDrawerContent();
    showToast('محصول از سبد خرید حذف شد', 'info');
  }

  function clearCart() {
    if (!state.cart.length) return;
    state.cart = [];
    localStorage.setItem('bg_web_cart', '[]');
    updateCartCount();
    renderCartDrawerContent();
    showToast('سبد خرید خالی شد 🗑️', 'info');
  }

  function renderCartDrawerContent() {
    const container = $('cart-items-container');
    const footer = $('cart-footer-container');
    const headerClearBtn = $('clear-cart-btn');
    if (!container || !footer) return;

    if (!state.cart.length) {
      container.innerHTML = `
        <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
          <div style="font-size:48px; margin-bottom:12px; opacity:0.6;">🛒</div>
          <b style="font-size:16px; color:#fff; display:block; margin-bottom:6px;">سبد خرید شما خالی است!</b>
          <p style="font-size:13px; margin-bottom:20px;">محصولات مورد نظرتان را به سبد خرید اضافه کنید.</p>
        </div>
      `;
      footer.innerHTML = '';
      if (headerClearBtn) headerClearBtn.style.display = 'none';
      return;
    }

    if (headerClearBtn) headerClearBtn.style.display = 'inline-flex';

    const total = state.cart.reduce((sum, item) => sum + (Number(item.price) * (item.qty || 1)), 0);

    container.innerHTML = state.cart.map(item => {
      const vidAttr = item.vid ? `data-cart-vid="${item.vid}"` : '';
      return `
        <div class="cart-item-row" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:12px 14px; border-radius:14px; gap:12px;">
          <div style="flex:1; min-width:0;">
            <b style="font-size:13.5px; display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; color:#fff; margin-bottom:2px;">${esc(item.title)}</b>
            <div style="color:var(--cyan); font-size:12px; font-weight:800;">${priceLabel(item.price)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
            <div style="display:flex; align-items:center; background:rgba(0,0,0,0.35); border:1px solid var(--border-color); border-radius:10px; padding:2px;">
              <button class="cart-qty-btn" data-cart-minus="${item.id}" ${vidAttr} style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:none; border:none; color:#fff; font-weight:900; cursor:pointer; font-size:14px; border-radius:8px;" title="کم کردن">−</button>
              <span style="font-weight:900; font-size:13px; min-width:24px; text-align:center; color:var(--cyan);">${item.qty || 1}</span>
              <button class="cart-qty-btn" data-cart-plus="${item.id}" ${vidAttr} style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:none; border:none; color:#fff; font-weight:900; cursor:pointer; font-size:14px; border-radius:8px;" title="زیاد کردن">+</button>
            </div>
            <button class="cart-remove-btn" data-cart-remove="${item.id}" ${vidAttr} title="حذف از سبد" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; width:32px; height:32px; border-radius:10px; font-size:13px; cursor:pointer; display:flex; align-items:center; justify-content:center;">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    footer.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-weight:900; font-size:16px;">
        <span>مبلغ قابل پرداخت:</span>
        <span style="color:var(--cyan);">${priceLabel(total)}</span>
      </div>
      <div style="display:flex; gap:8px;">
        <button id="cart-clear-footer-btn" class="user-account-btn" style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.3); color:#fca5a5; padding:12px 14px; font-size:13px;" title="خالی کردن سبد خرید">🗑️ خالی کردن</button>
        <button id="cart-checkout-btn" class="user-account-btn" style="flex:1; justify-content:center;">تکمیل خرید &amp; پرداخت</button>
      </div>
    `;

    $('cart-checkout-btn')?.addEventListener('click', checkoutCart);
    $('cart-clear-footer-btn')?.addEventListener('click', clearCart);
  }

  /* ── Checkout Flow ── */
  async function checkoutCart() {
    if (!state.cart.length) return;
    if (!state.user || state.user.is_guest) {
      showToast('برای ثبت سفارش لطفا وارد حساب شوید', 'error');
      openAuthModal();
      return;
    }

    const btn = $('cart-checkout-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'در حال پردازش...';
    }

    let okCount = 0, failCount = 0;
    
    // We send create_order for each item separately
    for (const item of state.cart) {
      for (let i = 0; i < (item.qty || 1); i++) {
        try {
          const payload = { product_id: item.id, use_wallet: 0, is_web: 1 };
          if (item.vid) payload.variant_id = item.vid;
          const res = await api('create_order', {}, 'POST', payload);
          if (res && res.ok) okCount++;
          else failCount++;
        } catch(e) {
          failCount++;
        }
      }
    }

    // Clear cart locally
    state.cart = [];
    localStorage.setItem('bg_web_cart', '[]');
    updateCartCount();
    openCartDrawer(false);

    showToast(`✅ ${nf(okCount)} سفارش ثبت شد${failCount ? ` · ${nf(failCount)} ناموفق` : ''}`, 'success');

    // Switch to orders tab to see them
    state.currentTab = 'orders';
    renderApp();
  }

  /* ── Boot Web Engine ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
