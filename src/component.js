
const D2R = Math.PI / 180;

// ── IADC WellSharp Decimal Places & Answer Format Standards ─────────────
// Source: Official IADC WellSharp Formula Sheet (Field & Metric Units)
// Field: Depth (0), Pressure (0), Grad (4), MW (1), Vol (1), Cap (4), Out (4), Strokes (0), W&W Step (0)
// Metric: Depth (1), Pressure (1 bar / 0 kPa), Grad (3 bar/m), MW (0 kg/m³ / 2 kg/L), Vol (2 m³), Cap (2), Out (1), Strokes (0), W&W Step (2)
const IADC_DECIMAL_STANDARDS = {
  depth:    { us: ['ft', 0, 'X'],          metric: ['m', 1, 'X.X'],        si: ['m', 1, 'X.X'] },
  press:    { us: ['psi', 0, 'X'],         metric: ['bar', 1, 'X.X'],      si: ['kPa', 0, 'X'] },
  grad:     { us: ['psi/ft', 4, 'X.XXXX'], metric: ['bar/m', 3, 'X.XXX'], si: ['kPa/m', 2, 'X.XX'] },
  dens:     { us: ['ppg', 1, 'X.X'],       metric: ['kg/m³', 0, 'X'],      si: ['kg/m³', 0, 'X'] },
  vol:      { us: ['bbl', 1, 'X.X'],       metric: ['m³', 2, 'X.XX'],      si: ['m³', 2, 'X.XX'] },
  cap:      { us: ['bbl/ft', 4, 'X.XXXX'], metric: ['L/m', 2, 'X.XX'],     si: ['L/m', 2, 'X.XX'] },
  out:      { us: ['bbl/stk', 4, 'X.XXXX'],metric: ['L/stk', 1, 'X.X'],   si: ['L/stk', 1, 'X.X'] },
  spm:      { us: ['spm', 0, 'X'],         metric: ['spm', 0, 'X'],        si: ['spm', 0, 'X'] },
  strokes:  { us: ['stk', 0, 'X'],         metric: ['stk', 0, 'X'],        si: ['stk', 0, 'X'] },
  stepdown: { us: ['psi/100 stk', 0, 'X'], metric: ['bar/100 stk', 2, 'X.XX'], si: ['kPa/100 stk', 0, 'X'] }
};

const SYS = {
  us:     { key:'us', label:'US OIL', depth:['ft',1,0], press:['psi',1,0], dens:['ppg',1,1], vol:['bbl',1,1], cap:['bbl/ft',1,4], out:['bbl/stk',1,4] },
  metric: { key:'metric', label:'METRIC', depth:['m',0.3048,1], press:['bar',0.0689476,1], dens:['kg/m³',119.826,0], vol:['m³',0.158987,2], cap:['L/m',521.612,2], out:['L/stk',158.987,1] },
  si:     { key:'si', label:'SI', depth:['m',0.3048,1], press:['kPa',6.89476,0], dens:['kg/m³',119.826,0], vol:['m³',0.158987,2], cap:['L/m',521.612,2], out:['L/stk',158.987,1] },
};
const KINDS = ['depth','press','dens','vol'];
const ALT = { depth:['ft','m'], press:['psi','bar','kPa'], dens:['ppg','kg/m³'], vol:['bbl','m³'] };
const FACT = { ft:1, m:0.3048, psi:1, bar:0.0689476, kPa:6.89476, ppg:1, 'kg/m³':119.826, bbl:1, 'm³':0.158987 };
const DEC  = { ft:0, m:1, psi:0, bar:1, kPa:0, ppg:1, 'kg/m³':0, 'kg/L':2, 'kg/l':2, sg:2, bbl:1, 'm³':2, liters:0, L:0, 'bbl/ft':4, 'L/m':2, 'bbl/stk':4, 'L/stk':1, 'psi/ft':4, 'bar/m':3, 'kPa/m':2, stk:0, spm:0 };
const AMBER = 'oklch(0.82 0.15 75)', GREEN = 'oklch(0.78 0.15 150)', RED = 'oklch(0.65 0.19 27)', BLUE = 'oklch(0.70 0.13 240)';
const num = (v, d) => (isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits:d, maximumFractionDigits:d }) : '—');

class Component extends DCLogic {
  state = {
    step: 1, tab: 'sheet', method: 'ww', geomTab: 'string', wellName: 'Well 5KR-14H',
    sys: 'us', over: {}, draft: {}, exportOpen: false, exported: {},
    actStk: '', actP: '', actuals: [],
    f: {
      td: 14200, kop: 6800, build: 1400, incl: 90, wellType: 'horizontal',
      mw: 12.4, pumpOut: 0.117, spm: 30, scrp: 620, shoe: 6500,
      strength: 'lot', lotMw: 12.4, lotP: 1149, fg: 0.817, mamwIn: 15.7,
      sidpp: 480, sicp: 720, gain: 22,
    },
    string: [
      { name:'5" DP 19.5#', len:12700, cap:0.01776 },
      { name:'5" HWDP', len:900, cap:0.00870 },
      { name:'6¾" BHA', len:600, cap:0.00870 },
    ],
    annulus: [
      { name:'DP × 9⅝" csg', len:6500, cap:0.0489 },
      { name:'DP × 8½" OH', len:6200, cap:0.0459 },
      { name:'HWDP × 8½" OH', len:900, cap:0.0486 },
      { name:'BHA × 8½" OH', len:600, cap:0.0323 },
    ],
  };

  // ── units ────────────────────────────────────────────────
  u(kind) {
    if (kind === 'grad') {
      const p = this.u('press'), d = this.u('depth');
      // IADC Decimal standard: psi/ft = 4 decimals, bar/m = 3 decimals, kPa/m = 2 decimals
      const dec = p.u === 'psi' ? 4 : (p.u === 'bar' ? 3 : 2);
      return { u: p.u + '/' + d.u, f: p.f / d.f, d: dec };
    }
    const o = this.state.over[kind];
    if (o) return { u:o, f:FACT[o], d:DEC[o] !== undefined ? DEC[o] : 0 };
    const s = SYS[this.state.sys][kind];
    return { u:s[0], f:s[1], d:s[2] };
  }
  uu(kind) { const s = SYS[this.state.sys][kind]; return { u:s[0], f:s[1], d:s[2] }; }
  disp(v, kind) { const c = this.u(kind); return num(v * c.f, c.d); }

