// Plantilla del PDF de precios de Empleados IA (misma maqueta que las propuestas de Maroa, DragoPlus y Motorland).
// Compatible con Acrobat: sin degradados, sin transparencias, sin emojis.
import fs from 'node:fs';
import path from 'node:path';

const MARCA_DIR = path.join(process.cwd(), 'api', '_marca');
export const dataUri = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(MARCA_DIR, f)).toString('base64');
let MARCA;
function marca() {
  MARCA ||= { crab: dataUri('mrcrab7-logo.png'), hub: dataUri('hubiabot-logo.png'), wm: dataUri('empleados-ia-wordmark.png') };
  return MARCA;
}

export const NIVELES = { 1: 'Experto', 0.8: 'Sénior', 0.6: 'Semisénior', 0.5: 'Intermedio', 0.4: 'Básico adaptado', 0.3: 'Junior', 0.2: 'Becario' };
export const PLANES = {
  libre: ['Libre', '0 €/mes', '200 créditos · hasta 50 empleados IA · sin ordenador virtual · para probar la plataforma'],
  autonomos: ['Autónomos', '99 €/mes', '10.000 créditos al mes · hasta 50 empleados IA · propietario + 2 invitados · ordenador 2 vCPU · 4 GiB · historial completo y presupuestos por empleado'],
  empresas: ['Empresas', '249 €/mes', '27.500 créditos al mes · hasta 50 empleados IA · propietario + 9 invitados · ordenador 4 vCPU · 8 GiB · departamentos y exportación de auditoría · recargas desde 10 € = 1.000 créditos'],
};

export const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function eur(v) {
  const n = Math.round(v * 100) / 100;
  const s = Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2, useGrouping: 'always' });
  return (n < 0 ? '-' : '') + s + ' €';
}
const coef = (c) => c.toFixed(2).replace('.', ',');
const nivel = (k) => NIVELES[Math.round(k * 10) / 10] || 'Personalizado';
export const fechaES = (d) => d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Atlantic/Canary' });
export const fechaLarga = (d) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Atlantic/Canary' });

