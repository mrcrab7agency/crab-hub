// Acceso a la base de datos de la Academia Empleados IA (Upstash Redis compartido con academia.empleados-ia.com).
// Los códigos de empresa se guardan igual que los crea el panel de la academia: HSET codes <CODIGO> {empresa, activo, created}.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from './core.js';

export const URL_ACADEMIA = 'https://academia.empleados-ia.com/acceso/';
export const URL_RESERVA = 'https://reserva.empleados-ia.com';

function credenciales() {
  const url = env('ACADEMIA_REST_API_URL') || env('ACADEMIA_KV_REST_API_URL');
  const token = env('ACADEMIA_REST_API_TOKEN') || env('ACADEMIA_KV_REST_API_TOKEN');
  if (!url || !token) throw new Error('Crab Hub aún no está conectado a la base de datos de la academia (Vercel › Storage › academia-empleados-ia-db › Connect Project › crab-hub, prefijo ACADEMIA).');
  return { url, token };
}

async function redis(...cmd) {
  const { url, token } = credenciales();
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd), signal: AbortSignal.timeout(10000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error('Base de datos de la academia: ' + (d.error || r.status));
  return d.result;
}

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Devuelve el código activo de la empresa o crea uno nuevo con el mismo formato que el panel de la academia.
export async function codigoEmpresa(empresa) {
  const nombre = String(empresa || '').trim().slice(0, 80);
  if (nombre.length < 2) throw new Error('Falta el nombre de la empresa para la academia');
  const lista = (await redis('HGETALL', 'codes')) || [];
  for (let i = 0; i < lista.length; i += 2) {
    let v = {}; try { v = JSON.parse(lista[i + 1]); } catch {}
    if (v.activo !== false && norm(v.empresa) === norm(nombre)) return { codigo: lista[i], empresa: v.empresa, nuevo: false };
  }
  const base = nombre.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'EMP';
  const codigo = `${base}-${randomBytes(3).toString('hex').toUpperCase()}`;
  await redis('HSET', 'codes', codigo, JSON.stringify({ empresa: nombre, activo: true, created: Date.now(), origen: 'crab-hub' }));
  return { codigo, empresa: nombre, nuevo: true };
}

export function secretoValido(req) {
  const s = env('ALTA_ACADEMIA_SECRET');
  const h = String(req.headers['x-alta-secret'] || '');
  if (!s || !h || s.length !== h.length) return false;
  return timingSafeEqual(Buffer.from(s), Buffer.from(h));
}
