// Envío de una propuesta por GHL: contacto, PDF a medios, email con seguimiento y oportunidad en el embudo.
import { ghl } from './ghl.js';
import { FIRMA_HTML } from './firma.js';
import { DEMO_HTML } from './demo.js';

// Las propuestas de Empleados IA van con copia al equipo de HUB iABOT (partner de la plataforma).
export const CC_EMPLEADOS = ['team@iabot.io'];

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function enviarPropuestaGhl(cfg, { email, contacto, empresa, telefono, web, asunto, mensaje, pdf, nombreArchivo, importe, sinFirma, producto, cc }) {
  const pasos = [];
  const rs = producto === 'reservus';
  const copia = Array.isArray(cc) ? cc : (producto === 'empleados' ? CC_EMPLEADOS : []);
  const c = await ghl(cfg, 'POST', '/contacts/upsert', {
    locationId: cfg.locationId, email,
    name: contacto || undefined, companyName: empresa || undefined,
    phone: telefono || undefined, website: web || undefined,
    tags: [rs ? 'propuesta-reservus-ia' : 'propuesta-empleados-ia', 'crab-hub'], source: rs ? 'Crab Hub · Propuestas Reservus IA' : 'Crab Hub · Propuestas',
  });
  const contactId = c.contact?.id;
  if (!contactId) throw new Error('GHL no devolvió el contacto');
  pasos.push(c.new ? 'Contacto creado' : 'Contacto actualizado');

  const fd = new FormData();
  fd.append('file', new Blob([pdf], { type: 'application/pdf' }), nombreArchivo);
  fd.append('hosted', 'false');
  fd.append('name', nombreArchivo);
  const media = await ghl(cfg, 'POST', '/medias/upload-file', fd);
  const url = media.url || media.fileUrl;
  if (!url) throw new Error('GHL no devolvió la dirección del PDF');
  pasos.push('PDF subido a GHL');

  const html = String(mensaje).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('') + (rs ? '' : DEMO_HTML) + (sinFirma ? '' : FIRMA_HTML);
  const envio = await ghl(cfg, 'POST', '/conversations/messages', {
    type: 'Email', contactId, subject: String(asunto).slice(0, 200), html, attachments: [url],
    ...(cfg.emailFrom ? { emailFrom: cfg.emailFrom } : {}),
    ...(copia.length ? { emailCc: copia } : {}),
    ...(cfg.cco ? { emailBcc: [cfg.cco] } : {}),
  });
  pasos.push(copia.length ? `Email enviado (copia a ${copia.join(', ')})` : 'Email enviado');

  let oportunidad = null;
  if (cfg.pipelineId) {
    try {
      const o = await ghl(cfg, 'POST', '/opportunities/upsert', {
        locationId: cfg.locationId, pipelineId: cfg.pipelineId, contactId,
        ...(cfg.stageId ? { pipelineStageId: cfg.stageId } : {}),
        name: `${rs ? 'Reservus IA' : 'Empleados IA'} · ${empresa || email}`, status: 'open',
        monetaryValue: Number(importe) || 0,
      });
      oportunidad = o.opportunity?.id || null;
      pasos.push(o.new ? 'Oportunidad creada' : 'Oportunidad actualizada');
    } catch (e) { pasos.push('Oportunidad no creada: ' + e.message); }
  }
  return { pasos, contactId, conversationId: envio.conversationId, messageId: envio.messageId, oportunidad, locationId: cfg.locationId, pdfUrl: url };
}
