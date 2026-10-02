'use strict';
/* =========================================================
   NO MAN'S WEATHER — Exosuit Atmospheric Interface v1.0
   Fan-made weather app. Data: Open-Meteo + NWS alerts.
   ========================================================= */
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const LS = {
  get(k, d) { try { const v = localStorage.getItem('nmw_' + k); return v != null ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('nmw_' + k, JSON.stringify(v)); } catch (e) {} }
};
const settings = Object.assign({ auto: true, units: 'F', sound: true, ambient: true, fx: true, manual: null }, LS.get('settings', {}));
const saveSettings = () => LS.set('settings', settings);
const CFG_DEF = { drones: true, droneCount: 2, attack: 'rare', aggro: 'normal', tough: 'normal', scanTrav: 'some', reinforce: 'normal',
  tScan: 'normal', tMine: 'normal', tMineSpd: 'normal', tFire: 'normal', tAim: 'normal', tWalk: 'normal', tHop: 'normal', suit: 'orange', orb: true, ship: true, sFreq: 'some', sPasses: 'medium', sFight: 'some', sMax: 0 };
settings.cfg = Object.assign({}, CFG_DEF, settings.cfg || {});
const CF = () => settings.cfg;
const CFV = {
  attack: { never: null, rare: [300, 600], some: [120, 240], often: [45, 90], chaos: [15, 30] },
  aggro: { docile: { cd: [2.2, 3.5], sp: 22 }, normal: { cd: [1.1, 2], sp: 30 }, aggressive: { cd: [.6, 1.1], sp: 38 }, relentless: { cd: [.3, .6], sp: 46 } },
  tough: { fragile: 3, normal: 6, armored: 10, tank: 16 },
  scanTrav: { never: 0, rarely: .08, some: .22, often: .45 },
  reinforce: { fast: [8, 15], normal: [25, 45], slow: [60, 120] },
  tScan: { rare: .35, normal: 1, often: 2.2, constant: 6 },
  tMine: { off: 0, rarely: .3, normal: .85, always: 1 },
  tMineSpd: { slow: .15, normal: .3, fast: .7 },
  tFire: { slow: [.6, .9], normal: [.28, .45], rapid: [.12, .2] },
  tAim: { wild: 13, normal: 7, sniper: 1.5 },
  tWalk: { stroll: .6, normal: 1, jog: 1.6 },
  tHop: { off: null, rare: [25, 45], normal: [9, 16], often: [3, 6] },
  sFreq: { never: null, rare: [360, 720], some: [150, 300], often: [60, 120], always: [12, 25] },
  sPasses: { short: 1, medium: 3, long: 5, epic: 8 },
  sFight: { off: 0, rare: .2, some: .5, always: 1 },
  suit: { orange: ['#e0782a', '#a04c1a', '#ffa45a'], white: ['#e8e6de', '#a3a39c', '#ffffff'], red: ['#c83a2e', '#7e2018', '#f06a5a'], green: ['#5aa04a', '#346a2a', '#8ad070'], purple: ['#8a5ac8', '#583a88', '#b48af0'], black: ['#3a3c44', '#22232a', '#5e6270'], gold: ['#d8a43a', '#8a6420', '#ffd27a'] }
};
document.addEventListener('touchstart', () => {}, { passive: true }); // enables :active on iOS
document.addEventListener('gesturestart', e => e.preventDefault());

/* ---------- colour + noise helpers ---------- */
const hex2rgb = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const rgb2hex = c => '#' + c.map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mix = (a, b, t) => rgb2hex(mixRGB(hex2rgb(a), hex2rgb(b), t));
const rgba = (h, a) => { const c = hex2rgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = xf * xf * (3 - 2 * xf), u = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * s + (c - a) * u + (a - b - c + d) * s * u;
}
const fbm = (x, y) => vnoise(x, y) * .6 + vnoise(x * 2.1, y * 2.1 + 7) * .28 + vnoise(x * 4.3, y * 4.3 + 19) * .12;

/* ---------- weather tables ---------- */
const WMO = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Heavy freezing drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains', 80: 'Rain showers', 81: 'Heavy rain showers', 82: 'Violent rain showers', 85: 'Snow showers', 86: 'Heavy snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail' };

const WX = {
  clear:   { label: 'Clear Skies', biome: 'Paradise Planet', hz: 100, amb: 'none', flav: ['Optimal conditions. Even the Sentinels are taking a nap.', 'Perfect weather to name a rock after yourself.', 'Zero hazards detected. Suspicious, honestly.'] },
  partly:  { label: 'Partly Cloudy', biome: 'Lush Planet', hz: 96, amb: 'breeze', flav: ['A few clouds loitering. They have not paid rent.', 'Pleasant. Your exosuit is bored.'] },
  cloudy:  { label: 'Overcast', biome: 'Grey Planet', hz: 90, amb: 'breeze', flav: ['The sky has been set to "Windows 95 grey".', 'Overcast. The sun is in another castle.'] },
  fog:     { label: 'Dense Fog', biome: 'Murky Planet', hz: 75, amb: 'fog', flav: ['Visibility compromised. Was that a Sentinel or a mailbox?', 'Fog detected. Scanner sees nothing. Neither do you.'] },
  drizzle: { label: 'Drizzle', biome: 'Humid Planet', hz: 82, amb: 'drizzle', flav: ['The sky is lightly misting you, passive-aggressively.', 'Drizzle: rain that cannot commit.'] },
  rain:    { label: 'Rain', biome: 'Drenched Planet', hz: 65, amb: 'rain', flav: ['Umbrella deployed. Exosuit waterproofing: mostly.', 'Rain detected. Puddles are now hostile terrain.'] },
  storm:   { label: 'Thunderstorm', biome: 'Superchanged Planet', hz: 30, amb: 'storm', extreme: 'ELECTRICAL STORM — SEEK SHELTER', flav: ['Lightning detected. Do NOT hold your multi-tool up to the sky.', 'The sky is doing a boss fight.'] },
  snow:    { label: 'Snow', biome: 'Frozen Planet', hz: 55, amb: 'snow', flav: ['Snow detected. Thermal protection engaged. Hot cocoa recommended.', 'Frozen precipitation. Snow angels authorized.'] },
  sleet:   { label: 'Sleet / Freezing Rain', biome: 'Glacial Planet', hz: 40, amb: 'rain', extreme: 'FREEZING PRECIPITATION', flav: ['Sleet: the worst of both worlds, delivered to your face.', 'Ice rain detected. Walk like a penguin.'] },
  hail:    { label: 'Hailstorm', biome: 'Bombarded Planet', hz: 25, amb: 'storm', extreme: 'HAILSTORM — PROTECT YOUR SHIP', flav: ['The sky is throwing ice cubes. Hard.', 'Hail detected. Your ship\'s paint job is in danger.'] },
  heat:    { label: 'Hot', biome: 'Scorched Planet', hz: 50, amb: 'heat', flav: ['High temperature. Hydrate or die-drate.', 'Your exosuit is sweating. Exosuits should not sweat.'] },
  fire:    { label: 'Extreme Heat', biome: 'Infernal Planet', hz: 12, amb: 'fire', extreme: 'EXTREME HEAT — FIRESTORM CONDITIONS', flav: ['Extreme heat. The ground is now a stovetop.', 'Thermal shields screaming. Stay indoors, Traveller.'] },
  cold:    { label: 'Frigid', biome: 'Frozen Wasteland', hz: 38, amb: 'wind', flav: ['Frigid temps. Your nose has filed a complaint.', 'Cold enough to freeze your Nanites.'] },
  wind:    { label: 'High Winds', biome: 'Windswept Planet', hz: 52, amb: 'wind', extreme: 'HIGH WIND WARNING', flav: ['Hold onto your helmet. Literally.', 'Gusts detected. Small fauna may become airborne.'] },
  tornado: { label: 'Tornado Warning', biome: 'Cyclonic Planet', hz: 4, amb: 'tornado', extreme: 'TORNADO WARNING — TAKE SHELTER NOW', flav: ['This is not a drill or a game. Get to your lowest interior room NOW.', 'Real tornado warning in effect. Shelter immediately.'] }
};
const SIM_ORDER = ['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'storm', 'hail', 'snow', 'sleet', 'cold', 'heat', 'fire', 'wind', 'tornado'];

const PAL = {
  clear:   { sky: ['#1d5fd0', '#6cb8ff', '#ffe2a0'], far: '#4f8f7a', near: '#2e6a45', ground: '#1d4a2e', flora: 'lush' },
  partly:  { sky: ['#2d68c8', '#86baf0', '#f3e1b8'], far: '#4f8a78', near: '#2f6646', ground: '#1e472d', flora: 'lush' },
  cloudy:  { sky: ['#4a5566', '#7a8494', '#a7adb5'], far: '#55665e', near: '#3c4a40', ground: '#2b362e', flora: 'lush' },
  fog:     { sky: ['#7c8590', '#a3aab2', '#c4c8cc'], far: '#8a9290', near: '#5c6660', ground: '#3e4642', flora: 'dead' },
  drizzle: { sky: ['#465a70', '#71849a', '#9aa8b4'], far: '#4c6a5c', near: '#30503e', ground: '#20382a', flora: 'lush' },
  rain:    { sky: ['#27384d', '#4a5e75', '#71849a'], far: '#3e5a50', near: '#2a4236', ground: '#1c2e25', flora: 'lush' },
  storm:   { sky: ['#120f24', '#2b2546', '#4a3f66'], far: '#2c3540', near: '#1c242c', ground: '#12181e', flora: 'dead' },
  snow:    { sky: ['#8aa0c0', '#c3d3e8', '#eef4ff'], far: '#c8d8ec', near: '#e2ecf8', ground: '#eef4fc', flora: 'ice' },
  sleet:   { sky: ['#5b6c82', '#8c9cb0', '#bac6d4'], far: '#9fb0c4', near: '#c4d0dc', ground: '#d4dee8', flora: 'ice' },
  hail:    { sky: ['#2a3040', '#4d5568', '#7a8296'], far: '#5a6470', near: '#3e4650', ground: '#2c3238', flora: 'dead' },
  heat:    { sky: ['#e07b2a', '#f6b04a', '#ffe08a'], far: '#c88a4a', near: '#a0612e', ground: '#7a4420', flora: 'desert' },
  fire:    { sky: ['#3a0a0a', '#9a1f0c', '#ff6a1a'], far: '#5a1c10', near: '#3a120a', ground: '#200806', flora: 'burnt' },
  cold:    { sky: ['#3a6ab0', '#8ec0ee', '#dff2ff'], far: '#b8d4ee', near: '#d6e6f6', ground: '#e8f2fc', flora: 'ice' },
  wind:    { sky: ['#4f7fae', '#8fb6d8', '#d6e4ea'], far: '#7a9a6a', near: '#5a7a48', ground: '#3c5530', flora: 'grass' },
  tornado: { sky: ['#1d2a1e', '#3d5a3a', '#7a8f5a'], far: '#2c3a2a', near: '#1e2a1c', ground: '#121a10', flora: 'dead' }
};
const PLANET = { // ocean, shore, land, peak, atmosphere
  clear: ['#1f4fbf', '#e3d18a', '#3caa5a', '#e8f4ff', '#8fd0ff'], partly: ['#1f4fbf', '#e3d18a', '#3caa5a', '#e8f4ff', '#8fd0ff'],
  cloudy: ['#4a5a7a', '#8a8a7a', '#6a7a6a', '#d0d0d0', '#b0b8c8'], fog: ['#7a8090', '#9aa0a0', '#b0b4b0', '#e0e0e0', '#d0d4d8'],
  drizzle: ['#1a3a8a', '#3a6a9a', '#2f7a7a', '#bfe0ff', '#6aa0e0'], rain: ['#1a3a8a', '#3a6a9a', '#2f7a7a', '#bfe0ff', '#6aa0e0'],
  storm: ['#2a1a5a', '#5a2a8a', '#8a3ab0', '#e0b0ff', '#b070ff'], snow: ['#8ab0e0', '#d0e4f8', '#f4f8ff', '#ffffff', '#cfe8ff'],
  sleet: ['#7a9cc8', '#c0d4ea', '#e4eef8', '#ffffff', '#bcd8f4'], cold: ['#6a98d8', '#d0e4f8', '#f4f8ff', '#ffffff', '#a8d8ff'],
  hail: ['#4a5070', '#7a80a0', '#a0a8c0', '#e0e4f0', '#a0b0d0'], heat: ['#c08020', '#e0b040', '#f0d070', '#fff0b0', '#ffd080'],
  fire: ['#3a0a05', '#a02008', '#ff5a10', '#ffd040', '#ff6020'], wind: ['#2a6aa0', '#c0c890', '#6a9a5a', '#e8f0f0', '#a0d0e8'],
  tornado: ['#2a3a2a', '#5a6a3a', '#7a8a4a', '#c0c8a0', '#9ab070']
};
const CLOUDCFG = {
  clear: [1, '#ffffff', '#d8e4f0', '#ffffff'], partly: [3, '#f4f7fb', '#c3ccd8', '#ffffff'], cloudy: [6, '#aab3be', '#7d8794', '#c9d0d8'],
  fog: [3, '#bfc5cc', '#9aa2ab', '#d7dbe0'], drizzle: [5, '#9aa5b2', '#6f7a88', '#b7c0ca'], rain: [6, '#6f7b8b', '#4a5462', '#8e98a6'],
  storm: [7, '#3d3656', '#262238', '#5a5078'], snow: [5, '#d9e2ee', '#aab8ca', '#f2f6fb'], sleet: [6, '#9ba8b8', '#717e90', '#bcc6d2'],
  hail: [7, '#4f566a', '#323848', '#6d7488'], tornado: [8, '#3c4a3a', '#232c22', '#566a52'], wind: [4, '#eef3f7', '#c1ccd6', '#ffffff'],
  heat: [1, '#ffe2b0', '#f2b880', '#fff0d0'], fire: [5, '#4a2a24', '#2a1410', '#6a3a30'], cold: [1, '#e8f2ff', '#b8cce0', '#ffffff']
};

function codeType(c) {
  if (c === 0) return 'clear'; if (c <= 2) return 'partly'; if (c === 3) return 'cloudy';
  if (c === 45 || c === 48) return 'fog'; if (c >= 51 && c <= 55) return 'drizzle';
  if (c === 56 || c === 57 || c === 66 || c === 67) return 'sleet';
  if ((c >= 61 && c <= 65) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c === 95) return 'storm'; if (c === 96 || c === 99) return 'hail';
  return 'cloudy';
}
function classify(code, tF, gust, tornado) {
  if (tornado) return 'tornado';
  const t = codeType(code);
  if (t === 'clear' || t === 'partly' || t === 'cloudy') {
    if (tF >= 105) return 'fire'; if (tF >= 92) return 'heat'; if (tF <= 25) return 'cold'; if (gust >= 40) return 'wind';
  }
  return t;
}
const intensityFor = c => ({ 51: .3, 53: .5, 55: .8, 56: .5, 57: .8, 61: .35, 63: .65, 65: 1, 66: .6, 67: 1, 71: .35, 73: .65, 75: 1, 77: .4, 80: .5, 81: .8, 82: 1, 85: .5, 86: .9 })[c] ?? .6;

/* =========================================================
   AUDIO — all sounds synthesized live (works offline)
   ========================================================= */
const Sfx = (() => {
  let ctx, master, ambGain, ambSrc, ambFilter, lfo, lfoGain, noiseBuf;
  const AMB = {
    none: { f: 'lowpass', freq: 300, vol: 0 }, breeze: { f: 'lowpass', freq: 500, vol: .025, lfo: 120 },
    fog: { f: 'lowpass', freq: 350, vol: .03 }, drizzle: { f: 'bandpass', freq: 3200, vol: .045, q: .5 },
    rain: { f: 'bandpass', freq: 1800, vol: .1, q: .4 }, storm: { f: 'bandpass', freq: 1200, vol: .15, q: .35 },
    snow: { f: 'lowpass', freq: 420, vol: .035, lfo: 150 }, wind: { f: 'bandpass', freq: 520, vol: .12, q: 1.4, lfo: 280 },
    heat: { f: 'highpass', freq: 6000, vol: .012 }, fire: { f: 'lowpass', freq: 900, vol: .08, lfo: 200 },
    tornado: { f: 'lowpass', freq: 420, vol: .24, lfo: 220 }
  };
  let curAmb = 'none';
  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = .55; master.connect(ctx.destination);
    ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const resume = () => { if (ctx && ctx.state !== 'running') ctx.resume(); };
  const on = () => ctx && settings.sound;
  function tone(freq, dur, type = 'square', vol = .12, slide = null, delay = 0) {
    if (!on()) return; const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .03);
  }
  function noise(dur, vol = .3, ft = 'lowpass', freq = 800, delay = 0, q = 1) {
    if (!on()) return; const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = ft; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  function setAmbient(type) {
    curAmb = type || curAmb; if (!ctx) return;
    if (!ambSrc) {
      ambSrc = ctx.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
      ambFilter = ctx.createBiquadFilter(); ambSrc.connect(ambFilter); ambFilter.connect(ambGain); ambSrc.start();
      lfo = ctx.createOscillator(); lfo.frequency.value = .17; lfoGain = ctx.createGain(); lfoGain.gain.value = 0;
      lfo.connect(lfoGain); lfoGain.connect(ambFilter.frequency); lfo.start();
    }
    const p = AMB[curAmb] || AMB.none, t = ctx.currentTime;
    ambFilter.type = p.f; ambFilter.frequency.setTargetAtTime(p.freq, t, .4); ambFilter.Q.value = p.q || .7;
    lfoGain.gain.setTargetAtTime(p.lfo || 0, t, .4);
    ambGain.gain.setTargetAtTime((settings.sound && settings.ambient) ? p.vol : 0, t, .6);
  }
  return {
    init, resume, setAmbient,
    blip() { tone(880, .05, 'square', .06); tone(1320, .05, 'square', .05, null, .045); },
    toggle(b) { tone(b ? 620 : 420, .09, 'square', .07, b ? 1040 : 260); },
    boot() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .28, 'triangle', .11, null, i * .09)); tone(1046, .9, 'sine', .1, null, .6); noise(1.2, .06, 'bandpass', 2200, 0, 2); },
    scan() { tone(180, .7, 'sawtooth', .05, 1700); tone(360, .7, 'sine', .07, 3400, .05); noise(.7, .05, 'bandpass', 3000, 0, 3); },
    done() { tone(988, .08, 'square', .06); tone(1319, .16, 'square', .06, null, .08); },
    error() { tone(220, .2, 'square', .09, 110); tone(160, .3, 'square', .09, 80, .16); },
    thunder(big) { noise(big ? 3 : 2.2, big ? .7 : .5, 'lowpass', 260); noise(.35, .35, 'lowpass', 1600); tone(48, 1.6, 'sine', .3, 28); },
    whoosh() { noise(.8, .16, 'bandpass', 700, 0, .8); tone(300, .5, 'sine', .05, 900); },
    crackle() { noise(.03 + Math.random() * .05, .12 + Math.random() * .1, 'highpass', 2500 + Math.random() * 3000); },
    tick() { tone(2400 + Math.random() * 1600, .025, 'square', .03); },
    alarm() { for (let i = 0; i < 3; i++) { tone(880, .18, 'square', .08, null, i * .42); tone(660, .18, 'square', .08, null, i * .42 + .2); } },
    discover() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, .22, 'triangle', .1, null, i * .07)); tone(1568, .6, 'sine', .07, null, .38); },
    jet() { noise(.5, .05, 'bandpass', 900, 0, 1.5); },
    pscan() { tone(1200, .5, 'sine', .025, 2400); },
    zap() { tone(rnd(140, 180), .13, 'sawtooth', .022, rnd(110, 130)); },
    sentinel() { tone(520, .14, 'square', .035); tone(390, .2, 'square', .035, null, .15); },
    takeoff() { noise(2.4, .14, 'lowpass', 600); tone(90, 2.4, 'sawtooth', .05, 320); },
    boost() { noise(1, .18, 'bandpass', 900, 0, 1); tone(200, .9, 'sawtooth', .05, 900); },
    flyby() { noise(1.2, .1, 'bandpass', 1200, 0, 1.2); tone(500, 1.2, 'sine', .04, 180); },
    sgun() { tone(2000, .07, 'square', .03, 900); tone(1700, .07, 'square', .025, 700, .03); },
    land() { noise(2, .12, 'lowpass', 500); tone(300, 2, 'sawtooth', .04, 80); },
    canopy() { tone(400, .12, 'square', .04, 700); tone(700, .1, 'square', .04, null, .12); },
    pew() { tone(1500, .09, 'square', .03, 500); },
    dlaser() { tone(900, .25, 'sawtooth', .035, 200); },
    hit() { noise(.08, .1, 'bandpass', 2500, 0, 2); },
    shield() { tone(1800, .12, 'sine', .05, 2600); },
    boom() { noise(1.4, .6, 'lowpass', 500); noise(.3, .4, 'bandpass', 1500, 0, 1); tone(70, 1, 'sine', .3, 30); },
    hostile() { for (let i = 0; i < 4; i++) { tone(740, .1, 'square', .06, null, i * .22); tone(554, .1, 'square', .06, null, i * .22 + .11); } },
    victory() { [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, .14, 'square', .06, null, i * .1)); },
    collect() { [784, 988, 1318].forEach((f, i) => tone(f, .09, 'square', .045, null, i * .06)); }
  };
})();

/* =========================================================
   PIXEL WEATHER ICONS (16x16, animated)
   ========================================================= */
const CLOUD = [
  '....aaaa........',
  '..aabbbbaa.aaa..',
  '.abbbbbbbbabbba.',
  'abbbbbbbbbbbbbba',
  'abbbbbbbbbbbbbba',
  '.cccccccccccccc.'];
