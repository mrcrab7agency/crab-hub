// Acceso al panel: una sola contraseña (APP_PASSWORD) y sesión firmada en cookie.
import crypto from 'node:crypto';
import { autenticado, cookieFuera, cookieSesion, cuerpo, env, json } from './_lib/core.js';

const intentos = new Map();

export default async (req, res) => {
  const accion = (req.query.a || '').toString();
  if (accion === 'me') return json(res, 200, { ok: autenticado(req) });
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (accion === 'logout') { res.setHeader('Set-Cookie', cookieFuera()); return json(res, 200, { ok: true }); }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0];
  const n = intentos.get(ip) || { c: 0, t: Date.now() };
  if (Date.now() - n.t > 15 * 60000) { n.c = 0; n.t = Date.now(); }
  if (n.c >= 8) return json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });

  const pass = env('APP_PASSWORD');
  if (!pass) return json(res, 503, { error: 'Falta configurar APP_PASSWORD' });
  const dada = String(cuerpo(req).password || '');
  const h = (s) => crypto.createHash('sha256').update(s).digest();
  if (!crypto.timingSafeEqual(h(dada), h(pass))) {
    n.c++; intentos.set(ip, n);
    return json(res, 401, { error: 'Contraseña incorrecta' });
  }
  intentos.delete(ip);
  res.setHeader('Set-Cookie', cookieSesion());
  json(res, 200, { ok: true });
};
