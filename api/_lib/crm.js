// Almacén del seguimiento de propuestas (mini CRM) en el Blob privado: un JSON por propuesta en crm/<id>.json.
import { put, get, list, del } from '@vercel/blob';

const ruta = (id) => `crm/${id}.json`;
export const idValido = (id) => /^[a-z0-9_-]{4,64}$/i.test(String(id || ''));

export async function leerRegistro(id) {
  try {
    const r = await get(ruta(id), { access: 'private', useCache: false });
    if (!r?.stream) return null;
    return JSON.parse(await new Response(r.stream).text());
  } catch { return null; }
}

export async function guardarRegistro(reg) {
  reg.actualizado = new Date().toISOString();
  await put(ruta(reg.id), JSON.stringify(reg), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
  return reg;
}

export async function borrarRegistro(id) {
  try { const l = await list({ prefix: ruta(id) }); if (l.blobs.length) await del(l.blobs.map((b) => b.url)); } catch {}
}

export async function todosLosRegistros() {
  const blobs = [];
  let cursor;
  do { const l = await list({ prefix: 'crm/', cursor, limit: 1000 }); blobs.push(...l.blobs); cursor = l.hasMore ? l.cursor : undefined; } while (cursor);
  const out = [];
  for (let i = 0; i < blobs.length; i += 12) {
    const lote = await Promise.all(blobs.slice(i, i + 12).map((b) => leerRegistro(b.pathname.slice(4, -5))));
    out.push(...lote.filter(Boolean));
  }
  return out;
}

// Estado del embudo a partir de los datos: cierre manual > respuesta > apertura > entrega > envío > solicitud.
export function estadoDe(reg) {
  const c = reg.crm || {};
  if (c.cierre?.estado) return c.cierre.estado;
  const envios = reg.p?.envios || [];
  if ((c.respuestas || []).length) return 'respondida';
  if (envios.some((e) => ['opened', 'clicked', 'read'].includes(e.estadoEmail))) return 'abierta';
  if (envios.some((e) => e.estadoEmail === 'delivered')) return 'entregada';
  if (envios.length && envios.every((e) => ['failed', 'bounced', 'undelivered', 'rejected'].includes(e.estadoEmail))) return 'error';
  if (envios.length) return 'enviada';
  return 'solicitud';
}

export const totalDe = (p) => {
  if (p?.producto === 'reservus' && !p?.externo) return Number(p.valorRs) || 0;
  const sub = Math.round((p?.empleados || []).reduce((a, e) => a + 1000 * (Number(e.coef) || 0), 0));
  return p?.precioFinal !== undefined && p?.precioFinal !== null && p?.precioFinal !== '' ? Number(p.precioFinal) : sub;
};

// Logo para el panel: el guardado en el Blob, el de la web del cliente (vía proxy) o uno pequeño incrustado.
export function logoDe(reg) {
  const l = reg.p?.logo || '';
  if (reg.logoV) return `/api/crm?logo=${reg.id}&v=${reg.logoV}`;
  if (/^https?:/.test(l)) return '/api/logo?u=' + encodeURIComponent(l);
  if (/^data:image\//.test(l) && l.length < 120000) return l;
  return '';
}

export function resumenDe(reg) {
  const p = reg.p || {};
  const envios = p.envios || [];
  const ult = envios[envios.length - 1];
  const c = reg.crm || {};
  const fechas = [p.editado, reg.creado, ...envios.map((e) => e.fecha), ...envios.map((e) => e.abierto), ...(c.respuestas || []).map((r) => r.fecha), c.cierre?.fecha].filter(Boolean).sort();
  return {
    id: reg.id, cliente: p.cliente || '', razon: p.razon || '', ref: p.ref || '', email: ult?.para || p.email || '', logo: logoDe(reg),
    empleados: (p.empleados || []).length, producto: p.producto || (p.externo ? 'otro' : 'empleados'), planRs: p.producto === 'reservus' ? (p.planRs || '') : '', total: totalDe(p), estado: estadoDe(reg), envios: envios.length,
    ultimoEnvio: ult?.fecha || null, abierto: envios.map((e) => e.abierto).filter(Boolean).sort().pop() || null, estadoEmail: ult?.estadoEmail || '', respuestas: (c.respuestas || []).length,
    noLeidas: (c.respuestas || []).filter((r) => !r.leida).length, academia: !!p.academia, externo: !!p.externo, holded: !!(p.holded?.firma || p.holded?.final),
    creado: reg.creado, actividad: fechas[fechas.length - 1] || reg.creado,
  };
}
