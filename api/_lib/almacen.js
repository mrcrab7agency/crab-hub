// Ajustes privados del panel (p. ej. la llave de GHL) cifrados con AES-256-GCM en un almacén Blob privado de Vercel.
import crypto from 'node:crypto';
import { put, get } from '@vercel/blob';
import { env } from './core.js';

const clave = () => crypto.createHash('sha256').update(env('SESSION_SECRET') + '|ajustes-crab-hub').digest();

function cifrar(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', clave(), iv);
  const datos = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), datos]).toString('base64');
}

function descifrar(txt) {
  const b = Buffer.from(txt, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', clave(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
}

export async function leer(nombre) {
  try {
    const r = await get(`ajustes/${nombre}.enc`, { access: 'private', useCache: false });
    if (!r || !r.stream) return null;
    const txt = await new Response(r.stream).text();
    return descifrar(txt);
  } catch { return null; }
}

export async function guardar(nombre, obj) {
  await put(`ajustes/${nombre}.enc`, cifrar(obj), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'text/plain' });
}
