// Seguimiento de propuestas (mini CRM): historial, estados automáticos desde GHL (entregado, abierto, respuestas),
// cierre manual (ganada/perdida), reenvío, respuesta al cliente y borrador de respuesta con IA.
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer } from './_lib/almacen.js';
import { ghl } from './_lib/ghl.js';
import { FIRMA_HTML } from './_lib/firma.js';
import { preguntar } from './_lib/ia.js';
import { idValido, leerRegistro, guardarRegistro, borrarRegistro, todosLosRegistros, estadoDe, resumenDe, totalDe } from './_lib/crm.js';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const aHtml = (t) => String(t).split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
const sinHtml = (h) => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
// Quita del texto del cliente la parte citada de nuestro email
const soloRespuesta = (t) => String(t || '').split(/\n(?:El .{5,80} escribió:|On .{5,80} wrote:|De: |From: |-----Original|_{5,})/)[0].trim();

function limpiarP(p) {
  const c = { ...p };
  delete c.logos;
  if (typeof c.logo === 'string' && c.logo.startsWith('data:') && c.logo.length > 400000) c.logo = '';
  return c;
}

async function refrescar(reg, cfg) {
  const p = reg.p || {};
  const envios = p.envios || [];
  if (!envios.length || !cfg) return false;
  let cambio = false;
  // Envíos antiguos sin messageId: se toma el último email saliente de la conversación
  for (const e of envios) {
    if (e.messageId || !e.conversationId) continue;
    try {
      const d = await ghl(cfg, 'GET', `/conversations/${e.conversationId}/messages?limit=40`);
      const msgs = (d.messages?.messages || d.messages || []).filter((m) => m.direction === 'outbound' && /email/i.test(m.messageType || ''));
      const t0 = Date.parse(e.fecha || 0) || Date.now();
      if (msgs.length) { msgs.sort((a, b) => Math.abs(Date.parse(a.dateAdded) - t0) - Math.abs(Date.parse(b.dateAdded) - t0)); e.messageId = msgs[0].id; e.emailId = msgs[0].meta?.email?.messageIds?.[0] || ''; cambio = true; }
    } catch {}
  }
  for (const e of envios) {
    if (!e.messageId || ['opened', 'clicked'].includes(e.estadoEmail) && e.revisado && Date.now() - Date.parse(e.revisado) < 3600e3) continue;
    try {
      if (!e.emailId) { const m = await ghl(cfg, 'GET', `/conversations/messages/${e.messageId}`); e.emailId = (m.message || m).meta?.email?.messageIds?.[0] || ''; }
      if (e.emailId) {
        const em = (await ghl(cfg, 'GET', `/conversations/messages/email/${e.emailId}`)).emailMessage || {};
        if (em.status && em.status !== e.estadoEmail) { e.estadoEmail = em.status; cambio = true; if (['opened', 'clicked'].includes(em.status) && !e.abierto) e.abierto = em.dateUpdated || new Date().toISOString(); }
        if (!e.pdfUrl && em.attachments?.[0]) { e.pdfUrl = em.attachments[0]; cambio = true; }
      }
      e.revisado = new Date().toISOString();
    } catch {}
  }
  // Respuestas del cliente: emails entrantes en la conversación posteriores al primer envío
  const conv = envios.find((e) => e.conversationId)?.conversationId;
  if (conv) {
    try {
      const d = await ghl(cfg, 'GET', `/conversations/${conv}/messages?limit=40`);
      const msgs = d.messages?.messages || d.messages || [];
      const desde = Date.parse(envios[0].fecha || 0);
      reg.crm = reg.crm || {};
      const ya = new Set((reg.crm.respuestas || []).map((r) => r.id));
      for (const m of msgs) {
        if (m.direction !== 'inbound' || ya.has(m.id) || Date.parse(m.dateAdded) < desde) continue;
        const texto = soloRespuesta(sinHtml(m.body || ''));
        (reg.crm.respuestas = reg.crm.respuestas || []).push({ id: m.id, fecha: m.dateAdded, canal: (m.messageType || '').replace('TYPE_', '').toLowerCase(), asunto: m.meta?.email?.subject || '', texto: texto.slice(0, 6000), leida: false, emailId: m.meta?.email?.messageIds?.[0] || '' });
        cambio = true;
      }
    } catch {}
  }
  return cambio;
}

async function enviarEmail(cfg, { contactId, asunto, texto, adjuntos, replyMessageId }) {
  const r = await ghl(cfg, 'POST', '/conversations/messages', {
    type: 'Email', contactId, subject: String(asunto).slice(0, 200), html: aHtml(texto) + FIRMA_HTML,
    ...(adjuntos?.length ? { attachments: adjuntos } : {}), ...(replyMessageId ? { replyMessageId } : {}),
    ...(cfg.emailFrom ? { emailFrom: cfg.emailFrom } : {}), ...(cfg.cco ? { emailBcc: [cfg.cco] } : {}),
  });
  return r;
}

