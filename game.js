'use strict';

/* clamp() / overlap() live in logic.js (shared with test.js) */

/* ---------- constants ---------- */
var W = 320, H = 180, GY = 146;
var STREET_LEN = 2100, BUSAN_LEN = 1250;

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
  worldX: 0
};

function say(text, dur) {
  G.toast = { text: text, t: dur || 2.6 };
  sfx('text');
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
  G.flags = { cat: false, woman: false, womanGone: false, dog: false, ticket: false, meeting: false };
  G.woman = { x: 800, face: -1, run: false };
  music('street');
  say('앙꼬와 함께 걷는 길', 2.4);
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
    music('train');
    say('대전역 · 부산행 무궁화호', 3.0);
  } else if (next === 'busan') {
    G.world = 'busan';
    G.player.x = 1040;
    G.player.y = GY - 24;
    G.player.face = -1;
    G.player.vx = 0;
    G.cam = clamp(G.player.x - W * 0.38, 0, BUSAN_LEN - W);
    G.trail = [];
    for (var i = 0; i < 90; i++) {
      G.trail.push({ x: G.player.x + (90 - i) * 0.8, y: G.player.y, face: -1, ph: 0 });
    }
    G.woman = { x: 250, face: 1, run: false };
    music('busan');
    say('부산이다. 처음 와본다.', 3.0);
  } else if (next === 'ending') {
    G.mode = 'end';
    G.world = 'ending';
    G.endingT = 0;
    G.parts = [];
    music('ending');
  }
}

/* ---------- update ---------- */
function update(dt) {
  G.t += dt;
  if (G.toast.t > 0) G.toast.t -= dt;
  if (G.lock > 0) G.lock -= dt;

  if (G.trans) {
    G.trans.t += dt;
    if (G.trans.t < 0.5) G.fade = G.trans.t / 0.5;
    else {
      if (!G.trans.done) { enterWorld(G.trans.next); G.trans.done = true; }
      G.fade = 1 - (G.trans.t - 0.5) / 0.5;
    }
    if (G.trans.t >= 1) { G.trans = null; G.fade = 0; }
  }

  if (G.mode === 'play' && G.world === 'street') updateStreet(dt);
  else if (G.mode === 'play' && G.world === 'train') updateTrain(dt);
  else if (G.mode === 'play' && G.world === 'busan') updateBusan(dt);
  else if (G.mode === 'end') updateEnding(dt);

  if (G.mode === 'play') updatePlayer(dt);
  updateParts(dt);
}

function updatePlayer(dt) {
  var p = G.player;
  var canMove = G.lock <= 0 && !G.trans;
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

  if (p.vx !== 0) p.ph += dt * 9;
  else p.ph = 0;

  G.trail.push({ x: p.x, y: p.y, face: p.face, ph: p.ph });
  if (G.trail.length > 90) G.trail.shift();

  var len = G.world === 'busan' ? BUSAN_LEN : STREET_LEN;
  var target = clamp(p.x - W * 0.38, 0, Math.max(0, len - W));
  G.cam += (target - G.cam) * Math.min(1, dt * 8);
}

