// Envía la propuesta generada en el editor por GHL (contacto, PDF, email con seguimiento y oportunidad).
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer } from './_lib/almacen.js';
import { enviarPropuestaGhl } from './_lib/envio-ghl.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default proteger(async (req, res) => {
  const cfg = await leer('ghl');
  if (!cfg) return json(res, 400, { error: 'Conecta primero GHL en Ajustes.' });
  const b = cuerpo(req);
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'El email del cliente no es válido' });
  if (!b.pdf || !b.nombreArchivo) return json(res, 400, { error: 'Genera primero el PDF' });
  if (!b.asunto || !b.mensaje) return json(res, 400, { error: 'Falta el asunto o el texto del email' });
  const r = await enviarPropuestaGhl(cfg, { ...b, email, pdf: Buffer.from(b.pdf, 'base64') });
  json(res, 200, { ok: true, ...r });
});
