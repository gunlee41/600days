'use strict';

/* clamp() / overlap() live in logic.js (shared with test.js) */

/* ---------- constants ---------- */
var W = 320, H = 180, GY = 146;
var STREET_LEN = 2620, BUSAN_LEN = 1250;

/* ---------- canvas ---------- */
var canvas = document.getElementById('c');
var ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
function rrect(x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

/* ---------- audio ---------- */
var ac = null, master = null, muted = false;
var track = null, step = 0, nextT = 0;

var TRACKS = {
  street: {
    bpm: 126,
    mel: [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 74, 72, 0, 74, 0,
          76, 0, 79, 0, 81, 0, 84, 0, 83, 81, 79, 0, 76, 0, 0, 0],
    bass: [48, 48, 53, 53, 55, 55, 53, 53]
  },
  train: {
    bpm: 92,
    mel: [69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0, 64, 0,
          69, 0, 72, 0, 77, 0, 76, 0, 72, 0, 74, 0, 71, 0, 0, 0],
    bass: [45, 45, 53, 52]
  },
  busan: {
    bpm: 84,
    mel: [65, 0, 69, 0, 72, 0, 77, 0, 72, 0, 69, 0, 65, 0, 60, 0,
          65, 0, 69, 0, 74, 0, 77, 0, 76, 0, 72, 0, 69, 0, 0, 0],
    bass: [41, 41, 48, 46]
  },
  ending: {
    bpm: 148,
    mel: [72, 76, 79, 84, 79, 76, 72, 0, 74, 77, 81, 86, 81, 77, 74, 0,
          76, 79, 83, 88, 83, 79, 76, 0, 72, 76, 79, 84, 88, 0, 0, 0],
    bass: [48, 55, 53, 55]
  }
};

function audioInit() {
  if (ac) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0.55;
  master.connect(ac.destination);
}

function tone(freq, dur, opt) {
  if (!ac || muted) return;
  opt = opt || {};
  var t = ac.currentTime + (opt.when || 0);
  var o = ac.createOscillator(), g = ac.createGain();
  o.type = opt.type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (opt.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opt.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(opt.vol || 0.05, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.03);
}

function sfx(name) {
  if (!ac || muted) return;
  switch (name) {
    case 'jump': tone(400, 0.13, { type: 'square', vol: 0.05, slide: 1.9 }); break;
    case 'get': tone(660, 0.09, { vol: 0.05 }); tone(990, 0.14, { vol: 0.05, when: 0.08 }); break;
    case 'meow': tone(780, 0.22, { type: 'triangle', vol: 0.09, slide: 0.62 }); break;
    case 'bark': tone(240, 0.07, { type: 'square', vol: 0.06 }); tone(210, 0.08, { type: 'square', vol: 0.06, when: 0.1 }); break;
    case 'text': tone(880, 0.05, { type: 'triangle', vol: 0.035 }); break;
    case 'tick': tone(1200, 0.03, { type: 'square', vol: 0.02 }); break;
    case 'boom': tone(150, 0.28, { type: 'sawtooth', vol: 0.07, slide: 0.35 }); break;
    case 'heart': tone(880, 0.1, { type: 'triangle', vol: 0.05 }); tone(1320, 0.18, { type: 'triangle', vol: 0.05, when: 0.09 }); break;
    case 'blink': tone(500, 0.5, { type: 'sine', vol: 0.06, slide: 0.4 }); break;
    case 'whistle':
      tone(392, 0.5, { type: 'sawtooth', vol: 0.05, slide: 1.03 });
      tone(523, 0.5, { type: 'sawtooth', vol: 0.04, slide: 1.03, when: 0.02 });
      tone(659, 0.45, { type: 'sawtooth', vol: 0.035, slide: 1.6, when: 0.5 });
      break;
    case 'paper': tone(1400, 0.05, { type: 'triangle', vol: 0.03 }); tone(900, 0.07, { type: 'triangle', vol: 0.025, when: 0.05 }); break;
    case 'whoosh': tone(300, 0.22, { type: 'sawtooth', vol: 0.03, slide: 2.2 }); break;
    case 'bump': tone(160, 0.1, { type: 'square', vol: 0.07, slide: 0.6 }); tone(110, 0.14, { type: 'triangle', vol: 0.05, when: 0.05 }); break;
  }
}

function music(name) {
  if (!TRACKS[name]) return;
  track = TRACKS[name];
  step = 0;
  nextT = ac ? ac.currentTime + 0.06 : 0;
}

function musicTick() {
  if (!ac || !track) return;
  if (muted) { nextT = ac.currentTime + 0.05; return; }
  var dur = 30 / track.bpm;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.02;
  while (nextT < ac.currentTime + 0.2) {
    var i = step % track.mel.length;
    var n = track.mel[i];
    var when = nextT - ac.currentTime;
    if (n) tone(440 * Math.pow(2, (n - 69) / 12), 0.18, { type: 'square', vol: 0.028, when: when });
    if (i % 4 === 0) {
      var b = track.bass[(i >> 2) % track.bass.length];
      if (b) tone(440 * Math.pow(2, (b - 69) / 12), 0.32, { type: 'triangle', vol: 0.045, when: when });
    }
    nextT += dur;
    step++;
  }
}
setInterval(musicTick, 60);

/* ---------- input ---------- */
var keys = { left: false, right: false, jump: false };
var jumpEdge = false;

function setKey(k, v) {
  if (k === 'jump' && v && !keys.jump) jumpEdge = true;
  keys[k] = v;
}

window.addEventListener('keydown', function (e) {
  if (e.repeat) return;
  if (G.mode === 'title' || G.mode === 'end') {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); startGame(); }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setKey('left', true);
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setKey('right', true);
  else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { setKey('jump', true); e.preventDefault(); }
  else if (e.key === 'm' || e.key === 'M') toggleMute();
});
window.addEventListener('keyup', function (e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') setKey('left', false);
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') setKey('right', false);
  else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') setKey('jump', false);
});

function bindBtn(id, k) {
  var el = document.getElementById(id);
  if (!el) return;
  var down = function (e) { e.preventDefault(); el.classList.add('on'); setKey(k, true); if (G.mode === 'title') startGame(); };
  var up = function (e) { e.preventDefault(); el.classList.remove('on'); setKey(k, false); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}
bindBtn('left', 'left');
bindBtn('right', 'right');
bindBtn('jump', 'jump');

function toggleMute() {
  muted = !muted;
  document.getElementById('mute').textContent = muted ? '×' : '♪';
  if (!muted && ac && ac.state === 'suspended') ac.resume();
}
document.getElementById('mute').addEventListener('click', function (e) { e.stopPropagation(); toggleMute(); });
canvas.addEventListener('pointerdown', function () {
  if (G.mode === 'title' || G.mode === 'end') startGame();
  else if (ac && ac.state === 'suspended') ac.resume();
});

/* ---------- world data ---------- */
function rng(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function makeCity(len, seed, hMin, hMax) {
  var r = rng(seed), a = [], x = -40;
  while (x < len + 120) {
    var w = 16 + ((r() * 26) | 0);
    var h = hMin + ((r() * (hMax - hMin)) | 0);
    a.push({ x: x, w: w, h: h, t: r() });
    x += w + 3 + ((r() * 10) | 0);
  }
  return a;
}
var farCity = makeCity(STREET_LEN, 7, 34, 74);
var nearCity = makeCity(STREET_LEN, 31, 26, 54);
var busanHills = makeCity(BUSAN_LEN + 400, 91, 20, 40);
var stars = (function () {
  var r = rng(5), a = [];
  for (var i = 0; i < 46; i++) a.push({ x: (r() * W) | 0, y: (r() * 70) | 0, p: 0.2 + r() * 0.6 });
  return a;
})();

/* ---------- game state ---------- */
var G = {
  mode: 'title',
  world: 'street',
  player: { x: 60, y: GY - 24, w: 12, h: 24, vx: 0, vy: 0, ground: true, face: 1, ph: 0 },
  cam: 0,
  t: 0,
  lock: 0,
  toast: { text: '', t: 0 },
  parts: [],
  trail: [],
  fade: 0,
  trans: null,
  cine: null,
  trainT: 0,
  blink: 0,
  blinkPhase: 0,
  endingT: 0,
  fwTimer: 0,
  worldX: 0,
  sky: 'night',
  zone: 'city',
  dlgQ: null,
  dlgDur: 2.2,
  card: null,
  scene: null,
  flash: 0,
  chap: { text: '', t: 0 },
  dist: 0,
  bumpCd: 0,
  hits: 0
};

var OBST = {
  street: [
    { x: 560, type: 'puddle' }, { x: 1000, type: 'cone' }, { x: 1700, type: 'puddle' },
    { x: 1900, type: 'cone' }, { x: 2150, type: 'puddle' }, { x: 2300, type: 'cone' }
  ],
  busan: [ { x: 420, type: 'puddle' }, { x: 700, type: 'cone' } ],
  train: []
};
var OBST_SIZE = { puddle: { w: 22, h: 4 }, cone: { w: 9, h: 13 } };

function say(text, dur) {
  G.toast = { text: text, t: dur || 2.6 };
  sfx('text');
}

function sayQ(lines, dur) {
  G.dlgDur = dur || 2.2;
  G.dlgQ = lines.slice(1);
  say(lines[0], G.dlgDur);
}

function startGame() {
  audioInit();
  if (ac && ac.state === 'suspended') ac.resume();
  G.mode = 'play';
  G.world = 'street';
  G.player = { x: 60, y: GY - 24, w: 12, h: 24, vx: 0, vy: 0, ground: true, face: 1, ph: 0 };
  G.cam = 0;
  G.t = 0;
  G.lock = 0;
  G.toast = { text: '', t: 0 };
  G.parts = [];
  G.trail = [];
  G.fade = 0;
  G.trans = null;
  G.cine = null;
  G.trainT = 0;
  G.blink = 0;
  G.blinkPhase = 0;
  G.endingT = 0;
  G.fwTimer = 0;
  G.sky = 'night';
  G.zone = 'city';
  G.dlgQ = null;
  G.card = null;
  G.scene = null;
  G.flash = 0;
  G.chap = { text: 'CH.1 · 대전, 어느 저녁', t: 3.4 };
  G.dist = 0;
  G.bumpCd = 0;
  G.hits = 0;
  G.flags = { cat: false, woman: false, womanGone: false, letter: false, dirDown: false, dog: false, dogOut: false, ticket: false, meeting: false };
  G.woman = { x: 900, face: -1, run: false };
  music('street');
  say('길을 걷는다.', 2.0);
}

function startTransition(next) {
  if (G.trans) return;
  G.trans = { t: 0, next: next, done: false };
}

function enterWorld(next) {
  if (next === 'train') {
    G.world = 'train';
    G.trainT = 0;
    G.toast.t = 0;
    G.chap = { text: 'CH.6 · 부산행', t: 3.4 };
    music('train');
    say('대전역 · 부산행 무궁화호', 3.0);
  } else if (next === 'busan') {
    G.world = 'busan';
    G.player.x = 200;
    G.player.y = GY - 24;
    G.player.face = 1;
    G.player.vx = 0;
    G.cam = 0;
    G.trail = [];
    for (var i = 0; i < 90; i++) {
      G.trail.push({ x: G.player.x - (90 - i) * 0.8, y: G.player.y, face: 1, ph: 0 });
    }
    G.woman = { x: 980, face: -1, run: false };
    G.chap = { text: 'CH.7 · 부산', t: 3.4 };
    music('busan');
    say('부산이다. 처음 와본다.', 3.0);
  } else if (next === 'ending') {
    G.mode = 'end';
    G.world = 'ending';
    G.endingT = 0;
    G.parts = [];
    G.fwTimer = 0;
    music('ending');
  }
}

function update(dt) {
  G.t += dt;
  if (G.toast.t > 0) G.toast.t -= dt;
  else if (G.dlgQ && G.dlgQ.length) say(G.dlgQ.shift(), G.dlgDur);
  if (G.lock > 0) G.lock -= dt;
  if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 3.2);
  if (G.chap.t > 0) G.chap.t -= dt;
  if (G.bumpCd > 0) G.bumpCd -= dt;

  if (G.card) {
    G.card.t += dt;
    if (G.card.sky && G.card.t > G.card.dur * 0.55) G.sky = G.card.sky;
    if (G.card.t >= G.card.dur) G.card = null;
  }
  if (G.scene) updateScene(dt);

  if (G.trans) {
    G.trans.t += dt;
    if (G.trans.t < 0.5) G.fade = G.trans.t / 0.5;
    else {
      if (!G.trans.done) {
        if (typeof G.trans.next === 'function') G.trans.next(); else enterWorld(G.trans.next);
        G.trans.done = true;
      }
      G.fade = 1 - (G.trans.t - 0.5) / 0.5;
    }
    if (G.trans.t >= 1) { G.trans = null; G.fade = 0; }
  }

  if (G.mode === 'play' && G.world === 'street') updateStreet(dt);
  else if (G.mode === 'play' && G.world === 'train') updateTrain(dt);
  else if (G.mode === 'play' && G.world === 'busan') updateBusan(dt);
  else if (G.mode === 'end') updateEnding(dt);

  if (G.mode === 'play') updatePlayer(dt);
  updateObstacles(dt);
  updateParts(dt);
}

function updateScene(dt) {
  var s = G.scene;
  s.t += dt;
  if (s.type === 'hospital') {
    if (s.t > 1.2 && !s.said) { s.said = true; sfx('heart'); }
    if (s.t > 5.0 && !s.out) {
      s.out = true;
      startTransition(function () {
        G.scene = null; G.sky = 'night'; G.lock = 1.2; G.flags.dogOut = true;
        G.chap = { text: 'CH.5 · 다시, 길 위', t: 3.2 };
        say('다다가 무사히 나았다.', 2.4);
      });
    }
  }
}

function updatePlayer(dt) {
  var p = G.player;
  var canMove = G.lock <= 0 && !G.trans && !G.card && !G.scene;
  var speed = 100;

  if (canMove) {
    var dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (dir !== 0) { p.vx = dir * speed; p.face = dir; }
    else p.vx = 0;
    if (G.world !== 'train' && (jumpEdge || keys.jump) && p.ground) {
      p.vy = -400; p.ground = false; sfx('jump');
    }
  } else {
    p.vx = 0;
  }
  jumpEdge = false;

  p.x += p.vx * dt;
  p.x = clamp(p.x, 0, (G.world === 'busan' ? BUSAN_LEN : STREET_LEN) - 20);

  p.vy += 1600 * dt;
  p.y += p.vy * dt;
  if (p.y >= GY - p.h) { p.y = GY - p.h; p.vy = 0; p.ground = true; }

  if (p.vx !== 0) { p.ph += dt * 9; G.dist += Math.abs(p.vx) * dt; }
  else p.ph = 0;

  G.trail.push({ x: p.x, y: p.y, face: p.face, ph: p.ph });
  if (G.trail.length > 90) G.trail.shift();

  var len = G.world === 'busan' ? BUSAN_LEN : STREET_LEN;
  var target = clamp(p.x - W * 0.38, 0, Math.max(0, len - W));
  G.cam += (target - G.cam) * Math.min(1, dt * 8);
}

function updateObstacles(dt) {
  if (G.mode !== 'play' || G.world === 'train') return;
  if (G.lock > 0 || G.trans || G.card || G.scene || G.bumpCd > 0) return;
  var list = OBST[G.world] || [];
  var p = G.player;
  for (var i = 0; i < list.length; i++) {
    var o = list[i], sz = OBST_SIZE[o.type];
    if (overlap(p, { x: o.x, y: GY - sz.h, w: sz.w, h: sz.h })) {
      G.hits++;
      G.bumpCd = 1.2;
      G.lock = 0.55;
      p.x -= p.face * 8;
      p.vy = -170;
      p.ground = false;
      sfx('bump');
      for (var k = 0; k < 6; k++) {
        G.parts.push({ x: o.x + Math.random() * sz.w, y: GY - 2, vx: (Math.random() - 0.5) * 70, vy: -Math.random() * 70, life: 0.45, max: 0.45, col: o.type === 'puddle' ? '#8fc6e0' : '#e0913f', size: 1 });
      }
      break;
    }
  }
}

function drawObstacles(c) {
  var list = OBST[G.world] || [];
  for (var i = 0; i < list.length; i++) {
    var o = list[i], x = o.x - c;
    if (x < -34 || x > W + 30) continue;
    if (o.type === 'puddle') {
      ctx.fillStyle = '#202d49';
      ctx.beginPath(); ctx.ellipse(x + 11, GY - 2, 11, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#456e9e';
      ctx.beginPath(); ctx.ellipse(x + 11, GY - 2, 8, 2.2, 0, 0, 7); ctx.fill();
      px(x + 5, GY - 4, 7, 1, '#9fd0e8');
      if (Math.sin(G.t * 1.7 + i) > 0.55) px(x + 12, GY - 3, 4, 1, '#d6eeff');
    } else {
      px(x + 1, GY - 4, 7, 4, '#b0602a');
      px(x, GY - 10, 9, 6, '#e8913f');
      px(x + 2, GY - 13, 5, 3, '#f6ab58');
      px(x + 1, GY - 7, 7, 2, '#fff0d0');
    }
  }
}

function drawHUD() {
  var steps = Math.floor(G.dist / 9);
  ctx.font = '8px Galmuri11, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(214,208,236,.45)';
  ctx.fillText(steps + ' 걸음', W - 6, 175);
  ctx.textAlign = 'left';
  if (G.chap.t > 0) {
    var a = Math.min(1, G.chap.t * 2.2);
    ctx.font = '9px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(255,226,180,' + a * 0.9 + ')';
    ctx.fillText(G.chap.text, 6, 175);
  }
}

function updateStreet(dt) {
  var p = G.player;

  /* zone: city <-> lab */
  var z = (p.x > 1200 && p.x < 1600) ? 'lab' : 'city';
  if (z !== G.zone) { G.zone = z; G.flash = 1; }

  /* 1. cat */
  if (!G.flags.cat) {
    var cat = { x: 380, y: GY - 52, w: 14, h: 8 };
    cat.y += Math.sin(G.t * 2.2) * 3;
    if (overlap(p, cat) || p.x > 520) {
      G.flags.cat = true;
      sfx('meow');
      G.lock = 4.9;
      G.cine = { type: 'cat', t: 0 };
      sayQ(['날 키워라, 인간.', '...? 으...응. 이름은 앙꼬라 하자...'], 2.3);
    }
  }
  if (G.cine && G.cine.type === 'cat') {
    G.cine.t += dt;
    if (G.cine.t > 4.7) {
      G.cine = null;
      G.card = { text: '(약 4년 후)', t: 0, dur: 2.3, sky: 'day' };
      G.chap = { text: 'CH.2 · 그녀', t: 5.4 };
      G.lock = 2.3;
    }
  }

  /* 2. woman */
  var wm = G.woman;
  if (!G.flags.woman && G.sky === 'day' && !G.card && !G.scene && p.x > wm.x - 110) {
    G.flags.woman = true;
    G.cine = { type: 'woman', t: 0 };
    G.lock = 7.4;
    wm.face = -1;
    sayQ(['이상형이다...!', '꼭 사귀어야겠어!', '그럼 부산으로 오시든가염~^^'], 2.1);
  }
  if (G.cine && G.cine.type === 'woman') {
    G.cine.t += dt;
    if (G.cine.t > 4.4 && !wm.run) { wm.run = true; wm.face = 1; sfx('whoosh'); }
    if (wm.run) wm.x += 430 * dt;
    if (wm.run && wm.x > 1250) {
      G.flags.womanGone = true;
      G.cine = null;
      G.lock = 0;
    } else if (G.cine.t > 7.6) {
      G.flags.womanGone = true;
      G.cine = null;
      G.lock = 0;
    }
  }

  /* 3. resignation letter */
  if (!G.flags.letter && p.x > 1090) {
    G.flags.letter = true;
    G.chap = { text: 'CH.3 · 사직서', t: 3.2 };
    sfx('get');
    say('연구소 사직서를 얻었다.', 2.6);
  }

  /* 4. director */
  if (G.zone === 'lab' && G.flags.letter && !G.flags.dirDown && !G.cine && p.x > 1390) {
    G.cine = { type: 'throw', t: 0 };
    G.lock = 3.4;
    sfx('paper');
  }
  if (G.cine && G.cine.type === 'throw') {
    G.cine.t += dt;
    if (G.cine.t > 0.42 && !G.cine.hit) {
      G.cine.hit = true;
      G.flags.dirDown = true;
      sfx('boom');
    }
    if (G.cine.t > 0.95 && !G.cine.said) { G.cine.said = true; say('난 간다.', 2.2); }
    if (G.cine.t > 3.3 && !G.cine.out) {
      G.cine.out = true;
      startTransition(function () {
        G.cine = null; G.lock = 1.4; G.sky = 'dusk';
        G.chap = { text: 'CH.4 · 다다', t: 3.2 };
      });
    }
  }

  /* 5. dog */
  if (G.flags.dirDown && !G.flags.dog) {
    var dog = { x: 1750, y: GY - 8, w: 14, h: 8 };
    if (overlap(p, dog) || p.x > 1810) {
      G.flags.dog = true;
      sfx('bark');
      G.lock = 7.0;
      G.cine = { type: 'dog', t: 0 };
      sayQ(['병원에 데려가라, 인간.', '으으응? 알았어.', '내 이름은 다다다.'], 2.1);
    }
  }
  if (G.cine && G.cine.type === 'dog') {
    G.cine.t += dt;
    if (G.cine.t > 6.4 && !G.cine.out) {
      G.cine.out = true;
      startTransition(function () {
        G.cine = null;
        G.scene = { type: 'hospital', t: 0 };
        G.lock = 6.4;
      });
    }
  }

  /* 6. ticket */
  if (!G.flags.ticket && p.x > 2000) {
    G.flags.ticket = true;
    G.chap = { text: 'CH.5 · 대전역', t: 3.2 };
    sfx('get');
    say('대전 – 부산 행 티켓을 받았다.', 2.6);
  }

  /* 7. station */
  if (p.x > 2400) { sfx('whistle'); startTransition('train'); }
}

function updateTrain(dt) {
  G.trainT += dt;
  if (G.trainT > 8.6) startTransition('busan');
}

function updateBusan(dt) {
  var p = G.player, wm = G.woman;

  if (!G.flags.meeting && Math.abs(p.x - wm.x) < 50) {
    G.flags.meeting = true;
    G.cine = { type: 'meet', t: 0 };
    G.lock = 9.0;
    wm.face = -1;
    p.face = 1;
    sfx('heart');
    sayQ(['부산에 왔어! 내가! 으아아아!', '어멋! 박력.', '- 여자친구를 얻었다. -'], 2.1);
  }
  if (G.cine && G.cine.type === 'meet') {
    G.cine.t += dt;
    if (G.cine.t > 0.5 && !G.cine.hearts) {
      G.cine.hearts = true;
      for (var i = 0; i < 14; i++) {
        G.parts.push({
          x: wm.x - G.cam + 6, y: GY - 30,
          vx: (Math.random() - 0.5) * 26, vy: -34 - Math.random() * 36,
          life: 2.4, max: 2.4, col: '#ff8fb0', size: 2, heart: true
        });
      }
    }
    if (G.cine.t > 7.0 && !G.cine.blink) { G.cine.blink = true; sfx('blink'); }
  }

  if (G.cine && G.cine.blink) {
    G.blink = Math.min(1, G.blink + dt * 1.4);
    if (G.blink >= 1) startTransition('ending');
  }
}

function updateEnding(dt) {
  G.endingT += dt;
  if (G.endingT < 0.9) return;
  G.fwTimer -= dt;
  if (G.fwTimer > 0) return;
  var rush = G.endingT > 7 ? 0.16 : 0.30;
  G.fwTimer = rush + Math.random() * 0.22;
  var n = 1 + (Math.random() < (G.endingT > 7 ? 0.8 : 0.35) ? 1 : 0);
  for (var k = 0; k < n; k++) firework(24 + Math.random() * 272, 16 + Math.random() * 76, k > 0);
}

function firework(x, y, quiet) {
  if (!quiet) sfx('boom');
  var hue = Math.random();
  var cols = hue < 0.34 ? ['#ffd166', '#ff9f43', '#fff1b8'] :
    hue < 0.67 ? ['#ff8fb0', '#ff5c8a', '#ffd0dd'] : ['#9ad1ff', '#7ee0c0', '#e6f6ff'];
  var cnt = 46 + ((Math.random() * 20) | 0);
  for (var i = 0; i < cnt; i++) {
    var a = (i / cnt) * Math.PI * 2 + Math.random() * 0.16;
    var sp = 56 + Math.random() * 110;
    G.parts.push({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1.7, max: 1.7, col: cols[i % cols.length], size: 1 + (Math.random() < 0.3 ? 1 : 0)
    });
  }
  G.parts.push({ x: x, y: y, vx: 0, vy: 0, life: 0.16, max: 0.16, col: '#fffbe8', size: 4 });
}

function updateParts(dt) {
  for (var i = G.parts.length - 1; i >= 0; i--) {
    var q = G.parts[i];
    q.x += q.vx * dt; q.y += q.vy * dt;
    q.vy += 46 * dt;
    q.vx *= 0.975;
    q.life -= dt;
    if (q.life <= 0) G.parts.splice(i, 1);
  }
}

/* ---------- sprites ---------- */
function drawBoy(x, y, ph, face) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  if (face < 0) { ctx.translate(12, 0); ctx.scale(-1, 1); }
  var skin = '#f7cfa8', skinD = '#dfa87e', hair = '#2a2333',
    shirt = '#eef3ff', shirtD = '#c3cfe8', pants = '#3b4670', shoe = '#1e1d26';
  var sw = Math.sin(ph) * 2 | 0;
  px(2, 0, 8, 3, hair);
  px(1, 2, 10, 2, hair);
  px(2, 4, 8, 4, skin);
  px(3, 5, 1, 2, hair);
  px(8, 5, 1, 2, hair);
  px(5, 7, 2, 1, skinD);
  px(3, 8, 6, 7, shirt);
  px(2, 9, 1, 5, shirtD);
  px(9, 9, 1, 5, shirtD);
  px(3, 15, 6, 2, pants);
  px(3 + Math.max(0, sw), 17, 2, 5 - Math.abs(sw), pants);
  px(7 + Math.max(0, -sw), 17, 2, 5 - Math.abs(sw), pants);
  px(3 + Math.max(0, sw), 22, 2, 2, shoe);
  px(7 + Math.max(0, -sw), 22, 2, 2, shoe);
  ctx.restore();
}

function drawCat(x, y, face) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  if (face < 0) { ctx.translate(10, 0); ctx.scale(-1, 1); }
  var f = '#fffaf5', s = '#e7dfe4';
  px(0, 1, 10, 7, '#4a3f5e');
  px(1, 0, 2, 3, '#4a3f5e'); px(7, 0, 2, 3, '#4a3f5e');
  px(1, 2, 8, 5, f);
  px(1, 0, 2, 2, f); px(7, 0, 2, 2, f);
  px(1, 1, 1, 1, '#ffc2cf'); px(8, 1, 1, 1, '#ffc2cf');
  px(0, 4, 1, 3, f); px(9, 2, 1, 3, f);
  px(2, 6, 6, 1, s);
  px(3, 4, 1, 1, '#2b2b3a'); px(6, 4, 1, 1, '#2b2b3a');
  px(5, 5, 1, 1, '#ffb3bf');
  ctx.restore();
}

function drawDog(x, y, face) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  if (face < 0) { ctx.translate(10, 0); ctx.scale(-1, 1); }
  var f = '#fffdf8', s = '#e3e0d8';
  px(0, 1, 10, 7, '#4a3f5e');
  px(1, 2, 8, 5, f);
  px(0, 1, 2, 4, s); px(8, 1, 2, 4, s);
  px(2, 3, 1, 1, '#2b2b3a'); px(6, 3, 1, 1, '#2b2b3a');
  px(5, 5, 1, 1, '#2b2b3a');
  px(3, 6, 1, 1, '#ffc2cf');
  px(2, 7, 2, 1, s); px(6, 7, 2, 1, s);
  px(9, 3, 1, 2, f);
  ctx.restore();
}