export const CSS = `@page{size:A4;margin:0}*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#0b1426;--mut:#56627a;--line:#e3e8f1;--soft:#f4f7fc;--navy:#060913}
html,body{font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--ink);font-size:10.2pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1,h2,h3,.num{font-family:Sora,Inter,sans-serif}
.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}.page:last-child{page-break-after:auto}
.band{background:var(--navy);color:#f7f9ff;padding:14mm 18mm 11mm;border-bottom:2.2mm solid var(--acc)}
.band .top{display:flex;justify-content:space-between;align-items:center}
.band .top img.cl{height:var(--logoh);width:auto;max-width:90mm;object-fit:contain}
.band .top .clbox{background:#fff;border-radius:10px;padding:2.5mm 4mm;display:inline-flex}
.band .top .clbox img.cl{height:calc(var(--logoh) - 14px)}
.band .top img.wm{height:20px;width:auto}
.eyebrow{font-size:8pt;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);font-weight:700}
.band h1{font-size:21pt;line-height:1.2;margin-top:4mm;max-width:155mm;font-weight:700}
.meta{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:7mm}
.meta div{border:1px solid #2a3550;border-radius:10px;padding:3mm 4mm}
.meta span{display:block;font-size:7.4pt;letter-spacing:.1em;text-transform:uppercase;color:#8e9ab3}
.meta b{font-size:9.4pt;font-weight:600}
.content{padding:6.5mm 18mm 0}
.tb.res td{padding:1.6mm 2mm}.tb.res td.e small{margin-top:0}
h2{font-size:13.5pt;margin:0 0 2mm;font-weight:700}
.lead{color:var(--mut);margin-bottom:4mm;font-size:9.4pt}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:0 0 4mm}
.kpi{background:var(--soft);border-radius:12px;padding:4mm 5mm;border:1px solid var(--line)}
.kpi span{font-size:7.6pt;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:600}
.kpi .num{display:block;font-size:17pt;font-weight:700;margin-top:1mm;color:var(--ink);letter-spacing:0;text-transform:none}
.kpi.hl{background:var(--navy);border-color:var(--navy)}.kpi.hl span{color:#8e9ab3}.kpi.hl .num{color:#fff}
.kpi small{display:block;color:var(--mut);font-size:8pt}.kpi.hl small{color:#b6c0d4}
div.kpi .tach{display:block;color:#ff8a94;text-decoration:line-through;font-family:Sora,sans-serif;font-size:12pt;font-weight:600;margin-top:1.5mm;letter-spacing:0;text-transform:none}
.cltxt{font-family:Sora,sans-serif;font-weight:700;font-size:20pt;letter-spacing:.02em;color:#fff}
table{width:100%;border-collapse:collapse}
.tb th{font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);text-align:left;padding:2mm;border-bottom:1.5px solid var(--ink);font-weight:700}
.tb td{padding:2.1mm 2mm;border-bottom:1px solid var(--line);vertical-align:top}
.tb td.n{color:var(--mut);width:7mm;font-weight:600}
.tb td.e b{display:block;font-weight:600}
.tb td.e small{color:var(--mut);font-size:8.2pt;line-height:1.35;display:block;margin-top:.4mm}
.tb .r{text-align:right;white-space:nowrap}.tb td.nv{white-space:nowrap}
.tb tr.cp td{padding:1.55mm 2mm}.tb tr.cp td.e b{display:inline}.tb .dsc{color:var(--mut);font-size:8.2pt}
.pill{display:inline-block;font-size:7.6pt;font-weight:600;padding:.6mm 2.4mm;border-radius:20px;background:var(--accs);color:var(--acc2)}
.tb tr.sum td{border-bottom:none;padding-top:2.6mm;font-weight:600}
.tb tr.adj td{color:var(--mut)}
.tb tr.dto td{color:#c0392b;font-weight:700;background:#fdeeee}
.tb tr.tot td{border:none;background:var(--navy);color:#fff;font-weight:700;font-size:11pt;padding:3.2mm 2mm}
.tb tr.tot td:first-child{border-radius:10px 0 0 10px}.tb tr.tot td:last-child{border-radius:0 10px 10px 0}
.note{font-size:8.3pt;color:var(--mut);margin-top:3mm}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-bottom:6mm}
.box{border:1px solid var(--line);border-radius:12px;padding:4.5mm 5mm}.box h3{font-size:10.5pt;margin-bottom:2mm}
.box ul{list-style:none}.box li{position:relative;padding-left:4.5mm;margin:1.1mm 0;font-size:9.2pt}
.box li:before{content:"";position:absolute;left:0;top:2.1mm;width:2mm;height:2mm;border-radius:50%;background:var(--acc)}
.box.no li:before{background:#c3cbd9}
.plan{display:flex;justify-content:space-between;align-items:center;gap:6mm;background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:4.5mm 5mm;margin-bottom:6mm}
.plan .pp{font-family:Sora,sans-serif;font-size:16pt;font-weight:700;white-space:nowrap}.plan small{display:block;color:var(--mut);font-size:8.4pt}
.pay{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-bottom:5mm}
.pay div{border-top:3px solid var(--acc);background:var(--soft);border-radius:0 0 10px 10px;padding:3.5mm 4mm}
.pay span{font-size:7.4pt;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:700}
.pay b{display:block;font-family:Sora,sans-serif;font-size:12.5pt;margin:.8mm 0}.pay small{color:var(--mut);font-size:8.2pt}
.sign{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:6mm}
.sign div{border-top:1px solid var(--ink);padding-top:2mm;font-size:8.4pt;color:var(--mut);height:22mm}.sign b{color:var(--ink);display:block}
.foot{position:absolute;left:0;right:0;bottom:0;background:var(--navy);color:#b6c0d4;padding:5mm 18mm;display:flex;justify-content:space-between;align-items:center;font-size:7.4pt;gap:8mm}
.foot img{height:24px;width:auto}.foot .logos{display:flex;align-items:center;gap:3mm}.foot .logos .hub{height:15px}
.foot .x{color:#56627a;font-size:9pt}.foot .r{text-align:right;line-height:1.55;font-size:6.6pt;white-space:nowrap}.foot a{color:#b6c0d4;text-decoration:none}`;

