/*!
 * Mappr marketing site — procedural, infinite, seamless map engine.
 *
 * Every tile is a pure function of (tx, ty, style): roads are wiggly bezier "spokes"
 * that meet at deterministic edge points, so neighbouring tiles always line up and the
 * world never ends. Parks, lakes and rivers come from value noise sampled in world
 * space, so they flow across tile borders too. Nothing is downloaded.
 *
 * Exposes window.MP.map  { MapView, genRoute, geo, ... }
 */
(function (global) {
  'use strict';
  var MP = (global.MP = global.MP || {});

  var T = 160; // tile size, world px
  var TR = 2; // tile raster scale (backing px per world px)
  var MPP = 0.8; // metres per world px at the equator, scale 1

  /* ───────────────────────── deterministic noise ───────────────────────── */

  function rnd(x, y, s) {
    var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, s) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var a = rnd(xi, yi, s), b = rnd(xi + 1, yi, s), c = rnd(xi, yi + 1, s), d = rnd(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s) {
    return vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.28 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.12;
  }
  function smooth(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }

  /* ─────────────────────────────── styles ─────────────────────────────── */

  var STYLES = {
    light: {
      land: '#F3F4F1', park: '#CDE9C6', water: '#A8D4F2', texture: false,
      blds: ['#E7E8E3', '#E4E5E0', '#EAEAE6'],
      minorCase: '#D9DCD6', minor: '#FFFFFF', majorCase: '#E4B84B', major: '#FFE08F',
      buildings: true, landuse: true
    },
    sat: {
      land: '#46533A', landB: '#566644', park: '#2F5A31', water: '#1B3A57', texture: true,
      blds: ['#7A7567', '#8B8575', '#6B6657', '#A19A86'],
      minorCase: '#3F3E37', minor: '#8C887B', majorCase: '#5C5543', major: '#B8AE8F',
      buildings: true, landuse: true
    },
    hero: {
      land: '#EEF2F7', park: '#DCE8E2', water: '#CEE5FF', texture: false,
      blds: ['#DEE3EB'],
      minorCase: '#D5E4F7', minor: '#FFFFFF', majorCase: '#C2C7CF', major: '#FFFFFF',
      buildings: false, landuse: true
    }
  };
  Object.keys(STYLES).forEach(function (k) {
    var s = STYLES[k];
    s.parkRGB = hex(s.park);
    s.waterRGB = hex(s.water);
    s.landRGB = hex(s.land);
    s.landBRGB = hex(s.landB || s.land);
  });

  /* ────────────────────────── road network (spokes) ────────────────────────── */

  var spokeCache = new Map();

  function bez(c, e, horizontal, wig) {
    if (horizontal) {
      var dx = e[0] - c[0];
      return [c[0], c[1], c[0] + dx * 0.5, c[1] + wig, e[0] - dx * 0.5, e[1], e[0], e[1]];
    }
    var dy = e[1] - c[1];
    return [c[0], c[1], c[0] + wig, c[1] + dy * 0.5, e[0], e[1] - dy * 0.5, e[0], e[1]];
  }
  function bezAt(b, t) {
    var u = 1 - t;
    var a = u * u * u, bb = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t;
    return [a * b[0] + bb * b[2] + cc * b[4] + d * b[6], a * b[1] + bb * b[3] + cc * b[5] + d * b[7]];
  }
  function bezTan(b, t) {
    var u = 1 - t;
    var x = 3 * u * u * (b[2] - b[0]) + 6 * u * t * (b[4] - b[2]) + 3 * t * t * (b[6] - b[4]);
    var y = 3 * u * u * (b[3] - b[1]) + 6 * u * t * (b[5] - b[3]) + 3 * t * t * (b[7] - b[5]);
    var l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  }

  /** Spokes for tile (tx,ty). dir index: 0=E 1=S 2=W 3=N. */
  function spokeSet(tx, ty) {
    var key = tx + ',' + ty;
    var hit = spokeCache.get(key);
    if (hit) return hit;
    var c = [T * (0.3 + 0.4 * rnd(tx, ty, 13)), T * (0.3 + 0.4 * rnd(tx, ty, 14))];
    var out = { c: c, s: [] };
    var defs = [
      // E: edge owned by this tile
      { px: tx, py: ty, kind: 21, pres: 23, ep: [T, T * (0.18 + 0.64 * rnd(tx, ty, 11))], h: true },
      // S
      { px: tx, py: ty, kind: 22, pres: 24, ep: [T * (0.18 + 0.64 * rnd(tx, ty, 12)), T], h: false },
      // W: edge owned by neighbour on the left
      { px: tx - 1, py: ty, kind: 21, pres: 23, ep: [0, T * (0.18 + 0.64 * rnd(tx - 1, ty, 11))], h: true },
      // N: edge owned by neighbour above
      { px: tx, py: ty - 1, kind: 22, pres: 24, ep: [T * (0.18 + 0.64 * rnd(tx, ty - 1, 12)), 0], h: false }
    ];
    for (var i = 0; i < 4; i++) {
      var d = defs[i];
      var present = rnd(d.px, d.py, d.pres) > 0.1;
      var cls = rnd(d.px, d.py, d.kind) < 0.2 ? 'major' : 'minor';
      var wig = (rnd(tx, ty, 30 + i) - 0.5) * 2 * T * 0.22;
      out.s.push({ dir: i, present: present, cls: cls, b: bez(c, d.ep, d.h, wig) });
    }
    // little side streets (decorative only — never part of a route)
    out.branches = [];
    for (var k = 0; k < 2; k++) {
      var sp = out.s[Math.floor(rnd(tx, ty, 40 + k) * 4)];
      if (!sp.present) continue;
      var t = 0.3 + 0.4 * rnd(tx, ty, 44 + k);
      var p = bezAt(sp.b, t), tg = bezTan(sp.b, t);
      var sign = rnd(tx, ty, 48 + k) < 0.5 ? -1 : 1;
      var nx = -tg[1] * sign, ny = tg[0] * sign;
      var len = 26 + 40 * rnd(tx, ty, 52 + k);
      var bend = (rnd(tx, ty, 56 + k) - 0.5) * 30;
      out.branches.push({
        p: p,
        q: [p[0] + nx * len * 0.5 + tg[0] * bend, p[1] + ny * len * 0.5 + tg[1] * bend],
        e: [p[0] + nx * len, p[1] + ny * len],
        dot: rnd(tx, ty, 60 + k) < 0.5
      });
    }
    spokeCache.set(key, out);
    if (spokeCache.size > 4000) spokeCache.delete(spokeCache.keys().next().value);
    return out;
  }

  function sampleBez(b, reverse) {
    var len = 0, i, prev = [b[0], b[1]], p;
    for (i = 1; i <= 8; i++) {
      p = bezAt(b, i / 8);
      len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
    }
    var n = Math.max(6, Math.ceil(len / 3));
    var pts = [];
    for (i = 0; i <= n; i++) pts.push(bezAt(b, i / n));
    return reverse ? pts.reverse() : pts;
  }

  var DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

  /**
   * Random walk along real generated roads. Returns dense world-space points plus
   * junction indices for waypoint markers.
   */
  function genRoute(tx0, ty0, seed, minSteps, maxSteps) {
    minSteps = minSteps || 8;
    maxSteps = maxSteps || 10;
    for (var attempt = 0; attempt < 80; attempt++) {
      var tx = tx0, ty = ty0, came = -1, last = -1;
      var path = [], seen = {};
      seen[tx + ',' + ty] = 1;
      for (var step = 0; step < maxSteps; step++) {
        var S = spokeSet(tx, ty);
        var opts = [];
        for (var d = 0; d < 4; d++) {
          if (!S.s[d].present || d === came) continue;
          if (seen[(tx + DX[d]) + ',' + (ty + DY[d])]) continue;
          // the neighbour must actually have a road back (it always does — shared edge)
          opts.push(d);
        }
        if (!opts.length) break;
        var w = opts.map(function (d) { return d === last ? 2.4 : 1; });
        var sum = w.reduce(function (a, b) { return a + b; }, 0);
        var r = rnd(attempt * 131 + step, seed, 77) * sum, pick = opts[0];
        for (var i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) { pick = opts[i]; break; } }
        path.push({ tx: tx, ty: ty, inD: came, outD: pick });
        tx += DX[pick]; ty += DY[pick];
        came = (pick + 2) % 4; last = pick;
        seen[tx + ',' + ty] = 1;
      }
      if (path.length < minSteps) continue;
      path.push({ tx: tx, ty: ty, inD: came, outD: -1 });

      var pts = [], junctions = [];
      path.forEach(function (st) {
        var S = spokeSet(st.tx, st.ty), ox = st.tx * T, oy = st.ty * T;
        function add(seg) {
          seg.forEach(function (p) {
            var q = [p[0] + ox, p[1] + oy];
            var lp = pts[pts.length - 1];
            if (lp && Math.hypot(lp[0] - q[0], lp[1] - q[1]) < 0.5) return;
            pts.push(q);
          });
        }
        if (st.inD >= 0) add(sampleBez(S.s[st.inD].b, true));
        else add([S.c]);
        junctions.push(pts.length - 1); // the intersection at the tile centre
        if (st.outD >= 0) add(sampleBez(S.s[st.outD].b, false));
      });
      return { pts: pts, junctions: junctions, tiles: path };
    }
    return null;
  }

  /* ───────────────────────────── tile painting ───────────────────────────── */

  var luCanvas = null;

  function paintLanduse(g, tx, ty, st) {
    var N = 112;
    if (!luCanvas) luCanvas = document.createElement('canvas');
    luCanvas.width = luCanvas.height = N;
    var c = luCanvas.getContext('2d');
    var img = c.createImageData(N, N), d = img.data;
    var step = T / N, x0 = tx * T, y0 = ty * T;
    var pc = st.parkRGB, wc = st.waterRGB, lc = st.landRGB, lb = st.landBRGB, tex = st.texture;
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var wx = x0 + (i + 0.5) * step, wy = y0 + (j + 0.5) * step;
        var w = fbm(wx / 1500, wy / 1500, 31);
        var p = fbm(wx / 560, wy / 560, 37);
        var r = Math.abs(fbm(wx / 950, wy / 950, 41) - 0.5);
        var pa = smooth(0.62, 0.627, p);
        var wa = Math.max(smooth(0.645, 0.652, w), 1 - smooth(0.010, 0.014, r));
        var a0 = 0, R = 0, G = 0, B = 0;
        if (tex) {
          var m = fbm(wx / 38, wy / 38, 53);
          a0 = 1;
          R = (lc[0] + (lb[0] - lc[0]) * m) * a0;
          G = (lc[1] + (lb[1] - lc[1]) * m) * a0;
          B = (lc[2] + (lb[2] - lc[2]) * m) * a0;
        }
        var A = a0;
        if (pa > 0) {
          var pm = tex ? 0.82 + 0.3 * fbm(wx / 30, wy / 30, 57) : 1;
          R = pc[0] * pm * pa + R * (1 - pa); G = pc[1] * pm * pa + G * (1 - pa); B = pc[2] * pm * pa + B * (1 - pa);
          A = pa + A * (1 - pa);
        }
        if (wa > 0) {
          R = wc[0] * wa + R * (1 - wa); G = wc[1] * wa + G * (1 - wa); B = wc[2] * wa + B * (1 - wa);
          A = wa + A * (1 - wa);
        }
        var k = (j * N + i) * 4;
        if (A > 0) {
          d[k] = Math.min(255, R / A); d[k + 1] = Math.min(255, G / A); d[k + 2] = Math.min(255, B / A);
          d[k + 3] = A * 255;
        }
      }
    }
    c.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(luCanvas, 0, 0, T, T);
  }

  function isWild(wx, wy) {
    return fbm(wx / 560, wy / 560, 37) > 0.615 || fbm(wx / 1500, wy / 1500, 31) > 0.64 ||
      Math.abs(fbm(wx / 950, wy / 950, 41) - 0.5) < 0.014;
  }

  function paintBuildings(g, tx, ty, st) {
    var x0 = tx * T, y0 = ty * T;
    for (var k = 0; k < 20; k++) {
      var x = 10 + rnd(tx, ty, 100 + k * 3) * (T - 30);
      var y = 10 + rnd(tx, ty, 101 + k * 3) * (T - 30);
      if (isWild(x0 + x, y0 + y)) continue;
      var w = 7 + rnd(tx, ty, 102 + k * 3) * 13, h = 6 + rnd(tx, ty, 103 + k * 3) * 11;
      g.fillStyle = st.blds[Math.floor(rnd(tx, ty, 200 + k) * st.blds.length)];
      g.fillRect(x, y, w, h);
    }
  }

  function strokeBez(g, b) {
    g.beginPath();
    g.moveTo(b[0], b[1]);
    g.bezierCurveTo(b[2], b[3], b[4], b[5], b[6], b[7]);
    g.stroke();
  }

  function paintRoads(g, tx, ty, st) {
    var S = spokeSet(tx, ty);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    var roads = S.s.filter(function (s) { return s.present; });
    // pass 1: casings, pass 2: fills — minor first, majors on top
    [['case', 'minor'], ['case', 'major'], ['fill', 'minor'], ['fill', 'major']].forEach(function (pass) {
      var isCase = pass[0] === 'case', cls = pass[1];
      g.strokeStyle = isCase ? st[cls + 'Case'] : st[cls];
      g.lineWidth = cls === 'major' ? (isCase ? 12.5 : 9.5) : (isCase ? 8 : 5.6);
      roads.forEach(function (r) { if (r.cls === cls) strokeBez(g, r.b); });
      if (cls === 'minor') {
        S.branches.forEach(function (b) {
          g.lineWidth = isCase ? 7 : 4.6;
          g.beginPath();
          g.moveTo(b.p[0], b.p[1]);
          g.quadraticCurveTo(b.q[0], b.q[1], b.e[0], b.e[1]);
          g.stroke();
          if (b.dot) {
            g.beginPath();
            g.arc(b.e[0], b.e[1], isCase ? 5.4 : 3.6, 0, 6.2832);
            g.fillStyle = g.strokeStyle;
            g.fill();
          }
        });
      }
    });
  }

  function genTile(tx, ty, st) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = T * TR;
    var g = cv.getContext('2d');
    g.fillStyle = st.land;
    g.fillRect(0, 0, T * TR, T * TR);
    g.save();
    g.scale(TR, TR);
    if (st.landuse) paintLanduse(g, tx, ty, st);
    if (st.buildings) paintBuildings(g, tx, ty, st);
    paintRoads(g, tx, ty, st);
    g.restore();
    return cv;
  }

  /* ─────────────────────────────── geography ─────────────────────────────── */

  var PLACES = [
    { id: 'nyc', name: 'Times Square', city: 'New York', district: 'Midtown', lat: 40.758, lng: -73.9855, addr: 'Times Square, Manhattan, New York, NY 10036, USA' },
    { id: 'paris', name: 'Eiffel Tower', city: 'Paris', district: '7th arrondissement', lat: 48.8584, lng: 2.2945, addr: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France' },
    { id: 'tokyo', name: 'Shibuya Crossing', city: 'Tokyo', district: 'Shibuya City', lat: 35.6595, lng: 139.7005, addr: '2 Chome-2-1 Dogenzaka, Shibuya City, Tokyo, Japan' },
    { id: 'london', name: 'Tower Bridge', city: 'London', district: 'Southwark', lat: 51.5055, lng: -0.0754, addr: 'Tower Bridge Rd, London SE1 2UP, United Kingdom' },
    { id: 'dubai', name: 'Burj Khalifa', city: 'Dubai', district: 'Downtown Dubai', lat: 25.1972, lng: 55.2744, addr: '1 Sheikh Mohammed bin Rashid Blvd, Dubai, UAE' },
    { id: 'sydney', name: 'Sydney Opera House', city: 'Sydney', district: 'Bennelong Point', lat: -33.8568, lng: 151.2153, addr: 'Bennelong Point, Sydney NSW 2000, Australia' },
    { id: 'lahore', name: 'Badshahi Mosque', city: 'Lahore', district: 'Walled City', lat: 31.5882, lng: 74.3105, addr: 'Walled City of Lahore, Punjab, Pakistan' },
    { id: 'sf', name: 'Golden Gate Bridge', city: 'San Francisco', district: 'Presidio', lat: 37.8199, lng: -122.4783, addr: 'Golden Gate Bridge, San Francisco, CA, USA' }
  ];
  // Global web-mercator world: any lat/lng maps to one unique, stable pixel — so typing real
  // coordinates always lands somewhere the generator can draw, and lat/lng read-outs round-trip.
  var WORLD = 40075016.686 / MPP; // world width in px
  function mercY(lat) {
    var s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
    return WORLD * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI));
  }
  function mercLat(y) {
    var n = Math.PI - (2 * Math.PI * y) / WORLD;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  }
  PLACES.forEach(function (p) {
    p.wx = ((p.lng + 180) / 360) * WORLD;
    p.wy = mercY(p.lat);
  });

  var STREETS = ['Maple', 'Cedar', 'Willow', 'Harbor', 'Orchard', 'Summit', 'Lakeview', 'Ridge', 'Elm', 'Juniper', 'Sycamore', 'Bayshore', 'Linden', 'Aspen', 'Granite', 'Meadow'];
  var SUFFIX = ['Street', 'Avenue', 'Road', 'Lane', 'Boulevard', 'Drive'];

  function nearestPlace(lat, lng) {
    var best = null, bd = 1e12;
    PLACES.forEach(function (p) {
      var dy = (lat - p.lat) * 111320, dx = (lng - p.lng) * 111320 * Math.cos((p.lat * Math.PI) / 180);
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    });
    return { place: best, km: Math.sqrt(bd) / 1000 };
  }

  var geo = {
    places: PLACES,
    place: function (id) { return PLACES.filter(function (p) { return p.id === id; })[0]; },
    fromWorld: function (wx, wy) {
      return { lat: mercLat(wy), lng: (wx / WORLD) * 360 - 180 };
    },
    toWorld: function (lat, lng) {
      return { x: ((lng + 180) / 360) * WORLD, y: mercY(lat) };
    },
    /** True metres per world px at this latitude. */
    mppAt: function (wy) { return MPP * Math.cos((mercLat(wy) * Math.PI) / 180); },
    /** Reverse-geocode look-alike: landmark when on one, otherwise a stable fake street address. */
    addressAt: function (wx, wy) {
      for (var i = 0; i < PLACES.length; i++) {
        if (Math.hypot(wx - PLACES[i].wx, wy - PLACES[i].wy) < 70) return PLACES[i].addr;
      }
      var ll = geo.fromWorld(wx, wy);
      var near = nearestPlace(ll.lat, ll.lng);
      var tx = Math.floor(wx / T), ty = Math.floor(wy / T);
      if (near.km > 60) return 'Unnamed Road, ' + ll.lat.toFixed(4) + ', ' + ll.lng.toFixed(4);
      var st = STREETS[Math.floor(rnd(tx, ty, 61) * STREETS.length)];
      var sf = SUFFIX[Math.floor(rnd(tx, ty, 62) * SUFFIX.length)];
      var no = 10 + Math.floor(rnd(tx, ty, 63) * 380) + Math.floor((((wx % T) + T) % T) / 16) * 2;
      return no + ' ' + st + ' ' + sf + ', ' + near.place.district + ', ' + near.place.city;
    },
    fmt: function (v) { return v.toFixed(6); }
  };


  /* ──────────────────────────────── MapView ──────────────────────────────── */

  var reducedMotion = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function MapView(host, o) {
    this.host = host;
    this.o = Object.assign({ style: 'light', overscan: 1, draggable: true, minScale: 0.4, maxScale: 2.4, fps: 60, drift: null }, o || {});
    this.styleName = this.o.style;
    this.cam = { x: 0, y: 0, scale: 1, bearing: 0 };
    this.anchor = { x: 0.5, y: 0.5 };
    this.layers = [];
    this.tiles = new Map();
    this.queue = [];
    this.queued = new Set();
    this.frame = 0;
    this.visible = true;
    this.fly = null;
    this.vel = { x: 0, y: 0 };
    this.dragging = false;
    this.onFrame = null;
    this.onMove = null;
    this.onDragStart = null;
    this._first = true;

    this.tilt = document.createElement('div');
    this.tilt.className = 'mv-tilt';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'mv-canvas';
    this.tilt.appendChild(this.canvas);
    host.appendChild(this.tilt);
    this.ctx = this.canvas.getContext('2d');

    var self = this;
    this.resize();
    if (global.ResizeObserver) new ResizeObserver(function () { self.resize(); }).observe(host);
    global.addEventListener('resize', function () { self.resize(); });
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; }, { rootMargin: '120px' }).observe(host);
    }
    if (this.o.draggable) this._bindDrag();
    this.last = performance.now();
    this._loop = this._loop.bind(this);
    global.requestAnimationFrame(this._loop);
  }

  MapView.prototype = {
    get style() { return STYLES[this.styleName]; },

    setStyle: function (name) { this.styleName = name; },

    /** Backing-pixel-per-css-pixel including any ancestor transform (phone fit). */
    _sf: function () {
      var r = this.host.getBoundingClientRect();
      return this.host.offsetWidth ? r.width / this.host.offsetWidth : 1;
    },

    resize: function () {
      var os = this.o.overscan;
      var hw = this.host.clientWidth, hh = this.host.clientHeight;
      if (!hw || !hh) return;
      this.hostW = hw; this.hostH = hh;
      this.w = hw * os; this.h = hh * os;
      this.off = { x: ((os - 1) / 2) * hw, y: ((os - 1) / 2) * hh };
      var t = this.tilt.style;
      t.width = this.w + 'px'; t.height = this.h + 'px';
      t.left = -this.off.x + 'px'; t.top = -this.off.y + 'px';
      var r = Math.min(2, global.devicePixelRatio || 1) * this._sf();
      r = Math.max(1, Math.min(r, Math.sqrt(2400000 / (this.w * this.h))));
      this.r = r;
      this.canvas.width = Math.round(this.w * r);
      this.canvas.height = Math.round(this.h * r);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.setAnchorPx(this._apx != null ? this._apx : hw / 2, this._apy != null ? this._apy : hh / 2);
    },

    /** Place the camera centre at (px,py) measured in host (phone) css pixels. */
    setAnchorPx: function (px, py) {
      this._apx = px; this._apy = py;
      this.anchor.x = (px + this.off.x) / this.w;
      this.anchor.y = (py + this.off.y) / this.h;
      this.tilt.style.transformOrigin = (px + this.off.x) + 'px ' + (py + this.off.y) + 'px';
    },

    worldToScreen: function (wx, wy) {
      var c = this.cam, s = c.scale, b = c.bearing, cb = Math.cos(b), sb = Math.sin(b);
      var dx = (wx - c.x) * s, dy = (wy - c.y) * s;
      return [this.w * this.anchor.x + dx * cb + dy * sb, this.h * this.anchor.y - dx * sb + dy * cb];
    },
    screenToWorld: function (sx, sy) {
      var c = this.cam, b = c.bearing, cb = Math.cos(b), sb = Math.sin(b);
      var px = sx - this.w * this.anchor.x, py = sy - this.h * this.anchor.y;
      return [c.x + (px * cb - py * sb) / c.scale, c.y + (px * sb + py * cb) / c.scale];
    },
    /** Camera centre in world px — what the crosshair points at. */
    center: function () { return { x: this.cam.x, y: this.cam.y }; },

    jump: function (x, y, scale) {
      this.fly = null;
      this.cam.x = x; this.cam.y = y;
      if (scale) this.cam.scale = scale;
      this._first = true;
      this.warm();
      this.draw(0);
      if (this.onMove) this.onMove();
    },

    flyTo: function (x, y, o) {
      o = o || {};
      var far = Math.hypot(x - this.cam.x, y - this.cam.y) > 1600;
      var self = this;
      if (far) {
        this.canvas.style.transition = 'opacity .18s';
        this.canvas.style.opacity = '0';
        setTimeout(function () {
          self.jump(x - 120, y + 80, o.scale || self.cam.scale);
          self.canvas.style.opacity = '1';
          self.fly = { x0: self.cam.x, y0: self.cam.y, s0: self.cam.scale, x1: x, y1: y, s1: o.scale || self.cam.scale, t: 0, d: 0.7 };
        }, 190);
        return;
      }
      this.fly = { x0: this.cam.x, y0: this.cam.y, s0: this.cam.scale, x1: x, y1: y, s1: o.scale || this.cam.scale, t: 0, d: o.dur || 0.6 };
    },

    zoomBy: function (f) {
      var ns = Math.min(this.o.maxScale, Math.max(this.o.minScale, (this.fly ? this.fly.s1 : this.cam.scale) * f));
      this.fly = { x0: this.cam.x, y0: this.cam.y, s0: this.cam.scale, x1: this.cam.x, y1: this.cam.y, s1: ns, t: 0, d: 0.22 };
    },

    /** Generate the tiles under the camera immediately so the first paint is never empty. */
    warm: function () {
      var r = Math.hypot(this.w, this.h) / 2 / this.cam.scale;
      var x0 = Math.floor((this.cam.x - r) / T), x1 = Math.floor((this.cam.x + r) / T);
      var y0 = Math.floor((this.cam.y - r) / T), y1 = Math.floor((this.cam.y + r) / T);
      for (var ty = y0; ty <= y1; ty++) for (var tx = x0; tx <= x1; tx++) this._tile(tx, ty, true);
    },

    _tile: function (tx, ty, now) {
      var key = this.styleName + '|' + tx + '|' + ty;
      var t = this.tiles.get(key);
      if (t) { t.used = this.frame; return t.cv; }
      if (now) {
        t = { cv: genTile(tx, ty, this.style), used: this.frame };
        this.tiles.set(key, t);
        return t.cv;
      }
      if (!this.queued.has(key)) { this.queued.add(key); this.queue.push([tx, ty, key, this.styleName]); }
      return null;
    },

    _pump: function () {
      var t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 6) {
        var q = this.queue.shift();
        this.queued.delete(q[2]);
        if (!this.tiles.has(q[2])) this.tiles.set(q[2], { cv: genTile(q[0], q[1], STYLES[q[3]]), used: this.frame });
      }
      if (this.tiles.size > 450) {
        var arr = Array.from(this.tiles.entries()).sort(function (a, b) { return a[1].used - b[1].used; });
        for (var i = 0; i < 80; i++) this.tiles.delete(arr[i][0]);
      }
    },

    draw: function (dt) {
      var ctx = this.ctx, c = this.cam, r = this.r;
      ctx.setTransform(r, 0, 0, r, 0, 0);
      ctx.fillStyle = this.style.land;
      ctx.fillRect(0, 0, this.w, this.h);

      // visible world bounds (rotation-safe: take the 4 screen corners)
      var cs = [this.screenToWorld(0, 0), this.screenToWorld(this.w, 0), this.screenToWorld(0, this.h), this.screenToWorld(this.w, this.h)];
      var minx = Math.min(cs[0][0], cs[1][0], cs[2][0], cs[3][0]), maxx = Math.max(cs[0][0], cs[1][0], cs[2][0], cs[3][0]);
      var miny = Math.min(cs[0][1], cs[1][1], cs[2][1], cs[3][1]), maxy = Math.max(cs[0][1], cs[1][1], cs[2][1], cs[3][1]);
      var tx0 = Math.floor(minx / T), tx1 = Math.floor(maxx / T), ty0 = Math.floor(miny / T), ty1 = Math.floor(maxy / T);
      if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 450) return;

      ctx.save();
      ctx.translate(this.w * this.anchor.x, this.h * this.anchor.y);
      ctx.rotate(-c.bearing);
      ctx.scale(c.scale, c.scale);
      // Tile offsets are subtracted in double precision *before* reaching the canvas, whose
      // float32 matrices would otherwise shimmer at global-mercator magnitudes (~5e7 px).
      var wantNow = this._first;
      for (var ty = ty0; ty <= ty1; ty++) {
        for (var tx = tx0; tx <= tx1; tx++) {
          var cv = this._tile(tx, ty, wantNow);
          if (cv) ctx.drawImage(cv, tx * T - c.x - 0.35, ty * T - c.y - 0.35, T + 0.7, T + 0.7);
        }
      }
      ctx.restore();
      this._first = false;
      for (var i = 0; i < this.layers.length; i++) this.layers[i](ctx, this, dt);
    },

    _loop: function (now) {
      global.requestAnimationFrame(this._loop);
      var minDt = 1000 / this.o.fps;
      if (now - this.last < minDt - 2) return;
      var dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (!this.visible || document.hidden) return;
      this.frame++;
      var c = this.cam;

      if (this.o.drift && !reducedMotion) {
        c.x += this.o.drift[0] * dt; c.y += this.o.drift[1] * dt;
      }
      if (this.fly) {
        var f = this.fly;
        f.t += dt / f.d;
        var k = f.t >= 1 ? 1 : 1 - Math.pow(1 - f.t, 3);
        c.x = f.x0 + (f.x1 - f.x0) * k; c.y = f.y0 + (f.y1 - f.y0) * k; c.scale = f.s0 + (f.s1 - f.s0) * k;
        if (f.t >= 1) this.fly = null;
        if (this.onMove) this.onMove();
      } else if (!this.dragging && (Math.abs(this.vel.x) > 1 || Math.abs(this.vel.y) > 1)) {
        c.x += this.vel.x * dt; c.y += this.vel.y * dt;
        var decay = Math.pow(0.0025, dt);
        this.vel.x *= decay; this.vel.y *= decay;
        if (this.onMove) this.onMove();
      }
      if (this.onFrame) this.onFrame(dt, now / 1000);
      this._pump();
      this.draw(dt);
    },

    _bindDrag: function () {
      var self = this, host = this.host, id = null, lx = 0, ly = 0, lt = 0, moved = 0;
      host.style.touchAction = 'none';
      host.style.cursor = 'grab';
      host.addEventListener('pointerdown', function (e) {
        if (e.button > 0 || (self.o.canDrag && !self.o.canDrag())) return;
        if (e.target.closest && e.target.closest('[data-nodrag]')) return;
        id = e.pointerId; lx = e.clientX; ly = e.clientY; lt = performance.now(); moved = 0;
        host.setPointerCapture(id);
        self.dragging = true; self.fly = null; self.vel.x = self.vel.y = 0;
        host.style.cursor = 'grabbing';
        if (self.onDragStart) self.onDragStart();
      });
      host.addEventListener('pointermove', function (e) {
        if (e.pointerId !== id) return;
        var sf = self._sf(), now = performance.now(), dtm = Math.max(1, now - lt) / 1000;
        var dx = (e.clientX - lx) / sf, dy = (e.clientY - ly) / sf;
        lx = e.clientX; ly = e.clientY; lt = now; moved += Math.abs(dx) + Math.abs(dy);
        var b = self.cam.bearing, cb = Math.cos(b), sb = Math.sin(b);
        var wx = (dx * cb - dy * sb) / self.cam.scale, wy = (dx * sb + dy * cb) / self.cam.scale;
        self.cam.x -= wx; self.cam.y -= wy;
        self.vel.x = -wx / dtm * 0.6 + self.vel.x * 0.4; self.vel.y = -wy / dtm * 0.6 + self.vel.y * 0.4;
        if (self.onMove) self.onMove();
      });
      function end(e) {
        if (e.pointerId !== id) return;
        id = null; self.dragging = false; host.style.cursor = 'grab';
        if (performance.now() - lt > 90) self.vel.x = self.vel.y = 0;
      }
      host.addEventListener('pointerup', end);
      host.addEventListener('pointercancel', end);
    }
  };

  MP.map = {
    T: T, MPP: MPP, rnd: rnd, fbm: fbm, STYLES: STYLES,
    MapView: MapView, genRoute: genRoute, geo: geo, spokeSet: spokeSet
  };
})(window);