const SISTEMA_RESP = `Eres Javi (Javier Fernández), CEO de Mr Crab 7 · La Buena IA, en Gran Canaria. Redactas la respuesta por email a un cliente sobre una propuesta de empleados de inteligencia artificial (plataforma HUB iABOT).
Estilo: español de España, cercano y profesional, frases cortas, sin relleno ni tecnicismos innecesarios. Respondes exactamente a lo que pregunta o plantea el cliente, con los datos reales de la propuesta.
Nunca plantees la IA como sustitución de personas ni como ahorro de contrataciones: multiplica el equipo que ya existe. No inventes precios, plazos ni condiciones que no estén en la propuesta; si hace falta algo que no sabes, propón comentarlo en una llamada o reunión.
Si el cliente acepta, explica el siguiente paso: contrato y pago a la firma (50 %), y la primera sesión de implantación. Si pide descuento, no lo concedas por tu cuenta: di que lo revisas.
Termina con un saludo breve firmado como "Javi". No incluyas asunto ni firma corporativa: se añade sola. Devuelve solo el texto del email.`;

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  const cfg = await leer('ghl');

  if (b.op === 'listar') {
    const regs = await todosLosRegistros();
    let cambios = 0;
    if (b.refrescar && cfg) {
      const vivos = regs.filter((r) => (r.p?.envios || []).length && !r.crm?.cierre?.estado);
      for (let i = 0; i < vivos.length; i += 4) {
        const lote = vivos.slice(i, i + 4);
        const res2 = await Promise.all(lote.map((r) => refrescar(r, cfg)));
        for (let k = 0; k < lote.length; k++) if (res2[k]) { cambios++; await guardarRegistro(lote[k]); }
      }
    }
    const items = regs.map(resumenDe).sort((x, y) => String(y.actividad).localeCompare(String(x.actividad)));
    return json(res, 200, { items, cambios, ghl: !!cfg, locationId: cfg?.locationId || '' });
  }

  if (b.op === 'guardar') {
    const p = b.p || {};
    if (!idValido(p.id)) return json(res, 400, { error: 'Propuesta sin identificador' });
    if (!p.cliente && !(p.empleados || []).length) return json(res, 200, { ok: true, ignorada: true });
    const reg = (await leerRegistro(p.id)) || { id: p.id, creado: new Date().toISOString(), crm: { historial: [{ fecha: new Date().toISOString(), tipo: 'creada', texto: 'Solicitud creada' }] } };
    const antes = (reg.p?.envios || []).length;
    // Conserva los estados de email ya conocidos por el servidor
    const previos = new Map();
    for (const e of reg.p?.envios || []) { if (e.messageId) previos.set(e.messageId, e); if (e.fecha) previos.set(e.fecha, e); }
    p.envios = (p.envios || []).map((e) => {
      const v = (e.messageId && previos.get(e.messageId)) || previos.get(e.fecha) || {};
      const n = { ...v };
      for (const [k, x] of Object.entries(e)) if (x !== undefined && x !== null && x !== '') n[k] = x;
      if (v.estadoEmail) n.estadoEmail = v.estadoEmail;
      if (v.abierto) n.abierto = v.abierto;
      return n;
    });
    // Los reenvíos hechos desde el seguimiento solo están en el servidor: se conservan
    for (const v of reg.p?.envios || []) if (v.reenvio && !p.envios.some((e) => e.messageId === v.messageId)) p.envios.push(v);
    p.envios.sort((x, y) => String(x.fecha).localeCompare(String(y.fecha)));
    reg.p = limpiarP(p);
    reg.crm = reg.crm || {};
    if (p.envios.length > antes) (reg.crm.historial = reg.crm.historial || []).push({ fecha: p.envios[p.envios.length - 1].fecha, tipo: 'envio', texto: `Propuesta enviada a ${p.envios[p.envios.length - 1].para || ''}` });
    if (p.academia && !reg.crm.cierre) reg.crm.cierre = { estado: 'ganada', fecha: p.academia.fecha || new Date().toISOString(), motivo: 'Contrato firmado · alta en la Academia' };
    await guardarRegistro(reg);
    return json(res, 200, { ok: true, estado: estadoDe(reg) });
  }

  if (!idValido(b.id)) return json(res, 400, { error: 'Propuesta no válida' });
  const reg = await leerRegistro(b.id);
  if (!reg) return json(res, 404, { error: 'No encuentro esa propuesta en el seguimiento' });
  reg.crm = reg.crm || {}; reg.crm.historial = reg.crm.historial || [];
  const p = reg.p || {};
  const ult = (p.envios || [])[p.envios?.length - 1];

  if (b.op === 'detalle') {
    if (cfg && await refrescar(reg, cfg)) await guardarRegistro(reg);
    return json(res, 200, { reg: { ...reg, estado: estadoDe(reg), total: totalDe(p) }, locationId: cfg?.locationId || '' });
  }

  if (b.op === 'leidas') {
    (reg.crm.respuestas || []).forEach((r) => (r.leida = true));
    await guardarRegistro(reg); return json(res, 200, { ok: true });
  }

  if (b.op === 'marcar') {
    const e = b.estado;
    if (e === 'ganada' || e === 'perdida') { reg.crm.cierre = { estado: e, fecha: new Date().toISOString(), motivo: String(b.motivo || '').slice(0, 300) }; reg.crm.historial.push({ fecha: reg.crm.cierre.fecha, tipo: e, texto: e === 'ganada' ? 'Marcada como ganada' : 'Marcada como perdida' + (b.motivo ? ` · ${b.motivo}` : '') }); }
    else { delete reg.crm.cierre; reg.crm.historial.push({ fecha: new Date().toISOString(), tipo: 'reabierta', texto: 'Reabierta' }); }
    await guardarRegistro(reg);
    return json(res, 200, { ok: true, estado: estadoDe(reg) });
  }

  if (b.op === 'nota') {
    const t = String(b.texto || '').trim(); if (!t) return json(res, 400, { error: 'Escribe la nota' });
    reg.crm.historial.push({ fecha: new Date().toISOString(), tipo: 'nota', texto: t.slice(0, 2000) });
    await guardarRegistro(reg); return json(res, 200, { ok: true });
  }

  if (b.op === 'borrar') { await borrarRegistro(b.id); return json(res, 200, { ok: true }); }

  if (b.op === 'ia-respuesta') {
    const ultResp = (reg.crm.respuestas || []).slice(-1)[0];
    const mensaje = String(b.mensaje || ultResp?.texto || '').trim();
    const contexto = `Cliente: ${p.razon || p.cliente} (${p.cliente || ''})
Propuesta ${p.ref || ''}: ${(p.empleados || []).length} empleados de inteligencia artificial. Total implantación ${totalDe(p).toLocaleString('es-ES')} € + IGIC, 50 % a la firma y 50 % al terminar, sin permanencia. Plataforma: plan ${p.plan || 'autonomos'} (se contrata aparte).
Puestos: ${(p.empleados || []).map((e) => e.nombre).join(', ')}.
${p.ajusteLabel && p.precioFinal ? 'Precio especial con descuento: ' + p.ajusteLabel + '.' : ''}
Email enviado: ${ult ? `«${ult.asunto}»\n${String(ult.mensaje || '').slice(0, 2500)}` : '-'}
Historial de respuestas previas del cliente:\n${(reg.crm.respuestas || []).slice(-4).map((r) => `- ${r.fecha?.slice(0, 10)}: ${r.texto.slice(0, 800)}`).join('\n') || '-'}`;
    const usuario = `${contexto}\n\nMensaje del cliente al que hay que responder:\n"""\n${mensaje || '(sin respuesta todavía: redacta un seguimiento amable para saber si ha podido ver la propuesta)'}\n"""\n${b.instrucciones ? 'Indicaciones de Javi para la respuesta: ' + String(b.instrucciones).slice(0, 1000) : ''}`;
    const texto = await preguntar({ modelo: 'anthropic/claude-sonnet-5.5', sistema: SISTEMA_RESP, usuario, maxTokens: 1200, temperatura: 0.5 });
    return json(res, 200, { texto: texto.trim() });
  }

  if (!cfg) return json(res, 400, { error: 'Conecta primero GHL en Ajustes.' });
  if (!ult?.contactId) return json(res, 400, { error: 'Esta propuesta aún no se ha enviado por GHL' });

  if (b.op === 'responder') {
    const texto = String(b.texto || '').trim(); if (texto.length < 5) return json(res, 400, { error: 'Escribe la respuesta' });
    const ultResp = (reg.crm.respuestas || []).slice(-1)[0];
    const asunto = b.asunto || (ultResp?.asunto ? (/^re:/i.test(ultResp.asunto) ? ultResp.asunto : 'Re: ' + ultResp.asunto) : 'Re: ' + (ult.asunto || 'Propuesta'));
    const r = await enviarEmail(cfg, { contactId: ult.contactId, asunto, texto, replyMessageId: ultResp?.id });
    reg.crm.historial.push({ fecha: new Date().toISOString(), tipo: 'respuesta', texto: texto.slice(0, 2000), messageId: r.messageId });
    (reg.crm.respuestas || []).forEach((x) => (x.leida = true));
    await guardarRegistro(reg);
    return json(res, 200, { ok: true });
  }

  if (b.op === 'reenviar') {
    const asunto = String(b.asunto || ult.asunto || 'Propuesta');
    const texto = String(b.texto || ult.mensaje || '').trim();
    if (!texto) return json(res, 400, { error: 'Falta el texto del email' });
    const adjuntos = ult.pdfUrl ? [ult.pdfUrl] : [];
    const r = await enviarEmail(cfg, { contactId: ult.contactId, asunto, texto, adjuntos });
    const nuevo = { fecha: new Date().toISOString(), para: ult.para, asunto, mensaje: texto, contactId: ult.contactId, conversationId: r.conversationId || ult.conversationId, messageId: r.messageId, pdfUrl: ult.pdfUrl, reenvio: true };
    p.envios.push(nuevo);
    reg.crm.historial.push({ fecha: nuevo.fecha, tipo: 'envio', texto: `Reenviada a ${ult.para || ''}${adjuntos.length ? ' con el PDF' : ''}` });
    await guardarRegistro(reg);
    return json(res, 200, { ok: true });
  }

  json(res, 400, { error: 'Acción no válida' });
});
