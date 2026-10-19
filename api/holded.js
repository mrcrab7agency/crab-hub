// Facturación en Holded desde la propuesta: conexión (llave de API cifrada), alta o actualización del cliente
// y facturas de los dos pagos (50 % a la firma y 50 % a la finalización), siempre en BORRADOR para que Javi
// las numere y emita desde Holded respetando la correlación de número y fecha.
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer, guardar } from './_lib/almacen.js';

const BASE = 'https://api.holded.com/api';
const PERMISOS = 'contactos (leer y escribir), facturas de venta (escribir) e impuestos (leer)';

// API v2 de Holded (claves nuevas, cabecera Bearer). Si la clave es antigua (v1), se usa la cabecera «key».
async function holded(cfg, metodo, ruta, datos) {
  const v1 = cfg.version === 1;
  const r = await fetch(BASE + (v1 ? '/invoicing/v1' : '/v2') + ruta, {
    method: metodo,
    headers: { ...(v1 ? { key: cfg.key } : { Authorization: `Bearer ${cfg.key}` }), Accept: 'application/json', ...(datos ? { 'Content-Type': 'application/json' } : {}) },
    body: datos ? JSON.stringify(datos) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 403) throw new Error('La API key de Holded no tiene permiso para esto. Dale permisos de ' + PERMISOS + '.');
  if (!r.ok || d.status === 0) {
    const m = d.message || d.error?.message || d.error || d.info || (Array.isArray(d.errors) ? d.errors.map((e) => e.message || e).join(', ') : '') || `Holded respondió ${r.status}`;
    const e = new Error(typeof m === 'string' ? m : JSON.stringify(m)); e.status = r.status; throw e;
  }
  return d;
}

const limpio = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const lista = (d) => (Array.isArray(d) ? d : d.items || d.data || []);

async function buscarCliente(cfg, cif, nombre) {
  if (cfg.version === 1) {
    const objetivo = limpio(cif);
    for (let page = 1; page <= 20; page++) {
      const l = lista(await holded(cfg, 'GET', `/contacts?page=${page}`));
      if (!l.length) break;
      const c = l.find((x) => (objetivo && limpio(x.code) === objetivo) || (!objetivo && String(x.name || '').trim().toLowerCase() === String(nombre).trim().toLowerCase()));
      if (c) return c;
    }
    return null;
  }
  if (cif) { const l = lista(await holded(cfg, 'GET', `/contacts?code=${encodeURIComponent(cif)}&limit=5`)); if (l.length) return l[0]; }
  if (nombre) {
    const l = lista(await holded(cfg, 'GET', `/contacts/search?name=${encodeURIComponent(nombre)}&limit=10`));
    const c = l.find((x) => String(x.name || '').trim().toLowerCase() === nombre.trim().toLowerCase());
    if (c) return c;
  }
  return null;
}

function direccionDe(txt) {
  const s = String(txt || '');
  const cp = (s.match(/\b(\d{5})\b/) || [])[1] || '';
  const ciudad = (s.split(',').map((x) => x.trim()).find((x) => /^\d{5}\s/.test(x)) || '').replace(/^\d{5}\s*/, '');
  return { address: s.split(',')[0].slice(0, 150), city: ciudad, postal_code: cp, province: cp.startsWith('35') ? 'Las Palmas' : cp.startsWith('38') ? 'Santa Cruz de Tenerife' : '', country: 'España', country_code: 'ES' };
}

async function asegurarCliente(cfg, p) {
  const nombre = p.razon || p.cliente;
  if (!nombre) throw new Error('Falta la razón social del cliente');
  const existente = await buscarCliente(cfg, p.cif, nombre);
  if (existente) return { id: existente.id, nuevo: false, nombre: existente.name };
  const v1 = cfg.version === 1;
  const datos = v1
    ? { name: nombre, tradeName: p.cliente !== nombre ? p.cliente : undefined, code: p.cif || undefined, email: p.email || undefined, type: 'client', isperson: false }
    : { name: nombre, trade_name: p.cliente && p.cliente !== nombre ? p.cliente : null, code: p.cif || null, email: p.email || null, type: 'client', is_person: false,
        ...(p.direccion ? { bill_address: direccionDe(p.direccion) } : {}), tags: ['crab-hub', 'empleados-ia'] };
  const c = await holded(cfg, 'POST', '/contacts', datos);
  return { id: c.id, nuevo: true, nombre };
}

async function idIgic(cfg) {
  try {
    const l = lista(await holded(cfg, 'GET', '/taxes'));
    const t = l.find((x) => /igic/i.test(`${x.name} ${x.key} ${x.group}`) && Number(String(x.amount ?? '').replace(',', '.')) === 7 && !/rec|ret/i.test(x.name || ''));
    return t ? (cfg.version === 1 ? t.key : t.id) : null;
  } catch { return null; }
}

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  const cfg = await leer('holded');

  if (b.op === 'estado') return json(res, 200, { conectado: !!cfg, llave: cfg ? '••••' + String(cfg.key).slice(-4) : '' });

  if (b.op === 'conectar') {
    const key = String(b.key || '').trim();
    if (key.length < 20) return json(res, 400, { error: 'Pega la API key de Holded' });
    let version = 2;
    try { await holded({ key, version: 2 }, 'GET', '/contacts?limit=1'); }
    catch (e2) {
      if (e2.status !== 401) return json(res, 400, { error: 'Holded no acepta esa API key: ' + e2.message });
      try { await holded({ key, version: 1 }, 'GET', '/contacts?page=1'); version = 1; }
      catch (e1) { return json(res, 400, { error: 'Holded no acepta esa API key (' + e2.message + '). Comprueba que la has copiado entera.' }); }
    }
    await guardar('holded', { key, version, creada: Date.now() });
    return json(res, 200, { conectado: true, llave: '••••' + key.slice(-4), version });
  }

  if (!cfg) return json(res, 400, { error: 'Conecta primero Holded en Ajustes.' });
  const p = b.propuesta || {};

  if (b.op === 'cliente') {
    const c = await asegurarCliente(cfg, p);
    return json(res, 200, { ok: true, contactId: c.id, nuevo: c.nuevo, nombre: c.nombre });
  }

  if (b.op === 'factura') {
    const tramo = b.tramo === 'final' ? 'final' : 'firma';
    const total = Number(b.total) || 0;
    if (total <= 0) return json(res, 400, { error: 'La propuesta no tiene importe' });
    const c = await asegurarCliente(cfg, p);
    const importe = Math.round((total / 2) * 100) / 100;
    const n = (p.empleados || []).length;
    const concepto = tramo === 'firma' ? 'Implantación Empleados IA · 50 % a la firma' : 'Implantación Empleados IA · 50 % a la finalización';
    const desc = `${n} empleados de inteligencia artificial según propuesta ${p.ref || ''}${tramo === 'firma' ? '. Reserva del calendario y fase de definición.' : '. Servicios de implantación finalizados.'}`.trim();
    const igic = await idIgic(cfg);
    const hoy = new Date().toISOString().slice(0, 10);
    const nota = `Propuesta ${p.ref || ''} · ${p.razon || p.cliente || ''}. Implantación total ${total.toLocaleString('es-ES')} € + IGIC en dos pagos del 50 %.`;
    const doc = cfg.version === 1
      ? await holded(cfg, 'POST', '/documents/invoice', { contactId: c.id, date: Math.floor(Date.now() / 1000), approveDoc: false, notes: nota,
          items: [{ name: concepto, desc, units: 1, subtotal: importe, ...(igic ? { taxes: [igic] } : { tax: 7 }) }] })
      : await holded(cfg, 'POST', '/invoices', { contact_id: c.id, date: hoy, notes: nota, description: concepto,
          items: [{ name: concepto, type: 'service', description: desc, units: 1, price: importe, ...(igic ? { taxes: [igic] } : {}) }] });
    return json(res, 200, { ok: true, contactId: c.id, nuevoCliente: c.nuevo, docId: doc.id, importe, tramo, igic: !!igic });
  }

  json(res, 400, { error: 'Acción no válida' });
});