function drawIcon(c, type, night, t) {
  c.clearRect(0, 0, 16, 16);
  const R = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
  const disc = (cx, cy, r, col, edge) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d <= r * r + r * .8) R(cx + x, cy + y, 1, 1, edge && d > (r - 1) * (r - 1) + (r - 1) * .8 ? edge : col); } };
  const sun = (cx, cy, r, col, ray) => { disc(cx, cy, r, col, ray); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * .9, rr = r + 2 + ((i + Math.floor(t * 6)) % 2); R(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1, 1, ray); } };
  const moon = (cx, cy, r) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * .8 && ((x - 2) * (x - 2) + (y + 1) * (y + 1)) > r * r * .75) R(cx + x, cy + y, 1, 1, '#f4eecb'); if (Math.floor(t * 3) % 2) R(14, 2, 1, 1, '#fff'); R(1, 13, 1, 1, '#aab'); };
  const cloud = (ox, oy, b, s, h) => { for (let j = 0; j < CLOUD.length; j++) { const row = CLOUD[j]; for (let i = 0; i < 16; i++) { const ch = row[i]; if (ch !== '.') R(ox + i, oy + j, 1, 1, ch === 'a' ? h : ch === 'b' ? b : s); } } };
  const drops = (n, col, speed, len) => { for (let k = 0; k < n; k++) { const x = 2 + k * (11 / (n - 1)); const y = 8 + ((t * speed + k * 2.3) % 7); R(x - (y - 8) * .3, y, 1, len, col); } };
  const L = '#e8edf3', M = '#b9c2cc', D = '#7d8894', DM = '#5c6577', DD = '#3a4150', DL = '#8a93a3';
  switch (type) {
    case 'clear': night ? moon(8, 8, 5) : sun(8, 8, 4, '#ffd23f', '#ff9a1f'); break;
    case 'partly': night ? moon(6, 6, 4) : sun(6, 6, 3, '#ffd23f', '#ff9a1f'); cloud(1 + Math.sin(t) * .6, 8, L, D, '#fff'); break;
    case 'cloudy': cloud(-2 + Math.sin(t * .8), 2, M, DD, L); cloud(1 + Math.sin(t * .8 + 2), 8, L, D, '#fff'); break;
    case 'fog': for (let k = 0; k < 5; k++) R(1 + Math.sin(t * 2 + k) * 2, 3 + k * 2.6, 14, 1, k % 2 ? '#c9d0d8' : '#9aa3ad'); break;
    case 'drizzle': cloud(0, 2, L, D, '#fff'); drops(4, '#7fc8ff', 8, 1); break;
    case 'rain': cloud(0, 2, M, DD, L); drops(5, '#4fb0ff', 14, 2); break;
    case 'storm': cloud(0, 1, DM, DD, DL); drops(4, '#4fb0ff', 16, 2);
      if ((t * 2.5) % 1 < .45) { const Y = '#ffe14a'; R(8, 7, 2, 1, Y); R(7, 8, 2, 1, Y); R(6, 9, 3, 1, Y); R(8, 10, 2, 1, Y); R(7, 11, 2, 1, Y); R(7, 12, 1, 2, '#fff6b0'); } break;
    case 'snow': cloud(0, 2, L, M, '#fff'); for (let k = 0; k < 5; k++) R(2 + k * 3 + Math.sin(t * 3 + k), 9 + ((t * 4 + k * 1.7) % 7), 1, 1, '#fff'); break;
    case 'sleet': cloud(0, 2, M, D, L); for (let k = 0; k < 6; k++) { const x = 2 + k * 2.4, y = 9 + ((t * 12 + k * 2) % 7); k % 2 ? R(x, y, 1, 2, '#7fc8ff') : R(x, y, 1, 1, '#fff'); } break;
    case 'hail': cloud(0, 1, DM, DD, DL); for (let k = 0; k < 4; k++) R(2 + k * 3.5, 9 + ((t * 14 + k * 2.7) % 6), 2, 2, '#eef6ff'); break;
    case 'heat': sun(8, 6, 4, '#ffb030', '#ff6a1a'); for (let k = 0; k < 2; k++) for (let x = 2; x < 14; x++) R(x, 12 + k * 3 + Math.round(Math.sin(x * .9 + t * 6 + k * 2)), 1, 1, k ? '#ff6a1a' : '#ffb030'); break;
    case 'fire': for (let x = 2; x < 14; x++) { const h = Math.max(2, Math.round(8 - Math.abs(x - 7.5) * .9 + Math.sin(x * 1.7 + t * 12) * 1.5 + Math.sin(x * .7 - t * 7))); for (let y = 0; y < h + 3; y++) { const f = y / (h + 3); R(x, 15 - y, 1, 1, f < .3 ? '#fff2a0' : f < .55 ? '#ffb020' : f < .82 ? '#ff5a10' : '#b01a08'); } }
      R(4 + (Math.floor(t * 9) % 8), 3 + (Math.floor(t * 13) % 3), 1, 1, '#ffd040'); break;
    case 'cold': { const C = (Math.floor(t * 4) % 2) ? '#bff4ff' : '#7fe0ff'; for (let i = -6; i <= 6; i++) { R(8 + i, 8, 1, 1, C); R(8, 8 + i, 1, 1, C); } for (let i = -4; i <= 4; i++) { R(8 + i, 8 + i, 1, 1, C); R(8 + i, 8 - i, 1, 1, C); } [[2, 8], [14, 8], [8, 2], [8, 14]].forEach(([x, y]) => { R(x - 1, y, 3, 1, '#fff'); R(x, y - 1, 1, 3, '#fff'); }); R(8, 8, 1, 1, '#fff'); break; }
    case 'wind': for (let k = 0; k < 3; k++) { const y = 4 + k * 4, len = 10 - k * 2, x = ((t * 16 + k * 5) % 20) - 4; R(x, y, len, 1, '#dfe8ef'); R(x + len, y - 1, 1, 1, '#dfe8ef'); R(x + len - 1, y - 2, 1, 1, '#dfe8ef'); } break;
    case 'tornado': for (let j = 0; j < 12; j++) { const w = 13 - j; R(8 - w / 2 + Math.sin(t * 6 + j * .6) * 1.5, 2 + j, w, 1, j % 2 ? '#8a9488' : '#a6b0a2'); } R(3 + Math.sin(t * 8) * 3 + 3, 10 + Math.cos(t * 8) * 2, 1, 1, '#5a4a38'); break;
  }
}

/* =========================================================
   THE 3D-ISH PIXEL WORLD
   ========================================================= */
