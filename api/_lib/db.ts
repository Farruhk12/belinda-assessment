import { neon } from '@neondatabase/serverless';

// Названия листов (как их знает клиент) -> таблицы Neon
export const TABLES = {
  Quizzes: 'quizzes',
  Sessions: 'sessions',
  Results: 'results',
  Employees: 'employees',
  Positions: 'positions',
  Assignments: 'assignments'
} as const;

export type Sheet = keyof typeof TABLES;
export const isSheet = (s: unknown): s is Sheet => typeof s === 'string' && s in TABLES;

// Попытки прохождения живут только на сервере и клиенту целиком не отдаются
const ATTEMPTS = 'attempts';

let client: ReturnType<typeof neon> | null = null;
let ready: Promise<void> | null = null;

export const db = () => {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(process.env.DATABASE_URL);
  }
  return client;
};

// Каждая сущность хранится как jsonb-документ с id; seq сохраняет порядок вставки
export const ensureSchema = () => {
  if (!ready) {
    ready = (async () => {
      for (const t of [...Object.values(TABLES), ATTEMPTS]) {
        await db().query(`CREATE TABLE IF NOT EXISTS ${t} (seq BIGSERIAL, id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
      }
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
};

// Схема создаётся только если таблиц ещё нет (ошибка 42P01), а не при каждом холодном старте
const rows = async (query: string, params: unknown[] = []): Promise<any[]> => {
  try {
    return (await db().query(query, params)) as any[];
  } catch (e: any) {
    if (e?.code !== "42P01") throw e;
    await ensureSchema();
    return (await db().query(query, params)) as any[];
  }
};

// Все таблицы одним запросом: одна поездка до базы вместо шести
export const listAllTables = async (): Promise<Record<string, any[]>> => {
  const tables = Object.values(TABLES);
  const found = await rows(tables.map(t => `SELECT '${t}' AS t, seq, data FROM ${t}`).join(" UNION ALL ") + " ORDER BY t, seq");
  const out: Record<string, any[]> = Object.fromEntries(tables.map(t => [t, []]));
  for (const r of found) out[r.t].push(r.data);
  return out;
};

// Поиск сотрудника для входа без чтения всей таблицы
export const findEmployeesForLogin = async (login: string): Promise<any[]> =>
  (await rows(
    `SELECT data FROM employees WHERE trim(data->>'login') = $1 OR trim(data->>'fullName') = $1`,
    [login]
  )).map(r => r.data);

export const countEmployees = async (): Promise<number> =>
  Number((await rows("SELECT count(*) AS n FROM employees"))[0]?.n ?? 0);

export const listDocs = async (table: string): Promise<any[]> =>
  (await rows(`SELECT data FROM ${table} ORDER BY seq`)).map(r => r.data);

export const getDoc = async (table: string, id: unknown): Promise<any | null> =>
  (await rows(`SELECT data FROM ${table} WHERE id = $1`, [String(id)]))[0]?.data ?? null;

export const putDoc = async (table: string, doc: any) => {
  await rows(
    `INSERT INTO ${table} (id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
    [String(doc.id), JSON.stringify(doc)]
  );
};

export const deleteDoc = async (table: string, id: unknown) => {
  await rows(`DELETE FROM ${table} WHERE id = $1`, [String(id)]);
};

export const attempts = {
  get: (id: string) => getDoc(ATTEMPTS, id),
  put: (doc: any) => putDoc(ATTEMPTS, doc),
  findOpen: async (sessionId: string, userId: string) =>
    (await rows(
      `SELECT data FROM ${ATTEMPTS}
       WHERE data->>'sessionId' = $1 AND data->>'userId' = $2 AND COALESCE((data->>'finished')::boolean, false) = false
       ORDER BY seq DESC LIMIT 1`,
      [String(sessionId), String(userId)]
    ))[0]?.data ?? null
};