function drawWoman(x, y, face, ph) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  if (face < 0) { ctx.translate(12, 0); ctx.scale(-1, 1); }
  var hair = '#3a2b33', skin = '#f9d3b4', dress = '#ff9fbb', dressD = '#e37c9a', shoe = '#4a3a58';
  var sw = Math.sin(ph) * 2 | 0;
  px(1, 0, 10, 3, hair);
  px(0, 2, 3, 16, hair);
  px(9, 2, 3, 16, hair);
  px(3, 3, 6, 5, skin);
  px(4, 5, 1, 2, hair);
  px(7, 5, 1, 2, hair);
  px(5, 7, 1, 1, '#e8a490');
  px(3, 9, 6, 3, dress);
  px(2, 9, 1, 4, skin);
  px(9, 9, 1, 4, skin);
  px(2, 12, 8, 3, dress);
  px(1, 15, 10, 4, dress);
  px(1, 15, 10, 1, dressD);
  px(3 + Math.max(0, sw), 19, 2, 4, skin);
  px(7 + Math.max(0, -sw), 19, 2, 4, skin);
  px(3 + Math.max(0, sw), 23, 2, 1, shoe);
  px(7 + Math.max(0, -sw), 23, 2, 1, shoe);
  ctx.restore();
}

/* ---------- scenery ---------- */
function drawSky(top, mid, bottom) {
  var g = ctx.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, GY);
}