function updateStreet(dt) {
  var p = G.player;

  /* cat */
  if (!G.flags.cat) {
    var cat = { x: 380, y: GY - 52, w: 14, h: 8 };
    var bob = Math.sin(G.t * 2.2) * 3;
    cat.y += bob;
    if (overlap(p, cat) || p.x > 520) {
      G.flags.cat = true;
      sfx('meow');
      say('고양이를 얻었다. 이름은 앙꼬라 하자.', 3.4);
    }
  }

  /* woman encounter */
  var wm = G.woman;
  if (!G.flags.woman && p.x > wm.x - 110) {
    G.flags.woman = true;
    G.cine = { type: 'woman', t: 0 };
    G.lock = 2.6;
    wm.face = -1;
  }
  if (G.cine && G.cine.type === 'woman') {
    G.cine.t += dt;
    if (G.cine.t > 0.15 && !G.cine.said) { G.cine.said = true; say('?! 첫눈에 반했다.', 2.6); }
    if (G.cine.t > 1.1) { wm.run = true; wm.face = 1; }
    if (wm.run) {
      wm.x += 460 * dt;
      if (wm.x > 1640) G.flags.womanGone = true;
    }
    if (G.cine.t > 3.2) { G.cine = null; if (wm.x > 1400) G.flags.womanGone = true; }
  }

  /* dog */
  if (!G.flags.dog && !G.trans) {
    var dog = { x: 1120, y: GY - 8, w: 14, h: 8 };
    if (overlap(p, dog) || p.x > 1190) {
      G.flags.dog = true;
      sfx('bark');
      say('이름은 多多인 모양이다.', 3.2);
    }
  }

  /* ticket */
  if (!G.flags.ticket) {
    var tk = { x: 1432, y: GY - 22, w: 10, h: 8 };
    if (overlap(p, tk)) {
      G.flags.ticket = true;
      sfx('get');
      say('대전 – 부산 행 티켓을 받았다.', 3.2);
    }
  }

  if (p.x > 1790) startTransition('train');
}

function updateTrain(dt) {
  G.trainT += dt;
  if (G.trainT > 8.2) startTransition('busan');
}

function updateBusan(dt) {
  var p = G.player, wm = G.woman;

  if (!G.flags.meeting && Math.abs(p.x - wm.x) < 52) {
    G.flags.meeting = true;
    G.cine = { type: 'meet', t: 0 };
    G.lock = 3.0;
    wm.face = 1;
  }
  if (G.cine && G.cine.type === 'meet') {
    G.cine.t += dt;
    if (G.cine.t > 0.25 && !G.cine.said) {
      G.cine.said = true;
      say('여자친구다. 이름은 우다영이다.', 3.0);
      sfx('heart');
    }
    if (G.cine.t > 0.4 && !G.cine.hearts) {
      G.cine.hearts = true;
      for (var i = 0; i < 16; i++) {
        G.parts.push({
          x: wm.x - G.cam + 6, y: GY - 30,
          vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40,
          life: 2.4, max: 2.4, col: '#ff8fb0', size: 2, heart: true
        });
      }
    }
    if (G.cine.t > 2.4 && !G.cine.blink) { G.cine.blink = true; sfx('blink'); }
  }

  /* blink -> ending */
  if (G.cine && G.cine.blink) {
    G.blink = Math.min(1, G.blink + dt * 1.6);
    if (G.blink >= 1) startTransition('ending');
  }
}

function updateEnding(dt) {
  G.endingT += dt;
  G.fwTimer -= dt;
  if (G.endingT > 1.2 && G.fwTimer <= 0) {
    G.fwTimer = 0.7;
    firework(30 + Math.random() * 260, 24 + Math.random() * 70);
  }
}

