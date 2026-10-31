import React from 'react';
import { levelById } from './levels.js';
const _cssCache = new Map();

function css(s) {
  if (!s) return undefined;
  if (typeof s === 'object') return s;
  const hit = _cssCache.get(s);
  if (hit) return hit;
  const out = {};
  for (const decl of s.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    let prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) continue;
    if (prop.startsWith('-')) {
      // -webkit-user-select -> WebkitUserSelect  (-ms- -> msFoo, not used here)
      prop = prop.slice(1).replace(/-([a-z])/g, (m, c) => c.toUpperCase());
      prop = prop.charAt(0).toUpperCase() + prop.slice(1);
    } else {
      prop = prop.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
    }
    out[prop] = val;
  }
  _cssCache.set(s, out);
  return out;
}

/* Replaces the original `style-hover` attribute. Used on 5 buttons. */
function Btn({ base, hover, children, ...rest }) {
  const [h, setH] = React.useState(false);
  return (
    <button
      {...rest}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ ...css(base), ...(h ? css(hover) : null) }}
    >
      {children}
    </button>
  );
}

/* The canvas cursor, kept as one string so its quoting can't get mangled. */
const CANVAS_CSS = `width:100%;height:100%;display:block;image-rendering:pixelated;cursor:url('data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2217%22 height=%2217%22><g fill=%22%23000%22><rect x=%220%22 y=%226%22 width=%227%22 height=%225%22/><rect x=%2210%22 y=%226%22 width=%227%22 height=%225%22/><rect x=%226%22 y=%220%22 width=%225%22 height=%227%22/><rect x=%226%22 y=%2210%22 width=%225%22 height=%227%22/></g><g fill=%22%23fff%22><rect x=%221%22 y=%228%22 width=%225%22 height=%221%22/><rect x=%2211%22 y=%228%22 width=%225%22 height=%221%22/><rect x=%228%22 y=%221%22 width=%221%22 height=%225%22/><rect x=%228%22 y=%2211%22 width=%221%22 height=%225%22/></g></svg>') 8 8, crosshair`;
class Signal extends React.Component {
  canvasRef = React.createRef();
  padRef = React.createRef();
  fireBtnRef = React.createRef();
  moveBaseRef = React.createRef();
  moveKnobRef = React.createRef();

  tm() {
    const c = this.props.controls;
    if (c === 'touch') return true;
    if (c === 'desktop') return false;
    return this.state.isTouch;
  }

  state = {
    health: 4, ammo: 40, kills: 0, dead: false, complete: false, muted: false,
    isTouch: (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches),
    radioOn: false, radioText: '',
    hintOn: false, hunted: false, parts: 0, fixText: '', hiddenOn: false, rapidSec: 0, diffHard: false,
    started: false, obStep: 0, obText: '', obSeen: false, landscapeBlock: false, l1Cleared: false, hasSave: false,
    statTime: '0:00', statShots: '0', statAcc: '0%',
    levelId: 1,
  };

  /* Current level's data (src/game/levels.js). */
  get L() { return levelById(this.state ? this.state.levelId : 1); }

  /* Per-level localStorage key, e.g. thesignal_l1_save. */
  skey(suffix) { return 'thesignal_l' + this.L.id + '_' + suffix; }

