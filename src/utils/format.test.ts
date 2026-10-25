import test from 'node:test';
import assert from 'node:assert/strict';
import { fmtNum, fmtPct, sparkPath, ageText } from './format.js';

test('formatting never invents values', () => {
  assert.equal(fmtNum(null), 'n/a');
  assert.equal(fmtPct(undefined), 'n/a');
  assert.equal(fmtPct(1.234), '+1.23%');
  assert.equal(fmtPct(-0.5), '-0.50%');
  assert.equal(fmtNum(5912.4), '5,912.40');
  assert.equal(fmtNum(1.0831), '1.083');
});
test('sparkline and age', () => {
  assert.equal(sparkPath([1]).d, '');
  assert.equal(sparkPath([1, 2, 3]).up, true);
  assert.equal(ageText('2026-10-20T00:00:00Z', Date.parse('2026-10-20T03:00:00Z')), '3 h ago');
});