function firework(x, y) {
  sfx('boom');
  var hue = Math.random();
  var cols = hue < 0.34 ? ['#ffd166', '#ff9f43', '#fff1b8'] :
    hue < 0.67 ? ['#ff8fb0', '#ff5c8a', '#ffd0dd'] : ['#9ad1ff', '#7ee0c0', '#e6f6ff'];
  for (var i = 0; i < 54; i++) {
    var a = (i / 54) * Math.PI * 2 + Math.random() * 0.16;
    var sp = 60 + Math.random() * 110;
    G.parts.push({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 1.9, max: 1.9, col: cols[i % cols.length], size: 1 + (Math.random() < 0.35 ? 1 : 0)
    });
  }
  G.parts.push({ x: x, y: y, vx: 0, vy: 0, life: 0.18, max: 0.18, col: '#fffbe8', size: 4 });
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
  var c = G.cam;
  drawSky('#151430', '#4c2b52', '#d9745f');

  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    var sx = ((s.x - c * s.p) % W + W) % W;
    var tw = 0.35 + 0.65 * Math.abs(Math.sin(G.t * 1.7 + i));
    ctx.globalAlpha = tw * s.p;
    px(sx, s.y, 1, 1, '#fff3d6');
  }
  ctx.globalAlpha = 1;

  px(252 - c * 0.12 | 0, 16, 22, 22, '#ffe9c4');
  px(250 - c * 0.12 | 0, 18, 26, 18, '#ffe9c4');
  px(248 - c * 0.12 | 0, 22, 30, 10, '#ffe9c4');
  px(252 - c * 0.12 | 0, 16, 22, 5, '#ffd9a0');

  for (var f = 0; f < farCity.length; f++) {
    var b = farCity[f];
    var bx = b.x - c * 0.28;
    if (bx > W || bx + b.w < -10) continue;
    px(bx, GY - b.h, b.w, b.h, '#2c2440');
    px(bx, GY - b.h, b.w, 2, '#3a3055');
  }
  for (var n = 0; n < nearCity.length; n++) {
    var d = nearCity[n];
    var nx = d.x - c * 0.6;
    if (nx > W || nx + d.w < -10) continue;
    px(nx, GY - d.h, d.w, d.h, '#231d38');
    for (var wy = GY - d.h + 5; wy < GY - 6; wy += 8) {
      for (var wx = nx + 3; wx < nx + d.w - 3; wx += 6) {
        if ((wx * 7 + wy * 3) % 11 < 4) px(wx, wy, 2, 2, '#ffd98a');
      }
    }
  }

  px(0, GY, W, 12, '#39335a');
  px(0, GY, W, 2, '#4d4673');
  px(0, GY + 12, W, H - GY - 12, '#22203a');
  for (var r = 0; r < 2; r++) {
    var base = r === 0 ? GY + 22 : GY + 32;
    for (var x = -(c % 24) - 24; x < W; x += 24) px(x, base, 12, 2, '#312e4e');
  }

  var lamps = [120, 320, 520, 720, 920, 1220, 1420, 1620, 1820];
  for (var l = 0; l < lamps.length; l++) {
    var lx = lamps[l] - c;
    if (lx < -20 || lx > W + 20) continue;
    px(lx, GY - 52, 2, 52, '#191628');
    px(lx - 1, GY - 54, 8, 3, '#191628');
    px(lx - 2, GY - 52, 3, 3, '#ffe08a');
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath();
    ctx.ellipse(lx + 1, GY - 50, 7, 5, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  var fence = [520, 1400];
  for (var q = 0; q < fence.length; q++) {
    for (var fx = fence[q] - c; fx < fence[q] + 90 - c; fx += 8) {
      if (fx < -10 || fx > W) continue;
      px(fx, GY - 14, 2, 14, '#4a4468');
    }
    px(fence[q] - c, GY - 12, 88, 1, '#4a4468');
    px(fence[q] - c, GY - 6, 88, 1, '#4a4468');
  }
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
  var c = G.t, scroll = c * 130;
  drawSky('#1a2340', '#3d4b74', '#8e8fb4');

  for (var i = 0; i < 5; i++) {
    var x = ((i * 120 - scroll * 0.5) % 480 + 480) % 480 - 80;
    px(x, 108, 90, 30, '#242e4e');
    px(x + 70, 96, 24, 42, '#242e4e');
  }
  for (var j = 0; j < 8; j++) {
    var hx = ((j * 90 - scroll) % 400 + 400) % 400 - 60;
    px(hx, 118, 26, 20, '#2c3556');
    px(hx + 4, 124, 4, 4, '#ffd98a');
  }
  px(0, 126, W, 8, '#2a3252');
  for (var m = -(scroll % 40) - 40; m < W; m += 40) px(m, 129, 20, 2, '#39426a');

  var bob = Math.sin(G.t * 7) * 0.6;
  var ty = 66 + bob;
  px(26, ty + 46, 268, 4, 'rgba(0,0,0,.35)');

  rrect(24, ty, 272, 48, 6, '#e6ebf7', '#b9c3da');
  px(24, ty + 30, 272, 6, '#6ab7c9');
  px(24, ty + 42, 272, 3, '#c9d2e4');
  px(24, ty + 6, 272, 2, '#f6f9ff');

  for (var w2 = 0; w2 < 5; w2++) {
    var wx = 36 + w2 * 52;
    px(wx, ty + 8, 40, 20, '#8ec8d8');
    px(wx, ty + 8, 40, 2, '#b8e2ec');
    if (w2 === 2) {
      px(wx + 14, ty + 16, 12, 12, '#2a2333');
      px(wx + 17, ty + 12, 6, 5, '#2a2333');
      px(wx + 17, ty + 15, 6, 3, '#f7cfa8');
      px(wx + 18, ty + 16, 1, 1, '#2a2333');
      px(wx + 21, ty + 16, 1, 1, '#2a2333');
    }
  }

  px(24, ty + 36, 272, 3, '#d34a55');
  px(292, ty + 4, 4, 40, '#c9d2e4');

  var wheelA = (scroll * 0.5) % 12;
  for (var w3 = 0; w3 < 4; w3++) {
    var cx = 62 + w3 * 70, cy = ty + 52;
    ctx.fillStyle = '#2b2b3a';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#565a70';
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
    px(cx - 1 + ((wheelA + w3) % 6) - 3, cy - 4, 1, 8, '#767b94');
  }

  for (var sp = 0; sp < 6; sp++) {
    var sx = ((sp * 70 - scroll * 2) % 420 + 420) % 420;
    px(sx, 40 + (sp % 3) * 8, 26, 1, 'rgba(255,255,255,.25)');
  }

  var sit = G.t % 4;
  ctx.font = '9px Galmuri11, monospace';
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.textAlign = 'center';
  ctx.fillText(sit < 2 ? '덜컹덜컹' : '. . .', W / 2, 145);
  ctx.textAlign = 'left';
}

/* ---------- hud ---------- */
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
  var font = '10px Galmuri11, monospace';
  var lines = wrapText(G.toast.text, 268, font);
  var h = lines.length * 13 + 9;
  var y = 8;
  ctx.globalAlpha = Math.min(1, G.toast.t * 3) * Math.min(1, (3.6 - G.toast.t) * 6 + 0.2);
  rrect(14, y, W - 28, h, 3, 'rgba(12,10,22,.94)', 'rgba(255,214,170,.55)');
  px(14, y + h - 1, W - 28, 1, 'rgba(255,214,170,.25)');
  ctx.font = font;
  ctx.fillStyle = '#ffe9cf';
  ctx.textAlign = 'center';
  for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], W / 2, y + 16 + i * 13);
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
  if (i2 >= 0 && G.flags.dog) {
    var p2 = G.trail[i2];
    drawDog(p2.x - G.cam + 1, p2.y + 16, p2.face);
  }
}