const Scene = (() => {
  const cv = $('#scene'), g = cv.getContext('2d');
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let W = 180, H = 390, HY = 140, P = PAL.clear;
  let type = 'clear', night = true, inten = .6, windMph = 6, tempF = 65, uv = 0;
  let skyC, terrC, fogC, frostC, buf, bx;
  const planetC = mk(64, 64), pc = planetC.getContext('2d');
  let T = 0, last = 0, frame = 0, shake = 0, flash = 0, bolt = null, nextBolt = 2, nextShip = 1.2, nextShoot = 3, hop = -1, nextHop = 5,
    breath = 0, beam = -1, nextBeam = 7, protA = 0, tornadoX = 60, fresh = true, nextFreighter = 6;
  let stars = [], farY = [], nearY = [], flora = [], clouds = [], ships = [], trail = [], fx = [], drones = [], shooting = null, freighter = null;
  const parts = {};
  const seed = Math.floor(Math.random() * 500);
  let listener = null, onFrame = null;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const nc = c => night ? mix(c, '#0a0c22', .45) : c;
  const wetT = () => ['drizzle', 'rain', 'storm', 'sleet', 'hail'].includes(type);
  const coldT = () => ['cold', 'snow', 'sleet'].includes(type);

  function computePal() {
    const p = PAL[type];
    if (!night) { P = p; return; }
    const N = ['#02030c', '#0a0e2c', '#221a4a'], k = type === 'fire' ? .4 : .74;
    P = { sky: p.sky.map((c, i) => mix(c, N[i], k)), far: mix(p.far, '#0b0d1c', .55), near: mix(p.near, '#06070f', .6), ground: mix(p.ground, '#040509', .6), flora: p.flora };
  }
  function buildSky() {
    skyC = mk(W, H); const c = skyC.getContext('2d'), id = c.createImageData(W, H), d = id.data;
    const s = P.sky.map(hex2rgb), B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], L = 12;
    const col = q => q < .5 ? mixRGB(s[0], s[1], q * 2) : mixRGB(s[1], s[2], (q - .5) * 2);
    for (let y = 0; y < H; y++) {
      const f = Math.min(1, y / (HY + 2)) * L, lo = Math.floor(f), fr = (f - lo) * 16;
      const c0 = col(lo / L), c1 = col(Math.min(L, lo + 1) / L);
      for (let x = 0; x < W; x++) { const cc = fr > B[(y & 3) * 4 + (x & 3)] ? c1 : c0, i = (y * W + x) * 4; d[i] = cc[0]; d[i + 1] = cc[1]; d[i + 2] = cc[2]; d[i + 3] = 255; }
    }
    c.putImageData(id, 0, 0);
  }
  function buildTerrain() {
    terrC = mk(W, H); const c = terrC.getContext('2d'), r = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
    const ice = P.flora === 'ice';
    for (let x = 0; x < W; x++) { farY[x] = Math.round(HY - 5 - fbm(x * .03 + seed, 1.5) * 26); nearY[x] = Math.round(HY + 3 - fbm(x * .06 + seed * 2, 4.5) * 12); }
    for (let x = 0; x < W; x++) {
      r(x, farY[x], 1, H, P.far); r(x, farY[x], 1, 1, mix(P.far, '#ffffff', ice ? .7 : .2));
      if (ice) r(x, farY[x] + 1, 1, 2, mix(P.far, '#ffffff', .5));
      // ridge shading for 3D feel
      if (x > 0 && farY[x] > farY[x - 1]) r(x, farY[x], 1, 4, mix(P.far, '#000000', .18));
    }
    c.fillStyle = rgba(P.sky[2], .22); c.fillRect(0, HY - 34, W, 44);
    for (let x = 0; x < W; x++) {
      r(x, nearY[x], 1, H, P.near); r(x, nearY[x], 1, 1, mix(P.near, '#ffffff', ice ? .6 : .22));
      if (x > 0 && nearY[x] > nearY[x - 1]) r(x, nearY[x], 1, 3, mix(P.near, '#000000', .2));
    }
    const gy = HY + 9;
    for (let y = gy; y < H; y++) { const band = Math.floor(Math.log2(y - HY) * 3) % 2; r(0, y, W, 1, band ? P.ground : mix(P.ground, '#000000', P.flora === 'ice' ? .05 : .12)); }
    c.globalAlpha = .09; c.strokeStyle = '#ffffff'; c.lineWidth = 1;
    for (let i = -12; i <= 12; i++) { c.beginPath(); c.moveTo(W / 2 + i * 4, gy); c.lineTo(W / 2 + i * 44, H); c.stroke(); }
    c.globalAlpha = 1;
    for (let i = 0; i < 46; i++) {
      const y = Math.floor(rnd(gy + 2, H)), x = Math.floor(rnd(0, W)), sz = Math.max(1, Math.round((y - HY) / 22));
      r(x, y, sz + 1, sz, mix(P.ground, '#000000', .35)); r(x, y, sz, 1, mix(P.ground, '#ffffff', .2));
    }
  }
  function makeStars() { stars = []; for (let i = 0; i < 120; i++) stars.push({ x: Math.random() * W, y: Math.random() * HY * 1.05, b: Math.random(), p: Math.random() * 6 }); }
  function makeFlora() {
    flora = [];
    for (let i = 0; i < 10; i++) {
      let x = Math.floor(rnd(3, W - 3)); const front = i > 6;
      if (front && Math.abs(x - W * .74) < 20) x = (x + 50) % W;
      flora.push({ x, y: front ? Math.round(rnd(HY + 16, HY + 44)) : nearY[x] + 1, s: front ? 2 : 1, k: Math.random(), ph: rnd(0, 6) });
    }
    flora.sort((a, b) => a.y - b.y);
  }
  function makeCloudSprite(w, h, base, shade, hi) {
    const c = mk(w, h), x = c.getContext('2d'), blobs = [], n = 3 + Math.floor(w / 9);
    for (let i = 0; i < n; i++) blobs.push([rnd(h * .5, w - h * .5), rnd(h * .45, h * .72), rnd(h * .28, h * .5)]);
    const ins = (px, py) => py <= h * .82 && blobs.some(b => (px - b[0]) ** 2 + (py - b[1]) ** 2 <= b[2] * b[2]);
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      if (!ins(px, py)) continue;
      x.fillStyle = !ins(px, py - 1) ? hi : py > h * .66 ? shade : ((px + py) % 2 && py > h * .58) ? shade : base;
      x.fillRect(px, py, 1, 1);
    }
    return c;
  }
  function makeClouds() {
    clouds = []; const cfg = CLOUDCFG[type] || CLOUDCFG.clear;
    const cols = cfg.slice(1).map(c => night ? mix(c, '#141832', .55) : c);
    for (let i = 0; i < cfg[0]; i++) {
      const w = Math.round(rnd(30, 64)), h = Math.round(w * rnd(.34, .45)), d = rnd(.4, 1);
      clouds.push({ x: rnd(-w, W), y: rnd(H * .03, type === 'storm' || type === 'tornado' ? H * .14 : H * .26), d, spr: makeCloudSprite(w, h, ...cols) });
    }
    clouds.sort((a, b) => a.d - b.d);
  }
  function buildFog() {
    fogC = mk(W, 28); const c = fogC.getContext('2d'), id = c.createImageData(W, 28), d = id.data, fc = hex2rgb(night ? '#59607a' : '#d8dde2');
    for (let y = 0; y < 28; y++) for (let x = 0; x < W; x++) {
      const u = x / W, n = fbm(x * .045, y * .16) * (1 - u) + fbm((x - W) * .045, y * .16) * u;
      const prof = Math.sin(Math.PI * y / 28), al = clamp((n - .3) * 2.2, 0, 1) * prof, q = Math.round(al * 4) / 4;
      const i = (y * W + x) * 4; d[i] = fc[0]; d[i + 1] = fc[1]; d[i + 2] = fc[2]; d[i + 3] = q * 200;
    }
    c.putImageData(id, 0, 0);
  }
  function buildFrost() {
    frostC = mk(W, H); const c = frostC.getContext('2d'); c.fillStyle = 'rgba(225,245,255,.8)';
    const branch = (x, y, a, len, depth) => { for (let i = 0; i < len; i++) { x += Math.cos(a); y += Math.sin(a); c.fillRect(Math.round(x), Math.round(y), 1, 1); if (depth > 0 && Math.random() < .14) branch(x, y, a + (Math.random() < .5 ? -1 : 1) * rnd(.6, 1.1), len * .5, depth - 1); } };
    for (let i = 0; i < 34; i++) {
      const side = i % 3; let x, y, a;
      if (side === 0) { x = rnd(0, W); y = 0; a = Math.PI / 2 + rnd(-.6, .6); }
      else if (side === 1) { x = 0; y = rnd(0, H * .6); a = rnd(-.6, .6); }
      else { x = W; y = rnd(0, H * .6); a = Math.PI + rnd(-.6, .6); }
      branch(x, y, a, rnd(6, 20), 2);
    }
  }
  function build() { computePal(); buildSky(); buildTerrain(); makeStars(); makeFlora(); makeClouds(); buildFog(); buildFrost(); buildFreighter(); buildShip(); shipInit(); setupDeposits(); setupDrones(); }
  function resize() {
    const r = innerWidth / Math.max(1, innerHeight); W = 180; H = Math.max(220, Math.round(W / r));
    cv.width = W; cv.height = H; HY = Math.round(H * .36); buf = mk(W, H); bx = buf.getContext('2d');
    g.imageSmoothingEnabled = false; build(); fresh = true;
  }

  /* ----- planet (per-pixel lit, rotating sphere) ----- */
  function renderPlanet() {
    const S = 64, Rr = 22, cx = 32, cy = 32, id = pc.createImageData(S, S), d = id.data;
    const pl = (PLANET[type] || PLANET.clear).map(hex2rgb), L = [-.62, -.42, .66];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (x - cx + .5) / Rr, dy = (y - cy + .5) / Rr, r2 = dx * dx + dy * dy; if (r2 > 1.18) continue;
      const i = (y * S + x) * 4;
      if (r2 > 1) { const a = (1.18 - r2) / .18; const at = pl[4]; d[i] = at[0]; d[i + 1] = at[1]; d[i + 2] = at[2]; d[i + 3] = Math.round(a * 3) / 3 * 120 * (dx * L[0] + dy * L[1] > -.2 ? 1 : .3); continue; }
      const nz = Math.sqrt(1 - r2), lon = Math.atan2(dx, nz) + protA, lat = Math.asin(clamp(dy, -1, 1));
      const n = fbm(lon * 2.2 + 50, lat * 3 + 50);
      let col = n < .44 ? pl[0] : n < .5 ? pl[1] : n < .68 ? pl[2] : pl[3];
      if (vnoise(lon * 3 + protA * .6 + 10, lat * 7) > .7) col = [240, 242, 250];
      const li = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]), q = Math.floor(li * 4.99) / 4, sh = .14 + .86 * q;
      let c2 = [col[0] * sh, col[1] * sh, col[2] * sh];
      if (r2 > .8) c2 = mixRGB(c2, pl[4], (r2 - .8) * 2.2 * (q > 0 ? 1 : .25));
      d[i] = c2[0]; d[i + 1] = c2[1]; d[i + 2] = c2[2]; d[i + 3] = 255;
    }
    pc.putImageData(id, 0, 0);
  }
  function drawRing(px, py, front) {
    const tilt = -.32, ct = Math.cos(tilt), st = Math.sin(tilt), rc = (PLANET[type] || PLANET.clear)[4];
    for (const [rad, col] of [[31, mix(rc, '#ffffff', .4)], [35, rc], [36, mix(rc, '#000000', .2)]]) {
      for (let k = 0; k < 160; k++) {
        const a = k / 160 * Math.PI * 2, s = Math.sin(a); if ((s > 0) !== front) continue;
        const x = Math.cos(a) * rad, y = s * rad * .22;
        R(px + x * ct - y * st, py + x * st + y * ct, 1, 1, night ? mix(col, '#101030', .4) : col);
      }
    }
  }
  /* ----- the Atlas (matches the classic logo: dark kite, white top-right facet, red half-orb) ----- */
  function drawAtlas(x, y, sz) {
    const pulse = .5 + .5 * Math.sin(T * 2.2), cy = y + Math.sin(T * 1.1) * 1.5, sx = .82 + .18 * Math.cos(T * .45);
    const P2 = (u, v) => [x + u * sz * sx, cy + v * sz];
    // red aura
    for (let r = 18; r > 4; r -= 3) { g.fillStyle = `rgba(255,50,60,${(.04 + .05 * pulse) * (20 - r) / 16})`; g.beginPath(); g.arc(x, cy + sz * .3, r + pulse * 2, 0, 7); g.fill(); }
    const T0 = P2(0, -1.32), L0 = P2(-1, 0), R0 = P2(1, 0), B0 = P2(0, 2.17), IT = P2(0, -.33), IB = P2(0, .33);
    const poly = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.closePath(); g.fill(); };
    const ln = (p0, p1, col) => { g.strokeStyle = col; g.lineWidth = .55; g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.stroke(); };
    const dark = night ? '#3a3a3e' : '#404040', light = '#f7f7f7';
    poly([T0, R0, B0, L0], dark);                               // body
    poly([P2(-.02, -1.25), P2(-.92, -.02), IT], '#4a4a4c');     // subtle top-left facet
    // red half-orb (right of centre line)
    g.fillStyle = `rgb(${Math.round(183 + 30 * pulse)},${Math.round(74 + 10 * pulse)},${Math.round(79 + 10 * pulse)})`;
    g.beginPath(); g.moveTo(x, cy - .5 * sz); g.arc(x, cy, .5 * sz, -Math.PI / 2, Math.PI / 2, false); g.closePath(); g.fill();
    poly([T0, R0, IT], light);                                  // white top-right facet
    g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(...T0); g.lineTo(...P2(.5, -.66)); g.lineTo(...P2(0, -.7)); g.closePath(); g.fill();
    const wl = 'rgba(255,255,255,.95)';
    ln(T0, B0, wl); ln(L0, IT, wl); ln(IT, R0, wl); ln(L0, IB, wl); ln(IB, R0, wl);
    g.strokeStyle = '#2c2c2c'; g.lineWidth = .6; g.beginPath(); g.moveTo(...T0); g.lineTo(...R0); g.lineTo(...B0); g.lineTo(...L0); g.closePath(); g.stroke();
    if (Math.sin(T * .8) > .97) { const f = (Math.sin(T * .8) - .97) / .03; g.fillStyle = `rgba(255,255,255,${f * .8})`; g.fillRect(Math.round(T0[0]), Math.round(T0[1]), 1, 1); g.fillRect(Math.round(T0[0]) - 2, Math.round(T0[1]), 5, 1); g.fillRect(Math.round(T0[0]), Math.round(T0[1]) - 2, 1, 5); }
    if (beam >= 0) { const al = Math.sin(beam / 1.6 * Math.PI); for (let yy = T0[1] - 2; yy > 0; yy -= 2) R(x, yy, 1, 1, `rgba(255,70,80,${al})`); R(x - 1, 0, 3, T0[1] - 2, `rgba(255,70,80,${al * .25})`); }
  }
  /* ----- capital freighter (pre-rendered detailed sprite) ----- */
  let frC = null; const FRW = 112, FRH = 40;
  function buildFreighter() {
    frC = mk(FRW, FRH); const c = frC.getContext('2d');
    const haze = night ? '#0b0e24' : P.sky[1], hz = night ? .5 : .18, k = col => mix(col, haze, hz);
    const r = (x, y, w, h, col) => { c.fillStyle = k(col); c.fillRect(x, y, w, h); };
    const HL = '#9aa3b2', H = '#6b7382', HD = '#4a515e', HDD = '#2e333c', RED = '#c8483a', RDK = '#8a2a22', GLD = '#d8a040';
    // main hull + prow taper (facing right)
    for (let x = 14; x < 108; x++) {
      let top = 15, bot = 28;
      if (x > 86) { top = Math.round(15 + (x - 86) * .45); bot = Math.round(28 - (x - 86) * .42); }
      if (x < 20) { top = 15 + (20 - x) * .5 | 0; }
      for (let y = top; y < bot; y++) { const f = (y - top) / Math.max(1, bot - top); r(x, y, 1, 1, f < .12 ? HL : f < .55 ? H : f < .85 ? HD : HDD); }
      if (x % 7 === 0 && x < 86) r(x, top + 2, 1, bot - top - 3, HD);          // panel seams
    }
    r(20, 20, 66, 1, RED); r(20, 21, 66, 1, RDK);                                  // racing stripe
    for (let x = 88; x < 104; x++) r(x, Math.round(20 + (x - 88) * .02), 1, 1, RED);
    r(96, 21, 6, 1, '#ffffff');                                                     // prow accent
    // upper deck + cargo containers
    r(24, 11, 54, 4, H); r(24, 11, 54, 1, HL); r(24, 14, 54, 1, HD);
    const cargo = ['#c8483a', '#d8a040', '#4a7aa8', '#7a8a5a', '#c8483a', '#4a7aa8', '#d8a040'];
    cargo.forEach((col, i) => { const x = 27 + i * 6; r(x, 8, 5, 3, col); r(x, 8, 5, 1, mix(col, '#ffffff', .35)); r(x + 2, 8, 1, 3, mix(col, '#000000', .35)); });
    // bridge tower
    r(62, 2, 12, 9, HD); r(63, 1, 10, 2, H); r(63, 1, 10, 1, HL); r(74, 4, 3, 7, HDD);
    for (let i = 0; i < 4; i++) r(64 + i * 2, 4, 1, 1, '#ffe0a0');
    r(64, 7, 8, 1, '#5fc8ff');                                                      // bridge glass
    r(67, -1 + 1, 1, 1, '#c0c0c0'); r(66, 0, 1, 2, '#9aa3b2'); r(70, 0, 1, 2, '#9aa3b2');
    // antenna dish
    r(56, 6, 4, 1, HL); r(57, 7, 2, 1, HD); r(58, 8, 1, 3, HD);
    // rear fins / wings
    for (let i = 0; i < 9; i++) { r(10 + i, 6 + i, 10, 1, i < 2 ? HL : H); r(10 + i, 33 - i, 10, 1, i < 2 ? HD : H); }
    r(10, 6, 3, 1, RED); r(10, 33, 3, 1, RED);
    // engine block + nozzles
    r(4, 13, 14, 17, HD); r(4, 13, 14, 1, H); r(4, 29, 14, 1, HDD);
    for (let j = 0; j < 3; j++) { const y = 15 + j * 5; r(0, y, 5, 4, HDD); r(0, y + 1, 1, 2, '#1a1c22'); r(1, y, 3, 1, H); }
    // underside keel + hangar bay
    r(24, 28, 56, 3, HDD); r(26, 31, 50, 1, '#22262e');
    r(44, 28, 14, 3, '#1a1c22'); r(45, 29, 12, 1, '#ffd27a'); r(44, 28, 1, 3, GLD); r(57, 28, 1, 3, GLD);
    // hull windows
    for (let x = 22; x < 86; x += 3) { if (hash(x, 7) > .35) r(x, 17, 1, 1, '#ffd27a'); if (hash(x, 13) > .55) r(x + 1, 24, 1, 1, '#ffd27a'); }
    // greebles
    for (let i = 0; i < 18; i++) { const x = 20 + Math.floor(hash(i, 3) * 64), y = 15 + Math.floor(hash(i, 5) * 11); r(x, y, 2, 1, hash(i, 9) > .5 ? HD : HL); }
  }
  function drawFreighter() {
    const f = freighter; if (!f || !frC) return; const x = Math.round(f.x), y = Math.round(f.y);
    // engine glow (animated)
    for (let j = 0; j < 3; j++) { const ey = y + 15 + j * 5 + 1, fl = 3 + Math.round(Math.sin(T * 20 + j * 2) * 1.5 + Math.random());
      g.fillStyle = 'rgba(110,200,255,.25)'; g.fillRect(x - fl - 4, ey - 1, fl + 4, 4);
      g.fillStyle = 'rgba(150,225,255,.7)'; g.fillRect(x - fl, ey, fl, 2); g.fillStyle = '#ffffff'; g.fillRect(x - 1, ey, 1, 2); }
    g.drawImage(frC, x, y);
    const bl = Math.floor(T * 1.5) % 2;
    R(x + 10, y + 6, 1, 1, bl ? '#ff3030' : '#501010'); R(x + 10, y + 33, 1, 1, bl ? '#30ff60' : '#105020');
    R(x + 67, y + 0, 1, 1, Math.floor(T * 3) % 3 === 0 ? '#ffffff' : '#606060');
    if (Math.sin(T * 2) > 0) R(x + 107, y + 21, 1, 1, '#ffffff');
    g.fillStyle = `rgba(255,210,120,${.25 + .2 * Math.sin(T * 3)})`; g.fillRect(x + 45, y + 31, 12, 3); // hangar light spill
    // shuttle that docks/launches from the hangar
    if (f.sh) { const s = f.sh; R(x + s.x, y + s.y, 4, 2, nc('#d8dde3')); R(x + s.x + 3, y + s.y, 1, 1, '#5fc8ff'); R(x + s.x - 1, y + s.y + 1, 1, 1, Math.floor(T * 10) % 2 ? '#ffb030' : '#ffffff'); }
  }
  /* ----- sprites ----- */
  const SHIP = ['...aa.......', '..abba......', 'aaaaaaaaaaa.', 'eaacccaaaaab', '.aaaaaaaa...', '...aa.......'];
  const DRONE = ['..ggg..', '.gyyyg.', 'ggyrygg', '.ggggg.', '..g.g..'];
  const TRAV = ['...www...', '..wwwww..', '..wvvvw..', '..wvvvw..', '...www...', '..rwwwr..', '.pwwrwwp.', '.wpwwwpw.', '.w.wwr.w.', '.w.wrw.w.', '...www...', '...w.w...', '...w.w...', '..dd.dd..'];
  const TC = { w: '#ecebe4', v: '#ff9a1f', r: '#d23a2c', p: '#5b6274', d: '#2a2b33' };
  const TB = [
    '.....a............',
    '.....a..hhhh......',
    '.....ahhoooohG....',
    '....hooooooooooc..',
    '....ooooovvvvvvo..',
    '...Oooooovvvvvvvo.',
    '...OooooovVvvvvvo.',
    '...OooooovvVvvvvo.',
    '....OooooovvvvvO..',
    '.....OOoooooooO...',
    '...OOOBbbbbbbBOO..',
    '..OohObbbbbbbbbooO',
    '..oohbbBcccBbbbhoo',
    '..oohbbcckccbbbhoo',
    '..oohbbBcccBbbbhoO',
    '..oOhBbbbbbbbbBhoO',
    '..kOoooooooooooOk.',
    '..gOrryrrrrrrrrOg.',
    '..g.oooooooooooOg.',
    '..g.oooooOooooOO..',
    '....ooooO..oooO...',
    '....oooO...Oooo...'];
  const TL = {
    stand: ['....oooO...ooOo...', '....ooO....oOoo...', '....OoO....oOo....', '....ooO....oOo....', '....kkk....kkkk...', '...kkkk....kkkkk..'],
    walkA: ['...oooO.....oOoo..', '...ooO.......oOo..', '..ooO.........oOo.', '..ooO.........oOo.', '..kkk.........kkkk', '.kkkk.........kkkk'],
    walkB: ['.....ooooOoo......', '.....oooOoO.......', '......ooOoO.......', '......oOoO........', '.....kkkkkk.......', '....kkkkkkkk......'],
    crouch: ['...ooO......oOo...', '..ooO........oOo..', '.kkk..........kkkk', 'kkkk..........kkkk']
  };
  const TPAL = () => { const su = CFV.suit[CF().suit] || CFV.suit.orange; return { o: nc(su[0]), O: nc(su[1]), h: nc(su[2]), a: '#8a8e96', G: Math.floor(T * 2) % 2 ? '#5dff8a' : '#2a7a40', c: '#5ff0ff', v: '#1c1730', V: '#7a6ac0', b: nc('#4a6ab8'), B: nc('#2e4478'), k: '#2a2b33', g: '#3a3a42', r: '#d23a2c', y: '#e0b060' }; };
  function drawSprite(rows, x, y, cols, flip) { for (let j = 0; j < rows.length; j++) { const row = rows[j], n = row.length; for (let i = 0; i < n; i++) { const ch = row[i]; if (ch !== '.') R(x + (flip ? n - 1 - i : i), y + j, 1, 1, cols[ch]); } } }
  function drawFlora(f) {
    const windy = ['wind', 'tornado', 'storm'].includes(type), sway = windy ? Math.sin(T * 5 + f.ph) * 2 + 1.5 : Math.sin(T * 1.2 + f.ph) * .6, s = f.s, x = f.x, y = f.y;
    switch (P.flora) {
      case 'lush': { const h = Math.round((6 + f.k * 6) * s); R(x, y - h, s, h, nc('#7a5a48')); const cw = Math.round((5 + f.k * 4) * s), cx = Math.round(x + sway - cw / 2), cap = ['#ff5fa2', '#3fe0c5', '#b26bff', '#ffb347'][Math.floor(f.k * 4)];
        R(cx, y - h - 2 * s, cw + 1, 2 * s, nc(cap)); R(cx + s, y - h - 3 * s, cw - 2 * s + 1, s, nc(mix(cap, '#ffffff', .3))); R(cx + 1, y - h, cw - 1, 1, nc(mix(cap, '#000000', .35)));
        R(cx + 2 * s, y - h - 2 * s, 1, 1, night ? '#9fffe8' : '#ffffff'); if (night) R(cx + cw - 2, y - h - s, 1, 1, '#9fffe8'); break; }
      case 'ice': { const h = Math.round((5 + f.k * 8) * s); for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((h - j) / h * 4 * s)); R(x - w / 2 + (j / h) * sway * .3, y - j, w, 1, j % 3 ? nc('#bfeaff') : nc('#ffffff')); } R(x, y - h, 1, 1, '#ffffff'); break; }
      case 'desert': { const h = Math.round((6 + f.k * 5) * s), c = nc('#5f7a3a'); R(x, y - h, 2 * s, h, c); R(x - 2 * s, y - h + 3 * s, 2 * s, s, c); R(x - 2 * s, y - h + s, s, 2 * s, c); R(x + 2 * s, y - h + 4 * s, 2 * s, s, c); R(x + 3 * s, y - h + 2 * s, s, 2 * s, c); R(x, y - h, s, h, nc('#7a9a4a')); break; }
      case 'burnt': { const h = Math.round((7 + f.k * 6) * s); R(x, y - h, s, h, '#140806'); R(x - 2 * s, y - h + 2 * s, 2 * s, 1, '#140806'); R(x + s, y - h + 4 * s, 3 * s, 1, '#140806'); if (Math.sin(T * 9 + f.ph) > 0) R(x, y - h - 1, 1, 1, '#ffb020'); R(x + 3 * s, y - h + 3 * s, 1, 1, Math.sin(T * 7 + f.ph) > 0 ? '#ff5a10' : '#ffd040'); break; }
      case 'grass': { for (let k = 0; k < 4 * s; k++) { const h = Math.round((3 + ((k * 7 + f.k * 10) % 5)) * s * .8); for (let j = 0; j < h; j++) R(x + k - 2 + sway * (j / h), y - j, 1, 1, nc(j > h - 2 ? '#a8d860' : '#5f8a3a')); } break; }
      default: { const h = Math.round((6 + f.k * 6) * s), c = nc('#4a4a50'); R(x, y - h, s, h, c); R(x + sway * .4 - 2 * s, y - h, 2 * s, 1, c); R(x + sway * .4 + s, y - h + 2 * s, 2 * s, 1, c); R(x + sway * .5 - 3 * s, y - h - 1, 1, 1, c); }
    }
  }
  /* ===== TRAVELLER AI + RESOURCES + SENTINEL DRONES ===== */
  const FY = () => HY + 36;
  const TRV = { x: 120, dir: -1, st: 'idle', t: 2, target: null, walkPh: 0, flinch: 0, busted: 0, shield: 0, muzzle: 0, cd: 0, mineAcc: 0, zap: 0, lastFoot: 0 };
  let deposits = [], foot = [], floaters = [], scanRing = -1;
  const RES = {
    lush: [['CARBON', '#e0453a', 'plant'], ['FERRITE DUST', '#9aa0a8', 'rock'], ['COPPER', '#ff8a2a', 'crystal'], ['SODIUM', '#ffd23f', 'glow']],
    ice: [['DIOXITE', '#bfe8ff', 'crystal'], ['FERRITE DUST', '#9aa0a8', 'rock'], ['FROST CRYSTAL', '#e8f6ff', 'glow']],
    desert: [['CACTUS FLESH', '#7ab84a', 'plant'], ['PYRITE', '#ffc84a', 'crystal'], ['FERRITE DUST', '#b09a80', 'rock']],
    burnt: [['PHOSPHORUS', '#ff5a2a', 'crystal'], ['SOLANIUM', '#ffb020', 'glow'], ['FERRITE DUST', '#6a5a50', 'rock']],
    grass: [['CARBON', '#e0453a', 'plant'], ['COPPER', '#ff8a2a', 'crystal'], ['FERRITE DUST', '#9aa0a8', 'rock']],
    dead: [['FERRITE DUST', '#8a8f99', 'rock'], ['COBALT', '#4a7aff', 'crystal'], ['STORM CRYSTAL', '#c070ff', 'glow']]
  };
  const resList = () => { let l = RES[P.flora] || RES.lush; if (P.flora === 'dead' && !['storm', 'hail', 'tornado'].includes(type)) l = l.filter(r => r[0] !== 'STORM CRYSTAL'); return l; };
  function spawnDeposit(d) {
    d = d || {}; let x, tries = 0;
    do { x = rnd(16, W - 16); tries++; } while (tries < 30 && (Math.abs(x - TRV.x) < 22 || deposits.some(o => o !== d && o.hp > 0 && Math.abs(o.x - x) < 18)));
    Object.assign(d, { x, dy: Math.round(rnd(-2, 3)), res: pick(resList()), hp: 1, sz: rnd(.85, 1.35), tag: 0, respawn: 0, ph: rnd(0, 6), hit: 0 });
    return d;
  }
  function setupDeposits() {
    if (!deposits.length) { for (let i = 0; i < 3; i++) deposits.push(spawnDeposit()); }
    else { const l = resList(); deposits.forEach(d => { if (!l.includes(d.res)) d.res = pick(l); }); }
    TRV.x = clamp(TRV.x, 14, W - 14);
  }
  function drawDeposit(d) {
    if (d.hp <= 0) return;
    const s = d.sz * (.4 + .6 * d.hp), bx = Math.round(d.x), by = FY() + d.dy, c = nc(d.res[1]), hi = nc(mix(d.res[1], '#ffffff', .45)), lo = nc(mix(d.res[1], '#000000', .4));
    const jit = d.hit > 0 ? (frame % 2 ? 1 : -1) : 0, x0 = bx + jit;
    switch (d.res[2]) {
      case 'rock': { const w = Math.round(9 * s), h = Math.round(6 * s); for (let j = 0; j < h; j++) { const ww = Math.round(w * Math.sqrt(1 - ((j - h) / h) ** 2)); R(x0 - ww / 2, by - j, ww, 1, j > h * .6 ? hi : j < 2 ? lo : c); } R(x0 - 1, by - h + 2, 2, 1, '#ffffff55'); break; }
      case 'crystal': { const sp = [[-3, 7, -.25], [0, 11, 0], [3, 8, .3]]; for (const [ox, hh, lean] of sp) { const h = Math.round(hh * s); for (let j = 0; j < h; j++) { const w = Math.max(1, Math.round((1 - j / h) * 3 * s)); R(x0 + ox * s + lean * j - w / 2, by - j, w, 1, j % 4 === 0 ? hi : c); R(x0 + ox * s + lean * j - w / 2, by - j, 1, 1, lo); } } if (Math.sin(T * 3 + d.ph) > .9) R(x0, by - Math.round(10 * s), 1, 1, '#ffffff'); break; }
      case 'plant': { const h = Math.round(8 * s); R(x0, by - h, 1, h, nc('#5a7a3a')); R(x0 - 2, by - h * .6, 2, 1, nc('#5a7a3a')); R(x0 + 1, by - h * .4, 2, 1, nc('#5a7a3a'));
        [[0, -h - 1], [-3, -h * .6 - 1], [3, -h * .4 - 1]].forEach(([ox, oy]) => { R(x0 + ox - 1, by + oy - 1, 3, 3, c); R(x0 + ox - 1, by + oy - 1, 1, 1, hi); }); break; }
      case 'glow': { const r = 3 * s, p = .5 + .5 * Math.sin(T * 3 + d.ph); g.fillStyle = rgba(d.res[1], .18 + .15 * p); g.beginPath(); g.arc(x0, by - r, r * 2.4, 0, 7); g.fill();
        for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) R(x0 + i, by - r + j, 1, 1, i * i + j * j < r * r * .3 ? '#ffffff' : d.res[1]);
        R(x0 - 4 * s, by - 2, 2, 2, d.res[1]); R(x0 + 3 * s, by - 1, 2, 2, hi); break; }
    }
    if (d.tag > 0) { // scanner marker
      const a = Math.min(1, d.tag), my = by - Math.round(15 * d.sz) - Math.round(Math.sin(T * 4 + d.ph));
      g.globalAlpha = a; R(bx, my - 2, 1, 1, '#ffffff'); R(bx - 1, my - 1, 3, 1, d.res[1]); R(bx - 2, my, 5, 1, d.res[1]); R(bx - 1, my + 1, 3, 1, d.res[1]); R(bx, my + 2, 1, 1, '#ffffff');
      for (let yy = my + 4; yy < by - 8 * d.sz; yy += 2) R(bx, yy, 1, 1, rgba(d.res[1], .5)); g.globalAlpha = 1;
    }
  }
  // tiny 3x5 pixel font for floating "+34"
  const GL = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '!': '010010010000010', '?': '111001011000010' };
  function ptext(str, x, y, col) { let cx = Math.round(x - str.length * 2); for (const ch of str) { const gl = GL[ch]; if (gl) for (let k = 0; k < 15; k++) if (gl[k] === '1') { R(cx + k % 3 + 1, y + Math.floor(k / 3) + 1, 1, 1, 'rgba(0,0,0,.6)'); R(cx + k % 3, y + Math.floor(k / 3), 1, 1, col); } cx += 4; } }

  function travUpdate(dt) {
    const tr = TRV; tr.flinch = Math.max(0, tr.flinch - dt); tr.shield = Math.max(0, tr.shield - dt); tr.busted = Math.max(0, tr.busted - dt);
    deposits.forEach(d => { d.tag = Math.max(0, d.tag - dt); d.hit = Math.max(0, d.hit - dt); if (d.hp <= 0) { d.respawn -= dt; if (d.respawn <= 0) spawnDeposit(d); } });
    if (scanRing >= 0) { scanRing += dt; const r = scanRing * 120; deposits.forEach(d => { if (d.hp > 0 && d.tag <= 0 && Math.abs(d.x - tr.x) < r) { d.tag = 7; listener && listener('tick'); } }); if (scanRing > 1.3) scanRing = -1; }
    if (type === 'tornado' && !(tr.st === 'pilot')) { if (tr.st === 'toShip' || tr.st === 'board') tr.st = 'idle'; // flee, then brace
      const dist = Math.abs(tr.x - tornadoX), away = tr.x < tornadoX ? -1 : 1;
      if (dist < 55 && ((away < 0 && tr.x > 16) || (away > 0 && tr.x < W - 16))) { tr.st = 'run'; tr.dir = away; tr.x += away * 26 * dt; tr.walkPh += dt * 16; }
      else { tr.st = 'brace'; tr.dir = tornadoX < tr.x ? -1 : 1; }
      tr.target = null; return;
    }
    if (shipBusy() && SHP) { if (travShip(dt)) return; }
    if (tr.st === 'run' || tr.st === 'brace') { tr.st = 'idle'; tr.t = 1; }
    if (tr.st === 'fight') { if (combat.on) { travFight(dt); return; } tr.st = 'idle'; tr.t = 1; }
    if (tr.flinch > 0 || tr.busted > 0 || hop >= 0) return;
    const sp0 = CFV.tWalk[CF().tWalk] * ({ rain: 9, drizzle: 10, storm: 15, hail: 17, sleet: 7, snow: 7, cold: 6, heat: 5, fire: 6, fog: 7, wind: 9 }[type] ?? 11);
    switch (tr.st) {
      case 'idle': tr.t -= dt * (type === 'fog' ? 1.6 : 1) * CFV.tScan[CF().tScan]; if (tr.t <= 0) { tr.st = 'scan'; tr.t = 1.3; scanRing = 0; listener && listener('scan'); } break;
      case 'scan': tr.t -= dt; if (tr.t <= 0) {
        const cand = deposits.filter(d => d.hp > 0 && d.tag > 0).sort((a, b) => Math.abs(a.x - tr.x) - Math.abs(b.x - tr.x));
        tr.target = cand.length && Math.random() < CFV.tMine[CF().tMine] ? cand[0] : { x: rnd(18, W - 18), wander: true }; tr.st = 'walk'; } break;
      case 'walk': {
        const tg = tr.target; if (!tg || (!tg.wander && tg.hp <= 0)) { tr.st = 'idle'; tr.t = 1; break; }
        const tx = tg.wander ? tg.x : clamp(tg.x + (tr.x < tg.x ? -15 : 15), 12, W - 12), dx = tx - tr.x;
        if (Math.abs(dx) < 1.2) { if (tg.wander) { tr.st = 'idle'; tr.t = rnd(1.5, 3.5); } else { tr.st = 'mine'; tr.dir = tg.x > tr.x ? 1 : -1; tr.mineAcc = 0; } break; }
        tr.dir = dx < 0 ? -1 : 1; let sp = sp0; if (type === 'wind' && tr.dir < 0) sp *= .5;
        const step = Math.sign(dx) * Math.min(Math.abs(dx), sp * dt); tr.x += step; tr.walkPh += Math.abs(step) * .55;
        if (P.flora === 'ice' && Math.abs(tr.x - tr.lastFoot) > 4) { tr.lastFoot = tr.x; foot.push({ x: tr.x + (Math.floor(tr.walkPh) % 2 ? 2 : -1) + 7, life: 12 }); }
        break; }
      case 'mine': {
        const d = tr.target; if (!d || d.hp <= 0) { tr.st = 'idle'; tr.t = rnd(1, 2.5); break; }
        d.hp -= dt * CFV.tMineSpd[CF().tMineSpd] / d.sz; d.hit = .1; tr.mineAcc += dt; tr.zap -= dt;
        if (tr.zap <= 0) { tr.zap = .14; listener && listener('zap'); const hx = d.x, hy = FY() + d.dy - 4 * d.sz;
          for (let k = 0; k < 3; k++) spark(hx + rnd(-2, 2), hy, rnd(-30, 30), -rnd(20, 60), .35, pick(['#fff7c0', '#ffb020', d.res[1]]));
          spark(hx, hy, rnd(-20, 20), -rnd(30, 50), 1.5, d.res[1], 0, 'home'); }
        if (d.hp <= 0) { d.hp = 0; d.respawn = rnd(5, 10); const amt = Math.round(18 + d.sz * 40 + rnd(0, 20)); floaters.push({ x: tr.x + 8, y: FY() - 34, txt: '+' + amt, col: d.res[1], life: 1.6 }); listener && listener('collect', d.res[0], amt); tr.st = 'idle'; tr.t = rnd(1.2, 2.5); }
        break; }
    }
  }
  function drawTraveller() {
    if (TRV.st === 'pilot') return { x: TRV.x, y: FY() - 22 };
    const tr = TRV, S = 2, flip = tr.dir < 0, x0 = Math.round(tr.x) - 9, feet = FY();
    let hy = 0; if (hop >= 0) hy = Math.round(Math.sin(hop / 1.3 * Math.PI) * 18);
    if (tr.st === 'board') hy = Math.round((1 - tr.t / 1.1) * 14); else if (tr.st === 'exit') hy = Math.round(Math.max(0, tr.t - .2) / 1 * 14);
    const crouch = (tr.flinch > 0 && tr.st !== 'fight') || tr.st === 'brace' ? 4 : 0, moving = tr.st === 'walk' || tr.st === 'run' || tr.st === 'fight' || tr.st === 'toShip';
    const jx = coldT() && Math.sin(T * 47) > .3 ? 1 : 0, lean = (type === 'wind' || type === 'tornado' ? 2 : 0) + (tr.st === 'run' ? tr.dir * 2 : 0);
    const stepUp = moving && Math.floor(tr.walkPh) % 2 ? 1 : 0, bob = moving ? -stepUp : Math.round(Math.sin(T * 2) * .8);
    const x = x0 + jx, y = feet - 14 * S + bob - hy + crouch;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 2 + Math.round(hy / 5), feet, 14 - Math.round(hy / 3), 2);
    const tool = tr.st === 'scan' || tr.st === 'mine' || tr.st === 'fight';
    const legs = crouch ? TL.crouch : moving ? (Math.floor(tr.walkPh) % 2 ? TL.walkA : TL.walkB) : TL.stand;
    const PC = TPAL(), rows = TB.concat(legs), legY = crouch ? y + 24 : y + 22;
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], off = Math.round(j < 12 ? lean : j < 20 ? lean / 2 : 0), yy = j < 22 ? y + j : legY + (j - 22);
      for (let i = 0; i < 18; i++) { const ch = row[i]; if (ch === '.' || ch === undefined) continue; if (tool && j >= 15 && j <= 19 && i >= 16) continue; R(x + (flip ? 17 - i : i) + off, yy, 1, 1, PC[ch]); }
    }
    if (tool) { for (let k = 0; k < 3; k++) { const ax = flip ? x + 2 - k : x + 15 + k; R(ax + lean, y + 13, 1, 2, k === 2 ? PC.g : k ? PC.o : PC.O); } }
    if (CF().orb) { const ox = (flip ? x - 2 : x + 17) + lean, oy = y + 7 + Math.round(Math.sin(T * 2.6)); R(ox, oy, 3, 3, PC.o); R(ox, oy, 3, 1, PC.h); R(ox + (flip ? 0 : 2), oy + 1, 1, 1, '#5ff0ff'); R(ox + 1, oy + 3, 1, 1, PC.O); }
    const lamp = night || type === 'fog';
    if (lamp) { const lx = flip ? x + 2 : x + 15; R(lx + lean, y + 3, 1, 1, '#ffffff'); g.fillStyle = 'rgba(255,220,150,.10)'; const hx = lx + lean; g.beginPath(); g.moveTo(hx, y + 6); g.lineTo(hx + tr.dir * 46, y + 26); g.lineTo(hx + tr.dir * 46, y - 8); g.fill(); }
    if (hop >= 0 || tr.st === 'board' || tr.st === 'exit') { for (let k = 0; k < 4 + (frame % 3); k++) { const c = k < 2 ? '#ffe14a' : '#ff6a1a'; R(x + 2, y + 20 + k * 2, 2, 2, c); R(x + 14, y + 20 + k * 2, 2, 2, c); } }
    // multitool + laser
    let tipX = 0, tipY = 0;
    if (tool) {
      const hx = flip ? x - 1 : x + 18, hyy = y + 14, d = tr.dir;
      R(hx, hyy, 1, 3, '#2a2a2e'); for (let k = 0; k < 7; k++) R(hx + d * k, hyy - 1, 1, 2, k < 2 ? '#2a2a2e' : k < 5 ? '#e07a2a' : '#c8ccd2');
      R(hx + d * 3, hyy - 2, 1, 1, '#5ff0ff'); tipX = hx + d * 7; tipY = hyy - 1;
      if (tr.st === 'scan') { const p = Math.sin(T * 20) > 0; R(tipX, tipY, 1, 1, p ? '#5ff0ff' : '#ffffff'); }
    }
    if (tr.st === 'mine' && tr.target && tr.target.hp > 0) {
      const tx = tr.target.x + rnd(-1, 1), ty = FY() + tr.target.dy - 4 * tr.target.sz + rnd(-1, 1);
      g.globalAlpha = .45; line(tipX, tipY - 1, tx, ty - 1, '#ff8a1a'); line(tipX, tipY + 1, tx, ty + 1, '#ff8a1a'); g.globalAlpha = 1;
      line(tipX, tipY, tx, ty, Math.floor(T * 30) % 2 ? '#fff7c0' : '#ffe14a');
      g.fillStyle = 'rgba(255,200,80,.35)'; g.beginPath(); g.arc(tx, ty, 3 + Math.random() * 2, 0, 7); g.fill();
      R(tipX - 1, tipY - 1, 3, 3, 'rgba(255,240,180,.9)');
    }
    // umbrella in back hand
    if ((wetT() || type === 'tornado') && tr.st !== 'board' && tr.st !== 'exit') {
      const ux = (flip ? x + 16 : x + 1) + lean, uy = y - 6, inv = (type === 'storm' || type === 'tornado' || type === 'hail') && Math.sin(T * 2.2) > .5;
      R(ux, uy, 1, 20, '#2a2a2a'); R(ux - 2, uy + 19, 2, 1, '#2a2a2a');
      for (let dx = -12; dx <= 12; dx++) {
        const h = Math.round(Math.sqrt(144 - dx * dx) * .5), col = (Math.floor((dx + 12) / 4) % 2) ? '#e84a3a' : '#f4f4f4';
        if (!inv) { R(ux + dx, uy - h, 1, h + 1, col); R(ux + dx, uy, 1, 1, mix(col, '#000000', .3)); }
        else R(ux + dx + Math.round(Math.sin(T * 20) * .8), uy - 12 + h, 1, 2, col);
      }
    }
    // reaction glyphs
    if (tr.flinch > 0 && Math.floor(T * 8) % 2) ptext('!', tr.x, y - 10, '#ffe14a');
    if (tr.busted > 0) ptext('?', tr.x, y - 10 + Math.round(Math.sin(T * 6)), '#ff5a4a');
    if (tr.st === 'brace' && Math.floor(T * 4) % 2) ptext('!', tr.x, y - 10, '#ff5a4a');
    return { x, y };
  }

  /* ----- Sentinel drones (refined: armour plate, roll cage, communicator, lens eye, laser, fin) ----- */
  const DRN_RAW = [
    '...........a........',
    '..........sSs.......',
    '...bbbbbbbbbbbbbb...',
    '..bhhhhhkkkkkkkkkb..',
    '.hoowooOkOoKKKKKoOkb',
    '.hoooooOkOoKcrcKoOkb',
    '.hoowooOkOoKrRrKoOkb',
    '.hoooooOkOoKcrcKoOkb',
    '.hoowooOkOoKKKKKoOkb',
    '..OOOOOOkkkkkkkkgggG',
    '...kkkkkkkkkkkkb....',
    '...l.l...ff....l.l..',
    '....l....f......l...'];
  const DW = Math.max(...DRN_RAW.map(r => r.length)), DRN = DRN_RAW.map(r => r.padEnd(DW, '.'));
  let drn = [], combat = { on: false, phase: '', t: 0 }, nextAttack = 999, respawnT = 0, shots = [];
  function newDroneTarget(d) { d.tx = rnd(14, W - 14); d.ty = rnd(HY - 48, HY + 4); d.st = 'fly'; d.t = rnd(5, 9); d.scan = null; }
  function makeDrone(fromEdge, i) {
    const side = i % 2 ? 1 : -1, d = { x: fromEdge ? (side < 0 ? -16 : W + 16) : rnd(14, W - 14), y: fromEdge ? rnd(HY - 70, HY - 40) : rnd(HY - 40, HY), vx: 0, vy: 0, dir: -side, ph: rnd(0, 6), hp: 6, hit: 0, cd: rnd(1, 2) };
    newDroneTarget(d); d.t = fromEdge ? 8 : rnd(1, 5); if (fromEdge) d.tx = side < 0 ? rnd(20, W * .45) : rnd(W * .55, W - 20); return d;
  }
  function rollAttack() { const r = CFV.attack[CF().attack]; nextAttack = r ? rnd(r[0], r[1]) : Infinity; }
  rollAttack();
  function setupDrones() { if (!CF().drones) return; if (drn.length) { drn.forEach(d => { d.x = clamp(d.x, -20, W + 20); d.y = clamp(d.y, HY - 70, HY + 10); }); return; } if (respawnT > 0) return; for (let i = 0; i < CF().droneCount; i++) drn.push(makeDrone(false, i)); }
  function startAttack() {
    if (combat.on || drn.length < 1 || type === 'tornado' || shipBusy()) return false;
    combat = { on: true, phase: 'alert', t: 1.4 }; drn.forEach(d => { d.st = 'hostile'; d.scan = null; d.leave = false; d.hp = CFV.tough[CF().tough]; d.cd = rnd(.8, 1.6); d.t = 0; });
    TRV.st = 'fight'; TRV.target = null; TRV.cd = .6; hop = -1; listener && listener('attack'); return true;
  }
  function explode(d) {
    for (let k = 0; k < 40; k++) spark(d.x + rnd(-4, 4), d.y + rnd(-3, 3), rnd(-70, 70), rnd(-90, 30), rnd(.4, 1.1), pick(['#ffffff', '#fff2a0', '#ffb020', '#ff5a10', '#e0601e']), 160);
    for (let k = 0; k < 10; k++) spark(d.x + rnd(-3, 3), d.y, rnd(-50, 50), rnd(-70, -10), rnd(1.2, 2), pick(['#e0601e', '#a8401a', '#2a2a2e', '#55555c']), 260, 'chunk');
    for (let k = 0; k < 6; k++) spark(d.x + rnd(-4, 4), d.y + rnd(-3, 3), rnd(-8, 8), -rnd(6, 16), rnd(1.2, 2.2), '#555', 0, 'smoke');
    flash = Math.max(flash, .35); shake = Math.max(shake, .8); listener && listener('boom');
  }
  function droneUpdate(dt) {
    const cf = CF();
    if (!cf.drones) { if (combat.on) { combat.on = false; TRV.st = 'idle'; TRV.t = 1; } shots = shots.filter(s => s.from === 't'); drn.forEach(d => { if (!d.leave) { d.leave = d.x < W / 2 ? -1 : 1; d.st = 'fly'; d.scan = null; } }); respawnT = 0; }
    else if (!combat.on) {
      const active = drn.filter(d => !d.leave);
      if (respawnT > 0) { respawnT -= dt; if (respawnT <= 0) { for (let i = active.length; i < cf.droneCount; i++) drn.push(makeDrone(true, i)); listener && listener('reinforce'); } }
      else if (active.length < cf.droneCount) { for (let i = active.length; i < cf.droneCount; i++) drn.push(makeDrone(true, i)); }
      else if (active.length > cf.droneCount) active.slice(cf.droneCount).forEach(d => { d.leave = d.x < W / 2 ? -1 : 1; d.st = 'fly'; d.scan = null; });
    }
    if (cf.drones && !combat.on && drn.some(d => !d.leave) && type !== 'tornado') { nextAttack -= dt; if (nextAttack <= 0) { rollAttack(); if (TRV.st !== 'run' && hop < 0 && !shipBusy()) startAttack(); } }
    if (combat.on && type === 'tornado') { combat.on = false; drn.forEach(newDroneTarget); TRV.st = 'idle'; TRV.t = 1; }
    if (combat.on) { combat.t -= dt; if (combat.phase === 'alert' && combat.t <= 0) combat.phase = 'fight'; }
    for (const d of drn) {
      d.t -= dt; d.hit = Math.max(0, d.hit - dt);
      if (d.leave) { d.vx += (d.leave * 40 - d.vx) * dt * 2; d.vy += (-6 - d.vy) * dt; d.scan = null; d.dir = d.leave; }
      else if (d.st === 'hostile') {
        if (d.t <= 0) { d.t = rnd(1.4, 2.4); const s = Math.random() < .5 ? -1 : 1; d.tx = clamp(TRV.x + s * rnd(28, 60), 12, W - 12); d.ty = HY - rnd(8, 42); }
        const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy) || 1, sp = CFV.aggro[CF().aggro].sp;
        d.vx += (dx / dist * Math.min(sp, dist * 2) - d.vx) * dt * 2.5; d.vy += (dy / dist * Math.min(sp, dist * 2) - d.vy) * dt * 2.5;
        d.dir = TRV.x < d.x ? -1 : 1;
        if (combat.phase === 'fight') { d.cd -= dt; if (d.cd <= 0) { const ag = CFV.aggro[CF().aggro].cd; d.cd = rnd(ag[0], ag[1]); const ex = d.x + d.dir * 10, ey = d.y + 3, tx = TRV.x + rnd(-3, 3), ty = FY() - 16 + rnd(-4, 4), l = Math.hypot(tx - ex, ty - ey) || 1;
          shots.push({ x: ex, y: ey, vx: (tx - ex) / l * 120, vy: (ty - ey) / l * 120, life: 2, from: 'd' }); d.mf = .08; listener && listener('dlaser'); } }
      } else if (d.st === 'fly') {
        const dx = d.tx - d.x, dy = d.ty - d.y, dist = Math.hypot(dx, dy) || 1, sp = 16;
        if (dist < 3 || d.t <= 0) {
          d.st = 'scan'; d.t = rnd(2.2, 3.6); const r = Math.random(), live = deposits.filter(o => o.hp > 0);
          if (r < CFV.scanTrav[CF().scanTrav] && TRV.st !== 'fight' && !shipBusy() && !drn.some(o => o !== d && o.scan && o.scan.trav)) { d.scan = { trav: true }; TRV.busted = Math.max(TRV.busted, d.t * .8); listener && listener('sentinel'); }
          else if (r < .55 && live.length) { const o = pick(live); d.scan = { x: o.x, y: FY() + o.dy - 4 }; }
          else if (r < .8 && flora.length) { const f = pick(flora); d.scan = { x: f.x, y: f.y - 4 }; }
          else d.scan = { x: clamp(d.x + rnd(-40, 40), 4, W - 4), y: rnd(HY + 10, HY + 50) };
        } else { d.vx += (dx / dist * sp - d.vx) * dt * 1.4; d.vy += (dy / dist * sp - d.vy) * dt * 1.4; }
      } else { d.vx *= .9; d.vy *= .9; if (d.t <= 0) newDroneTarget(d); }
      if (type === 'tornado') { d.vx += Math.sign(tornadoX - d.x) * 30 * dt + rnd(-40, 40) * dt; d.vy += rnd(-30, 30) * dt; }
      if (type === 'wind' || type === 'storm') d.vx += windMph * .4 * dt * (Math.sin(T + d.ph) * .5 + .5);
      d.x += d.vx * dt; d.y = clamp(d.y + d.vy * dt, HY - 75, HY + 12);
      if (!d.leave && d.st !== 'hostile' && d.x > -10 && d.x < W + 10) d.x = clamp(d.x, 8, W - 8);
      if (d.st !== 'hostile') { if (d.scan) { const sx = d.scan.trav ? TRV.x : d.scan.x; d.dir = sx < d.x ? -1 : 1; } else if (Math.abs(d.vx) > 2) d.dir = d.vx > 0 ? 1 : -1; }
    }
    // projectiles
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; let dead = s.life <= 0 || s.x < -10 || s.x > W + 10 || s.y > FY() + 6 || s.y < -10;
      if (s.from === 'd' && !dead && Math.abs(s.x - TRV.x) < 7 && Math.abs(s.y - (FY() - 14)) < 13) { dead = true; TRV.shield = .35; for (let k = 0; k < 5; k++) spark(s.x, s.y, rnd(-40, 40), rnd(-40, 20), .3, pick(['#5ff0ff', '#ffffff'])); listener && listener('shield'); }
      if (s.from === 's' && !dead) for (const o of ships) if (!o.dead && s.x > o.x - 2 && s.x < o.x + 13 && Math.abs(s.y - (o.y + 3)) < 5) { dead = true; o.hp = (o.hp ?? 3) - 1; for (let k = 0; k < 4; k++) spark(s.x, s.y, rnd(-40, 40), rnd(-40, 30), .3, pick(['#ffffff', '#7fe0ff'])); if (o.hp <= 0) { o.dead = true; KILLS++; explode({ x: o.x + 6, y: o.y + 3 }); listener && listener('kill'); } break; }
      if (s.from === 't' && !dead) for (const d of drn) if (d.hp > 0 && Math.abs(s.x - d.x) < 9 && Math.abs(s.y - d.y) < 7) { dead = true; d.hp--; d.hit = .12; d.vx += Math.sign(s.vx) * 14; for (let k = 0; k < 6; k++) spark(s.x, s.y, rnd(-50, 50), rnd(-50, 20), .35, pick(['#fff2a0', '#ffb020', '#e0601e'])); listener && listener('hit'); if (d.hp <= 0) explode(d); break; }
      if (dead) shots.splice(i, 1);
    }
    const before = drn.length; drn = drn.filter(d => d.hp > 0 && d.x > -40 && d.x < W + 40);
    if (combat.on && before && !drn.length) { combat.on = false; const rr = CFV.reinforce[CF().reinforce]; respawnT = rnd(rr[0], rr[1]); TRV.st = 'idle'; TRV.t = 1.5; hop = 0; listener && listener('victory'); }
  }
  function travFight(dt) {
    const tr = TRV; tr.cd = (tr.cd ?? .5) - dt; tr.muzzle = Math.max(0, (tr.muzzle || 0) - dt);
    const live = drn.filter(d => d.hp > 0); if (!live.length) return;
    const tg = live.reduce((a, b) => Math.abs(a.x - tr.x) < Math.abs(b.x - tr.x) ? a : b); tr.dir = tg.x < tr.x ? -1 : 1;
    const nx = clamp(tr.x + Math.sin(T * 1.7) * 9 * dt, 14, W - 14); if (Math.abs(nx - tr.x) > .01) { tr.walkPh += Math.abs(nx - tr.x) * .5; tr.x = nx; }
    if (combat.phase === 'fight' && tr.cd <= 0) {
      const fr = CFV.tFire[CF().tFire], sp = CFV.tAim[CF().tAim]; tr.cd = rnd(fr[0], fr[1]); tr.muzzle = .07; const sx = tr.x + (tr.dir < 0 ? -17 : 17), sy = FY() - 15, tx = tg.x + rnd(-sp, sp) + tg.vx * .25, ty = tg.y + rnd(-sp * .8, sp * .8), l = Math.hypot(tx - sx, ty - sy) || 1;
      shots.push({ x: sx, y: sy, vx: (tx - sx) / l * 190, vy: (ty - sy) / l * 190, life: 1.5, from: 't' }); listener && listener('pew');
    }
  }
  function drawShots() {
    for (const s of shots) {
      const l = Math.hypot(s.vx, s.vy), ux = s.vx / l, uy = s.vy / l, n = s.from === 's' ? 9 : s.from === 't' ? 5 : 6, glow = s.from === 's' ? 'rgba(80,160,255,.45)' : s.from === 't' ? 'rgba(255,220,80,.4)' : 'rgba(255,40,40,.45)', core = s.from === 's' ? '#9fe8ff' : s.from === 't' ? '#fff7c0' : '#ff6a6a';
      for (let k = 0; k < n; k++) { R(s.x - ux * k, s.y - uy * k - 1, 1, 3, glow); R(s.x - ux * k, s.y - uy * k, 1, 1, k < 2 ? '#ffffff' : core); }
    }
    if (TRV.muzzle > 0) { const mx = TRV.x + (TRV.dir < 0 ? -17 : 17), my = FY() - 15; R(mx - 2, my, 5, 1, '#fff7c0'); R(mx, my - 2, 1, 5, '#fff7c0'); R(mx - 1, my - 1, 3, 3, '#ffffff'); }
    if (TRV.shield > 0) { const a = TRV.shield / .35; g.strokeStyle = `rgba(95,240,255,${a * .8})`; g.lineWidth = 1; g.beginPath(); g.ellipse(TRV.x, FY() - 14, 13, 17, 0, 0, 7); g.stroke(); g.fillStyle = `rgba(95,240,255,${a * .15})`; g.fill(); }
  }
  function drawDrones() {
    for (const d of drn) {
      const hostile = d.st === 'hostile', bob = Math.round(Math.sin(T * 2.4 + d.ph) * 1.5), x = Math.round(d.x) - Math.floor(DW / 2), y = Math.round(d.y) - 6 + bob, flip = d.dir < 0;
      const pulse = .5 + .5 * Math.sin(T * (hostile ? 12 : 5) + d.ph), hf = d.hit > 0;
      const C = hf ? { o: '#ffffff', O: '#ffdddd', h: '#ffffff', w: '#ffffff', k: '#ffcccc', K: '#ffffff', s: '#ffffff', S: '#ffffff', a: '#ffffff', b: '#ffeeee', c: '#ffffff', r: '#ffffff', R: '#ffffff', f: '#ffffff', l: '#ffeeee', g: '#ffffff', G: '#ffffff' }
        : { o: nc('#e0601e'), O: nc('#a8401a'), h: nc('#ff8f45'), w: nc('#efe6dc'), k: '#26262a', K: nc('#55555c'), s: nc('#a8acb4'), S: nc('#eef2f6'), a: '#1a1a1c', b: '#141416', c: nc('#c9d6da'),
            r: hostile ? '#c01010' : '#701212', R: `rgb(${Math.round(210 + 45 * pulse)},${hostile ? 20 : 40},${hostile ? 20 : 40})`, f: nc('#8a2a1e'), l: '#1e1e20', g: '#222226', G: hostile && Math.sin(T * 9) > 0 ? '#ff4040' : '#3a3a40' };
      if (night || hostile) { const ex = flip ? x + DW - 14 : x + 13; g.fillStyle = `rgba(255,40,40,${(hostile ? .3 : .2) + .2 * pulse})`; g.beginPath(); g.arc(ex + .5, y + 6.5, hostile ? 5 : 3, 0, 7); g.fill(); }
      drawSprite(DRN, x, y, C, flip);
      if (d.mf > 0) { d.mf -= 1 / 60; const mx = flip ? x - 1 : x + DW; R(mx - 1, y + 8, 3, 3, '#ff8080'); R(mx, y + 9, 1, 1, '#ffffff'); }
      if (Math.floor(T * 2 + d.ph) % 3 === 0 || hostile) R(flip ? x + DW - 12 : x + 11, y, 1, 1, hostile && Math.floor(T * 8) % 2 ? '#ffffff' : '#ff3030');
      if (d.hp < 3 && hostile && Math.random() < .3) spark(d.x + rnd(-3, 3), d.y - 4, rnd(-4, 4), -rnd(8, 16), 1.2, '#444', 0, 'smoke');
      if (d.st === 'scan' && d.scan) {
        const ex = flip ? x + DW - 14 : x + 13, ey = y + 6;
        const tx = d.scan.trav ? TRV.x : d.scan.x, ty = d.scan.trav ? FY() - 14 : d.scan.y, sw = Math.sin(T * 4 + d.ph) * 3;
        const red = d.scan.trav, col = red ? '255,60,60' : '255,190,60', a = .16 + .08 * pulse;
        g.fillStyle = `rgba(${col},${a})`; g.beginPath(); g.moveTo(ex, ey); g.lineTo(tx - 7 + sw, ty + (red ? 14 : 3)); g.lineTo(tx + 7 + sw, ty + (red ? 14 : 3)); g.closePath(); g.fill();
        g.globalAlpha = .55; line(ex, ey, tx - 7 + sw, ty + (red ? 14 : 3), `rgb(${col})`); line(ex, ey, tx + 7 + sw, ty + (red ? 14 : 3), `rgb(${col})`); g.globalAlpha = 1;
        R(tx - 6 + sw, Math.round(ty - 6 + ((T * 18) % (red ? 22 : 10))), 13, 1, `rgba(${col},.85)`);
      }
    }
  }
  /* ===== THE TRAVELLER'S STARSHIP (red/cream fighter) ===== */
  const SSPR = [
    '.....................n..................',
    '..rr.................n..................',
    '..rcr................n..................',
    '..rccr.........rrrrrrrr.................',
    '...rccr........rkkkkrRr.................',
    '...rcccr.......kemmekRr..gggggg.........',
    '....rcccr......kmeemkRrgggGGgggg........',
    '....rccccr.....kemmekRggggGgggggg.......',
    '.....rcccr.....rkkkkrRcgggggggggggc.....',
    '.....rccccrwwwwwwwwwwwwwwcccccccccccc...',
    '......rcccccccccccccccccccccccrrcccccc..',
    '.......rcccccCCrRRRRRrrccccccrcrccccyccm',
    '....rrrrrrrcEEEEEEErRRCcccccccccccccccmm',
    '..rrrrrrrrEEeeeeeEErRRCCCCCCCCCCCCCCCC..',
    '.RRRRrrrrrEeexxxeeERRRkkkkkkkkkkkkkkkk..',
    '.........EeexxxxxeekkkkkkkkkkkkkkkkkC...',
    '..........EeexxxeeE.....................',
    '...........EEeeeEE......................'];
  const GEAR = ['.............k...............k..........', '............kkk.............kkk.........'];
  const SW = 40, SH = SSPR.length;
  let shipC = {}, SHP = null, flights = 0, KILLS = 0;
  function buildShip() {
    shipC = {};
    for (const fly of [0, 1]) for (const fl of [0, 1]) {
      const c = mk(SW, SH + 2), x = c.getContext('2d'), C = { c: '#e8dcc4', C: '#b8aa92', w: '#fff6e6', r: '#e8321e', R: '#a01c10', k: '#18181c', g: '#24222e', G: '#8a90b0', e: '#3a2a24', E: '#a0603a', y: '#ffd040', m: '#8a8a92', n: '#9a9aa0', x: fly ? '#7fe0ff' : '#2a2026' };
      const rows = fly ? SSPR : SSPR.concat(GEAR);
      rows.forEach((row, j) => { for (let i = 0; i < SW; i++) { const ch = row[i]; if (!ch || ch === '.') continue; x.fillStyle = (ch === 'x' || ch === 'y') && fly ? C[ch] : nc(C[ch]); x.fillRect(fl ? SW - 1 - i : i, j, 1, 1); } });
      shipC[fly + '' + fl] = c;
    }
  }
  const padX = () => Math.round(W * .17), padY = () => FY() - 2; // ship bottom rests here
  function shipInit() { if (!SHP) SHP = { st: 'parked', x: padX(), y: padY(), dir: 1, t: 0, next: 0, passes: 0, vx: 0, vy: 0, canopy: 0, gun: 0, tgt: null, wait: 0 }; rollFlight(); }
  function rollFlight() { const r = CFV.sFreq[CF().sFreq]; if (SHP) SHP.next = r ? rnd(r[0], r[1]) : Infinity; }
  const inShip = () => SHP && !['parked'].includes(SHP.st) && TRV.st === 'pilot';
  const shipBusy = () => TRV.st === 'toShip' || TRV.st === 'board' || TRV.st === 'pilot' || TRV.st === 'exit';
  function wantFly() { return CF().ship && SHP && SHP.st === 'parked' && !combat.on && type !== 'tornado' && hop < 0 && ['idle', 'walk', 'scan'].includes(TRV.st) && (CF().sMax === 0 || flights < CF().sMax); }
  function launchNow() { if (!CF().ship || !SHP || SHP.st !== 'parked' || combat.on || type === 'tornado' || shipBusy()) return false; TRV.st = 'toShip'; TRV.target = null; return true; }
  function shipUpdate(dt) {
    if (!SHP) shipInit(); const s = SHP, tr = TRV, gy = padY();
    s.canopy = clamp(s.canopy + (s.st === 'parked' && (tr.st === 'board' || tr.st === 'exit') ? dt * 3 : -dt * 3), 0, 1);
    if (!CF().ship) { if (tr.st === 'toShip') { tr.st = 'idle'; tr.t = 1; } if (s.st === 'parked' && !shipBusy()) return; }
    if (s.st === 'parked') {
      s.x = padX(); s.y = gy; s.dir = 1;
      if (tr.st !== 'toShip' && tr.st !== 'board' && tr.st !== 'exit') { s.next -= dt; if (s.next <= 0) { rollFlight(); if (wantFly()) { tr.st = 'toShip'; tr.target = null; } } }
      return;
    }
    const cruiseY = () => rnd(H * .07, HY - 46);
    switch (s.st) {
      case 'liftoff': s.t += dt; s.y = gy - Math.min(1, s.t / 2.2) ** 1.6 * 34; if (frame % 2 === 0) for (let k = 0; k < 3; k++) spark(s.x + rnd(10, 22), FY(), rnd(-50, 50), -rnd(4, 14), .7, pick(['#bbaa90', '#8a7a68', '#ffffff']), 30);
        if (s.t > 2.4) { s.st = 'depart'; s.vx = 0; listener && listener('boost'); } break;
      case 'depart': s.vx += s.dir * 120 * dt; s.vx = clamp(s.vx, -130, 130); s.y -= 14 * dt; s.x += s.vx * dt;
        if (s.x > W + 50 || s.x < -SW - 50) { s.st = 'away'; s.wait = rnd(.8, 2.2); } break;
      case 'away': s.wait -= dt; if (s.wait <= 0) {
        if (s.passes > 0) { s.passes--; s.dir = Math.random() < .5 ? 1 : -1; s.x = s.dir > 0 ? -SW - 10 : W + 10; s.y = cruiseY(); s.base = s.y; s.vx = s.dir * rnd(55, 75); s.st = 'pass'; s.tgt = null; s.ph = rnd(0, 6);
          if (Math.random() < CFV.sFight[CF().sFight]) { const prey = { x: s.dir > 0 ? -14 : W + 2, y: s.y + rnd(-10, 10), vx: s.dir * rnd(24, 32), vy: rnd(-3, 3), dir: s.dir, hp: 4, c: pick(['#d8dde3', '#f0c040', '#6ad0ff', '#9aff7a']) }; ships.push(prey); s.tgt = prey; s.x -= s.dir * 34; s.hunt = true; } else s.hunt = false;
          listener && listener('flyby');
        } else { s.dir = Math.random() < .5 ? 1 : -1; s.x = s.dir > 0 ? -SW - 10 : W + 10; s.y = HY - 50; s.st = 'approach'; }
      } break;
      case 'pass': {
        s.x += s.vx * dt;
        if (s.hunt) {
          if (!s.tgt || s.tgt.dead || !ships.includes(s.tgt)) { s.tgt = ships.filter(o => !o.dead && o.dir === s.dir && (o.x - s.x) * s.dir > 0).sort((a, b) => Math.abs(a.x - s.x) - Math.abs(b.x - s.x))[0] || null; if (!s.tgt) { s.hunt = false; s.base = s.y; } }
          if (s.tgt) { const want = s.tgt.vx + clamp((s.tgt.x - s.dir * 34 - s.x) * 1.6, -45, 45); s.x += (want - s.vx) * 0; s.vx += (want - s.vx) * dt * 3; s.y += clamp(s.tgt.y - 9 - s.y, -1, 1) * 28 * dt; s.gun -= dt;
            if (s.gun <= 0 && (s.tgt.x - s.x) * s.dir > 0 && Math.abs(s.tgt.y - 9 - s.y) < 8 && s.tgt.x > W * .3 && s.tgt.x < W * .7 + 10) { s.gun = .3; const nx = s.x + (s.dir > 0 ? SW : 0), ny = s.y + 12, l = Math.hypot(s.tgt.x + 6 - nx, s.tgt.y + 3 - ny) || 1;
              for (const off of [-1.5, 1.5]) shots.push({ x: nx, y: ny + off, vx: (s.tgt.x + 6 - nx) / l * 260, vy: (s.tgt.y + 3 - ny) / l * 260, life: 1.2, from: 's' }); listener && listener('sgun'); } }
        } else { s.y = s.base + Math.sin(T * 1.4 + s.ph) * 6; s.vx += (s.dir * 65 - s.vx) * dt * 1.5; }
        if (s.x > W + 60 || s.x < -SW - 60) { s.st = 'away'; s.wait = rnd(1, 3); }
        break; }
      case 'approach': { const tx = padX(), dx = tx - s.x; s.vx += (clamp(dx * 1.4, -80, 80) - s.vx) * dt * 1.8; s.x += s.vx * dt; s.y += ((gy - 30) - s.y) * dt * 1.2; if (Math.abs(s.vx) > 6) s.dir = s.vx > 0 ? 1 : -1;
        if (Math.abs(dx) < 4 && Math.abs(s.vx) < 15) { s.st = 'descend'; s.t = 0; s.x = tx; listener && listener('landing'); } break; }
      case 'descend': s.t += dt; s.dir = 1; s.y = (gy - 30) + Math.min(1, s.t / 2) ** .7 * 30; if (frame % 2 === 0) for (let k = 0; k < 3; k++) spark(s.x + rnd(10, 22), FY(), rnd(-50, 50), -rnd(4, 14), .7, pick(['#bbaa90', '#8a7a68', '#ffffff']), 30);
        if (s.t >= 2) { s.y = gy; s.st = 'parked'; flights++; tr.st = 'exit'; tr.t = 1.2; tr.x = s.x + 26; tr.dir = 1; listener && listener('landed'); } break;
    }
  }
  // Called from the Traveller state machine
  function travShip(dt) {
    const tr = TRV, s = SHP;
    if (tr.st === 'toShip') {
      const tx = s.x + 26, dx = tx - tr.x; if (Math.abs(dx) < 1.2) { tr.st = 'board'; tr.t = 1.1; listener && listener('canopy'); return true; }
      tr.dir = dx < 0 ? -1 : 1; const st = Math.sign(dx) * Math.min(Math.abs(dx), 20 * CFV.tWalk[CF().tWalk] * dt); tr.x += st; tr.walkPh += Math.abs(st) * .55; return true;
    }
    if (tr.st === 'board') { tr.t -= dt; if (tr.t <= 0) { tr.st = 'pilot'; s.st = 'liftoff'; s.t = 0; s.passes = CFV.sPasses[CF().sPasses]; listener && listener('takeoff'); } return true; }
    if (tr.st === 'pilot') return true;
    if (tr.st === 'exit') { tr.t -= dt; if (tr.t <= 0) { tr.st = 'idle'; tr.t = rnd(.8, 1.6); } return true; }
    return false;
  }
  function drawShip() {
    if (!SHP) return; const s = SHP; if (!CF().ship && s.st === 'parked' && !shipBusy()) return;
    const fly = s.st !== 'parked' && s.st !== 'descend' || (s.st === 'descend' && s.t < 1.5), fl = s.dir < 0 ? 1 : 0;
    const x = Math.round(s.x), y = Math.round(s.y - SH - (fly ? 0 : 2) + (s.st === 'pass' || s.st === 'approach' ? Math.sin(T * 3) * .8 : 0));
    g.fillStyle = 'rgba(0,0,0,.3)'; const sh = Math.max(0, 1 - (padY() - s.y) / 60); if (s.y > HY - 20) g.fillRect(x + 6, FY() - 1, Math.round(28 * sh), 2);
    g.drawImage(shipC[(fly ? 1 : 0) + '' + fl], x, y);
    // canopy hinge open
    if (s.canopy > 0) { const cx = fl ? x + SW - 34 : x + 24, ch = Math.round(s.canopy * 4); g.fillStyle = nc('#24222e'); g.fillRect(cx, y + 5 - ch, 9, 3); g.fillStyle = 'rgba(138,144,176,.9)'; g.fillRect(cx + 2, y + 5 - ch, 3, 1); }
    // pilot visible in cockpit while flying
    if (TRV.st === 'pilot') { const px = fl ? x + SW - 30 : x + 27; R(px, y + 6, 3, 3, nc(CFV.suit[CF().suit][0])); R(px + (fl ? 0 : 1), y + 7, 2, 1, '#1c1730'); }
    // thrusters
    if (fly) { const ex = fl ? x + SW - 6 : x + 2, ey = y + 14, n = 6 + Math.round(Math.random() * 3) + (s.st === 'depart' || s.st === 'pass' ? 8 : 0);
      for (let k = 0; k < n; k++) R(ex - (fl ? -k : k), ey + (k % 2), 1, 1, k < 2 ? '#ffffff' : k < 5 ? '#7fe0ff' : 'rgba(80,160,255,.5)');
      if (s.st === 'liftoff' || s.st === 'descend') { const gx = x + 15; for (let k = 0; k < 5; k++) R(gx + rnd(-2, 2), y + SH + k, 3, 1, k < 2 ? '#ffffff' : 'rgba(127,224,255,.6)'); } }
    // nav lights
    if (Math.floor(T * 2) % 2) { R(fl ? x + SW - 3 : x + 2, y + 1, 1, 1, '#ff3030'); R(fl ? x + 1 : x + SW - 2, y + 12, 1, 1, '#30ff60'); }
  }
  function drawTornado() {
    const bxp = W * .3 + Math.sin(T * .35) * W * .14, by = HY + 14, top = H * .06, n = 36; tornadoX = bxp;
    for (let i = n; i >= 0; i--) {
      const f = i / n, y = by - (by - top) * f, r = 2 + Math.pow(f, 1.7) * 32, cx = bxp + Math.sin(T * 1.4 + f * 4) * f * 9 + Math.sin(T * 3 + f * 9) * 1.2, m = Math.max(6, Math.floor(r * 1.5));
      g.fillStyle = f > .85 ? 'rgba(60,70,58,.85)' : 'rgba(84,92,76,.72)'; g.fillRect(Math.round(cx - r), Math.round(y - 2), Math.round(r * 2), 4);
      for (let k = 0; k < m; k++) { const a = T * 7 - f * 6 + k / m * Math.PI * 2, s = Math.sin(a); R(cx + Math.cos(a) * r, y + s * r * .18, 1, 1, s > 0 ? '#9aa48e' : '#5d6656'); }
    }
    for (let k = 0; k < 30; k++) { const a = T * 5 + k * .7, rr = 6 + (k % 5) * 3; R(bxp + Math.cos(a) * rr, by + Math.sin(a) * rr * .3 - 1, 2, 1, '#6a5a44'); }
  }
  function line(x0, y0, x1, y1, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; g.fillStyle = col;
    for (let guard = 0; guard < 600; guard++) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function makeBolt() {
    const pts = []; let x = rnd(W * .1, W * .9), y = 0; const end = HY + rnd(-10, 26); pts.push([x, y]);
    while (y < end) { y += rnd(3, 8); x += rnd(-5, 5); pts.push([x, y]); }
    const br = []; for (let i = 2; i < pts.length - 3; i++) if (Math.random() < .22) { let [a, b] = pts[i]; const bb = [[a, b]], dir = Math.random() < .5 ? -1 : 1; for (let j = 0; j < rnd(3, 7); j++) { a += dir * rnd(1, 5); b += rnd(2, 6); bb.push([a, b]); } br.push(bb); }
    return { pts, br, life: .42 };
  }

  /* ----- particles ----- */
  function targets() {
    const i = inten;
    switch (type) {
      case 'drizzle': return { drizzle: 50 }; case 'rain': return { rain: Math.round(80 + i * 140) }; case 'storm': return { rain: 240 };
      case 'sleet': return { rain: 90, pellet: 70 }; case 'hail': return { rain: 90, hail: 60 }; case 'snow': return { snow: Math.round(90 + i * 130) };
      case 'cold': return { dust: 45 }; case 'wind': return { streak: 34, leaf: 14 }; case 'fire': return { ember: 90, ash: 30 };
      case 'heat': return { wave: 18 }; case 'tornado': return { rain: 80, debris: 50, streak: 14 }; case 'fog': return {};
      default: return {};
    }
  }
  function newP(k, init) {
    const p = { k };
    switch (k) {
      case 'rain': case 'drizzle': p.x = rnd(-40, W + 10); p.land = rnd(HY + 6, H); p.y = init ? rnd(-20, p.land) : rnd(-H * .5, 0); p.vy = k === 'rain' ? rnd(170, 240) : rnd(90, 130); p.len = k === 'rain' ? (rnd(3, 6) | 0) : 2; break;
      case 'pellet': case 'hail': p.x = rnd(-30, W); p.land = rnd(HY + 6, H); p.y = init ? rnd(-20, p.land) : rnd(-H * .5, 0); p.vy = k === 'hail' ? rnd(190, 240) : rnd(150, 190); p.b = 0; p.s = k === 'hail' && Math.random() < .35 ? 2 : 1; break;
      case 'snow': p.x = rnd(-10, W + 10); p.land = rnd(HY + 6, H); p.y = init ? rnd(-10, p.land) : rnd(-H * .4, 0); p.vy = rnd(14, 32); p.s = Math.random() < .25 ? 2 : 1; p.ph = rnd(0, 6); break;
      case 'dust': p.x = rnd(0, W); p.y = rnd(0, H * .7); p.vx = rnd(-4, 4); p.vy = rnd(2, 7); p.ph = rnd(0, 6); break;
      case 'streak': p.x = init ? rnd(-60, W) : rnd(-80, -5); p.y = rnd(0, H * .7); p.vx = rnd(220, 340); p.len = rnd(6, 16) | 0; break;
      case 'leaf': p.x = init ? rnd(-30, W) : rnd(-30, -2); p.y = rnd(HY - 30, H * .6); p.vx = rnd(110, 180); p.ph = rnd(0, 6); p.c = pick(['#7bbf4a', '#c9a23a', '#b0602a', '#e05a8a']); break;
      case 'ember': p.x = rnd(0, W); p.y = init ? rnd(0, H * .7) : rnd(HY, H * .7); p.vy = -rnd(18, 50); p.ph = rnd(0, 6); p.life = rnd(1.5, 4); break;
      case 'ash': p.x = rnd(0, W); p.y = init ? rnd(0, H) : rnd(-H * .3, 0); p.vy = rnd(6, 14); p.ph = rnd(0, 6); break;
      case 'wave': p.x = rnd(0, W); p.y = rnd(HY, H * .65); p.vy = -rnd(6, 12); p.life = rnd(2, 4); p.w = rnd(4, 9) | 0; break;
      case 'debris': p.a = rnd(0, 6.28); p.r = rnd(3, 10); p.h = rnd(0, 1); p.c = pick(['#5a4a38', '#3a3028', '#7a6a50', '#8a3a2a', '#c8b070']); p.free = false; break;
    }
    return p;
  }
  function spark(x, y, vx, vy, life, c, grav = 300, kind = 'sp') { if (fx.length < 260) fx.push({ x, y, vx, vy, life, max: life, c, grav, kind }); }
  function updParts(dt) {
    const tg = targets(), windX = clamp(windMph, 0, 60) * 1.4 * (type === 'tornado' ? 2 : 1);
    const kinds = new Set([...Object.keys(tg), ...Object.keys(parts)]);
    for (const k of kinds) {
      const arr = parts[k] || (parts[k] = []), want = tg[k] || 0;
      while (arr.length < want) arr.push(newP(k, fresh));
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i]; let dead = false;
        switch (k) {
          case 'rain': case 'drizzle': p.x += windX * dt; p.y += p.vy * dt; if (p.y >= p.land) { if (k === 'rain' && Math.random() < .5) { spark(p.x, p.land, -12, -30, .25, '#a8d8ff'); spark(p.x, p.land, 12, -30, .25, '#a8d8ff'); } dead = true; } break;
          case 'pellet': case 'hail': p.x += windX * .6 * dt; p.vy += p.b ? 420 * dt : 0; p.y += p.vy * dt; if (p.y >= p.land) { if (p.b < 2) { p.b++; p.y = p.land; p.vy = -p.vy * .32; if (k === 'hail' && Math.random() < .04) listener && listener('tick'); } else dead = true; } break;
          case 'snow': p.x += (Math.sin(T * 1.5 + p.ph) * 9 + windX * .35) * dt; p.y += p.vy * dt; if (p.y >= p.land) dead = true; break;
          case 'dust': p.x += (p.vx + Math.sin(T + p.ph) * 3) * dt; p.y += p.vy * dt; if (p.y > H * .75 || p.x < -5 || p.x > W + 5) dead = true; break;
          case 'streak': p.x += p.vx * dt; if (p.x > W + 20) dead = true; break;
          case 'leaf': p.x += p.vx * dt; p.y += Math.sin(T * 6 + p.ph) * 30 * dt; if (p.x > W + 5) dead = true; break;
          case 'ember': p.x += Math.sin(T * 3 + p.ph) * 10 * dt; p.y += p.vy * dt; p.life -= dt; if (p.life <= 0 || p.y < -4) dead = true; break;
          case 'ash': p.x += Math.sin(T + p.ph) * 6 * dt; p.y += p.vy * dt; if (p.y > H) dead = true; break;
          case 'wave': p.y += p.vy * dt; p.life -= dt; if (p.life <= 0) dead = true; break;
          case 'debris': if (!p.free) { p.a += dt * (5 + 6 / p.r); p.r += dt * 1.6; p.h = Math.min(1, p.h + dt * .12); if (p.r > 16 && Math.random() < .01) { p.free = true; p.x = tornadoX + Math.cos(p.a) * p.r; p.y = HY + 14 - p.h * 70; p.vx = rnd(40, 90) * (Math.random() < .5 ? -1 : 1); p.vy = -rnd(10, 40); } }
            else { p.x += p.vx * dt; p.vy += 120 * dt; p.y += p.vy * dt; if (p.y > H) dead = true; } break;
        }
        if (dead) { if (arr.length > want) arr.splice(i, 1); else arr[i] = newP(k, false); }
      }
      if (!arr.length && !want) delete parts[k];
    }
    fresh = false;
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; if (f.kind === 'home') { const tx = TRV.x, ty = FY() - 14; f.vx += (tx - f.x) * 14 * dt; f.vy += (ty - f.y) * 14 * dt; f.vx *= .9; f.vy *= .9; if (Math.abs(tx - f.x) < 3 && Math.abs(ty - f.y) < 4) f.life = 0; } f.life -= dt; f.x += f.vx * dt; f.vy += f.grav * dt; f.y += f.vy * dt; if (f.life <= 0) fx.splice(i, 1); }
  }
  function drawParts() {
    const windX = clamp(windMph, 0, 60) * 1.4 * (type === 'tornado' ? 2 : 1);
    for (const k in parts) {
      const arr = parts[k];
      switch (k) {
        case 'rain': case 'drizzle': { g.fillStyle = k === 'rain' ? (night ? 'rgba(150,190,255,.65)' : 'rgba(200,225,255,.75)') : 'rgba(210,230,255,.6)'; for (const p of arr) { const sl = windX / p.vy; for (let j = 0; j < p.len; j++) g.fillRect(Math.round(p.x - sl * j), Math.round(p.y - j), 1, 1); } break; }
        case 'pellet': g.fillStyle = '#f2f8ff'; for (const p of arr) g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); break;
        case 'hail': for (const p of arr) { R(p.x, p.y, p.s + 1, p.s + 1, '#e8f4ff'); R(p.x, p.y, 1, 1, '#ffffff'); } break;
        case 'snow': g.fillStyle = '#ffffff'; for (const p of arr) g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); break;
        case 'dust': for (const p of arr) if (Math.sin(T * 5 + p.ph * 3) > .2) R(p.x, p.y, 1, 1, Math.sin(T * 3 + p.ph) > .6 ? '#ffffff' : '#bff0ff'); break;
        case 'streak': g.fillStyle = 'rgba(235,245,255,.35)'; for (const p of arr) g.fillRect(Math.round(p.x), Math.round(p.y), p.len, 1); break;
        case 'leaf': for (const p of arr) R(p.x, p.y, Math.sin(T * 9 + p.ph) > 0 ? 2 : 1, 1, p.c); break;
        case 'ember': for (const p of arr) { const fl = Math.sin(T * 14 + p.ph * 5); R(p.x, p.y, 1, 1, fl > .3 ? '#ffe14a' : fl > -.4 ? '#ff8a1a' : '#d02a08'); } break;
        case 'ash': g.fillStyle = 'rgba(70,60,60,.8)'; for (const p of arr) g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); break;
        case 'wave': for (const p of arr) { const a = clamp(p.life / 2, 0, 1) * .35; for (let j = 0; j < p.w; j++) R(p.x + j, p.y + Math.round(Math.sin(j * .9 + T * 7)), 1, 1, `rgba(255,220,160,${a})`); } break;
        case 'debris': for (const p of arr) { if (p.free) R(p.x, p.y, 2, 1, p.c); else { const x = tornadoX + Math.sin(T * 1.4 + p.h * 4) * p.h * 9 + Math.cos(p.a) * p.r, y = HY + 14 - p.h * 70 + Math.sin(p.a) * p.r * .2; R(x, y, Math.sin(p.a * 3) > 0 ? 2 : 1, 1, p.c); } } break;
      }
    }
    for (const f of fx) {
      if (f.kind === 'smoke') { const k = 1 - f.life / f.max, r = 2 + k * 6; g.fillStyle = `rgba(70,70,74,${(1 - k) * .55})`; g.fillRect(Math.round(f.x - r / 2), Math.round(f.y - r / 2), Math.round(r), Math.round(r)); continue; }
      if (f.kind === 'chunk') { if (f.y > FY() + 4) { f.y = FY() + 4; f.vy = 0; f.vx *= .8; } R(f.x, f.y, 2, 2, f.c); continue; }
      if (f.kind === 'br') { const r = Math.round((1 - f.life / f.max) * 3) + 1; g.fillStyle = `rgba(240,248,255,${f.life / f.max * .7})`; g.fillRect(Math.round(f.x - r / 2), Math.round(f.y - r / 2), r, r); }
      else { g.fillStyle = f.c; g.globalAlpha = clamp(f.life / f.max * 1.5, 0, 1); const z = f.kind === 'home' ? 2 : 1; g.fillRect(Math.round(f.x), Math.round(f.y), z, z); g.globalAlpha = 1; }
    }
  }

  /* ----- update & draw ----- */
  function update(dt) {
    protA += dt * .09;
    if (frame % 3 === 0) renderPlanet();
    clouds.forEach(c => { c.x += (2 + windMph * .5) * c.d * dt * (type === 'tornado' ? 2.5 : 1); if (c.x > W + 4) c.x = -c.spr.width - rnd(0, 40); });
    // ships
    nextShip -= dt;
    if (nextShip <= 0 && type !== 'tornado') { const dir = Math.random() < .5 ? 1 : -1; ships.push({ x: dir > 0 ? -14 : W + 14, y: rnd(H * .05, H * .3), vx: dir * rnd(35, 75), vy: rnd(-4, 4), dir, c: pick(['#d8dde3', '#f0c040', '#e04a3a', '#6ad0ff', '#9aff7a']) }); nextShip = rnd(4, 11); }
    ships.forEach(s => { if (s.hp != null && s.hp < 3) s.vy = Math.sin(T * 5) * 18; s.x += s.vx * dt; s.y += s.vy * dt; if (frame % 2 === 0) trail.push({ x: s.dir > 0 ? s.x : s.x + 11, y: s.y + 3, life: .7 }); });
    ships = ships.filter(s => !s.dead && s.x > -30 && s.x < W + 30);
    trail.forEach(t => t.life -= dt); trail = trail.filter(t => t.life > 0);
    nextFreighter -= dt;
    if (!freighter && nextFreighter <= 0 && !['storm', 'tornado', 'fog'].includes(type)) { freighter = { x: -FRW - 6, y: Math.round(H * rnd(.15, .22)), sh: null, shT: rnd(8, 20) }; }
    if (freighter) { const f = freighter; f.x += 1.6 * dt; f.shT -= dt; if (!f.sh && f.shT <= 0) { f.sh = { x: 49, y: 30, vx: rnd(-14, 14), vy: 6 }; } if (f.sh) { f.sh.x += f.sh.vx * dt; f.sh.y += f.sh.vy * dt; f.sh.vy -= 2 * dt; if (Math.abs(f.sh.x - 49) > 60 || f.sh.y > 70) { f.sh = null; f.shT = rnd(12, 25); } } if (freighter.x > W + 16) { freighter = null; nextFreighter = rnd(40, 90); } }
    // shooting stars
    if (night && ['clear', 'partly', 'cold', 'wind', 'heat'].includes(type)) { nextShoot -= dt; if (nextShoot <= 0) { shooting = { x: rnd(10, W), y: rnd(2, HY * .5), life: .7 }; nextShoot = rnd(3, 9); } }
    if (shooting) { shooting.x -= 120 * dt; shooting.y += 50 * dt; shooting.life -= dt; if (shooting.life <= 0) shooting = null; }
    // traveller antics
    if (hop >= 0) { hop += dt; if (frame % 2 === 0) spark(TRV.x - 6 + rnd(0, 12), FY() - 4 - Math.sin(hop / 1.3 * Math.PI) * 18, rnd(-10, 10), rnd(20, 50), .4, pick(['#ffe14a', '#ff6a1a', '#bbbbbb']), 0); if (hop > 1.3) hop = -1; }
    else { nextHop -= dt; if (nextHop <= 0) { if (CFV.tHop[CF().tHop] && TRV.st === 'idle' && ['clear', 'partly', 'cloudy', 'heat', 'wind', 'cold'].includes(type)) { hop = 0; listener && listener('jet'); } const hr = CFV.tHop[CF().tHop]; nextHop = hr ? rnd(hr[0], hr[1]) : 5; } }
    if (coldT()) { breath -= dt; if (breath <= 0) { for (let k = 0; k < 4; k++) spark(TRV.x + TRV.dir * 4 + k * .6 * TRV.dir, FY() - 23, TRV.dir * rnd(6, 14), rnd(-4, 2), 1.1, '#fff', 0, 'br'); breath = rnd(1.8, 3); } }
    if ((type === 'heat' || type === 'fire') && Math.random() < dt * 1.6) spark(TRV.x + rnd(-5, 5), FY() - 27, rnd(-14, 14), -rnd(20, 35), .6, '#7fd0ff');
    travUpdate(dt); shipUpdate(dt); droneUpdate(dt);
    foot.forEach(f => f.life -= dt); foot = foot.filter(f => f.life > 0);
    floaters.forEach(f => { f.life -= dt; f.y -= 10 * dt; }); floaters = floaters.filter(f => f.life > 0);
    nextBeam -= dt; if (nextBeam <= 0) { beam = 0; nextBeam = rnd(10, 18); } if (beam >= 0) { beam += dt; if (beam > 1.6) beam = -1; }
    // lightning
    if (['storm', 'hail', 'tornado'].includes(type)) {
      nextBolt -= dt;
      if (nextBolt <= 0) { bolt = makeBolt(); flash = 1; shake = Math.max(shake, type === 'storm' ? .9 : .6); listener && listener('bolt'); TRV.flinch = .9; if (TRV.st === 'mine') { TRV.st = 'idle'; TRV.t = 1.2; } nextBolt = type === 'storm' ? rnd(2.5, 7) : rnd(5, 11); }
    }
    if (bolt) { bolt.life -= dt; if (bolt.life <= 0) bolt = null; }
    flash = Math.max(0, flash - dt * 2.6);
    shake = Math.max(type === 'tornado' ? .22 : 0, shake - dt * 1.6);
    if (type === 'fire' && Math.random() < dt * 9) listener && listener('crackle');
    updParts(dt);
  }
  function draw() {
    g.drawImage(skyC, 0, 0);
    // aurora
    if (night && (coldT() || (type === 'clear' && tempF < 45))) {
      for (let x = 0; x < W; x++) { const y0 = H * .06 + Math.sin(x * .05 + T * .6) * 10 + Math.sin(x * .13 - T) * 4, h = 16 + Math.sin(x * .09 + T * .8) * 8; for (let j = 0; j < h; j += 2) { const f = j / h; g.fillStyle = `rgba(${Math.round(80 + 140 * f)},${Math.round(255 - 160 * f)},${Math.round(160 + 60 * f)},${(1 - f) * .28})`; g.fillRect(x, Math.round(y0 + j), 1, 2); } }
    }
    // stars
    const starA = night ? 1 : (type === 'fire' ? .15 : 0);
    if (starA > 0 && !['storm', 'tornado', 'fog', 'rain'].includes(type)) for (const s of stars) { const tw = .5 + .5 * Math.sin(T * 2 + s.p); g.fillStyle = `rgba(255,255,240,${(s.b * .7 + .3) * tw * starA})`; g.fillRect(Math.round(s.x), Math.round(s.y), s.b > .93 ? 2 : 1, 1); }
    if (shooting) { for (let k = 0; k < 10; k++) R(shooting.x + k * 2.4, shooting.y - k, 1, 1, `rgba(255,255,255,${(1 - k / 10) * shooting.life / .7})`); }
    // sun / moon
    if (!night && ['clear', 'partly', 'heat', 'fire', 'cold', 'wind'].includes(type)) {
      const big = type === 'heat' ? 10 : type === 'fire' ? 13 : 6, sx = W * .5, sy = H * .1, core = type === 'fire' ? '#ff5a1a' : type === 'cold' ? '#fff8e0' : '#ffe680', rim = type === 'fire' ? '#ff2a00' : '#ffb020';
      g.fillStyle = rgba(rim, .18); g.beginPath(); g.arc(sx, sy, big * 2 + Math.sin(T * 2) * 2, 0, 7); g.fill();
      for (let y = -big; y <= big; y++) for (let x = -big; x <= big; x++) { const d = x * x + y * y; if (d <= big * big) R(sx + x, sy + y, 1, 1, d > (big - 1.5) ** 2 ? rim : core); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + T * .3, r0 = big + 3, r1 = big + 6 + (i % 2) * 3 + Math.sin(T * 4 + i) * 1.5; line(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0, sx + Math.cos(a) * r1, sy + Math.sin(a) * r1, rim); }
    } else if (night && !['storm', 'tornado', 'rain', 'hail'].includes(type)) {
      const mx = W * .5, my = H * .1, r = 6;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) { const lit = (x - 3) ** 2 + (y + 1) ** 2 > r * r * .8; R(mx + x, my + y, 1, 1, lit ? '#f4eecb' : '#2a2c44'); }
      R(mx - 3, my + 1, 2, 1, '#d8d0a8'); R(mx - 1, my - 3, 1, 1, '#d8d0a8');
    }
    // planet with rings
    const ppx = W * .84, ppy = H * .13;
    drawRing(ppx, ppy, false); g.drawImage(planetC, Math.round(ppx - 32), Math.round(ppy - 32)); drawRing(ppx, ppy, true);
    // freighter
    drawFreighter();
    // ship trails + ships
    for (const t of trail) R(t.x, t.y, 1, 1, `rgba(255,${Math.round(150 + 100 * t.life)},80,${t.life})`);
    for (const s of ships) drawSprite(SHIP, s.x, s.y, { a: nc(s.c), b: '#4fd0ff', c: '#e0452c', e: frame % 4 < 2 ? '#ffb030' : '#ffffff' }, s.dir < 0);
    // the Atlas
    drawAtlas(W * .2, H * .13, 11);
    // clouds
    for (const c of clouds) g.drawImage(c.spr, Math.round(c.x), Math.round(c.y));
    if (type === 'storm' || type === 'tornado' || type === 'hail') { g.fillStyle = type === 'tornado' ? 'rgba(20,35,20,.55)' : 'rgba(18,14,34,.45)'; g.fillRect(0, 0, W, H * .08); }
    // terrain
    g.drawImage(terrC, 0, 0);
    if (type === 'fog') { const o = (T * 4) % W; g.drawImage(fogC, Math.round(o), HY - 30); g.drawImage(fogC, Math.round(o - W), HY - 30); }
    if (type === 'fire') { for (let x = 0; x < W; x++) { const h = Math.max(0, Math.round(6 + fbm(x * .15, T * 2.2) * 14 - 6 + Math.sin(x * .4 + T * 9) * 2)); for (let j = 0; j < h; j++) { const f = j / h; R(x, farY[x] - j + 2, 1, 1, f < .3 ? '#ffe680' : f < .6 ? '#ff9a1a' : f < .85 ? '#ff4a10' : '#a01808'); } } }
    for (const f of foot) R(f.x - 9, FY() + 1, 2, 1, `rgba(120,140,170,${Math.min(.6, f.life / 12)})`);
    drawDrones();
    drawShip();
    for (const f of flora) drawFlora(f);
    for (const d of deposits) drawDeposit(d);
    if (scanRing >= 0) { const r = scanRing * 120, a = Math.max(0, 1 - scanRing / 1.3); for (let k = 0; k < 90; k++) { const an = k / 90 * Math.PI * 2; R(TRV.x + Math.cos(an) * r, FY() + Math.sin(an) * r * .12, 1, 1, `rgba(95,240,255,${a})`); } }
    if (type === 'tornado') drawTornado();
    drawTraveller();
    drawShots();
    for (const f of floaters) { g.globalAlpha = Math.min(1, f.life); ptext(f.txt, f.x, Math.round(f.y), f.col); g.globalAlpha = 1; }
    // heat shimmer distortion
    if (type === 'heat' || type === 'fire') {
      bx.clearRect(0, 0, W, H); bx.drawImage(cv, 0, 0); const amp = type === 'fire' ? 2 : 1;
      for (let y = HY - 30; y < Math.min(H, HY + 90); y++) { const o = Math.round(Math.sin(y * .55 + T * 7) * amp * (Math.sin(T * 1.3 + y * .05) * .5 + .5)); if (o) g.drawImage(buf, 0, y, W, 1, o, y, W, 1); }
    }
    drawParts();
    if (bolt) { const al = bolt.life > .3 || Math.floor(bolt.life * 30) % 2 ? 1 : .3; const glow = `rgba(170,200,255,${.5 * al})`, core = `rgba(255,255,255,${al})`;
      for (let i = 0; i < bolt.pts.length - 1; i++) { const [a, b] = bolt.pts[i], [c, d] = bolt.pts[i + 1]; line(a - 1, b, c - 1, d, glow); line(a + 1, b, c + 1, d, glow); line(a, b, c, d, core); }
      for (const br of bolt.br) for (let i = 0; i < br.length - 1; i++) line(br[i][0], br[i][1], br[i + 1][0], br[i + 1][1], glow); }
    if (flash > 0) { g.fillStyle = `rgba(230,240,255,${flash * .5})`; g.fillRect(0, 0, W, H); }
    if (type === 'fog') { g.fillStyle = night ? 'rgba(80,88,110,.35)' : 'rgba(205,210,216,.38)'; g.fillRect(0, 0, W, H); const o = (T * 9) % W; g.drawImage(fogC, Math.round(-o), HY + 6); g.drawImage(fogC, Math.round(W - o), HY + 6); g.drawImage(fogC, Math.round(o * .6 % W), HY + 30); g.drawImage(fogC, Math.round(o * .6 % W - W), HY + 30); }
    if (coldT()) { g.globalAlpha = .55 + .2 * Math.sin(T * .8); g.drawImage(frostC, 0, 0); g.globalAlpha = 1; }
    if (type === 'heat') { g.fillStyle = 'rgba(255,170,60,.08)'; g.fillRect(0, 0, W, H); }
    // screen shake
    if (settings.fx && shake > .01) { const s = shake * 5; cv.style.transform = `translate(${rnd(-s, s).toFixed(1)}px,${rnd(-s, s).toFixed(1)}px)`; } else cv.style.transform = '';
  }
  function loop(now) {
    requestAnimationFrame(loop);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000 || .016); last = now; T += dt; frame++;
    try { update(dt); draw(); if (onFrame) onFrame(T); } catch (e) { console.error(e); }
  }
  return {
    start() { resize(); addEventListener('resize', () => setTimeout(resize, 120)); requestAnimationFrame(loop); },
    set(o) {
      const changed = o.type !== type || o.night !== night;
      type = o.type; night = o.night; inten = o.inten ?? inten; windMph = o.wind ?? windMph; tempF = o.temp ?? tempF; uv = o.uv ?? uv;
      if (changed) { build(); fresh = true; nextBolt = .8; const tg = targets(); for (const k in parts) if (!tg[k]) delete parts[k]; fx = []; }
    },
    on(fn) { listener = fn; }, frame(fn) { onFrame = fn; }, fr() { freighter = { x: 20, y: Math.round(H * .17), sh: null, shT: 0 }; }, attack() { if (!CF().drones) return false; if (!drn.some(d => !d.leave)) { respawnT = 0; for (let i = 0; i < CF().droneCount; i++) drn.push(makeDrone(true, i)); } drn.forEach(d => d.leave = false); return startAttack(); }, rollAttack() { rollAttack(); }, rollFlight() { rollFlight(); }, launch() { return launchNow(); }, dbg() { return [SHP && SHP.st, TRV.st, SHP && Math.round(SHP.x), SHP && Math.round(SHP.y), ships.length, shots.filter(s => s.from === 's').length, flights, 'k' + KILLS, SHP && SHP.tgt ? Math.round(SHP.tgt.x) + ',' + Math.round(SHP.tgt.y) : '-'].join(' '); }
  };
})();

