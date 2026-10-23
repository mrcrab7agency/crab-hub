// Plantilla del PDF de propuesta de Reservus IA (misma línea visual que las propuestas de Empleados IA).
// Precios de reservusia.com/precios. Compatible con Acrobat: sin degradados, sin transparencias, sin emojis.
import { CSS, CORAZON, esc, eur, fechaES, fechaLarga, derivarAcento, dataUri } from './plantilla.js';

let MARCA;
function marca() {
  MARCA ||= { crab: dataUri('mrcrab7-logo.png'), rs: dataUri('reservus-logo-blanco.png') };
  return MARCA;
}

export const PLANES_RS = {
  esencial: { nombre: 'Esencial', alta: 990, mensual: 79, sinAlta: 179, minutos: 200, sms: 300, para: 'Negocios con un volumen de llamadas moderado' },
  profesional: { nombre: 'Profesional', alta: 1290, mensual: 149, sinAlta: 249, minutos: 500, sms: 800, para: 'El más elegido: negocios con agenda llena todos los días' },
  premium: { nombre: 'Premium', alta: 1590, mensual: 249, sinAlta: 349, minutos: 1000, sms: 1600, para: 'Varios locales o mucho volumen de reservas' },
};
export const EXTRAS_RS = {
  clientes: { nombre: 'Gestión de clientes', precio: 59, tipo: 'mes', desc: 'Ficha de cada cliente con su historial y mensajes automáticos en cumpleaños, fechas especiales o cuando un cliente deja de venir.' },
  cm: { nombre: 'Community manager', precio: 99, tipo: 'mes', desc: 'Publicaciones y vídeos para Instagram y Facebook con calendario de publicación.' },
  web: { nombre: 'Web con dominio propio', precio: 990, tipo: 'unico', mensual: 29, desc: 'Web rápida y preparada para Google y las IA, con dominio, hosting y correo profesional el primer año.' },
};
export const PAGOS_RS = {
  unico: ['Alta en un pago', 'A la firma'],
  '5050': ['Alta en dos pagos', '50 % a la firma y 50 % en la puesta en marcha'],
  '3pagos': ['Alta en 3 pagos sin intereses', 'A la firma, a los 30 y a los 60 días'],
};

const n2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function calcularReservus(p) {
  const plan = PLANES_RS[p.planRs] || PLANES_RS.profesional;
  const conAlta = p.modalidad !== 'sinalta';
  const altaTarifa = conAlta ? n2(p.alta ?? plan.alta) : 0;
  const altaFinal = conAlta && p.precioAlta != null && p.precioAlta !== '' && !isNaN(p.precioAlta) ? n2(p.precioAlta) : altaTarifa;
  const dto = n2(altaFinal - altaTarifa);
  const descuento = dto < -5;
  const cuota = n2(p.mensual ?? (conAlta ? plan.mensual : plan.sinAlta));
  const ex = p.extras || {};
  const extras = Object.entries(EXTRAS_RS).filter(([k]) => ex[k]?.on).map(([k, d]) => ({ k, ...d, precio: n2(ex[k].precio ?? d.precio) }));
  const unicoExtras = extras.filter((e) => e.tipo === 'unico').reduce((a, e) => a + e.precio, 0);
  const mensualExtras = extras.filter((e) => e.tipo === 'mes').reduce((a, e) => a + e.precio, 0);
  const pagoInicial = n2(altaFinal + unicoExtras);
  const mensual = n2(cuota + mensualExtras);
  const primerAno = n2(pagoInicial + 12 * mensual);
  return { plan, conAlta, altaTarifa, altaFinal, dto, descuento, cuota, extras, unicoExtras, mensualExtras, pagoInicial, mensual, primerAno };
}

const CSS_RS = `.band .top img.rs{height:26px;width:auto}
.inc{columns:2;column-gap:8mm;list-style:none;margin:0 0 5mm}.inc li{break-inside:avoid;position:relative;padding-left:5mm;margin:0 0 1.8mm;font-size:9.2pt}
.inc li:before{content:"";position:absolute;left:0;top:1.9mm;width:2.2mm;height:2.2mm;border-radius:50%;background:var(--acc)}
.inc li b{font-weight:600}
.pl{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:5mm}
.pl th,.pl td{padding:2mm 2.4mm;border-bottom:1px solid var(--line);font-size:9pt;text-align:center}
.pl th{font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:700;border-bottom:1.5px solid var(--ink)}
.pl td:first-child,.pl th:first-child{text-align:left;color:var(--mut)}
.pl .on{background:var(--accs);color:var(--ink);font-weight:700}.pl th.on{color:var(--acc2);border-bottom-color:var(--acc)}
.pl .tag{display:inline-block;margin-left:1.5mm;font-size:6.6pt;background:var(--acc);color:#fff;border-radius:10px;padding:.3mm 1.8mm;letter-spacing:.04em;vertical-align:1px}
.cmp{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:5mm}
.cmp .box.sel{border:1.5px solid var(--acc);background:var(--accs)}.cmp .box h3 small{font-family:Inter,sans-serif;font-weight:600;font-size:7.6pt;color:var(--acc2);margin-left:1.5mm}
.ext td.e small{max-width:120mm}`;

