/*!
 * Interactive replica of MapScreen.kt — drop the pin, tap Change.
 * Reproduces: search bar, lat/lng card, zoom card, schedule widget, the four FABs,
 * the Stop FAB, LocationInfoCard (Change + favourite hearts), and the app's dialogs.
 */
(function (global) {
  'use strict';
  var MP = global.MP, U = MP.ui, icon = U.icon, geo = MP.map.geo;

  var PIN = 'assets/map-pin.png';

  /* ── Exact Brand Logos & Checkmark from res/drawable/*.xml ── */
  var CHECKMARK_SVG =
    '<svg width="40" height="40" viewBox="0 0 11 11" aria-hidden="true">' +
      '<path fill="#2E7D32" d="M1.922,10.939C0.656,10.939 0,10.289 0,9.035V1.904C0,0.65 0.656,0 1.922,0H9.018C10.283,0 10.939,0.656 10.939,1.904V9.035C10.939,10.289 10.283,10.939 9.018,10.939H1.922Z"/>' +
      '<path fill="#ffffff" d="M4.834,8.361C5.051,8.361 5.238,8.25 5.373,8.051L8.115,3.773C8.197,3.645 8.268,3.498 8.268,3.363C8.268,3.059 8.004,2.854 7.711,2.854C7.523,2.854 7.359,2.953 7.236,3.158L4.811,7.037L3.68,5.602C3.533,5.414 3.393,5.344 3.211,5.344C2.906,5.344 2.672,5.59 2.672,5.889C2.672,6.035 2.725,6.176 2.83,6.305L4.266,8.051C4.43,8.262 4.611,8.361 4.834,8.361Z"/>' +
    '</svg>';

  var CHECKMARK_SM_SVG = CHECKMARK_SVG.replace('width="40" height="40"', 'width="18" height="18"');

  var BRAND_LOGOS = {
    google: '<svg width="34" height="34" viewBox="0 0 262 262" aria-hidden="true"><path fill="#4285F4" d="M258.88,133.45c0,-10.73 -0.87,-18.57 -2.76,-26.69L133.55,106.76v48.45h71.95c-1.45,12.04 -9.28,30.17 -26.69,42.36l-0.24,1.62 38.76,30.02 2.68,0.27c24.66,-22.77 38.88,-56.28 38.88,-96.03"/><path fill="#34A853" d="M133.55,261.1c35.25,0 64.84,-11.6 86.45,-31.62l-41.2,-31.91c-11.02,7.69 -25.82,13.06 -45.26,13.06 -34.52,0 -63.82,-22.77 -74.27,-54.25l-1.53,0.13 -40.3,31.19 -0.53,1.47C38.39,231.8 82.49,261.1 133.55,261.1"/><path fill="#FBBC05" d="M59.28,156.37c-2.76,-8.12 -4.35,-16.83 -4.35,-25.82 0,-8.99 1.6,-17.7 4.21,-25.82l-0.07,-1.73L18.26,71.31l-1.34,0.63C8.08,89.64 3,109.52 3,130.55s5.08,40.9 13.93,58.6l42.36,-32.78"/><path fill="#EB4335" d="M133.55,50.48c24.51,0 41.05,10.59 50.48,19.44l36.84,-35.97C198.24,12.91 168.8,0 133.55,0 82.49,0 38.39,29.3 16.92,71.95l42.21,32.78c10.59,-31.48 39.89,-54.25 74.41,-54.25"/></svg>',
    samsung: '<svg width="36" height="36" viewBox="0 0 200.78 200.78" aria-hidden="true"><path fill="#2d4f9e" d="M200.65,82.93C197.92,67.25 150.82,62.36 95.45,72 72.19,76.05 51.19,82.03 34.84,88.75c2.51,0.05 4.38,0.63 5.51,1.76 0.88,0.89 1.33,2.1 1.33,3.62v1.55h-5.43L36.25,94.31c0,-1.14 -0.69,-1.85 -1.9,-1.85 -1.02,0 -1.65,0.46 -1.85,1.37a2.63,2.63 0,0 0,0.02 1.08c0.58,2.38 8.64,3.85 9.52,8.23 0.12,0.56 0.27,1.77 0.03,3.5 -0.5,3.54 -3.61,4.9 -7.56,4.9 -5.52,0 -7.76,-2.61 -7.76,-6.22l0,-1.71h5.82l0,2.12c0,1.19 0.87,1.85 2.05,1.85 1.12,0 1.77,-0.45 2,-1.37 0.1,-0.42 0.15,-1.05 -0.04,-1.53 -1.08,-2.7 -8.61,-3.96 -9.53,-8.33 -0.21,-0.98 -0.22,-1.82 -0.05,-2.88a5.61,5.61 0,0 1,0.48 -1.51C9.33,100.46 -1.28,109.79 0.12,117.85c2.73,15.68 49.83,20.57 105.21,10.92 24.34,-4.24 46.23,-10.58 62.88,-17.69 -0.24,0.01 -0.47,0.04 -0.73,0.04 -3.79,0 -7.17,-1.42 -7.53,-5.29 -0.06,-0.7 -0.07,-1 -0.08,-1.4l0,-8.91c0,-0.38 0.05,-1.06 0.09,-1.41 0.45,-3.74 3.41,-5.29 7.51,-5.29 3.17,0 7.07,0.91 7.5,5.29 0.06,0.55 0.05,1.14 0.05,1.33v0.84h-5.48v-1.25c0,-0.03 -0.01,-0.5 -0.07,-0.79 -0.09,-0.45 -0.47,-1.48 -2.03,-1.48 -1.54,0 -1.94,1.04 -2.04,1.48 -0.06,0.25 -0.08,0.6 -0.08,0.99v9.68c-0,0.34 0.01,0.6 0.05,0.79 0.03,0.15 0.3,1.49 2.1,1.49 1.78,0 2.06,-1.33 2.08,-1.49 0.05,-0.26 0.05,-0.57 0.05,-0.79v-3h-2.16v-3.23h7.63v5.75c-0,0.39 -0.01,0.68 -0.07,1.4 -0.09,1.02 -0.41,1.88 -0.91,2.61 17.66,-8.39 27.95,-17.57 26.56,-25.51z"/></svg>',
    xiaomi: '<svg width="34" height="34" viewBox="0 0 1024 1024" aria-hidden="true"><path fill="#ff6900" d="M512,512m-512,0a512,512 0,1 1,1024 0a512,512 0,1 1,-1024 0"/><path fill="#fff" d="M360.7,414h120c31.4,0 64.2,1.5 80.3,17.6 15.9,15.9 17.6,47.6 17.7,78.4v96.8a3.2,3.2 0,0 1,-3.3 3.1h-41.5a3.2,3.2 0,0 1,-3.2 -3.2v-98.5c0,-17.2 -1,-34.9 -9.9,-43.8 -7.6,-7.7 -21.9,-9.4 -36.7,-9.8L408.7,454.8a3.2,3.2 0,0 0,-3.2 3.1v148.9a3.2,3.2 0,0 1,-3.2 3.2h-41.6a3.2,3.2 0,0 1,-3.2 -3.2L357.5,417.1a3.2,3.2 0,0 1,3.2 -3.2zM619.5,414L661,414a3.2,3.2 0,0 1,3.2 3.2v189.7a3.2,3.2 0,0 1,-3.2 3.1h-41.5a3.2,3.2 0,0 1,-3.2 -3.2L616.2,417.1a3.2,3.2 0,0 1,3.2 -3.2zM446.3,489.6h43.7a3.2,3.2 0,0 1,3.2 3.1v114.2a3.2,3.2 0,0 1,-3.2 3.2h-43.7a3.2,3.2 0,0 1,-3.2 -3.2L443.1,492.7a3.2,3.2 0,0 1,3.2 -3.1z"/></svg>',
    oneplus: '<svg width="22" height="22" viewBox="35 12 72 68" aria-hidden="true"><path fill="#ea0029" d="M59.13,63.05v-5.3h5.3L64.43,41.85h-5.3v-5.4h10.6v21.2h5.4v5.3h-16zM93.63,76.25L93.63,41.75h-5.3v29.2L45.93,70.95L45.93,28.55h29.2L75.13,23.25L40.63,23.25v53zM93.63,36.45v-8h8L101.63,23.25h-8L93.63,15.25h-5.3v8h-8v5.3h8v8L93.63,36.55z"/></svg>',
    oppo: '<svg width="24" height="24" viewBox="120 40 920 240" aria-hidden="true"><path fill="#006b33" d="M361.8,163.3L361.8,60.6h32v6.8c0,3.7 0.1,6.8 0.1,6.8 0.1,0 2.1,-1.2 4.5,-2.7C426.7,53.7 467.9,48.4 504.8,57.7c33.3,8.4 57.4,28.2 65.9,54.2 5,15.2 4.7,32.1 -0.8,46.9 -6.8,18.3 -20.9,33 -41.2,43.1 -17.7,8.8 -38,13.2 -60.7,13.2 -18.8,0 -36.4,-3.1 -51.8,-9.3 -6.1,-2.4 -14,-6.4 -18.8,-9.5l-3.7,-2.4v72h-32zM483.5,187.8c18,-2.6 32,-8.3 42.5,-17.4 7.9,-6.9 13.4,-16.4 15.5,-26.9 0.9,-4.3 0.9,-14.4 0,-18.7 -2.5,-12.3 -9.5,-23.1 -20.1,-30.6 -4.3,-3 -12.9,-7.4 -18.4,-9.2 -15.6,-5.2 -34.5,-6.8 -51.8,-4.3 -30.1,4.4 -50.4,19.3 -55.8,41 -2.4,9.6 -2,19.9 1.2,28.9 7.2,20.5 28.5,34.1 58.6,37.5 6,0.7 22.7,0.5 28.4,-0.3zM589.7,163.3L589.7,60.6h32v6.8c0,3.7 0.1,6.8 0.2,6.8 0.1,0 1.8,-1.1 3.9,-2.5 4.8,-3.1 14.2,-7.8 20.3,-10 26.1,-9.6 58.1,-11.2 86,-4.2 45.5,11.4 72.4,42.8 69.8,81.6 -1.9,29.6 -21.6,53.9 -54.1,66.7 -10.6,4.2 -21.4,6.8 -35,8.5 -7.2,0.9 -26.4,0.9 -33.9,-0 -21.1,-2.5 -39.7,-8.8 -54.2,-18.3l-3,-2v71.9h-32L589.7,163.3zM712.2,187.7c24.9,-3.7 42.5,-13.8 51.7,-29.6 5.4,-9.2 7.4,-21.4 5.4,-32.7 -4.1,-23.6 -24.9,-39.9 -56.6,-44.5 -20.9,-3.1 -44.6,-0 -60.6,7.9 -16.4,8 -26.3,20 -29.6,36 -0.9,4.2 -0.9,15 0,19.1 2.4,11.1 7.8,20.2 16,27.1 11.3,9.5 25.9,15.1 45,17.3 6.3,0.7 22.5,0.4 28.8,-0.5zM229.5,214.9c-17,-1.5 -31.5,-4.8 -43.8,-10.1C157.7,192.8 140,172.6 135.2,147.1 134.3,142.2 133.9,131.3 134.5,126c3.5,-30.6 26,-54.8 61.6,-66.2 19,-6.1 42.3,-8.1 63.2,-5.4 38.4,4.9 67.4,22.7 80.1,49.1 10.4,21.5 9.1,47.6 -3.4,67.7 -5.6,9 -14.9,18.4 -24.4,24.6 -14.8,9.7 -32.6,15.8 -54.1,18.4 -4.3,0.5 -24,1 -28,0.6zM912.6,214.9c-0.7,-0.1 -3,-0.3 -5.2,-0.5 -17.7,-1.7 -36.2,-7.3 -49.9,-15 -18.4,-10.4 -31.2,-25.3 -37.1,-42.9 -4,-11.9 -4.6,-25.4 -1.9,-37.7 4.1,-18.7 15.5,-34.5 33.1,-46.2 23.3,-15.5 57.5,-22.3 90.5,-18.2 27.4,3.5 50,13.5 65.8,29.2 12,12 18.9,26 20.9,42.4 0.5,4.3 0.4,12.9 -0.2,17.5 -4.3,32.7 -30.2,57.7 -69.9,67.4 -12,3 -19.6,3.8 -33.8,4 -6.1,0.1 -11.7,0.1 -12.4,-0z"/></svg>',
    realme: '<svg width="24" height="24" viewBox="0 0 81.44 25.44" aria-hidden="true"><rect x="0.72" y="0.72" width="80" height="24" rx="4" fill="#ffc915"/><path fill="#111111" d="m33.74,7.869c1.253,0 2.462,0.424 3.378,1.176L37.118,8.04h1.718v10.931h-1.718v-1C36.218,18.718 35.009,19.14 33.74,19.14 32.184,19.14 30.769,18.564 29.756,17.52 28.751,16.489 28.2,15.067 28.2,13.513 28.2,11.958 28.753,10.531 29.756,9.496 30.771,8.447 32.187,7.869 33.74,7.869ZM15.691,8.018L15.691,9.651L10.713,9.651v9.318L8.976,18.969L8.976,8.018ZM42.827,4.791L42.827,18.949L41.089,18.949L41.089,4.791Z"/></svg>',
    vivo: '<svg width="34" height="34" viewBox="0 0 39.29 39.29" aria-hidden="true"><rect width="39.29" height="39.29" rx="19.6" fill="#0072b8"/><path fill="#ffffff" fill-rule="evenodd" d="M29.44,18.68c0.32,-0.06 2.5,0 3,0a6.64,6.64 0,0 1,1.46 0.07,2.21 2.21,0 0,1 -0.19,4.28c-0.34,0.06 -2.48,0 -3,0a6.76,6.76 0,0 1,-1.46 -0.06,2.22 2.22,0 0,1 -1.46,-2.9 2.08,2.08 0,0 1,1.64 -1.39zM36.79,21.25A3.55,3.55 0,0 0,35.58 18.07a3.39,3.39 0,0 0,-1.47 -0.73,11.27 11.27,0 0,0 -2.11,-0.03h-2.2a3.3,3.3 0,0 0,-1.75 0.45,3.61 3.61,0 0,0 -0.5,5.8c1.1,0.94 2.17,0.81 3.57,0.81h2.2a3.43,3.43 0,0 0,3.46 -3.12zM16,18.27a3.76,3.76 0,0 0,0.54 0.9l1.72,2.56c0.34,0.5 0.81,1.22 1.16,1.7a2.17,2.17 0,0 0,1.89 1A2.18,2.18 0,0 0,23 23.28l1.16,-1.7 2,-3a0.73,0.73 0,0 0,-0.7 -1.16,1.26 1.26,0 0,0 -0.73,0.7l-1.15,1.7c-0.39,0.56 -0.77,1.14 -1.16,1.7l-0.58,0.85a0.88,0.88 0,0 1,-0.86 0.56,1.53 1.53,0 0,1 -0.71,-0.72l-0.51,-0.84 -1.16,-1.7 -1.16,-1.7a0.84,0.84 0,0 0,-0.87 -0.54,0.72 0.72,0 0,0 -0.57,0.84zM2.49,18.27a3.22,3.22 0,0 0,0.51 0.89l2.31,3.4c0.57,0.86 1.13,1.89 2.45,1.84s1.71,-1.06 2.33,-2l1.74,-2.55 0.59,-0.78a1.53,1.53 0,0 0,0.45 -1,0.72 0.72,0 0,0 -0.87,-0.64 1.18,1.18 0,0 0,-0.7 0.64c-0.39,0.59 -0.75,1.11 -1.16,1.7S9.39,20.95 9,21.52c-0.2,0.29 -0.38,0.56 -0.58,0.85a0.92,0.92 0,0 1,-0.84 0.59,1.41 1.41,0 0,1 -0.73,-0.72c-1,-1.36 -2,-2.86 -2.89,-4.26a0.86,0.86 0,0 0,-0.87 -0.55,0.72 0.72,0 0,0 -0.59,0.82zM14.3,17.44c-0.71,0.15 -0.6,0.75 -0.6,1.5v4.23a1.62,1.62 0,0 0,0.12 0.93,0.72 0.72,0 0,0 1.29,-0.19c0.07,-0.22 0,-2.78 0,-3.13L15.11,18.67a1.64,1.64 0,0 0,-0.11 -0.93,0.7 0.7,0 0,0 -0.72,-0.3z"/></svg>'
  };

  /* ── Exact Manufacturer Data from DeveloperOptionsScreen.kt & strings.xml ── */
  var DEV_BRANDS = [
    {
      id: 'GOOGLE_PIXEL',
      label: 'Google Pixel',
      sub: 'Stock Android',
      logo: 'google',
      toast1: 'Tap "Build number" 7 times',
      steps: [
        ['Enable Developer Options', 'Settings → About phone → Build number\nTap Build number 7 times.'],
        ['Open Developer Options', 'Settings → System → Developer Options'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: ['This is the Official Android implementation.']
    },
    {
      id: 'SAMSUNG',
      label: 'Samsung',
      sub: 'One UI',
      logo: 'samsung',
      toast1: 'Tap "Build number" under Software information',
      steps: [
        ['Enable Developer Options', 'Settings → About phone → Software information → Build number\nTap Build number 7 times.'],
        ['Open Developer Options', 'Settings → Developer Options (may be inside General management)'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: ['Samsung hides the Build number one level deeper under Software information.']
    },
    {
      id: 'XIAOMI',
      label: 'Xiaomi / Redmi\n/ POCO',
      sub: 'MIUI / HyperOS',
      logo: 'xiaomi',
      toast1: 'Tap "OS version" 7 times',
      steps: [
        ['Enable Developer Options', 'Settings → About phone → OS version\nTap OS version 7 times.\n\nOn older MIUI: tap MIUI version instead.'],
        ['Open Developer Options', 'Settings → Additional settings → Developer options'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: [
        'Older MIUI versions used \'MIUI Version\'.',
        'HyperOS and newer MIUI show \'OS version\' - tapping that is correct.'
      ]
    },
    {
      id: 'ONEPLUS_OPPO',
      label: 'OnePlus / Oppo\n/ Realme',
      sub: 'ColorOS',
      logo: 'trio',
      toast1: 'Go to Version → Tap "Build number" 7 times',
      steps: [
        ['Enable Developer Options', 'Settings → About device → Version → Build number\nTap Build number 7 times.'],
        ['Open Developer Options', 'Settings → Additional settings → Developer options'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: ['The Build number is buried inside a \'Version\' page on ColorOS devices.']
    },
    {
      id: 'VIVO',
      label: 'Vivo / iQOO',
      sub: 'OriginOS / FuntouchOS',
      logo: 'vivo',
      toast1: 'Tap "Software version" 7 times',
      steps: [
        ['Enable Developer Options', 'Settings → About phone → Software version\nTap Software version or Build number 7 times (varies by model).'],
        ['Open Developer Options', 'Settings → System → Developer options'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: ['Option label may say \'Software version\' or \'Build number\' depending on your firmware.']
    },
    {
      id: 'OTHER',
      label: 'Other',
      sub: 'Universal guide',
      logo: 'other',
      toast1: 'Tap "Build number" 7 times',
      steps: [
        ['Enable Developer Options', 'Go to Settings → About Phone → Tap \'Build Number\' 7 times'],
        ['Open Developer Options', 'Go to Settings → System → Developer Options'],
        ['Select Mock Location App', 'Find \'Select mock location app\' and choose \'Mappr\'']
      ],
      notes: [],
      importantNote: '• Developer Options steps may vary by device manufacturer\n• Some devices may require USB debugging to be enabled\n• Only one mock location app can be active at a time'
    }
  ];

  function fmtSched(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return h > 0 ? h + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0') : m + ':' + String(r).padStart(2, '0');
  }
  function clock(ms) {
    var d = new Date(Date.now() + ms), h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function LocationDemo(screen, opts) {
    opts = opts || {};
    var self = this;
    this.screen = screen;
    this.onEvent = opts.onEvent || function () {};
    var nyc = geo.place('nyc');
    this.real = { x: nyc.wx + 26, y: nyc.wy + 34 };
    this.mock = null;
    this.mocking = false;
    this.pulse = -1;
    this.sched = { on: false, total: 0, remaining: 0 };
    this.favs = [
      { name: 'Eiffel Tower', addr: geo.place('paris').addr, x: geo.place('paris').wx, y: geo.place('paris').wy },
      { name: 'Shibuya Crossing', addr: geo.place('tokyo').addr, x: geo.place('tokyo').wx, y: geo.place('tokyo').wy },
      { name: 'Tower Bridge', addr: geo.place('london').addr, x: geo.place('london').wx, y: geo.place('london').wy }
    ];
    this.mapType = 'light';
    this.lastChange = 0;
    this.pickMs = 60000;
    this.setupAck = false;
    this.devBrand = null;
    this.devStep = 0;
    this.secretTaps = 0;

    screen.innerHTML =
      '<div class="app-map"></div>' +
      '<img class="app-pin" src="' + PIN + '" alt="Target location marker" draggable="false">' +
      '<div class="app-statusbar"><span data-clock>9:41</span><span class="sb-r"><i></i><i></i></span></div>' +
      '<div class="app-top">' +
        '<button class="app-search" data-act="search" aria-label="Search">' + icon('search', 24) + '<span>Enter Address or GPS coordinates</span></button>' +
        '<div class="app-controls">' +
          '<div class="app-colL">' +
            '<div class="app-card app-latlng" data-latlng title="Long-press to copy"><div><span class="k">Lat:</span><span class="v" data-lat>0</span></div><div><span class="k">Lng:</span><span class="v" data-lng>0</span></div></div>' +
            '<div class="app-card app-zoom"><button data-act="zin" aria-label="Zoom in">' + icon('add', 18) + '</button><hr><button data-act="zout" aria-label="Zoom out">' + icon('remove', 18) + '</button></div>' +
            '<div data-sched style="width:48px;height:48px"></div>' +
          '</div>' +
          '<div class="app-colR">' +
            '<button class="app-fab" data-act="mylocation" aria-label="Current location" style="color:var(--primary)">' + icon('myLocation', 24) + '</button>' +
            '<button class="app-fab" data-act="favs" aria-label="Favorites" style="color:var(--error)">' + icon('heartFilled', 20) + '</button>' +
            '<button class="app-fab" data-act="maptype" aria-label="Map type">' + icon('layers', 24) + '</button>' +
            '<button class="app-fab" data-act="settings" aria-label="Developer Options Setup Guide">' + icon('settings', 24) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="app-bottom"><div data-stopslot></div>' +
        '<div class="app-infocard" data-card>' +
          '<div class="hd"><span class="lbl">CURRENT LOCATION</span><button class="app-change" data-act="change">Change</button></div>' +
          '<div class="app-addr">' + icon('locationOn', 16) .replace('class="ic"', 'class="ic" style="color:var(--primary)"') + '<p data-cur></p><button class="app-heart" data-act="favcur" aria-label="Add to favorites"></button></div>' +
          '<hr><div class="sub">TARGET LOCATION</div>' +
          '<div class="app-addr">' + icon('locationOn', 16).replace('class="ic"', 'class="ic" style="color:var(--error)"') + '<p data-tgt></p><button class="app-heart" data-act="favtgt" aria-label="Add to favorites"></button></div>' +
        '</div>' +
      '</div>' +
      '<div class="app-gesture"></div>' +
      '<section class="app-page" data-page="search" aria-label="Search">' +
        '<header><button class="back" data-act="close-page" aria-label="Back">' + icon('arrowBack', 24) + '</button>' +
        '<label class="app-field">' + icon('search', 20) + '<input data-q type="text" placeholder="Enter Address or GPS coordinates" autocomplete="off" inputmode="text" aria-label="Search address or coordinates"></label></header>' +
        '<div class="app-list" data-results></div>' +
      '</section>' +
      '<section class="app-page" data-page="favs" aria-label="Favorites">' +
        '<header><button class="back" data-act="close-page" aria-label="Back">' + icon('arrowBack', 24) + '</button><h2>Favorites</h2></header>' +
        '<div class="app-list" data-favlist></div>' +
      '</section>' +
      '<section class="app-page" data-page="devoptions" aria-label="Developer Options Setup Guide">' +
        '<div class="dev-topbar">' +
          '<button class="back" data-act="dev-back" aria-label="Back">' + icon('arrowBack', 24) + '</button>' +
          '<h2 data-dev-title>Select Your Device</h2>' +
        '</div>' +
        '<div class="dev-scroll" data-dev-body></div>' +
        '<div class="dev-foot" data-dev-foot style="display:none"></div>' +
      '</section>' +
      '<div class="app-scrim" data-scrim></div>';

    this.q = function (s) { return screen.querySelector(s); };
    this.view = new MP.map.MapView(this.q('.app-map'), { style: 'light', overscan: 1 });
    this.pin = this.q('.app-pin');
    this.view.cam.x = nyc.wx - 70; this.view.cam.y = nyc.wy - 70; this.view.cam.scale = 1.15;
    this.view.warm();

    this.view.layers.push(function (ctx, v, dt) { self._drawDot(ctx, v, dt); });
    this.view.onDragStart = function () { self.pin.classList.add('lift'); };
    this.view.onFrame = function (dt) { self._tick(dt); };
    ['pointerup', 'pointercancel'].forEach(function (e) { self.q('.app-map').addEventListener(e, function () { self.pin.classList.remove('lift'); }); });
    this.q('.app-map').addEventListener('pointerdown', function () { self.onEvent('drag'); });

    screen.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (b && screen.contains(b)) self._act(b.getAttribute('data-act'), b);
    });
    var qi = this.q('[data-q]');
    qi.addEventListener('input', function () { self._renderResults(qi.value); });
    qi.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { var f = self.q('[data-results] .app-li'); if (f) f.click(); }
    });
    // long-press lat/lng → copy (same gesture as LiveLatLngCard)
    var ll = this.q('[data-latlng]'), lp = 0;
    ll.addEventListener('pointerdown', function () { lp = setTimeout(function () { self._copyCoords(); }, 520); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (e) { ll.addEventListener(e, function () { clearTimeout(lp); }); });
    ll.addEventListener('dblclick', function () { self._copyCoords(); });

    this._renderResults('');
    this._renderFavs();
    this._lastLat = '';
    this._renderSched();
    this._updateText(true);
    this._hint = 0;
  }

  LocationDemo.prototype = {
    cur: function () { return this.mocking ? this.mock : this.real; },
    target: function () { return this.view.center(); },

    _tick: function (dt) {
      // live camera read-out + addresses (same state the Compose screen derives)
      var c = this.view.center();
      if (this._lc !== (c.x | 0) + ',' + (c.y | 0)) { this._lc = (c.x | 0) + ',' + (c.y | 0); this._updateText(false); }
      if (this.pulse >= 0) { this.pulse += dt; if (this.pulse > 1.4) this.pulse = -1; }
      if (this.sched.on && this.mocking) {
        var now = performance.now();
        this.sched.remaining = Math.max(0, this.sched.end - now);
        if (!this._rt || now - this._rt > 250) { this._rt = now; this._paintRing(); }
        if (this.sched.remaining <= 0) {
          this.sched.on = false;
          this._stop(true);
        }
      }
    },

    _updateText: function (force) {
      var c = this.view.center(), ll = geo.fromWorld(c.x, c.y);
      this.q('[data-lat]').textContent = geo.fmt(ll.lat);
      this.q('[data-lng]').textContent = geo.fmt(ll.lng);
      var tgt = geo.addressAt(c.x, c.y), cur = this.cur(), cura = geo.addressAt(cur.x, cur.y);
      if (force || tgt !== this._tgt) { this._tgt = tgt; this.q('[data-tgt]').textContent = tgt; this._heart('[data-act="favtgt"]', this._isFav(tgt)); }
      if (force || cura !== this._cura) { this._cura = cura; this.q('[data-cur]').textContent = cura; this._heart('[data-act="favcur"]', this._isFav(cura)); }
    },

    _isFav: function (addr) { return this.favs.some(function (f) { return f.addr === addr; }); },
    _heart: function (sel, on, pop) {
      var b = this.q(sel);
      b.classList.toggle('on', on);
      b.innerHTML = icon(on ? 'heartFilled' : 'heart', 20);
      b.setAttribute('aria-label', on ? 'Remove from favorites' : 'Add to favorites');
      if (pop) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    },

    _drawDot: function (ctx, v) {
      var p = this.cur(), s = v.worldToScreen(p.x, p.y);
      if (s[0] < -60 || s[0] > v.w + 60 || s[1] < -60 || s[1] > v.h + 60) return;
      var acc = Math.max(16, 12 * v.cam.scale);
      ctx.save();
      ctx.beginPath(); ctx.arc(s[0], s[1], acc, 0, 6.2832);
      ctx.fillStyle = 'rgba(66,133,244,.14)'; ctx.fill();
      if (this.pulse >= 0) {
        var k = this.pulse / 1.4;
        ctx.beginPath(); ctx.arc(s[0], s[1], 10 + k * 80, 0, 6.2832);
        ctx.lineWidth = 3 * (1 - k) + 0.5; ctx.strokeStyle = 'rgba(66,133,244,' + (0.55 * (1 - k)) + ')'; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(s[0], s[1], 9.5, 0, 6.2832); ctx.fillStyle = '#fff';
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 4; ctx.fill(); ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(s[0], s[1], 6.6, 0, 6.2832); ctx.fillStyle = '#4285F4'; ctx.fill();
      ctx.restore();
    },

    /* ── actions ── */
    _act: function (a, btn) {
      var v = this.view, self = this;
      switch (a) {
        case 'zin': v.zoomBy(1.4); break;
        case 'zout': v.zoomBy(1 / 1.4); break;
        case 'mylocation': var c = this.cur(); v.flyTo(c.x, c.y, { dur: 0.55 }); break;
        case 'settings': this.openSetupDialog(); break;
        case 'change': this._change(); break;
        case 'stop': this._dialogStop(); break;
        case 'hourglass': this._dialogPicker(); break;
        case 'sched-cancel': this._dialogCancelSched(); break;
        case 'search': this._openPage('search'); break;
        case 'favs': this._openPage('favs'); break;
        case 'devoptions': this.devBrand = null; this._openPage('devoptions'); break;
        case 'dev-back':
          if (this.devBrand) { this.devBrand = null; this._renderDevOptions(); }
          else { this._closePages(); }
          break;
        case 'close-page': this._closePages(); break;
        case 'maptype': this._dialogMapType(); break;
        case 'favcur': this._toggleFav(this.cur(), '_cura', '[data-act="favcur"]'); break;
        case 'favtgt': this._toggleFav(this.target(), '_tgt', '[data-act="favtgt"]'); break;
      }
    },

    _toggleFav: function (pos, key, sel) {
      var addr = geo.addressAt(pos.x, pos.y), i = -1;
      this.favs.forEach(function (f, n) { if (f.addr === addr) i = n; });
      if (i >= 0) this.favs.splice(i, 1);
      else this.favs.unshift({ name: addr.split(',')[0], addr: addr, x: pos.x, y: pos.y });
      this._heart(sel, i < 0, true);
      this._renderFavs();
      this._updateText(true);
      U.toast(this.screen, i < 0 ? 'Saved to favorites' : 'Removed from favorites', 1500);
      this.onEvent('fav');
    },

    _change: function () {
      var now = Date.now();
      if (now - this.lastChange < 500) return; // same 500 ms debounce as MapScreen.kt
      this.lastChange = now;
      var t = this.target();
      this.mock = { x: t.x, y: t.y };
      var wasMocking = this.mocking;
      this.mocking = true;
      this.pulse = 0;
      this._renderStop();
      this._renderSched();
      this._updateText(true);
      var ll = geo.fromWorld(t.x, t.y);
      U.toast(this.screen, 'Location changed → ' + ll.lat.toFixed(4) + ', ' + ll.lng.toFixed(4), 1800);
      this.onEvent(wasMocking ? 'change-again' : 'change', this.mock);
    },

    _stop: function (auto) {
      this.mocking = false;
      this.mock = null;
      this.sched.on = false;
      this.pulse = 0;
      this._renderStop();
      this._renderSched();
      this._updateText(true);
      U.toast(this.screen, auto ? 'Schedule finished — real location restored' : 'Real location restored', 2000);
      this.onEvent('stop');
    },

    _renderStop: function () {
      var slot = this.q('[data-stopslot]');
      slot.innerHTML = this.mocking
        ? '<button class="app-fab stop" data-act="stop" aria-label="Stop mocking" style="margin:0 16px 8px 0;display:grid;margin-left:auto">' + icon('stopCircle', 28) + '</button>'
        : '';
      slot.style.cssText = 'align-self:stretch;display:flex;justify-content:flex-end;';
    },

    _renderSched: function () {
      var slot = this.q('[data-sched]'), s = this.sched;
      if (this.mocking && s.on) {
        slot.innerHTML = '<button class="app-sched" data-act="sched-cancel" aria-label="Cancel schedule"><canvas width="80" height="80"></canvas><span class="t"></span></button>';
        this._paintRing();
      } else if (this.mocking) {
        slot.innerHTML = '<button class="app-sched" data-act="hourglass" aria-label="Schedule stop time">' + icon('hourglass', 24) + '</button>';
      } else {
        slot.innerHTML = '';
      }
    },

    _paintRing: function () {
      var cv = this.q('.app-sched canvas');
      if (!cv) return;
      var g = cv.getContext('2d'), s = this.sched, p = s.total ? Math.min(1, Math.max(0, s.remaining / s.total)) : 1;
      g.clearRect(0, 0, 80, 80);
      g.lineWidth = 7; g.lineCap = 'round';
      g.strokeStyle = '#DEE3EB'; g.beginPath(); g.arc(40, 40, 35, 0, 6.2832); g.stroke();
      g.strokeStyle = '#30628C'; g.beginPath(); g.arc(40, 40, 35, -Math.PI / 2, -Math.PI / 2 + p * 6.2832); g.stroke();
      this.q('.app-sched .t').textContent = fmtSched(s.remaining);
    },

    /* ── pages (search / favourites / developer options) ── */
    _openPage: function (name) {
      var pg = this.q('[data-page="' + name + '"]');
      if (name === 'search') { this._renderResults(this.q('[data-q]').value); }
      if (name === 'favs') this._renderFavs();
      if (name === 'devoptions') this._renderDevOptions();
      pg.classList.add('on');
      if (name === 'search') { var i = this.q('[data-q]'); setTimeout(function () { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } }, 280); }
    },
    _closePages: function () {
      var q = this.q('[data-q]');
      q.blur();
      this.screen.querySelectorAll('.app-page.on').forEach(function (p) { p.classList.remove('on'); });
    },

    _renderResults: function (text) {
      var self = this, list = this.q('[data-results]'), t = (text || '').trim().toLowerCase(), html = '';
      var m = t.match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (m) {
        var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
        if (Math.abs(lat) <= 85 && Math.abs(lng) <= 180) {
          html += '<button class="app-li" data-go-ll="' + lat + ',' + lng + '"><span class="ico red">' + icon('locationOn', 20) + '</span><span class="tx"><b>' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</b><small>Go to these coordinates</small></span></button>';
        }
      }
      var found = geo.places.filter(function (p) {
        return !t || (p.name + ' ' + p.city + ' ' + p.addr).toLowerCase().indexOf(t) >= 0;
      });
      if (!t) html += '<div class="app-empty" style="padding:12px 18px 4px;text-align:left;font-weight:600;font-size:12px;letter-spacing:.04em">POPULAR PLACES</div>';
      found.forEach(function (p) {
        html += '<button class="app-li" data-go="' + p.id + '"><span class="ico">' + icon('locationOn', 20) + '</span><span class="tx"><b>' + esc(p.name) + '</b><small>' + esc(p.addr) + '</small></span></button>';
      });
      if (!found.length && !m) html += '<div class="app-empty">No results found</div>';
      list.innerHTML = html;
      list.querySelectorAll('[data-go]').forEach(function (b) {
        b.addEventListener('click', function () { var p = geo.place(b.getAttribute('data-go')); self._goTo(p.wx, p.wy); });
      });
      list.querySelectorAll('[data-go-ll]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = b.getAttribute('data-go-ll').split(',').map(parseFloat), w = geo.toWorld(a[0], a[1]);
          self._goTo(w.x, w.y);
        });
      });
    },
    _goTo: function (x, y) {
      this._closePages();
      this.q('[data-q]').value = '';
      this.view.flyTo(x, y, { dur: 0.7 });
      this.onEvent('search');
    },

    _renderFavs: function () {
      var self = this, list = this.q('[data-favlist]');
      if (!this.favs.length) { list.innerHTML = '<div class="app-empty">No favorites yet.<br>Tap the heart on the card to save a spot.</div>'; return; }
      list.innerHTML = this.favs.map(function (f, i) {
        return '<div class="app-li" role="button" tabindex="0" data-fav="' + i + '"><span class="ico red">' + icon('heartFilled', 18) + '</span><span class="tx"><b>' + esc(f.name) + '</b><small>' + esc(f.addr) + '</small></span></div>';
      }).join('');
      list.querySelectorAll('[data-fav]').forEach(function (b) {
        function go() { var f = self.favs[+b.getAttribute('data-fav')]; self._closePages(); self.view.flyTo(f.x, f.y, { dur: 0.7 }); self.onEvent('fav-go'); }
        b.addEventListener('click', go);
        b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
      });
    },

    _copyCoords: function () {
      var c = this.view.center(), ll = geo.fromWorld(c.x, c.y), txt = geo.fmt(ll.lat) + ', ' + geo.fmt(ll.lng);
      try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
      U.toast(this.screen, 'Coordinates copied: ' + txt, 1800);
    },

    /* ── dialogs (Material 3 AlertDialog look) ── */
    _dialog: function (html, bind) {
      var self = this, sc = this.q('[data-scrim]');
      sc.innerHTML = '<div class="app-dialog" role="dialog" aria-modal="true">' + html + '</div>';
      requestAnimationFrame(function () { sc.classList.add('on'); });
      function close() { sc.classList.remove('on'); }
      sc.onclick = function (e) { if (e.target === sc) close(); };
      sc.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });
      bind && bind(sc, close);
      return close;
    },

    _dialogStop: function () {
      var self = this;
      this._dialog(
        '<div class="di">' + icon('stopCircle', 48) + '</div><h3>Stop Mock Location?</h3>' +
        '<div class="msg">Are you sure you want to restore your real location?</div>' +
        '<div class="acts"><button class="btn-t" data-close>Cancel</button><button class="btn-f err" data-ok>OK</button></div>',
        function (sc, close) { sc.querySelector('[data-ok]').addEventListener('click', function () { close(); self._stop(false); }); }
      );
    },

    _dialogCancelSched: function () {
      var self = this;
      this._dialog(
        '<h3 style="text-align:left">Stop Scheduling?</h3>' +
        '<div class="msg">The scheduled mock will be cancelled. Mocking will continue until you stop it manually.</div>' +
        '<div class="acts"><button class="btn-t" data-close>Keep Schedule</button><button class="btn-f err" data-ok>Stop</button></div>',
        function (sc, close) { sc.querySelector('[data-ok]').addEventListener('click', function () { close(); self.sched.on = false; self._renderSched(); }); }
      );
    },

    _dialogPicker: function () {
      var self = this, opts = [[60000, '1 min'], [300000, '5 min'], [900000, '15 min'], [1800000, '30 min'], [3600000, '1 hour']];
      this._dialog(
        '<h3 style="text-align:left">Stop mocking at</h3>' +
        '<div class="picker-time" data-pt></div><div class="picker-sub">Choose how long to hold this location</div>' +
        '<div class="quick" data-chips></div>' +
        '<div class="acts"><button class="btn-t" data-close>Cancel</button><button class="btn-f" data-ok>OK</button></div>',
        function (sc, close) {
          var chips = sc.querySelector('[data-chips]'), pt = sc.querySelector('[data-pt]');
          function paint() {
            pt.textContent = clock(self.pickMs);
            chips.innerHTML = opts.map(function (o) { return '<button class="chip' + (o[0] === self.pickMs ? ' sel' : '') + '" data-ms="' + o[0] + '">' + o[1] + '</button>'; }).join('');
            chips.querySelectorAll('.chip').forEach(function (c) { c.addEventListener('click', function () { self.pickMs = +c.getAttribute('data-ms'); paint(); }); });
          }
          paint();
          sc.querySelector('[data-ok]').addEventListener('click', function () {
            close();
            self.sched = { on: true, total: self.pickMs, remaining: self.pickMs, end: performance.now() + self.pickMs };
            self._renderSched();
            self.onEvent('schedule');
          });
        }
      );
    },

    _dialogMapType: function () {
      var self = this;
      this._dialog(
        '<h3 style="text-align:left">Map Type</h3>' +
        '<div class="maptypes">' +
          '<button data-mt="light" class="' + (this.mapType === 'light' ? 'sel' : '') + '"><span class="pv def"></span><span class="lb">Default</span><span class="ck">' + icon('check', 14) + '</span></button>' +
          '<button data-mt="sat" class="' + (this.mapType === 'sat' ? 'sel' : '') + '"><span class="pv sat"></span><span class="lb">Satellite</span><span class="ck">' + icon('check', 14) + '</span></button>' +
        '</div><div class="acts"><button class="btn-t" data-close>Close</button></div>',
        function (sc, close) {
          sc.querySelectorAll('[data-mt]').forEach(function (b) {
            b.addEventListener('click', function () {
              self.mapType = b.getAttribute('data-mt');
              self.view.setStyle(self.mapType);
              self.view.warm();
              close();
            });
          });
        }
      );
    },

    openSetupDialog: function () {
      var self = this;
      this._dialog(
        '<div class="di" style="color:var(--error)">' + icon('mapPinIcon', 48) + '</div>' +
        '<h3>Setup Required</h3>' +
        '<div class="steps">' +
          '<div class="step"><span class="n">1</span><div><b>Why?</b><span>Mappr must be your device\'s mock location app to spoof GPS.</span></div></div>' +
          '<div class="step"><span class="n">2</span><div><b>Open the Setup Guide</b><span>Tap the guide button below for device-specific instructions</span></div></div>' +
          '<div class="step"><span class="n">3</span><div><b>Come Back &amp; Start</b><span>Return here - tap Start and you\'re good to go</span></div></div>' +
        '</div>' +
        '<div class="acts col">' +
          '<button class="btn-f" data-guide>' + icon('menuBook', 18) + '<span>Open Guide</span></button>' +
          '<button class="btn-t" data-later>I\'ll Do It Later</button>' +
        '</div>',
        function (sc, close) {
          sc.querySelector('[data-guide]').addEventListener('click', function () {
            close();
            self.devBrand = null;
            self._openPage('devoptions');
            self.onEvent('guide');
          });
          sc.querySelector('[data-later]').addEventListener('click', function () {
            close();
          });
        }
      );
    },

    /* ── 1:1 DeveloperOptionsScreen.kt Replica ── */
    _renderDevOptions: function () {
      var self = this;
      var ttl = this.q('[data-dev-title]'), body = this.q('[data-dev-body]'), foot = this.q('[data-dev-foot]');
      if (!this.devBrand) {
        ttl.textContent = 'Select Your Device';
        foot.style.display = 'none';
        var cards = DEV_BRANDS.map(function (b) {
          var logoHtml = '';
          if (b.logo === 'trio') {
            logoHtml = '<div class="dev-logo-trio"><span>' + BRAND_LOGOS.oneplus + '</span><span>' + BRAND_LOGOS.oppo + '</span><span>' + BRAND_LOGOS.realme + '</span></div>';
          } else if (b.logo === 'other') {
            logoHtml = '<div class="dev-logo-circle" style="color:var(--on-surface-variant)">' + icon('deviceUnknown', 30) + '</div>';
          } else {
            logoHtml = '<div class="dev-logo-circle">' + BRAND_LOGOS[b.logo] + '</div>';
          }
          return '<button class="dev-mcard' + (b.id === 'OTHER' ? ' other' : '') + '" data-dev-brand="' + b.id + '">' +
            logoHtml +
            '<b>' + esc(b.label) + '</b>' +
            '<small>' + esc(b.sub) + '</small>' +
          '</button>';
        }).join('');

        body.innerHTML =
          '<div class="dev-hdr-card" data-secret-hdr>' +
            '<div style="color:var(--on-primary-container);flex:none">' + icon('phoneAndroid', 38) + '</div>' +
            '<div><b>Choose your device brand</b><small>We\'ll show you the exact steps for your device.</small></div>' +
          '</div>' +
          '<div class="dev-grid">' + cards + '</div>';

        body.scrollTop = 0;
        var hdr = body.querySelector('[data-secret-hdr]');
        if (hdr) {
          hdr.addEventListener('click', function () {
            self.secretTaps++;
            if (self.secretTaps === 7) U.toast(self.screen, 'Promo offer unlocked', 2200);
          });
        }
        body.querySelectorAll('[data-dev-brand]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-dev-brand');
            self.devBrand = DEV_BRANDS.filter(function (x) { return x.id === id; })[0];
            self.devStep = 0;
            self._renderDevOptions();
          });
        });
        return;
      }

      // Selected Manufacturer Guide Content (ManufacturerGuideContent)
      var b = this.devBrand, cur = this.devStep;
      ttl.textContent = 'Setup Guide';

      var stepsHtml = b.steps.map(function (st, idx) {
        var badge = '';
        if (idx < cur) {
          badge = '<div class="dev-badge">' + CHECKMARK_SVG + '</div>';
        } else if (idx === cur) {
          badge = '<div class="dev-badge current">' + icon('arrowForward', 22) + '</div>';
        } else {
          badge = '<div class="dev-badge pending">' + (idx + 1) + '</div>';
        }
        return '<div class="dev-step-card">' +
          badge +
          '<div class="tx"><b>' + esc(st[0]) + '</b><p>' + esc(st[1]) + '</p></div>' +
        '</div>';
      }).join('');

      var notesHtml = '';
      if (b.notes && b.notes.length) {
        notesHtml =
          '<div class="dev-tips-card">' +
            '<div class="hd">' + icon('lightbulb', 18) + '<span>Tips</span></div>' +
            b.notes.map(function (n) { return '<p>• ' + esc(n) + '</p>'; }).join('') +
          '</div>';
      }
      if (b.importantNote) {
        notesHtml +=
          '<div class="dev-imp-card">' +
            '<div class="hd">' + icon('warning', 20) + '<span>Important Note</span></div>' +
            '<p>' + esc(b.importantNote) + '</p>' +
          '</div>';
      }

      body.innerHTML =
        '<div class="dev-hdr-card">' +
          '<div style="color:var(--on-primary-container);flex:none">' + icon('info', 34) + '</div>' +
          '<div><b>' + esc(b.label.replace(/\n/g, ' ')) + '</b><small>Follow the steps below to enable mock location.</small></div>' +
        '</div>' +
        '<div class="dev-legend">' +
          '<span>Step Indicator</span>' +
          '<div class="lg-r">' +
            '<span class="lg-cur">' + icon('arrowForward', 11) + '</span><span>current</span>' +
            '<span style="width:6px"></span>' +
            CHECKMARK_SM_SVG + '<span>done</span>' +
          '</div>' +
        '</div>' +
        stepsHtml +
        notesHtml;

      foot.style.display = 'block';
      var isDevOn = cur >= 1;
      foot.innerHTML =
        '<small>Button Changes with Progression</small>' +
        '<button type="button" data-dev-prog>' +
          icon(isDevOn ? 'settings' : 'developerMode', 20) +
          '<span>' + (isDevOn ? 'Open Developer Options' : 'Enable Developer Options') + '</span>' +
        '</button>';

      foot.querySelector('[data-dev-prog]').addEventListener('click', function () {
        if (self.devStep === 0) {
          self.devStep = 1;
          U.toast(self.screen, b.toast1, 2000);
          self._renderDevOptions();
        } else {
          self.devStep = 3;
          self.setupAck = true;
          U.toast(self.screen, 'Select mock location app → Choose Mappr', 2000);
          self._renderDevOptions();
        }
      });
    },

    teleport: function (placeId) {
      var p = geo.place(placeId);
      if (!p) return;
      this._closePages();
      this.view.flyTo(p.wx, p.wy, { dur: 0.72 });
      this.onEvent('teleport', p);
    }
  };

  MP.LocationDemo = LocationDemo;
})(window);