/* =========================================================
   APP: data, UI, refresh loop
   ========================================================= */
const state = {
  data: LS.get('data', null), aqi: LS.get('aqi', null), alerts: LS.get('alerts', []), place: LS.get('place', null),
  fetchedAt: LS.get('fetchedAt', 0), coords: LS.get('coords', null), live: 'clear', night: true, sim: null, simNight: null, busy: false, booted: false
};
const isC = () => settings.units === 'C';
const T_ = f => f == null || isNaN(f) ? '--' : Math.round(isC() ? (f - 32) * 5 / 9 : f) + '°';
const Wd = m => m == null ? '--' : Math.round(isC() ? m * 1.609 : m) + (isC() ? ' km/h' : ' mph');
const Pr = i => i == null ? '--' : isC() ? (i * 25.4).toFixed(1) + ' mm' : i.toFixed(2) + '"';
const Press = h => h == null ? '--' : isC() ? Math.round(h) + ' hPa' : (h * .02953).toFixed(2) + ' inHg';
const compass = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((d % 360) + 360) % 360 / 22.5) % 16];
const hr12 = s => { const h = +s.slice(11, 13); return (h % 12 || 12) + (h < 12 ? 'AM' : 'PM'); };
const hm12 = s => { if (!s) return '--'; const h = +s.slice(11, 13), m = s.slice(14, 16); return (h % 12 || 12) + ':' + m + (h < 12 ? ' AM' : ' PM'); };
const dow = s => ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(s + 'T12:00:00Z').getUTCDay()];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uvLabel = u => u < 3 ? 'Low' : u < 6 ? 'Moderate' : u < 8 ? 'High' : u < 11 ? 'Very High' : 'Extreme';
const sentinel = u => u < 3 ? 'Dormant' : u < 6 ? 'Patrolling' : u < 8 ? 'Aggressive' : u < 11 ? 'Frenzied' : 'FRENZIED (SPF 9000)';
const aqiLabel = a => a <= 50 ? 'Good' : a <= 100 ? 'Moderate' : a <= 150 ? 'Unhealthy for sensitive' : a <= 200 ? 'Unhealthy' : a <= 300 ? 'Very unhealthy' : 'Hazardous';
const visTxt = (v, unit) => { if (v == null) return '--'; const mi = unit && /ft/.test(unit) ? v / 5280 : v / 1609.34; const val = isC() ? mi * 1.609 : mi; return (val >= 10 ? '10+' : val.toFixed(1)) + (isC() ? ' km' : ' mi'); };
const arrowSVG = deg => `<svg class="arrow" viewBox="0 0 8 8" style="transform:rotate(${(deg + 180) % 360}deg)"><path fill="#5ff0ff" d="M4 0L7 4H5V8H3V4H1Z"/></svg>`;