function drawStreetWorld() {
  drawStreet();

  if (!G.flags.cat) {
    var cb = GY - 52 + Math.sin(G.t * 2.2) * 3;
    ctx.globalAlpha = 0.14 + 0.10 * Math.sin(G.t * 4);
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath(); ctx.arc(385 - G.cam, cb + 4, 8, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    drawCat(380 - G.cam, cb, 1);
    if (G.player.x > 260 && G.player.x < 380) {
      ctx.font = '8px Galmuri11, monospace';
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textAlign = 'center';
      ctx.fillText('↑ 점프!', 380 - G.cam + 5, cb - 8);
      ctx.textAlign = 'left';
    }
  }

  if (!G.flags.dog) {
    ctx.globalAlpha = 0.85;
    drawDog(1120 - G.cam, GY - 8, -1);
    ctx.globalAlpha = 1;
  }

  if (!G.flags.ticket) {
    var tx = 1424 - G.cam;
    px(tx + 8, GY - 14, 4, 14, '#4a4468');
    px(tx, GY - 16, 20, 3, '#6a5f86');
    var fly = Math.sin(G.t * 2) * 1.5;
    px(tx + 5, GY - 26 + fly, 11, 7, '#fff3d6');
    px(tx + 5, GY - 24 + fly, 11, 1, '#ffb3c7');
    px(tx + 9, GY - 26 + fly, 1, 7, '#d8cbb8');
  }

  if (!G.flags.womanGone) {
    var wm = G.woman;
    drawWoman(wm.x - G.cam, GY - 24, wm.face, wm.run ? G.t * 16 : 0);
  }

  drawTrailPets();
  drawBoy(G.player.x - G.cam, G.player.y, G.player.ph, G.player.face);

  if (G.player.x > 1660) {
    var ax = 1820 - G.cam;
    px(ax, GY - 60, 70, 60, '#2b2b48');
    px(ax + 6, GY - 54, 58, 54, '#1b1b30');
    px(ax + 30, GY - 34, 12, 34, '#ffd98a');
    px(ax + 34, GY - 34, 4, 34, '#ffe9b8');
    px(ax - 4, GY - 66, 78, 6, '#3b3b60');
    ctx.font = '8px Galmuri11, monospace';
    ctx.fillStyle = '#ffe9b8';
    ctx.textAlign = 'center';
    ctx.fillText('대전역', ax + 35, GY - 70);
    ctx.textAlign = 'left';
  }
}

function drawBusanWorld() {
  drawBusan();
  drawTrailPets();
  var wm = G.woman;
  drawWoman(wm.x - G.cam, GY - 24, wm.face, 0);
  drawBoy(G.player.x - G.cam, G.player.y, G.player.ph, G.player.face);

  if (!G.flags.meeting && G.player.x < 700) {
    ctx.font = '10px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.3 * Math.sin(G.t * 5)) + ')';
    ctx.textAlign = 'center';
    ctx.fillText('◀', 40, 100);
    ctx.fillText('◀', 24, 100);
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

  drawParts();

  var bx = (W / 2 - 24) | 0, fy = GY + 2;
  var gl = ctx.createRadialGradient(W / 2, fy - 10, 2, W / 2, fy - 10, 40);
  gl.addColorStop(0, 'rgba(255,207,138,.30)');
  gl.addColorStop(1, 'rgba(255,207,138,0)');
  ctx.fillStyle = gl;
  ctx.beginPath(); ctx.ellipse(W / 2, fy - 10, 40, 26, 0, 0, 7); ctx.fill();
  if (G.flags.dog) drawDog(bx + 30, fy - 8, 1);
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
    ctx.font = '9px Galmuri11, monospace';
    ctx.fillStyle = 'rgba(240,232,255,' + (0.7 + 0.3 * Math.sin(G.t * 2.5)) + ')';
    ctx.fillText('앙꼬 · 多多와 함께, 앞으로도 잘 부탁해', W / 2, 160);
    ctx.fillStyle = 'rgba(220,210,240,.7)';
    ctx.fillText('tap to restart', W / 2, 173);
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
  ctx.fillText('앙꼬, 多多, 그리고 우다영', W / 2, 74);
  ctx.fillStyle = 'rgba(255,255,255,' + (0.45 + 0.45 * Math.sin(G.t * 3)) + ')';
  ctx.fillText('TAP / SPACE', W / 2, 112);
  ctx.textAlign = 'left';
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
    drawToast();
    if (G.blink > 0) {
      var bh = (H / 2) * G.blink;
      px(0, 0, W, bh, '#08070e');
      px(0, H - bh, W, bh, '#08070e');
    }
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
G.flags = { cat: false, woman: false, womanGone: false, dog: false, ticket: false, meeting: false };
G.woman = { x: 800, face: -1, run: false };
requestAnimationFrame(frame);