export function construirHTMLReservus(p) {
  const M = marca();
  const c = calcularReservus(p);
  const hoy = p.fecha ? new Date(p.fecha) : new Date();
  const dias = Number(p.validezDias) || 15;
  const vence = new Date(hoy.getTime() + dias * 86400000);
  const ref = esc(p.ref || 'MC7-RIA-2026-001');
  const pago = PAGOS_RS[p.pagoAlta] || PAGOS_RS.unico;
  const NP = 3;
  const etiquetaDto = p.ajusteLabel || 'Descuento especial en el alta (no extensible)';

  const foot = (n) => `<div class="foot"><div class="logos"><img src="${M.crab}" alt="Mr Crab 7"><span class="x">·</span><img class="hub" src="${M.rs}" alt="Reservus IA" style="height:17px"></div>
<div class="r">FERAMA SOLUCIONES, S.L. · CIF B-76262815 · C/ Murga 9, 1.º A, 35003 Las Palmas de Gran Canaria<br>
828 120 037 · javier@mrcrab7.com · Propuesta ${ref} · Página ${n} de ${NP} · <a href="https://mrcrab7.com">© MrCrab7 IA ${CORAZON} Canarias</a></div></div>`;

  const logo = p.logo
    ? (p.logoFondo ? `<span class="clbox"><img class="cl" src="${esc(p.logo)}" alt="${esc(p.cliente)}"></span>` : `<img class="cl" src="${esc(p.logo)}" alt="${esc(p.cliente)}">`)
    : `<span class="cltxt">${esc(p.cliente)}</span>`;

  const titular = p.titular || `Reservus IA para ${p.cliente}: ninguna llamada sin atender y todas las reservas en un solo sitio`;
  const intro = p.intro || `Reservus IA atiende el teléfono y el WhatsApp de ${p.cliente} a cualquier hora, en el idioma de cada cliente, y deja cada reserva apuntada en el calendario con su confirmación por SMS y email. Tu equipo lo gestiona todo desde el panel y la app del móvil.`;

  const incluye = [
    ['Llamadas y WhatsApp atendidos por IA', '24 horas, sin perder ninguna llamada'],
    ['Calendario de reservas', 'y panel para todo el equipo'],
    ['Confirmación por SMS y email', 'a cada cliente, sin trabajo manual'],
    ['App móvil', 'para gestionar las reservas desde cualquier sitio'],
    ['Carta con IA y QR', 'creada a partir de una foto, en varios idiomas'],
    ['Respuesta a reseñas de Google', 'incluida como promoción de lanzamiento'],
    ['Tarjeta en garantía para grupos', 'para reducir las ausencias'],
    ['Todos los idiomas', 'el agente habla con cada cliente en el suyo'],
  ];

  const planes = Object.entries(PLANES_RS);
  const sel = p.planRs in PLANES_RS ? p.planRs : 'profesional';
  const col = (k, v) => `<td class="${k === sel ? 'on' : ''}">${v}</td>`;
  const tablaPlanes = `<table class="pl"><tr><th>Plan</th>${planes.map(([k, x]) => `<th class="${k === sel ? 'on' : ''}">${x.nombre}${k === sel ? '<span class="tag">PROPUESTO</span>' : ''}</th>`).join('')}</tr>
<tr><td>Minutos de voz al mes</td>${planes.map(([k, x]) => col(k, x.minutos.toLocaleString('es-ES', { useGrouping: 'always' }))).join('')}</tr>
<tr><td>SMS al mes</td>${planes.map(([k, x]) => col(k, x.sms.toLocaleString('es-ES', { useGrouping: 'always' }))).join('')}</tr>
<tr><td>Con alta · pago único + cuota</td>${planes.map(([k, x]) => col(k, `${eur(x.alta)} + ${eur(x.mensual)}/mes`)).join('')}</tr>
<tr><td>Sin alta · 12 meses de permanencia</td>${planes.map(([k, x]) => col(k, `${eur(x.sinAlta)}/mes`)).join('')}</tr></table>`;

  const exFilas = c.extras.map((e) => `<tr><td class="e"><b>${esc(e.nombre)}</b><small>${esc(e.desc)}${e.k === 'web' ? ` Desde el segundo año, ${eur(e.mensual)}/mes.` : ''}</small></td><td class="r">${e.tipo === 'unico' ? 'Pago único' : 'Mensual'}</td><td class="r"><b>${eur(e.precio)}${e.tipo === 'mes' ? '/mes' : ''}</b></td></tr>`).join('');

  const kpiInicial = c.conAlta
    ? `<div class="kpi hl"><span>Alta e instalación</span>${c.descuento ? `<div class="tach">Tarifa ${eur(c.altaTarifa)}</div>` : ''}<span class="num">${eur(c.altaFinal)}</span><small>${c.descuento ? `+ IGIC · descuento de ${eur(-c.dto)} aplicado` : '+ IGIC · pago único · sin permanencia'}</small></div>`
    : `<div class="kpi hl"><span>Alta e instalación</span><span class="num">0 €</span><small>Modalidad sin alta · 12 meses de permanencia</small></div>`;

  const p1 = `<section class="page"><div class="band"><div class="top">${logo}<img class="rs" src="${M.rs}" alt="Reservus IA"></div>
<p class="eyebrow" style="margin-top:7mm">Propuesta · Reservus IA</p>
<h1>${esc(titular)}</h1>
<div class="meta"><div><span>Preparada para</span><b>${esc(p.para || p.cliente)}</b></div><div><span>Referencia</span><b>${ref}</b></div><div><span>Fecha · validez</span><b>${fechaES(hoy)}<br>hasta ${fechaES(vence)}</b></div></div></div>
<div class="content"><div class="kpis">${kpiInicial}
<div class="kpi"><span>Cuota mensual</span><span class="num">${eur(c.mensual)}</span><small>+ IGIC · plan ${c.plan.nombre}${c.mensualExtras ? ' y extras' : ''}</small></div>
<div class="kpi"><span>Inversión el primer año</span><span class="num">${eur(c.primerAno)}</span><small>+ IGIC · ${c.pagoInicial ? 'pago inicial y ' : ''}12 cuotas</small></div></div>
<h2>Qué hace Reservus IA por ${esc(p.cliente)}</h2><p class="lead">${esc(intro)}</p>
<ul class="inc">${incluye.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join('')}</ul>
</div>${foot(1)}</section>`;

  const filaDto = c.descuento ? `<tr class="adj dto"><td>${esc(etiquetaDto)}</td><td></td><td class="r">${eur(c.dto)}</td></tr>` : '';
  const desglose = `<table class="tb ext" style="margin-bottom:5mm"><tr><th>Concepto</th><th class="r">Tipo</th><th class="r">Importe</th></tr>
${c.conAlta ? `<tr><td class="e"><b>Alta e instalación · plan ${c.plan.nombre}</b><small>Nuestro equipo instala y configura el agente de voz, el calendario, la carta y los idiomas, crea la ficha de Google si no la tenéis y acompaña la puesta en marcha.</small></td><td class="r">Pago único</td><td class="r"><b>${eur(c.altaTarifa)}</b></td></tr>${filaDto}` : ''}
<tr><td class="e"><b>Cuota Reservus IA · plan ${c.plan.nombre}</b><small>${c.plan.minutos.toLocaleString('es-ES', { useGrouping: 'always' })} minutos de voz y ${c.plan.sms.toLocaleString('es-ES', { useGrouping: 'always' })} SMS al mes, inteligencia artificial, teléfono virtual, plataforma y app.${c.conAlta ? '' : ' Modalidad sin alta: 12 meses de permanencia.'}</small></td><td class="r">Mensual</td><td class="r"><b>${eur(c.cuota)}/mes</b></td></tr>
${exFilas}
<tr class="sum"><td>Pago inicial${c.conAlta ? ' (alta' + (c.unicoExtras ? ' y extras' : '') + ')' : ''}</td><td></td><td class="r">${eur(c.pagoInicial)}</td></tr>
<tr class="sum"><td>Cuota mensual total</td><td></td><td class="r">${eur(c.mensual)}/mes</td></tr>
<tr class="tot"><td>Inversión el primer año</td><td></td><td class="r">${eur(c.primerAno)} + IGIC</td></tr></table>`;

  const comparativa = `<div class="cmp"><div class="box${c.conAlta ? ' sel' : ''}"><h3>Con alta${c.conAlta ? '<small>PROPUESTA</small>' : ''}</h3><ul><li>Instalación y configuración completas por nuestro equipo</li><li>Sin permanencia: aviso de baja con 30 días</li><li>30 días de garantía</li><li>Cuota más baja todos los meses</li></ul></div>
<div class="box${c.conAlta ? ' no' : ' sel'}"><h3>Sin alta${c.conAlta ? '' : '<small>PROPUESTA</small>'}</h3><ul><li>Configuración básica a cargo del cliente</li><li>12 meses de permanencia</li><li>Sin garantía</li><li>Cuota mensual más alta</li></ul></div></div>`;

  const half = c.pagoInicial / 2, tercio = c.pagoInicial / 3;
  const pagoTxt = !c.conAlta && !c.pagoInicial ? '<div><span>Pago inicial</span><b>0 €</b><small>Sin alta</small></div>'
    : p.pagoAlta === '5050' ? `<div><span>A la firma</span><b>${eur(half)}</b><small>+ IGIC · 50 % del pago inicial</small></div><div><span>Puesta en marcha</span><b>${eur(half)}</b><small>+ IGIC · 50 % restante</small></div>`
    : p.pagoAlta === '3pagos' ? `<div><span>3 pagos sin intereses</span><b>${eur(tercio)}</b><small>+ IGIC · a la firma, a los 30 y a los 60 días</small></div><div><span>Total pago inicial</span><b>${eur(c.pagoInicial)}</b><small>+ IGIC · sin intereses</small></div>`
    : `<div><span>A la firma</span><b>${eur(c.pagoInicial)}</b><small>+ IGIC · pago único</small></div><div><span>Puesta en marcha</span><b>Incluida</b><small>Sin pagos adicionales</small></div>`;

  const notaDto = c.descuento ? `Precio especial del alta de ${eur(c.altaFinal)} + IGIC sobre la tarifa de ${eur(c.altaTarifa)}, aplicado solo a esta propuesta. ` : '';
  const p2 = `<section class="page"><div class="content" style="padding-top:14mm">
<h2>Planes</h2><p class="lead">Los tres planes incluyen todas las funciones e idiomas; solo cambian los minutos de voz y los SMS. Sin comisiones por reserva ni por comensal.</p>
${tablaPlanes}
<h2>Inversión</h2><p class="lead">${c.conAlta ? 'Un pago inicial por la instalación y una cuota mensual con todo incluido.' : 'Sin pago inicial: solo la cuota mensual, con 12 meses de permanencia.'} Precios sin impuestos.</p>
${desglose}
</div>${foot(2)}</section>
<section class="page"><div class="content" style="padding-top:14mm">
<h2>Con alta o sin alta</h2>
${comparativa}
<h2>Forma de pago</h2>
<div class="pay">${pagoTxt}<div><span>Cuota mensual</span><b>${eur(c.mensual)}</b><small>+ IGIC · desde la puesta en marcha${c.conAlta ? ' · sin permanencia' : ' · 12 meses'}</small></div></div>
<p class="note">${notaDto}${p.nota ? esc(p.nota) + ' ' : ''}Oferta válida ${dias} días, hasta el ${fechaLarga(vence)}. ${c.conAlta ? 'Sin permanencia: cualquiera de las partes puede darlo de baja avisando con 30 días. Garantía de 30 días desde la puesta en marcha. ' : 'Modalidad sin alta con 12 meses de permanencia, configuración básica a cargo del cliente y sin garantía. '}Reservus IA es un producto de Mr Crab 7.</p>
<div class="sign"><div><b>Aceptación · ${esc(p.razon || p.cliente)}</b>Nombre, firma y fecha</div><div><b>FERAMA SOLUCIONES, S.L. · Mr Crab 7</b>Firma y fecha</div></div>
</div>${foot(3)}</section>`;

  const acc = /^#[0-9a-f]{6}$/i.test(p.acento || '') ? p.acento : '#0073ff';
  const { acc2, accs } = derivarAcento(acc);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Propuesta Reservus IA · ${esc(p.cliente)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
<style>${CSS}${CSS_RS} :root{--acc:${acc};--acc2:${acc2};--accs:${accs};--logoh:${Number(p.logoAlto) || 56}px}</style></head><body>${p1}${p2}</body></html>`;
}
