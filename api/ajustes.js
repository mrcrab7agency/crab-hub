// Ajustes del panel: conexión con GHL (llave privada, subcuenta, embudo y etapa, remitente).
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer, guardar } from './_lib/almacen.js';
import { ghl, embudos } from './_lib/ghl.js';

const publico = (c) => c ? {
  conectado: true, locationId: c.locationId, nombreCuenta: c.nombreCuenta || '',
  pipelineId: c.pipelineId || '', stageId: c.stageId || '', emailFrom: c.emailFrom || '', cco: c.cco || '',
  llave: '••••' + String(c.token).slice(-4),
} : { conectado: false };

export default proteger(async (req, res) => {
  if (req.method === 'GET') {
    const c = await leer('ghl');
    const out = { ghl: publico(c) };
    if (c) { try { out.embudos = await embudos(c); } catch (e) { out.aviso = 'No se pudieron leer los embudos de GHL: ' + e.message; } }
    return json(res, 200, out);
  }
  const b = cuerpo(req);
  const actual = (await leer('ghl')) || {};
  const nuevo = { ...actual };
  if (b.token) nuevo.token = String(b.token).trim();
  if (b.locationId) nuevo.locationId = String(b.locationId).trim();
  for (const k of ['pipelineId', 'stageId', 'emailFrom', 'cco']) if (k in b) nuevo[k] = String(b[k] || '').trim();
  if (!nuevo.token || !nuevo.locationId) return json(res, 400, { error: 'Faltan la llave de GHL y el ID de la subcuenta' });
  if (b.token || b.locationId) {
    // Se comprueba con los embudos (permiso de oportunidades, que ya pide la integración);
    // el nombre de la subcuenta es opcional porque necesita además el permiso de ubicaciones.
    try {
      await embudos(nuevo);
    } catch (e) {
      try { await ghl(nuevo, 'GET', `/contacts/?locationId=${encodeURIComponent(nuevo.locationId)}&limit=1`); }
      catch (e2) {
        return json(res, 400, { error: 'GHL no acepta esa llave o ese ID de subcuenta (' + (e2.message || e.message) + '). Revisa que la integración sea de la subcuenta Mr Crab 7 y tenga los permisos de contactos, conversaciones, oportunidades y medios.' });
      }
    }
    try { const d = await ghl(nuevo, 'GET', `/locations/${encodeURIComponent(nuevo.locationId)}`); nuevo.nombreCuenta = d.location?.name || ''; } catch {}
  }
  await guardar('ghl', nuevo);
  let lista = [];
  try { lista = await embudos(nuevo); } catch {}
  json(res, 200, { ghl: publico(nuevo), embudos: lista });
}, ['GET', 'POST']);