/* ---------- UI helpers ---------- */
let toastTimer;
function toast(msg, ms = 2600) { const t = $('#toast'); t.innerHTML = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }
function pressFx(el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 160); }
function tap(el, fn) { el.addEventListener('click', e => { pressFx(el); Sfx.resume(); fn(e); }); }
function scanFx(big) {
  if (!settings.fx) return; const s = $('#scanline'); s.classList.remove('go'); void s.offsetWidth; s.classList.add('go');
  if (big) { const a = $('#app'); a.classList.remove('glitch'); void a.offsetWidth; a.classList.add('glitch'); }
}
function setNet(kind, txt) { const p = $('#netPill'); p.className = 'pill ' + kind; p.textContent = txt; }

/* ---------- live icon animation registry ---------- */
let iconList = [];
const heroCtx = $('#heroIcon').getContext('2d');
let iconClock = 0;
Scene.frame(t => {
  const ty = state.sim || state.live, n = state.simNight ?? state.night;
  drawIcon(heroCtx, ty, n, t);
  if (t - iconClock > .12) { iconClock = t; for (const ic of iconList) drawIcon(ic.ctx, ic.type, ic.night, t + ic.o); }
});
Scene.on((ev, a, b) => {
  if (ev === 'bolt') {
    if (settings.fx) { const f = $('#fxFlash'); f.style.transition = 'none'; f.style.opacity = '.55'; requestAnimationFrame(() => { f.style.transition = 'opacity .45s ease-out'; f.style.opacity = '0'; }); }
    setTimeout(() => Sfx.thunder(Math.random() < .4), rnd(150, 1100));
  } else if (ev === 'crackle') Sfx.crackle();
  else if (ev === 'tick') Sfx.tick();
  else if (ev === 'jet') Sfx.jet();
  else if (ev === 'scan') Sfx.pscan();
  else if (ev === 'zap') Sfx.zap();
  else if (ev === 'sentinel') Sfx.sentinel();
  else if (ev === 'collect') collect(a, b);
  else if (ev === 'pew') Sfx.pew();
  else if (ev === 'takeoff') { Sfx.takeoff(); toast('🚀 Traveller is taking the ship out for a spin!', 2400); }
  else if (ev === 'boost') Sfx.boost();
  else if (ev === 'flyby') Sfx.flyby();
  else if (ev === 'sgun') Sfx.sgun();
  else if (ev === 'kill') toast('💥 Target destroyed! +1 bragging right', 2000);
  else if (ev === 'landing') Sfx.land();
  else if (ev === 'canopy') Sfx.canopy();
  else if (ev === 'landed') Sfx.canopy();
  else if (ev === 'dlaser') Sfx.dlaser();
  else if (ev === 'hit') Sfx.hit();
  else if (ev === 'shield') { Sfx.shield(); if (settings.fx && navigator.vibrate) navigator.vibrate(20); }
  else if (ev === 'boom') Sfx.boom();
  else if (ev === 'attack') { Sfx.hostile(); toast('⚠ SENTINELS HOSTILE ⚠<br>Traveller is returning fire!', 3000); }
  else if (ev === 'victory') { setTimeout(() => Sfx.victory(), 500); toast('★ SENTINELS DESTROYED ★<br>Wanted level cleared… for now.', 3200); }
  else if (ev === 'reinforce') toast('Sentinel reinforcements have arrived.', 2400);
});

