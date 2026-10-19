// Facturación en Holded desde la propuesta: conexión (llave de API cifrada), alta o actualización del cliente
// y facturas de los dos pagos (50 % a la firma y 50 % a la finalización), siempre en BORRADOR para que Javi
// las numere y emita desde Holded respetando la correlación de número y fecha.
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer, guardar } from './_lib/almacen.js';

const API = 'https://api.holded.com/api/invoicing/v1';

async function holded(key, metodo, ruta, datos) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { key, Accept: 'application/json', ...(datos ? { 'Content-Type': 'application/json' } : {}) },
    body: datos ? JSON.stringify(datos) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.status === 0) throw new Error(d.info || d.message || `Holded respondió ${r.status}`);
  return d;
}

const limpio = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function buscarCliente(key, cif, nombre) {
  const objetivo = limpio(cif);
  for (let page = 1; page <= 20; page++) {
    const lista = await holded(key, 'GET', `/contacts?page=${page}`);
    if (!Array.isArray(lista) || !lista.length) break;
    const c = lista.find((x) => (objetivo && limpio(x.code) === objetivo) || (!objetivo && nombre && String(x.name || '').trim().toLowerCase() === nombre.trim().toLowerCase()));
    if (c) return c;
    if (lista.length < 50) break;
  }
  return null;
}

function direccionDe(txt) {
  const s = String(txt || '');
  const cp = (s.match(/\b(35\d{3}|38\d{3}|\d{5})\b/) || [])[1] || '';
  return { address: s.slice(0, 200), postalCode: cp, city: '', province: cp.startsWith('35') ? 'Las Palmas' : cp.startsWith('38') ? 'Santa Cruz de Tenerife' : '', country: 'España', countryCode: 'ES' };
}

async function asegurarCliente(key, p) {
  const nombre = p.razon || p.cliente;
  if (!nombre) throw new Error('Falta la razón social del cliente');
  const datos = {
    name: nombre, tradeName: p.cliente && p.cliente !== nombre ? p.cliente : undefined, code: p.cif || undefined,
    email: p.email || undefined, phone: p.telefono || undefined, type: 'client', isperson: false,
    billAddress: p.direccion ? direccionDe(p.direccion) : undefined,
    notes: 'Alta desde Crab Hub · propuesta ' + (p.ref || ''),
  };
  const existente = await buscarCliente(key, p.cif, nombre);
  if (existente) {
    const cambios = {}; for (const k of ['email', 'code', 'tradeName']) if (datos[k] && !existente[k]) cambios[k] = datos[k];
    if (Object.keys(cambios).length) await holded(key, 'PUT', `/contacts/${existente.id}`, cambios);
    return { id: existente.id, nuevo: false, nombre: existente.name };
  }
  const c = await holded(key, 'POST', '/contacts', datos);
  return { id: c.id, nuevo: true, nombre };
}

async function claveIgic(key) {
  try {
    const t = await holded(key, 'GET', '/taxes');
    const lista = Array.isArray(t) ? t : (t.taxes || []);
    const igic = lista.find((x) => /igic/i.test(`${x.name} ${x.key}`) && Number(x.amount ?? x.value ?? x.rate) === 7 && !/rec|ret/i.test(x.name || ''));
    return igic ? (igic.key || igic.id) : null;
  } catch { return null; }
}

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  const cfg = await leer('holded');

  if (b.op === 'estado') return json(res, 200, { conectado: !!cfg, llave: cfg ? '••••' + String(cfg.key).slice(-4) : '' });

  if (b.op === 'conectar') {
    const key = String(b.key || '').trim();
    if (key.length < 20) return json(res, 400, { error: 'Pega la API key de Holded' });
    try { await holded(key, 'GET', '/contacts?page=1'); }
    catch (e) { return json(res, 400, { error: 'Holded no acepta esa API key (' + e.message + ')' }); }
    await guardar('holded', { key, creada: Date.now() });
    return json(res, 200, { conectado: true, llave: '••••' + key.slice(-4) });
  }

  if (!cfg) return json(res, 400, { error: 'Conecta primero Holded en Ajustes.' });
  const p = b.propuesta || {};

  if (b.op === 'cliente') {
    const c = await asegurarCliente(cfg.key, p);
    return json(res, 200, { ok: true, contactId: c.id, nuevo: c.nuevo, nombre: c.nombre });
  }

  if (b.op === 'factura') {
    const tramo = b.tramo === 'final' ? 'final' : 'firma';
    const total = Number(b.total) || 0;
    if (total <= 0) return json(res, 400, { error: 'La propuesta no tiene importe' });
    const c = await asegurarCliente(cfg.key, p);
    const importe = Math.round((total / 2) * 100) / 100;
    const n = (p.empleados || []).length;
    const concepto = tramo === 'firma' ? 'Implantación Empleados IA · 50 % a la firma' : 'Implantación Empleados IA · 50 % a la finalización';
    const desc = `${n} empleados de inteligencia artificial según propuesta ${p.ref || ''}${tramo === 'firma' ? '. Reserva del calendario y fase de definición.' : '. Servicios de implantación finalizados.'}`.trim();
    const igic = await claveIgic(cfg.key);
    const item = { name: concepto, desc, units: 1, subtotal: importe, ...(igic ? { taxes: [igic] } : { tax: 7 }) };
    const doc = await holded(cfg.key, 'POST', '/documents/invoice', {
      contactId: c.id, date: Math.floor(Date.now() / 1000), items: [item], approveDoc: false,
      notes: `Propuesta ${p.ref || ''} · ${p.razon || p.cliente || ''}. Implantación total ${total.toLocaleString('es-ES')} € + IGIC en dos pagos del 50 %.`,
    });
    return json(res, 200, { ok: true, contactId: c.id, nuevoCliente: c.nuevo, docId: doc.id, importe, tramo, igic: !!igic });
  }

  json(res, 400, { error: 'Acción no válida' });
});
