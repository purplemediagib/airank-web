import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUsefulQuickCheckResults, isQuickCheckPending, nextSnapshotCandidate, quickCheckVisibility, sortedQuickChecks } from '../src/lib/quick-check-snapshot-data.ts';

test('pending latest remains latest without replacing an eligible completed candidate', () => {
  const input = [
    { id: 'old', status: 'completed', created_at: 1700000000 },
    { id: 'pending', status: 'running', created_at: 1700000002000 },
    { id: 'partial', status: 'partial', created_at: 1700000001 },
  ];
  const sorted = sortedQuickChecks(input);
  assert.equal(sorted[0].id, 'pending');
  assert.equal(nextSnapshotCandidate(input).id, 'partial');
  assert.equal(isQuickCheckPending(sorted[0].status), true);
  assert.equal(isQuickCheckPending('processing'), true);
  assert.equal(input[0].id, 'old');
});

test('falls back from a completed check without useful results to the next measured check', () => {
  const checks = [
    { id: 'measured', status: 'partial', created_at: 1700000000 },
    { id: 'no-answers', status: 'completed', created_at: 1700000001 },
    { id: 'queued', status: 'queued', created_at: 1700000002 },
  ];
  assert.equal(nextSnapshotCandidate(checks).id, 'no-answers');
  assert.equal(nextSnapshotCandidate(checks, ['no-answers']).id, 'measured');
  assert.equal(nextSnapshotCandidate(checks, ['no-answers', 'measured']), undefined);
  assert.equal(nextSnapshotCandidate([]), undefined);
});

test('only completed/partial checks with valid answers qualify, including genuine zero mentions', () => {
  const report = { status: 'partial', score: { valid_answers: 7, mentions: 0 } };
  assert.equal(hasUsefulQuickCheckResults(report), true);
  assert.equal(quickCheckVisibility(report), 0);
  assert.equal(hasUsefulQuickCheckResults({ ...report, status: 'running' }), false);
  assert.equal(hasUsefulQuickCheckResults({ ...report, score: { valid_answers: 0 } }), false);
  assert.equal(quickCheckVisibility({ ...report, score: { valid_answers: 0 } }), null);
});

test('visibility uses mentions divided by valid answers, never expected sample size', () => {
  assert.equal(quickCheckVisibility({ score: { mentions: 2, valid_answers: 8, expected_answers: 12 } }), 0.25);
});