/* ---------- network ---------- */
async function getJSON(url, ms = 12000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); }
  finally { clearTimeout(to); }
}
async function fetchWeather(lat, lon) {
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
  const full = base + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,dew_point_2m,uv_index'
    + '&minutely_15=precipitation,temperature_2m&forecast_minutely_15=12'
    + '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index,relative_humidity_2m'
    + '&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_probability_max,precipitation_sum,snowfall_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max&forecast_days=10';
  try { return await getJSON(full); }
  catch (e) { // fallback: leaner request in case an extra field is rejected
    return await getJSON(base + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
      + '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day,uv_index,visibility,dew_point_2m'
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max&forecast_days=10');
  }
}
const fetchAQI = (lat, lon) => getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=us_aqi,pm2_5`, 9000);
const fetchAlerts = (lat, lon) => getJSON(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`, 9000)
  .then(j => (j.features || []).map(f => ({ event: f.properties.event, headline: f.properties.headline, sev: f.properties.severity, desc: f.properties.description, instr: f.properties.instruction, ends: f.properties.ends || f.properties.expires })));
async function reverseGeo(lat, lon) {
  const j = await getJSON(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, 8000);
  return { city: j.city || j.locality || 'Uncharted Region', region: j.principalSubdivision || '', country: j.countryName || '', lat, lon };
}
function getPos() {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lon: p.coords.longitude }), () => res(null), { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
}
const distKm = (a, b) => { const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371; };