  // ── geometry ─────────────────────────────────────────────
  tvdAt(md) {
    const { wellType, kop, build, incl } = this.state.f;
    if (wellType === 'vertical') return md;
    const a = incl * D2R;
    if (md <= kop) return md;
    const R = build / (a || 1e-6);
    if (md <= kop + build) { const t = a * (md - kop) / build; return kop + R * Math.sin(t); }
    return kop + R * Math.sin(a) + (md - kop - build) * Math.cos(a);
  }
  sum(list, k) { return list.reduce((s, r) => s + (Number(r[k]) || 0), 0); }
  vol(list) { return list.reduce((s, r) => s + (Number(r.len) || 0) * (Number(r.cap) || 0), 0); }
  mdAtVol(v) { // top-down through string
    let rest = v, md = 0;
    for (const s of this.state.string) {
      const cap = Number(s.cap) || 1e-9, len = Number(s.len) || 0;
      if (rest <= cap * len) return md + rest / cap;
      rest -= cap * len; md += len;
    }
    return md;
  }
  volAtMd(md) {
    let left = md, v = 0;
    for (const s of this.state.string) {
      const len = Math.min(left, Number(s.len) || 0);
      v += len * (Number(s.cap) || 0); left -= len; if (left <= 0) break;
    }
    return v;
  }
  mdFromBottomVol(v) { // annulus filled from bottom up
    let rest = v, md = this.state.f.td;
    for (let i = this.state.annulus.length - 1; i >= 0; i--) {
      const a = this.state.annulus[i], cap = Number(a.cap) || 1e-9, len = Number(a.len) || 0;
      if (rest <= cap * len) return md - rest / cap;
      rest -= cap * len; md -= len;
    }
    return md;
  }

  calc() {
    const f = this.state.f;
    const tvd = this.tvdAt(f.td);
    // ── IADC Rounding Rules ───────────────────────────────────────────────
    // 1. Kill Mud Weight (KMW): ROUND UP to 1 decimal place (Field Units: ppg)
    const rawKmw = f.mw + f.sidpp / (0.052 * (tvd || 1));
    const kmw = Math.ceil((rawKmw - 1e-9) * 10) / 10;

    // 2. Initial Circulating Pressure (ICP): whole number (psi)
    const icp = Math.round(f.sidpp + f.scrp);

    // 3. Final Circulating Pressure (FCP): ROUND UP to nearest whole number (psi)
    //    Carries forward the already-rounded KMW per IADC Golden Rule.
    const rawFcp = f.scrp * kmw / (f.mw || 1);
    const fcp = Math.ceil(rawFcp - 1e-9);

    const sVol = this.vol(this.state.string), aVol = this.vol(this.state.annulus);
    const po = f.pumpOut || 1e-6;
    const sBit = sVol / po, sBU = aVol / po;
    const shoeTvd = this.tvdAt(f.shoe);

    // 4. Leak-Off Test (LOT) / EMW / MAMW: ROUND DOWN to 1 decimal place (ppg)
    const rawMamw = f.strength === 'lot' ? f.lotMw + f.lotP / (0.052 * (shoeTvd || 1))
                  : f.strength === 'fg'  ? f.fg / 0.052
                  : f.mamwIn;
    const mamw = Math.floor((rawMamw + 1e-9) * 10) / 10;

    // 5. MAASP: Carry forward rounded MAMW & ROUND DOWN to whole number (psi)
    const rawMaasp = (mamw - f.mw) * 0.052 * shoeTvd;
    const maasp = Math.floor(rawMaasp + 1e-9);

    // 6. Wait & Weight Pressure Reduction Schedule: ROUND DOWN to whole number (psi/100 stks)
    const prPer100 = Math.floor(((icp - fcp) * 100 / (sBit || 1)) + 1e-9);
    const prPerStep = Math.floor(((icp - fcp) / 10) + 1e-9);

    const total = Math.round(sBit) + Math.round(sBU);

    return { tvd, kmw, icp, fcp, sVol, aVol, sBit, sBU, total, maasp, mamw, shoeTvd,
             prPer100, prPerStep,
             tBit: Math.round(sBit) / (f.spm || 1), tBU: Math.round(sBU) / (f.spm || 1),
             dGrad: 0.052 * (kmw - f.mw) };
  }
  dpAt(s, c) { // planned drillpipe pressure at stroke s
    const f = this.state.f;
    if (s >= c.sBit) return c.fcp;
    const v = s * f.pumpOut, frac = Math.min(1, v / (c.sVol || 1));
    const md = this.mdAtVol(v);
    const fric = f.scrp * (1 + (c.kmw / (f.mw || 1) - 1) * frac);
    return Math.max(0, f.sidpp + fric - c.dGrad * this.tvdAt(md));
  }
  cpAt(s, c) {
    const f = this.state.f;
    if (s <= c.sBit) return f.sicp;
    const fr = Math.min(1, (s - c.sBit) / (c.sBU || 1));
    const md = this.mdFromBottomVol(fr * c.aVol);
    const gain = c.dGrad * (c.tvd - this.tvdAt(md));
    return Math.max(0, f.sicp - gain - (f.sicp - f.sidpp) * fr);
  }

  // ── field plumbing ───────────────────────────────────────
  set(key, kind) {
    return e => {
      const raw = e.target.value;
      const c = this.u(kind), v = parseFloat(raw.replace(/,/g, ''));
      this.setState(st => ({
        draft: { ...st.draft, [key]: raw },
        f: isFinite(v) ? { ...st.f, [key]: v / c.f } : st.f,
      }));
    };
  }
  fld(key, label, kind) {
    const d = this.state.draft[key];
    return { label, unit: this.u(kind).u, value: d !== undefined ? d : this.disp(this.state.f[key], kind), onChange: this.set(key, kind) };
  }
  rowSet(list, i, key, mul) {
    return e => {
      const raw = e.target.value, v = parseFloat(raw.replace(/,/g, ''));
      this.setState(st => {
        const arr = st[list].slice();
        arr[i] = { ...arr[i], [key]: key === 'name' ? raw : (isFinite(v) ? v * mul : arr[i][key]),
                   [key + 'Draft']: raw };
        return { [list]: arr };
      });
    };
  }
  chip(active) {
    return active
      ? { bg:'oklch(0.80 0.15 75 / .16)', fg:AMBER, bc:'oklch(0.80 0.15 75 / .55)' }
      : { bg:'#101312', fg:'#7f8583', bc:'#242a2b' };
  }

