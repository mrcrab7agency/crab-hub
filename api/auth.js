// Acceso al panel: contraseña (APP_PASSWORD) + segundo factor TOTP (TOTP_SECRET, apps tipo Google Authenticator).
// Alta del 2FA: con TOTP_SETUP=1, tras la contraseña correcta se muestra el QR una sola vez para escanearlo.
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { autenticado, cookieFuera, cookieSesion, cuerpo, env, json } from './_lib/core.js';

const intentos = new Map();

function base32(s) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = A.indexOf(c); if (v < 0) continue; bits += v.toString(2).padStart(5, '0'); }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

function totp(secreto, paso) {
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(paso));
  const h = crypto.createHmac('sha1', base32(secreto)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, '0');
}

function codigoValido(secreto, codigo) {
  const c = String(codigo || '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  const paso = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(totp(secreto, paso + d)), Buffer.from(c)));
}

const igual = (a, b) => { const h = (s) => crypto.createHash('sha256').update(s).digest(); return crypto.timingSafeEqual(h(a), h(b)); };

export default async (req, res) => {
  const accion = (req.query.a || '').toString();
  if (accion === 'me') return json(res, 200, { ok: autenticado(req) });
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (accion === 'logout') { res.setHeader('Set-Cookie', cookieFuera()); return json(res, 200, { ok: true }); }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0];
  const n = intentos.get(ip) || { c: 0, t: Date.now() };
  if (Date.now() - n.t > 15 * 60000) { n.c = 0; n.t = Date.now(); }
  if (n.c >= 8) return json(res, 429, { error: 'Demasiados intentos. Espera unos minutos.' });
  const fallo = (msg) => { n.c++; intentos.set(ip, n); return json(res, 401, { error: msg }); };

  const pass = env('APP_PASSWORD');
  if (!pass) return json(res, 503, { error: 'Falta configurar APP_PASSWORD' });
  const b = cuerpo(req);
  if (!igual(String(b.password || ''), pass)) return fallo('Contraseña incorrecta');

  const secreto = env('TOTP_SECRET');
  if (secreto) {
    if (!b.codigo) {
      const resp = { need2fa: true };
      if (env('TOTP_SETUP') === '1') {
        const uri = `otpauth://totp/Crab%20Hub:Mr%20Crab%207?secret=${secreto}&issuer=Crab%20Hub&algorithm=SHA1&digits=6&period=30`;
        resp.qr = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 200 });
      }
      return json(res, 200, resp);
    }
    if (!codigoValido(secreto, b.codigo)) return fallo('Código de verificación incorrecto');
  }

  intentos.delete(ip);
  res.setHeader('Set-Cookie', cookieSesion());
  json(res, 200, { ok: true });
};
