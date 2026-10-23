// Seguimiento de propuestas (mini CRM): historial, estados automáticos desde GHL (entregado, abierto, respuestas),
// cierre manual (ganada/perdida), reenvío, respuesta al cliente y borrador de respuesta con IA.
import { proteger, cuerpo, json } from './_lib/core.js';
import { leer } from './_lib/almacen.js';
import { ghl } from './_lib/ghl.js';
import { FIRMA_HTML } from './_lib/firma.js';
import { DEMO_HTML } from './_lib/demo.js';
import { preguntar, sacarJSON } from './_lib/ia.js';
import { put, get, list, del } from '@vercel/blob';
import { conClaude } from './_lib/requisitos-ia.js';
import { enviarPropuestaGhl, CC_EMPLEADOS } from './_lib/envio-ghl.js';
import { altaAcademia } from './_lib/alta.js';
import { sitioDe, buscarLogo, descargarImagen, tipoImagen, guardarLogo, leerLogo } from './_lib/logos.js';

export const config = { api: { bodyParser: { sizeLimit: '4.4mb' } } };
const okSubida = (s) => /^[a-z0-9-]{8,64}$/i.test(String(s || ''));
const rutaPdf = (id) => `crm-pdf/${id}.pdf`;
async function leerPdf(id) {
  const r = await get(rutaPdf(id), { access: 'private', useCache: false });
  if (!r?.stream) throw new Error('No encuentro el PDF de esta propuesta');
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

const PROMPT_IMPORTAR = `Te paso una propuesta comercial en PDF que Mr Crab 7 (Javi, La Buena IA) va a enviar a un cliente. Extrae los datos y redacta el email de envío.
Devuelve SOLO un JSON con esta forma, sin texto alrededor:
{"cliente":"nombre comercial del cliente","razon":"razón social si aparece","cif":"","email":"email del cliente si aparece","contacto":"nombre de la persona de contacto si aparece","telefono":"","web":"","ref":"referencia de la propuesta si aparece","total":0,"empleados":["nombre de cada puesto, servicio o partida principal"],"resumen":"2-3 frases con lo que se propone","producto":"empleados | reservus | otro","asunto":"asunto del email","mensaje":"cuerpo del email"}
Reglas:
- producto: "empleados" si propone empleados de inteligencia artificial (Empleados IA / HUB iABOT), "reservus" si propone Reservus IA (reservas y llamadas con IA), "otro" en cualquier otro caso.
- total: importe total de la propuesta en euros, sin impuestos, como número (si hay varias opciones, la principal o recomendada). 0 si no hay.
- Si un dato no aparece, déjalo vacío; no lo inventes. Nunca pongas como email del cliente uno de Mr Crab 7, FERAMA o mrcrab7.
- El email lo firma Javi, en español de España, cercano y profesional, breve (4-7 frases): saluda por el nombre si lo hay, dice que adjunta la propuesta para el cliente, resume en una frase el valor principal, propone el siguiente paso (comentarla en una llamada o reunión) y se despide con "Un saludo," sin firma (se añade sola). Sin negritas ni listas.
- Si la propuesta habla de empleados de inteligencia artificial, nunca los plantees como sustitución de personas ni ahorro de contrataciones: multiplican al equipo que ya existe.
- Asunto claro, tipo "Propuesta de ... para <cliente>".`;
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

async function enviarEmail(cfg, { contactId, asunto, texto, adjuntos, replyMessageId, demo, cc }) {
  const r = await ghl(cfg, 'POST', '/conversations/messages', {
    type: 'Email', contactId, subject: String(asunto).slice(0, 200), html: aHtml(texto) + (demo ? DEMO_HTML : '') + FIRMA_HTML,
    ...(adjuntos?.length ? { attachments: adjuntos } : {}), ...(replyMessageId ? { replyMessageId } : {}),
    ...(cc?.length ? { emailCc: cc } : {}),
    ...(cfg.emailFrom ? { emailFrom: cfg.emailFrom } : {}), ...(cfg.cco ? { emailBcc: [cfg.cco] } : {}),
  });
  return r;
}

const SISTEMA_RESP = `Eres Javi (Javier Fernández), CEO de Mr Crab 7 · La Buena IA, en Gran Canaria. Redactas la respuesta por email a un cliente sobre una propuesta de empleados de inteligencia artificial (plataforma HUB iABOT).
Estilo: español de España, cercano y profesional, frases cortas, sin relleno ni tecnicismos innecesarios. Respondes exactamente a lo que pregunta o plantea el cliente, con los datos reales de la propuesta.
Nunca plantees la IA como sustitución de personas ni como ahorro de contrataciones: multiplica el equipo que ya existe. No inventes precios, plazos ni condiciones que no estén en la propuesta; si hace falta algo que no sabes, propón comentarlo en una llamada o reunión.
Si el cliente acepta, explica el siguiente paso: contrato y pago a la firma (50 %), y la primera sesión de implantación. Si pide descuento, no lo concedas por tu cuenta: di que lo revisas.
Termina con un saludo breve firmado como "Javi". No incluyas asunto ni firma corporativa: se añade sola. Devuelve solo el texto del email.`;

const SISTEMA_RESP_RS = `Eres Javi (Javier Fernández), CEO de Mr Crab 7 · La Buena IA, en Gran Canaria. Redactas la respuesta por email a un cliente sobre una propuesta de Reservus IA (atención de llamadas y WhatsApp con IA, reservas, confirmaciones por SMS y email, app móvil, carta con IA y QR).
Estilo: español de España, cercano y profesional, frases cortas, sin relleno ni tecnicismos (nada de API ni jerga técnica). Respondes exactamente a lo que pregunta o plantea el cliente, con los datos reales de la propuesta. Habla siempre de Reservus IA, nunca de "empleados de IA".
No inventes precios, plazos ni condiciones que no estén en la propuesta; si hace falta algo que no sabes, propón comentarlo en una llamada o reunión. Si pide descuento, no lo concedas por tu cuenta: di que lo revisas.
Si el cliente acepta, explica el siguiente paso: firma de la propuesta, pago del alta y puesta en marcha con nuestro equipo.
Termina con un saludo breve firmado como "Javi". No incluyas asunto ni firma corporativa: se añade sola. Devuelve solo el texto del email.`;

export default proteger(async (req, res) => {
  if (req.method === 'GET') {
    const id = String(req.query?.logo || '');
    const l = idValido(id) ? await leerLogo(id) : null;
    if (!l) return res.status(404).end();
    res.setHeader('Content-Type', l.tipo);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    return res.status(200).send(l.buf);
  }
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


  if (b.op === 'trozo') {
    if (!okSubida(b.id) || !Number.isInteger(b.n) || b.n < 0 || b.n > 15 || !b.datos) return json(res, 400, { error: 'Trozo no válido' });
    await put(`crm-subida/${b.id}/${String(b.n).padStart(3, '0')}`, Buffer.from(b.datos, 'base64'), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream' });
    return json(res, 200, { ok: true });
  }

  if (b.op === 'importar') {
    if (!okSubida(b.id) || !Number.isInteger(b.partes) || b.partes < 1 || b.partes > 15) return json(res, 400, { error: 'Archivo no válido' });
    const nombre = String(b.nombre || 'propuesta.pdf').replace(/[^\w.\- áéíóúñÁÉÍÓÚÑ()]/g, '').slice(0, 100) || 'propuesta.pdf';
    let buf;
    try {
      const trozos = [];
      for (let i = 0; i < b.partes; i++) {
        const r = await get(`crm-subida/${b.id}/${String(i).padStart(3, '0')}`, { access: 'private', useCache: false });
        if (!r?.stream) throw new Error('Falta una parte del archivo; vuelve a subirlo');
        trozos.push(Buffer.from(await new Response(r.stream).arrayBuffer()));
      }
      buf = Buffer.concat(trozos);
    } finally {
      try { const l = await list({ prefix: `crm-subida/${b.id}/` }); if (l.blobs.length) await del(l.blobs.map((x) => x.url)); } catch {}
    }
    if (buf.subarray(0, 5).toString() !== '%PDF-') return json(res, 400, { error: 'El archivo no es un PDF' });
    if (buf.length > 30 * 1024 * 1024) return json(res, 400, { error: 'El PDF supera 30 MB' });
    const id = 'x' + b.id.replace(/-/g, '').slice(0, 30);
    await put(rutaPdf(id), buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/pdf' });
    let d = {};
    try {
      const txt = await conClaude([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }, { type: 'text', text: PROMPT_IMPORTAR }], 2000, 'anthropic/claude-sonnet-5.5');
      d = sacarJSON(txt);
    } catch (e) { d = { aviso: 'La IA no pudo leer el PDF: ' + e.message }; }
    const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
    const email = s(d.email, 120).toLowerCase();
    const p = {
      id, externo: { nombre, bytes: buf.length, subido: new Date().toISOString() },
      cliente: s(d.cliente) || nombre.replace(/\.pdf$/i, ''), razon: s(d.razon), cif: s(d.cif, 30),
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && !/mrcrab7|ferama/.test(email) ? email : '',
      contactoNombre: s(d.contacto, 120), telefono: s(d.telefono, 40), web: s(d.web, 200), ref: s(d.ref, 60),
      precioFinal: Number(d.total) > 0 ? Math.round(Number(d.total) * 100) / 100 : 0,
      empleados: (Array.isArray(d.empleados) ? d.empleados : []).slice(0, 60).map((x) => ({ nombre: s(x, 120), coef: 0 })),
      producto: ['empleados', 'reservus'].includes(d.producto) ? d.producto : 'otro',
      resumen: s(d.resumen, 1200), borrador: { asunto: s(d.asunto, 200), mensaje: s(d.mensaje, 5000) }, envios: [],
    };
    const reg = { id, creado: new Date().toISOString(), p, crm: { historial: [{ fecha: new Date().toISOString(), tipo: 'creada', texto: `PDF subido: ${nombre}` }] } };
    // Logo del cliente desde su web (no bloquea la importación si falla)
    try {
      const sitio = await sitioDe({ web: p.web, email: p.email, cliente: p.cliente, razon: p.razon });
      if (sitio) { if (!p.web) p.web = sitio; const l = await buscarLogo(sitio); if (l) { await guardarLogo(id, l); reg.logoV = Date.now(); } }
    } catch {}
    await guardarRegistro(reg);
    return json(res, 200, { ok: true, id, aviso: d.aviso || '' });
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
    if (reg.p?.externo) return json(res, 200, { ok: true, ignorada: true });
    // El alta en la academia puede hacerse desde el seguimiento: no se pierde al sincronizar desde el editor
    if (reg.p?.academia && !p.academia) p.academia = reg.p.academia;
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
  const esReservus = p.producto === 'reservus';
  const ccSeguimiento = p.producto === 'empleados' || (!esReservus && !p.externo) ? CC_EMPLEADOS : [];

  if (b.op === 'detalle') {
    if (cfg && await refrescar(reg, cfg)) await guardarRegistro(reg);
    return json(res, 200, { reg: { ...reg, estado: estadoDe(reg), total: totalDe(p), logoUrl: resumenDe(reg).logo }, locationId: cfg?.locationId || '' });
  }


  if (b.op === 'pdf') {
    if (!p.externo) return json(res, 400, { error: 'Esta propuesta se genera desde el editor' });
    const buf = await leerPdf(reg.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Nombre-Archivo', encodeURIComponent(p.externo.nombre || 'propuesta.pdf'));
    return res.status(200).send(buf);
  }

  if (b.op === 'logo') {
    let img = null;
    if (b.dataUrl) {
      const m = String(b.dataUrl).match(/^data:image\/[a-z+.-]+;base64,(.+)$/i);
      if (m) { const buf = Buffer.from(m[1], 'base64'); const tipo = tipoImagen(buf); if (tipo && buf.length < 2.5e6) img = { buf, tipo }; }
    } else if (b.url) img = await descargarImagen(String(b.url));
    else {
      const sitio = await sitioDe({ web: b.web || p.web, email: p.email || ult?.para, cliente: p.cliente, razon: p.razon });
      if (sitio) { img = await buscarLogo(sitio); if (!p.web) p.web = sitio; }
    }
    if (!img) return json(res, 404, { error: 'No he encontrado un logo válido. Prueba con la web del cliente o sube la imagen.' });
    await guardarLogo(reg.id, img); reg.logoV = Date.now(); reg.p = p; await guardarRegistro(reg);
    return json(res, 200, { ok: true, logo: `/api/crm?logo=${reg.id}&v=${reg.logoV}` });
  }

  if (b.op === 'datos') {
    const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
    for (const k of ['cliente', 'razon', 'email', 'contactoNombre', 'ref']) if (b[k] !== undefined) p[k] = s(b[k]);
    if (b.total !== undefined) p.precioFinal = Math.max(0, Number(b.total) || 0);
    if (b.asunto !== undefined || b.mensaje !== undefined) p.borrador = { asunto: s(b.asunto ?? p.borrador?.asunto), mensaje: s(b.mensaje ?? p.borrador?.mensaje, 5000) };
    reg.p = p; await guardarRegistro(reg);
    return json(res, 200, { ok: true });
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

  if (b.op === 'academia') {
    const email = String(b.email || p.email || ult?.para || '').trim();
    const empresa = String(p.razon || p.cliente || '').trim();
    const d = await altaAcademia({ email, empresa, nombre: p.contactoNombre || '' });
    const fecha = new Date().toISOString();
    if (!p.email) p.email = email.toLowerCase();
    p.academia = { codigo: d.codigo, fecha, email: email.toLowerCase(), envios: (p.academia?.envios || 0) + 1 };
    reg.p = p;
    if (!reg.crm.cierre) reg.crm.cierre = { estado: 'ganada', fecha, motivo: 'Contrato firmado · alta en la Academia' };
    await guardarRegistro(reg);
    return json(res, 200, { ...d, estado: estadoDe(reg) });
  }

  if (b.op === 'nota') {
    const t = String(b.texto || '').trim(); if (!t) return json(res, 400, { error: 'Escribe la nota' });
    reg.crm.historial.push({ fecha: new Date().toISOString(), tipo: 'nota', texto: t.slice(0, 2000) });
    await guardarRegistro(reg); return json(res, 200, { ok: true });
  }

  if (b.op === 'borrar') {
    await borrarRegistro(b.id);
    for (const pre of [p.externo ? rutaPdf(b.id) : '', `crm-logo/${b.id}`].filter(Boolean)) { try { const l = await list({ prefix: pre }); if (l.blobs.length) await del(l.blobs.map((x) => x.url)); } catch {} }
    return json(res, 200, { ok: true });
  }

  if (b.op === 'ia-respuesta') {
    const ultResp = (reg.crm.respuestas || []).slice(-1)[0];
    const mensaje = String(b.mensaje || ultResp?.texto || '').trim();
    const contextoRs = esReservus ? `Cliente: ${p.razon || p.cliente} (${p.cliente || ''})
Propuesta ${p.ref || ''} de Reservus IA: plan ${p.planRs || 'profesional'}, modalidad ${p.modalidad === 'sinalta' ? 'sin alta (12 meses de permanencia, sin garantía)' : 'con alta (sin permanencia, 30 días de garantía)'}.
${p.resumenRs || ''}
Email enviado: ${ult ? `«${ult.asunto}»\n${String(ult.mensaje || '').slice(0, 2500)}` : '-'}
Historial de respuestas previas del cliente:\n${(reg.crm.respuestas || []).slice(-4).map((r) => `- ${r.fecha?.slice(0, 10)}: ${r.texto.slice(0, 800)}`).join('\n') || '-'}` : '';
    const contexto = contextoRs || `Cliente: ${p.razon || p.cliente} (${p.cliente || ''})
Propuesta ${p.ref || ''}: ${(p.empleados || []).length} empleados de inteligencia artificial. Total implantación ${totalDe(p).toLocaleString('es-ES')} € + IGIC, 50 % a la firma y 50 % al terminar, sin permanencia. Plataforma: plan ${p.plan || 'autonomos'} (se contrata aparte).
Puestos: ${(p.empleados || []).map((e) => e.nombre).join(', ')}.
${p.ajusteLabel && p.precioFinal ? 'Precio especial con descuento: ' + p.ajusteLabel + '.' : ''}
Email enviado: ${ult ? `«${ult.asunto}»\n${String(ult.mensaje || '').slice(0, 2500)}` : '-'}
Historial de respuestas previas del cliente:\n${(reg.crm.respuestas || []).slice(-4).map((r) => `- ${r.fecha?.slice(0, 10)}: ${r.texto.slice(0, 800)}`).join('\n') || '-'}`;
    const usuario = `${contexto}\n\nMensaje del cliente al que hay que responder:\n"""\n${mensaje || '(sin respuesta todavía: redacta un seguimiento amable para saber si ha podido ver la propuesta)'}\n"""\n${b.instrucciones ? 'Indicaciones de Javi para la respuesta: ' + String(b.instrucciones).slice(0, 1000) : ''}`;
    const texto = await preguntar({ modelo: 'anthropic/claude-sonnet-5.5', sistema: esReservus ? SISTEMA_RESP_RS : SISTEMA_RESP, usuario, maxTokens: 1200, temperatura: 0.5 });
    return json(res, 200, { texto: texto.trim() });
  }

  if (!cfg) return json(res, 400, { error: 'Conecta primero GHL en Ajustes.' });

  if (b.op === 'enviar') {
    if (!p.externo) return json(res, 400, { error: 'Esta propuesta se envía desde el editor' });
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { error: 'El email del cliente no es válido' });
    if (!b.asunto || String(b.mensaje || '').trim().length < 5) return json(res, 400, { error: 'Falta el asunto o el texto del email' });
    const pdf = await leerPdf(reg.id);
    const r = await enviarPropuestaGhl(cfg, { email, contacto: b.contacto, empresa: p.razon || p.cliente, telefono: p.telefono, web: p.web, asunto: b.asunto, mensaje: b.mensaje, pdf, nombreArchivo: p.externo.nombre || 'propuesta.pdf', importe: totalDe(p), producto: p.producto || 'otro' });
    const fecha = new Date().toISOString();
    p.email = email; if (b.contacto) p.contactoNombre = String(b.contacto).slice(0, 120);
    p.borrador = { asunto: String(b.asunto).slice(0, 200), mensaje: String(b.mensaje).slice(0, 5000) };
    (p.envios = p.envios || []).push({ fecha, para: email, asunto: p.borrador.asunto, mensaje: p.borrador.mensaje, contactId: r.contactId, conversationId: r.conversationId, messageId: r.messageId, pdfUrl: r.pdfUrl });
    reg.p = p;
    reg.crm.historial.push({ fecha, tipo: 'envio', texto: `Propuesta enviada a ${email}` });
    await guardarRegistro(reg);
    return json(res, 200, { ok: true, pasos: r.pasos });
  }

  if (!ult?.contactId) return json(res, 400, { error: 'Esta propuesta aún no se ha enviado por GHL' });

  if (b.op === 'responder') {
    const texto = String(b.texto || '').trim(); if (texto.length < 5) return json(res, 400, { error: 'Escribe la respuesta' });
    const ultResp = (reg.crm.respuestas || []).slice(-1)[0];
    const asunto = b.asunto || (ultResp?.asunto ? (/^re:/i.test(ultResp.asunto) ? ultResp.asunto : 'Re: ' + ultResp.asunto) : 'Re: ' + (ult.asunto || 'Propuesta'));
    const r = await enviarEmail(cfg, { contactId: ult.contactId, asunto, texto, replyMessageId: ultResp?.id, cc: ccSeguimiento });
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
    const r = await enviarEmail(cfg, { contactId: ult.contactId, asunto, texto, adjuntos, demo: !esReservus, cc: ccSeguimiento });
    const nuevo = { fecha: new Date().toISOString(), para: ult.para, asunto, mensaje: texto, contactId: ult.contactId, conversationId: r.conversationId || ult.conversationId, messageId: r.messageId, pdfUrl: ult.pdfUrl, reenvio: true };
    p.envios.push(nuevo);
    reg.crm.historial.push({ fecha: nuevo.fecha, tipo: 'envio', texto: `Reenviada a ${ult.para || ''}${adjuntos.length ? ' con el PDF' : ''}` });
    await guardarRegistro(reg);
    return json(res, 200, { ok: true });
  }

  json(res, 400, { error: 'Acción no válida' });
}, ['POST', 'GET']);
