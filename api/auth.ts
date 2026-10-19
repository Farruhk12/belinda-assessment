import { TABLES, findEmployeesForLogin, countEmployees, putDoc } from './_lib/db.js';
import { hashPassword, verifyPassword, signToken, publicUser, rateLimited, recordFail, clearFails } from './_lib/auth.js';
import { HttpError, handle, readBody, requireMethod } from './_lib/http.js';

export default handle(async req => {
  requireMethod(req, 'POST');
  const { login, password } = await readBody(req);
  const cleanLogin = String(login ?? '').trim();
  const cleanPass = String(password ?? '').trim();
  if (!cleanLogin || !cleanPass) throw new HttpError(400, 'Введите логин и пароль');

  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const key = `${ip}|${cleanLogin.toLowerCase()}`;
  if (rateLimited(key)) throw new HttpError(429, 'Слишком много попыток, попробуйте позже');

  const matches = await findEmployeesForLogin(cleanLogin);

  // Первичная настройка: если сотрудников нет, админ создаётся из ADMIN_BOOTSTRAP_PASSWORD
  if (matches.length === 0 && process.env.ADMIN_BOOTSTRAP_PASSWORD && (await countEmployees()) === 0 && cleanLogin === 'admin' && cleanPass === process.env.ADMIN_BOOTSTRAP_PASSWORD) {
    const admin = {
      id: `emp-${Date.now()}`, fullName: 'Administrator', login: 'admin', group: 'Система', area: 'Центр',
      positionId: 'admin', role: 'admin', createdAt: Date.now(), passwordHash: hashPassword(cleanPass)
    };
    await putDoc(TABLES.Employees, admin);
    return { token: signToken(admin.id), user: publicUser(admin) };
  }

  const user = matches.find(e => String(e.login).trim() === cleanLogin) ?? matches[0];
  let ok = false;
  if (user?.passwordHash) {
    ok = verifyPassword(cleanPass, user.passwordHash);
  } else if (user?.password !== undefined && String(user.password).trim() === cleanPass) {
    // пароль ещё в открытом виде (старые данные): проверяем и сразу переводим в хеш
    ok = true;
    const { password: _plain, ...rest } = user;
    await putDoc(TABLES.Employees, { ...rest, passwordHash: hashPassword(cleanPass) });
  }

  if (!user || !ok) {
    recordFail(key);
    throw new HttpError(401, 'Неверный логин или пароль. Проверьте правильность ввода.');
  }
  clearFails(key);
  return { token: signToken(String(user.id)), user: publicUser(user) };
});
