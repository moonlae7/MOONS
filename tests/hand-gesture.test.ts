import test from 'node:test';
import assert from 'node:assert/strict';
import {GestureTracker, readHand, type Point} from '../lib/hand-gesture.ts';

// A right hand facing the camera: wrist low, knuckles above. `curl` 0 is an open hand, 1 a fist.
function hand({x = 0.5, y = 0.6, curl = 0, pinch = false}: {x?: number; y?: number; curl?: number; pinch?: boolean} = {}): Point[] {
  const p: Point[] = Array.from({length: 21}, () => ({x, y}));
  p[0] = {x, y: y + 0.2};                    // wrist
  p[9] = {x, y};                             // middle knuckle: palm length 0.2
  const tip = (dx: number) => ({x: x + dx, y: y - 0.16 * (1 - curl) + 0.1 * curl});
  p[8] = tip(-0.04); p[12] = tip(0); p[16] = tip(0.04); p[20] = tip(0.08);
  p[4] = pinch ? {x: p[8].x + 0.01, y: p[8].y + 0.01} : {x: x - 0.14, y: y + 0.06};
  return p;
}

test('open hand reads open, fist reads closed', () => {
  assert.ok(readHand(hand({curl: 0}), false).openness > 0.8);
  assert.ok(readHand(hand({curl: 1}), false).openness < 0.15);
});

test('cursor is mirrored like a mirror, not like the camera', () => {
  const left = readHand(hand({x: 0.2}), false).cursor.x;
  assert.ok(left > 0.6, `cursor x ${left}`);
});

test('quick pinch selects where the pinch started', () => {
  const g = new GestureTracker();
  g.update(hand(), 0);
  g.update(hand({pinch: true}), 100);
  const {events} = g.update(hand(), 300);
  const select = events.find(e => e.type === 'select');
  assert.ok(select && select.type === 'select');
});

test('pinch and move turns the universe instead of selecting', () => {
  const g = new GestureTracker();
  g.update(hand(), 0);
  g.update(hand({pinch: true}), 50);
  let orbit = 0;
  for (let i = 1; i <= 8; i++) orbit += g.update(hand({pinch: true, x: 0.5 - i * 0.02}), 50 + i * 40).events.filter(e => e.type === 'orbit').length;
  const after = g.update(hand({x: 0.34}), 500).events;
  assert.ok(orbit > 0);
  assert.equal(after.some(e => e.type === 'select'), false);
});

test('spread follows the hand and stops while pinching', () => {
  const g = new GestureTracker();
  const open = g.update(hand({curl: 0}), 0).events.find(e => e.type === 'spread');
  const fist = g.update(hand({curl: 1}), 40).events.find(e => e.type === 'spread');
  assert.ok(open?.type === 'spread' && fist?.type === 'spread' && open.value > fist.value);
  assert.equal(g.update(hand({pinch: true}), 80).events.some(e => e.type === 'spread'), false);
});

test('losing the hand is reported once', () => {
  const g = new GestureTracker();
  g.update(hand(), 0);
  assert.equal(g.update(null, 100).events.length, 0);
  assert.deepEqual(g.update(null, 600).events, [{type: 'lost'}]);
  assert.equal(g.update(null, 900).events.length, 0);
});
