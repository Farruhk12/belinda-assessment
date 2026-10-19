import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken, publicUser, rateLimited, recordFail } from '../api/_lib/auth';
import { assignmentApplies, teamOf, buildPayload } from '../api/_lib/scope';
import { employeeGroups } from '../api/_lib/groups';

beforeAll(() => { process.env.AUTH_SECRET = 'test-secret-test-secret'; });

describe('passwords', () => {
  it('verifies the right password and rejects the wrong one', () => {
    const h = hashPassword('secret');
    expect(h).not.toContain('secret');
    expect(verifyPassword('secret', h)).toBe(true);
    expect(verifyPassword('other', h)).toBe(false);
  });
});

describe('tokens', () => {
  it('round-trips a valid token', () => {
    expect(verifyToken(signToken('u1'))).toBe('u1');
  });
  it('rejects tampered and expired tokens', () => {
    const t = signToken('u1');
    const [payload, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ uid: 'admin', exp: Date.now() + 1e9 })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyToken(`${payload}.bad`)).toBeNull();
    expect(verifyToken(signToken('u1', 0), Date.now())).toBeNull();
  });
});

describe('rate limit', () => {
  it('blocks after repeated failures', () => {
    for (let i = 0; i < 8; i++) recordFail('k');
    expect(rateLimited('k')).toBe(true);
    expect(rateLimited('other')).toBe(false);
  });
});

const emp = (id: string, role: string, area = 'A', group = 'G', extra = {}) =>
  ({ id, role, area, group, fullName: id, passwordHash: 'x', password: 'plain', ...extra });

describe('assignmentApplies', () => {
  const user = emp('u1', 'employee', 'North', 'Sales');
  it('matches by target type, case-insensitively', () => {
    expect(assignmentApplies({ targetType: 'ALL' }, user)).toBe(true);
    expect(assignmentApplies({ targetType: 'AREA', targetArea: 'north' }, user)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Other' }, user)).toBe(false);
    expect(assignmentApplies({ targetType: 'INDIVIDUAL', targetEmployeeId: 'u1' }, user)).toBe(true);
    expect(assignmentApplies({ targetType: 'INDIVIDUAL', targetEmployeeId: 'u2' }, user)).toBe(false);
  });
});

describe('buildPayload', () => {
  const all = {
    quizzes: [{ id: 'q', questions: [{ id: '1', correctAnswers: [0] }] }],
    sessions: [{ id: 's', questions: [{ id: '1', correctAnswers: [0] }] }, { id: 'unrelated', questions: [] }],
    results: [{ id: 'r1', userId: 'u1' }, { id: 'r2', userId: 'u2' }, { id: 'r3', userId: 'u3' }],
    employees: [
      emp('u1', 'employee', 'N', 'G1'), emp('u2', 'employee', 'N', 'G1'), emp('u3', 'employee', 'S', 'G2'),
      emp('m1', 'manager', 'N', 'G1', { managedAreas: ['N'], managedGroups: ['G1'] })
    ],
    positions: [{ id: 'p' }],
    assignments: [{ id: 'a1', quizId: 'other', targetType: 'INDIVIDUAL', targetEmployeeId: 'u2' }, { id: 'a2', quizId: 's', targetType: 'ALL' }]
  };

  it('employee sees only own data without correct answers or passwords', () => {
    const p = buildPayload(all.employees[0], all);
    expect(p.employees.map(e => e.id)).toEqual(['u1']);
    expect(p.results.map(r => r.id)).toEqual(['r1']);
    expect(p.assignments.map(a => a.id)).toEqual(['a2']);
    expect(p.quizzes).toEqual([]);
    expect(p.sessions.map(x => x.id)).toEqual(['s']);
    expect(p.sessions[0].questions[0]).not.toHaveProperty('correctAnswers');
    expect(JSON.stringify(p)).not.toMatch(/plain|passwordHash/);
  });

  it('manager sees own team only', () => {
    const manager = all.employees[3];
    expect(teamOf(manager, all.employees).map(e => e.id).sort()).toEqual(['u1', 'u2']);
    const p = buildPayload(manager, all);
    expect(p.results.map(r => r.id).sort()).toEqual(['r1', 'r2']);
    expect(p.employees.map(e => e.id).sort()).toEqual(['m1', 'u1', 'u2']);
  });

  it('admin sees everything but never password data', () => {
    const p = buildPayload(emp('a', 'admin'), all);
    expect(p.results).toHaveLength(3);
    expect(p.quizzes[0].questions[0]).toHaveProperty('correctAnswers');
    expect(JSON.stringify(p.employees)).not.toMatch(/plain|passwordHash/);
  });
});

describe('publicUser', () => {
  it('drops secrets', () => {
    expect(publicUser({ id: 1, password: 'p', passwordHash: 'h' })).toEqual({ id: 1 });
  });
});

describe('several groups per employee', () => {
  const multi = emp('u9', 'employee', 'North', 'Sales', { groups: ['Sales', 'Support'] });
  it('receives assignments of every one of their groups', () => {
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Sales' }, multi)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'support' }, multi)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Other' }, multi)).toBe(false);
    expect(assignmentApplies({ targetType: 'AREA_GROUP', targetArea: 'North', targetGroup: 'Support' }, multi)).toBe(true);
    expect(assignmentApplies({ targetType: 'AREA_GROUP', targetArea: 'South', targetGroup: 'Support' }, multi)).toBe(false);
  });
  it('old single-group employees keep working', () => {
    expect(employeeGroups({ group: 'Sales' })).toEqual(['Sales']);
    expect(employeeGroups({ group: 'Sales', groups: [] })).toEqual(['Sales']);
    expect(employeeGroups({ group: 'A', groups: ['A', 'a', ' B '] })).toEqual(['A', 'B']);
  });
  it('manager sees an employee if any of their groups is managed', () => {
    const manager = emp('m', 'manager', 'North', 'Sales', { managedGroups: ['Support'] });
    expect(teamOf(manager, [multi, emp('x', 'employee', 'North', 'Other')]).map(e => e.id)).toEqual(['u9']);
  });
});

describe('legacy comma-separated groups', () => {
  const legacy = emp('u8', 'employee', 'North', 'Альфа, Гамма');
  it('splits the old combined value into separate groups', () => {
    expect(employeeGroups(legacy)).toEqual(['Альфа', 'Гамма']);
  });
  it('receives assignments for each part and for the old combined target', () => {
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Гамма' }, legacy)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Альфа' }, legacy)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Альфа, Гамма' }, legacy)).toBe(true);
    expect(assignmentApplies({ targetType: 'GROUP', targetGroup: 'Дельта' }, legacy)).toBe(false);
  });
});
