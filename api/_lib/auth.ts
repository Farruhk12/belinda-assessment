import crypto from 'node:crypto';
import { getDoc } from './db.js';
import { HttpError } from './http.js';

const TOKEN_TTL_MS = 7 * 24 * 3600 * 1000;

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('AUTH_SECRET is not set');
  return s;
};

export const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
};

export const verifyPassword = (password: string, stored: string): boolean => {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
};

const sign = (payload: string) => crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

export const signToken = (uid: string, now = Date.now()): string => {
  const payload = Buffer.from(JSON.stringify({ uid, exp: now + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const verifyToken = (token: string, now = Date.now()): string | null => {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof uid === 'string' && typeof exp === 'number' && exp > now ? uid : null;
  } catch {
    return null;
  }
};

// Пользователь и его роль всегда берутся из базы, а не из токена
export const authenticate = async (req: any): Promise<any> => {
  const header = String(req.headers?.authorization || '');
  const uid = header.startsWith('Bearer ') ? verifyToken(header.slice(7)) : null;
  const user = uid ? await getDoc('employees', uid) : null;
  if (!user) throw new HttpError(401, 'Unauthorized');
  return user;
};

export const requireAdmin = (user: any) => {
  if (user.role !== 'admin') throw new HttpError(403, 'Forbidden');
};

export const publicUser = (e: any) => {
  const { password, passwordHash, ...rest } = e;
  return rest;
};

// Простая защита от перебора пароля (в пределах одного экземпляра функции)
const fails = new Map<string, { n: number; reset: number }>();
const MAX_FAILS = 8;
const WINDOW_MS = 10 * 60 * 1000;

export const rateLimited = (key: string, now = Date.now()) => {
  const f = fails.get(key);
  return !!f && f.reset > now && f.n >= MAX_FAILS;
};
export const recordFail = (key: string, now = Date.now()) => {
  const f = fails.get(key);
  if (!f || f.reset <= now) fails.set(key, { n: 1, reset: now + WINDOW_MS });
  else f.n++;
};
export const clearFails = (key: string) => fails.delete(key);