/* ---------- refresh ---------- */
let countdown = 60;
async function refresh(manual) {
  if (state.busy) return; state.busy = true;
  const rb = $('#btnRefresh'); rb.classList.add('spin'); setNet('busy', 'SCANNING');
  scanFx(manual); if (manual) Sfx.scan();
  try {
    let coords = null;
    if (settings.manual) coords = { lat: settings.manual.lat, lon: settings.manual.lon };
    else { coords = await getPos(); if (!coords && state.coords) { coords = state.coords; if (manual) toast('Location signal lost — using last known coordinates.'); } }
    if (!coords) { setNet('bad', 'NO GPS'); toast('Location blocked. Use "Warp to a city" in Ship Systems below, or allow Location for this app in iPhone Settings.', 6000); state.busy = false; rb.classList.remove('spin'); if (!state.data) $('#flavor').textContent = 'No coordinates. Scroll down to Ship Systems and warp to a city.'; return; }
    state.coords = coords; LS.set('coords', coords);
    const needPlace = settings.manual ? false : (!state.place || distKm(state.place, coords) > 3);
    const [w, aq, al, pl] = await Promise.allSettled([fetchWeather(coords.lat, coords.lon), fetchAQI(coords.lat, coords.lon), fetchAlerts(coords.lat, coords.lon), needPlace ? reverseGeo(coords.lat, coords.lon) : Promise.resolve(null)]);
    if (w.status !== 'fulfilled') throw w.reason;
    state.data = w.value; LS.set('data', state.data);
    if (aq.status === 'fulfilled') { state.aqi = aq.value.current || null; LS.set('aqi', state.aqi); }
    if (al.status === 'fulfilled') { state.alerts = al.value; LS.set('alerts', state.alerts); } else state.alerts = [];
    if (settings.manual) state.place = { city: settings.manual.name, region: settings.manual.region || '', country: settings.manual.country || '', lat: coords.lat, lon: coords.lon };
    else if (pl.status === 'fulfilled' && pl.value) state.place = pl.value;
    else if (!state.place) state.place = { city: 'Uncharted Region', region: '', country: '', lat: coords.lat, lon: coords.lon };
    LS.set('place', state.place);
    state.fetchedAt = Date.now(); LS.set('fetchedAt', state.fetchedAt);
    render(); setNet('ok', 'ONLINE');
    if (manual) Sfx.done();
    discovery();
  } catch (e) {
    console.warn(e);
    setNet('bad', 'OFFLINE');
    if (state.data) { render(); if (manual) toast('No signal. Showing last scan from ' + new Date(state.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.'); }
    else toast('Scan failed — no signal and no saved data yet. Try again when online.', 4000);
    if (manual) Sfx.error();
  } finally { state.busy = false; rb.classList.remove('spin'); countdown = 60; updCountdown(); }
}
function discovery() {
  if (!state.place) return; const key = state.place.city + '|' + state.place.region, list = LS.get('discovered', []);
  if (!list.includes(key)) { list.push(key); LS.set('discovered', list); setTimeout(() => { Sfx.discover(); toast(`★ NEW PLANET DISCOVERED ★<br>${esc(state.place.city.toUpperCase())}<br>+${(1000 + Math.floor(Math.random() * 9000)).toLocaleString()} NANITES (imaginary)`, 4200); }, 900); }
  renderDiscovery();
}


/* ---------- resource inventory (from the Traveller's mining) ---------- */
const RESCOL = { 'CARBON': '#e0453a', 'FERRITE DUST': '#b0b6be', 'COPPER': '#ff8a2a', 'SODIUM': '#ffd23f', 'DIOXITE': '#bfe8ff', 'FROST CRYSTAL': '#e8f6ff', 'CACTUS FLESH': '#7ab84a', 'PYRITE': '#ffc84a', 'PHOSPHORUS': '#ff5a2a', 'SOLANIUM': '#ffb020', 'COBALT': '#6a9aff', 'STORM CRYSTAL': '#c070ff' };
let inv = LS.get('inv', {});
function renderInv() {
  const ks = Object.keys(inv).sort((a, b) => inv[b] - inv[a]).slice(0, 4);
  $('#inv').innerHTML = ks.length ? ks.map(k => `<span style="color:${RESCOL[k] || '#fff'}">◆ ${esc(k)} ${inv[k].toLocaleString()}</span>`).join('') : '<span>◆ Traveller is scanning for resources…</span>';
}
let invSave = 0;
function collect(name, amt) {
  inv[name] = (inv[name] || 0) + amt; if (Date.now() - invSave > 3000) { invSave = Date.now(); LS.set('inv', inv); }
  renderInv(); if (state.booted) Sfx.collect();
  const el = $('#inv'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}
addEventListener('pagehide', () => LS.set('inv', inv));
renderInv();

/* ---------- render ---------- */
let shownT = null, lastExtreme = null, flavorType = null;
function hourIndex(d) { const key = d.current.time.slice(0, 13); const i = d.hourly.time.findIndex(t => t.slice(0, 13) === key); return i < 0 ? 0 : i; }
function hasTornado() { return (state.alerts || []).some(a => /tornado (warning|emergency)/i.test(a.event || '')); }
function render() {
  const d = state.data; if (!d || !d.current) return;
  const c = d.current, gust = c.wind_gusts_10m ?? 0;
  state.live = classify(c.weather_code, c.temperature_2m, gust, hasTornado());
  state.night = c.is_day === 0;
  const p = state.place || {};
  $('#planetName').textContent = (p.city || 'Uncharted Region').toUpperCase();
  $('#sysLabel').textContent = [p.region, p.country].filter(Boolean).join(' · ').toUpperCase() + (p.region || p.country ? ' SYSTEM' : 'EUCLID GALAXY');
  animateTemp(c.temperature_2m);
  $('#feels').textContent = 'FEELS ' + T_(c.apparent_temperature);
  $('#hilo').textContent = d.daily ? `H ${T_(d.daily.temperature_2m_max[0])} · L ${T_(d.daily.temperature_2m_min[0])}` : '';
  applyScene();
  const i0 = hourIndex(d);
  renderAlerts(); renderNextHour(d, i0); renderReadout(d, i0); renderHourly(d, i0); renderDaily(d); renderDiscovery(); renderDaylight(); renderFavs(); fetchFavWx();
  const ago = state.fetchedAt ? new Date(state.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '--';
  $('#lastScan').textContent = 'Last scan: ' + ago + (p.lat != null ? ` · ${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}` : '');
}
function animateTemp(f) {
  const target = isC() ? (f - 32) * 5 / 9 : f, from = shownT == null ? target - 12 : shownT, t0 = performance.now();
  const step = now => { const k = Math.min(1, (now - t0) / 900), v = from + (target - from) * (1 - Math.pow(1 - k, 3)); $('#temp').textContent = Math.round(v) + '°'; if (k < 1) requestAnimationFrame(step); else shownT = target; };
  requestAnimationFrame(step);
}
function applyScene() {
  const d = state.data, c = d ? d.current : null;
  const ty = state.sim || state.live, night = state.simNight ?? state.night, info = WX[ty];
  Scene.set({ type: ty, night, inten: c ? intensityFor(c.weather_code) : .7, wind: c ? Math.max(c.wind_speed_10m || 0, state.sim ? 15 : 0) : 10, temp: c ? c.temperature_2m : 60, uv: state.sim ? 7 : (c ? (c.uv_index ?? (d.hourly.uv_index ? d.hourly.uv_index[hourIndex(d)] : 0)) : 0) });
  Sfx.setAmbient(info.amb);
  $('#biome').textContent = (state.sim ? 'SIMULATION: ' : '') + info.biome;
  $('#cond').textContent = state.sim ? info.label.toUpperCase() + ' (SIM)' : ((c && WMO[c.weather_code]) || info.label).toUpperCase() + (ty !== codeType(c ? c.weather_code : 0) ? ' · ' + info.label.toUpperCase() : '');
  // hazard bar
  const hz = info.hz, bar = $('#hzBar'); bar.innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.max(1, Math.round(hz / 10)) ? 'on' : ''}"></i>`).join('');
  bar.className = 'hz-bar' + (hz <= 30 ? ' low' : hz <= 60 ? ' mid' : ''); $('#hzPct').textContent = hz + '%';
  if (flavorType !== ty) { flavorType = ty; $('#flavor').textContent = pick(info.flav); }
  // extreme banner (sim or live) + real NWS alert headline
  const realAlert = !state.sim && (state.alerts || [])[0];
  const ext = info.extreme || (realAlert ? '⚠ ' + realAlert.event.toUpperCase() : null);
  const b = $('#banner');
  if (ext) { b.textContent = ext; b.classList.remove('hidden'); if (lastExtreme !== ext && state.booted) Sfx.alarm(); }
  else b.classList.add('hidden');
  lastExtreme = ext;
  const v = $('#vig'), vm = { fire: 'v-fire', heat: 'v-heat', cold: 'v-cold', snow: 'v-cold', sleet: 'v-cold', storm: 'v-storm', hail: 'v-storm', tornado: 'v-tornado' }[ty];
  v.className = vm && settings.fx ? 'on ' + vm : '';
  $('#crt').classList.toggle('off', !settings.fx);
  document.querySelectorAll('#sim .chip').forEach(ch => ch.classList.toggle('active', (ch.dataset.t === 'live' && !state.sim) || ch.dataset.t === state.sim));
  document.querySelectorAll('#simTime .chip').forEach(ch => ch.classList.toggle('active', String(state.simNight) === ch.dataset.n));
}
function renderAlerts() {
  const a = state.alerts || [], p = $('#pAlerts');
  if (!a.length) { p.hidden = true; return; }
  p.hidden = false;
  $('#alerts').innerHTML = a.map((x, i) => `<div class="alert" data-i="${i}"><div class="ev">⚠ ${esc(x.event)}</div><div class="hd">${esc(x.headline || '')}</div><div class="ds">${esc(x.desc || '')}${x.instr ? '\n\n' + esc(x.instr) : ''}</div></div>`).join('') + '<div class="sub" style="margin:4px 0 0">Tap an alert for details. Source: National Weather Service.</div>';
  document.querySelectorAll('.alert').forEach(el => el.onclick = () => { el.classList.toggle('open'); Sfx.blip(); });
}
function renderNextHour(d, i0) {
  const m = d.minutely_15, box = $('#nextHour'), h = d.hourly;
  const nextT = h.temperature_2m[i0 + 1], nextP = h.precipitation_probability ? h.precipitation_probability[i0 + 1] : null;
  const sub = `<div class="nh-sub">In 1 hour: ${T_(nextT)}${nextP != null ? ` · ${nextP}% chance of precip` : ''}</div>`;
  if (!m || !m.time) { box.innerHTML = `<div class="nh-sum">Minute-level radar unavailable here. ${h.precipitation_probability ? `Precip chance this hour: ${h.precipitation_probability[i0]}%.` : ''}</div>` + sub; return; }
  let s = m.time.findIndex(t => t >= d.current.time); if (s < 0) s = 0;
  const slots = [0, 1, 2, 3].map(k => ({ v: m.precipitation[s + k] ?? 0, t: m.time[s + k] }));
  const mx = Math.max(.02, ...slots.map(x => x.v)), wet = slots.map(x => x.v > .001);
  let msg;
  if (!wet.some(Boolean)) msg = 'No precipitation detected for the next 60 minutes. Exosuit staying crispy.';
  else if (wet.every(Boolean)) msg = 'Precipitation continuing for at least the next hour. Umbrella: deployed.';
  else if (wet[0]) msg = `Precipitation tapering off in ~${wet.indexOf(false) * 15} min.`;
  else msg = `Precipitation incoming in ~${wet.indexOf(true) * 15} min. Prepare umbrella module.`;
  box.innerHTML = `<div class="nh-bars">${slots.map((x, k) => `<div class="nh-bar"><em>${x.v > 0 ? Pr(x.v) : ''}</em><i style="height:${Math.max(2, x.v / mx * 70)}%"></i><b>${k ? '+' + k * 15 + 'M' : 'NOW'}</b></div>`).join('')}</div><div class="nh-sum">${msg}</div>` + sub;
}
function renderReadout(d, i0) {
  const c = d.current, h = d.hourly, dl = d.daily, cu = d.current_units || {}, hu = d.hourly_units || {};
  const vis = c.visibility ?? (h.visibility ? h.visibility[i0] : null), visU = c.visibility != null ? cu.visibility : hu.visibility;
  const dew = c.dew_point_2m ?? (h.dew_point_2m ? h.dew_point_2m[i0] : null), uvv = c.uv_index ?? (h.uv_index ? h.uv_index[i0] : null);
  const aq = state.aqi && state.aqi.us_aqi != null ? state.aqi.us_aqi : null;
  const pp = h.precipitation_probability ? h.precipitation_probability[i0] : null;
  const dayLen = dl && dl.sunrise ? (() => { const a = new Date(dl.sunrise[0]), b = new Date(dl.sunset[0]), m = Math.round((b - a) / 60000); return `${Math.floor(m / 60)}h ${m % 60}m daylight`; })() : '';
  const tiles = [
    ['FEELS LIKE', T_(c.apparent_temperature), Math.abs((c.apparent_temperature ?? 0) - c.temperature_2m) >= 3 ? (c.apparent_temperature > c.temperature_2m ? 'Feels warmer' : 'Feels colder') : 'Feels accurate'],
    ['HUMIDITY', (c.relative_humidity_2m ?? '--') + '%', dew != null ? 'Dew point ' + T_(dew) : ''],
    ['WIND', `${arrowSVG(c.wind_direction_10m ?? 0)}${Wd(c.wind_speed_10m)}`, `From the ${compass(c.wind_direction_10m ?? 0)}`],
    ['GUSTS', Wd(c.wind_gusts_10m), dl && dl.wind_gusts_10m_max ? 'Today max ' + Wd(dl.wind_gusts_10m_max[0]) : ''],
    ['PRECIP CHANCE', pp != null ? pp + '%' : '--', dl ? 'Today ' + (dl.precipitation_probability_max[0] ?? '--') + '%' : ''],
    ['PRECIP AMOUNT', Pr(c.precipitation), dl ? 'Today total ' + Pr(dl.precipitation_sum[0]) : ''],
    ['CLOUD COVER', (c.cloud_cover ?? '--') + '%', c.cloud_cover > 80 ? 'Sky fully blanketed' : c.cloud_cover > 40 ? 'Patchy' : 'Mostly open'],
    ['VISIBILITY', visTxt(vis, visU), vis != null && vis < 1609 ? 'Scanner impaired' : 'Scanner clear'],
    ['PRESSURE', Press(c.pressure_msl), 'Sea-level'],
    ['UV INDEX', uvv != null ? (Math.round(uvv * 10) / 10) : '--', uvv != null ? uvLabel(uvv) : ''],
    ['AIR QUALITY (US AQI)', aq != null ? aq : '--', aq != null ? aqiLabel(aq) + (state.aqi.pm2_5 != null ? ` · PM2.5 ${Math.round(state.aqi.pm2_5)}` : '') : 'No reading'],
    ['SUNRISE / SUNSET', dl && dl.sunrise ? hm12(dl.sunrise[0]).replace(' ', '') : '--', dl && dl.sunset ? 'Sunset ' + hm12(dl.sunset[0]) + (dayLen ? ' · ' + dayLen : '') : '']
  ];
  $('#readout').innerHTML = tiles.map(([k, v, s]) => `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
}
function renderHourly(d, i0) {
  const h = d.hourly, n = Math.min(25, h.time.length - i0); iconList = iconList.filter(ic => !ic.hourly);
  let html = '';
  for (let k = 0; k < n; k++) { const i = i0 + k; html += `<div class="hr ${k ? '' : 'now'}"><div class="t">${k ? hr12(h.time[i]) : 'NOW'}</div><canvas width="16" height="16" data-h="${i}"></canvas><div class="tp">${T_(h.temperature_2m[i])}</div><div class="pp">${h.precipitation_probability ? h.precipitation_probability[i] + '%' : ''}</div><div class="ws">${h.wind_speed_10m ? Math.round(isC() ? h.wind_speed_10m[i] * 1.609 : h.wind_speed_10m[i]) + (isC() ? 'kmh' : 'mph') : ''}</div></div>`; }
  $('#hourly').innerHTML = html;
  $('#hourly').querySelectorAll('canvas').forEach((cv, k) => { const i = +cv.dataset.h; const ty = k === 0 ? state.live : classify(h.weather_code[i], h.temperature_2m[i], h.wind_gusts_10m ? h.wind_gusts_10m[i] : 0, false); const ic = { ctx: cv.getContext('2d'), type: ty, night: h.is_day ? h.is_day[i] === 0 : false, o: k * .37, hourly: true }; iconList.push(ic); drawIcon(ic.ctx, ic.type, ic.night, ic.o); });
  // chart
  const c = $('#chart'), x = c.getContext('2d'), CW = c.width, CH = c.height, N = Math.min(24, n); x.clearRect(0, 0, CW, CH);
  const temps = [], pp = []; for (let k = 0; k < N; k++) { temps.push(h.temperature_2m[i0 + k]); pp.push(h.precipitation_probability ? h.precipitation_probability[i0 + k] : 0); }
  const mn = Math.min(...temps), mx = Math.max(...temps), span = Math.max(4, mx - mn), colW = CW / N;
  x.fillStyle = 'rgba(255,255,255,.07)'; for (let gy = 8; gy < CH; gy += 12) for (let gx = 0; gx < CW; gx += 3) x.fillRect(gx, gy, 1, 1);
  pp.forEach((p, i) => { const hh = Math.round((p / 100) * (CH * .5)); x.fillStyle = 'rgba(95,240,255,.45)'; x.fillRect(Math.round(i * colW + 2), CH - hh, Math.max(2, Math.round(colW - 3)), hh); });
  const pts = temps.map((t, i) => [Math.round(i * colW + colW / 2), Math.round(8 + (1 - (t - mn) / span) * (CH * .48))]);
  const ln = (a, b) => { let [x0, y0] = a; const [x1, y1] = b, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (let g = 0; g < 999; g++) { x.fillRect(x0, y0, 2, 2); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
  x.fillStyle = '#ff9a1f'; for (let i = 0; i < pts.length - 1; i++) ln(pts[i], pts[i + 1]);
  const iMax = temps.indexOf(mx), iMin = temps.indexOf(mn);
  x.fillStyle = '#ffffff'; [iMax, iMin].forEach(i => x.fillRect(pts[i][0] - 2, pts[i][1] - 2, 4, 4));
  const ppMax = Math.max(...pp), iPP = pp.indexOf(ppMax);
  $('#chartLegend').innerHTML = `<b>▬ Temp</b> high ${T_(mx)} at ${iMax ? hr12(h.time[i0 + iMax]) : 'now'}, low ${T_(mn)} at ${iMin ? hr12(h.time[i0 + iMin]) : 'now'}<br><i>▮ Precip chance</i> peaks at ${ppMax}%${ppMax ? ' around ' + (iPP ? hr12(h.time[i0 + iPP]) : 'now') : ''}`;
}
function renderDaily(d) {
  const dl = d.daily; if (!dl) return; iconList = iconList.filter(ic => !ic.daily);
  const lo = Math.min(...dl.temperature_2m_min), hi = Math.max(...dl.temperature_2m_max), sp = Math.max(1, hi - lo);
  $('#daily').innerHTML = dl.time.map((t, i) => {
    const a = (dl.temperature_2m_min[i] - lo) / sp * 100, b = (dl.temperature_2m_max[i] - lo) / sp * 100;
    const x = (k, v) => `<div>${k}: <b>${v}</b></div>`;
    return `<div class="dy" data-i="${i}"><div class="d">${i ? dow(t) : 'TODAY'}</div><canvas width="16" height="16" data-d="${i}"></canvas><div class="pp">${dl.precipitation_probability_max ? (dl.precipitation_probability_max[i] ?? 0) + '%' : ''}</div><div class="lo">${T_(dl.temperature_2m_min[i])}</div><div class="rng"><i style="left:${a}%;width:${Math.max(3, b - a)}%"></i></div><div class="hi">${T_(dl.temperature_2m_max[i])}</div>
      <div class="dy-x">${x('Conditions', WMO[dl.weather_code[i]] || '--')}${x('Precip', Pr(dl.precipitation_sum[i]))}${dl.snowfall_sum && dl.snowfall_sum[i] ? x('Snowfall', Pr(dl.snowfall_sum[i] / (d.daily_units && /cm/.test(d.daily_units.snowfall_sum || '') ? 2.54 : 1))) : ''}${dl.apparent_temperature_max ? x('Feels like', T_(dl.apparent_temperature_min[i]) + ' – ' + T_(dl.apparent_temperature_max[i])) : ''}${x('Max wind', Wd(dl.wind_speed_10m_max[i]))}${dl.wind_gusts_10m_max ? x('Max gusts', Wd(dl.wind_gusts_10m_max[i])) : ''}${x('UV max', dl.uv_index_max[i] != null ? Math.round(dl.uv_index_max[i]) + ' ' + uvLabel(dl.uv_index_max[i]) : '--')}${x('Sunrise', hm12(dl.sunrise[i]))}${x('Sunset', hm12(dl.sunset[i]))}</div></div>`;
  }).join('');
  $('#daily').querySelectorAll('canvas').forEach(cv => { const i = +cv.dataset.d; const ic = { ctx: cv.getContext('2d'), type: classify(dl.weather_code[i], dl.temperature_2m_max[i], dl.wind_gusts_10m_max ? dl.wind_gusts_10m_max[i] : 0, false), night: false, o: i * .53, daily: true }; iconList.push(ic); drawIcon(ic.ctx, ic.type, false, ic.o); });
  $('#daily').querySelectorAll('.dy').forEach(el => el.onclick = () => { el.classList.toggle('open'); Sfx.blip(); });
}
function renderDiscovery() {
  const d = state.data; if (!d) return; const c = d.current, i0 = hourIndex(d), uvv = c.uv_index ?? (d.hourly.uv_index ? d.hourly.uv_index[i0] : 0) ?? 0, hum = c.relative_humidity_2m ?? 50, fl = c.apparent_temperature ?? c.temperature_2m;
  const flora = hum < 30 ? 'Barren' : hum < 50 ? 'Sparse' : hum < 70 ? 'Average' : hum < 85 ? 'Bountiful' : 'Lush & Soggy';
  const fauna = fl >= 55 && fl <= 85 ? 'Thriving' : fl > 85 ? 'Hiding in shade' : 'Huddled for warmth';
  const n = LS.get('discovered', []).length;
  $('#discovery').innerHTML = [
    ['WEATHER', WX[state.live].label, WX[state.live].biome],
    ['SENTINELS (UV)', sentinel(uvv), 'UV index ' + (Math.round(uvv * 10) / 10)],
    ['FLORA (HUMIDITY)', flora, hum + '% humidity'],
    ['FAUNA (FEELS-LIKE)', fauna, 'Feels like ' + T_(fl)],
    ['PLANETS DISCOVERED', n, 'Unique cities scanned'],
    ['GALACTIC COORDS', state.place && state.place.lat != null ? state.place.lat.toFixed(2) + ', ' + state.place.lon.toFixed(2) : '--', 'Latitude, longitude']
  ].map(([k, v, s]) => `<div class="tile"><div class="k">${k}</div><div class="v" style="font-size:24px">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('');
}


/* ---------- DAYLIGHT ---------- */
const locMs = str => Date.parse(str + (str.length === 16 ? ':00' : '') + 'Z');
const dur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
const hmMs = ms => { const d = new Date(ms), h = d.getUTCHours(), m = d.getUTCMinutes(); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); };
function renderDaylight() {
  const d = state.data; if (!d || !d.daily || !d.daily.sunrise) return;
  const dl = d.daily, off = (d.utc_offset_seconds || 0) * 1000, now = Date.now() + off;
  const rise = locMs(dl.sunrise[0]), set = locMs(dl.sunset[0]), rise1 = dl.sunrise[1] ? locMs(dl.sunrise[1]) : rise + 864e5, set1 = dl.sunset[1] ? locMs(dl.sunset[1]) : set + 864e5;
  if (isNaN(rise) || isNaN(set) || set <= rise) { $('#dlLeft').innerHTML = 'POLAR CONDITIONS<small>The sun is doing something weird here.</small>'; return; }
  const len = set - rise, len1 = set1 - rise1, delta = Math.round((len1 - len) / 1000), noon = rise + len / 2;
  let phase, prog, big;
  if (now < rise) { phase = 'pre'; const prevSet = set - 864e5; prog = clamp((now - prevSet) / (rise - prevSet), 0, 1); big = `SUNRISE IN ${dur(rise - now)}<small>Night shift.</small>`; }
  else if (now <= set) { phase = 'day'; prog = (now - rise) / len; const left = set - now, pct = Math.round(left / len * 100);
    big = `${dur(left)} OF DAYLIGHT LEFT<small>${pct}% of today's sun remaining${left < 3600e3 ? ' · Golden hour!' : ''}</small>`; }
  else { phase = 'post'; prog = clamp((now - set) / (rise1 - set), 0, 1); big = `SUNRISE IN ${dur(rise1 - now)}<small>Headlamp engaged.</small>`; }
  $('#dlLeft').innerHTML = big;
  const tiles = [
    ['SUNRISE', hmMs(rise), ''],
    ['SUNSET', hmMs(set), ''],
    ['DAY LENGTH', dur(len), ''],
    ['TOMORROW', (delta >= 0 ? '+' : '−') + Math.floor(Math.abs(delta) / 60) + 'm ' + (Math.abs(delta) % 60) + 's', ''],
    ['SOLAR NOON', hmMs(noon), ''],
    ['GOLDEN HOUR', hmMs(set - 3600e3), '']
  ];
  $('#dlGrid').innerHTML = tiles.map(([k, v]) => `<div class="dl-t"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  // pixel sun arc
  const c = $('#sunArc'), x = c.getContext('2d'), CW = c.width, CH = c.height, hy = CH - 14, cx = CW / 2, rx = 80, ry = hy - 10;
  x.clearRect(0, 0, CW, CH);
  const day = phase === 'day';
  const grd = x.createLinearGradient(0, 0, 0, hy); grd.addColorStop(0, day ? 'rgba(60,140,255,.35)' : 'rgba(20,20,70,.5)'); grd.addColorStop(1, day ? 'rgba(255,190,90,.3)' : 'rgba(80,40,120,.35)');
  x.fillStyle = grd; x.fillRect(0, 0, CW, hy);
  if (!day) { x.fillStyle = 'rgba(255,255,240,.7)'; for (let i = 0; i < 26; i++) x.fillRect(Math.floor(hash(i, 3) * CW), Math.floor(hash(i, 9) * (hy - 4)), 1, 1); }
  x.fillStyle = '#1e3a2a'; x.fillRect(0, hy, CW, CH - hy); x.fillStyle = '#5ff0ff'; x.fillRect(0, hy, CW, 1);
  for (let k = 0; k <= 120; k++) { const f = k / 120, a = Math.PI * (1 - f), px = Math.round(cx + Math.cos(a) * rx), py = Math.round(hy - Math.sin(a) * ry);
    if (k % 2 === 0 || (day && f <= prog)) { x.fillStyle = day && f <= prog ? '#ffd23f' : 'rgba(255,255,255,.35)'; x.fillRect(px, py, 2, 2); } }
  const a = Math.PI * (1 - prog), bx = cx + Math.cos(a) * rx, by = hy - Math.sin(a) * ry;
  if (day) {
    x.fillStyle = 'rgba(255,200,60,.25)'; x.beginPath(); x.arc(bx, by, 7 + Math.sin(Date.now() / 300), 0, 7); x.fill();
    for (let yy = -4; yy <= 4; yy++) for (let xx = -4; xx <= 4; xx++) if (xx * xx + yy * yy <= 16) { x.fillStyle = xx * xx + yy * yy > 8 ? '#ff9a1f' : '#ffe14a'; x.fillRect(Math.round(bx + xx), Math.round(by + yy), 1, 1); }
  } else {
    for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) if (xx * xx + yy * yy <= 25 && (xx - 3) ** 2 + (yy + 1) ** 2 > 18) { x.fillStyle = '#f4eecb'; x.fillRect(Math.round(bx + xx), Math.round(by + yy), 1, 1); }
  }
  x.font = '14px VT323, monospace'; x.fillStyle = '#ffd9a0'; x.textAlign = 'left'; x.fillText('↑ ' + hmMs(rise), 4, CH - 6); x.textAlign = 'right'; x.fillText(hmMs(set) + ' ↓', CW - 4, CH - 6);
  x.textAlign = 'center'; x.fillStyle = '#93a0b4'; 
}

/* ---------- FAVORITES ---------- */
let favs = LS.get('favs', []), favWx = LS.get('favWx', {}), favFetchedAt = 0;
const favId = (lat, lon) => (+lat).toFixed(2) + ',' + (+lon).toFixed(2);
const curPlaceId = () => state.place && state.place.lat != null ? favId(state.place.lat, state.place.lon) : null;
function saveFavs() { LS.set('favs', favs); }
function toggleFav() {
  const id = curPlaceId(); if (!id) { toast('Scan a location first, Traveller.'); Sfx.error(); return; }
  const i = favs.findIndex(f => f.id === id);
  if (i >= 0) { favs.splice(i, 1); toast('Removed from Favorite Planets.'); Sfx.toggle(false); }
  else { const p = state.place; favs.push({ id, name: p.city, region: p.region || '', country: p.country || '', lat: p.lat, lon: p.lon }); toast('★ ' + esc(p.city.toUpperCase()) + ' ADDED TO FAVORITE PLANETS ★'); Sfx.discover(); favFetchedAt = 0; fetchFavWx(); }
  saveFavs(); renderFavs();
}
async function fetchFavWx(force) {
  if (!favs.length || (!force && Date.now() - favFetchedAt < 5 * 60e3)) return;
  favFetchedAt = Date.now();
  try {
    const j = await getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${favs.map(f => f.lat.toFixed(4)).join(',')}&longitude=${favs.map(f => f.lon.toFixed(4)).join(',')}&current=temperature_2m,weather_code,is_day,wind_gusts_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`);
    const arr = Array.isArray(j) ? j : [j];
    arr.forEach((r, i) => { if (favs[i] && r.current) favWx[favs[i].id] = r.current; });
    LS.set('favWx', favWx); renderFavs();
  } catch (e) { favFetchedAt = 0; }
}
function renderFavs() {
  const box = $('#favs'); if (!box) return;
  iconList = iconList.filter(ic => !ic.fav);
  const activeId = settings.manual ? favId(settings.manual.lat, settings.manual.lon) : null;
  const gpsRow = `<div class="fav-row ${settings.manual ? '' : 'active'}"><button class="fav-go" data-gps="1"><canvas width="16" height="16" data-gps="1"></canvas><div style="min-width:0"><div class="fav-n">◎ MY LOCATION</div><div class="fav-s">${settings.manual ? 'Tap to return to GPS' : 'You are here' + (state.place && !settings.manual ? ' · ' + esc(state.place.city) : '')}</div></div></button></div>`;
  box.innerHTML = gpsRow + (favs.length ? favs.map((f, i) => {
    const w = favWx[f.id];
    return `<div class="fav-row ${activeId === f.id ? 'active' : ''}"><button class="fav-go" data-i="${i}"><canvas width="16" height="16" data-i="${i}"></canvas><div style="min-width:0"><div class="fav-n">${esc(f.name.toUpperCase())}</div><div class="fav-s">${esc([f.region, f.country].filter(Boolean).join(', '))}${w ? ' · ' + esc(WMO[w.weather_code] || '') : ''}</div></div><div class="fav-t">${w ? T_(w.temperature_2m) : '--'}</div></button><button class="fav-x" data-x="${i}" aria-label="Remove">✕</button></div>`;
  }).join('') : '<div class="sub" style="margin:8px 0 0">No favorites yet. Warp somewhere cool and tap ★.</div>');
  box.querySelectorAll('canvas').forEach((cv, k) => {
    let ty, nt;
    if (cv.dataset.gps) { ty = settings.manual ? 'clear' : state.live; nt = settings.manual ? false : state.night; }
    else { const w = favWx[favs[+cv.dataset.i].id]; ty = w ? classify(w.weather_code, w.temperature_2m, w.wind_gusts_10m || 0, false) : 'cloudy'; nt = w ? w.is_day === 0 : false; }
    const ic = { ctx: cv.getContext('2d'), type: ty, night: nt, o: k * .41, fav: true }; iconList.push(ic); drawIcon(ic.ctx, ty, nt, ic.o);
  });
  box.querySelectorAll('.fav-go').forEach(b => tap(b, () => {
    if (b.dataset.gps) { settings.manual = null; saveSettings(); state.place = null; toast('Re-acquiring GPS lock…'); }
    else { const f = favs[+b.dataset.i]; settings.manual = { lat: f.lat, lon: f.lon, name: f.name, region: f.region, country: f.country }; saveSettings(); toast('WARPING TO ' + esc(f.name.toUpperCase()) + '…'); }
    Sfx.whoosh(); $('#app').scrollTo({ top: 0, behavior: 'smooth' }); refresh(true);
  }));
  box.querySelectorAll('.fav-x').forEach(b => tap(b, () => { const f = favs[+b.dataset.x]; favs.splice(+b.dataset.x, 1); saveFavs(); toast('Removed ' + esc(f.name) + '.'); Sfx.toggle(false); renderFavs(); }));
  const on = favs.some(f => f.id === curPlaceId()), fb = $('#btnFav');
  fb.classList.toggle('on', on); fb.textContent = on ? '★ SAVED' : '☆ FAVORITE';
}

/* ---------- controls ---------- */
function updCountdown() {
  const p = $('#cdPill');
  if (!settings.auto) { p.textContent = 'AUTO OFF'; $('#autoSub').textContent = 'Off — tap ⟳ SCAN to refresh manually'; return; }
  p.textContent = `AUTO 0:${String(countdown).padStart(2, '0')}`; $('#autoSub').textContent = `Next scan in ${countdown}s (every 60s)`;
}
setInterval(() => {
  if (!state.booted) return;
  if (settings.auto && !document.hidden && !state.busy) { countdown--; if (countdown <= 0) { countdown = 60; refresh(false); } }
  updCountdown();
  if (!document.hidden && Date.now() % 10000 < 1000) renderDaylight();
}, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.booted && settings.auto && Date.now() - state.fetchedAt > 60000) refresh(false); });
addEventListener('online', () => { if (state.booted) refresh(false); });
addEventListener('offline', () => setNet('bad', 'OFFLINE'));

function syncToggles() {
  document.querySelectorAll('.sw').forEach(el => { const k = el.dataset.k; el.classList.toggle('on', k === 'units' ? settings.units === 'C' : !!settings[k]); });
  $('#unitSub').textContent = isC() ? '°C · km/h · mm (tap for °F)' : '°F · mph · inches (tap for °C)';
}
document.querySelectorAll('.sw').forEach(el => el.addEventListener('click', () => {
  pressFx(el); Sfx.resume(); const k = el.dataset.k;
  if (k === 'units') { settings.units = isC() ? 'F' : 'C'; shownT = null; }
  else settings[k] = !settings[k];
  saveSettings(); syncToggles(); Sfx.toggle(k === 'units' ? true : settings[k]);
  if (k === 'auto') { countdown = 60; updCountdown(); }
  if (k === 'sound' || k === 'ambient') Sfx.setAmbient();
  if (state.data) render(); else applyScene();
}));
tap($('#btnRefresh'), () => refresh(true));
tap($('#btnRefresh2'), () => refresh(true));
tap($('#btnFav'), toggleFav);
tap($('#btnFavAdd'), toggleFav);
tap($('#btnLocate'), () => { settings.manual = null; saveSettings(); state.place = null; toast('Re-acquiring GPS lock…'); refresh(true); });
async function search() {
  const q = $('#q').value.trim(); if (!q) return; $('#q').blur(); Sfx.blip();
  $('#qRes').innerHTML = '<div class="sub" style="margin-top:8px">Scanning star charts…</div>';
  try {
    const j = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
    const r = j.results || [];
    if (!r.length) { $('#qRes').innerHTML = '<div class="sub" style="margin-top:8px">No planets found by that name.</div>'; return; }
    $('#qRes').innerHTML = r.map((x, i) => `<button class="btn" data-i="${i}">◆ ${esc(x.name)}${x.admin1 ? ', ' + esc(x.admin1) : ''}${x.country ? ' · ' + esc(x.country) : ''}</button>`).join('');
    $('#qRes').querySelectorAll('button').forEach(b => tap(b, () => {
      const x = r[+b.dataset.i]; settings.manual = { lat: x.latitude, lon: x.longitude, name: x.name, region: x.admin1 || '', country: x.country || '' }; saveSettings();
      $('#qRes').innerHTML = ''; $('#q').value = ''; Sfx.whoosh(); toast('WARPING TO ' + esc(x.name.toUpperCase()) + '…'); $('#app').scrollTo({ top: 0, behavior: 'smooth' }); refresh(true);
    }));
  } catch (e) { $('#qRes').innerHTML = '<div class="sub" style="margin-top:8px">Search needs a signal. Try again online.</div>'; }
}
tap($('#qGo'), search);
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });

