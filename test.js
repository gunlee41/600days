const assert = require('assert');
const { clamp, overlap } = require('./logic.js');

assert.strictEqual(clamp(5, 0, 10), 5);
assert.strictEqual(clamp(-3, 0, 10), 0);
assert.strictEqual(clamp(99, 0, 10), 10);

const cat = { x: 380, y: 88, w: 10, h: 8 };
const feetOnGround = { x: 380, y: 122, w: 12, h: 24 };
const jumping = { x: 380, y: 84, w: 12, h: 24 };
assert.strictEqual(overlap(feetOnGround, cat), false, 'walking under cat must not collect');
assert.strictEqual(overlap(jumping, cat), true, 'jump into cat must collect');
assert.strictEqual(overlap({ x: 378, y: 88, w: 12, h: 24 }, cat), true, 'touching edge counts');

console.log('ok');
