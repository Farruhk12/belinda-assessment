import { gzipSync } from 'node:zlib';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// На Vercel тело уже разобрано, в vite dev его нужно прочитать из потока
export const readBody = async (req: any): Promise<any> => {
  let body = req.body;
  if (body === undefined) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    body = raw;
  }
  if (typeof body === 'string') {
    if (!body) return {};
    try {
      return JSON.parse(body);
    } catch {
      throw new HttpError(400, 'Bad JSON');
    }
  }
  return body ?? {};
};

export const handle = (fn: (req: any) => Promise<unknown>) => async (req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const out = await fn(req);
    res.statusCode = 200;
    const body = Buffer.from(JSON.stringify(out ?? { status: 'ok' }));
    // ответ с данными в сотни КБ сжимается: JSON ужимается в 5–10 раз
    if (body.length > 1024 && /gzip/.test(String(req.headers?.['accept-encoding'] || ''))) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.end(gzipSync(body));
    } else {
      res.end(body);
    }
  } catch (e: any) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error('API error:', e);
    res.statusCode = status;
    res.end(JSON.stringify({ status: 'error', message: status === 500 ? 'Server error' : e.message }));
  }
};

export const requireMethod = (req: any, method: string) => {
  if (req.method !== method) throw new HttpError(405, 'Method not allowed');
};
