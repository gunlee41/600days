'use strict';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { clamp, overlap };