function drawStreet() {
  var c = G.cam, sky = G.sky, i, s, sx;

  if (sky === 'day') {
    drawSky('#63b8e8', '#a9d8f0', '#e9f4f4');
    var sg = ctx.createRadialGradient(258, 24, 4, 258, 24, 30);
    sg.addColorStop(0, 'rgba(255,248,220,.85)');
    sg.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = sg; ctx.fillRect(224, 0, 70, 70);
    px(254, 20, 12, 12, '#fff8e0');
  } else if (sky === 'dusk') {
    drawSky('#2b2a54', '#7a4a68', '#ffa066');
    for (i = 0; i < stars.length; i += 3) {
      s = stars[i];
      px(((s.x - c * s.p) % W + W) % W, s.y, 1, 1, 'rgba(255,243,214,.45)');
    }
  } else {
    drawSky('#151430', '#42294c', '#a86a5c');
    for (i = 0; i < stars.length; i++) {
      s = stars[i];
      sx = ((s.x - c * s.p) % W + W) % W;
      ctx.globalAlpha = s.p;
      px(sx, s.y, 1, 1, '#fff3d6');
    }
    ctx.globalAlpha = 1;
    px(252 - c * 0.12 | 0, 16, 22, 22, '#ffe9c4');
    px(250 - c * 0.12 | 0, 18, 26, 18, '#ffe9c4');
    px(248 - c * 0.12 | 0, 22, 30, 10, '#ffe9c4');
  }

  var farC = sky === 'day' ? '#8cb2c9' : sky === 'dusk' ? '#4b3453' : '#2a2240';
  var nearC = sky === 'day' ? '#6d8ba4' : sky === 'dusk' ? '#33253f' : '#221c36';
  var edge = sky === 'day' ? '#a7c4d6' : sky === 'dusk' ? '#5d4260' : '#3a3055';

  for (var f = 0; f < farCity.length; f++) {
    var b = farCity[f];
    var bx = b.x - c * 0.28;
    if (bx > W || bx + b.w < -10) continue;
    px(bx, GY - b.h, b.w, b.h, farC);
    px(bx, GY - b.h, b.w, 2, edge);
  }
  for (var n = 0; n < nearCity.length; n++) {
    var d = nearCity[n];
    var nx = d.x - c * 0.6;
    if (nx > W || nx + d.w < -10) continue;
    px(nx, GY - d.h, d.w, d.h, nearC);
    if (sky === 'day') {
      for (var dy = GY - d.h + 5; dy < GY - 6; dy += 9) {
        for (var dx = nx + 4; dx < nx + d.w - 5; dx += 8) {
          px(dx, dy, 3, 3, (dx * 5 + dy * 3) % 13 < 4 ? '#a9c4d3' : '#5b7891');
        }
      }
    } else if (sky === 'dusk') {
      for (var ey = GY - d.h + 6; ey < GY - 6; ey += 10) {
        for (var ex = nx + 4; ex < nx + d.w - 5; ex += 9) {
          px(ex, ey, 2, 3, (ex * 5 + ey * 7) % 17 < 4 ? '#7d5a52' : '#1e1730');
        }
      }
    } else {
      for (var wy = GY - d.h + 6; wy < GY - 6; wy += 10) {
        for (var wx = nx + 4; wx < nx + d.w - 5; wx += 9) {
          px(wx, wy, 2, 3, (wx * 5 + wy * 7) % 19 < 4 ? '#8f7550' : '#171230');
        }
      }
    }
  }

  px(0, GY, W, 12, sky === 'day' ? '#8e8fa0' : '#39335a');
  px(0, GY, W, 2, sky === 'day' ? '#a9aab8' : '#4d4673');
  px(0, GY + 12, W, H - GY - 12, sky === 'day' ? '#4c4d60' : '#22203a');
  for (var r = 0; r < 2; r++) {
    var base = r === 0 ? GY + 22 : GY + 32;
    for (var x = -(c % 24) - 24; x < W; x += 24) {
      px(x, base, 12, 2, sky === 'day' ? '#5c5d72' : '#312e4e');
    }
  }

  if (sky !== 'day') {
    var lamps = [120, 320, 520, 720, 920, 1220, 1420, 1620, 1820, 2020, 2220];
    for (var l = 0; l < lamps.length; l++) {
      var lx = lamps[l] - c;
      if (lx < -20 || lx > W + 20) continue;
      px(lx, GY - 52, 2, 52, sky === 'dusk' ? '#241f30' : '#191628');
      px(lx - 1, GY - 54, 8, 3, sky === 'dusk' ? '#241f30' : '#191628');
      px(lx - 2, GY - 52, 3, 3, sky === 'dusk' ? '#ffcd8a' : '#ffe08a');
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#ffcf7a';
      ctx.beginPath();
      ctx.ellipse(lx + 1, GY - 50, 7, 5, 0, 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  var fence = [560, 1900];
  for (var q = 0; q < fence.length; q++) {
    for (var fx = fence[q] - c; fx < fence[q] + 90 - c; fx += 8) {
      if (fx < -10 || fx > W) continue;
      px(fx, GY - 14, 2, 14, sky === 'day' ? '#7a7b90' : '#4a4468');
    }
    px(fence[q] - c, GY - 12, 88, 1, sky === 'day' ? '#7a7b90' : '#4a4468');
    px(fence[q] - c, GY - 6, 88, 1, sky === 'day' ? '#7a7b90' : '#4a4468');
  }
}

function drawLab() {
  px(0, 0, W, H, '#191725');
  for (var x = 0; x < W; x += 34) px(x, 16, 1, GY - 16, '#232033');
  px(0, 0, W, 15, '#1e1c2b');
  for (var i = 0; i < 4; i++) {
    var lx = 28 + i * 80;
    px(lx, 7, 24, 2, '#dfe7ff');
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#cfe0ff';
    ctx.beginPath();
    ctx.moveTo(lx, 9); ctx.lineTo(lx + 24, 9); ctx.lineTo(lx + 38, GY); ctx.lineTo(lx - 14, GY);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  px(0, GY, W, H - GY, '#2a2737');
  px(0, GY, W, 2, '#3e3a52');

  var base = Math.floor(G.cam / 130) * 130;
  for (var d = -1; d < 4; d++) {
    var dx = base + d * 130 - G.cam;
    if (dx < -60 || dx > W + 10) continue;
    px(dx + 8, GY - 20, 44, 3, '#3b3b4f');
    px(dx + 11, GY - 17, 3, 17, '#31303f');
    px(dx + 46, GY - 17, 3, 17, '#31303f');
    px(dx + 14, GY - 33, 26, 13, '#12161f');
    px(dx + 16, GY - 31, 22, 9, '#22465c');
    px(dx + 18, GY - 29, 18, 1, '#5fd0e8');
    px(dx + 18, GY - 26, 8, 1, '#3d7f92');
  }

  labDoor(1215, '연구소', 'in');
  labDoor(1590, '출구', 'out');
}

function labDoor(wx, label, kind) {
  var x = wx - G.cam;
  if (x < -40 || x > W + 20) return;
  var y = GY - 58;
  px(x - 3, y - 3, 36, 61, '#3b3850');
  px(x, y, 30, 58, '#14121e');
  px(x + 2, y + 2, 26, 54, kind === 'out' ? '#22303f' : '#232233');
  px(x + 5, y + 6, 20, 14, kind === 'out' ? '#3d6070' : '#1b1a2a');
  px(x + 6, y + 7, 18, 12, kind === 'out' ? '#7ea6b5' : '#2d3450');
  px(x + 22, y + 30, 4, 3, '#c9b98d');
  px(x - 5, y - 12, 40, 10, '#2b2940');
  ctx.font = '9px Galmuri11, monospace';
  ctx.fillStyle = kind === 'out' ? '#9fe3c0' : '#9fe3ff';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + 15, y - 4);
  ctx.textAlign = 'left';
}

function drawBusan() {
  var c = G.cam;
  drawSky('#1c2246', '#5a5a92', '#f0a884');

  for (var i = 0; i < stars.length; i += 2) {
    var s = stars[i];
    var sx = ((s.x - c * 0.15) % W + W) % W;
    ctx.globalAlpha = 0.5 * s.p;
    px(sx, s.y, 1, 1, '#fff3d6');
  }
  ctx.globalAlpha = 1;

  px(0, 96, W, H - 96, '#3d4a7a');
  for (var w = 0; w < 14; w++) {
    var y = 100 + w * 4;
    var off = (Math.sin(G.t * 1.2 + w) * 6) | 0;
    for (var x = -20 + off; x < W; x += 34) px(x + (w % 2) * 10, y, 10, 1, '#55659a');
  }

  for (var h = 0; h < busanHills.length; h++) {
    var b = busanHills[h];
    var bx = b.x - c * 0.45;
    if (bx > W || bx + b.w < -10) continue;
    px(bx, 92 - b.h, b.w, b.h, '#2a2a52');
  }

  for (var g2 = 0; g2 < 4; g2++) {
    var gx = ((g2 * 150 - c * 0.2 + G.t * 6) % 400 + 400) % 400 - 40;
    var gy = 34 - (g2 % 2) * 9;
    px(gx, gy, 3, 1, 'rgba(255,255,255,.45)');
    px(gx + 3, gy + 1, 3, 1, 'rgba(255,255,255,.45)');
    px(gx - 3, gy + 1, 3, 1, 'rgba(255,255,255,.45)');
  }

  px(0, 112, W, 12, '#2b2b48');
  px(0, 112, W, 2, '#3b3b60');

  px(0, 124, W, 22, '#564f63');
  px(0, 124, W, 2, '#6e6680');
  px(0, 146, W, 12, '#3a3550');
  for (var t2 = -(c % 20) - 20; t2 < W; t2 += 20) px(t2, 132, 12, 2, '#6a6276');

  px(0, 152, W, 3, '#8b8496');
  px(0, 160, W, 2, '#8b8496');
  for (var sl = -(c % 14) - 14; sl < W; sl += 14) px(sl, 155, 6, 7, '#4b4459');
}

function drawTrain() {
  var sh = Math.sin(G.t * 11) * 0.5;
  ctx.save();
  ctx.translate(0, sh | 0);

  var g = ctx.createLinearGradient(0, 0, 0, 150);
  g.addColorStop(0, '#d6c2a2'); g.addColorStop(0.6, '#e9dabe'); g.addColorStop(1, '#bfa98b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 150);

  px(0, 0, W, 13, '#8d7a5e');
  px(0, 13, W, 2, '#ab9473');
  for (var i = 0; i < 3; i++) {
    var lx = 30 + i * 100;
    px(lx, 3, 48, 4, '#fff6e0');
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath(); ctx.moveTo(lx, 7); ctx.lineTo(lx + 48, 7);
    ctx.lineTo(lx + 74, 140); ctx.lineTo(lx - 26, 140); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  px(16, 17, W - 32, 4, '#8f7a5c');
  px(24, 11, 30, 7, '#6b5a70');
  px(60, 12, 22, 6, '#7d6a86');
  px(214, 10, 34, 8, '#5c4f66');
  px(254, 13, 20, 5, '#6b5a70');

  var wx = 26, wy = 28, ww = 268, wh = 62;
  ctx.save();
  ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
  var sg = ctx.createLinearGradient(0, wy, 0, wy + wh);
  sg.addColorStop(0, '#ffd3a4'); sg.addColorStop(0.5, '#ffb47c'); sg.addColorStop(1, '#ffdcb6');
  ctx.fillStyle = sg; ctx.fillRect(wx, wy, ww, wh);

  var sc = G.t * 520;
  for (var h = 0; h < 6; h++) {
    var hx = ((h * 74 - sc * 0.25) % 444 + 444) % 444 + wx - 70;
    ctx.fillStyle = '#8a5a63';
    ctx.beginPath(); ctx.moveTo(hx, wy + wh - 14);
    ctx.lineTo(hx + 34, wy + wh - 32); ctx.lineTo(hx + 68, wy + wh - 14);
    ctx.closePath(); ctx.fill();
  }
  px(wx, wy + wh - 18, ww, 18, '#6b4356');
  for (var p = 0; p < 8; p++) {
    var pxx = ((p * 46 - sc) % 368 + 368) % 368 + wx - 20;
    px(pxx, wy + 8, 2, wh - 26, '#4e3242');
    px(pxx - 12, wy + 10, 26, 1, '#4e3242');
  }
  for (var m = 0; m < 7; m++) {
    var my = ((m * 40 - sc * 1.6) % 280 + 280) % 280 + wx - 20;
    px(my, wy + 30 + (m % 3) * 8, 30, 1, 'rgba(255,255,255,.28)');
  }
  ctx.restore();

  rrect(wx - 3, wy - 3, ww + 6, wh + 6, 3, null, '#8d7c64');
  px(wx + ww / 3 - 1, wy, 2, wh, '#9b896e');
  px(wx + ww * 2 / 3 - 1, wy, 2, wh, '#9b896e');
  px(wx - 3, wy + wh / 2 - 1, ww + 6, 2, '#9b896e');

  px(0, 96, W, 38, '#b9a488');
  px(0, 96, W, 2, '#9d8768');

  for (var sr = 0; sr < 2; sr++) {
    var sx = sr ? 196 : 18;
    var sw = sr ? 106 : 108;
    px(sx, 100, sw, 18, '#6e5f7e');
    px(sx, 100, sw, 2, '#8b78a0');
    px(sx, 116, sw, 18, '#8b78a0');
    px(sx, 116, sw, 2, '#a591b8');
    px(sx, 132, sw, 6, '#4e425c');
    px(sx + 4, 138, 4, 8, '#3d3448');
    px(sx + sw - 8, 138, 4, 8, '#3d3448');
    px(sx + sw - 10, 108, 8, 3, '#5a4c66');
    for (var c = 1; c < 3; c++) px(sx + (sw / 3) * c, 116, 1, 16, '#7a6888');
  }

  px(0, 146, W, H - 146, '#4a3e52');
  px(0, 146, W, 2, '#6a5a74');
  for (var fl = 0; fl < 16; fl++) px(fl * 20 + 4, 158 + (fl % 2) * 8, 10, 2, '#584a62');

  drawBoy(146, 126, Math.sin(G.t * 3) * 0.3, 1);
  if (G.flags.cat) drawCat(108, 142, 1);
  if (G.flags.dogOut) drawDog(178, 142, 1);

  ctx.font = '9px Galmuri11, monospace';
  ctx.fillStyle = 'rgba(255,236,212,.32)';
  ctx.textAlign = 'center';
  ctx.fillText(G.t % 3 < 1.5 ? '덜컹덜컹' : '쿵덕 쿵덕', W / 2, 160);
  ctx.textAlign = 'left';
  ctx.restore();
}

function wrapText(text, maxW, font) {
  ctx.font = font;
  var out = [], line = '';
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '\n') { out.push(line); line = ''; continue; }
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function drawToast() {
  if (G.toast.t <= 0) return;
  var font = '11px Galmuri11, monospace';
  var lines = wrapText(G.toast.text, 266, font);
  var h = lines.length * 14 + 10;
  var y = 8;
  ctx.globalAlpha = Math.min(1, G.toast.t * 3) * Math.min(1, (3.6 - G.toast.t) * 6 + 0.2);
  rrect(14, y, W - 28, h, 3, 'rgba(12,10,22,.94)', 'rgba(255,214,170,.55)');
  px(14, y + h - 1, W - 28, 1, 'rgba(255,214,170,.25)');
  ctx.font = font;
  ctx.fillStyle = '#ffe9cf';
  ctx.textAlign = 'center';
  for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, y + 17 + i * 14);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function drawParts() {
  for (var i = 0; i < G.parts.length; i++) {
    var q = G.parts[i];
    var a = clamp(q.life / q.max, 0, 1);
    if (!q.heart) {
      ctx.globalAlpha = a * 0.45;
      px(q.x - q.vx * 0.05, q.y - q.vy * 0.05, q.size || 1, q.size || 1, q.col);
      px(q.x - q.vx * 0.025, q.y - q.vy * 0.025, q.size || 1, q.size || 1, q.col);
    }
    ctx.globalAlpha = a;
    if (q.heart) {
      px(q.x - 1, q.y, 3, 2, q.col);
      px(q.x, q.y - 1, 1, 1, q.col);
      px(q.x + 1, q.y + 2, 1, 1, q.col);
    } else {
      px(q.x, q.y, q.size || 1, q.size || 1, q.col);
    }
  }
  ctx.globalAlpha = 1;
}

function drawTrailPets() {
  var i1 = G.trail.length - 34;
  if (i1 >= 0 && G.flags.cat) {
    var p1 = G.trail[i1];
    drawCat(p1.x - G.cam + 1, p1.y + 14 + Math.sin(G.t * 3) * 1.5, p1.face);
  }
  var i2 = G.trail.length - 64;
  if (i2 >= 0 && G.flags.dogOut) {
    var p2 = G.trail[i2];
    drawDog(p2.x - G.cam + 1, p2.y + 16, p2.face);
  }
}

function drawStreetWorld() {
  if (G.zone === 'lab') drawLab(); else drawStreet();
  var c = G.cam;

  if (!G.flags.cat) {
    var cb = GY - 52 + Math.sin(G.t * 2.2) * 3;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath(); ctx.arc(385 - c, cb + 4, 7, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    drawCat(380 - c, cb, 1);
    if (G.player.x > 260 && G.player.x < 380) {
      ctx.font = '9px Galmuri11, monospace';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textAlign = 'center';
      ctx.fillText('↑ 점프!', 385 - c, cb - 8);
      ctx.textAlign = 'left';
    }
  }

  if (!G.flags.letter && G.player.x < 1120) {
    var lx2 = 1120 - c;
    px(lx2 + 6, GY - 12, 4, 12, '#4a4468');
    px(lx2 - 2, GY - 14, 20, 3, '#6a5f86');
    var lf = Math.sin(G.t * 2) * 1;
    px(lx2 + 2, GY - 24 + lf, 13, 9, '#f6f1e4');
    px(lx2 + 2, GY - 24 + lf, 13, 1, '#d9cfbc');
    px(lx2 + 2, GY - 20 + lf, 13, 1, '#c9576a');
  }

  if (G.player.x > 1060 && G.player.x < 1240) {
    var dz = 1250 - c;
    px(dz - 6, GY - 64, 54, 64, '#2f2b3e');
    px(dz, GY - 58, 42, 58, '#12111c');
    px(dz + 18, GY - 30, 6, 30, '#3a3752');
    px(dz - 4, GY - 70, 50, 8, '#3c3850');
    ctx.font = '9px Galmuri11, monospace';
    ctx.fillStyle = '#9fe3ff';
    ctx.textAlign = 'center';
    ctx.fillText('연구소', dz + 21, GY - 63);
    ctx.textAlign = 'left';
  }

  if (!G.flags.womanGone) {
    var wm = G.woman;
    drawWoman(wm.x - c, GY - 24, wm.face, wm.run ? G.t * 16 : 0);
  }

  if (G.zone === 'lab') {
    drawDirector(1470 - c, GY - 24, G.flags.dirDown);
    if (G.cine && G.cine.type === 'throw' && G.cine.t < 0.72) {
      var pr = clamp(G.cine.t / 0.42, 0, 1);
      var lx3 = G.player.x + (1470 - G.player.x) * pr;
      var ly3 = G.player.y + 2 + (GY - 26 - G.player.y - 2) * pr - Math.sin(pr * Math.PI) * 24;
      px(lx3 - c - 2, ly3, 11, 8, '#f6f1e4');
      px(lx3 - c - 2, ly3 + 3, 11, 1, '#c9576a');
    }
  }

  if (!G.flags.dog && G.player.x > 1640) {
    ctx.globalAlpha = 0.9;
    drawDog(1750 - c, GY - 8, -1);
    ctx.globalAlpha = 1;
  }

  if (!G.flags.ticket) {
    var tx = 2000 - c;
    px(tx + 8, GY - 14, 4, 14, '#4a4468');
    px(tx, GY - 16, 20, 3, '#6a5f86');
    var fly = Math.sin(G.t * 2) * 1.5;
    px(tx + 5, GY - 26 + fly, 11, 7, '#fff3d6');
    px(tx + 5, GY - 24 + fly, 11, 1, '#ffb3c7');
    px(tx + 9, GY - 26 + fly, 1, 7, '#d8cbb8');
  }

  drawObstacles(c);
  drawTrailPets();
  drawBoy(G.player.x - c, G.player.y, G.player.ph, G.player.face);
  if (G.lock > 0 && !G.card && !G.scene) drawAlert(G.player.x - c + 6, G.player.y);

  if (G.player.x > 2240) {
    var ax = 2400 - c;
    px(ax, GY - 64, 74, 64, '#3a3550');
    px(ax + 6, GY - 58, 62, 58, '#1b1b30');
    px(ax + 32, GY - 36, 12, 36, '#ffd98a');
    px(ax + 36, GY - 36, 4, 36, '#ffe9b8');
    px(ax - 4, GY - 70, 82, 6, '#4b4568');
    ctx.font = '9px Galmuri11, monospace';
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center';
    ctx.fillText('대전역', ax + 37, GY - 74);
    ctx.textAlign = 'left';
  }
}

function drawBusanWorld() {
  drawBusan();
  var wm = G.woman;
  drawObstacles(G.cam);
  drawTrailPets();
  drawWoman(wm.x - G.cam, GY - 24, wm.face, 0);
  drawBoy(G.player.x - G.cam, G.player.y, G.player.ph, G.player.face);
  if (G.lock > 0) drawAlert(G.player.x - G.cam + 6, G.player.y);

  if (!G.flags.meeting && G.player.x < wm.x - 90) {
    ctx.font = '10px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.3 * Math.sin(G.t * 5)) + ')';
    ctx.textAlign = 'center';
    ctx.fillText('▶', W - 26, 100);
    ctx.fillText('▶', W - 42, 100);
    ctx.textAlign = 'left';
  }
}

function drawEnding() {
  drawSky('#0d0c1d', '#221a3a', '#3a2440');
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    ctx.globalAlpha = 0.6 * s.p;
    px(s.x, s.y + 10, 1, 1, '#fff3d6');
  }
  ctx.globalAlpha = 1;

  px(0, GY, W, H - GY, '#161226');
  px(0, GY, W, 1, '#2b2340');
  if (G.endingT > 2.4) {
    px(0, 149, W, 31, 'rgba(10,8,20,.62)');
    px(0, 149, W, 1, 'rgba(255,214,170,.18)');
  }

  drawParts();

  var bx = (W / 2 - 24) | 0, fy = GY + 2;
  var gl = ctx.createRadialGradient(W / 2, fy - 10, 2, W / 2, fy - 10, 40);
  gl.addColorStop(0, 'rgba(255,207,138,.30)');
  gl.addColorStop(1, 'rgba(255,207,138,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.ellipse(W / 2, fy - 10, 40, 26, 0, 0, 7); ctx.fill();
  if (G.flags.dogOut) drawDog(bx + 30, fy - 8, 1);
  if (G.flags.cat) drawCat(bx - 12, fy - 8, 1);
  drawBoy(bx, fy - 24, Math.sin(G.t * 2) * 0.35, 1);
  drawWoman(bx + 14, fy - 24, -1, Math.sin(G.t * 2 + 1) * 0.35);

  var pulse = 1 + Math.sin(G.t * 3) * 0.03;
  ctx.save();
  ctx.translate(W / 2, 58);
  ctx.scale(pulse, pulse);
  ctx.textAlign = 'center';
  ctx.font = '38px Galmuri11, monospace';
  ctx.fillStyle = 'rgba(255,209,102,.25)';
  ctx.fillText('600일', 2, 3);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText('600일', 0, 0);
  ctx.font = '11px Galmuri11, monospace';
  ctx.fillStyle = '#ffb3c7';
  ctx.fillText('우다영 ♥', 0, 22);
  ctx.restore();

  if (G.endingT > 2.4) {
    ctx.textAlign = 'center';
    ctx.font = '10px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(255,240,214,' + (0.85 + 0.15 * Math.sin(G.t * 2.5)) + ')';
    ctx.fillText('앙꼬 · 다다와 함께, 앞으로도 잘 부탁해', W / 2, 161);
    ctx.font = '9px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(200,190,225,' + (0.55 + 0.35 * Math.sin(G.t * 3)) + ')';
    ctx.fillText('tap to restart', W / 2, 174);
    ctx.textAlign = 'left';
  }
}

function drawTitle() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#141330'); g.addColorStop(0.6, '#4a2b52'); g.addColorStop(1, '#d9745f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    ctx.globalAlpha = 0.5 * s.p;
    px(s.x, s.y, 1, 1, '#fff3d6');
  }
  ctx.globalAlpha = 1;
  px(0, GY, W, H - GY, '#22203a');
  drawBoy(70, GY - 24, G.t * 4, 1);
  drawCat(92, GY - 14 + Math.sin(G.t * 3) * 1.5, 1);
  drawDog(108, GY - 14, 1);
  drawWoman(180, GY - 24, -1, 0);

  ctx.textAlign = 'center';
  ctx.font = '30px Galmuri11, monospace';
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillText('600일', W / 2 + 2, 63);
  ctx.fillStyle = '#fff3d6';
  ctx.fillText('600일', W / 2, 61);
  ctx.font = '9px Galmuri11, monospace';
  ctx.fillStyle = '#ffd0dd';
  ctx.fillText('앙꼬, 다다, 그리고 우다영', W / 2, 74);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.45 * Math.sin(G.t * 3)) + ')';
  ctx.fillText('TAP / SPACE', W / 2, 112);
  ctx.textAlign = 'left';
}

/* ---------- extra scenes ---------- */
function drawCard() {
  var k = G.card.t / G.card.dur;
  var a = Math.min(1, k * 6) * Math.min(1, (1 - k) * 6 + 0.15);
  ctx.globalAlpha = Math.min(1, a);
  px(0, 0, W, H, '#0b0a14');
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.font = '13px Galmuri11, monospace';
  ctx.fillStyle = '#f3ecff';
  ctx.fillText(G.card.text, W / 2, H / 2 - 2);
  px(W / 2 - 26, H / 2 + 8, 52, 1, 'rgba(243,236,255,.35)');
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function drawScene() {
  var s = G.scene, k = s.t;
  var a = k < 0.6 ? k / 0.6 : k > 4.4 ? Math.max(0, 1 - (k - 4.4) / 0.6) : 1;
  ctx.globalAlpha = Math.min(1, a);
  px(0, 0, W, H, '#f2f6fb');
  px(0, 132, W, H - 132, '#dfe7f0');
  px(0, 132, W, 2, '#c7d3e0');

  px(24, 24, 54, 44, '#cfe6f5');
  px(27, 27, 48, 38, '#eaf7ff');
  px(50, 24, 2, 44, '#cfe6f5');

  px(206, 30, 16, 5, '#e4586e');
  px(211, 25, 6, 15, '#e4586e');

  px(88, 96, 4, 36, '#b8c4d2');
  px(150, 96, 4, 36, '#b8c4d2');
  px(84, 88, 74, 12, '#eef3f8');
  px(84, 88, 74, 3, '#ffffff');
  px(84, 96, 74, 14, '#9fd3c4');
  px(84, 96, 74, 3, '#c2ecdf');
  px(90, 86, 20, 8, '#ffffff');
  drawDog(112, 90, 1);

  px(176, 72, 3, 60, '#b8c4d2');
  px(170, 66, 15, 8, '#dbe7f2');
  px(180, 78, 1, 12, '#9fb2c4');

  ctx.textAlign = 'center';
  ctx.font = '11px Galmuri11, monospace';
  ctx.fillStyle = '#3b4a5c';
  ctx.fillText('다다가 무사히 나았다.', W / 2, 120);
  ctx.font = '9px Galmuri11, monospace';
  ctx.fillStyle = '#8b9aab';
  ctx.fillText('동물병원', W / 2, 156);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
}

function drawDirector(x, y, down) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  if (down) { ctx.translate(0, 24); ctx.rotate(Math.PI / 2); }
  var hair = '#b8b3c2', coat = '#f4f6fb', coatD = '#cfd6e4', skin = '#f0c9a6',
    shirt = '#2b2c3e', tie = '#a33a4e', pants = '#3a3b4e';
  px(2, 0, 8, 3, hair);
  px(1, 2, 10, 2, hair);
  px(2, 4, 8, 4, skin);
  px(3, 5, 2, 1, '#8fd0ff'); px(7, 5, 2, 1, '#8fd0ff');
  px(3, 5, 1, 1, '#2b2b3a'); px(7, 5, 1, 1, '#2b2b3a');
  px(5, 7, 2, 1, '#c9a184');
  px(3, 8, 6, 8, coat);
  px(4, 8, 4, 3, shirt);
  px(5, 9, 2, 5, tie);
  px(2, 9, 1, 6, coatD); px(9, 9, 1, 6, coatD);
  px(3, 16, 6, 2, pants);
  px(3, 18, 2, 5, pants); px(7, 18, 2, 5, pants);
  px(3, 23, 2, 1, '#1e1d26'); px(7, 23, 2, 1, '#1e1d26');
  ctx.restore();
}

function drawBoySit(x, y) {
  ctx.save();
  ctx.translate(x | 0, y | 0);
  var skin = '#f7cfa8', hair = '#2a2333', shirt = '#eef3ff', shirtD = '#c3cfe8', pants = '#3b4670';
  px(2, -13, 10, 13, shirt);
  px(1, -12, 1, 9, shirtD); px(12, -12, 1, 9, shirtD);
  px(2, -13, 10, 1, '#ffffff');
  px(0, -11, 2, 6, shirt); px(0, -5, 2, 2, skin);
  px(12, -11, 2, 3, shirt); px(13, -8, 2, 3, skin);
  px(4, 0, 9, 4, pants);
  px(4, 4, 2, 3, '#2f3959');
  px(9, 4, 3, 17, pants);
  px(9, 20, 6, 3, '#1e1d26');
  px(2, 0, 3, 3, '#2f3959');
  px(2, 3, 2, 16, pants);
  px(2, 18, 5, 3, '#1e1d26');
  px(3, -24, 9, 3, hair);
  px(2, -22, 11, 9, skin);
  px(3, -24, 10, 3, hair);
  px(3, -20, 2, 2, '#2a2333'); px(9, -20, 2, 2, '#2a2333');
  px(6, -17, 2, 1, '#dfa87e');
  px(2, -22, 1, 7, hair); px(12, -22, 1, 5, hair);
  ctx.restore();
}

function drawAlert(x, y) {
  var b = Math.sin(G.t * 7) * 1;
  ctx.save();
  ctx.translate(x | 0, (y + b) | 0);
  px(-1, -8, 3, 1, '#fff8e8'); px(0, -7, 1, 2, '#fff8e8');
  rrect(-6, -21, 12, 14, 3, '#fff8e8', '#2a2333');
  px(-1, -19, 3, 6, '#2a2333');
  px(-1, -11, 3, 3, '#2a2333');
  ctx.restore();
}

/* ---------- render ---------- */
function render() {
  if (G.mode === 'title') {
    drawTitle();
  } else if (G.world === 'ending') {
    drawEnding();
  } else {
    if (G.world === 'street') drawStreetWorld();
    else if (G.world === 'train') drawTrain();
    else drawBusanWorld();
    drawParts();
    drawHUD();
    drawToast();
    if (G.scene) drawScene();
    if (G.blink > 0) {
      var bh = (H / 2) * G.blink;
      px(0, 0, W, bh, '#08070e');
      px(0, H - bh, W, bh, '#08070e');
    }
  }

  if (G.card) drawCard();
  if (G.flash > 0) {
    ctx.globalAlpha = Math.min(0.85, G.flash);
    px(0, 0, W, H, '#0b0a14');
    ctx.globalAlpha = 1;
  }
  if (G.fade > 0) {
    ctx.globalAlpha = G.fade;
    px(0, 0, W, H, '#08070e');
    ctx.globalAlpha = 1;
  }
}

/* ---------- loop ---------- */
var last = 0;

function frame(now) {
  if (!last) last = now;
  var dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  ctx.clearRect(0, 0, W, H);
  render();
  requestAnimationFrame(frame);
}

/* start */
G.flags = { cat: false, woman: false, womanGone: false, letter: false, dirDown: false, dog: false, ticket: false, meeting: false };
G.woman = { x: 900, face: -1, run: false };
requestAnimationFrame(frame);