export const CORAZON = '<svg width="8" height="7" viewBox="0 0 10 9" style="vertical-align:-1px"><path d="M5 9 0.8 4.8A2.6 2.6 0 0 1 5 1.4a2.6 2.6 0 0 1 4.2 3.4Z" fill="#ff4d5e"/></svg>';

export function calcular(p) {
  const emps = p.empleados || [];
  const sub = Math.round(emps.reduce((a, e) => a + 1000 * e.coef, 0));
  const total = p.precioFinal != null && p.precioFinal !== '' && !isNaN(p.precioFinal) ? Math.round(Number(p.precioFinal) * 100) / 100 : sub;
  const ajuste = Math.round((total - sub) * 100) / 100;
  const descuento = ajuste < -5;
  return { emps, sub, total, ajuste, descuento, media: emps.length ? emps.reduce((a, e) => a + e.coef, 0) / emps.length : 0 };
}

export function construirHTML(p) {
  const M = marca();
  const { emps, sub, total, ajuste, descuento, media } = calcular(p);
  const hoy = p.fecha ? new Date(p.fecha) : new Date();
  const vence = new Date(hoy.getTime() + (Number(p.validezDias) || 15) * 86400000);
  const plan = PLANES[p.plan] || PLANES.autonomos;
  const otros = (p.otros || []).filter((o) => o.nombre);
  const ajusteLabel = descuento ? (p.ajusteLabel || 'Descuento especial (no extensible)') : 'Redondeo comercial';
  const totalLabel = descuento ? 'Total implantación con descuento' : 'Total implantación de empleados de IA';
  const notaDto = descuento ? `Precio especial de ${eur(total)} + IGIC sobre la tarifa de ${eur(sub)}, aplicado solo a esta propuesta y no extensible a otras contrataciones o ampliaciones. ` : '';
  // Paginación del desglose: hasta 12 filas completas en una página; si hay más, perfiles clave (filas completas)
  // y becarios (filas compactas) en páginas propias, troceadas según capacidad.
  const conIdx = emps.map((e, i) => [i + 1, e]);
  const paginasDesglose = [];
  if (emps.length <= 12) paginasDesglose.push({ tipo: 'unica', filas: conIdx });
  else {
    const a = conIdx.filter(([, e]) => e.coef >= 0.3), b = conIdx.filter(([, e]) => e.coef < 0.3);
    const trocear = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
    const compactaA = a.length > 14;
    trocear(a, compactaA ? 24 : 14).forEach((f, i, all) => paginasDesglose.push({ tipo: 'clave', filas: f, compacta: compactaA, ultima: i === all.length - 1, total: a }));
    trocear(b, 24).forEach((f, i, all) => paginasDesglose.push({ tipo: 'becarios', filas: f, compacta: true, ultima: i === all.length - 1, total: b }));
  }
  const NP = 2 + paginasDesglose.length;
  const split = paginasDesglose.length > 1;
  const ref = esc(p.ref || 'MC7-2026-001');

  const foot = (n) => `<div class="foot"><div class="logos"><img src="${M.crab}" alt="Mr Crab 7"><span class="x">×</span><img class="hub" src="${M.hub}" alt="HUB iABOT"></div>
<div class="r">FERAMA SOLUCIONES, S.L. · CIF B-76262815 · C/ Murga 9, 1.º A, 35003 Las Palmas de Gran Canaria<br>
828 120 037 · javier@mrcrab7.com · Propuesta ${ref} · Página ${n} de ${NP} · <a href="https://mrcrab7.com">© MrCrab7 IA ${CORAZON} Canarias</a></div></div>`;

  const fila = (i, e, compacta) => compacta
    ? `<tr class="cp"><td class="n">${String(i).padStart(2, '0')}</td><td class="e"><b>${esc(e.nombre)}</b> <span class="dsc">· ${esc(e.alcance)}</span></td><td class="nv"><span class="pill">${nivel(e.coef)}</span></td><td class="r">${coef(e.coef)}</td><td class="r">${eur(1000 * e.coef)}</td></tr>`
    : `<tr><td class="n">${String(i).padStart(2, '0')}</td><td class="e"><b>${esc(e.nombre)}</b><small>${esc(e.alcance)}</small></td><td class="nv"><span class="pill">${nivel(e.coef)}</span></td><td class="r">${coef(e.coef)}</td><td class="r">${eur(1000 * e.coef)}</td></tr>`;
  const filaAjuste = ajuste ? `<tr class="adj${descuento ? ' dto' : ''}"><td></td><td>${esc(ajusteLabel)}</td><td></td><td></td><td class="r">${eur(ajuste)}</td></tr>` : '';
  const filaTotal = `<tr class="tot"><td></td><td>${totalLabel}</td><td></td><td></td><td class="r">${eur(total)} + IGIC</td></tr>`;
  const cab = '<tr><th></th><th>Empleado de IA y alcance</th><th>Nivel</th><th class="r">Coef.</th><th class="r">Importe</th></tr>';

  const desglose = paginasDesglose.map((pg, idx) => {
    const n = idx + 2;
    let titulo, lead, cuerpo = pg.filas.map(([i, e]) => fila(i, e, pg.compacta)).join('');
    if (pg.tipo === 'unica') {
      titulo = 'Desglose por empleado';
      lead = 'Una línea por empleado: nombre, alcance, nivel de dificultad, coeficiente e importe. La preparación común se reparte entre los puestos, sin cobrar dos veces la misma conexión.';
      cuerpo += `<tr class="sum"><td></td><td>Subtotal · ${emps.length} empleados</td><td></td><td class="r">media ${coef(media)}</td><td class="r">${eur(sub)}</td></tr>${filaAjuste}${filaTotal}`;
    } else {
      const sigue = idx > 0 && paginasDesglose[idx - 1].tipo === pg.tipo ? ' (continuación)' : '';
      titulo = (pg.tipo === 'clave' ? 'Desglose por empleado · perfiles clave' : 'Desglose por empleado · becarios') + sigue;
      lead = pg.tipo === 'clave' ? 'Los puestos con más integraciones y responsabilidad. Una línea por empleado: alcance, nivel, coeficiente e importe.' : 'Tareas acotadas y repetitivas que reutilizan configuraciones ya probadas. Liberan a los perfiles clave y a tu equipo de lo rutinario.';
      if (pg.ultima) {
        const st = pg.total.reduce((s, [, e]) => s + e.coef, 0);
        cuerpo += `<tr class="sum"><td></td><td>Subtotal · ${pg.total.length} ${pg.tipo === 'clave' ? 'perfiles clave' : 'becarios'}</td><td></td><td></td><td class="r">${eur(1000 * st)}</td></tr>`;
      }
      if (idx === paginasDesglose.length - 1) cuerpo += `<tr class="sum"><td></td><td>Total · ${emps.length} empleados de IA</td><td></td><td class="r">media ${coef(media)}</td><td class="r">${eur(sub)}</td></tr>${filaAjuste}${filaTotal}`;
    }
    return `<section class="page dg" data-titulo="${esc(titulo.replace(' (continuación)', ''))}"><div class="content" style="padding-top:14mm"><h2>${titulo}</h2><p class="lead">${lead}</p><table class="tb">${cab}${cuerpo}</table></div>${foot(n)}</section>`;
  }).join('');

  // Resumen de la portada
  let resumen;
  if (otros.length) {
    resumen = `<table class="tb"><tr><th>Piezas de la propuesta</th><th class="r">Importe</th></tr>
<tr><td class="e"><b>Empleados de IA · ${emps.length} puestos</b><small>Desglose por empleado en <span class="rng">${split ? 'las páginas 2 a ' + (NP - 1) : 'la página 2'}</span>.</small></td><td class="r"><b>${eur(total)} + IGIC</b></td></tr>
${otros.map((o) => `<tr><td class="e"><b>${esc(o.nombre)}</b><small>${esc(o.desc || '')}</small></td><td class="r"><b>${esc(o.precio || '')}</b></td></tr>`).join('')}</table>`;
  } else {
    const grupos = new Map();
    for (const e of emps) { const g = grupos.get(e.coef) || [0, []]; g[0]++; g[1].push(e.nombre); grupos.set(e.coef, g); }
    const rr = [...grupos.entries()].sort((x, y) => y[0] - x[0]).map(([k, [n, nombres]]) => `<tr><td class="e"><b>${nivel(k)} · ${coef(k)}</b><small>${esc(nombres.join(', '))}</small></td><td class="r">${n}</td><td class="r">${eur(1000 * k)}</td><td class="r"><b>${eur(1000 * k * n)}</b></td></tr>`).join('');
    const adj = ajuste ? `<tr class="adj${descuento ? ' dto' : ''}"><td>${esc(ajusteLabel)}</td><td></td><td></td><td class="r">${eur(ajuste)}</td></tr>` : '';
    resumen = `<table class="tb res" style="margin-bottom:6mm"><tr><th>Nivel y puestos</th><th class="r">N</th><th class="r">Unitario</th><th class="r">Subtotal</th></tr>${rr}${adj}<tr class="tot"><td>${totalLabel}</td><td class="r">${emps.length}</td><td></td><td class="r">${eur(total)} + IGIC</td></tr></table>`;
  }

  const kpi3 = otros.length
    ? `<div class="kpi"><span>${esc(otros[0].nombre)}</span><span class="num">${esc((otros[0].precio || '').replace(/\s*\+\s*IGIC/i, ''))}</span><small>${/IGIC/i.test(otros[0].precio || '') ? '+ IGIC · ' : ''}se presupuesta aparte</small></div>`
    : `<div class="kpi"><span>Plataforma</span><span class="num">${plan[1]}</span><small>Plan ${plan[0]} · se contrata aparte</small></div>`;

  const logo = p.logo
    ? (p.logoFondo ? `<span class="clbox"><img class="cl" src="${esc(p.logo)}" alt="${esc(p.cliente)}"></span>` : `<img class="cl" src="${esc(p.logo)}" alt="${esc(p.cliente)}">`)
    : `<span class="cltxt">${esc(p.cliente)}</span>`;

  const p1 = `<section class="page"><div class="band"><div class="top">${logo}<img class="wm" src="${M.wm}" alt="Empleados IA"></div>
<p class="eyebrow" style="margin-top:7mm">Propuesta económica · Empleados IA</p>
<h1>${esc(p.titular)}</h1>
<div class="meta"><div><span>Preparada para</span><b>${esc(p.para || p.cliente)}</b></div><div><span>Referencia</span><b>${ref}</b></div><div><span>Fecha · validez</span><b>${fechaES(hoy)}<br>hasta ${fechaES(vence)}</b></div></div></div>
<div class="content"><div class="kpis"><div class="kpi hl"><span>Implantación empleados de IA</span>${descuento ? `<div class="tach">Tarifa ${eur(sub)}</div>` : ''}<span class="num">${eur(total)}</span><small>${descuento ? `+ IGIC · descuento de ${eur(-ajuste)} aplicado` : '+ IGIC · en dos pagos'}</small></div>
<div class="kpi"><span>Empleados de IA</span><span class="num">${emps.length}</span><small>coeficiente medio ${coef(media)}</small></div>${kpi3}</div>
<h2>${otros.length ? 'Resumen de la inversión' : 'Cómo se calcula'}</h2><p class="lead">${esc(p.intro)}</p>${resumen}
</div>${foot(1)}</section>`;

  const half = total / 2;
  const p2 = `<section class="page"><div class="content" style="padding-top:14mm">
<h2>Qué incluye la implantación</h2><p class="lead">Configuración completa de cada puesto, sin cobrar dos veces la misma conexión.</p>
<div class="grid2"><div class="box"><h3>Incluido</h3><ul><li>Perfil, comportamiento, agenda y permisos de cada empleado</li><li>Pantalla de trabajo por empleado en el ordenador virtual</li><li>Hasta 3 aplicaciones existentes conectadas</li><li>Hasta 10 skills o procedimientos prioritarios</li><li>3 reuniones: definición, presentación y ajustes</li><li>Pruebas supervisadas y prueba de aceptación por empleado</li><li>Acceso a la Academia Empleados IA</li></ul></div>
<div class="box no"><h3>No incluido</h3><ul><li>Suscripción y créditos de la plataforma (se contratan directamente)</li><li>Licencias y consumos de terceros</li><li>Integraciones nuevas, a medida o por encima de las 3 incluidas</li><li>Nuevos empleados o funciones: ampliación con la misma fórmula</li><li>Anónimo IA y Auditoría de IA (opcionales)</li></ul></div></div>
<h2>Plataforma</h2><p class="lead">Se contrata directamente en la plataforma y se activa al inicio de la implantación. Sin permanencia.</p>
<div class="plan"><div><b>Plan ${plan[0]}</b><small>${esc(plan[2])}</small></div><div class="pp">${plan[1]}</div></div>
<h2>Forma de pago</h2>
<div class="pay"><div><span>A la firma</span><b>${eur(half)}</b><small>+ IGIC · 50 % · reserva el calendario y activa la definición</small></div><div><span>A la finalización</span><b>${eur(half)}</b><small>+ IGIC · 50 % · al terminar los servicios descritos</small></div><div><span>Permanencia</span><b>Ninguna</b><small>Ampliaciones de puestos o alcance se acuerdan por separado</small></div></div>
<p class="note">${notaDto}${p.nota ? esc(p.nota) + ' ' : ''}Oferta válida ${Number(p.validezDias) || 15} días, hasta el ${fechaLarga(vence)}. El calendario depende de la entrega puntual de accesos, materiales y validaciones. Las tareas sensibles siempre requieren aprobación humana. Empleados IA es una solución tecnológica de HUB iABOT implementada por Mr Crab 7.</p>
<div class="sign"><div><b>Aceptación · ${esc(p.razon || p.cliente)}</b>Nombre, firma y fecha</div><div><b>FERAMA SOLUCIONES, S.L. · Mr Crab 7</b>Firma y fecha</div></div>
</div>${foot(NP)}</section>`;

  const acc = /^#[0-9a-f]{6}$/i.test(p.acento || '') ? p.acento : '#1677ff';
  const { acc2, accs } = derivarAcento(acc);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Precios Empleados IA · ${esc(p.cliente)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sora:wght@600;700&display=swap" rel="stylesheet">
<style>${CSS} :root{--acc:${acc};--acc2:${acc2};--accs:${accs};--logoh:${Number(p.logoAlto) || 56}px}</style></head><body>${p1}${desglose}${p2}</body></html>`;
}

// Tono oscuro y fondo suave a partir del color de marca del cliente.
export function derivarAcento(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const mix = (c, t, f) => Math.round(c + (t - c) * f);
  const h = (r2, g2, b2) => '#' + [r2, g2, b2].map((x) => x.toString(16).padStart(2, '0')).join('');
  return { acc2: h(mix(r, 0, 0.3), mix(g, 0, 0.3), mix(b, 0, 0.3)), accs: h(mix(r, 255, 0.88), mix(g, 255, 0.88), mix(b, 255, 0.88)) };
}
