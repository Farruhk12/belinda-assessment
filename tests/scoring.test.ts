import { describe, it, expect } from 'vitest';
import { isAnswerCorrect, questionCredit, normalizeChoice, percentage, buildResult, isExpired, stripAnswers } from '../api/_lib/scoring';

const single = { id: 'q1', type: 'SINGLE_CHOICE', options: ['a', 'b', 'c'], correctAnswers: [1] };
const multi = { id: 'q2', type: 'MULTIPLE_CHOICE', options: ['a', 'b', 'c', 'd'], correctAnswers: [0, 2] };
const open = { id: 'q3', type: 'OPEN_ENDED', options: [], correctAnswers: [] };

describe('isAnswerCorrect', () => {
  it('single choice: only the exact option is correct', () => {
    expect(isAnswerCorrect(single, [1])).toBe(true);
    expect(isAnswerCorrect(single, [0])).toBe(false);
    expect(isAnswerCorrect(single, [1, 2])).toBe(false);
  });
  it('multiple choice: set must match exactly, order ignored', () => {
    expect(isAnswerCorrect(multi, [2, 0])).toBe(true);
    expect(isAnswerCorrect(multi, [0])).toBe(false);
    expect(isAnswerCorrect(multi, [0, 1, 2])).toBe(false);
  });
});

describe('questionCredit', () => {
  const three = { id: 'q4', type: 'MULTIPLE_CHOICE', options: ['a', 'b', 'c', 'd'], correctAnswers: [0, 1, 2] };
  it('gives full credit for the exact set and none for nothing', () => {
    expect(questionCredit(three, [0, 1, 2])).toBe(1);
    expect(questionCredit(three, [])).toBe(0);
  });
  it('gives a proportional share for a partly correct multiple choice', () => {
    expect(questionCredit(three, [0, 1])).toBeCloseTo(2 / 3);
    expect(questionCredit(three, [2])).toBeCloseTo(1 / 3);
  });
  it('penalizes wrong picks, never below zero', () => {
    expect(questionCredit(three, [0, 1, 3])).toBeCloseTo(1 / 3);
    expect(questionCredit(three, [0, 3])).toBe(0);
    expect(questionCredit(three, [3])).toBe(0);
  });
  it('selecting every option does not earn credit', () => {
    expect(questionCredit(multi, [0, 1, 2, 3])).toBe(0);
  });
  it('single choice stays all-or-nothing', () => {
    expect(questionCredit(single, [1])).toBe(1);
    expect(questionCredit(single, [0])).toBe(0);
  });
});

describe('normalizeChoice', () => {
  it('accepts valid indices and removes duplicates', () => {
    expect(normalizeChoice([1, 1, 2], 4)).toEqual([1, 2]);
  });
  it('rejects out-of-range, non-integer and non-array input', () => {
    expect(normalizeChoice([4], 4)).toBeNull();
    expect(normalizeChoice([-1], 4)).toBeNull();
    expect(normalizeChoice(['1'], 4)).toBeNull();
    expect(normalizeChoice('1', 4)).toBeNull();
  });
});

describe('percentage', () => {
  it('does not divide by zero for an empty quiz', () => {
    expect(percentage(0, 0)).toBe(0);
    expect(percentage(1, 3)).toBe(33);
  });
});

describe('buildResult', () => {
  const session = { id: 's1', title: 'T', timeLimit: 10, questions: [single, multi, open] };
  const attempt = {
    userId: 'u1', startedAt: 0, violations: 1, logs: ['x'], answers: {},
    checked: { q1: { correct: true }, q2: { correct: false }, q3: { manual: true } }
  };
  it('counts only server-checked correct answers', () => {
    const r = buildResult(attempt, session, false, 60_000);
    expect(r.score).toBe(1);
    expect(r.maxPossibleScore).toBe(3);
    expect(r.percentage).toBe(33);
    expect(r.status).toBe('pending');
    expect(r.timeSpent).toBe(60);
  });
  it('adds partial credit to the score', () => {
    const partial = { ...attempt, checked: { q1: { correct: true, credit: 1 }, q2: { correct: false, credit: 0.5 }, q3: { manual: true } } };
    const r = buildResult(partial, session, false, 60_000);
    expect(r.score).toBe(1.5);
    expect(r.percentage).toBe(50);
  });
  it('disqualification zeroes the score and marks violations above the limit', () => {
    const r = buildResult(attempt, session, true, 60_000);
    expect(r.score).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.violations).toBe(4);
  });
  it('caps time spent at the time limit', () => {
    expect(buildResult(attempt, session, false, 3_600_000).timeSpent).toBe(600);
  });
});

describe('isExpired', () => {
  const session = { timeLimit: 1 };
  it('allows a small grace period after the limit', () => {
    expect(isExpired({ startedAt: 0 }, session, 62_000)).toBe(false);
    expect(isExpired({ startedAt: 0 }, session, 66_000)).toBe(true);
  });
  it('never expires without a limit', () => {
    expect(isExpired({ startedAt: 0 }, {}, 10 ** 12)).toBe(false);
  });
});

describe('stripAnswers', () => {
  it('removes correct answers but keeps the rest', () => {
    const out = stripAnswers({ id: 's', questions: [single] });
    expect(out.questions[0]).not.toHaveProperty('correctAnswers');
    expect(out.questions[0].options).toEqual(['a', 'b', 'c']);
  });
});