  componentDidMount() {
    if (this._booted) return;
    this._booted = true;
    this.V = 240; this.W = this.L.W; this.H = this.L.H;
    const cv = this.canvasRef.current;
    this.ctx = cv.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this._rect = cv.getBoundingClientRect();
    this._updRect = () => { if (this.canvasRef.current) this._rect = this.canvasRef.current.getBoundingClientRect(); };
    window.addEventListener('resize', this._updRect);
    window.addEventListener('scroll', this._updRect, true);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    this._stopEdit = (e) => { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); };
    cv.addEventListener('click', this._stopEdit);
    cv.addEventListener('dblclick', this._stopEdit);
    this._stopEditWin = (e) => {
      if (!this.state.started || this.g.over) return;
      if (e.target === this.canvasRef.current) {
        e.preventDefault(); e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    };
    window.addEventListener('dblclick', this._stopEditWin, true);
    window.addEventListener('mouseup', this.onMouseUp);
    this.buildPatterns();
    this.g = {};
    try {
      const sv = JSON.parse(localStorage.getItem(this.skey('save')) || 'null');
      if (sv) {
        this._cp = !!sv.cp;
        this._cpParts = sv.parts || null;
        if (sv.ammo != null) this._deathAmmo = sv.ammo;
      }
    } catch (err) {}
    this.resetRun();
    this.buildStatic();
    this._kd = (e) => {
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space'].indexOf(e.code) >= 0) e.preventDefault();
      this.ensureAudio();
      if (e.code === 'Tab') { e.preventDefault(); if (this.state.started && this.g && !this.g.over) this.g.mapOn = true; return; }
      if (!this.state.started) {
        if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) this.obNext();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) { this.g.keys = {}; return; }
      this.g.keys[e.code] = true;
      this.g.keyT = this.g.keyT || {};
      this.g.keyT[e.code] = performance.now();
      if (!e.repeat) this._klog(e.type, e.code);
      if (e.code === 'Escape' && !e.repeat) { this.exitToMenu(); return; }
      if (e.code === 'KeyM' && !e.repeat) this.toggleMute();
      if (e.code === 'KeyR' && !e.repeat) this.restart();
      if (e.code === 'Space' && !e.repeat) this.g.tapShot = true;
    };
    this._ku = (e) => {
      if (e.code === 'Tab') this.g.mapOn = false;
      this.g.keys[e.code] = false;
      if (e.key === 'Meta' || e.key === 'Control' || e.key === 'Alt') this.g.keys = {};
      this._klog(e.type, e.code);
    };
    this._keyLog = [];
    this._klog = (t, c) => {
      this._keyLog.push(t + ':' + c + '@' + Math.round(performance.now()));
      if (this._keyLog.length > 30) this._keyLog.shift();
    };
    window.__sigInst = this;
    window.__sigDbg = () => ({
      held: Object.keys(this.g.keys).filter((k) => this.g.keys[k]),
      log: this._keyLog.slice(),
      focus: document.hasFocus(),
      trace: (this._dbgLog || []).slice(-60),
    });
    window.addEventListener('keydown', this._kd, true);
    window.addEventListener('keyup', this._ku, true);
    this._onCtx = (e) => { e.preventDefault(); this.g.keys = {}; this.g.fireHeld = false; };
    window.addEventListener('contextmenu', this._onCtx);
    this._raf = requestAnimationFrame(this.frame);
    this._timers = [];
    let seen = false, cleared = false;
    try {
      seen = !!localStorage.getItem('thesignal_l1_onboarded');
      cleared = !!localStorage.getItem(this.skey('cleared'));
      if (localStorage.getItem('thesignal_diff') === 'vet') this.setState({ diffHard: true });
    } catch (err) {}
    if (seen || cleared) this.setState({ obSeen: seen, l1Cleared: cleared });
    if (this._cp || (this._cpParts && this._cpParts.some(Boolean))) {
      this.setState({
        hasSave: !!this._cp,
        ammo: (this._cp && this._deathAmmo != null) ? this._deathAmmo : 40,
        parts: this.g.sparts.filter((s2) => s2.taken).length,
      });
    }
    this._touchDev = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
    this._onRz = () => {
      const mob = this._touchDev || window.innerWidth <= 700;
      if (mob !== this.state.isTouch) this.setState({ isTouch: mob });
      const lb = this.tm() && window.innerWidth > window.innerHeight && window.innerHeight < 520;
      if (lb !== this.state.landscapeBlock) this.setState({ landscapeBlock: lb });
    };
    window.addEventListener('resize', this._onRz);
    window.addEventListener('orientationchange', this._onRz);
    this._onBlur = () => {
      this.g.mapOn = false;
      this.g.keys = {}; this.g.fireHeld = false;
      this.g.moveId = null; this.g.moveVec = { x: 0, y: 0 };
      this.setKnob(0, 0);
    };
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('visibilitychange', this._onBlur);
    this._onRz();
  }

  componentWillUnmount() {
    cancelAnimationFrame(this._raf);
    (this._timers || []).forEach(clearTimeout);
    if (this._radioInt) clearInterval(this._radioInt);
    if (this._obInt) clearInterval(this._obInt);
    window.removeEventListener('resize', this._onRz);
    window.removeEventListener('orientationchange', this._onRz);
    window.removeEventListener('blur', this._onBlur);
    document.removeEventListener('visibilitychange', this._onBlur);
    window.removeEventListener('keydown', this._kd, true);
    window.removeEventListener('keyup', this._ku, true);
    window.removeEventListener('contextmenu', this._onCtx);
    window.removeEventListener('dblclick', this._stopEditWin, true);
    window.removeEventListener('resize', this._updRect);
    window.removeEventListener('scroll', this._updRect, true);
    window.removeEventListener('mouseup', this.onMouseUp);
    if (this.canvasRef.current) {
      window.removeEventListener('mousemove', this.onMouseMove);
      window.removeEventListener('mousedown', this.onMouseDown);
      this.canvasRef.current.removeEventListener('click', this._stopEdit);
      this.canvasRef.current.removeEventListener('dblclick', this._stopEdit);
    }
    if (this._ac) this._ac.close();
  }

  mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  buildPatterns() {
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const mk = (color, level) => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 4;
      const x = c.getContext('2d'); x.fillStyle = color;
      for (let i = 0; i < 16; i++) if (B[i] < level) x.fillRect(i % 4, (i / 4) | 0, 1, 1);
      return this.ctx.createPattern(c, 'repeat');
    };
    this.pat = {
      coneW: mk('#ffffff', 3), coneR: mk('#e1232b', 4),
      patch: mk('#ffffff', 2), wall: mk('#ffffff', 6),
      m1: mk('#ffffff', 2), m2: mk('#ffffff', 4),
      bush: mk('#3fbf4f', 5),
      flash: mk('#e1232b', 6),
      treeG: mk('#3fbf4f', 3), qsY: mk('#e6c229', 3),
    };
  }

  resetRun() {
    const g = this.g, L = this.L;
    const start = this._cp ? L.checkpoint.respawn : L.spawn;
    g.player = { x: start.x, y: start.y, aim: -Math.PI / 2, fireCd: 0, iframes: 0 };
    const copy = (a) => (a || []).map((o) => ({ ...o }));
    g.walls = copy(L.walls);
    g.enemies = (L.enemies || []).map((d, i) => {
      const p1 = { ...d.p1 }, p2 = { ...d.p2 };
      return {
        x: p1.x, y: p1.y, p1, p2, tgt: p2,
        sentry: p1.x === p2.x && p1.y === p2.y,
        sniper: !!d.sn, rusher: !!d.ru, rngCur: d.sn ? 200 : (d.ru ? 90 : 105),
        bN: [2, 3, 5][i % 3], bPause: [0.8, 1.15, 1.6][i % 3],
        face0: d.f0 || 0, ph: i * 1.7,
        face: d.f0 || 0, st: d.h ? 'hide' : 'patrol', hp: d.ru ? 1 : 2, dead: false,
        alertT: 0, fireCd: 0, waitT: 0, searchT: 0, muzzle: 0, lk: null,
      };
    });
    g.trips = (L.trips || []).map((o) => ({ ...o, done: false }));
    g.mines = (L.mines || []).map((m) => ({ x: m.x, y: m.y, done: false }));
    g.meds = (L.meds || []).map((o) => ({ ...o, taken: false }));
    g.ammoB = (L.ammo || []).map((o) => ({ ...o, taken: false }));
    g.lakes = copy(L.lakes);
    g.qs = copy(L.quicksand);
    g.fires = copy(L.fires);
    g.radioTr = (L.radioTriggers || []).map((o) => ({ ...o, done: false }));
    const kept = this._cpParts || null;
    g.sparts = (L.parts || []).map((sp, i) => ({ ...sp, taken: kept ? !!kept[i] : false, prog: 0, alerted: false }));
    g.fix = 0; g.fixing = false; g.towerMsgT = 0; g.fixStage = 0;
    g.bushes = copy(L.bushes);
    g.hidden = false; g.revealT = 0;
    g.bullets = []; g.parts = []; g.keys = {}; g.mouse = null;
    g.fireHeld = false; g.tapShot = false;
    g.streak = 0; g.rapidT = 0;
    g.maxProg = 0;
    g.moveId = null; g.moveVec = { x: 0, y: 0 };
    g.shots = 0; g.hits = 0; g.kills = 0; g.time = 0;
    g.heat = 0; g.lastKnown = null; g.seenNow = false;
    g.flashT = 0; g.shakeT = 0; g.muzzle = 0; g.over = false;
    g.camX = Math.max(0, Math.min(this.W - this.V, start.x - 160)); g.camY = this.H - this.V;
    if (!g.trees || g.treesFor !== L.id) { g.trees = this.makeTrees(); g.treesFor = L.id; g.treeGrid = null; }
  }

  segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((px - x1) * dx + (py - y1) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t));
  }

  inWall(x, y, pad) {
    for (const w of this.g.walls) {
      if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return true;
    }
    return false;
  }

  makeTrees() {
    const g = this.g, L = this.L;
    const rnd = this.mulberry(L.treeSeed);
    const trees = [];
    let guard = 0;
    while (trees.length < L.treeCount && guard++ < 6000) {
      const x = 14 + rnd() * (this.W - 28), y = 60 + rnd() * (this.H - 160);
      const seed = Math.floor(rnd() * 1e6);
      if (Math.hypot(x - L.spawn.x, y - L.spawn.y) < 60) continue;
      if (Math.hypot(x - L.tower.x, y - L.tower.y) < 110) continue;
      if (this.inWall(x, y, 10)) continue;
      let bad = false;
      for (const e of g.enemies) {
        if (this.segDist(x, y, e.p1.x, e.p1.y, e.p2.x, e.p2.y) < 28) { bad = true; break; }
      }
      if (bad) continue;
      for (const tr of g.trips) {
        if (this.segDist(x, y, tr.x1, tr.y1, tr.x2, tr.y2) < 16) { bad = true; break; }
      }
      if (bad) continue;
      for (const m of g.mines) if (Math.hypot(x - m.x, y - m.y) < 16) { bad = true; break; }
      if (bad) continue;
      for (const m of g.meds) if (Math.hypot(x - m.x, y - m.y) < 16) { bad = true; break; }
      if (bad) continue;
      for (const ab of g.ammoB) if (Math.hypot(x - ab.x, y - ab.y) < 16) { bad = true; break; }
      if (bad) continue;
      if (Math.hypot(x - L.checkpoint.x, y - L.checkpoint.y) < 32) continue;
      if (Math.hypot(x - L.tower.x, y - (L.tower.y + 2)) < 46) continue;
      for (const L of g.lakes) if (Math.hypot(x - L.x, y - L.y) < L.r + 14) { bad = true; break; }
      if (bad) continue;
      for (const q of g.qs) if (Math.hypot(x - q.x, y - q.y) < q.r + 10) { bad = true; break; }
      if (bad) continue;
      for (const f of g.fires) if (Math.hypot(x - f.x, y - f.y) < f.r + 12) { bad = true; break; }
      if (bad) continue;
      for (const sp of g.sparts) if (Math.hypot(x - sp.x, y - sp.y) < 26) { bad = true; break; }
      if (bad) continue;
      for (const bu of g.bushes) if (Math.hypot(x - bu.x, y - bu.y) < bu.r + 8) { bad = true; break; }
      if (bad) continue;
      for (const t of trees) if (Math.hypot(x - t.x, y - t.y) < 24) { bad = true; break; }
      if (bad) continue;
      trees.push({ x: Math.round(x), y: Math.round(y), seed });
    }
    return trees;
  }

  buildStatic() {
    if (!this.staticC || this.staticC.width !== this.W || this.staticC.height !== this.H) {
      this.staticC = document.createElement('canvas');
      this.staticC.width = this.W; this.staticC.height = this.H;
    }
    const s = this.staticC.getContext('2d');
    s.fillStyle = '#000000'; s.fillRect(0, 0, this.W, this.H);
    const rnd = this.mulberry(this.L.groundSeed);
    s.fillStyle = '#ffffff';
    for (let i = 0; i < 1900; i++) {
      const x = (rnd() * this.W) | 0, y = (rnd() * this.H) | 0;
      if (rnd() < 0.3) s.fillRect(x, y, 2, 1); else s.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 130; i++) {
      const x = rnd() * this.W, y = rnd() * this.H, r = 4 + rnd() * 6;
      s.save(); s.beginPath(); s.arc(x, y, r, 0, Math.PI * 2); s.clip();
      s.fillStyle = this.pat.patch; s.fillRect(x - r, y - r, r * 2, r * 2); s.restore();
    }
    for (const w of this.g.walls) {
      s.fillStyle = this.pat.wall; s.fillRect(w.x, w.y, w.w, w.h);
      s.fillStyle = '#ffffff';
      for (let x = w.x; x < w.x + w.w; x += 3) { s.fillRect(x, w.y, 2, 1); s.fillRect(x, w.y + w.h - 1, 2, 1); }
      for (let y = w.y; y < w.y + w.h; y += 3) { s.fillRect(w.x, y, 1, 2); s.fillRect(w.x + w.w - 1, y, 1, 2); }
      const wrnd = this.mulberry((w.x * 7 + w.y) | 0);
      const n = Math.max(3, Math.floor((w.w * w.h) / 700));
      for (let i = 0; i < n; i++) {
        const bx = w.x + 4 + wrnd() * (w.w - 8), by = w.y + 4 + wrnd() * (w.h - 8);
        const a = wrnd() * Math.PI * 2;
        this.pxLine(s, bx, by, bx + Math.cos(a) * 5, by + Math.sin(a) * 5, '#ffffff');
      }
    }
    for (const L of this.g.lakes) {
      s.save(); s.beginPath(); s.arc(L.x, L.y, L.r, 0, Math.PI * 2); s.clip();
      s.fillStyle = '#000000'; s.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
      s.fillStyle = this.pat.m2; s.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
      s.fillStyle = '#ffffff';
      for (let yy = Math.round(L.y - L.r) + 6; yy < L.y + L.r; yy += 9) {
        const ph = (yy * 13) % 11;
        for (let xx = Math.round(L.x - L.r) + ph; xx < L.x + L.r; xx += 16) s.fillRect(xx, yy, 5, 1);
      }
      s.restore();
      s.fillStyle = '#ffffff';
      for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.08) {
        if (((a2 * 25) | 0) % 2 === 0) s.fillRect(Math.round(L.x + Math.cos(a2) * L.r), Math.round(L.y + Math.sin(a2) * L.r), 1, 1);
      }
    }
    for (const q of this.g.qs) {
      s.save(); s.beginPath(); s.arc(q.x, q.y, q.r, 0, Math.PI * 2); s.clip();
      s.fillStyle = '#000000'; s.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      s.fillStyle = this.pat.qsY; s.fillRect(q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      s.restore();
      s.fillStyle = '#e6c229';
      for (const rr of [0.4, 0.75]) {
        for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.14) {
          if (((a2 * 14) | 0) % 2 === 0) s.fillRect(Math.round(q.x + Math.cos(a2) * q.r * rr), Math.round(q.y + Math.sin(a2) * q.r * rr), 2, 1);
        }
      }
    }
    for (const f of this.g.fires) {
      this.disc(s, f.x, f.y, f.r * 0.6, '#000000');
      s.fillStyle = '#ffffff';
      for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.5) {
        s.fillRect(Math.round(f.x + Math.cos(a2) * f.r * 0.8), Math.round(f.y + Math.sin(a2) * f.r * 0.8), 1, 1);
      }
    }
    for (const b of this.g.bushes) {
      s.save(); s.beginPath(); s.arc(b.x, b.y, b.r, 0, Math.PI * 2); s.clip();
      s.fillStyle = this.pat.bush; s.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
      s.restore();
      const rnd = this.mulberry((b.x * 17 + b.y) | 0);
      for (let i = 0; i < b.r * 1.6; i++) {
        const a = rnd() * Math.PI * 2, rr = rnd() * (b.r - 3);
        const px = Math.round(b.x + Math.cos(a) * rr), py = Math.round(b.y + Math.sin(a) * rr);
        s.fillStyle = rnd() < 0.35 ? '#ffffff' : '#3fbf4f';
        s.fillRect(px, py, rnd() < 0.5 ? 2 : 1, 1);
      }
      s.fillStyle = '#3fbf4f';
      for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.22) {
        if (((a2 * 9) | 0) % 2 === 0) s.fillRect(Math.round(b.x + Math.cos(a2) * b.r), Math.round(b.y + Math.sin(a2) * b.r), 2, 1);
      }
    }
    for (const t of this.g.trees) this.drawTree(s, t);
  }

  drawTree(s, t) {
    const rnd = this.mulberry(t.seed);
    s.save(); s.beginPath(); s.arc(t.x, t.y, 12, 0, Math.PI * 2); s.clip();
    s.fillStyle = this.pat.treeG; s.fillRect(t.x - 12, t.y - 12, 24, 24); s.restore();
    const n = 5 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, len = 7 + rnd() * 7;
      this.pxLine(s, t.x, t.y, t.x + Math.cos(a) * len, t.y + Math.sin(a) * len, '#ffffff');
      if (rnd() < 0.75) {
        const bx = t.x + Math.cos(a) * len * 0.6, by = t.y + Math.sin(a) * len * 0.6;
        const a2 = a + (rnd() < 0.5 ? 0.85 : -0.85);
        this.pxLine(s, bx, by, bx + Math.cos(a2) * 5, by + Math.sin(a2) * 5, '#3fbf4f');
      }
    }
    s.fillStyle = '#3fbf4f'; s.fillRect(t.x - 2, t.y - 2, 4, 4);
  }

  pxLine(c, x0, y0, x1, y1, color) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    c.fillStyle = color;
    for (let i = 0; i < 200; i++) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(c, cx, cy, r, color) {
    cx = Math.round(cx); cy = Math.round(cy);
    c.fillStyle = color;
    const ri = Math.floor(r);
    for (let dy = -ri; dy <= ri; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      c.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }

  ring(c, cx, cy, r, color) {
    cx = Math.round(cx); cy = Math.round(cy);
    c.fillStyle = color;
    const ri = Math.floor(r), r2 = r - 1.7;
    for (let dy = -ri; dy <= ri; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      const wi = Math.abs(dy) < r2 ? Math.floor(Math.sqrt(r2 * r2 - dy * dy)) : -1;
      if (wi < 0) c.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
      else { c.fillRect(cx - w, cy + dy, w - wi, 1); c.fillRect(cx + wi + 1, cy + dy, w - wi, 1); }
    }
  }

  angDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  turn(cur, target, max) {
    const d = this.angDiff(cur, target);
    if (Math.abs(d) <= max) return target;
    return cur + Math.sign(d) * max;
  }

  treeGrid() {
    const g = this.g;
    if (!g.treeGrid) {
      const m = new Map();
      for (const t of g.trees) {
        const k = (t.x >> 6) + ',' + (t.y >> 6);
        let a = m.get(k);
        if (!a) { a = []; m.set(k, a); }
        a.push(t);
      }
      g.treeGrid = m;
    }
    return g.treeGrid;
  }

  collideTrees(o, r) {
    const min = r + 3.2;
    const grid = this.treeGrid();
    const cx = o.x >> 6, cy = o.y >> 6;
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const arr = grid.get(gx + ',' + gy);
        if (!arr) continue;
        for (const t of arr) {
          const dx = o.x - t.x, dy = o.y - t.y;
          if (dx > min || dx < -min || dy > min || dy < -min) continue;
          const d = Math.hypot(dx, dy);
          if (d < min && d > 0.001) { o.x = t.x + dx / d * min; o.y = t.y + dy / d * min; }
        }
      }
    }
  }

  collideLakes(o, r) {
    for (const L of this.g.lakes) {
      const dx = o.x - L.x, dy = o.y - L.y, min = L.r + r;
      if (dx > min || dx < -min || dy > min || dy < -min) continue;
      const d = Math.hypot(dx, dy);
      if (d < min && d > 0.001) { o.x = L.x + dx / d * min; o.y = L.y + dy / d * min; }
    }
  }

  collideWalls(o, r) {
    for (const w of this.g.walls) {
      const nx = Math.max(w.x, Math.min(o.x, w.x + w.w));
      const ny = Math.max(w.y, Math.min(o.y, w.y + w.h));
      const dx = o.x - nx, dy = o.y - ny;
      const d = Math.hypot(dx, dy);
      if (d < r && d > 0.001) { o.x = nx + dx / d * r; o.y = ny + dy / d * r; }
      else if (d <= 0.001) {
        const outL = o.x - w.x, outR = w.x + w.w - o.x, outT = o.y - w.y, outB = w.y + w.h - o.y;
        const m2 = Math.min(outL, outR, outT, outB);
        if (m2 === outT) o.y = w.y - r;
        else if (m2 === outB) o.y = w.y + w.h + r;
        else if (m2 === outL) o.x = w.x - r;
        else o.x = w.x + w.w + r;
      }
    }
  }

  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 6);
    const grid = this.treeGrid();
    for (let i = 1; i < n; i++) {
      const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
      if (this.inWall(x, y, 1)) return false;
      const cx = x >> 6, cy = y >> 6;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const arr = grid.get(gx + ',' + gy);
          if (!arr) continue;
          for (const t of arr) {
            const b = y - t.y;
            if (b > 4 || b < -4) continue;
            const a = x - t.x;
            if (a * a + b * b < 16) return false;
          }
        }
      }
    }
    return true;
  }

  frame = (ts) => {
    this._raf = requestAnimationFrame(this.frame);
    if (this._last === undefined) this._last = ts;
    const dt = Math.min(0.1, (ts - this._last) / 1000);
    this._last = ts;
    this._acc = (this._acc || 0) + dt;
    const step = 1 / 60;
    let n = 0;
    while (this._acc >= step && n++ < 3) { this.update(step); this._acc -= step; }
    if (this._acc > step) this._acc = 0;
    if (this.state.started || !this._drewOnce) { this.draw(ts / 1000); this._drewOnce = true; }
  };

  update(dt) {
    const g = this.g, p = g.player, L = this.L;
    p.fireCd -= dt; p.iframes -= dt; g.flashT -= dt; g.shakeT -= dt; g.muzzle -= dt;
    g.heat = Math.max(0, (g.heat || 0) - dt);
    for (let i = g.parts.length - 1; i >= 0; i--) {
      const pt = g.parts[i];
      pt.t -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      if (pt.t <= 0) g.parts.splice(i, 1);
    }
    for (const e of g.enemies) e.muzzle -= dt;
    if (g.over || !this.state.started) return;

    if (!document.hasFocus()) {
      g.keys = {}; g.fireHeld = false; g.tapShot = false;
      g.moveId = null; g.moveVec = { x: 0, y: 0 };
      this.setKnob(0, 0);
      if (!this.state.focusPause) this.setState({ focusPause: true });
      return;
    }
    if (this.state.focusPause) this.setState({ focusPause: false });
    g.time += dt;
    if (g.keyT) {
      const nowT = performance.now();
      for (const k in g.keys) {
        if (g.keys[k] && g.keyT[k] && nowT - g.keyT[k] > 1500) { g.keys[k] = false; this._klog('watchdog-release', k); }
      }
    }
    let mx = 0, my = 0, stickOn = false;
    if (this.tm()) {
      mx = g.moveVec.x; my = g.moveVec.y;
      if (Math.hypot(mx, my) < 0.22) { mx = 0; my = 0; }
      else { stickOn = true; p.aim = Math.atan2(my, mx); }
    }
    if (!stickOn) {
      mx = (g.keys.KeyD ? 1 : 0) - (g.keys.KeyA ? 1 : 0);
      my = (g.keys.KeyS ? 1 : 0) - (g.keys.KeyW ? 1 : 0);
      const m = Math.hypot(mx, my);
      if (m > 0) { mx /= m; my /= m; }
    }
    this._dbgT = (this._dbgT || 0) + dt;
    if (this._dbgT > 0.25) {
      this._dbgT = 0;
      this._dbgLog = this._dbgLog || [];
      this._dbgLog.push({
        t: Math.round(g.time * 10) / 10, x: Math.round(p.x), y: Math.round(p.y),
        mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100,
        held: Object.keys(g.keys).filter((k) => g.keys[k]).join('+'),
        mv: Math.round(g.moveVec.x * 100) / 100 + ',' + Math.round(g.moveVec.y * 100) / 100,
        tm: this.tm(), foc: document.hasFocus(),
      });
      if (this._dbgLog.length > 120) this._dbgLog.shift();
    }
    let spd = 100;
    for (const q of g.qs) { if (Math.hypot(p.x - q.x, p.y - q.y) < q.r) { spd = 45; break; } }
    p.x += mx * spd * dt; p.y += my * spd * dt;
    this.collideTrees(p, 4.5);
    this.collideWalls(p, 5.5);
    this.collideLakes(p, 3);
    p.x = Math.max(8, Math.min(this.W - 8, p.x));
    p.y = Math.max(40, Math.min(this.H - 40, p.y));
    const prog = Math.max(0, Math.min(1, (L.spawn.y - p.y) / (L.spawn.y - (L.tower.y + 20))));
    if (prog > (g.maxProg || 0)) g.maxProg = prog;
    g.alertK = Math.max(0, (g.maxProg - 0.2) / 0.8);
    const moving = (mx !== 0 || my !== 0);
    if (moving) {
      g.stepT = (g.stepT || 0) - dt;
      if (g.stepT <= 0) { g.stepT = 0.31 + Math.random() * 0.05; this.sfx('step'); }
    } else g.stepT = 0.12;
    let inBush = false;
    for (const bu of g.bushes) {
      const bdx = p.x - bu.x, bdy = p.y - bu.y, br = bu.r - 2;
      if (bdx * bdx + bdy * bdy < br * br) { inBush = true; break; }
    }
    g.revealT = Math.max(0, (g.revealT || 0) - dt);
    g.hidden = inBush && g.revealT <= 0;
    if (g.hidden && g.heat > 0) g.heat = Math.max(0, g.heat - dt * 2);
    if (g.hidden !== this.state.hiddenOn) this.setState({ hiddenOn: g.hidden });
    g.camX = Math.max(0, Math.min(this.W - this.V, p.x - this.V / 2));
    g.camY = Math.max(0, Math.min(this.H - this.V, p.y - this.V * 0.62));

    if (!this._touchDev && !stickOn && g.mouse && this._rect) {
      const r = this._rect;
      const sc = this.V / r.width;
      const wx = (g.mouse.x - r.left) * sc + g.camX, wy = (g.mouse.y - r.top) * sc + g.camY;
      p.aim = Math.atan2(wy - p.y, wx - p.x);
    }
    const assist = (this.props.aimAssist ?? 0.35) * (this.tm() ? 1.5 : 0.35);
    if (assist > 0) {
      let best = null, bd = 1e9;
      for (const e of g.enemies) {
        if (e.dead || e.st === 'hide') continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > 215) continue;
        const ad = this.angDiff(p.aim, Math.atan2(e.y - p.y, e.x - p.x));
        if (Math.abs(ad) < 0.42 && d < bd) { bd = d; best = ad; }
      }
      if (best !== null) p.aim += best * assist * (1 - bd / 240);
    }

    if ((g.fireHeld || g.tapShot) && p.fireCd <= 0 && this.state.ammo <= 0) {
      p.fireCd = 0.32; this.sfx('dry');
    } else if ((g.fireHeld || g.tapShot) && p.fireCd <= 0) {
      p.fireCd = 0.22; g.shots++; g.muzzle = 0.07;
      this.setState({ ammo: this.state.ammo - 1 });
      const angs = g.rapidT > 0 ? [-0.17, 0, 0.17] : [0];
      for (const off of angs) {
        const aa = p.aim + off;
        g.bullets.push({ x: p.x + Math.cos(aa) * 11, y: p.y + Math.sin(aa) * 11, vx: Math.cos(aa) * 270, vy: Math.sin(aa) * 270, t: 0.9, from: 'p' });
      }
      this.sfx('shot');
      g.revealT = 1.3; g.hidden = false;
      let heard = false;
      for (const e of g.enemies) {
        if (e.dead || e.st === 'hide') continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < 200) { heard = true; break; }
      }
      if (heard) {
        if (g.heat <= 0) this.sfx('alarm');
        g.heat = 20; g.lastKnown = { x: p.x, y: p.y }; g.lastVel = { x: mx, y: my };
      }
    }
    g.tapShot = false;

    if (g.rapidT > 0) {
      g.rapidT = Math.max(0, g.rapidT - dt);
      const sec = Math.ceil(g.rapidT);
      if (sec !== this.state.rapidSec) this.setState({ rapidSec: sec });
    }

    for (const tr of g.trips) {
      if (tr.done) continue;
      if (this.segDist(p.x, p.y, tr.x1, tr.y1, tr.x2, tr.y2) < 4) { tr.done = true; this.explode(p.x, p.y); }
    }
    for (const mn of g.mines) {
      if (mn.done) continue;
      if (Math.hypot(p.x - mn.x, p.y - mn.y) < 9) { mn.done = true; this.explode(mn.x, mn.y); }
    }
    for (const f of g.fires) {
      if (Math.hypot(p.x - f.x, p.y - f.y) < f.r - 2 && p.iframes <= 0) this.damage();
    }
    for (const mk of g.meds) {
      if (mk.taken) continue;
      if (Math.hypot(p.x - mk.x, p.y - mk.y) < 13 && this.state.health < 4) {
        mk.taken = true; this.sfx('pick');
        this.setState({ health: this.state.health + 1 });
      }
    }
    for (const ab of g.ammoB) {
      if (ab.taken) continue;
      if (Math.hypot(p.x - ab.x, p.y - ab.y) < 13 && this.state.ammo < 40) {
        ab.taken = true; this.sfx('pick');
        this.setState({ ammo: Math.min(40, this.state.ammo + ab.amt) });
      }
    }
    for (const rt of g.radioTr) {
      if (rt.done) continue;
      if (p.x > rt.x && p.x < rt.x + rt.w && p.y > rt.y && p.y < rt.y + rt.h) { rt.done = true; this.startRadio(rt.line); }
    }
    if (!this._cp && p.y < L.checkpoint.triggerY) {
      this._cp = true;
      this._cpParts = g.sparts.map((s2) => s2.taken);
      this.saveRun();
      this.setState({ hasSave: true });
      this.sfx('win');
      this.startRadio(L.radio.checkpoint);
    }

    const hitR = this.tm() ? 10 : 8;
    for (let i = g.bullets.length - 1; i >= 0; i--) {
      const b = g.bullets[i];
      b.t -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      let gone = b.t <= 0 || b.x < 0 || b.x > this.W || b.y < 0 || b.y > this.H;
      if (!gone && this.inWall(b.x, b.y, 0)) { this.burst(b.x, b.y, 2, '#ffffff', 40); gone = true; }
      if (!gone) {
        const bgrid = this.treeGrid(), bcx = b.x >> 6, bcy = b.y >> 6;
        outer: for (let gx = bcx - 1; gx <= bcx + 1; gx++) for (let gy = bcy - 1; gy <= bcy + 1; gy++) {
          const arr = bgrid.get(gx + ',' + gy);
          if (!arr) continue;
          for (const t of arr) if (Math.hypot(b.x - t.x, b.y - t.y) < 3) { this.burst(b.x, b.y, 2, '#ffffff', 40); gone = true; break outer; }
        }
      }
      if (!gone && b.from === 'p') {
        for (const e of g.enemies) {
          if (e.dead) continue;
          if (Math.hypot(b.x - e.x, b.y - e.y) < hitR) {
            e.hp--; g.hits++;
            this.burst(e.x, e.y, 6, '#e1232b', 70);
            if (e.hp <= 0) this.kill(e);
            else { e.st = 'shoot'; e.face = Math.atan2(p.y - e.y, p.x - e.x); e.fireCd = 0.45; this.sfx('hitE'); }
            gone = true; break;
          }
        }
      }
      if (!gone && b.from === 'e' && p.iframes <= 0 && Math.hypot(b.x - p.x, b.y - p.y) < 5.5) {
        this.damage(); gone = true;
      }
      if (gone) g.bullets.splice(i, 1);
    }

    g.seenNow = false;
    for (const e of g.enemies) {
      if (e.dead) continue;
      e.fireCd -= dt;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      const alertedNow = e.st === 'alert' || e.st === 'shoot' || (e.st === 'search' && g.heat > 0);
      const ez = g.alertK || 0;
      const zk = 1 + ez * (this.state.diffHard ? 0.45 : 0.3);
      const rBase = (e.sniper ? 200 : (e.rusher ? 90 : 105)) * zk;
      const rGrow = (e.sniper ? 265 : (e.rusher ? 140 : 160)) * zk;
      if (!e.rngCur) e.rngCur = rBase;
      e.rngCur += ((alertedNow ? rGrow : rBase) - e.rngCur) * Math.min(1, dt * 3);
      const rng = e.rngCur, half = (e.sniper ? 0.2 : 0.62) * (1 + ez * 0.18);
      e.halfCur = half; e.ez = ez;
      const canSee = g.hidden ? (d < 26) : ((d < 44 || (d < rng && Math.abs(this.angDiff(e.face, ang)) < half)) && this.los(e.x, e.y, p.x, p.y));
      if (e.st === 'hide') {
        if (d < 34) {
          e.st = 'alert'; e.alertT = 0.4; e.face = ang;
          this.burst(e.x, e.y, 8, '#ffffff', 70);
          this.sfx('spot');
        }
      } else if (e.st === 'patrol') {
        if (e.sentry) {
          const bx = e.p1.x - e.x, by = e.p1.y - e.y, bdd = Math.hypot(bx, by);
          if (bdd > 3) {
            e.x += bx / bdd * 24 * dt; e.y += by / bdd * 24 * dt;
            e.face = Math.atan2(by, bx);
          } else {
            e.scanT = (e.scanT || 0) - dt;
            if (e.scanT <= 0) {
              e.scanTgt = e.face0 + (Math.random() * 2 - 1) * (e.sniper ? 0.5 : 1.0);
              e.scanT = 1.2 + Math.random() * 1.8;
            }
            e.face = this.turn(e.face, e.scanTgt ?? e.face0, 2.2 * dt);
          }
        } else if (e.waitT > 0) {
          e.waitT -= dt;
          e.face = this.turn(e.face, Math.atan2(e.tgt.y - e.y, e.tgt.x - e.x), 4 * dt);
        } else {
          const tx = e.tgt.x - e.x, ty = e.tgt.y - e.y, td = Math.hypot(tx, ty);
          if (td < 3) { e.tgt = (e.tgt === e.p1) ? e.p2 : e.p1; e.waitT = 0.9; }
          else {
            e.x += tx / td * 34 * dt; e.y += ty / td * 34 * dt;
            e.face = this.turn(e.face, Math.atan2(ty, tx), 4 * dt);
          }
        }
        if (canSee) { e.st = 'alert'; e.alertT = (e.rusher ? 0.2 : 0.4) * (1 - (e.ez || 0) * 0.5); e.face = ang; this.sfx('spot'); }
        else if (moving && d < 62 + (e.ez || 0) * 26) { e.st = 'search'; e.lk = { x: p.x, y: p.y }; e.searchT = 3; }
      } else if (e.st === 'alert') {
        e.face = this.turn(e.face, ang, 9 * dt);
        if (!canSee) { e.st = 'search'; e.lk = { x: p.x, y: p.y }; e.searchT = 6; }
        else {
          e.alertT -= dt;
          if (e.alertT <= 0) { e.st = 'shoot'; e.fireCd = 0.2; }
        }
      } else if (e.st === 'shoot') {
        e.face = this.turn(e.face, ang, 7 * dt);
        if (!canSee) { e.st = 'search'; e.lk = { x: p.x, y: p.y }; e.searchT = 6; }
        else if (e.rusher) {
          if (d > 8.5) {
            e.x += Math.cos(ang) * 112 * dt; e.y += Math.sin(ang) * 112 * dt;
            this.collideTrees(e, 4.5); this.collideWalls(e, 5.5); this.collideLakes(e, 3);
          }
          if (d < 9 && e.fireCd <= 0) {
            e.fireCd = 0.8;
            if (p.iframes <= 0) this.damage();
          }
        }
        else {
          if (!e.sniper && d > 58) {
            e.x += Math.cos(ang) * 74 * dt; e.y += Math.sin(ang) * 74 * dt;
            this.collideTrees(e, 4.5); this.collideWalls(e, 5.5); this.collideLakes(e, 3);
          }
          if (e.fireCd <= 0 && Math.abs(this.angDiff(e.face, ang)) < 0.3) {
            if (!e.sniper) {
              if (!e.burstLeft) e.burstLeft = e.bN || 3;
              e.burstLeft--;
              e.fireCd = (e.burstLeft > 0 ? 0.09 : (e.bPause || 1.15)) * (this.state.diffHard ? 0.72 : 1);
            } else e.fireCd = this.state.diffHard ? 1.15 : 1.6;
            e.muzzle = 0.07;
            const sa = e.face + (Math.random() - 0.5) * (e.sniper ? 0.07 : 0.15);
            const bv = (e.sniper ? 240 : 200) * (this.state.diffHard ? 1.12 : 1);
            g.bullets.push({ x: e.x + Math.cos(sa) * 11, y: e.y + Math.sin(sa) * 11, vx: Math.cos(sa) * bv, vy: Math.sin(sa) * bv, t: 1.5, from: 'e' });
            this.sfx('eshot');
          }
        }
      } else if (e.st === 'search') {
        if (canSee) { e.st = 'alert'; e.alertT = (e.rusher ? 0.15 : 0.3) * (1 - (e.ez || 0) * 0.5); }
        else {
          const sx = e.lk.x - e.x, sy = e.lk.y - e.y, sd = Math.hypot(sx, sy);
          if (sd > 5) {
            const ssp = e.rusher ? 92 : 68;
            e.x += sx / sd * ssp * dt; e.y += sy / sd * ssp * dt;
            e.face = this.turn(e.face, Math.atan2(sy, sx), 6 * dt);
            this.collideTrees(e, 4.5);
            this.collideWalls(e, 5.5);
            this.collideLakes(e, 3);
          } else if (g.heat > 0) {
            const lk0 = g.lastKnown || { x: e.x, y: e.y };
            const lv = g.lastVel || { x: 0, y: 0 };
            let bx, by;
            if (lv.x || lv.y) {
              const lead = 40 + Math.random() * 130;
              const spread = (Math.random() - 0.5) * 150;
              bx = lk0.x + lv.x * lead - lv.y * spread;
              by = lk0.y + lv.y * lead + lv.x * spread;
            } else {
              const ra = Math.random() * Math.PI * 2, rr = 26 + Math.random() * 90;
              bx = lk0.x + Math.cos(ra) * rr; by = lk0.y + Math.sin(ra) * rr;
            }
            const sgrid = this.treeGrid(), scx = bx >> 6, scy = by >> 6;
            let bestT = null, btd = 1e9;
            for (let gx = scx - 1; gx <= scx + 1; gx++) for (let gy = scy - 1; gy <= scy + 1; gy++) {
              const arr = sgrid.get(gx + ',' + gy);
              if (!arr) continue;
              for (const t of arr) { const td2 = Math.hypot(t.x - bx, t.y - by); if (td2 < btd) { btd = td2; bestT = t; } }
            }
            if (bestT && btd < 70) {
              const oa = Math.atan2(bestT.y - e.y, bestT.x - e.x);
              bx = bestT.x + Math.cos(oa) * 14; by = bestT.y + Math.sin(oa) * 14;
            }
            e.lk = { x: Math.max(10, Math.min(this.W - 10, bx)), y: Math.max(40, Math.min(this.H - 40, by)) };
          }
          e.searchT -= dt;
          if (g.heat <= 0 && (sd <= 5 || e.searchT <= 0)) { e.st = 'patrol'; e.waitT = 0.6; }
        }
      }
      if (canSee && (e.st === 'alert' || e.st === 'shoot')) {
        if (g.heat <= 0) this.sfx('alarm');
        g.heat = 20; g.lastKnown = { x: p.x, y: p.y }; g.lastVel = { x: mx, y: my }; g.seenNow = true;
      }
      if (e.st !== 'hide' && d < 10 && d > 0.01) {
        e.x = p.x - dx / d * 10; e.y = p.y - dy / d * 10;
        this.collideTrees(e, 4.5); this.collideWalls(e, 5.5); this.collideLakes(e, 3);
      }
    }

    if (g.heat > 0 && g.lastKnown) {
      if (!g.seenNow && g.lastVel && (g.lastVel.x || g.lastVel.y)) {
        g.lastKnown.x = Math.max(10, Math.min(this.W - 10, g.lastKnown.x + g.lastVel.x * 12 * dt));
        g.lastKnown.y = Math.max(40, Math.min(this.H - 40, g.lastKnown.y + g.lastVel.y * 12 * dt));
      }
      let resp = 0;
      const cand = [];
      for (const e of g.enemies) {
        if (e.dead || e.st === 'hide') continue;
        if (e.st === 'alert' || e.st === 'shoot' || e.st === 'search') resp++;
        if (e.st === 'patrol') {
          const dLK = Math.hypot(e.x - g.lastKnown.x, e.y - g.lastKnown.y);
          if (dLK < 240) cand.push([dLK, e]);
        } else if (e.st === 'search') {
          if (g.seenNow) e.lk = { x: g.lastKnown.x, y: g.lastKnown.y };
          e.searchT = Math.max(e.searchT, 2);
        }
      }
      cand.sort((a, b) => a[0] - b[0]);
      for (const c2 of cand) {
        if (resp >= 4) break;
        const e = c2[1];
        e.st = 'search'; e.lk = { x: g.lastKnown.x, y: g.lastKnown.y }; e.searchT = 6; resp++;
      }
      if (!g.hidden) g.huntT = (g.huntT || 0) + dt;
      const hi = this.state.diffHard ? 6 : 8;
      if (g.huntT >= hi) { g.huntT -= hi; this.spawnHunters(); }
    } else { g.huntT = 0; }
    if ((g.heat > 0) !== this.state.hunted) this.setState({ hunted: g.heat > 0 });

    let salv = null;
    for (const sp of g.sparts) {
      if (sp.taken) continue;
      const d = Math.hypot(p.x - sp.x, p.y - sp.y);
      if (d < 22) {
        salv = sp;
        const q0 = Math.floor(sp.prog * 4);
        sp.prog = Math.min(1, sp.prog + dt / sp.dur);
        if (Math.floor(sp.prog * 4) > q0 && sp.prog < 1) this.sfx('tick');
        if (!sp.alerted && sp.prog > 0.15) {
          sp.alerted = true;
          if (g.heat <= 0) this.sfx('alarm');
          g.heat = 16; g.lastKnown = { x: sp.x, y: sp.y }; g.lastVel = { x: 0, y: 0 };
        }
        if (sp.prog >= 1) {
          sp.taken = true;
          const nc = g.sparts.filter((s2) => s2.taken).length;
          this._cpParts = g.sparts.map((s3) => s3.taken);
          this.saveRun();
          this.setState({ parts: nc });
          this.sfx('win');
          this.burst(sp.x, sp.y, 10, '#ffffff', 80);
          this.startRadio(nc >= g.sparts.length ? L.radio.allParts : sp.line);
        }
      } else if (sp.prog > 0) {
        sp.prog = Math.max(0, sp.prog - dt * 0.5);
      }
    }
    if (salv && salv.alerted) g.heat = Math.max(g.heat, 5);

    const tx = L.tower.x, ty = L.tower.y;
    const dTower = Math.hypot(p.x - tx, p.y - ty);
    const partsN = g.sparts.filter((s2) => s2.taken).length;
    const partsAll = g.sparts.length;
    g.towerMsgT = (g.towerMsgT || 0) - dt;
    if (dTower < 30 && partsN < partsAll) {
      if (g.towerMsgT <= 0) {
        g.towerMsgT = 9;
        const miss = partsAll - partsN;
        this.startRadio('tower is dead. ' + miss + ' component' + (miss > 1 ? 's' : '') + ' missing. ' + g.sparts.map((s3) => s3.name.toLowerCase()).join('. ') + '.');
      }
      g.fixing = false;
    } else if (dTower < 30 && partsN >= partsAll) {
      if (!g.fixing) { g.fixing = true; this.sfx('static'); this.startRadio(L.radio.fixing); }
      const q0 = Math.floor(g.fix * 6);
      g.fix = Math.min(1, (g.fix || 0) + dt / 7);
      if (Math.floor(g.fix * 6) > q0 && g.fix < 1) this.sfx('tick');
      const stN = Math.floor(g.fix * 3);
      if (stN > (g.fixStage || 0) && g.fix < 1) {
        g.fixStage = stN;
        this.sfx('pick');
        this.burst(tx, ty - 2, 9, '#ffffff', 70);
      }
      if (g.heat <= 0) this.sfx('alarm');
      g.heat = 20; g.lastKnown = { x: tx, y: ty + 16 }; g.lastVel = { x: 0, y: 0 };
      if (g.fix >= 1) this.finish();
    } else {
      g.fixing = false;
      g.fix = Math.max(0, (g.fix || 0) - dt * 0.4);
      g.fixStage = Math.min(g.fixStage || 0, Math.floor(g.fix * 3));
    }

    const pillT = salv ? ('SALVAGING ' + salv.name + ' — HOLD POSITION') : (g.fixing ? 'REPAIRING — HOLD THEM OFF' : '');
    if (pillT !== this.state.fixText) this.setState({ fixText: pillT });
  }

  spawnHunters() {
    const g = this.g, p = g.player;
    const n = 1 + (Math.random() < 0.4 ? 1 : 0);
    let spawned = 0;
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, ok = false;
      for (let tr = 0; tr < 20 && !ok; tr++) {
        const a = Math.random() * Math.PI * 2;
        x = Math.max(14, Math.min(this.W - 14, p.x + Math.cos(a) * 300));
        y = Math.max(50, Math.min(this.H - 50, p.y + Math.sin(a) * 300));
        ok = !this.inWall(x, y, 8) && Math.hypot(x - p.x, y - p.y) > 190;
      }
      if (!ok) continue;
      spawned++;
      g.enemies.push({
        x, y, p1: { x, y }, p2: { x, y }, tgt: { x, y },
        sentry: true, sniper: false, rusher: true,
        face0: 0, ph: Math.random() * 6,
        face: Math.atan2(p.y - y, p.x - x),
        st: 'search', hp: 1, dead: false,
        alertT: 0, fireCd: 0, waitT: 0, searchT: 20, muzzle: 0,
        lk: { x: g.lastKnown ? g.lastKnown.x : p.x, y: g.lastKnown ? g.lastKnown.y : p.y },
        rngCur: 90,
      });
      this.burst(x, y, 6, '#e1232b', 60);
    }
    if (spawned > 0) {
      this.sfx('alarm');
      this.startRadio('movement on the ridge. more of them coming.');
    }
  }

  explode(x, y) {
    const g = this.g;
    this.burst(x, y, 16, '#e1232b', 120);
    this.burst(x, y, 10, '#ffffff', 90);
    g.shakeT = 0.35;
    this.sfx('boom');
    const s = this.staticC.getContext('2d');
    this.disc(s, x, y, 7, '#000000');
    const rnd = this.mulberry((x * 13 + y) | 0);
    s.fillStyle = '#ffffff';
    for (let i = 0; i < 10; i++) {
      const a = rnd() * Math.PI * 2;
      s.fillRect(Math.round(x + Math.cos(a) * (7 + rnd() * 3)), Math.round(y + Math.sin(a) * (7 + rnd() * 3)), 1, 1);
    }
    s.fillStyle = '#e1232b';
    for (let i = 0; i < 6; i++) {
      s.fillRect(Math.round(x + (rnd() - 0.5) * 10), Math.round(y + (rnd() - 0.5) * 10), 1, 1);
    }
    if (Math.hypot(g.player.x - x, g.player.y - y) < 16 && g.player.iframes <= 0) this.damage();
    let heard = false;
    for (const e of g.enemies) {
      if (e.dead) continue;
      const de = Math.hypot(e.x - x, e.y - y);
      if (e.st === 'hide') {
        if (de < 60) { e.st = 'alert'; e.alertT = 0.4; this.burst(e.x, e.y, 8, '#ffffff', 70); }
        continue;
      }
      if (de < 260) heard = true;
    }
    if (heard) {
      if (g.heat <= 0) this.sfx('alarm');
      g.heat = Math.max(g.heat, 8); g.lastKnown = { x, y }; g.lastVel = { x: 0, y: 0 };
    }
  }

  burst(x, y, n, color, sp) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random());
      this.g.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.18 + Math.random() * 0.15, c: color });
    }
  }

  kill(e) {
    e.dead = true; this.g.kills++;
    if (Math.random() < (this.state.diffHard ? 0.12 : 0.22)) this.g.ammoB.push({ x: e.x, y: e.y, amt: 3, taken: false });
    this.g.streak = (this.g.streak || 0) + 1;
    if (this.g.streak >= 3) {
      this.g.streak = 0;
      this.g.rapidT = 5;
      this.sfx('win');
      this.setState({ kills: this.g.kills, rapidSec: 5 });
    } else this.setState({ kills: this.g.kills });
    this.sfx('kill');
    this.burst(e.x, e.y, 10, '#e1232b', 90);
    const s = this.staticC.getContext('2d');
    const a = Math.random() * Math.PI * 2;
    this.disc(s, e.x, e.y, 4, '#e1232b');
    this.disc(s, e.x + Math.cos(a) * 6, e.y + Math.sin(a) * 6, 3, '#e1232b');
    s.fillStyle = '#ffffff';
    const rnd = this.mulberry((e.x * 31 + e.y) | 0);
    for (let i = 0; i < 13; i++) {
      s.fillRect(Math.round(e.x + (rnd() - 0.5) * 18), Math.round(e.y + (rnd() - 0.5) * 18), 1, 1);
    }
    const p2 = this.g.player;
    for (const o of this.g.enemies) {
      if (o === e || o.dead || o.st === 'hide') continue;
      if (Math.hypot(o.x - e.x, o.y - e.y) < 240) {
        o.face = Math.atan2(p2.y - o.y, p2.x - o.x);
        o.lk = { x: p2.x, y: p2.y };
        if (o.st === 'patrol' || o.st === 'search') { o.st = 'alert'; o.alertT = 0.35; o.searchT = 5; }
      }
    }
  }

  damage() {
    const g = this.g, p = g.player;
    p.iframes = 1.2; g.flashT = 0.12; g.shakeT = 0.2;
    this.sfx('hurt');
    this.burst(p.x, p.y, 5, '#e1232b', 60);
    const h = this.state.health - 1;
    this.setState({ health: h });
    if (h <= 0) {
      this._deathAmmo = this.state.ammo;
      g.over = true; this.sfx('die');
      this._timers.push(setTimeout(() => this.setState({ dead: true }), 500));
    }
  }

  finish() {
    const g = this.g;
    g.over = true;
    this.sfx('win'); this.sfx('static');
    const m = Math.floor(g.time / 60), s2 = ('0' + Math.floor(g.time % 60)).slice(-2);
    const acc = g.shots ? Math.round(100 * g.hits / g.shots) : 0;
    try {
      localStorage.setItem(this.skey('cleared'), '1');
      localStorage.removeItem(this.skey('save'));
    } catch (err) {}
    this.setState({ complete: true, l1Cleared: true, hasSave: false, statTime: m + ':' + s2, statShots: '' + g.shots, statAcc: acc + '%' });
  }

  draw(t) {
    const ctx = this.ctx, g = this.g, p = g.player, V = this.V;
    let ox = 0, oy = 0;
    if (g.shakeT > 0 && (this.props.screenShake ?? true)) {
      ox = (Math.random() * 5 - 2.5) | 0; oy = (Math.random() * 5 - 2.5) | 0;
    }
    const sx = Math.max(0, Math.min(this.W - V, g.camX + ox));
    const sy = Math.max(0, Math.min(this.H - V, g.camY + oy));
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, V, V);
    ctx.drawImage(this.staticC, sx, sy, V, V, 0, 0, V, V);
    ctx.save(); ctx.translate(-sx, -sy);

    const tx = this.L.tower.x, ty = this.L.tower.y;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx - 1, ty - 18, 3, 26);
    ctx.fillRect(tx - 5, ty - 10, 11, 1);
    ctx.fillRect(tx - 4, ty - 2, 9, 1);
    ctx.fillRect(tx - 3, ty + 6, 7, 1);
    const fixed = g.fix >= 1;
    const fx3 = g.fix * 3;
    if (fx3 >= 1) {
      ctx.fillRect(tx - 1, ty - 30, 3, 12);
      ctx.fillRect(tx - 4, ty - 24, 9, 1);
    }
    if (fx3 >= 2) {
      ctx.fillRect(tx + 5, ty - 1, 7, 9);
      ctx.fillStyle = '#000000'; ctx.fillRect(tx + 6, ty, 5, 7);
      ctx.fillStyle = '#e1232b'; ctx.fillRect(tx + 7, ty + 2, 3, 2);
      ctx.fillStyle = '#ffffff';
    }
    if (fixed) {
      this.ring(ctx, tx - 8, ty + 4, 3.5, '#ffffff');
      ctx.fillStyle = '#e1232b'; ctx.fillRect(tx - 3, ty - 37, 7, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(tx, ty - 34, 1, 1);
    } else if (t % 3.9 < 0.14) {
      ctx.fillStyle = '#e1232b'; ctx.fillRect(tx - 1, ty - 24, 3, 3);
    }

    const cpx = this.L.checkpoint.x, cpy = this.L.checkpoint.y;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cpx + 1, cpy + 4, 2, 8);
    ctx.fillRect(cpx - 2, cpy + 12, 8, 1);
    if (this._cp) { ctx.fillStyle = '#3fbf4f'; ctx.fillRect(cpx, cpy, 4, 4); }
    else if (t % 0.8 < 0.4) { ctx.fillStyle = '#e1232b'; ctx.fillRect(cpx, cpy, 4, 4); }

    if (g.fix > 0 && !g.over) {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(tx - 20, ty + 16, 40, 6);
      ctx.fillStyle = '#000000'; ctx.fillRect(tx - 19, ty + 17, 38, 4);
      ctx.fillStyle = '#e1232b'; ctx.fillRect(tx - 19, ty + 17, Math.round(38 * g.fix), 4);
    }

    for (const sp of g.sparts) {
      if (sp.taken) continue;
      if (!(sp.x > sx - 40 && sp.x < sx + this.V + 40 && sp.y > sy - 40 && sp.y < sy + this.V + 40)) continue;
      const x = Math.round(sp.x), y = Math.round(sp.y);
      ctx.fillStyle = '#ffffff';
      for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.24) {
        if (((a2 * 12 + t * 5) | 0) % 2 === 0) ctx.fillRect(Math.round(sp.x + Math.cos(a2) * 12), Math.round(sp.y + Math.sin(a2) * 12), 1, 1);
      }
      const blip = t % 1 < 0.5;
      if (sp.name === 'MAST') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 3, y + 4, 7, 2);
        ctx.fillRect(x, y - 7, 1, 11);
        ctx.fillRect(x - 3, y - 5, 7, 1);
        ctx.fillRect(x - 2, y - 2, 5, 1);
        if (blip) { ctx.fillStyle = '#e1232b'; ctx.fillRect(x, y - 9, 1, 2); }
      } else if (sp.name === 'CELL') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 4, 9, 10);
        ctx.fillStyle = '#000000'; ctx.fillRect(x - 3, y - 3, 7, 8);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 6, 3, 2);
        ctx.fillStyle = '#e1232b';
        ctx.fillRect(x - 2, y + 2, 5, 2);
        if (blip) ctx.fillRect(x - 2, y - 1, 5, 2);
      } else {
        this.ring(ctx, sp.x, sp.y, 5.5, '#ffffff');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 8, y, 3, 1); ctx.fillRect(x + 6, y, 3, 1);
        ctx.fillRect(x, y - 8, 1, 3); ctx.fillRect(x, y + 6, 1, 3);
        if (blip) { ctx.fillStyle = '#e1232b'; ctx.fillRect(x - 1, y - 1, 3, 3); }
      }
      if (sp.prog > 0) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 10, y - 15, 20, 4);
        ctx.fillStyle = '#000000'; ctx.fillRect(x - 9, y - 14, 18, 2);
        ctx.fillStyle = '#e1232b'; ctx.fillRect(x - 9, y - 14, Math.round(18 * sp.prog), 2);
      }
    }

    const vis = (x, y) => x > sx - 170 && x < sx + V + 170 && y > sy - 170 && y < sy + V + 170;

    for (const e of g.enemies) {
      if (e.dead || e.st === 'hide') continue;
      const rng = e.rngCur || (e.sniper ? 200 : 105), half = e.halfCur || (e.sniper ? 0.2 : 0.62);
      if (e.x < sx - rng - 20 || e.x > sx + V + rng + 20 || e.y < sy - rng - 20 || e.y > sy + V + rng + 20) continue;
      const alert = e.st === 'alert' || e.st === 'shoot';
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      ctx.arc(e.x, e.y, rng, e.face - half, e.face + half);
      ctx.closePath();
      ctx.fillStyle = alert ? this.pat.coneR : this.pat.coneW;
      ctx.fill();
    }

    for (const tr of g.trips) {
      if (tr.done || !vis(tr.x1, tr.y1)) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(tr.x1) - 1, Math.round(tr.y1) - 3, 2, 4);
      ctx.fillRect(Math.round(tr.x2) - 1, Math.round(tr.y2) - 3, 2, 4);
      const dx = tr.x2 - tr.x1, dy = tr.y2 - tr.y1, L = Math.hypot(dx, dy);
      for (let d2 = 4; d2 < L - 4; d2 += 5) {
        ctx.fillRect(Math.round(tr.x1 + dx / L * d2), Math.round(tr.y1 + dy / L * d2), 2, 1);
      }
    }

    for (const mn of g.mines) {
      if (mn.done || !vis(mn.x, mn.y)) continue;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mn.x - 2, mn.y - 2, 5, 5);
      ctx.fillStyle = '#000000'; ctx.fillRect(mn.x - 1, mn.y - 1, 3, 3);
      if (t % 1.4 < 0.5) { ctx.fillStyle = '#e1232b'; ctx.fillRect(mn.x, mn.y, 1, 1); }
    }

    for (const f of g.fires) {
      if (!vis(f.x, f.y)) continue;
      for (let i = 0; i < 7; i++) {
        const a2 = Math.random() * Math.PI * 2, rr = Math.random() * f.r * 0.6;
        ctx.fillStyle = Math.random() < 0.72 ? '#e1232b' : '#ffffff';
        ctx.fillRect(Math.round(f.x + Math.cos(a2) * rr), Math.round(f.y + Math.sin(a2) * rr - Math.random() * 5), 2, 2);
      }
    }
    for (const mk of g.meds) {
      if (mk.taken || !vis(mk.x, mk.y)) continue;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mk.x - 4, mk.y - 4, 8, 8);
      ctx.fillStyle = '#000000'; ctx.fillRect(mk.x - 3, mk.y - 3, 6, 6);
      ctx.fillStyle = '#e1232b';
      ctx.fillRect(mk.x - 1, mk.y - 3, 2, 6);
      ctx.fillRect(mk.x - 3, mk.y - 1, 6, 2);
    }
    for (const ab of g.ammoB) {
      if (ab.taken || !vis(ab.x, ab.y)) continue;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ab.x - 4, ab.y - 3, 8, 7);
      ctx.fillStyle = '#000000'; ctx.fillRect(ab.x - 3, ab.y - 2, 6, 5);
      ctx.fillStyle = '#e8c84a';
      ctx.fillRect(ab.x - 2, ab.y - 1, 1, 3);
      ctx.fillRect(ab.x, ab.y - 1, 1, 3);
      ctx.fillRect(ab.x + 2, ab.y - 1, 1, 3);
    }

    ctx.fillStyle = '#ffffff';
    for (const b of g.bullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);

    for (const e of g.enemies) if (!e.dead && vis(e.x, e.y)) this.drawEnemy(ctx, e, t);

    if (this.state.health > 0 && !(p.iframes > 0 && Math.floor(t * 12) % 2 === 0)) {
      if (g.hidden) ctx.globalAlpha = 0.45;
      this.drawPlayer(ctx, p, t);
      ctx.globalAlpha = 1;
      if (g.hidden) {
        ctx.fillStyle = '#ffffff';
        for (let a2 = 0; a2 < Math.PI * 2; a2 += 0.42) {
          if (((a2 * 7 + t * 4) | 0) % 2 === 0) ctx.fillRect(Math.round(p.x + Math.cos(a2) * 9), Math.round(p.y + Math.sin(a2) * 9), 1, 1);
        }
      }
    }

    if (this.tm() && !g.over) {
      ctx.fillStyle = '#ffffff';
      for (let i = 16; i <= 32; i += 5) {
        ctx.fillRect(Math.round(p.x + Math.cos(p.aim) * i), Math.round(p.y + Math.sin(p.aim) * i), 1, 1);
      }
    }

    for (const pt of g.parts) { ctx.fillStyle = pt.c; ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 2, 2); }
    ctx.restore();

    for (const e of g.enemies) {
      if (e.dead || e.st === 'hide') continue;
      if (e.st !== 'alert' && e.st !== 'shoot' && !(e.st === 'search' && g.heat > 0)) continue;
      const ex = e.x - sx, ey = e.y - sy;
      if (ex >= 0 && ex <= V && ey >= 0 && ey <= V) continue;
      if (t % 0.4 > 0.24) continue;
      ctx.fillStyle = '#e1232b';
      ctx.fillRect(Math.round(Math.max(2, Math.min(V - 5, ex))), Math.round(Math.max(2, Math.min(V - 5, ey))), 3, 3);
    }

    if (!g.over && this.state.started) {
      let obj = null, bo = 1e9;
      for (const sp of g.sparts) {
        if (sp.taken) continue;
        const d2 = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (d2 < bo) { bo = d2; obj = sp; }
      }
      const ojx = obj ? obj.x : this.L.tower.x, ojy = obj ? obj.y : this.L.tower.y;
      const exx = ojx - sx, eyy = ojy - sy;
      if ((exx < 0 || exx > V || eyy < 0 || eyy > V) && t % 1.1 < 0.72) {
        const cxx = Math.round(Math.max(4, Math.min(V - 7, exx))), cyy = Math.round(Math.max(4, Math.min(V - 7, eyy)));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cxx, cyy - 3, 2, 2);
        ctx.fillRect(cxx - 3, cyy, 2, 2);
        ctx.fillRect(cxx + 3, cyy, 2, 2);
        ctx.fillRect(cxx, cyy + 3, 2, 2);
      }
    }

    if (g.heat > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, V, 4);
      ctx.fillStyle = '#e1232b';
      ctx.fillRect(0, 1, Math.round(V * Math.min(1, g.heat / 20)), 2);
    }

    this.mist(ctx, t);

    if (g.flashT > 0) { ctx.fillStyle = this.pat.flash; ctx.fillRect(0, 0, V, V); }

    if (g.mapOn && this.state.started && !g.over) this.drawMinimap(ctx, t);

  }

  drawMinimap(ctx, t) {
    const g = this.g, p = g.player, V = this.V;
    const mh = 212;
    const k = mh / this.H;
    const mw = Math.round(this.W * k);
    const mx = Math.round((V - mw) / 2), my = Math.round((V - mh) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(mx - 3, my - 3, mw + 6, mh + 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx - 3, my - 3, mw + 6, 1);
    ctx.fillRect(mx - 3, my + mh + 2, mw + 6, 1);
    ctx.fillRect(mx - 3, my - 3, 1, mh + 6);
    ctx.fillRect(mx + mw + 2, my - 3, 1, mh + 6);
    const TX = (wx) => Math.round(mx + wx * k);
    const TY = (wy) => Math.round(my + wy * k);
    const tx = TX(this.L.tower.x), ty = TY(this.L.tower.y);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tx, ty - 4, 1, 8);
    ctx.fillRect(tx - 3, ty - 2, 7, 1);
    ctx.fillRect(tx - 2, ty + 1, 5, 1);
    if (t % 1 < 0.5) { ctx.fillStyle = '#e1232b'; ctx.fillRect(tx, ty - 5, 1, 2); }
    for (const sp of g.sparts) {
      const ox = TX(sp.x), oy = TY(sp.y);
      if (sp.taken) { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(ox - 1, oy - 1, 3, 3); }
      else {
        ctx.fillStyle = (t % 0.9 < 0.55) ? '#ffffff' : '#8a8a8a';
        ctx.fillRect(ox - 1, oy - 2, 3, 5);
        ctx.fillRect(ox - 2, oy - 1, 5, 3);
      }
    }
    const px = TX(p.x), py = TY(p.y);
    if (t % 0.6 < 0.42) { ctx.fillStyle = '#e1232b'; ctx.fillRect(px - 1, py - 1, 3, 3); }
  }

  mist(ctx, t) {
    if (!this._wisps) {
      const rnd = this.mulberry(77);
      this._wisps = [];
      for (let i = 0; i < 7; i++) {
        const blobs = [];
        const nb = 3 + ((rnd() * 3) | 0);
        let cx = 0;
        for (let b = 0; b < nb; b++) {
          const r = 6 + rnd() * 8;
          blobs.push({ dx: Math.round(cx), dy: Math.round((rnd() - 0.5) * 8), r: Math.round(r) });
          cx += r * (1 + rnd() * 0.4);
        }
        this._wisps.push({
          y: Math.round((i + 0.15 + rnd() * 0.7) * this.V / 7),
          sp: 2.5 + rnd() * 5, x0: rnd() * 600, w: cx + 24, blobs,
          dense: i % 2 === 0,
        });
      }
    }
    const vspan = this.V + 48;
    for (const w of this._wisps) {
      const span = this.V + w.w * 2;
      const drift = w.x0 + t * w.sp - this.g.camX * 0.3;
      const x = Math.floor(((drift % span) + span) % span) - w.w;
      const yy = Math.floor((((w.y - this.g.camY * 0.25) % vspan) + vspan) % vspan) - 24;
      ctx.fillStyle = w.dense ? this.pat.m2 : this.pat.m1;
      for (const b of w.blobs) {
        ctx.save(); ctx.beginPath();
        ctx.arc(x + b.dx, yy + b.dy, b.r, 0, Math.PI * 2); ctx.clip();
        ctx.fillRect(x + b.dx - b.r, yy + b.dy - b.r, b.r * 2, b.r * 2);
        ctx.restore();
      }
    }
  }

  drawPlayer(ctx, p, t) {
    const a = p.aim;
    const bx = Math.round(p.x - Math.cos(a) * 6), by = Math.round(p.y - Math.sin(a) * 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx - 3, by - 3, 6, 6);
    this.disc(ctx, p.x, p.y, 4.5, '#ffffff');
    if (t % 0.9 < 0.45) { ctx.fillStyle = '#e1232b'; ctx.fillRect(bx - 1, by - 1, 2, 2); }
    this.pxLine(ctx, p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, p.x + Math.cos(a) * 11, p.y + Math.sin(a) * 11, '#ffffff');
    if (this.g.muzzle > 0) {
      const fx = Math.round(p.x + Math.cos(a) * 13), fy = Math.round(p.y + Math.sin(a) * 13);
      ctx.fillStyle = '#e1232b'; ctx.fillRect(fx - 2, fy - 2, 4, 4);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(fx - 1, fy - 1, 1, 1);
    }
  }

  drawEnemy(ctx, e, t) {
    const style = this.props.enemyStyle ?? 'solid silhouette';
    const alert = e.st === 'alert' || e.st === 'shoot';
    const f = e.face;
    if (e.st === 'hide') {
      const x2 = Math.round(e.x), y2 = Math.round(e.y);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x2 - 3, y2 + 1, 3, 1); ctx.fillRect(x2 + 1, y2 - 1, 2, 1);
      if ((t + e.ph) % 1.9 < 0.14) { ctx.fillStyle = '#e1232b'; ctx.fillRect(x2, y2, 1, 1); }
      return;
    }
    if (e.rusher) {
      this.ring(ctx, e.x, e.y, 5.5, '#ffffff');
      this.disc(ctx, e.x, e.y, 3.7, '#e1232b');
      for (const s2 of [-1, 1]) {
        const ox = Math.cos(f + Math.PI / 2) * s2 * 2.5, oy = Math.sin(f + Math.PI / 2) * s2 * 2.5;
        this.pxLine(ctx, e.x + ox + Math.cos(f) * 3, e.y + oy + Math.sin(f) * 3, e.x + ox + Math.cos(f) * 9, e.y + oy + Math.sin(f) * 9, '#ffffff');
      }
      if (alert) { ctx.fillStyle = '#ffffff'; this.eyes(ctx, e, f); }
      return;
    }
    const gl = e.sniper ? 15 : 11;
    this.pxLine(ctx, e.x + Math.cos(f) * 4, e.y + Math.sin(f) * 4, e.x + Math.cos(f) * gl, e.y + Math.sin(f) * gl, '#ffffff');
    if (e.muzzle > 0) {
      const fx = Math.round(e.x + Math.cos(f) * 13), fy = Math.round(e.y + Math.sin(f) * 13);
      ctx.fillStyle = '#e1232b'; ctx.fillRect(fx - 2, fy - 2, 4, 4);
    }
    const x = Math.round(e.x), y = Math.round(e.y);
    if (style === 'hollow outline') {
      this.ring(ctx, e.x, e.y, 5.5, '#ffffff');
      this.ring(ctx, e.x, e.y, 3.8, '#e1232b');
      ctx.fillStyle = alert ? '#ffffff' : '#e1232b';
      this.eyes(ctx, e, f);
    } else if (style === 'visor split') {
      this.ring(ctx, e.x, e.y, 6, '#ffffff');
      this.disc(ctx, e.x, e.y, 4.5, '#e1232b');
      ctx.fillStyle = '#000000'; ctx.fillRect(x - 4, y - 1, 9, 2);
      if (alert) { ctx.fillStyle = '#ffffff'; this.eyes(ctx, e, f); }
    } else {
      this.ring(ctx, e.x, e.y, 6, '#ffffff');
      this.disc(ctx, e.x, e.y, 4.5, '#e1232b');
      if (alert) { ctx.fillStyle = '#ffffff'; this.eyes(ctx, e, f); }
    }
  }

  eyes(ctx, e, f) {
    for (const s of [-1, 1]) {
      const ex = Math.round(e.x + Math.cos(f) * 2.5 + Math.cos(f + Math.PI / 2) * s * 2);
      const ey = Math.round(e.y + Math.sin(f) * 2.5 + Math.sin(f + Math.PI / 2) * s * 2);
      ctx.fillRect(ex - 1, ey - 1, 2, 2);
    }
  }

  ensureAudio = () => {
    if (this._ac) { if (this._ac.state === 'suspended') this._ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this._ac = new AC();
    this._master = this._ac.createGain();
    this._master.gain.value = this.state.muted ? 0 : 0.5;
    this._master.connect(this._ac.destination);
    const len = this._ac.sampleRate;
    this._noiseBuf = this._ac.createBuffer(1, len, this._ac.sampleRate);
    const d = this._noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };

  tone(type, f0, f1, dur, vol, when) {
    const ac = this._ac; if (!ac) return;
    const t0 = ac.currentTime + (when || 0);
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(gn); gn.connect(this._master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  noise(dur, vol, freq, type) {
    const ac = this._ac; if (!ac) return;
    const t0 = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = this._noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = type || 'lowpass'; fl.frequency.value = freq;
    const gn = ac.createGain();
    gn.gain.setValueAtTime(vol, t0);
    gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(fl); fl.connect(gn); gn.connect(this._master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  sfx(name) {
    if (!this._ac || this.state.muted) return;
    switch (name) {
      case 'shot': this.noise(0.08, 0.3, 2600); this.tone('square', 160, 55, 0.09, 0.2); break;
      case 'eshot': this.noise(0.1, 0.22, 900); this.tone('square', 110, 45, 0.1, 0.16); break;
      case 'hitE': this.tone('square', 520, 290, 0.05, 0.13); break;
      case 'kill': this.tone('sawtooth', 260, 55, 0.22, 0.2); this.noise(0.12, 0.18, 700); break;
      case 'hurt': this.tone('sawtooth', 100, 50, 0.28, 0.3); this.noise(0.14, 0.24, 500); break;
      case 'die': this.tone('sawtooth', 170, 26, 0.85, 0.3); break;
      case 'spot': this.tone('square', 840, 840, 0.05, 0.09); break;
      case 'alarm': this.tone('square', 700, 700, 0.08, 0.13); this.tone('square', 520, 520, 0.08, 0.13, 0.11); this.tone('square', 700, 700, 0.09, 0.13, 0.22); break;
      case 'boom': this.noise(0.4, 0.5, 260); this.tone('sawtooth', 100, 24, 0.5, 0.4); break;
      case 'pick': this.tone('square', 660, 880, 0.1, 0.14); break;
      case 'dry': this.tone('square', 210, 150, 0.04, 0.12); break;
      case 'win': this.tone('square', 392, 392, 0.12, 0.15); this.tone('square', 660, 660, 0.14, 0.15, 0.15); break;
      case 'tick': this.tone('square', 500, 640, 0.05, 0.1); break;
      case 'step': {
        this.g.stepL = !this.g.stepL;
        const base = this.g.stepL ? 420 : 360;
        this.noise(0.055 + Math.random() * 0.02, 0.055 + Math.random() * 0.02, base + Math.random() * 120);
        break;
      }
      case 'static': this.noise(0.3, 0.12, 1500, 'bandpass'); break;
    }
  }

  startRadio(line) {
    if (this._radioInt) { clearInterval(this._radioInt); this._radioInt = null; }
    this.sfx('static');
    this.setState({ radioOn: true, radioText: '' });
    let i = 0;
    this._radioInt = setInterval(() => {
      i++;
      this.setState({ radioText: line.slice(0, i) });
      if (i >= line.length) {
        clearInterval(this._radioInt); this._radioInt = null;
        this._timers.push(setTimeout(() => this.setState({ radioOn: false }), 3800));
      }
    }, 42);
  }

  onMouseMove = (e) => { this.g.mouse = { x: e.clientX, y: e.clientY }; };
  onMouseDown = (e) => { this.ensureAudio(); if (e.button !== 0 || this.g.over || !this.state.started) return; if (this.state.focusPause) return; const r = this._rect; if (r && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) return; this.g.fireHeld = true; this.g.tapShot = true; };
  onMouseUp = () => { this.g.fireHeld = false; };

  stickVec(t) {
    const b = this.moveBaseRef.current.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const m = Math.hypot(dx, dy), max = 44;
    if (m > max) { dx = dx / m * max; dy = dy / m * max; }
    return { dx, dy, max };
  }

  setKnob(dx, dy) {
    const k = this.moveKnobRef.current;
    if (k) k.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }

  moveStart = (e) => {
    this.ensureAudio();
    if (this.g.moveId !== null) {
      let alive = false;
      for (const t of e.touches) if (t.identifier === this.g.moveId) { alive = true; break; }
      if (!alive) { this.g.moveId = null; this.g.moveVec = { x: 0, y: 0 }; }
    }
    if (this.g.moveId !== null || !this.moveBaseRef.current) return;
    const t = e.changedTouches[0];
    this.g.moveId = t.identifier;
    const v = this.stickVec(t);
    this.g.moveVec = { x: v.dx / v.max, y: v.dy / v.max };
    this.setKnob(v.dx, v.dy);
  };

  moveMove = (e) => {
    if (!this.moveBaseRef.current) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== this.g.moveId) continue;
      const v = this.stickVec(t);
      this.g.moveVec = { x: v.dx / v.max, y: v.dy / v.max };
      this.setKnob(v.dx, v.dy);
    }
  };

  moveEnd = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== this.g.moveId) continue;
      this.g.moveId = null;
      this.g.moveVec = { x: 0, y: 0 };
      this.setKnob(0, 0);
    }
  };

  fireDown = () => {
    this.ensureAudio();
    if (!this.state.started) return;
    this.g.fireHeld = true; this.g.tapShot = true;
    const b = this.fireBtnRef.current;
    if (b) { b.style.borderColor = '#e1232b'; b.style.color = '#e1232b'; b.style.background = '#1a0406'; }
  };

  fireUp = () => {
    this.g.fireHeld = false;
    const b = this.fireBtnRef.current;
    if (b) { b.style.borderColor = '#ffffff'; b.style.color = '#ffffff'; b.style.background = '#000000'; }
  };

  toggleMute = () => {
    const m = !this.state.muted;
    this.setState({ muted: m });
    if (this._master) this._master.gain.value = m ? 0 : 0.5;
  };

  OB_BEATS = [
    { label: 'LOG 01 // THE WAR', line: 'THE WAR DID NOT END. IT RAN OUT OF PEOPLE.', body: [
      { t: 'SOMETHING GOT OUT DURING THE FIGHTING.' },
      { t: 'IT DOES NOT KILL. IT DRAINS.' },
      { t: 'COLOR FIRST. THEN SOUND. THEN MEMORY.' },
      { t: 'RED IS WHAT IS LEFT WHEN EVERYTHING ELSE IS GONE.', red: true },
    ] },
    { label: 'LOG 02 // THE TAKEN', line: 'THE PATROLS STILL WALK THEIR ROUTES.', body: [
      { t: 'FROZEN IN THE LAST ORDER THEY WERE GIVEN.' },
      { t: 'THEY ARE NOT MEN ANYMORE.' },
      { t: 'IF THEY SEE YOU, THEY DO NOT STOP.', red: true },
    ] },
    { label: 'LOG 03 // THE TOWER', line: 'YOUR RADIO CAUGHT A LOOP IN THE NIGHT.', body: [
      { t: '"EXTRACTION ACTIVE. TOWER POINT NORTH. WE WILL BRING YOU HOME."' },
      { t: 'THE LOOP IS OLD. THE VOICE IS DEAD. NO ONE IS COMING.' },
      { t: 'BUT A DEAD TOWER CAN STILL BE MADE TO SPEAK.' },
      { t: 'SALVAGE 3 PARTS. FIX IT. SEND YOUR OWN SIGNAL.', red: true },
    ] },
  ];

  startObType(bi) {
    if (this._obInt) clearInterval(this._obInt);
    const line = this.OB_BEATS[bi].line;
    this.setState({ obText: '' });
    let i = 0;
    this._obInt = setInterval(() => {
      i += 2;
      this.setState({ obText: line.slice(0, i) });
      if (i >= line.length) { clearInterval(this._obInt); this._obInt = null; }
    }, 30);
  }

  obNext = () => {
    if (this.state.started) return;
    this.ensureAudio();
    const s = this.state.obStep;
    if ((s === 0 || s === 1) && this.state.obSeen) { this.startGame(); return; }
    if (s >= 2 && s <= 4 && this._obInt) {
      clearInterval(this._obInt); this._obInt = null;
      this.setState({ obText: this.OB_BEATS[s - 2].line });
      return;
    }
    if (s === 0) {
      this.sfx('static');
      this.setState({ obStep: 1 });
    } else if (s < 4) {
      this.sfx('static');
      this.setState({ obStep: s + 1 });
      this.startObType(s - 1);
    } else if (s === 4) {
      this.sfx('pick');
      this.setState({ obStep: 5 });
    } else {
      this.startGame();
    }
  };

  obMap = () => {
    this.ensureAudio();
    this.sfx('static');
    this.setState({ obStep: 1 });
  };

  obSkip = () => { this.startGame(); };

  newRun = () => {
    this.ensureAudio();
    this._cp = false; this._cpParts = null; this._deathAmmo = null;
    try { localStorage.removeItem(this.skey('save')); } catch (err) {}
    this.resetRun();
    this.buildStatic();
    this.sfx('static');
    this.setState({ hasSave: false, parts: 0, ammo: 40, health: 4, kills: 0 });
  };

  obReplay = () => {
    this.ensureAudio();
    this.sfx('static');
    this.setState({ obSeen: false, obStep: 2 });
    this.startObType(0);
  };

  startGame = () => {
    if (this.state.started) return;
    this.ensureAudio();
    if (this._obInt) { clearInterval(this._obInt); this._obInt = null; }
    try { localStorage.setItem('thesignal_l1_onboarded', '1'); } catch (err) {}
    this.g.fireHeld = false; this.g.tapShot = false; this.g.keys = {};
    this.setState({ started: true, hintOn: true, obSeen: true, markerHintDone: false });
    const hintGen = this._hintGen = (this._hintGen || 0) + 1;
    this.sfx('win');
    this._timers.push(setTimeout(() => this.startRadio(this.L.radio.start), 1000));
    this._timers.push(setTimeout(() => this.setState({ hintOn: false }), 6200));
    this._timers.push(setTimeout(() => { if (this._hintGen === hintGen) this.setState({ markerHintDone: true }); }, 13200));
  };

  saveRun() {
    try {
      if (this._cp || (this._cpParts && this._cpParts.some(Boolean))) {
        localStorage.setItem(this.skey('save'), JSON.stringify({ cp: !!this._cp, parts: this._cpParts || [], ammo: this.state.ammo }));
      } else {
        localStorage.removeItem(this.skey('save'));
      }
    } catch (err) {}
  }

  setDiff = (hard) => {
    this.ensureAudio();
    if (hard !== this.state.diffHard) this.sfx('tick');
    this.setState({ diffHard: hard });
    try { localStorage.setItem('thesignal_diff', hard ? 'vet' : 'rec'); } catch (err) {}
  };

  exitToMenu = () => {
    if (!this.state.started) return;
    if (this.state.complete) { this._cp = false; this._deathAmmo = null; this._cpParts = null; }
    else { this._deathAmmo = this.state.ammo; }
    this.saveRun();
    if (this._radioInt) { clearInterval(this._radioInt); this._radioInt = null; }
    this.g.fireHeld = false; this.g.tapShot = false; this.g.keys = {};
    this.resetRun();
    this.buildStatic();
    this.sfx('static');
    this.setState({
      started: false, obStep: 0, hasSave: !!this._cp,
      health: 4, ammo: (this._cp && this._deathAmmo != null) ? this._deathAmmo : 40,
      kills: 0, dead: false, complete: false, hunted: false, hiddenOn: false,
      radioOn: false, hintOn: false, fixText: '',
      parts: this.g.sparts.filter((s2) => s2.taken).length,
    });
  };

  restart = () => {
    if (!this.state.started) return;
    if (this.state.complete) { this._cp = false; this._deathAmmo = null; this._cpParts = null; }
    this.resetRun();
    this.buildStatic();
    this.setState({
      health: 4,
      ammo: (this._cp && this._deathAmmo != null) ? this._deathAmmo : 40,
      kills: 0, dead: false, complete: false, hunted: false,
      parts: this.g.sparts.filter((s2) => s2.taken).length, fixText: '',
    });
  };

  renderVals() {
    const hp = this.state.health;
    const healthCells = [0, 1, 2, 3].map((i) => ({
      style: {
        width: '13px', height: '13px', boxSizing: 'border-box',
        border: '2px solid ' + (hp <= 1 ? '#e1232b' : '#ffffff'),
        background: i < hp ? (hp <= 1 ? '#e1232b' : '#ffffff') : 'transparent',
      },
    }));
    const pn = this.state.parts;
    const nParts = this.g && this.g.sparts ? this.g.sparts.length : 3;
    const partCells = Array.from({ length: nParts }, (_, i) => i).map((i) => ({
      style: {
        width: '9px', height: '9px', boxSizing: 'border-box', transform: 'rotate(45deg)',
        border: '2px solid ' + (pn === nParts ? '#e1232b' : '#ffffff'),
        background: i < pn ? (pn === nParts ? '#e1232b' : '#ffffff') : 'transparent',
      },
    }));
    return {
      creatorName: this.props.creatorName ?? 'YOUR NAME',
      levelLabel: 'LVL ' + this.L.num + ' // ' + this.L.name,
      partCells, fixOn: !!this.state.fixText, fixText: this.state.fixText,
      canvasRef: this.canvasRef, padRef: this.padRef, fireBtnRef: this.fireBtnRef,
      moveBaseRef: this.moveBaseRef, moveKnobRef: this.moveKnobRef,
      healthCells,
      ammo: this.state.ammo,
      kills: this.state.kills,
      ammoIconStyle: {
        width: '4px', height: '11px',
        background: this.state.ammo < 6 ? '#e1232b' : '#e8c84a',
        animation: this.state.ammo < 6 ? 'sigblink 0.5s steps(1) infinite' : 'none',
      },
      ammoTextStyle: {
        fontFamily: "'VT323',monospace", fontSize: '19px', minWidth: '22px',
        color: this.state.ammo < 6 ? '#e1232b' : '#e8c84a',
        animation: this.state.ammo < 6 ? 'sigblink 0.5s steps(1) infinite' : 'none',
      },
      muteLabel: this.state.muted ? 'SND OFF' : 'SND ON',
      toggleMute: this.toggleMute, restart: this.restart, exitMenu: this.exitToMenu,
      moveStart: this.moveStart, moveMove: this.moveMove, moveEnd: this.moveEnd,
      fireDown: this.fireDown, fireUp: this.fireUp,
      dead: this.state.dead, complete: this.state.complete,
      hunted: this.state.hunted && !this.state.hiddenOn,
      hiddenOn: this.state.hiddenOn,
      rapidOn: this.state.rapidSec > 0, rapidSec: '0:0' + Math.max(0, Math.min(9, this.state.rapidSec)),
      setRecruit: this._setRec || (this._setRec = () => this.setDiff(false)),
      setVeteran: this._setVet || (this._setVet = () => this.setDiff(true)),
      recruitStyle: {
        background: this.state.diffHard ? '#000000' : '#ffffff', color: this.state.diffHard ? '#8a8a8a' : '#000000',
        border: '2px solid ' + (this.state.diffHard ? '#8a8a8a' : '#ffffff'),
        fontFamily: "'Silkscreen',monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '2px', padding: '10px 18px', cursor: 'pointer',
      },
      veteranStyle: {
        background: this.state.diffHard ? '#e1232b' : '#000000', color: this.state.diffHard ? '#000000' : '#8a8a8a',
        border: '2px solid ' + (this.state.diffHard ? '#e1232b' : '#8a8a8a'),
        fontFamily: "'Silkscreen',monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '2px', padding: '10px 18px', cursor: 'pointer',
      },
      diffDesc: this.state.diffHard ? 'FASTER PATROLS. SCARCE AMMO. RELENTLESS HUNTS.' : 'STANDARD PATROLS. FAIR SCAVENGE.',
      radioOn: this.state.radioOn, radioText: this.state.radioText,
      hintOn: this.state.hintOn,
      markerHintOn: this.state.started && !this.state.hintOn && !this.state.markerHintDone && !this.state.fixText && this.state.parts === 0 && !this.state.dead && !this.state.complete,
      markerHintText: this.tm() ? 'FOLLOW THE WHITE MARKERS' : 'FOLLOW THE WHITE MARKERS · [TAB] MAP',
      hintText: this.tm() ? 'STICK — MOVE + AIM · FIRE — SHOOT' : 'WASD MOVE · MOUSE AIM · CLICK FIRE',
      isTouch: this.tm(), isDesktop: !this.tm(),
      showIntro: !this.state.started,
      obTitle: this.state.obStep === 0, obMapOn: this.state.obStep === 1,
      obStory: this.state.obStep >= 2 && this.state.obStep <= 4, obControls: this.state.obStep === 5,
      obText: this.state.obText,
      obLabel: this.OB_BEATS[Math.max(0, Math.min(2, this.state.obStep - 2))].label,
      obBodyLines: this.state.started ? [] : this.OB_BEATS[Math.max(0, Math.min(2, this.state.obStep - 2))].body.map((b) => ({
        text: b.t,
        style: { fontFamily: "'VT323',monospace", fontSize: '19px', lineHeight: '1.4', color: b.red ? '#e1232b' : '#8a8a8a', marginTop: b.red ? '18px' : '0', textAlign: 'left' },
      })),
      obVis1: this.state.obStep === 2, obVis2: this.state.obStep === 3, obVis3: this.state.obStep === 4,
      obNext: this.obNext, obSkip: this.obSkip, obReplay: this.obReplay, obMap: this.obMap, startGame: this.startGame,
      obShowSkip: !this.state.obSeen && this.state.obStep >= 2 && this.state.obStep < 5 && !this.state.started,
      obReplayOn: this.state.obSeen && this.state.obStep === 0,
      newRun: this.newRun,
      hasSaveUI: this.state.hasSave && this.state.obStep === 0,
      focusPause: !!this.state.focusPause && !this.state.dead && !this.state.complete,
      obTitleBtn: this.state.obSeen ? (this.state.hasSave ? 'CONTINUE ▸' : 'START MISSION') : 'BEGIN ▸',
      obMapBtn: this.state.obSeen ? (this.state.hasSave ? 'CONTINUE LVL ' + this.L.num + ' ▸' : 'START LVL ' + this.L.num + ' ▸') : 'NEXT ▸',
      levels: this.state.started ? [] : [
        { n: '06', name: 'THE SIGNAL' },
        { n: '05', name: "SNIPER'S MILE" },
        { n: '04', name: 'THE FOG' },
        { n: '03', name: 'THE PACK' },
        { n: '02', name: 'THE RUINS' },
        { n: '01', name: 'FIRST LIGHT', open: true },
      ].map((d) => {
        const open = !!d.open;
        const cleared = open && this.state.l1Cleared;
        return {
          num: d.n, name: d.name,
          status: open ? (cleared ? 'CLEARED ▸' : (this.state.hasSave ? 'IN PROGRESS ▸' : 'READY ▸')) : 'LOCKED',
          click: open ? this.obNext : undefined,
          rowStyle: { position: 'relative', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', width: 'min(300px, 82vw)', boxSizing: 'border-box', cursor: open ? 'pointer' : 'default', border: '1px solid ' + (open ? (cleared ? '#e1232b' : '#ffffff') : '#2a2a2a'), background: '#000000' },
          nodeStyle: { width: '12px', height: '12px', boxSizing: 'border-box', flexShrink: 0, border: '2px solid ' + (open ? '#ffffff' : '#3a3a3a'), background: cleared ? '#e1232b' : '#000000', animation: open && !cleared ? 'sigblink 1.1s steps(1) infinite' : 'none' },
          numStyle: { fontFamily: "'VT323',monospace", fontSize: '17px', color: open ? '#e1232b' : '#3a3a3a', width: '24px', flexShrink: 0 },
          nameStyle: { fontFamily: "'Silkscreen',monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '2px', color: open ? '#ffffff' : '#3a3a3a', flex: 1, textAlign: 'left' },
          statusStyle: { fontFamily: "'VT323',monospace", fontSize: '15px', color: open ? (cleared ? '#e1232b' : '#8a8a8a') : '#3a3a3a', flexShrink: 0 },
        };
      }),
      obDotsOn: !this.state.obSeen || this.state.obStep > 0,
      obDots: this.state.started ? [] : [0, 1, 2, 3, 4, 5].map((i) => ({ style: { width: '8px', height: '8px', boxSizing: 'border-box', background: i === this.state.obStep ? '#ffffff' : 'transparent', border: '1px solid ' + (i === this.state.obStep ? '#ffffff' : '#5a5a5a') } })),
      landscapeBlock: this.state.landscapeBlock,
      statTime: this.state.statTime, statShots: this.state.statShots, statAcc: this.state.statAcc,
    };
  }
  render() {
    const v = this.renderVals();
    return (
      <div data-screen-label="THE SIGNAL — Level 1" style={css("position:relative;height:100dvh;background:#000000;display:flex;flex-direction:column;align-items:center;font-family:'Silkscreen',monospace;color:#ffffff;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:none;overflow:hidden;-webkit-tap-highlight-color:transparent")}>
  
        <div style={css("width:min(100vw, calc(100dvh - 265px - env(safe-area-inset-bottom)), 560px);display:flex;flex-direction:column;margin-top:auto;margin-bottom:auto")}>
  
          {/* ---------- HUD BAR ---------- */}
          <div style={css("width:100%;display:flex;align-items:flex-end;justify-content:space-between;padding:10px 2px;box-sizing:border-box")}>
            <div>
              <div style={css("font-size:13px;font-weight:700;letter-spacing:2px")}>THE SIGNAL</div>
              <div style={css("font-family:'VT323',monospace;font-size:15px;color:#e1232b;margin-top:2px")}>{v.levelLabel}</div>
            </div>
            <div style={css("display:flex;align-items:center;gap:10px;row-gap:5px;flex-wrap:wrap;justify-content:flex-end")}>
  
              {v.rapidOn && (
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#e1232b;letter-spacing:2px;border:1px solid #e1232b;padding:0 6px;animation:sigblink 0.5s steps(1) infinite")}>TRI-SHOT {v.rapidSec}</div>
              )}
              {v.hiddenOn && (
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#ffffff;letter-spacing:2px;border:1px solid #ffffff;padding:0 6px")}>HIDDEN</div>
              )}
              {v.hunted && (
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#e1232b;letter-spacing:2px;animation:sigblink 0.5s steps(1) infinite")}>HUNTED</div>
              )}
  
              <div style={css("display:flex;align-items:center;gap:6px")}>
                <div style={css("font-family:'VT323',monospace;font-size:15px;color:#8a8a8a")}>PARTS</div>
                <div style={css("display:flex;gap:7px")}>
                  {v.partCells.map((pc, i) => <div key={i} style={css(pc.style)} />)}
                </div>
              </div>
  
              <div style={css("display:flex;gap:4px")}>
                {v.healthCells.map((cell, i) => <div key={i} style={css(cell.style)} />)}
              </div>
  
              <div style={css("display:flex;align-items:center;gap:5px")}>
                <div style={css(v.ammoIconStyle)} />
                <div style={css(v.ammoTextStyle)}>{v.ammo}</div>
              </div>
  
              <div style={css("display:flex;align-items:center;gap:5px")}>
                <div style={css("font-family:'VT323',monospace;font-size:15px;color:#8a8a8a")}>KILLS</div>
                <div style={css("font-family:'VT323',monospace;font-size:19px;color:#ffffff;min-width:16px")}>{v.kills}</div>
              </div>
  
              <button onClick={v.toggleMute} style={css("background:#000000;border:2px solid #ffffff;color:#ffffff;font-family:'Silkscreen',monospace;font-size:8px;padding:5px 6px;cursor:pointer")}>{v.muteLabel}</button>
              <Btn
                onClick={v.exitMenu}
                base="background:#000000;border:2px solid #8a8a8a;color:#8a8a8a;font-family:'Silkscreen',monospace;font-size:8px;padding:5px 6px;cursor:pointer"
                hover="border-color:#ffffff;color:#ffffff"
              >EXIT</Btn>
            </div>
          </div>
  
          {/* ---------- PLAYFIELD ---------- */}
          <div style={css("position:relative;width:100%;aspect-ratio:1 / 1;border:1px solid #ffffff;box-sizing:border-box;background:#000000")}>
            <canvas ref={this.canvasRef} width="240" height="240" style={css(CANVAS_CSS)} />
  
            {v.hintOn && (
              <div style={css("position:absolute;top:10px;left:0;right:0;display:flex;justify-content:center;pointer-events:none")}>
                <div style={css("background:#e8c84a;color:#000000;padding:4px 12px;font-family:'VT323',monospace;font-size:16px;letter-spacing:1px")}>{v.hintText}</div>
              </div>
            )}
  
            {v.markerHintOn && (
              <div style={css("position:absolute;top:10px;left:0;right:0;display:flex;justify-content:center;pointer-events:none")}>
                <div style={css("background:#e8c84a;color:#000000;padding:4px 12px;font-family:'VT323',monospace;font-size:16px;letter-spacing:1px")}>{v.markerHintText}</div>
              </div>
            )}

            {v.fixOn && (
              <div style={css("position:absolute;top:10px;left:0;right:0;display:flex;justify-content:center;pointer-events:none")}>
                <div style={css("background:#e1232b;color:#000000;padding:4px 12px;font-family:'VT323',monospace;font-size:16px;letter-spacing:1px;animation:sigblink 1s steps(1) infinite")}>{v.fixText}</div>
              </div>
            )}
  
            {v.radioOn && (
              <div style={css("position:absolute;left:6px;right:6px;bottom:6px;background:#000000;border:2px solid #ffffff;padding:5px 8px;display:flex;gap:8px;align-items:baseline;pointer-events:none")}>
                <div style={css("font-size:8px;color:#e1232b;letter-spacing:1px;flex-shrink:0")}>RADIO</div>
                <div style={css("font-family:'VT323',monospace;font-size:17px;line-height:1.1")}>
                  {v.radioText}
                  <span style={css("animation:sigblink 0.8s steps(1) infinite")}>_</span>
                </div>
              </div>
            )}
  
            {v.focusPause && (
              <div style={css("position:absolute;inset:0;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;pointer-events:none")}>
                <div style={css("background:#000000;border:2px solid #ffffff;padding:16px 26px;display:flex;flex-direction:column;align-items:center;gap:7px")}>
                  <div style={css("font-size:13px;font-weight:700;letter-spacing:4px")}>PAUSED</div>
                  <div style={css("font-family:'VT323',monospace;font-size:17px;color:#8a8a8a")}>CLICK THE GAME TO RESUME</div>
                </div>
              </div>
            )}
  
            {v.dead && (
              <div onClick={v.restart} style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer")}>
                <div style={css("background:#000000;border:2px solid #e1232b;padding:22px 34px;display:flex;flex-direction:column;align-items:center;gap:10px")}>
                  <div style={css("font-size:24px;font-weight:700;letter-spacing:4px;color:#e1232b")}>K.I.A.</div>
                  <div style={css("font-family:'VT323',monospace;font-size:18px")}>TAP TO RETRY</div>
                </div>
              </div>
            )}
  
            {v.complete && (
              <div onClick={v.restart} style={css("position:absolute;inset:0;display:flex;align-items:center;justify-content:center;cursor:pointer")}>
                <div style={css("background:#000000;border:2px solid #ffffff;padding:20px 30px;display:flex;flex-direction:column;align-items:center;gap:8px")}>
                  <div style={css("font-size:9px;letter-spacing:3px;color:#e1232b")}>TOWER LIVE — TRANSMITTING</div>
                  <div style={css("font-size:18px;font-weight:700;letter-spacing:3px")}>SIGNAL RESTORED</div>
                  <div style={css("width:100%;height:1px;background:#ffffff;margin:4px 0")} />
                  <div style={css("font-family:'VT323',monospace;font-size:18px;display:flex;flex-direction:column;gap:2px;align-items:center")}>
                    <div>TIME — {v.statTime}</div>
                    <div>SHOTS — {v.statShots}</div>
                    <div>ACCURACY — {v.statAcc}</div>
                  </div>
                  <div style={css("font-family:'VT323',monospace;font-size:16px;color:#e1232b;margin-top:6px")}>TAP TO GO AGAIN</div>
                </div>
              </div>
            )}
          </div>
  
          {/* ---------- DESKTOP LEGEND ---------- */}
          {v.isDesktop && (
            <div style={css("width:100%;display:flex;justify-content:space-between;padding:10px 2px;box-sizing:border-box;font-family:'VT323',monospace;font-size:17px")}>
              <div>WASD — MOVE</div>
              <div>MOUSE — AIM</div>
              <div>CLICK — FIRE</div>
              <div>[R]ETRY · [TAB] MAP · [ESC] MENU</div>
            </div>
          )}
        </div>
  
        {/* ---------- TOUCH PAD ---------- */}
        {v.isTouch && (
          <div ref={this.padRef} style={css("position:relative;width:100vw;height:calc(210px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box;flex-shrink:0;border-top:1px solid #ffffff;overflow:hidden;background:#000000;display:flex")}>
            <div
              onTouchStart={v.moveStart}
              onTouchMove={v.moveMove}
              onTouchEnd={v.moveEnd}
              onTouchCancel={v.moveEnd}
              style={css("position:relative;flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px")}
            >
              <div ref={this.moveBaseRef} style={css("position:relative;width:112px;height:112px;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box")}>
                <div style={css("position:absolute;left:50%;top:5px;margin-left:-1px;width:2px;height:6px;background:#5a5a5a")} />
                <div style={css("position:absolute;left:50%;bottom:5px;margin-left:-1px;width:2px;height:6px;background:#5a5a5a")} />
                <div style={css("position:absolute;top:50%;left:5px;margin-top:-1px;width:6px;height:2px;background:#5a5a5a")} />
                <div style={css("position:absolute;top:50%;right:5px;margin-top:-1px;width:6px;height:2px;background:#5a5a5a")} />
                <div ref={this.moveKnobRef} style={css("position:absolute;left:50%;top:50%;width:44px;height:44px;margin-left:-22px;margin-top:-22px;background:#ffffff;border-radius:50%;pointer-events:none")} />
              </div>
              <div style={css("font-family:'VT323',monospace;font-size:14px;color:#8a8a8a;letter-spacing:3px;pointer-events:none")}>MOVE + AIM</div>
            </div>
  
            <div style={css("width:1px;height:100%;background:#2a2a2a;flex-shrink:0")} />
  
            <div
              onTouchStart={v.fireDown}
              onTouchEnd={v.fireUp}
              onTouchCancel={v.fireUp}
              style={css("position:relative;flex:1;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px")}
            >
              <div ref={this.fireBtnRef} style={css("width:112px;height:112px;border:2px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'VT323',monospace;font-size:30px;letter-spacing:4px;color:#ffffff;box-sizing:border-box;background:#000000;pointer-events:none;padding-left:4px")}>FIRE</div>
              <div style={css("font-family:'VT323',monospace;font-size:14px;color:#8a8a8a;letter-spacing:3px;pointer-events:none")}>HOLD = AUTO</div>
            </div>
          </div>
        )}
  
        {/* ---------- ONBOARDING / MENU OVERLAY ---------- */}
        {v.showIntro && (
          <div style={css("position:absolute;inset:0;background:#000000;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:28px 20px;box-sizing:border-box;text-align:center")}>
  
            {v.obShowSkip && (
              <button onClick={v.obSkip} style={css("position:absolute;top:calc(14px + env(safe-area-inset-top));right:16px;background:#000000;border:1px solid #4a4a4a;color:#8a8a8a;font-family:'VT323',monospace;font-size:16px;letter-spacing:2px;padding:6px 12px;cursor:pointer")}>SKIP ▸▸</button>
            )}
  
            {/* --- title card --- */}
            {v.obTitle && (
              <div style={css("display:flex;flex-direction:column;align-items:center")}>
                <div style={css("position:relative;width:150px;height:112px;margin-top:24px")}>
                  <div style={css("position:absolute;left:50%;top:14px;width:56px;height:56px;margin-left:-28px;margin-top:-28px;border:1px solid #e1232b;border-radius:50%;animation:sigring 2.8s linear infinite")} />
                  <div style={css("position:absolute;left:50%;top:14px;width:56px;height:56px;margin-left:-28px;margin-top:-28px;border:1px solid #e1232b;border-radius:50%;animation:sigring 2.8s linear -1.4s infinite")} />
                  <div style={css("position:absolute;left:50%;top:10px;width:8px;height:8px;margin-left:-4px;background:#e1232b;animation:sigblink 1.1s steps(1) infinite")} />
                  <div style={css("position:absolute;left:50%;top:18px;width:4px;height:80px;margin-left:-2px;background:#ffffff")} />
                  <div style={css("position:absolute;left:50%;top:34px;width:40px;height:2px;margin-left:-20px;background:#ffffff")} />
                  <div style={css("position:absolute;left:50%;top:56px;width:30px;height:2px;margin-left:-15px;background:#ffffff")} />
                  <div style={css("position:absolute;left:50%;top:78px;width:20px;height:2px;margin-left:-10px;background:#ffffff")} />
                  <div style={css("position:absolute;left:50%;top:98px;width:52px;height:3px;margin-left:-26px;background:#ffffff")} />
                  <div style={css("position:absolute;left:50%;top:105px;width:150px;height:1px;margin-left:-75px;background:#3a3a3a")} />
                </div>
  
                <div style={css("display:flex;align-items:center;gap:14px;margin-top:24px")}>
                  <div style={css("width:12px;height:12px;background:#e1232b;animation:sigblink 1.1s steps(1) infinite;flex-shrink:0")} />
                  <div style={css("font-size:clamp(28px,9vw,48px);font-weight:700;letter-spacing:7px;line-height:1")}>THE SIGNAL</div>
                </div>
                <div style={css("font-family:'VT323',monospace;font-size:20px;color:#e1232b;letter-spacing:3px;margin-top:12px")}>{v.levelLabel}</div>
                <div style={css("font-family:'VT323',monospace;font-size:18px;color:#9a9a9a;margin-top:14px;line-height:1.5")}>
                  THE WAR IS OVER. THE FOREST IS DEAD.<br />NO ONE IS COMING.
                </div>
  
                <Btn
                  onClick={v.obNext}
                  base="margin-top:28px;background:#000000;border:2px solid #ffffff;color:#ffffff;font-family:'Silkscreen',monospace;font-size:12px;font-weight:700;letter-spacing:3px;padding:15px 28px;cursor:pointer"
                  hover="background:#ffffff;color:#000000"
                >{v.obTitleBtn}</Btn>
  
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#8a8a8a;margin-top:14px")}>SOUND ON — HEADPHONES ADVISED</div>
  
                <div style={css("display:flex;gap:22px;margin-top:12px")}>
                  <button onClick={v.obMap} style={css("background:none;border:none;color:#8a8a8a;font-family:'VT323',monospace;font-size:17px;letter-spacing:2px;text-decoration:underline;cursor:pointer")}>LEVEL MAP</button>
                  {v.obReplayOn && (
                    <button onClick={v.obReplay} style={css("background:none;border:none;color:#8a8a8a;font-family:'VT323',monospace;font-size:17px;letter-spacing:2px;text-decoration:underline;cursor:pointer")}>REPLAY BRIEFING</button>
                  )}
                  {v.hasSaveUI && (
                    <button onClick={v.newRun} style={css("background:none;border:none;color:#e1232b;font-family:'VT323',monospace;font-size:17px;letter-spacing:2px;text-decoration:underline;cursor:pointer")}>NEW RUN — RESTART LVL</button>
                  )}
                </div>
              </div>
            )}
  
            {/* --- level map --- */}
            {v.obMapOn && (
              <div style={css("display:flex;flex-direction:column;align-items:center")}>
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#8a8a8a;letter-spacing:4px")}>OPERATION MAP // NORTH ROUTE</div>
                <div style={css("position:relative;display:flex;flex-direction:column;gap:8px;margin-top:18px")}>
                  <div style={css("position:absolute;left:19px;top:16px;bottom:16px;width:2px;background:repeating-linear-gradient(180deg,#3a3a3a 0 4px,transparent 4px 9px)")} />
                  {v.levels.map((lv, i) => (
                    <div key={i} onClick={lv.click} style={css(lv.rowStyle)}>
                      <div style={css(lv.nodeStyle)} />
                      <div style={css(lv.numStyle)}>{lv.num}</div>
                      <div style={css(lv.nameStyle)}>{lv.name}</div>
                      <div style={css(lv.statusStyle)}>{lv.status}</div>
                    </div>
                  ))}
                </div>
                <div style={css("font-family:'VT323',monospace;font-size:16px;color:#5a5a5a;margin-top:14px")}>FURTHER SECTORS UNMAPPED — IN DEVELOPMENT</div>
                <Btn
                  onClick={v.obNext}
                  base="margin-top:20px;background:#000000;border:2px solid #ffffff;color:#ffffff;font-family:'Silkscreen',monospace;font-size:11px;font-weight:700;letter-spacing:3px;padding:13px 24px;cursor:pointer"
                  hover="background:#ffffff;color:#000000"
                >{v.obMapBtn}</Btn>
              </div>
            )}
  
            {/* --- story beats --- */}
            {v.obStory && (
              <React.Fragment>
                <div style={css("position:absolute;top:calc(9vh + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(400px, calc(100vw - 48px));display:flex;flex-direction:column;align-items:flex-start;text-align:left")}>

                  <div style={css("height:64px;display:flex;align-items:flex-end;margin-bottom:32px")}>
                    {v.obVis1 && (
                      <div style={css("display:flex;gap:10px;align-items:center")}>
                        <div style={css("width:16px;height:16px;background:#ffffff")} />
                        <div style={css("width:16px;height:16px;background:#ffffff;opacity:0.6")} />
                        <div style={css("width:16px;height:16px;background:#ffffff;opacity:0.3")} />
                        <div style={css("width:16px;height:16px;border:2px solid #ffffff;box-sizing:border-box")} />
                        <div style={css("width:16px;height:16px;border:1px solid #3a3a3a;box-sizing:border-box")} />
                        <div style={css("width:10px;height:10px;background:#e1232b;animation:sigblink 1.1s steps(1) infinite;margin-left:8px")} />
                      </div>
                    )}
                    {v.obVis2 && (
                      <div style={css("display:flex;gap:16px")}>
                        <div style={css("position:relative;width:26px;height:26px;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box")}>
                          <div style={css("position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;background:#e1232b;border-radius:50%")} />
                        </div>
                        <div style={css("position:relative;width:26px;height:26px;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box")}>
                          <div style={css("position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;background:#e1232b;border-radius:50%")} />
                        </div>
                        <div style={css("position:relative;width:26px;height:26px;border:2px solid #ffffff;border-radius:50%;box-sizing:border-box")}>
                          <div style={css("position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;background:#e1232b;border-radius:50%;animation:sigblink 0.6s steps(1) infinite")} />
                        </div>
                      </div>
                    )}
                    {v.obVis3 && (
                      <div style={css("position:relative;width:40px;height:62px")}>
                        <div style={css("position:absolute;left:50%;top:0;width:6px;height:6px;margin-left:-3px;background:#3a3a3a")} />
                        <div style={css("position:absolute;left:50%;top:7px;width:3px;height:46px;margin-left:-1px;background:#ffffff")} />
                        <div style={css("position:absolute;left:50%;top:16px;width:26px;height:2px;margin-left:-13px;background:#ffffff")} />
                        <div style={css("position:absolute;left:50%;top:31px;width:18px;height:2px;margin-left:-9px;background:#ffffff")} />
                        <div style={css("position:absolute;left:50%;top:53px;width:34px;height:3px;margin-left:-17px;background:#ffffff")} />
                      </div>
                    )}
                  </div>

                  <div style={css("font-family:'VT323',monospace;font-size:15px;line-height:1;color:#e1232b;letter-spacing:3px")}>{v.obLabel}</div>

                  <div style={css("font-family:'VT323',monospace;font-size:30px;line-height:1.15;color:#ffffff;margin-top:14px;min-height:69px")}>
                    {v.obText}
                    <span style={css("animation:sigblink 0.8s steps(1) infinite")}>_</span>
                  </div>

                  <div style={css("width:32px;height:2px;background:#3a3a3a;margin:28px 0")} />

                  <div style={css("display:flex;flex-direction:column;gap:6px")}>
                    {v.obBodyLines.map((bl, i) => <div key={i} style={css(bl.style)}>{bl.text}</div>)}
                  </div>
                </div>

                <div style={css("position:absolute;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));width:min(400px, calc(100vw - 48px));display:flex")}>
                  <Btn
                    onClick={v.obNext}
                    base="background:#000000;border:2px solid #ffffff;color:#ffffff;font-family:'Silkscreen',monospace;font-size:11px;font-weight:700;letter-spacing:3px;padding:13px 24px;cursor:pointer"
                    hover="background:#ffffff;color:#000000"
                  >NEXT ▸</Btn>
                </div>
              </React.Fragment>
            )}

            {/* --- field manual / difficulty --- */}
            {v.obControls && (
              <React.Fragment>
                <div style={css("position:absolute;top:calc(9vh + env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:min(400px, calc(100vw - 48px));display:flex;flex-direction:column;align-items:flex-start;text-align:left")}>

                  <div style={css("font-family:'VT323',monospace;font-size:15px;line-height:1;color:#e1232b;letter-spacing:3px")}>FIELD MANUAL</div>

                  <div style={css("font-family:'VT323',monospace;font-size:30px;line-height:1.15;color:#ffffff;margin-top:14px")}>SALVAGE 3 PARTS ▸ REPAIR THE TOWER</div>

                  <div style={css("width:32px;height:2px;background:#3a3a3a;margin:20px 0")} />

                  <div style={css("font-family:'VT323',monospace;font-size:14px;letter-spacing:3px;color:#5a5a5a;margin-bottom:8px")}>CONTROLS</div>
                  {v.isDesktop && (
                    <div style={css("display:grid;grid-template-columns:130px 1fr;row-gap:4px;font-family:'VT323',monospace;font-size:19px;line-height:1.3")}>
                      <div style={css("color:#ffffff")}>WASD</div><div style={css("color:#8a8a8a")}>MOVE</div>
                      <div style={css("color:#ffffff")}>MOUSE</div><div style={css("color:#8a8a8a")}>AIM</div>
                      <div style={css("color:#ffffff")}>CLICK / SPACE</div><div style={css("color:#8a8a8a")}>FIRE</div>
                      <div style={css("color:#ffffff")}>TAB</div><div style={css("color:#8a8a8a")}>MAP</div>
                      <div style={css("color:#ffffff")}>M · R</div><div style={css("color:#8a8a8a")}>SOUND · RETRY</div>
                    </div>
                  )}
                  {v.isTouch && (
                    <div style={css("display:grid;grid-template-columns:130px 1fr;row-gap:4px;font-family:'VT323',monospace;font-size:19px;line-height:1.3")}>
                      <div style={css("color:#ffffff")}>LEFT STICK</div><div style={css("color:#8a8a8a")}>MOVE + AIM</div>
                      <div style={css("color:#ffffff")}>FIRE</div><div style={css("color:#8a8a8a")}>TAP · HOLD = AUTO</div>
                    </div>
                  )}

                  <div style={css("font-family:'VT323',monospace;font-size:14px;letter-spacing:3px;color:#5a5a5a;margin:20px 0 8px")}>RULES</div>
                  <div style={css("display:flex;flex-direction:column;gap:4px;font-family:'VT323',monospace;font-size:19px;line-height:1.3")}>
                    <div style={css("color:#8a8a8a")}>SALVAGING IS LOUD. GREEN BRUSH HIDES YOU.</div>
                    <div style={css("color:#8a8a8a")}>EVERY 3 KILLS ▸ TRI-SHOT FOR 5 SECONDS.</div>
                    <div style={css("color:#e1232b")}>RED CONES SEE YOU. GUNFIRE CARRIES.</div>
                  </div>

                  <div style={css("font-family:'VT323',monospace;font-size:14px;letter-spacing:3px;color:#5a5a5a;margin:20px 0 10px")}>DIFFICULTY</div>
                  <div style={css("display:flex;gap:10px")}>
                    <button onClick={v.setRecruit} style={css(v.recruitStyle)}>RECRUIT</button>
                    <button onClick={v.setVeteran} style={css(v.veteranStyle)}>VETERAN</button>
                  </div>
                  <div style={css("font-family:'VT323',monospace;font-size:17px;color:#5a5a5a;margin-top:8px")}>{v.diffDesc}</div>
                </div>

                <div style={css("position:absolute;left:50%;transform:translateX(-50%);bottom:calc(76px + env(safe-area-inset-bottom));width:min(400px, calc(100vw - 48px));display:flex")}>
                  <Btn
                    onClick={v.startGame}
                    base="background:#ffffff;border:2px solid #ffffff;color:#000000;font-family:'Silkscreen',monospace;font-size:11px;font-weight:700;letter-spacing:3px;padding:13px 24px;cursor:pointer"
                    hover="background:#000000;color:#ffffff"
                  >START MISSION ▸</Btn>
                </div>
              </React.Fragment>
            )}

            {v.obTitle && (
              <div style={css("position:absolute;bottom:calc(12px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;font-family:'VT323',monospace;font-size:15px;color:#5a5a5a;letter-spacing:2px")}>A GAME BY {v.creatorName}</div>
            )}
  
            {v.obDotsOn && (
              <div style={css("position:absolute;bottom:calc(38px + env(safe-area-inset-bottom));left:0;right:0;display:flex;justify-content:center;gap:9px")}>
                {v.obDots.map((d, i) => <div key={i} style={css(d.style)} />)}
              </div>
            )}
          </div>
        )}
  
        {/* ---------- LANDSCAPE BLOCK ---------- */}
        {v.landscapeBlock && (
          <div style={css("position:absolute;inset:0;background:#000000;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px")}>
            <div style={css("width:22px;height:36px;border:2px solid #ffffff")} />
            <div style={css("font-size:11px;letter-spacing:3px")}>ROTATE DEVICE</div>
            <div style={css("font-family:'VT323',monospace;font-size:17px;color:#8a8a8a")}>PORTRAIT ONLY</div>
          </div>
        )}
      </div>
    );
  }
}

export const TWEAKS = {
  creatorName: 'ASHLEN SINGH',
  controls:    'auto',
  enemyStyle:  'solid silhouette',
  aimAssist:   0.5,
  screenShake: true,
};

export default Signal;