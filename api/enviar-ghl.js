// Envía la propuesta por GHL: crea o actualiza el contacto, sube el PDF, envía el email con seguimiento
// y crea o actualiza la oportunidad en el embudo elegido.
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer } from './_lib/almacen.js';
import { ghl } from './_lib/ghl.js';
import { FIRMA_HTML } from './_lib/firma.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default proteger(async (req, res) => {
  const cfg = await leer('ghl');
  if (!cfg) return json(res, 400, { error: 'Conecta primero GHL en Ajustes.' });
  const b = cuerpo(req);
  const email = String(b.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'El email del cliente no es válido' });
  if (!b.pdf || !b.nombreArchivo) return json(res, 400, { error: 'Genera primero el PDF' });
  if (!b.asunto || !b.mensaje) return json(res, 400, { error: 'Falta el asunto o el texto del email' });
  const pasos = [];

  // 1. Contacto
  const contacto = await ghl(cfg, 'POST', '/contacts/upsert', {
    locationId: cfg.locationId, email,
    name: b.contacto || undefined, companyName: b.empresa || undefined,
    phone: b.telefono || undefined, website: b.web || undefined,
    tags: ['propuesta-empleados-ia', 'crab-hub'], source: 'Crab Hub · Propuestas',
  });
  const contactId = contacto.contact?.id;
  if (!contactId) throw new Error('GHL no devolvió el contacto');
  pasos.push(contacto.new ? 'Contacto creado' : 'Contacto actualizado');

  // 2. PDF a la biblioteca de medios
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.from(b.pdf, 'base64')], { type: 'application/pdf' }), b.nombreArchivo);
  fd.append('hosted', 'false');
  fd.append('name', b.nombreArchivo);
  const media = await ghl(cfg, 'POST', '/medias/upload-file', fd);
  const url = media.url || media.fileUrl;
  if (!url) throw new Error('GHL no devolvió la dirección del PDF');
  pasos.push('PDF subido a GHL');

  // 3. Email con seguimiento
  const html = String(b.mensaje).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + (b.sinFirma ? '' : FIRMA_HTML);
  const envio = await ghl(cfg, 'POST', '/conversations/messages', {
    type: 'Email', contactId, subject: String(b.asunto).slice(0, 200), html, attachments: [url],
    ...(cfg.emailFrom ? { emailFrom: cfg.emailFrom } : {}),
    ...(cfg.cco ? { emailBcc: [cfg.cco] } : {}),
  });
  pasos.push('Email enviado');

  // 4. Oportunidad
  let oportunidad = null;
  if (cfg.pipelineId) {
    try {
      const o = await ghl(cfg, 'POST', '/opportunities/upsert', {
        locationId: cfg.locationId, pipelineId: cfg.pipelineId, contactId,
        ...(cfg.stageId ? { pipelineStageId: cfg.stageId } : {}),
        name: `Empleados IA · ${b.empresa || email}`, status: 'open',
        monetaryValue: Number(b.importe) || 0,
      });
      oportunidad = o.opportunity?.id || null;
      pasos.push(o.new ? 'Oportunidad creada' : 'Oportunidad actualizada');
    } catch (e) { pasos.push('Oportunidad no creada: ' + e.message); }
  }

  json(res, 200, { ok: true, pasos, contactId, conversationId: envio.conversationId, messageId: envio.messageId, oportunidad, locationId: cfg.locationId, pdfUrl: url });
});