// simulator chips
$('#sim').innerHTML = `<button class="chip" data-t="live">● LIVE</button>` + SIM_ORDER.map(t => `<button class="chip" data-t="${t}">${WX[t].label.toUpperCase().replace(' / FREEZING RAIN', '')}</button>`).join('');
$('#simTime').innerHTML = `<button class="chip" data-n="null">AUTO TIME</button><button class="chip" data-n="false">☀ DAY</button><button class="chip" data-n="true">☾ NIGHT</button>`;
document.querySelectorAll('#sim .chip').forEach(ch => tap(ch, () => { state.sim = ch.dataset.t === 'live' ? null : ch.dataset.t; Sfx.whoosh(); scanFx(true); applyScene(); }));
document.querySelectorAll('#simTime .chip').forEach(ch => tap(ch, () => { state.simNight = ch.dataset.n === 'null' ? null : ch.dataset.n === 'true'; Sfx.blip(); applyScene(); }));
{ const b = document.createElement('button'); b.className = 'chip'; b.textContent = '⚔ SENTINEL ATTACK'; $('#simTime').appendChild(b); tap(b, () => { if (!Scene.attack()) toast('Sentinels are busy (or a tornado is happening).'); }); }

/* ---------- CONFIG PAGE ---------- */
const CFG_UI = [
  ['SENTINEL DRONES', [
    ['drones', 'Sentinels', 'Turn the drones on or off completely', [[true, 'ON'], [false, 'OFF']]],
    ['droneCount', 'Patrol size', 'How many drones are out at once', [[1, '1'], [2, '2'], [3, '3'], [4, '4']]],
    ['attack', 'Attack frequency', 'How often they turn hostile', [['never', 'NEVER'], ['rare', 'RARE'], ['some', 'SOMETIMES'], ['often', 'OFTEN'], ['chaos', 'CHAOS']]],
    ['aggro', 'Aggression', 'Fire rate + how fast they swarm', [['docile', 'DOCILE'], ['normal', 'NORMAL'], ['aggressive', 'AGGRO'], ['relentless', 'RELENTLESS']]],
    ['tough', 'Armor', 'Hits needed to destroy one', [['fragile', '3'], ['normal', '6'], ['armored', '10'], ['tank', '16']]],
    ['scanTrav', 'Suspicion', 'How often they scan the Traveller', [['never', 'NEVER'], ['rarely', 'RARELY'], ['some', 'NORMAL'], ['often', 'NOSY']]],
    ['reinforce', 'Reinforcements', 'Delay before new drones arrive', [['fast', '~10S'], ['normal', '~35S'], ['slow', '~90S']]]
  ]],
  ['TRAVELLER', [
    ['tScan', 'Scan frequency', 'How often he pulses his scanner', [['rare', 'RARE'], ['normal', 'NORMAL'], ['often', 'OFTEN'], ['constant', 'NONSTOP']]],
    ['tMine', 'Mining laser', 'How often he mines what he finds', [['off', 'OFF'], ['rarely', 'RARELY'], ['normal', 'NORMAL'], ['always', 'ALWAYS']]],
    ['tMineSpd', 'Mining speed', 'How fast deposits break', [['slow', 'SLOW'], ['normal', 'NORMAL'], ['fast', 'FAST']]],
    ['tFire', 'Combat fire rate', 'His return fire vs Sentinels', [['slow', 'SLOW'], ['normal', 'NORMAL'], ['rapid', 'RAPID']]],
    ['tAim', 'Accuracy', 'How many shots hit', [['wild', 'WILD'], ['normal', 'NORMAL'], ['sniper', 'SNIPER']]],
    ['tWalk', 'Walk speed', '', [['stroll', 'STROLL'], ['normal', 'NORMAL'], ['jog', 'JOG']]],
    ['tHop', 'Jetpack hops', '', [['off', 'OFF'], ['rare', 'RARE'], ['normal', 'NORMAL'], ['often', 'OFTEN']]],
    ['suit', 'Exosuit color', '', [['orange', 'ORANGE'], ['white', 'WHITE'], ['red', 'RED'], ['green', 'GREEN'], ['purple', 'PURPLE'], ['black', 'STEALTH'], ['gold', 'GOLD']]],
    ['orb', 'Companion orb', 'Little helper floating by his shoulder', [[true, 'ON'], [false, 'OFF']]]
  ]],
  ['STARSHIP', [
    ['ship', 'Starship', 'Show the ship and let the Traveller fly it', [[true, 'ON'], [false, 'OFF']]],
    ['sFreq', 'Flight frequency', 'How often he hops in and takes off', [['never', 'NEVER'], ['rare', 'RARE'], ['some', 'SOMETIMES'], ['often', 'OFTEN'], ['always', 'CONSTANT']]],
    ['sPasses', 'Flight length', 'Fly-bys across the sky per trip', [['short', '1'], ['medium', '3'], ['long', '5'], ['epic', '8']]],
    ['sFight', 'Dogfights', 'Chance he hunts other ships on a pass', [['off', 'OFF'], ['rare', 'RARE'], ['some', 'SOMETIMES'], ['always', 'ALWAYS']]],
    ['sMax', 'Flight limit', 'Max flights each time the app is opened', [[0, 'NO LIMIT'], [1, '1'], [3, '3'], [5, '5']]]
  ]]
];
function renderCfg() {
  const cf = CF();
  $('#cfgBody').innerHTML = CFG_UI.map(([title, rows]) => `<section class="panel"><h2>${title}</h2>${rows.map(([k, label, sub, opts]) =>
    `<div class="cfg-row${(k !== 'drones' && title.startsWith('SENT') && !cf.drones) || (k !== 'ship' && title === 'STARSHIP' && !cf.ship) ? ' dim' : ''}"><div class="cfg-k">${label}</div>${sub ? `<div class="cfg-s">${sub}</div>` : ''}<div class="chips">${opts.map(([v, t]) =>
      `<button class="chip${cf[k] === v ? ' active' : ''}${k === 'suit' ? ' sw-' + v : ''}" data-k="${k}" data-v='${JSON.stringify(v)}'>${t}</button>`).join('')}</div></div>`).join('')}</section>`).join('')
    + `<div class="btn-row" style="margin:0 12px"><button class="btn big" id="cfgAtk">⚔ TRIGGER ATTACK</button><button class="btn big" id="cfgReset">↺ DEFAULTS</button></div><div style="margin:8px 12px 0"><button class="btn big" id="cfgFly" style="width:100%">🚀 LAUNCH SHIP NOW</button></div>`;
  $('#cfgBody').querySelectorAll('.chip').forEach(ch => tap(ch, () => {
    const k = ch.dataset.k, v = JSON.parse(ch.dataset.v); cf[k] = v; saveSettings(); Sfx.blip();
    if (k === 'attack') Scene.rollAttack();
    if (k === 'sFreq') Scene.rollFlight();
    renderCfg();
  }));
  tap($('#cfgAtk'), () => { closeCfg(); setTimeout(() => { if (!Scene.attack()) toast(CF().drones ? 'Sentinels are busy (or a tornado is happening).' : 'Sentinels are turned OFF.'); }, 350); });
  tap($('#cfgFly'), () => { closeCfg(); setTimeout(() => { if (!Scene.launch()) toast(CF().ship ? 'Ship is busy (already flying, fighting, or a tornado).' : 'Starship is turned OFF.'); }, 350); });
  tap($('#cfgReset'), () => { settings.cfg = Object.assign({}, CFG_DEF); saveSettings(); Scene.rollAttack(); Scene.rollFlight(); Sfx.toggle(true); renderCfg(); toast('Config restored to defaults.'); });
}
function openCfg() { renderCfg(); $('#cfg').classList.add('open'); Sfx.whoosh(); }
function closeCfg() { $('#cfg').classList.remove('open'); Sfx.blip(); }
tap($('#btnCfg'), openCfg); tap($('#btnCfg2'), openCfg); tap($('#cfgClose'), closeCfg);

/* ---------- boot ---------- */
Scene.start();
syncToggles();
if (state.data) { render(); setNet('dim', 'CACHED'); } else { applyScene(); renderFavs(); }
tap($('#bootBtn'), async () => {
  Sfx.init(); Sfx.resume(); Sfx.boot();
  const btn = $('#bootBtn'); btn.style.display = 'none';
  const log = $('#bootLog'), lines = ['> Calibrating Atlas uplink…', '> Charging exosuit hazard shields…', '> Requesting planetary coordinates…', '> Scanning atmosphere…'];
  for (const l of lines) { log.innerHTML += esc(l) + '<br>'; Sfx.blip(); await new Promise(r => setTimeout(r, 380)); }
  state.booted = true; Sfx.setAmbient(WX[state.sim || state.live].amb);
  $('#boot').classList.add('gone'); setTimeout(() => $('#boot').remove(), 900);
  refresh(true); fetchFavWx(true);
});
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