  // ── shared derivations ───────────────────────────────────
  sched(c, n) {
    const f = this.state.f, out = [];
    for (let i = 0; i <= n; i++) {
      const s = c.sBit * i / n, md = this.mdAtVol(s * f.pumpOut);
      out.push({ s, md, tvd: this.tvdAt(md), pdp: this.dpAt(s, c), cp: this.cpAt(s, c) });
    }
    return out;
  }
  groups(c) {
    const f = this.state.f, st = this.state;
    const uP = this.u('press'), uV = this.u('vol'), uD = this.u('depth'), uW = this.u('dens');
    const g = [
      { title:'Pressures', rows:[
        { label:'Kill mud weight', value:this.disp(c.kmw,'dens'), unit:uW.u },
        { label:'Initial circulating pressure', value:this.disp(c.icp,'press'), unit:uP.u },
        { label:'Final circulating pressure', value:this.disp(c.fcp,'press'), unit:uP.u },
        { label:'Dynamic loss (SCR)', value:this.disp(f.scrp,'press'), unit:uP.u },
        { label:'Max allowable mud weight', value:this.disp(c.mamw,'dens'), unit:uW.u },
        { label:'MAASP', value:this.disp(c.maasp,'press'), unit:uP.u },
        { label:'W&W pressure drop / 100 stks', value:num(c.prPer100 * uP.f, uP.u === 'bar' ? 2 : uP.d), unit:uP.u + '/100 stk' },
      ]},
      { title:'Volumes & strokes', rows:[
        { label:'String volume', value:this.disp(c.sVol,'vol'), unit:uV.u },
        { label:'Annulus volume', value:this.disp(c.aVol,'vol'), unit:uV.u },
        { label:'Strokes surface → bit', value:num(Math.round(c.sBit),0), unit:'stk' },
        { label:'Strokes bit → surface', value:num(Math.round(c.sBU),0), unit:'stk' },
        { label:'Total strokes', value:num(Math.round(c.total),0), unit:'stk' },
      ]},
      { title:'Time & depths', rows:[
        { label:'Time to bit', value:num(c.tBit,0)+' min', unit:'@ '+num(f.spm,0)+' spm' },
        { label:'Bottoms up', value:num(c.tBU,0)+' min', unit:'@ '+num(f.spm,0)+' spm' },
        { label:'Measured depth', value:this.disp(f.td,'depth'), unit:uD.u },
        { label:'True vertical depth', value:this.disp(c.tvd,'depth'), unit:uD.u },
        { label:'Shoe TVD', value:this.disp(c.shoeTvd,'depth'), unit:uD.u },
      ]},
      { title:'Shut-in data', rows:[
        { label:'SIDPP', value:this.disp(f.sidpp,'press'), unit:uP.u },
        { label:'SICP', value:this.disp(f.sicp,'press'), unit:uP.u },
        { label:'Pit gain', value:this.disp(f.gain,'vol'), unit:uV.u },
        { label:'Current mud weight', value:this.disp(f.mw,'dens'), unit:uW.u },
      ]},
    ];
    if (st.method === 'vol') g.unshift({ title:'Volumetric steps', rows:[
      { label:'Pressure increment', value:this.disp(100,'press'), unit:uP.u },
      { label:'Mud bleed per step', value:this.disp(this.bleedVol(),'vol'), unit:uV.u },
      { label:'Working margin', value:this.disp(100,'press'), unit:uP.u },
    ]});
    if (st.method === 'bh') g.unshift({ title:'Bullhead limits', rows:[
      { label:'Est. injection pressure', value:this.disp(f.sicp + f.scrp,'press'), unit:uP.u },
      { label:'Surface pressure limit', value:this.disp(c.maasp,'press'), unit:uP.u },
      { label:'Margin to MAASP', value:this.disp(c.maasp - f.sicp,'press'), unit:uP.u },
    ]});
    return g;
  }
  bleedVol() {
    const a = this.state.annulus[0];
    return 100 / (0.052 * (this.state.f.mw || 1)) * ((a && Number(a.cap)) || 0);
  }
  methodName() { return { ww:'Wait & Weight', dm:"Driller's Method", bh:'Bullheading', vol:'Volumetric' }[this.state.method]; }
  slug() { return (this.state.wellName || 'well').replace(/[^a-z0-9]+/gi, '-').toLowerCase(); }

