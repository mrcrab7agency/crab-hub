// Alta en la Academia Empleados IA tras la firma del contrato:
// 1) crea (o reutiliza) el código de empresa en la academia,
// 2) envía por GHL el email de bienvenida con el enlace a la academia, el código y el calendario de sesiones,
// 3) etiqueta el contacto y pasa la oportunidad a "Ganado" si hay embudo configurado.
// Lo usan /api/alta-academia (editor y CertiMail) y la ficha de Seguimiento (/api/crm, op academia).
import { leer } from './almacen.js';
import { ghl } from './ghl.js';
import { FIRMA_HTML } from './firma.js';
import { codigoEmpresa, URL_ACADEMIA, URL_RESERVA } from './academia.js';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlBienvenida({ nombre, empresa, codigo }) {
  const hola = nombre ? `Hola, ${esc(nombre.split(' ')[0])}:` : 'Hola:';
  const boton = (href, texto, color) => `<a href="${href}" target="_blank" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px">${texto}</a>`;
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2933;max-width:600px">
<p>${hola}</p>
<p>¡Bienvenido a Empleados IA! Gracias por la confianza: con el contrato firmado, arrancamos.</p>
<p>Ya tienes acceso a la <b>Academia Empleados IA</b>, donde tú y tu equipo aprenderéis paso a paso a manejar vuestros empleados de inteligencia artificial, con vídeos cortos y niveles Novel, Junior, Senior y Máster.</p>
<div style="background:#f3f6fb;border:1px solid #dbe4f0;border-radius:10px;padding:18px 20px;margin:18px 0">
<div style="font-size:13px;color:#52606d;text-transform:uppercase;letter-spacing:.06em">Código de empresa · ${esc(empresa)}</div>
<div style="font-size:26px;font-weight:bold;letter-spacing:.08em;color:#0b1b33;margin:6px 0 14px">${esc(codigo)}</div>
<ol style="margin:0 0 14px 18px;padding:0">
<li>Entra en la academia y pulsa «Crear cuenta».</li>
<li>Escribe tu nombre, tu correo y una contraseña.</li>
<li>Pon el código de empresa de arriba. Cualquier persona de tu equipo puede darse de alta con el mismo código.</li>
</ol>
${boton(URL_ACADEMIA, 'Entrar en la Academia', '#1677ff')}
</div>
<p><b>Sesiones de implantación.</b> La puesta en marcha se hace en 4 sesiones, una por semana. Reserva ya la primera en el día y la hora que mejor te vengan:</p>
<p>${boton(URL_RESERVA, 'Reservar sesión', '#ff6a00')}</p>
<p style="font-size:13px;color:#52606d">Si los botones no funcionan: academia ${URL_ACADEMIA} · calendario ${URL_RESERVA}</p>
<p>Cualquier duda, me escribes o me llamas y lo vemos.</p>
<p>Un abrazo,<br>Javi</p>
</div>`;
}

export async function altaAcademia(b = {}) {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Falta un email válido del cliente');
    const empresa = String(b.empresa || '').trim();
    const nombre = String(b.nombre || '').trim();
    const pasos = [];

    const c = await codigoEmpresa(empresa);
    pasos.push(c.nuevo ? `Código de academia creado: ${c.codigo}` : `Código de academia existente: ${c.codigo}`);

    const cfg = await leer('ghl');
    if (!cfg) throw new Error('Conecta primero GHL en Ajustes.');
    const contacto = await ghl(cfg, 'POST', '/contacts/upsert', {
      locationId: cfg.locationId, email, name: nombre || undefined, companyName: empresa || undefined,
      tags: ['cliente-empleados-ia', 'academia-alta'], source: 'Crab Hub · Alta academia',
    });
    const contactId = contacto.contact?.id;
    if (!contactId) throw new Error('GHL no devolvió el contacto');

    const envio = await ghl(cfg, 'POST', '/conversations/messages', {
      type: 'Email', contactId,
      subject: `Bienvenido a Empleados IA · tu acceso a la Academia (${c.empresa})`,
      html: htmlBienvenida({ nombre, empresa: c.empresa, codigo: c.codigo }) + FIRMA_HTML,
      ...(cfg.emailFrom ? { emailFrom: cfg.emailFrom } : {}),
      ...(cfg.cco ? { emailBcc: [cfg.cco] } : {}),
    });
    pasos.push('Email de bienvenida enviado');

    if (cfg.pipelineId && b.ganado !== false) {
      try {
        const etapas = await ghl(cfg, 'GET', `/opportunities/pipelines?locationId=${encodeURIComponent(cfg.locationId)}`);
        const p = (etapas.pipelines || []).find((x) => x.id === cfg.pipelineId);
        const ganado = (p?.stages || []).find((s) => /ganad|won/i.test(s.name));
        await ghl(cfg, 'POST', '/opportunities/upsert', {
          locationId: cfg.locationId, pipelineId: cfg.pipelineId, contactId,
          ...(ganado ? { pipelineStageId: ganado.id } : {}), name: `Empleados IA · ${empresa || email}`, status: 'won',
        });
        pasos.push('Oportunidad marcada como ganada');
      } catch (e) { pasos.push('Oportunidad sin actualizar: ' + e.message); }
    }

  return { ok: true, codigo: c.codigo, empresa: c.empresa, pasos, contactId, conversationId: envio.conversationId, locationId: cfg.locationId };
}
