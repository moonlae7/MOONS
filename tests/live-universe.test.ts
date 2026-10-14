import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutUniverse, selectionPosition} from '../lib/live-universe.ts';
import type {UniverseDTO, UniverseThought} from '../lib/thought.ts';

const thought = (id: string, overrides: Partial<UniverseThought> = {}): UniverseThought => ({
  id, kind: 'spark', status: 'done', preview: id, planetIds: ['a'], openSignals: 0,
  structure: '파편', createdAt: '2026-10-14T00:00:00Z', ...overrides,
});
function universe(thoughts: UniverseThought[]): UniverseDTO {
  return {space: {id: 'space', name: '우주', tagline: '', questions: [], planets: [
    {id: 'a', name: '오늘', color: '#7BA4F8', x: .3, y: .4},
    {id: 'b', name: '나', color: '#E6A0C4', x: .7, y: .7},
  ]}, thoughts, links: [], stats: {thoughts: thoughts.length, links: 0, openSignals: 0}, now: ''};
}

test('live stars stay in place when polling reorders, inserts or removes other thoughts', () => {
  const first = universe([thought('one'), thought('two'), thought('three')]);
  const next = universe([thought('new'), thought('three'), thought('one')]);
  const original = layoutUniverse(first);
  const updated = layoutUniverse(next);
  for (const id of ['one', 'three']) assert.deepEqual(updated.stars.find(s => s.id === id)?.position, original.stars.find(s => s.id === id)?.position);
  assert.deepEqual(updated.clusters.map(c => c.position), original.clusters.map(c => c.position));
  assert.deepEqual(layoutUniverse(first), original);
});

test('held thoughts and their relationships never reach the visual layout or counts', () => {
  const data = universe([thought('one'), thought('held', {status: 'held'}), thought('waiting', {status: 'analyzing'})]);
  data.links = [{a: 'one', b: 'held', kind: 'supports'}, {a: 'one', b: 'waiting', kind: 'contradicts'}, {a: 'one', b: 'missing', kind: 'fills_gap'}];
  const layout = layoutUniverse(data);
  assert.deepEqual(layout.stars.map(s => s.id), ['one', 'waiting']);
  assert.equal(layout.clusters[0].count, 1);
  assert.equal(layout.links.length, 0);
  assert.equal(layout.stars[0].degree, 0);
});

test('multiple category membership produces one star and is insensitive to category ordering', () => {
  const a = layoutUniverse(universe([thought('shared', {planetIds: ['a', 'b']})]));
  const b = layoutUniverse(universe([thought('shared', {planetIds: ['b', 'a', 'a']})]));
  assert.equal(a.stars.length, 1);
  assert.deepEqual(a.clusters.map(c => c.count), [1, 1]);
  assert.deepEqual(a.stars[0].position, b.stars[0].position);
});

test('pending, failed, decisions and unknown categories have finite positions even without planets', () => {
  const data = universe([thought('pending', {status: 'saved', planetIds: []}), thought('failed', {status: 'failed', planetIds: ['missing']}), thought('decision', {kind: 'decision', openSignals: 3})]);
  data.space.planets = [];
  const layout = layoutUniverse(data);
  assert.equal(layout.clusters.length, 0);
  assert.equal(layout.stars.length, 3);
  assert.ok(layout.stars.every(star => star.position.every(Number.isFinite)));
  assert.equal(layout.stars[0].pending, true);
  assert.equal(layout.stars[1].pending, false);
  assert.equal(layout.stars[2].openSignals, 3);
  assert.notEqual(layout.stars[2].color, layout.stars[1].color);
});

test('real link kinds, endpoints and degrees survive layout without inventing relationships', () => {
  const data = universe([thought('a'), thought('b'), thought('c')]);
  data.links = [{a: 'a', b: 'b', kind: 'contradicts'}, {a: 'b', b: 'c', kind: 'decides'}];
  const layout = layoutUniverse(data);
  assert.deepEqual(layout.links, data.links);
  assert.deepEqual(layout.stars.map(s => s.degree), [1, 2, 1]);
  assert.equal(selectionPosition(layout, {kind: 'thought', id: 'gone'}), null);
  assert.deepEqual(selectionPosition(layout, {kind: 'planet', id: 'a'}), layout.clusters[0].position);
  assert.deepEqual(selectionPosition(layout, {kind: 'thought', id: 'a'}), layout.stars[0].position);
});