  // ── exports ──────────────────────────────────────────────
  dl(name, mime, data) {
    const b = data instanceof Blob ? data : new Blob([data], { type: mime });
    const u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 8000);
  }
  csv(c) {
    const uD = this.u('depth'), uP = this.u('press');
    const L = [];
    L.push(['Well kill stroke schedule']);
    L.push(['Well', this.state.wellName]);
    L.push(['Method', this.methodName()]);
    L.push(['Generated', new Date().toLocaleString()]);
    L.push(['Units', SYS[this.state.sys].label]);
    L.push(['Kill mud weight', this.disp(c.kmw,'dens'), this.u('dens').u]);
    L.push(['ICP', this.disp(c.icp,'press'), uP.u]);
    L.push(['FCP', this.disp(c.fcp,'press'), uP.u]);
    L.push(['MAASP', this.disp(c.maasp,'press'), uP.u]);
    L.push(['Pressure drop / 100 stks', num(c.prPer100 * uP.f, uP.u === 'bar' ? 2 : uP.d), uP.u + '/100 stk']);
    L.push(['Strokes to bit', Math.round(c.sBit)]);
    L.push(['Total strokes', c.total]);
    L.push([]);
    L.push(['Strokes', 'MD ('+uD.u+')', 'TVD ('+uD.u+')', 'DP pressure ('+uP.u+')', 'Casing pressure ('+uP.u+')']);
    this.sched(c, 20).forEach(r => L.push([Math.round(r.s), Math.round(r.md * uD.f), Math.round(r.tvd * uD.f),
      (r.pdp * uP.f).toFixed(uP.d), (r.cp * uP.f).toFixed(uP.d)]));
    return L.map(r => r.map(v => (typeof v === 'string' && /[",]/.test(v)) ? '"' + v.replace(/"/g,'""') + '"' : v).join(',')).join('\r\n');
  }
  plotSvg(c, W, H, print) {
    const f = this.state.f, uP = this.u('press');
    const L = 56, R = W - 14, T = 14, B = H - 40;
    const xmax = c.total || 1, ymax = Math.max(c.icp, f.sicp) * 1.18 || 1;
    const X = s => L + (s / xmax) * (R - L), Y = p => B - (p / ymax) * (B - T);
    const ln = fn => { const a = []; for (let i = 0; i <= 120; i++) { const s = xmax * i / 120; a.push(X(s).toFixed(1) + ',' + Y(fn(s)).toFixed(1)); } return a.join(' '); };
    const ink = print ? '#111' : '#e8e6e1', dim = print ? '#888' : '#5f6664', grid = print ? '#ddd' : '#1c2021';
    const amber = print ? '#b8770a' : 'oklch(0.82 0.15 75)', blue = print ? '#2b5fa8' : 'oklch(0.62 0.13 240)';
    let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    s += '<rect width="' + W + '" height="' + H + '" fill="' + (print ? '#fff' : '#0c0f0e') + '"/>';
    if (f.wellType === 'horizontal') {
      const x0 = X(this.volAtMd(f.kop + f.build) / f.pumpOut), x1 = X(c.sBit);
      s += '<rect x="' + x0.toFixed(1) + '" y="' + T + '" width="' + Math.max(0, x1 - x0).toFixed(1) + '" height="' + (B - T) + '" fill="' + (print ? '#f4ead6' : 'rgba(245,180,60,.07)') + '"/>';
      s += '<text x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (T + 12) + '" fill="' + dim + '" font-family="monospace" font-size="8" text-anchor="middle">LATERAL — NO TVD GAIN</text>';
    }
    [[c.icp, amber], [c.fcp, amber], [f.sicp, blue], [0, ink]].forEach(([v, col]) => {
      s += '<line x1="' + L + '" y1="' + Y(v).toFixed(1) + '" x2="' + R + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (v ? grid : dim) + '" stroke-width="1" stroke-dasharray="' + (v ? '3 3' : '0') + '"/>';
      s += '<text x="' + (L - 6) + '" y="' + (Y(v) + 3).toFixed(1) + '" fill="' + dim + '" font-family="monospace" font-size="8.5" text-anchor="end">' + this.disp(v, 'press') + '</text>';
    });
    [[0, 'SHUT-IN'], [c.sBit, 'BIT'], [c.total, 'KILL MUD OUT']].forEach(([sv, lab]) => {
      s += '<line x1="' + X(sv).toFixed(1) + '" y1="' + T + '" x2="' + X(sv).toFixed(1) + '" y2="' + B + '" stroke="' + grid + '" stroke-width="1"/>';
      s += '<text x="' + X(sv).toFixed(1) + '" y="' + (B + 14) + '" fill="' + dim + '" font-family="monospace" font-size="8.5" text-anchor="middle">' + num(Math.round(sv), 0) + '</text>';
      s += '<text x="' + X(sv).toFixed(1) + '" y="' + (B + 25) + '" fill="' + dim + '" font-family="sans-serif" font-size="8" text-anchor="middle">' + lab + '</text>';
    });
    s += '<polyline points="' + ln(v => this.cpAt(v, c)) + '" fill="none" stroke="' + blue + '" stroke-width="1.6" stroke-dasharray="4 3"/>';
    s += '<polyline points="' + ln(v => this.dpAt(v, c)) + '" fill="none" stroke="' + amber + '" stroke-width="2.4"/>';
    this.sched(c, 11).forEach(r => { s += '<circle cx="' + X(r.s).toFixed(1) + '" cy="' + Y(r.pdp).toFixed(1) + '" r="2.6" fill="' + (print ? '#fff' : '#0c0f0e') + '" stroke="' + amber + '" stroke-width="1.4"/>'; });
    s += '<text x="' + (L - 6) + '" y="' + (T + 4) + '" fill="' + dim + '" font-family="sans-serif" font-size="8" text-anchor="end">' + uP.u + '</text>';
    s += '<text x="' + R + '" y="' + (H - 4) + '" fill="' + dim + '" font-family="sans-serif" font-size="8.5" text-anchor="end">STROKES</text>';
    return s + '</svg>';
  }
  sheetHtml(c) {
    const f = this.state.f, uD = this.u('depth'), uP = this.u('press');
    const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    const cell = 'padding:4px 7px;border-bottom:1px solid #e3e0da';
    const grp = g => '<div style="break-inside:avoid;border:1px solid #cfcbc3;border-radius:4px;overflow:hidden">'
      + '<div style="padding:5px 8px;background:#f2efe9;border-bottom:1px solid #cfcbc3;font:700 8.5px/1 sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5b5750">' + esc(g.title) + '</div>'
      + g.rows.map(r => '<div style="display:flex;align-items:baseline;' + cell + '"><div style="flex:1;font:400 10px/1.3 sans-serif;color:#3a3733">' + esc(r.label)
        + '</div><div style="font:700 11px/1 ui-monospace,monospace;color:#111">' + esc(r.value) + '</div><div style="width:52px;text-align:right;font:400 8.5px/1 ui-monospace,monospace;color:#8a867e">' + esc(r.unit) + '</div></div>').join('')
      + '</div>';
    const sig = ['Prepared by', 'Driller', 'Toolpusher', 'Company man / OIM'].map(r =>
      '<div style="display:flex;gap:10px;align-items:flex-end;margin-top:16px">'
      + '<div style="width:104px;font:700 8.5px/1 sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#5b5750">' + r + '</div>'
      + '<div style="flex:1.4;border-bottom:1px solid #8a867e;height:15px"></div>'
      + '<div style="flex:1.6;border-bottom:1px solid #8a867e;height:15px"></div>'
      + '<div style="width:104px;border-bottom:1px solid #8a867e;height:15px"></div></div>').join('');
    const rows = this.sched(c, 20).map((r, i) => '<tr style="background:' + (i % 2 ? '#faf9f6' : '#fff') + '">'
      + '<td style="' + cell + ';font:700 10px ui-monospace,monospace">' + num(Math.round(r.s), 0) + '</td>'
      + '<td style="' + cell + ';text-align:right;font:400 10px ui-monospace,monospace;color:#5b5750">' + this.disp(r.md, 'depth') + '</td>'
      + '<td style="' + cell + ';text-align:right;font:400 10px ui-monospace,monospace;color:#5b5750">' + this.disp(r.tvd, 'depth') + '</td>'
      + '<td style="' + cell + ';text-align:right;font:700 10.5px ui-monospace,monospace;color:#8a5c05">' + this.disp(r.pdp, 'press') + '</td>'
      + '<td style="' + cell + ';text-align:right;font:400 10px ui-monospace,monospace;color:#2b5fa8">' + this.disp(r.cp, 'press') + '</td></tr>').join('');
    const th = t => '<th style="text-align:right;padding:5px 7px;border-bottom:1.5px solid #111;font:700 8px sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#5b5750">' + t + '</th>';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kill sheet — ' + esc(this.state.wellName) + '</title>'
      + '<style>@page{size:letter;margin:0.45in}html,body{margin:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>'
      + '<body><div style="font-family:sans-serif;width:100%">'
      + '<div style="display:flex;align-items:flex-end;gap:12px;border-bottom:2px solid #111;padding-bottom:9px">'
      + '<div><div style="display:flex;align-items:baseline;gap:1px"><span style="font:700 26px/1 ui-monospace,monospace;color:#c8860d">5</span>'
      + '<span style="font:700 26px/1 ui-monospace,monospace;color:#111">K</span><span style="font:700 26px/1 ui-monospace,monospace;color:#1f8a4c">R</span></div>'
      + '<div style="margin-top:3px;font:700 8px/1 sans-serif;letter-spacing:.4em;text-transform:uppercase;color:#6b675f">Oil</div></div>'
      + '<div style="flex:1"><div style="font:700 15px/1 sans-serif;letter-spacing:.16em;text-transform:uppercase">Well kill sheet</div>'
      + '<div style="margin-top:4px;font:400 9.5px/1 ui-monospace,monospace;color:#6b675f">' + esc(this.methodName()) + ' · ' + (f.wellType === 'horizontal' ? 'HORIZONTAL' : f.wellType.toUpperCase()) + ' · ' + SYS[this.state.sys].label + ' UNITS</div></div>'
      + '<div style="text-align:right;font:400 9px/1.5 ui-monospace,monospace;color:#6b675f">' + esc(this.state.wellName)
      + '<br>' + this.disp(f.td,'depth') + ' ' + uD.u + ' MD / ' + this.disp(c.tvd,'depth') + ' ' + uD.u + ' TVD<br>' + new Date().toLocaleString() + '</div></div>'
      + '<div style="display:flex;gap:10px;margin-top:12px">'
      + ['Kill mud weight|' + this.disp(c.kmw,'dens') + ' ' + this.u('dens').u, 'ICP|' + this.disp(c.icp,'press') + ' ' + uP.u,
         'FCP|' + this.disp(c.fcp,'press') + ' ' + uP.u, 'Strokes to bit|' + num(Math.round(c.sBit),0)].map(x => {
        const p = x.split('|');
        return '<div style="flex:1;border:1px solid #cfcbc3;border-left:3px solid #c8860d;border-radius:4px;padding:7px 9px">'
          + '<div style="font:700 7.5px/1 sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#6b675f">' + p[0] + '</div>'
          + '<div style="margin-top:5px;font:700 16px/1 ui-monospace,monospace">' + p[1] + '</div></div>'; }).join('')
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px">' + this.groups(c).map(grp).join('') + '</div>'
      + '<div style="margin-top:12px;break-inside:avoid"><div style="font:700 8.5px/1 sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5b5750;margin-bottom:6px">Kill plot — drillpipe (solid) &amp; casing (dashed)</div>'
      + this.plotSvg(c, 700, 250, true) + '</div>'
      + '<div style="margin-top:14px;break-before:page"><div style="font:700 8.5px/1 sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#5b5750;margin-bottom:6px">Stroke schedule</div>'
      + '<table style="width:100%;border-collapse:collapse"><thead><tr>' + th('Strokes') + th('MD ' + uD.u) + th('TVD ' + uD.u) + th('DP ' + uP.u) + th('Casing ' + uP.u)
      + '</tr></thead><tbody>' + rows + '</tbody></table></div>'
      + '<div style="margin-top:14px;font:400 9.5px/1.5 sans-serif;color:#3a3733;break-inside:avoid">' + esc({
          ww:'One circulation. Drillpipe pressure follows the schedule as kill mud fills the string; hold casing pressure only to stay on the DP schedule.',
          dm:'First circulation at constant ICP removes the influx, second circulation displaces kill mud on the schedule above.',
          bh:'Pump kill mud down the annulus against the influx. Never exceed MAASP or the weakest-link surface pressure.',
          vol:'Allow pressure to build in increments, then bleed the calculated mud volume at constant pressure. Repeat while the bubble migrates.' }[this.state.method]) + '</div>'
      + '<div style="margin-top:18px;break-inside:avoid"><div style="display:flex;gap:10px;font:700 7.5px/1 sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a867e">'
      + '<div style="width:104px"></div><div style="flex:1.4">Name</div><div style="flex:1.6">Signature</div><div style="width:104px">Date / time</div></div>'
      + sig + '</div>'
      + '<div style="margin-top:16px;border-top:1px solid #cfcbc3;padding-top:6px;font:400 8px/1.4 ui-monospace,monospace;color:#8a867e">'
      + 'Planned values only. Verify against rig instrumentation and well-specific well control programme before use. Calculated in accordance with IADC WellSharp rounding rules (KMW round up to 0.1, LOT/MAMW round down to 0.1, MAASP round down whole, FCP round up whole, W&W step-down round down whole).</div>'
      + '</div></body></html>';
  }
  printSheet(c) {
    const fr = document.createElement('iframe');
    fr.setAttribute('title', 'kill-sheet');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0';
    fr.onload = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
    document.body.appendChild(fr);
    fr.srcdoc = this.sheetHtml(c);
    setTimeout(() => fr.remove(), 60000);
  }
  pngPlot(c) {
    const svg = this.plotSvg(c, 720, 300, false);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = 1440; cv.height = 600;
      const g = cv.getContext('2d'); g.scale(2, 2); g.drawImage(img, 0, 0);
      cv.toBlob(b => { this.dl('kill-plot-' + this.slug() + '.png', 'image/png', b); URL.revokeObjectURL(url); });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }
  async share(c) {
    const uP = this.u('press'), text = ['5KR OIL — WELL KILL', this.state.wellName, this.methodName(),
      'KMW ' + this.disp(c.kmw,'dens') + ' ' + this.u('dens').u,
      'ICP ' + this.disp(c.icp,'press') + ' ' + uP.u + ' → FCP ' + this.disp(c.fcp,'press') + ' ' + uP.u,
      'Strokes to bit ' + num(Math.round(c.sBit),0) + ' · total ' + num(Math.round(c.total),0),
      'MAASP ' + this.disp(c.maasp,'press') + ' ' + uP.u].join('\n');
    const file = new File([this.csv(c)], 'stroke-schedule-' + this.slug() + '.csv', { type: 'text/csv' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) return navigator.share({ title: 'Well kill sheet', text, files: [file] });
      if (navigator.share) return navigator.share({ title: 'Well kill sheet', text });
      await navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  renderVals() {
    const st = this.state, f = st.f, c = this.calc();
    const mode = (this.props.inputFlow ?? 'wizard') === 'dense' ? 'dense' : 'wizard';
    const dense = mode === 'dense';
    const layout = this.props.sheetLayout ?? 'sheet';
    const uSw = this.props.unitSwitch ?? 'header';
    const live = (this.props.liveTracking ?? true) === true;
    const showOut = st.step === 5;
    const showInputs = !showOut;
    const uD = this.u('depth'), uP = this.u('press'), uV = this.u('vol'), uC = this.u('cap');
    const isHz = f.wellType === 'horizontal';

    // trajectory sketch
    const mdMax = f.td || 1;
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const md = mdMax * i / 60, tv = this.tvdAt(md);
      let hz = 0;
      if (f.wellType !== 'vertical') {
        const a = f.incl * D2R;
        if (md > f.kop) {
          const R = f.build / (a || 1e-6);
          if (md <= f.kop + f.build) { const t = a * (md - f.kop) / f.build; hz = R * (1 - Math.cos(t)); }
          else hz = R * (1 - Math.cos(a)) + (md - f.kop - f.build) * Math.sin(a);
        }
      }
      pts.push([hz, tv]);
    }
    const hzMax = Math.max(1, ...pts.map(p => p[0])), tvMax = Math.max(1, ...pts.map(p => p[1]));
    const scale = Math.min(300 / hzMax, 94 / tvMax);
    const px = h => 14 + h * (f.wellType === 'vertical' ? 0 : scale);
    const py = t => 14 + t * Math.min(94 / tvMax, scale === Infinity ? 94 / tvMax : scale);
    const trajPath = pts.map((p, i) => (i ? 'L' : 'M') + px(p[0]).toFixed(1) + ' ' + py(p[1]).toFixed(1)).join(' ');
    const last = pts[pts.length - 1];

    // schedule
    const N = 11, raw = this.sched(c, N);
    const rows = raw.map((r, i) => ({ strokes: num(Math.round(r.s), 0), md: this.disp(r.md, 'depth'), tvd: this.disp(r.tvd, 'depth'),
      pdp: this.disp(r.pdp, 'press'), cp: this.disp(r.cp, 'press'), bg: i % 2 ? '#0e1110' : 'transparent' }));

    // plot
    const xmax = c.total || 1;
    const ymax = Math.max(c.icp, f.sicp) * 1.18 || 1;
    const X = s => 44 + (s / xmax) * 306, Y = p => 168 - (p / ymax) * 156;
    const line = fn => { const a = []; for (let i = 0; i <= 90; i++) { const s = xmax * i / 90; a.push(X(s).toFixed(1) + ',' + Y(fn(s)).toFixed(1)); } return a.join(' '); };
    const latStart = isHz ? this.volAtMd(f.kop + f.build) / f.pumpOut : 0;
    const gridY = [
      { v: c.icp, label: this.disp(c.icp, 'press'), stroke:'oklch(0.80 0.15 75 / .3)', dash:'3 3' },
      { v: c.fcp, label: this.disp(c.fcp, 'press'), stroke:'oklch(0.80 0.15 75 / .3)', dash:'3 3' },
      { v: f.sicp, label: this.disp(f.sicp, 'press'), stroke:'oklch(0.62 0.13 240 / .3)', dash:'3 3' },
      { v: 0, label:'0', stroke:'#2a2f30', dash:'0' },
    ].map(g => ({ ...g, y: Y(g.v).toFixed(1), ty: (Y(g.v) + 3).toFixed(1) }));
    const gridX = [
      { s: 0, label:'0', sub:'SHUT-IN' },
      { s: c.sBit, label: num(Math.round(c.sBit), 0), sub:'BIT' },
      { s: c.total, label: num(Math.round(c.total), 0), sub:'KILL MUD OUT' },
    ].map(g => ({ ...g, x: X(g.s).toFixed(1) }));

    const methodMap = { ww:'Wait & Weight', dm:"Driller's Method", bh:'Bullheading', vol:'Volumetric' };
    const bleed = 100 / (0.052 * (f.mw || 1)) * (Number(st.annulus[0] && st.annulus[0].cap) || 0);

    const groups = this.groups(c);

    const notes = {
      ww: 'One circulation. Drillpipe pressure follows the schedule as kill mud fills the string; hold casing pressure only to stay on the DP schedule.',
      dm: "First circulation at constant ICP removes the influx, second circulation displaces kill mud on the schedule below.",
      bh: 'Pump kill mud down the annulus against the influx. Never exceed MAASP or the weakest-link surface pressure.',
      vol: 'Allow pressure to build in increments, then bleed the calculated mud volume at constant pressure. Repeat while the bubble migrates.',
    };

    const geomList = st.geomTab === 'string' ? 'string' : 'annulus';
    const gArr = st[geomList];
    const geomRows = gArr.map((r, i) => ({
      name: r.name,
      len: r.lenDraft !== undefined ? r.lenDraft : num(r.len * uD.f, uD.d),
      cap: r.capDraft !== undefined ? r.capDraft : num(r.cap * uC.f, uC.d),
      onName: this.rowSet(geomList, i, 'name'),
      onLen: this.rowSet(geomList, i, 'len', 1 / uD.f),
      onCap: this.rowSet(geomList, i, 'cap', 1 / uC.f),
      onDel: () => this.setState(s => ({ [geomList]: s[geomList].filter((_, j) => j !== i) })),
    }));
    const gLen = this.sum(gArr, 'len');
    const lenOk = Math.abs(gLen - f.td) < Math.max(5, f.td * 0.002);

    const dev = (() => {
      const a = st.actuals[st.actuals.length - 1];
      if (!a) return { msg:'No actual readings logged. Log DP pressure at each 100-stroke mark.', fg:'#5f6664' };
      const d = a.p - this.dpAt(a.s, c);
      const ad = Math.abs(d);
      return { msg: (d >= 0 ? '+' : '−') + this.disp(ad, 'press') + ' ' + uP.u + ' vs plan at ' + num(a.s, 0) + ' stk · ' + (ad < 50 ? 'on schedule' : 'adjust choke ' + (d > 0 ? 'open' : 'closed')),
               fg: ad < 50 ? GREEN : (ad < 100 ? AMBER : RED) };
    })();

    const run = { pdf: () => this.printSheet(c), csv: () => this.dl('kill-sheet-' + this.slug() + '.csv', 'text/csv;charset=utf-8', this.csv(c)),
                  png: () => this.pngPlot(c), shr: () => this.share(c) };
    const csvName = 'stroke-schedule-' + this.slug() + '.csv';
    run.csv = () => this.dl(csvName, 'text/csv;charset=utf-8', this.csv(c));
    const done = { pdf:'PRINT', csv:'SAVED', png:'SAVED', shr:'SENT' };
    const exp = k => () => { try { run[k](); } catch (e) {} this.setState(s => ({ exported: { ...s.exported, [k]: done[k] } })); };

    return {
      wellLabel: (isHz ? 'HORIZONTAL' : f.wellType.toUpperCase()) + ' · ' + this.disp(f.td, 'depth') + ' ' + uD.u + ' MD',
      unitHeader: uSw === 'header', unitPerField: uSw === 'perField',
      systems: Object.values(SYS).map(s => ({ label: s.label, ...this.chip(st.sys === s.key && !Object.keys(st.over).length),
        onClick: () => this.setState({ sys: s.key, over: {}, draft: {} }) })),
      dims: KINDS.map(k => ({ name: k === 'dens' ? 'density' : k === 'press' ? 'pressure' : k, unit: this.u(k).u,
        onClick: () => this.setState(s => { const cur = this.u(k).u, list = ALT[k], nx = list[(list.indexOf(cur) + 1) % list.length];
          return { over: { ...s.over, [k]: nx }, draft: {} }; }) })),
      steps: dense
        ? [{ label:'All inputs', flex:1, bar:AMBER, fg:AMBER, onClick:()=>{} }]
        : ['Well','Geometry','Mud/pump','Shut-in'].map((l, i) => ({ label:l, flex:1,
            bar: st.step >= i + 1 ? AMBER : '#22282a', fg: st.step === i + 1 ? AMBER : '#5f6664',
            onClick: () => this.setState({ step: i + 1 }) })),
      showInputs, showOut,
      showWell: showInputs && (dense || st.step === 1),
      showGeom: showInputs && (dense || st.step === 2),
      showPump: showInputs && (dense || st.step === 3),
      showShut: showInputs && (dense || st.step === 4),
      canBack: !dense && st.step > 1,
      nextLabel: dense ? 'Generate kill sheet' : (st.step === 4 ? 'Generate kill sheet' : 'Continue'),
      next: () => this.setState(s => ({ step: dense ? 5 : Math.min(5, s.step + 1) })),
      back: () => this.setState(s => ({ step: s.step === 5 ? (dense ? 1 : 4) : Math.max(1, s.step - 1) })),

      wellTypes: [
        { key:'vertical', label:'Vertical', sub:'TVD = MD' },
        { key:'deviated', label:'Deviated', sub:'build + tangent' },
        { key:'horizontal', label:'Horizontal', sub:'90° lateral' },
      ].map(t => { const a = f.wellType === t.key, k = this.chip(a);
        return { label:t.label, sub:t.sub, bg:k.bg, fg:a ? AMBER : '#cfccc6', bc:k.bc,
          onClick: () => this.setState(s => ({ f: { ...s.f, wellType: t.key, incl: t.key === 'horizontal' ? 90 : (t.key === 'deviated' ? 62 : 0) } })) }; }),
      wellFields: (f.wellType === 'vertical'
        ? [this.fld('td','Total depth (MD)','depth')]
        : [this.fld('td','Total depth (MD)','depth'), this.fld('kop','Kick-off point','depth'),
           this.fld('build','Build section length','depth'),
           { label:'Max inclination', unit:'deg', value: st.draft.incl !== undefined ? st.draft.incl : num(f.incl,0),
             onChange: e => { const v = parseFloat(e.target.value); this.setState(s => ({ draft:{...s.draft, incl:e.target.value}, f: isFinite(v) ? {...s.f, incl:v} : s.f })); } }]
      ).concat([this.fld('shoe','Casing shoe (MD)','depth')]),
      wellName: st.wellName,
      onWellName: e => this.setState({ wellName: e.target.value }),
      tvdOut: this.disp(c.tvd, 'depth'), uDepth: uD.u, uPress: uP.u,
      trajPath, trajBitX: px(last[0]).toFixed(1), trajBitY: py(last[1]).toFixed(1),
      trajLabX: Math.max(24, px(last[0]) - 6).toFixed(1), trajLabY: Math.min(110, py(last[1]) + 12).toFixed(1),
      trajLab: 'TVD ' + this.disp(c.tvd, 'depth') + ' ' + uD.u,

      geomTabs: [{ k:'string', label:'Drill string' }, { k:'annulus', label:'Annulus' }].map(g => {
        const a = st.geomTab === g.k, k = this.chip(a);
        return { label:g.label, bg:k.bg, fg:a ? AMBER : '#7f8583', bc:k.bc, onClick: () => this.setState({ geomTab:g.k }) }; }),
      geomRows, lenHdr: 'Len ' + uD.u, capHdr: 'Cap ' + uC.u,
      geomTotal: this.disp(this.vol(gArr), 'vol') + ' ' + uV.u,
      lenCheckMsg: lenOk ? 'Section lengths total ' + this.disp(gLen,'depth') + ' ' + uD.u + ' — matches MD.'
                         : 'Sections total ' + this.disp(gLen,'depth') + ' ' + uD.u + ' vs ' + this.disp(f.td,'depth') + ' ' + uD.u + ' MD. Check lengths.',
      lenCheckBg: lenOk ? 'oklch(0.78 0.15 150 / .10)' : 'oklch(0.65 0.19 27 / .12)',
      lenCheckBc: lenOk ? 'oklch(0.78 0.15 150 / .4)' : 'oklch(0.65 0.19 27 / .45)',
      lenCheckFg: lenOk ? GREEN : RED,
      addRow: () => this.setState(s => ({ [geomList]: [...s[geomList], { name:'New section', len:0, cap:0.02 }] })),

      pumpFields: [ this.fld('mw','Current mud weight','dens'),
        { label:'Pump output', unit:this.u('vol').u === 'bbl' ? 'bbl/stk' : 'L/stk',
          value: st.draft.pumpOut !== undefined ? st.draft.pumpOut : num(f.pumpOut * SYS[st.sys].out[1], SYS[st.sys].out[2]),
          onChange: e => { const v = parseFloat(e.target.value); this.setState(s => ({ draft:{...s.draft,pumpOut:e.target.value}, f: isFinite(v) ? {...s.f, pumpOut: v / SYS[st.sys].out[1]} : s.f })); } },
        { label:'Slow circulating rate', unit:'spm', value: st.draft.spm !== undefined ? st.draft.spm : num(f.spm,0),
          onChange: e => { const v = parseFloat(e.target.value); this.setState(s => ({ draft:{...s.draft,spm:e.target.value}, f: isFinite(v) ? {...s.f, spm:v} : s.f })); } },
        this.fld('scrp','SCR pressure','press') ],
      strengthModes: [
        { k:'lot', label:'Leak-off test' },
        { k:'fg', label:'Frac gradient' },
        { k:'emw', label:'MAMW direct' },
      ].map(m => { const a = f.strength === m.k, k = this.chip(a);
        return { label:m.label, bg:k.bg, fg:a ? AMBER : '#7f8583', bc:k.bc,
          onClick: () => this.setState(s => ({ f: { ...s.f, strength: m.k }, draft: {} })) }; }),
      strengthFields: f.strength === 'lot'
        ? [ this.fld('lotMw','Mud weight at test','dens'), this.fld('lotP','Surface leak-off pressure','press') ]
        : f.strength === 'fg'
        ? [ this.fld('fg','Fracture gradient at shoe','grad') ]
        : [ this.fld('mamwIn','Max allowable mud weight','dens') ],
      strengthNote: f.strength === 'lot'
        ? 'MAMW = test mud weight + leak-off pressure converted over shoe TVD (rounded down to 0.1 ppg per IADC rules).'
        : f.strength === 'fg'
        ? 'MAMW = fracture gradient ÷ 0.052 (rounded down to 0.1 ppg per IADC rules). Enter the gradient at the shoe or weakest exposed formation.'
        : 'MAASP = (MAMW − current mud weight) over shoe TVD (rounded down to whole psi per IADC rules).',
      mamwOut: this.disp(c.mamw, 'dens'), uDens: this.u('dens').u,
      maaspOut: this.disp(c.maasp, 'press'),
      shutFields: [ this.fld('sidpp','SIDPP','press'), this.fld('sicp','SICP','press'), this.fld('gain','Pit gain','vol') ],
      methods: [
        { k:'ww', label:'Wait & Weight', sub:'one circulation · lowest annulus pressure' },
        { k:'dm', label:"Driller's Method", sub:'two circulations · no wait on mud' },
        { k:'bh', label:'Bullheading', sub:'no returns · shallow gas / no string' },
        { k:'vol', label:'Volumetric', sub:'off bottom · plugged string' },
      ].map(m => { const a = st.method === m.k;
        return { label:m.label, sub:m.sub, bg: a ? 'oklch(0.80 0.15 75 / .12)' : '#101312',
          bc: a ? 'oklch(0.80 0.15 75 / .5)' : '#242a2b', fg: a ? AMBER : '#cfccc6',
          dot: a ? AMBER : '#2e3435', onClick: () => this.setState({ method:m.k }) }; }),

      outTabs: [{ k:'sheet', label:'Kill sheet' }, { k:'sched', label:'Schedule' }, { k:'plot', label:'Plot' }].map(t => {
        const a = st.tab === t.k, k = this.chip(a);
        return { label:t.label, bg:k.bg, fg:a ? AMBER : '#7f8583', bc:k.bc, onClick: () => this.setState({ tab:t.k }) }; }),
      tabSheet: st.tab === 'sheet', tabSched: st.tab === 'sched', tabPlot: st.tab === 'plot',
      layoutSheet: layout === 'sheet', layoutCards: layout === 'cards',
      methodName: methodMap[st.method], stamp: 'REV A · ' + (isHz ? 'HZ' : f.wellType.slice(0,3).toUpperCase()),
      heroVals: [
        { label:'Kill mud weight', value:this.disp(c.kmw,'dens'), unit:this.u('dens').u, accent:GREEN },
        { label:'ICP', value:this.disp(c.icp,'press'), unit:uP.u, accent:AMBER },
        { label:'FCP', value:this.disp(c.fcp,'press'), unit:uP.u, accent:AMBER },
        { label:'Strokes to bit', value:num(Math.round(c.sBit),0), unit:'stk', accent:'oklch(0.80 0.02 240)' },
      ],
      maaspMsg: f.sicp < c.maasp ? 'SICP within MAASP' : 'SICP exceeds MAASP',
      maaspVal: this.disp(c.maasp - f.sicp, 'press') + ' ' + uP.u,
      maaspFg: f.sicp < c.maasp ? GREEN : RED,
      maaspBg: f.sicp < c.maasp ? 'oklch(0.78 0.15 150 / .10)' : 'oklch(0.65 0.19 27 / .12)',
      maaspBc: f.sicp < c.maasp ? 'oklch(0.78 0.15 150 / .35)' : 'oklch(0.65 0.19 27 / .45)',
      sheetGroups: groups,
      flatRows: groups.reduce((a, g) => a.concat(g.rows), []),
      note: notes[st.method],
      schedRows: rows,
      schedNote: isHz
        ? 'Pressure drops fast through the vertical and build sections, then flattens in the lateral — kill mud below the EOB adds no hydrostatic. Hold the last step pressure to the bit (W&W step-down: ' + num(c.prPer100 * uP.f, uP.u === 'bar' ? 2 : uP.d) + ' ' + uP.u + '/100 stks rounded down per IADC).'
        : 'Step down drillpipe pressure at each stroke mark (' + num(c.prPer100 * uP.f, uP.u === 'bar' ? 2 : uP.d) + ' ' + uP.u + '/100 stks, rounded down per IADC rules). Casing pressure column is the planned trace; the choke follows the DP schedule.',
      showLateral: isHz, latX: X(latStart).toFixed(1), latW: Math.max(0, X(c.sBit) - X(latStart)).toFixed(1),
      latTx: ((X(latStart) + X(c.sBit)) / 2).toFixed(1),
      gridY, gridX,
      dpPts: line(s => this.dpAt(s, c)), cpPts: line(s => this.cpAt(s, c)),
      dots: rows.map((r, i) => { const s = c.sBit * i / N; return { x: X(s).toFixed(1), y: Y(this.dpAt(s, c)).toFixed(1) }; }),
      actualDots: st.actuals.map(a => ({ x: X(a.s).toFixed(1), y: Y(a.p).toFixed(1) })),
      hasActuals: st.actuals.length > 0, live,
      actStk: st.actStk, actP: st.actP,
      onActStk: e => this.setState({ actStk: e.target.value }),
      onActP: e => this.setState({ actP: e.target.value }),
      logActual: () => { const s = parseFloat(st.actStk), p = parseFloat(st.actP);
        if (!isFinite(s) || !isFinite(p)) return;
        this.setState(x => ({ actuals: [...x.actuals, { s, p: p / uP.f }], actStk:'', actP:'' })); },
      devMsg: dev.msg, devFg: dev.fg,

      exportOpen: st.exportOpen,
      openExport: () => this.setState({ exportOpen: true }),
      closeExport: () => this.setState({ exportOpen: false }),
      stopProp: e => e.stopPropagation(),
      exportSub: methodMap[st.method] + ' · ' + SYS[st.sys].label + ' units · ' + num(Math.round(c.total),0) + ' total strokes',
      exportOpts: [
        { k:'pdf', tag:'PDF', label:'Kill sheet PDF', sub:'opens print dialog · save as PDF' },
        { k:'csv', tag:'CSV', label:'Stroke schedule', sub:'21 rows · strokes, MD, TVD, DP, csg' },
        { k:'png', tag:'PNG', label:'Kill plot image', sub:'annotated graph, 2× scale' },
        { k:'shr', tag:'↗', label:'Share', sub:'share sheet · CSV attached' },
      ].map(o => ({ ...o, state: st.exported[o.k] || '', fg: st.exported[o.k] ? GREEN : AMBER,
        tint: st.exported[o.k] ? 'oklch(0.78 0.15 150 / .15)' : 'oklch(0.80 0.15 75 / .13)',
        bc: st.exported[o.k] ? 'oklch(0.78 0.15 150 / .4)' : '#242a2b', onClick: exp(o.k) })),
    };
  }
}
