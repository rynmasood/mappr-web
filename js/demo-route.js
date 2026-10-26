/*!
 * Interactive replica of RouteNavigationScreen.kt + RouteControlCenter.kt.
 * A real simulation engine runs underneath: speed slider, corner slowdown (look-ahead
 * braking + physical accel/decel), real-time jitter (70–120 %), and Normal / Loop / Reverse
 * (patrol) run modes, with a heading-up, tilted follow camera like the app's (zoom 17, tilt 45°).
 */
(function (global) {
  'use strict';
  var MP = global.MP, U = MP.ui, icon = U.icon, geo = MP.map.geo, T = MP.map.T;

  var COL = { start: '#0097B2', way: '#F09D51', end: '#E61C21', line: '#2196F3', dot: '#4285F4' };
  var MODES = ['normal', 'loop', 'reverse'];
  var MODE_TIP = {
    normal: 'Travel from the start to the destination once',
    loop: 'Restart from the beginning after reaching the destination',
    reverse: 'Patrol continuously between the start and destination'
  };
  var TIPS = {
    realtime: 'Varies speed 70%-120% for realism',
    corner: 'Slows down for bends and turns, like a real driver. The speed slider sets your speed on straights.',
    accuracy: 'Reported horizontal accuracy. Smaller values represent a more precise mocked location.',
    drift: 'When enabled, reported accuracy varies over time to imitate changing GPS signal quality.',
    altitude: 'Elevation above or below sea level included with each mocked location.'
  };

  function fmtDist(km) { return km < 1 ? Math.round(km * 1000) + ' m' : (Math.round(km * 100) / 100).toFixed(2).replace(/\.?0+$/, '') + ' km'; }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
    if (m > 0) return m + ':' + String(r).padStart(2, '0');
    return r + 's';
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  function angDiff(a, b) { var d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  function RouteDemo(screen, opts) {
    opts = opts || {};
    var self = this;
    this.screen = screen;
    this.onTelemetry = opts.onTelemetry || function () {};
    this.onEvent = opts.onEvent || function () {};
    this.place = geo.place(opts.place || 'dubai');
    this.seed = opts.seed || 5;
    this.st = {
      state: 'idle', paused: false, speed: 60, realTime: false, corner: true, mode: 'normal',
      acc: 3, drift: false, alt: 0, expanded: false
    };
    this.sim = { d: 0, dir: 1, v: 0, traveled: 0, rt: 1, loops: 0 };
    this.anchorY = 300;
    this.heading = 0;
    this.interacted = false;

    this._build();
    this.view = new MP.map.MapView(this.q('.app-map'), {
      style: 'light', overscan: 1.5, canDrag: function () { return self.st.state !== 'active' || self.st.paused; }
    });
    this.view.layers.push(function (ctx, v) { self._draw(ctx, v); });
    this.view.onFrame = function (dt, t) { self._frame(dt, t); };
    this.newRoute(true);
    global.addEventListener('mp-fit', function () { self._measure(); });
    new ResizeObserver(function () { self._measure(); }).observe(this.q('.rn-panel'));
  }

  RouteDemo.prototype = {
    q: function (s) { return this.screen.querySelector(s); },
    sf: function () { var r = this.screen.getBoundingClientRect(); return r.width / this.screen.offsetWidth || 1; },

    /* ───────── DOM ───────── */
    _build: function () {
      var self = this;
      this.screen.innerHTML =
        '<div class="app-map"></div>' +
        '<div class="app-statusbar"><span>9:41</span><span class="sb-r"><i></i><i></i></span></div>' +
        '<div class="rn-top">' +
          '<div class="rn-chip"><small>Distance</small><b data-dist>—</b></div>' +
          '<div class="rn-title" data-title>Route Preview</div>' +
          '<div class="rn-chip"><small>Est. Time</small><b data-eta>—</b></div>' +
        '</div>' +
        '<div class="rn-scrim" data-scrim></div>' +
        '<div class="rn-panel" data-panel>' +
          '<div data-status></div>' +
          '<div class="rn-reveal" data-reveal><div class="sc" data-sc>' +
            '<div class="rn-settings" data-settings>' +
              '<div class="rn-modes"><div class="rn-row" style="min-height:24px">' + icon('modeNormal', 20) + '<span class="tl"><span>Route Modes</span></span></div>' +
                '<div class="rn-seg" role="radiogroup" aria-label="Route modes"><i class="ind"></i>' +
                  MODES.map(function (m) { return '<button role="radio" data-mode="' + m + '" aria-label="' + m + ' route mode">' + icon('mode' + m[0].toUpperCase() + m.slice(1), 20) + '</button>'; }).join('') +
                '</div></div>' +
              '<hr>' + this._switchRow('shuffle', 'Real-time mode', 'realtime', 'rt') +
              '<hr>' + this._switchRow('turnRight', 'Corner slowdown', 'corner', 'cs') +
              '<hr>' +
              '<div><div class="rn-row">' + icon('myLocation', 20) + '<span class="tl"><span>Location Accuracy</span>' + this._info('accuracy') + '</span><span class="val" data-accv>3m</span></div>' +
                '<input class="app-slider" type="range" min="1" max="100" step="1" value="3" data-acc aria-label="Location Accuracy"><div class="rn-range"><span>1m</span><span>100m</span></div></div>' +
              '<hr>' + this._switchRow('tune', 'Accuracy Drift', 'drift', 'ad') +
              '<hr>' +
              '<div><div class="rn-row">' + icon('terrain', 20) + '<span class="tl"><span>Altitude</span>' + this._info('altitude') + '</span><span class="val" data-altv>0m</span></div>' +
                '<input class="app-slider" type="range" min="-500" max="8848" step="100" value="0" data-alt aria-label="Altitude"><div class="rn-range"><span>-500m</span><span>8848m</span></div></div>' +
            '</div></div></div>' +
          '<div class="rn-compact">' +
            '<div class="rn-speed"><div class="h"><b>Speed</b><div><span data-spic></span><span data-spv>60 km/h</span></div></div>' +
              '<div class="sl-ticks" data-slt><input class="app-slider" type="range" min="0" max="150" step="1" value="60" data-speed aria-label="Speed"></div>' +
              '<div class="ticks"><span>0</span><span>50</span><span>100</span><span>150</span></div></div>' +
            '<button class="rn-handle" data-handle aria-label="Expand controls" aria-expanded="false">' + icon('arrowUp', 28) + '</button>' +
            '<div class="rn-acts" data-acts></div>' +
          '</div>' +
        '</div>' +
        '<div class="app-tip" data-tip role="tooltip"></div>' +
        '<div class="app-gesture"></div>';

      var scr = this.screen;
      // switches
      scr.querySelectorAll('.app-switch').forEach(function (sw) {
        sw.addEventListener('click', function () {
          var on = sw.getAttribute('aria-checked') !== 'true', k = sw.getAttribute('data-k');
          sw.setAttribute('aria-checked', on);
          if (k === 'rt') { self.st.realTime = on; }
          if (k === 'cs') { self.st.corner = on; }
          if (k === 'ad') { self.st.drift = on; }
          self._updateChips();
          self.onEvent('toggle', k);
        });
      });
      scr.querySelectorAll('[data-tipk]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); self._tip(b, TIPS[b.getAttribute('data-tipk')]); });
      });
      // sliders
      function sl(el, fn) { el.addEventListener('input', function () { el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); if (el.parentNode.classList.contains('sl-ticks')) el.parentNode.style.setProperty('--p', el.style.getPropertyValue('--p')); fn(+el.value); }); el.dispatchEvent(new Event('input')); }
      sl(this.q('[data-speed]'), function (v) { self.st.speed = v; self._speedUi(); self._updateChips(); });
      sl(this.q('[data-acc]'), function (v) { self.st.acc = v; self.q('[data-accv]').textContent = v + 'm'; });
      sl(this.q('[data-alt]'), function (v) { v = Math.round(v / 100) * 100; self.st.alt = v; self.q('[data-altv]').textContent = v + 'm'; });
      // modes
      scr.querySelectorAll('[data-mode]').forEach(function (b) {
        function pick() { self.setMode(b.getAttribute('data-mode')); self._tip(b, MODE_TIP[self.st.mode], 1800); }
        b.addEventListener('click', pick);
        b.addEventListener('mouseenter', function () { self._tip(b, MODE_TIP[b.getAttribute('data-mode')], 1600); });
      });
      // panel drag handle
      this._bindHandle();
      this.q('[data-scrim]').addEventListener('click', function () { self.setExpanded(false); });
      this.screen.addEventListener('click', function (e) { var a = e.target.closest('[data-act]'); if (a) self._act(a.getAttribute('data-act')); });
      this._speedUi();
      this.setMode('normal', true);
      this._renderActs();
      this._renderStatus();
    },

    _info: function (k) { return '<button class="rn-info" data-tipk="' + k + '" aria-label="Info">' + icon('info', 18) + '</button>'; },
    _switchRow: function (ic, label, tip, k) {
      var on = (k === 'cs') ? 'true' : 'false';
      return '<div class="rn-row">' + icon(ic, 20) + '<span class="tl"><span>' + label + '</span>' + this._info(tip) + '</span>' +
        '<button class="app-switch" role="switch" aria-checked="' + on + '" aria-label="' + label + '" data-k="' + k + '"></button></div>';
    },

    _tip: function (anchor, text, ms) {
      var tip = this.q('[data-tip]'), sf = this.sf(), sr = this.screen.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      tip.textContent = text;
      tip.classList.add('on');
      var cx = (ar.left + ar.width / 2 - sr.left) / sf, top = (ar.top - sr.top) / sf;
      var w = Math.min(210, tip.offsetWidth || 210);
      tip.style.left = Math.max(10, Math.min(360 - w - 10, cx - w / 2)) + 'px';
      tip.style.top = Math.max(60, top - tip.offsetHeight - 6) + 'px';
      clearTimeout(this._tt);
      this._tt = setTimeout(function () { tip.classList.remove('on'); }, ms || 2600);
    },

    _speedUi: function () {
      var s = this.st.speed;
      this.q('[data-spv]').textContent = Math.round(s) + ' km/h';
      this.q('[data-spic]').innerHTML = icon(s < 50 ? 'walk' : s < 100 ? 'bike' : 'car', 24);
    },

    setMode: function (m, silent) {
      this.st.mode = m;
      var i = MODES.indexOf(m), seg = this.q('.rn-seg');
      seg.querySelector('.ind').style.transform = 'translateX(' + (i * 100) + '%)';
      seg.querySelectorAll('button').forEach(function (b) { var s = b.getAttribute('data-mode') === m; b.classList.toggle('sel', s); b.setAttribute('aria-checked', s); });
      if (!silent) this.onEvent('mode', m);
    },

    setSpeed: function (v, silent) {
      v = Math.max(0, Math.min(150, +v || 0));
      this.st.speed = v;
      var el = this.q('[data-speed]');
      if (el) {
        el.value = v;
        var pct = ((v - el.min) / (el.max - el.min) * 100) + '%';
        el.style.setProperty('--p', pct);
        if (el.parentNode && el.parentNode.classList.contains('sl-ticks')) el.parentNode.style.setProperty('--p', pct);
      }
      this._speedUi();
      this._updateChips();
      if (!silent) this.onEvent('speed', v);
    },

    setToggle: function (k, on, silent) {
      var bool = !!on;
      if (k === 'rt') this.st.realTime = bool;
      if (k === 'cs') this.st.corner = bool;
      if (k === 'ad') this.st.drift = bool;
      var sw = this.q('.app-switch[data-k="' + k + '"]');
      if (sw) sw.setAttribute('aria-checked', bool ? 'true' : 'false');
      this._updateChips();
      if (!silent) this.onEvent('toggle', k);
    },

    applyPreset: function (cfg) {
      if (cfg.place) this.place = geo.place(cfg.place);
      if (cfg.seed != null) this.seed = cfg.seed;
      if (cfg.speed != null) this.setSpeed(cfg.speed, true);
      if (cfg.mode) this.setMode(cfg.mode, true);
      if (cfg.corner != null) this.setToggle('cs', cfg.corner, true);
      if (cfg.realTime != null) this.setToggle('rt', cfg.realTime, true);
      if (cfg.drift != null) this.setToggle('ad', cfg.drift, true);
      this.newRoute(false);
      if (cfg.autoStart) this.start();
    },

    /* ───────── control-centre reveal (drag / tap / spring) ───────── */
    _bindHandle: function () {
      var self = this, h = this.q('[data-handle]'), reveal = this.q('[data-reveal]');
      this.rv = { x: 0, v: 0, max: 0, target: 0, drag: false, raf: 0 };
      function mx() { self._measure(); return self.rv.max; }
      var y0 = 0, r0 = 0, id = null, moved = 0, lastY = 0, lastT = 0, vel = 0;
      h.addEventListener('pointerdown', function (e) {
        id = e.pointerId; h.setPointerCapture(id); y0 = lastY = e.clientY; r0 = self.rv.x; moved = 0; vel = 0; lastT = performance.now();
        self.rv.drag = true; mx(); cancelAnimationFrame(self.rv.raf); self.interacted = true; self._hintOff();
      });
      h.addEventListener('pointermove', function (e) {
        if (e.pointerId !== id) return;
        var sf = self.sf(), dy = (e.clientY - y0) / sf, now = performance.now();
        moved = Math.max(moved, Math.abs(dy));
        vel = ((e.clientY - lastY) / sf) / Math.max(0.001, (now - lastT) / 1000) * 0.5 + vel * 0.5; lastY = e.clientY; lastT = now;
        self.rv.x = U.clamp(r0 - dy, 0, self.rv.max);
        self._applyReveal();
      });
      function up(e) {
        if (e.pointerId !== id) return;
        id = null; self.rv.drag = false;
        if (moved < 5) { self.setExpanded(!self.st.expanded); return; }
        var exp = vel < -500 ? true : vel > 500 ? false : self.rv.x > self.rv.max / 2;
        self.rv.v = -vel; // px/s in reveal-space
        self.setExpanded(exp, true);
      }
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
      h.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); self.setExpanded(!self.st.expanded); } });
    },

    _measure: function () {
      var scr = this.screen, panel = this.q('[data-panel]'), reveal = this.q('[data-reveal]'), settings = this.q('[data-settings]');
      var fixed = panel.offsetHeight - reveal.offsetHeight;
      var cap = 740 - 20 - 100 - fixed;
      this.rv.max = Math.max(0, Math.min(settings.offsetHeight, cap));
      if (!this.rv.drag && !this.rv.raf) { this.rv.x = this.st.expanded ? this.rv.max : 0; this._applyReveal(); }
    },

    setExpanded: function (on, keepV) {
      this.st.expanded = on;
      this.interacted = true; this._hintOff();
      var h = this.q('[data-handle]');
      h.setAttribute('aria-expanded', on); h.setAttribute('aria-label', on ? 'Collapse controls' : 'Expand controls');
      h.firstChild.style.transform = 'rotate(' + (on ? 180 : 0) + 'deg)';
      this._measure();
      var rv = this.rv, self = this, last = performance.now();
      if (!keepV) rv.v = 0;
      cancelAnimationFrame(rv.raf);
      var target = on ? rv.max : 0;
      (function step(now) {
        var dt = Math.min(0.032, (now - last) / 1000); last = now;
        var done = U.spring(rv, target, dt, 320, 30);
        rv.x = Math.max(0, Math.min(rv.max, rv.x));
        self._applyReveal();
        if (done) { rv.x = target; rv.v = 0; rv.raf = 0; self._applyReveal(); return; }
        rv.raf = requestAnimationFrame(step);
      })(last);
    },

    _applyReveal: function () {
      var rv = this.rv, f = rv.max ? rv.x / rv.max : 0;
      var reveal = this.q('[data-reveal]');
      reveal.style.height = rv.x + 'px';
      this.q('[data-sc]').style.opacity = Math.min(1, f * 1.3);
      var sc = this.q('[data-scrim]');
      sc.style.opacity = (f * 0.2).toFixed(3);
      sc.classList.toggle('on', f > 0.02);
    },

    _hintOff: function () { var h = this.q('[data-handle] svg'); if (h) h.style.animation = 'none'; },

    /* ───────── status / buttons ───────── */
    _renderStatus: function () {
      var st = this.st, el = this.q('[data-status]');
      if (st.state === 'active') {
        el.innerHTML = '<div class="rn-status"><div class="r1"><b data-sttl>' + (st.paused ? 'Paused' : 'Navigating') + '</b><span data-spct>0%</span></div><div class="bar"><i data-sbar></i></div><div class="r2"><span data-str>Traveled: 0 m</span><span data-sspd>Speed: 0 km/h</span></div></div>';
      } else if (st.state === 'completed') {
        el.innerHTML = '<div class="rn-completed">Route completed!</div>';
      } else el.innerHTML = '';
      this._measure();
    },

    _renderActs: function () {
      var st = this.st, el = this.q('[data-acts]'), html = '';
      var P = function (ic, label, act, cls) { return '<button class="rn-btn ' + (cls || '') + '" data-act="' + act + '">' + icon(ic, 20) + '<span>' + label + '</span></button>'; };
      if (st.state === 'idle') html = P('close', 'Clear', 'clear', 'err') + P('play', '<b>Start</b>', 'start', 'pri');
      else if (st.state === 'completed') html = P('stop', 'Stop', 'stop', 'err') + P('replay', '<b>Replay</b>', 'start', 'pri');
      else html = P('stop', 'Stop', 'stop', 'err') + (st.paused ? P('play', 'Resume', 'resume') : P('pause', 'Pause', 'pause'));
      el.innerHTML = html;
    },

    _act: function (a) {
      var st = this.st;
      if (a === 'start') this.start();
      else if (a === 'pause') { st.paused = true; this._renderActs(); this._renderStatus(); this.onEvent('pause'); }
      else if (a === 'resume') { st.paused = false; this._renderActs(); this._renderStatus(); }
      else if (a === 'stop') this.stop();
      else if (a === 'clear') { this.seed += 7; this.newRoute(); U.toast(this.screen, 'New route generated', 1400); }
    },

    /* ───────── route + simulation ───────── */
    newRoute: function (first) {
      var p = this.place, tx = Math.floor(p.wx / T), ty = Math.floor(p.wy / T), r = null, tries = 0;
      while (!r && tries++ < 20) r = MP.map.genRoute(tx + ((tries * 3) % 5), ty + ((tries * 2) % 4), this.seed + tries, 6, 8);
      var pts = r.pts, cum = [0], i;
      for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      this.R = { pts: pts, cum: cum, L: cum[cum.length - 1], junc: r.junctions };
      var n = r.junctions.length, wi = [Math.round(n * 0.38), Math.round(n * 0.68)];
      this.R.way = wi.filter(function (k, j, a) { return k > 0 && k < n - 1 && a.indexOf(k) === j; }).map(function (k) { return r.junctions[k]; });
      this.mpp = geo.mppAt(pts[0][1]);
      this._factors();
      this.st.state = 'idle'; this.st.paused = false;
      this.sim = { d: 0, dir: 1, v: 0, traveled: 0, rt: 1, loops: 0 };
      this._renderActs(); this._renderStatus();
      this.q('[data-title]').textContent = 'Route Preview';
      this._updateChips();
      this._fit(first);
      this.onEvent('route');
    },

    _factors: function () {
      var R = this.R, pts = R.pts, cum = R.cum, n = pts.length, f = new Array(n), i, W = 22;
      function at(s) { s = Math.max(0, Math.min(R.L, s)); var lo = 0, hi = n - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } var t = (s - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * t, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * t]; }
      R.at = at;
      for (i = 0; i < n; i++) {
        var s = cum[i], a = at(s - W), b = at(s), c = at(s + W);
        var h1 = Math.atan2(b[0] - a[0], -(b[1] - a[1])), h2 = Math.atan2(c[0] - b[0], -(c[1] - b[1]));
        var turn = Math.abs(angDiff(h1, h2));
        f[i] = 1 - 0.66 * smooth(0.18, 1.35, turn);
      }
      R.f = f; R.ff = new Array(n); R.fb = new Array(n);
      for (i = 0; i < n; i++) {
        var mn = 1, j; for (j = i; j < n && cum[j] - cum[i] < 46; j++) mn = Math.min(mn, f[j]); R.ff[i] = mn;
        mn = 1; for (j = i; j >= 0 && cum[i] - cum[j] < 46; j--) mn = Math.min(mn, f[j]); R.fb[i] = mn;
      }
    },

    _idx: function (d) { var cum = this.R.cum, lo = 0, hi = cum.length - 1; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; } return lo; },

    _fit: function (instant) {
      var v = this.view, pts = this.R.pts, x0 = 1e18, x1 = -1e18, y0 = 1e18, y1 = -1e18;
      pts.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      var freeTop = 104, freeBot = 740 - 20 - (this.q('[data-panel]').offsetHeight || 205) - 14;
      var w = 360 - 70, h = Math.max(180, freeBot - freeTop - 24);
      var s = Math.max(0.58, Math.min(1.35, Math.min(w / (x1 - x0 + 40), h / (y1 - y0 + 40))));
      var cy = (freeTop + freeBot) / 2;
      this._camTarget = null;
      this.fitState = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: s, ay: cy };
      this.anchorY = cy; v.setAnchorPx(180, cy);
      v.tilt.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)';
      v.tilt.style.transform = 'none';
      v.cam.bearing = 0;
      if (instant) { v.jump(this.fitState.cx, this.fitState.cy, s); }
      else v.flyTo(this.fitState.cx, this.fitState.cy, { scale: s, dur: 0.7 });
    },

    start: function () {
      var st = this.st, v = this.view;
      st.state = 'active'; st.paused = false;
      this.sim = { d: 0, dir: 1, v: 0, traveled: 0, rt: 1, loops: 0 };
      this.interacted = true; this._hintOff();
      this.setExpanded(false);
      this.q('[data-title]').textContent = 'Navigating';
      this._renderActs(); this._renderStatus();
      var p0 = this.R.at(0);
      v.fly = null;
      this.follow = { x: p0[0], y: p0[1], ready: false };
      // ease the camera onto the dot, then lock into follow mode (zoom 17, tilt 45°)
      v.tilt.style.transition = 'transform .9s cubic-bezier(.2,.8,.2,1)';
      v.tilt.style.transform = 'perspective(680px) rotateX(45deg)';
      v.flyTo(p0[0], p0[1], { scale: 1.85, dur: 0.8 });
      this.onEvent('start');
    },

    stop: function () {
      var st = this.st;
      st.state = 'idle'; st.paused = false;
      this.sim = { d: 0, dir: 1, v: 0, traveled: 0, rt: 1, loops: 0 };
      this.q('[data-title]').textContent = 'Route Preview';
      this._renderActs(); this._renderStatus(); this._updateChips();
      this._fit(false);
      this.onEvent('stop');
    },

    _updateChips: function () {
      var st = this.st, sim = this.sim, R = this.R, kmTotal = R.L * this.mpp / 1000, rem, eta, spd = Math.max(0.1, st.speed) / 3.6;
      if (st.state === 'active') {
        var left = sim.dir > 0 ? R.L - sim.d : sim.d;
        rem = left * this.mpp / 1000; eta = (left * this.mpp) / Math.max(spd * (st.corner ? 0.82 : 1), 0.5);
      } else { rem = kmTotal; eta = (kmTotal * 1000) / spd * (st.corner ? 1.08 : 1); }
      this.q('[data-dist]').textContent = fmtDist(rem);
      this.q('[data-eta]').textContent = st.speed <= 0 ? '—' : fmtTime(eta);
    },

    /* ───────── per-frame ───────── */
    _frame: function (dt, t) {
      var st = this.st, sim = this.sim, R = this.R, v = this.view;
      if (st.state === 'active' && !st.paused) this._advance(dt, t);

      // telemetry position + heading
      var pos = R.at(sim.d), idx = this._idx(sim.d);
      var ahead = R.at(sim.d + sim.dir * 7), hd = Math.atan2(ahead[0] - pos[0], -(ahead[1] - pos[1]));
      if (st.state !== 'idle' || true) this.heading += angDiff(this.heading, hd) * Math.min(1, dt * 7);
      this.pos = pos;

      // follow camera (heading-up, tilted 45°) — keep blue dot in the open map area above the control sheet
      if (st.state === 'active' && !st.paused && !v.dragging) {
        var k = 1 - Math.exp(-dt * 9);
        if (!v.fly) {
          v.cam.x += (pos[0] - v.cam.x) * k; v.cam.y += (pos[1] - v.cam.y) * k;
          v.cam.scale += (1.85 - v.cam.scale) * k;
        }
        var db = angDiff(v.cam.bearing, this.heading);
        v.cam.bearing += db * Math.min(1, dt * 4.2);
        var panelH = this.q('[data-panel]').offsetHeight || 260;
        var freeBot = 740 - 20 - panelH;
        var navAnchorY = Math.max(200, Math.min(315, 96 + (freeBot - 96) * 0.62));
        this.anchorY += (navAnchorY - this.anchorY) * Math.min(1, dt * 4);
        v.setAnchorPx(180, this.anchorY);
      } else if (st.state === 'active' && st.paused) {
        // hold
      } else if (st.state === 'completed') {
        // hold
      }
      if (st.state === 'idle') {
        v.cam.bearing += angDiff(v.cam.bearing, 0) * Math.min(1, dt * 5);
        this.anchorY += (this.fitState.ay - this.anchorY) * Math.min(1, dt * 5);
        v.setAnchorPx(180, this.anchorY);
      }

      // live UI
      if (st.state === 'active') {
        var p = sim.dir > 0 ? sim.d / R.L : (R.L - sim.d) / R.L;
        if (st.mode === 'reverse' && sim.dir < 0) p = (R.L - sim.d) / R.L;
        var b = this.q('[data-sbar]');
        if (b) {
          b.style.width = (p * 100).toFixed(1) + '%';
          this.q('[data-spct]').textContent = Math.round(p * 100) + '%';
          this.q('[data-str]').textContent = 'Traveled: ' + fmtDist(sim.traveled * this.mpp / 1000);
          this.q('[data-sspd]').textContent = 'Speed: ' + Math.round(sim.v * 3.6) + ' km/h';
        }
        this._updateChips();
      }
      // telemetry card @ ~12 Hz
      this._tt = (this._tt || 0) + dt;
      if (this._tt > 0.08) {
        this._tt = 0;
        var ll = geo.fromWorld(pos[0], pos[1]);
        var drift = st.drift ? (0.55 + 0.45 * Math.sin(t * 1.3) * Math.sin(t * 0.37 + 1)) : 0;
        var acc = st.acc * (1 + drift * (st.drift ? 0.9 : 0)) + (st.drift ? Math.abs(Math.sin(t * 2.1)) * 1.2 : 0);
        this.accNow = acc;
        this.onTelemetry({
          lat: ll.lat, lng: ll.lng, speed: sim.v, bearing: ((this.heading * 180 / Math.PI) % 360 + 360) % 360,
          accuracy: acc, altitude: st.alt + (st.state === 'active' ? Math.sin(t * 0.8) * 0.4 : 0), active: st.state === 'active' && !st.paused, state: st.state
        });
      }
    },

    _advance: function (dt, t) {
      var st = this.st, sim = this.sim, R = this.R, idx = this._idx(sim.d);
      var base = st.speed / 3.6; // m/s
      // real-time mode: wander between 70 % and 120 %
      if (st.realTime) {
        var target = 0.95 + 0.25 * Math.sin(t * 0.55 + 1.7 * Math.sin(t * 0.17));
        sim.rt += (target - sim.rt) * Math.min(1, dt * 1.5);
      } else sim.rt += (1 - sim.rt) * Math.min(1, dt * 3);
      var fac = 1;
      if (st.corner) fac = sim.dir > 0 ? R.ff[idx] : R.fb[idx];
      var want = base * fac * sim.rt;
      var acc = 5.2, dec = 7.5;
      sim.v += Math.max(-dec * dt, Math.min(acc * dt, want - sim.v));
      if (base === 0) sim.v = 0;
      var step = (sim.v * dt) / this.mpp;
      sim.d += sim.dir * step; sim.traveled += step;
      if (sim.dir > 0 && sim.d >= R.L) this._arrive(R.L);
      else if (sim.dir < 0 && sim.d <= 0) this._arrive(0);
    },

    _arrive: function (end) {
      var st = this.st, sim = this.sim;
      if (st.mode === 'loop') { sim.d = 0; sim.dir = 1; sim.loops++; this.onEvent('loop'); }
      else if (st.mode === 'reverse') { sim.d = end; sim.dir = end > 0 ? -1 : 1; sim.loops++; this.onEvent('patrol'); }
      else {
        sim.d = end; sim.v = 0; st.state = 'completed';
        this.q('[data-title]').textContent = 'Route Preview';
        this._renderActs(); this._renderStatus();
        this.view.cam.x = this.R.at(sim.d)[0]; this.view.cam.y = this.R.at(sim.d)[1];
        this.onEvent('complete');
      }
    },

    /* ───────── drawing ───────── */
    _pin: function (ctx, x, y, color, label, sc) {
      var s = sc || 1;
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s);
      ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.bezierCurveTo(-4, -8, -13, -14, -13, -24); ctx.arc(0, -24, 13, Math.PI, 0); ctx.bezierCurveTo(13, -14, 4, -8, 0, 0);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.beginPath(); ctx.arc(0, -24, 5.2, 0, 6.2832); ctx.fillStyle = label ? 'rgba(255,255,255,0)' : '#fff'; if (!label) ctx.fill();
      if (label) { ctx.fillStyle = '#fff'; ctx.font = '700 12px Poppins, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -23.5); }
      ctx.restore();
    },

    _draw: function (ctx, v) {
      var R = this.R, pts = R.pts, st = this.st, i, s;
      if (!R) return;
      // polyline (screen-space width so it reads at every zoom, like Maps' px widths)
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (i = 0; i < pts.length; i++) { s = v.worldToScreen(pts[i][0], pts[i][1]); if (i) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); }
      var lw = Math.max(5, Math.min(9, 5 + v.cam.scale * 1.1));
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = lw + 3; ctx.stroke();
      ctx.strokeStyle = COL.line; ctx.lineWidth = lw; ctx.stroke();
      ctx.restore();

      // markers upright (billboards) — start, numbered waypoints, destination
      var sc = Math.max(0.78, Math.min(1.15, 0.7 + v.cam.scale * 0.28));
      var a = v.worldToScreen(pts[pts.length - 1][0], pts[pts.length - 1][1]);
      this._pin(ctx, a[0], a[1], COL.end, '', sc);
      R.way.forEach(function (ji, n) { var w = v.worldToScreen(pts[ji][0], pts[ji][1]); this._pin(ctx, w[0], w[1], COL.way, String(n + 1), sc * 0.92); }, this);
      var b = v.worldToScreen(pts[0][0], pts[0][1]);
      this._pin(ctx, b[0], b[1], COL.start, '', sc);

      // blue dot + accuracy ring (visible once the run begins)
      if (st.state !== 'idle') {
        var p = this.pos, d = v.worldToScreen(p[0], p[1]);
        var accPx = (this.accNow || st.acc) / this.mpp * v.cam.scale;
        var rr = Math.max(13, Math.min(accPx, 150));
        ctx.save();
        ctx.beginPath(); ctx.arc(d[0], d[1], rr, 0, 6.2832);
        ctx.fillStyle = 'rgba(66,133,244,.16)'; ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(66,133,244,.35)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(d[0], d[1], 10, 0, 6.2832); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 5; ctx.fill(); ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(d[0], d[1], 7, 0, 6.2832); ctx.fillStyle = COL.dot; ctx.fill();
        // heading wedge
        var hr = this.heading - v.cam.bearing;
        ctx.translate(d[0], d[1]); ctx.rotate(hr);
        ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(-5, -11); ctx.lineTo(5, -11); ctx.closePath(); ctx.fillStyle = COL.dot; ctx.fill();
        ctx.restore();
      }
    }
  };

  MP.RouteDemo = RouteDemo;
  MP.fmt = { dist: fmtDist, time: fmtTime };
})(window);

