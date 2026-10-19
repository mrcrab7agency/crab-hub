// Utilidades comunes de Crab Hub: sesión firmada, respuestas JSON y lectura del cuerpo.
// Las claves viven solo en variables de entorno de Vercel; nunca llegan al navegador.
import crypto from 'node:crypto';

const COOKIE = 'ch_session';
const DIA = 24 * 60 * 60;

export const env = (k, d = '') => process.env[k] ?? d;

function secreto() {
  const s = env('SESSION_SECRET');
  if (s.length < 24) throw new Error('Falta SESSION_SECRET');
  return s;
}

export function firmar(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', secreto()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verificar(token) {
  if (!token || !token.includes('.')) return null;
  const [body, mac] = token.split('.');
  const ok = crypto.createHmac('sha256', secreto()).update(body).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(ok);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

export function leerCookie(req, nombre = COOKIE) {
  const c = req.headers.cookie || '';
  const m = c.split(/;\s*/).find((x) => x.startsWith(nombre + '='));
  return m ? decodeURIComponent(m.slice(nombre.length + 1)) : '';
}

export function cookieSesion(dias = 30) {
  const exp = Math.floor(Date.now() / 1000) + dias * DIA;
  return `${COOKIE}=${firmar({ t: 'session', exp })}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${dias * DIA}`;
}

export const cookieFuera = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export function autenticado(req) {
  try { return !!verificar(leerCookie(req)); } catch { return false; }
}

export function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).send(JSON.stringify(data));
}

// Protege una función: exige sesión y método.
export function proteger(handler, metodos = ['POST']) {
  return async (req, res) => {
    if (!metodos.includes(req.method)) return json(res, 405, { error: 'Método no permitido' });
    if (!autenticado(req)) return json(res, 401, { error: 'Sesión caducada. Vuelve a entrar.' });
    try { await handler(req, res); }
    catch (e) {
      console.error(e);
      if (!res.headersSent) json(res, 500, { error: e.message || 'Error interno' });
    }
  };
}

export function cuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
