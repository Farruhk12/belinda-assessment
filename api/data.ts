import { TABLES, isSheet, listAllTables, getDoc, putDoc, deleteDoc } from './_lib/db.js';
import { authenticate, requireAdmin, publicUser, hashPassword } from './_lib/auth.js';
import { buildPayload } from './_lib/scope.js';
import { HttpError, handle, readBody } from './_lib/http.js';

const loadAll = async () => {
  const t = await listAllTables();
  return {
    quizzes: t.quizzes, sessions: t.sessions, results: t.results,
    employees: t.employees, positions: t.positions, assignments: t.assignments
  };
};

// Пароль приходит открытым текстом только при сохранении и сразу хешируется
const prepareEmployee = async (data: any) => {
  const { password, passwordHash: _ignored, ...doc } = data;
  const existing = await getDoc(TABLES.Employees, doc.id);
  if (typeof password === 'string' && password.trim()) doc.passwordHash = hashPassword(password.trim());
  else if (existing?.passwordHash) doc.passwordHash = existing.passwordHash;
  else if (existing?.password) doc.passwordHash = hashPassword(String(existing.password).trim());
  return doc;
};

export default handle(async req => {
  const user = await authenticate(req);

  if (req.method === 'GET') {
    return {
      ...buildPayload(user, await loadAll()),
      me: publicUser(user),
      serverNow: Date.now()
    };
  }

  if (req.method === 'POST') {
    requireAdmin(user);
    const { action, sheet, data, id } = await readBody(req);
    if (!isSheet(sheet)) throw new HttpError(400, 'Unknown sheet');
    if (action === 'save') {
      if (!data || data.id === undefined || data.id === null || data.id === '') throw new HttpError(400, 'Missing id');
      await putDoc(TABLES[sheet], sheet === 'Employees' ? await prepareEmployee(data) : data);
    } else if (action === 'delete') {
      if (id === undefined || id === null || id === '') throw new HttpError(400, 'Missing id');
      if (sheet === 'Employees' && String(id) === String(user.id)) throw new HttpError(400, 'Нельзя удалить самого себя');
      await deleteDoc(TABLES[sheet], id);
    } else {
      throw new HttpError(400, 'Unknown action');
    }
    return { status: 'ok' };
  }

  throw new HttpError(405, 'Method not allowed');
});
