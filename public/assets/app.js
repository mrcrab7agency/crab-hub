// Crab Hub · pestaña Propuestas
(() => {
  const $ = (s) => document.querySelector(s);
  const COEFS = [[1, 'Experto'], [0.8, 'Sénior'], [0.6, 'Semisénior'], [0.5, 'Intermedio'], [0.4, 'Básico adaptado'], [0.3, 'Junior'], [0.2, 'Becario']];
  const nivelDe = (c) => (COEFS.find(([k]) => Math.abs(k - c) < 0.001) || [c, 'Personalizado'])[1];
  const eur = (v) => (Math.round(v * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' }) + ' €';
  const CLAVE = 'crabhub.propuestas.v1';
  const NUMEROS = ['', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho', 'Diecinueve', 'Veinte'];

  let estado = nuevoEstado();
  let pdfUrl = null;
  let ultimoPdf = null;

  function nuevoEstado() {
    return { id: 'p' + Date.now(), empleados: [], otros: [], logo: '', logos: [], logoFondo: false, logoAlto: 56, acento: '#1677ff', plan: 'autonomos', validezDias: 15, requisitos: [] };
  }

  // ---------- utilidades ----------
  function toast(msg, mal) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (mal ? ' bad' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3800);
  }
  async function api(ruta, datos, binario) {
    const r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos || {}), credentials: 'same-origin' });
    if (r.status === 401) { mostrarLogin(); throw new Error('Sesión caducada. Vuelve a entrar.'); }
    if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Error ' + r.status); }
    return binario ? r : r.json();
  }
  function cargando(btn, si, texto) {
    if (si) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spin"></span>${texto}`; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.html; }
  }
  const campos = ['cliente', 'web', 'email', 'cif', 'razon', 'para', 'actividad', 'objetivo', 'num', 'notas', 'titular', 'intro', 'precioFinal', 'plan', 'validez', 'ref', 'ajusteLabel', 'nota'];

  // ---------- acceso ----------
  function mostrarLogin() { $('#app').hidden = true; $('#login').hidden = false; setTimeout(() => $('#pw').focus(), 50); }
  function mostrarApp() { $('#login').hidden = true; $('#app').hidden = false; }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginErr').textContent = '';
    const paso2 = !$('#dosfa').hidden;
    if (paso2 && $('#codigo').value.replace(/\D/g, '').length !== 6) { $('#loginErr').textContent = 'Escribe los 6 dígitos de tu app de verificación'; return; }
    try {
      const r = await fetch('/api/auth?a=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value, codigo: paso2 ? $('#codigo').value : '' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.need2fa) {
        $('#dosfa').hidden = false; $('#pw').readOnly = true;
        if (d.qr) { const im = new Image(); im.src = d.qr; im.alt = 'Código QR de alta del doble factor'; im.width = 180; im.height = 180; $('#qrImg').replaceChildren(im); $('#qr').hidden = false; }
        $('#codigo').focus(); return;
      }
      $('#pw').value = ''; $('#codigo').value = ''; $('#pw').readOnly = false; $('#dosfa').hidden = true; $('#qr').hidden = true; $('#qrImg').innerHTML = '';
      mostrarApp(); vista();
    } catch (err) { $('#loginErr').textContent = err.message || 'No se pudo entrar'; if (paso2) $('#codigo').select(); }
  });
  $('#salir').addEventListener('click', async () => { await fetch('/api/auth?a=logout', { method: 'POST' }); mostrarLogin(); });

  // ---------- formulario <-> estado ----------
  function leerCampos() {
    for (const c of campos) estado[c] = $('#' + c).value;
    estado.validezDias = Number(estado.validez) || 15;
    estado.precioFinal = estado.precioFinal === '' ? null : Number(estado.precioFinal);
  }
  function pintarCampos() {
    for (const c of campos) {
      let v = estado[c];
      if (c === 'validez') v = estado.validezDias || 15;
      if (c === 'precioFinal') v = estado.precioFinal ?? '';
      if (c === 'plan') v = estado.plan || 'autonomos';
      $('#' + c).value = v ?? '';
    }
    $('#logoFondo').checked = !!estado.logoFondo;
    $('#logoAlto').value = estado.logoAlto || 56;
    $('#acento').value = estado.acento || '#1677ff';
    pintarLogo(); pintarCandidatos(); pintarEmpleados(); pintarOtros(); pintarRequisitos(); if (typeof pintarHolded === 'function') pintarHolded(); resumen();
  }

  // ---------- logo ----------
  function pintarLogo() {
    const box = $('#logoPrev');
    box.style.setProperty('--acc', estado.acento || '#1677ff');
    box.innerHTML = '';
    if (!estado.logo) { box.innerHTML = '<span>Sin logo</span>'; return; }
    const img = new Image(); img.src = ver(estado.logo); img.alt = 'Logo del cliente';
    img.style.height = Math.round((estado.logoAlto || 56) * (estado.logoFondo ? 0.75 : 1)) + 'px';
    img.onerror = () => { box.innerHTML = '<span>No se puede mostrar este logo</span>'; };
    if (estado.logoFondo) { const s = document.createElement('span'); s.className = 'clbox'; s.append(img); box.append(s); } else box.append(img);
  }
  function pintarCandidatos() {
    const c = $('#cands'); c.innerHTML = '';
    for (const u of estado.logos || []) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cand' + (u === estado.logo ? ' on' : '');
      b.title = 'Usar este logo';
      const img = new Image(); img.src = ver(u); img.alt = '';
      img.onerror = () => b.remove();
      b.append(img); b.onclick = () => { estado.logo = u; pintarLogo(); pintarCandidatos(); guardar(); };
      c.append(b);
    }
  }
  $('#subirLogo').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2.5e6) return toast('El logo pesa demasiado (máx. 2,5 MB)', true);
    const rd = new FileReader();
    rd.onload = () => { estado.logo = rd.result; estado.logos = [rd.result, ...(estado.logos || []).filter((x) => !x.startsWith('data:'))]; pintarLogo(); pintarCandidatos(); guardar(); };
    rd.readAsDataURL(f);
  });
  $('#logoFondo').addEventListener('change', (e) => { estado.logoFondo = e.target.checked; pintarLogo(); guardar(); });
  $('#logoAlto').addEventListener('input', (e) => { estado.logoAlto = Number(e.target.value); pintarLogo(); });
  $('#acento').addEventListener('input', (e) => { estado.acento = e.target.value; pintarLogo(); guardar(); });

  // ---------- buscar ----------
  $('#btnBuscar').addEventListener('click', async () => {
    leerCampos();
    if (!estado.web && !estado.cliente) return toast('Escribe al menos la web o el nombre del cliente', true);
    const btn = $('#btnBuscar'); cargando(btn, true, 'Buscando…'); $('#estadoBuscar').textContent = 'Leyendo su web y buscando en internet (unos 20 s)';
    try {
      const d = await api('/api/buscar', { web: estado.web, nombre: estado.cliente, cif: estado.cif });
      const ia = d.ia || {};
      const poner = (id, v) => { if (v && !$('#' + id).value.trim()) $('#' + id).value = v; };
      poner('cliente', ia.nombre || (d.titulo || '').replace(/^[^\p{L}\p{N}]+/u, '').split(/[|\-–·]/)[0].trim() || d.nombre);
      poner('web', d.web);
      poner('razon', ia.razon || d.razon);
      poner('cif', (ia.cif || d.cif || '').replace(/[-\s]/g, ''));
      poner('email', ia.email || d.emails?.[0]);
      poner('actividad', ia.actividad || d.descripcion);
      leerCampos();
      estado.sector = ia.sector || ''; estado.tamano = ia.tamano || ''; estado.puntos = ia.puntos_clave || [];
      estado.direccion = ia.direccion || d.direccion || '';
      if (/^#[0-9a-f]{6}$/i.test(d.color || '') && luz(d.color) < 0.75 && luz(d.color) > 0.08) estado.acento = d.color;
      estado.logos = [...new Set([...(estado.logos || []).filter((x) => x.startsWith('data:')), ...(d.logos || [])])];
      if (!estado.logo && estado.logos.length) estado.logo = estado.logos[0];
      if (!estado.ref) estado.ref = refDe(estado.cliente);
      $('#ref').value = estado.ref; $('#acento').value = estado.acento;
      pintarHallazgos(d, ia); pintarLogo(); pintarCandidatos(); guardar();
      $('#estadoBuscar').textContent = d.avisos?.length ? d.avisos.join(' ') : 'Datos encontrados. Revisa y corrige lo que haga falta.';
    } catch (e) { toast(e.message, true); $('#estadoBuscar').textContent = ''; }
    finally { cargando(btn, false); }
  });
  function luz(h) { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; }
  function refDe(nombre) {
    const l = (nombre || 'CLI').normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase();
    return `MC7-${(l.slice(0, 3) || 'CLI').padEnd(3, 'X')}-${new Date().getFullYear()}-001`;
  }
  function pintarHallazgos(d, ia) {
    const h = $('#hallazgos'); const lineas = [];
    if (estado.direccion) lineas.push(`<div><b>Domicilio:</b> ${esc(estado.direccion)}</div>`);
    if (ia.sector || ia.tamano) lineas.push(`<div><b>Sector:</b> ${esc(ia.sector || '—')} · <b>Tamaño:</b> ${esc(ia.tamano || 'sin dato')}</div>`);
    const tel = ia.telefono || d.telefonos?.[0]; if (tel) lineas.push(`<div><b>Teléfono:</b> ${esc(tel)}</div>`);
    if (ia.puntos_clave?.length) lineas.push(`<div><b>Claves del negocio:</b> ${ia.puntos_clave.map(esc).join(' · ')}</div>`);
    const emails = [...new Set([ia.email, ...(d.emails || [])].filter(Boolean))];
    if (emails.length > 1) lineas.push(`<div class="chips">${emails.map((e) => `<button type="button" class="chip" data-email="${esc(e)}">${esc(e)}</button>`).join('')}</div>`);
    const fuentes = (ia.fuentes || []).slice(0, 4);
    if (fuentes.length) lineas.push(`<div><b>Fuentes:</b> ${fuentes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(new URL(u).hostname)}</a>`).join(' · ')}</div>`);
    h.innerHTML = lineas.join(''); h.hidden = !lineas.length;
    h.querySelectorAll('[data-email]').forEach((b) => (b.onclick = () => { $('#email').value = b.dataset.email; guardar(); }));
  }
  const ver = (u) => (u && /^https?:/.test(u) ? '/api/logo?u=' + encodeURIComponent(u) : u);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- empleados ----------
  function pintarEmpleados() {
    const tb = $('#emps tbody'); tb.innerHTML = '';
    if (!estado.empleados.length) { tb.innerHTML = '<tr class="vacio"><td colspan="5">Aún no hay empleados. Pide una propuesta a la IA o añádelos a mano.</td></tr>'; return; }
    estado.empleados.forEach((e, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="n">${String(i + 1).padStart(2, '0')}</td>
        <td><input class="nom" value="${esc(e.nombre)}" aria-label="Puesto"><input class="alc" value="${esc(e.alcance)}" aria-label="Alcance"></td>
        <td><select aria-label="Nivel">${COEFS.map(([k, n]) => `<option value="${k}"${Math.abs(k - e.coef) < 0.001 ? ' selected' : ''}>${n} · ${k.toFixed(1).replace('.', ',')}</option>`).join('')}</select></td>
        <td class="imp r">${eur(1000 * e.coef)}</td>
        <td><button class="del" type="button" aria-label="Quitar empleado">×</button></td>`;
      tr.querySelector('.nom').oninput = (ev) => { e.nombre = ev.target.value; guardar(); };
      tr.querySelector('.alc').oninput = (ev) => { e.alcance = ev.target.value; guardar(); };
      tr.querySelector('select').onchange = (ev) => { e.coef = Number(ev.target.value); tr.querySelector('.imp').textContent = eur(1000 * e.coef); resumen(); guardar(); };
      tr.querySelector('.del').onclick = () => { estado.empleados.splice(i, 1); pintarEmpleados(); resumen(); guardar(); };
      tb.append(tr);
    });
  }
  $('#addEmp').addEventListener('click', () => {
    if (estado.empleados.length >= 50) return toast('Máximo 50 empleados de IA', true);
    estado.empleados.push({ nombre: '', alcance: '', coef: 0.2 }); pintarEmpleados(); resumen(); guardar();
    $('#emps tbody tr:last-child .nom')?.focus();
  });
  $('#btnSugerir').addEventListener('click', async () => {
    leerCampos();
    if (!estado.cliente && !estado.actividad) return toast('Rellena primero el cliente o su actividad', true);
    if (estado.empleados.length && !confirmarReemplazo()) return;
    const btn = $('#btnSugerir'); cargando(btn, true, 'Pensando…'); $('#estadoSugerir').textContent = 'La IA está armando la plantilla con el criterio de precios';
    try {
      const d = await api('/api/sugerir', { cliente: estado.cliente, actividad: estado.actividad, sector: estado.sector, tamano: estado.tamano, puntos: estado.puntos, notas: estado.notas, num: estado.num, objetivo: estado.objetivo, requisitos: (estado.requisitos || []).filter((r) => r.resumen) });
      estado.empleados = d.empleados || [];
      if (d.titular) { estado.titular = d.titular; $('#titular').value = d.titular; }
      if (d.intro) { estado.intro = d.intro; $('#intro').value = d.intro; }
      if (estado.empleados.length > 10 && $('#plan').value === 'autonomos') { $('#plan').value = 'empresas'; estado.plan = 'empresas'; }
      pintarEmpleados(); resumen(); guardar();
      $('#estadoSugerir').textContent = `${estado.empleados.length} empleados propuestos. Ajusta niveles y textos a tu gusto.`;
    } catch (e) { toast(e.message, true); $('#estadoSugerir').textContent = ''; }
    finally { cargando(btn, false); }
  });
  function confirmarReemplazo() {
    const b = $('#btnSugerir');
    if (b.dataset.confirmar === '1') { b.dataset.confirmar = ''; return true; }
    b.dataset.confirmar = '1'; toast('Ya hay empleados. Pulsa otra vez para sustituirlos por la propuesta de la IA.');
    setTimeout(() => (b.dataset.confirmar = ''), 5000); return false;
  }

  // ---------- requisitos del cliente (audios, PDF, Word, notas) ----------
  const TROZO = 3 * 1024 * 1024;
  const ICONO = { audio: 'AUD', pdf: 'PDF', docx: 'DOC', texto: 'TXT' };
  const tipoArchivo = (f) => /^audio\//.test(f.type) || /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac|webm|amr|3gp)$/i.test(f.name) ? 'audio' : /\.pdf$/i.test(f.name) ? 'pdf' : /\.docx$/i.test(f.name) ? 'docx' : /\.(txt|md|csv)$/i.test(f.name) ? 'texto' : '';
  function pintarRequisitos() {
    const ul = $('#reqLista'); ul.innerHTML = '';
    (estado.requisitos || []).forEach((r, i) => {
      const li = document.createElement('li');
      const st = r.error ? `<span class="rq-st bad">${esc(r.error)}</span>` : r.procesando ? `<span class="rq-st"><span class="spin"></span> ${r.tipo === 'audio' ? 'Escuchando…' : 'Leyendo…'}</span>` : '<span class="rq-st">Listo</span>';
      li.innerHTML = `<div class="rq-top"><span class="rq-ico ${r.tipo}">${ICONO[r.tipo] || 'DOC'}</span><span class="rq-n" title="${esc(r.nombre)}">${esc(r.nombre)}</span>${st}<button type="button" aria-label="Quitar">×</button></div>${r.resumen ? `<details><summary>Ver lo que ha entendido la IA</summary><pre>${esc(r.resumen)}</pre></details>` : ''}`;
      li.querySelector('button').onclick = () => { estado.requisitos.splice(i, 1); pintarRequisitos(); guardar(); };
      ul.append(li);
    });
  }
  const aB64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = ko; r.readAsDataURL(blob); });
  async function subirRequisito(f) {
    const tipo = tipoArchivo(f);
    if (!tipo) return toast(`${f.name}: formato no admitido (audio, PDF, Word o texto)`, true);
    if (f.size > 40 * 1024 * 1024) return toast(`${f.name} supera 40 MB`, true);
    estado.requisitos = estado.requisitos || [];
    const item = { nombre: f.name, tipo, procesando: true };
    estado.requisitos.push(item); pintarRequisitos();
    try {
      const id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/[^a-z0-9-]/gi, '');
      const partes = Math.max(1, Math.ceil(f.size / TROZO));
      for (let n = 0; n < partes; n++) await api('/api/requisitos', { op: 'trozo', id, n, datos: await aB64(f.slice(n * TROZO, (n + 1) * TROZO)) });
      const d = await api('/api/requisitos', { op: 'procesar', id, partes, nombre: f.name, mime: f.type || '' });
      Object.assign(item, { resumen: d.resumen, tipo: d.tipo, procesando: false, fecha: new Date().toISOString() });
    } catch (e) { Object.assign(item, { procesando: false, error: e.message || 'No se pudo procesar' }); }
    pintarRequisitos(); guardar();
  }
  const drop = $('#drop');
  drop.addEventListener('click', () => $('#reqFile').click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#reqFile').click(); } });
  $('#reqFile').addEventListener('change', (e) => { [...e.target.files].forEach(subirRequisito); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('on'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('on'); }));
  drop.addEventListener('drop', (e) => [...(e.dataTransfer?.files || [])].forEach(subirRequisito));
  $('#reqAdd').addEventListener('click', async () => {
    const texto = $('#reqTexto').value.trim();
    if (texto.length < 5) return toast('Escribe primero los requisitos', true);
    estado.requisitos = estado.requisitos || [];
    const item = { nombre: 'Notas: ' + texto.slice(0, 50) + (texto.length > 50 ? '…' : ''), tipo: 'texto', procesando: true };
    estado.requisitos.push(item); pintarRequisitos(); $('#reqTexto').value = '';
    try { const d = await api('/api/requisitos', { op: 'texto', texto }); Object.assign(item, { resumen: d.resumen, procesando: false }); }
    catch (e) { Object.assign(item, { procesando: false, error: e.message }); }
    pintarRequisitos(); guardar();
  });

  // ---------- otras piezas ----------
  function pintarOtros() {
    const c = $('#otros'); c.innerHTML = '';
    estado.otros.forEach((o, i) => {
      const d = document.createElement('div'); d.className = 'otro';
      d.innerHTML = `<input class="input" placeholder="Servicio" value="${esc(o.nombre)}"><input class="input" placeholder="Descripción breve" value="${esc(o.desc)}"><input class="input" placeholder="≈ 3.000 € + IGIC" value="${esc(o.precio)}"><button type="button" aria-label="Quitar pieza">×</button>`;
      const [n, de, p] = d.querySelectorAll('input');
      n.oninput = () => { o.nombre = n.value; guardar(); }; de.oninput = () => { o.desc = de.value; guardar(); }; p.oninput = () => { o.precio = p.value; guardar(); };
      d.querySelector('button').onclick = () => { estado.otros.splice(i, 1); pintarOtros(); guardar(); };
      c.append(d);
    });
  }
  $('#addOtro').addEventListener('click', () => { estado.otros.push({ nombre: '', desc: '', precio: '' }); pintarOtros(); });

  // ---------- resumen ----------
  function resumen() {
    const emps = estado.empleados;
    const sub = Math.round(emps.reduce((a, e) => a + 1000 * e.coef, 0));
    const pf = $('#precioFinal').value;
    const total = pf === '' ? sub : Number(pf);
    const aj = total - sub;
    $('#rEmp').textContent = emps.length;
    $('#rMedia').textContent = (emps.length ? emps.reduce((a, e) => a + e.coef, 0) / emps.length : 0).toFixed(2).replace('.', ',');
    $('#rTarifa').innerHTML = aj < -5 ? `<span class="tach">${eur(sub)}</span>` : eur(sub);
    $('#rDtoRow').hidden = !aj;
    $('#rDtoLbl').textContent = aj < -5 ? ($('#ajusteLabel').value || 'Descuento especial') : 'Redondeo';
    $('#rDto').textContent = eur(aj);
    $('#rTotal').textContent = eur(total);
    $('#rPagos').textContent = total ? `${eur(total / 2)} · ${eur(total / 2)}` : '—';
    const g = {}; emps.forEach((e) => (g[nivelDe(e.coef)] = (g[nivelDe(e.coef)] || 0) + 1));
    $('#rNiveles').innerHTML = Object.entries(g).map(([n, c]) => `<span>${c} ${n}</span>`).join('');
  }
  ['precioFinal', 'ajusteLabel'].forEach((id) => $('#' + id).addEventListener('input', resumen));
  campos.forEach((id) => $('#' + id).addEventListener('change', () => { leerCampos(); guardar(); }));

  // ---------- PDF ----------
  $('#btnPdf').addEventListener('click', async () => {
    leerCampos();
    if (!estado.cliente) return toast('Falta el nombre del cliente', true);
    if (!estado.empleados.length) return toast('Añade al menos un empleado de IA', true);
    if (estado.empleados.some((e) => !e.nombre.trim())) return toast('Hay empleados sin nombre de puesto', true);
    if (!estado.titular) { const n = estado.empleados.length; estado.titular = `${NUMEROS[n] || n} empleado${n > 1 ? 's' : ''} de inteligencia artificial para ${estado.cliente}`; $('#titular').value = estado.titular; }
    if (!estado.intro) { estado.intro = 'Cada empleado se presupuesta por separado con la misma fórmula: 1.000 € × coeficiente de dificultad. Los puestos con más reglas e integraciones llevan coeficientes más altos; los de apoyo reutilizan configuraciones ya probadas.'; $('#intro').value = estado.intro; }
    if (!estado.ref) { estado.ref = refDe(estado.cliente); $('#ref').value = estado.ref; }
    const btn = $('#btnPdf'); cargando(btn, true, 'Generando PDF…'); $('#estadoPdf').textContent = 'Maquetando en el servidor (unos segundos)';
    try {
      const datos = { ...estado, para: estado.para || (estado.razon || estado.cliente) + (estado.cif ? ' · CIF ' + estado.cif : ''), logos: undefined };
      const r = await api('/api/pdf', datos, true);
      const nombre = r.headers.get('X-Nombre-Archivo') || 'propuesta.pdf';
      const blob = await r.blob();
      ultimoPdf = { blob, nombre: r.headers.get('X-Nombre-Archivo') || 'propuesta.pdf' };
      $('#enviado').hidden = true;
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      pdfUrl = URL.createObjectURL(blob);
      $('#pdfFrame').src = pdfUrl; $('#visor').hidden = false;
      const a = $('#descargar'); a.href = pdfUrl; a.download = nombre; $('#pdfActions').hidden = false;
      $('#estadoPdf').textContent = 'PDF listo y propuesta guardada.';
      estado.generado = new Date().toISOString(); guardar(true);
      $('#visor').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { toast(e.message, true); $('#estadoPdf').textContent = ''; }
    finally { cargando(btn, false); }
  });
  $('#cerrarVisor').addEventListener('click', () => ($('#visor').hidden = true));

  // ---------- guardado local ----------
  function todas() { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]'); } catch { return []; } }
  function guardar(listar) {
    try {
      const l = todas().filter((p) => p.id !== estado.id);
      l.unshift({ ...estado, editado: new Date().toISOString() });
      localStorage.setItem(CLAVE, JSON.stringify(l.slice(0, 40)));
    } catch {}
    if (listar !== false) pintarGuardadas();
    sincronizar(estado);
  }
  // Copia en el servidor para el seguimiento (con un pequeño retardo para no enviar cada tecla)
  const pendientes = new Map();
  function sincronizar(p, ya) {
    if (p && p.id && (p.cliente || (p.empleados || []).length)) pendientes.set(p.id, { ...p, logos: undefined, editado: new Date().toISOString() });
    if (!pendientes.size) return Promise.resolve();
    clearTimeout(sincronizar.t);
    const enviar = async () => {
      const lote = [...pendientes.values()]; pendientes.clear();
      for (const x of lote) { try { await api('/api/crm', { op: 'guardar', p: x }); } catch {} }
    };
    if (ya) return enviar();
    sincronizar.t = setTimeout(enviar, 1500);
  }
  function pintarGuardadas() {
    const s = $('#guardadas');
    s.innerHTML = '<option value="">Propuestas guardadas…</option>' + todas().filter((p) => p.cliente).map((p) => `<option value="${p.id}">${esc(p.cliente)} · ${new Date(p.editado).toLocaleDateString('es-ES')}</option>`).join('');
  }
  $('#guardadas').addEventListener('change', (e) => {
    const p = todas().find((x) => x.id === e.target.value); if (!p) return;
    estado = { ...nuevoEstado(), ...p }; pintarCampos(); $('#hallazgos').hidden = true; $('#visor').hidden = true; $('#pdfActions').hidden = true;
    e.target.value = ''; toast('Propuesta de ' + p.cliente + ' cargada');
  });
  $('#nueva').addEventListener('click', () => {
    estado = nuevoEstado(); pintarCampos(); $('#hallazgos').hidden = true; $('#visor').hidden = true; $('#pdfActions').hidden = true;
    $('#estadoBuscar').textContent = ''; $('#estadoSugerir').textContent = ''; $('#cliente').focus();
  });


  // ---------- vistas ----------
  function vista() {
    const v = ['#ajustes', '#seguimiento'].includes(location.hash) ? location.hash.slice(1) : 'propuestas';
    $('#propuestas').hidden = v !== 'propuestas'; $('#ajustes').hidden = v !== 'ajustes'; $('#seguimiento').hidden = v !== 'seguimiento';
    $('#navPropuestas').classList.toggle('on', v === 'propuestas'); $('#navAjustes').classList.toggle('on', v === 'ajustes'); $('#navSeguimiento').classList.toggle('on', v === 'seguimiento');
    if (v !== 'seguimiento') cerrarDrawer();
    if (v === 'ajustes') { cargarAjustes(); estadoHolded(); }
    if (v === 'seguimiento') cargarCrm(true);
  }
  window.addEventListener('hashchange', vista);

  // ---------- ajustes GHL ----------
  let embudosGhl = [];
  async function cargarAjustes() {
    $('#estadoGhl').textContent = 'Comprobando…';
    try {
      const r = await fetch('/api/ajustes', { credentials: 'same-origin' });
      if (r.status === 401) return mostrarLogin();
      pintarAjustes(await r.json());
    } catch { $('#estadoGhl').textContent = 'No se pudo comprobar la conexión.'; }
  }
  function pintarAjustes(d) {
    const g = d.ghl || {};
    const e = $('#estadoGhl');
    e.className = 'estado-ghl' + (g.conectado ? ' ok' : '');
    e.textContent = g.conectado ? `Conectado a ${g.nombreCuenta || 'GHL'} · llave ${g.llave}` : 'Sin conectar';
    if (d.aviso) e.textContent += ' · ' + d.aviso;
    if (g.locationId) $('#ghlLoc').value = g.locationId;
    $('#ghlGuardar').textContent = g.conectado ? 'Cambiar llave' : 'Conectar GHL';
    embudosGhl = d.embudos || [];
    $('#ghlOpciones').hidden = !g.conectado;
    $('#ghlPipe').innerHTML = '<option value="">Sin oportunidad</option>' + embudosGhl.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
    $('#ghlPipe').value = g.pipelineId || '';
    pintarEtapas(g.stageId);
    $('#ghlFrom').value = g.emailFrom || ''; $('#ghlCco').value = g.cco || '';
  }
  function pintarEtapas(sel) {
    const p = embudosGhl.find((x) => x.id === $('#ghlPipe').value);
    $('#ghlStage').innerHTML = (p ? p.etapas : []).map((s) => `<option value="${esc(s.id)}">${esc(s.nombre)}</option>`).join('');
    if (sel) $('#ghlStage').value = sel;
    $('#ghlStage').disabled = !p;
  }
  $('#ghlPipe').addEventListener('change', () => pintarEtapas());
  $('#ghlGuardar').addEventListener('click', async () => {
    const token = $('#ghlToken').value.trim(), locationId = $('#ghlLoc').value.trim();
    if (!token || !locationId) return toast('Pega la llave y el ID de la subcuenta', true);
    const b = $('#ghlGuardar'); cargando(b, true, 'Comprobando…');
    try { const d = await api('/api/ajustes', { token, locationId }); $('#ghlToken').value = ''; pintarAjustes(d); toast('GHL conectado'); }
    catch (e) { toast(e.message, true); } finally { cargando(b, false); }
  });
  $('#ghlGuardarOpc').addEventListener('click', async () => {
    const b = $('#ghlGuardarOpc'); cargando(b, true, 'Guardando…');
    try { const d = await api('/api/ajustes', { pipelineId: $('#ghlPipe').value, stageId: $('#ghlStage').value, emailFrom: $('#ghlFrom').value, cco: $('#ghlCco').value }); pintarAjustes(d); toast('Opciones guardadas'); }
    catch (e) { toast(e.message, true); } finally { cargando(b, false); }
  });

  // ---------- enviar por GHL ----------
  function abrirModal() {
    if (!ultimoPdf) return toast('Genera primero el PDF', true);
    leerCampos();
    $('#mgPara').value = estado.email || '';
    $('#mgNombre').value = estado.contactoNombre || '';
    $('#mgAsunto').value = `Propuesta de empleados de inteligencia artificial · ${estado.cliente}`;
    $('#mgMensaje').value = `Hola${estado.contactoNombre ? ' ' + estado.contactoNombre : ''},\n\nTe adjunto la propuesta económica de empleados de inteligencia artificial para ${estado.cliente}, con el detalle de cada puesto, la forma de pago y las condiciones.\n\nSi te encaja, la aceptamos y arrancamos con la reunión de definición. Cualquier duda, me dices y lo vemos.\n\nUn saludo,`;
    $('#mgAdjunto').textContent = 'Adjunto: ' + ultimoPdf.nombre;
    $('#modalGhl').hidden = false; $('#mgPara').focus();
  }
  const cerrarModal = () => ($('#modalGhl').hidden = true);
  $('#btnGhl').addEventListener('click', abrirModal);
  $('#mgCerrar').addEventListener('click', cerrarModal);
  $('#mgCancelar').addEventListener('click', cerrarModal);
  $('#modalGhl').addEventListener('click', (e) => { if (e.target.id === 'modalGhl') cerrarModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modalGhl').hidden) cerrarModal(); });
  const aBase64 = (blob) => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ko; r.readAsDataURL(blob); });
  $('#mgEnviar').addEventListener('click', async () => {
    const para = $('#mgPara').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) return toast('Revisa el email del cliente', true);
    const b = $('#mgEnviar'); cargando(b, true, 'Enviando…');
    try {
      const total = estado.precioFinal ?? Math.round(estado.empleados.reduce((a, e) => a + 1000 * e.coef, 0));
      const d = await api('/api/enviar-ghl', {
        email: para, contacto: $('#mgNombre').value.trim(), empresa: estado.razon || estado.cliente, web: estado.web,
        asunto: $('#mgAsunto').value, mensaje: $('#mgMensaje').value, importe: total,
        pdf: await aBase64(ultimoPdf.blob), nombreArchivo: ultimoPdf.nombre,
      });
      estado.email = para; estado.contactoNombre = $('#mgNombre').value.trim(); $('#email').value = para;
      estado.enviado = { fecha: new Date().toISOString(), contactId: d.contactId, conversationId: d.conversationId };
      estado.envios = [...(estado.envios || []), { fecha: estado.enviado.fecha, para, asunto: $('#mgAsunto').value, mensaje: $('#mgMensaje').value, contactId: d.contactId, conversationId: d.conversationId, messageId: d.messageId, pdfUrl: d.pdfUrl || '' }];
      guardar();
      cerrarModal();
      const enlace = d.conversationId ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(d.locationId)}/conversations/conversations/${encodeURIComponent(d.conversationId)}` : '';
      $('#enviado').innerHTML = `<b>Enviada por GHL</b><span>${d.pasos.map(esc).join(' · ')}</span>${enlace ? `<a href="${enlace}" target="_blank" rel="noopener">Ver la conversación en GHL ↗</a>` : ''}`;
      $('#enviado').hidden = false;
      toast('Propuesta enviada a ' + para);
    } catch (e) { toast(e.message, true); }
    finally { cargando(b, false); }
  });

  // ---------- alta en la academia (tras la firma) ----------
  $('#btnAcademia').addEventListener('click', async () => {
    leerCampos();
    const email = ($('#email').value || estado.email || '').trim();
    const empresa = estado.razon || estado.cliente;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast('Pon el email del cliente en el paso 1', true);
    if (!empresa) return toast('Falta el nombre del cliente', true);
    if (!confirm(`¿Dar de alta a ${empresa} en la Academia y enviar el email de bienvenida a ${email}?`)) return;
    const b = $('#btnAcademia'); cargando(b, true, 'Dando de alta…');
    try {
      const d = await api('/api/alta-academia', { email, nombre: estado.contactoNombre || '', empresa });
      estado.academia = { codigo: d.codigo, fecha: new Date().toISOString() }; guardar();
      const enlace = d.conversationId ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(d.locationId)}/conversations/conversations/${encodeURIComponent(d.conversationId)}` : '';
      $('#academiaOk').innerHTML = `<b>Alta en la Academia · código ${esc(d.codigo)}</b><span>${d.pasos.map(esc).join(' · ')}</span>${enlace ? `<a href="${enlace}" target="_blank" rel="noopener">Ver el email en GHL ↗</a>` : ''}`;
      $('#academiaOk').hidden = false; toast('Bienvenida enviada a ' + email);
    } catch (e) { toast(e.message, true); } finally { cargando(b, false); }
  });

  // ---------- Holded (cliente y facturas en borrador) ----------
  function pintarHolded() {
    const h = estado.holded || {};
    const partes = [];
    if (h.contactId) partes.push('Cliente en Holded ✓');
    if (h.firma) partes.push(`Factura firma en borrador · ${eur(h.firma.importe)} + IGIC`);
    if (h.final) partes.push(`Factura final en borrador · ${eur(h.final.importe)} + IGIC`);
    $('#hdEstado').className = 'hb-estado';
    $('#hdEstado').innerHTML = partes.length ? partes.map((x) => `<b>${esc(x)}</b>`).join('<br>') + '<br><a href="https://app.holded.com/sales/revenue" target="_blank" rel="noopener">Abrir ventas en Holded ↗</a>' : 'Las facturas se crean en borrador: las numeras y emites tú en Holded.';
  }
  const datosHolded = () => { leerCampos(); return { cliente: estado.cliente, razon: estado.razon, cif: estado.cif, email: ($('#email').value || estado.email || '').trim(), direccion: estado.direccion, ref: estado.ref, empleados: estado.empleados.map((e) => ({ nombre: e.nombre })) }; };
  const totalPropuesta = () => { const pf = $('#precioFinal').value; return pf === '' ? Math.round(estado.empleados.reduce((a, e) => a + 1000 * e.coef, 0)) : Number(pf); };
  async function accionHolded(btn, op, tramo) {
    const p = datosHolded();
    if (!p.razon && !p.cliente) return toast('Falta el cliente', true);
    if (op === 'factura') {
      if (!estado.empleados.length) return toast('La propuesta no tiene empleados', true);
      if (estado.holded?.[tramo] && !confirm('Ya creaste esa factura en borrador. ¿Crear otra igualmente?')) return;
      if (!p.cif && !confirm('El cliente no tiene CIF. ¿Crear la factura igualmente?')) return;
    }
    cargando(btn, true, 'Holded…');
    try {
      const d = await api('/api/holded', { op, tramo, total: totalPropuesta(), propuesta: p });
      estado.holded = { ...(estado.holded || {}), contactId: d.contactId };
      if (op === 'factura') estado.holded[d.tramo] = { docId: d.docId, importe: d.importe, fecha: new Date().toISOString() };
      guardar(); pintarHolded();
      toast(op === 'cliente' ? (d.nuevo ? 'Cliente creado en Holded' : 'El cliente ya existía en Holded') : `Factura en borrador creada · ${eur(d.importe)} + IGIC${d.igic ? '' : ' (revisa el impuesto en Holded)'}`);
    } catch (e) { $('#hdEstado').className = 'hb-estado bad'; $('#hdEstado').textContent = e.message; toast(e.message, true); }
    finally { cargando(btn, false); }
  }
  $('#hdCliente').addEventListener('click', () => accionHolded($('#hdCliente'), 'cliente'));
  $('#hdFirma').addEventListener('click', () => accionHolded($('#hdFirma'), 'factura', 'firma'));
  $('#hdFinal').addEventListener('click', () => accionHolded($('#hdFinal'), 'factura', 'final'));
  async function estadoHolded() {
    try { const d = await api('/api/holded', { op: 'estado' }); $('#estadoHd').className = 'estado-ghl' + (d.conectado ? ' ok' : ''); $('#estadoHd').textContent = d.conectado ? `Conectado a Holded · llave ${d.llave}` : 'Sin conectar'; $('#hdGuardar').textContent = d.conectado ? 'Cambiar API key' : 'Conectar Holded'; }
    catch { $('#estadoHd').textContent = 'No se pudo comprobar la conexión.'; }
  }
  $('#hdGuardar').addEventListener('click', async () => {
    const key = $('#hdKey').value.trim();
    if (!key) return toast('Pega la API key de Holded', true);
    const b = $('#hdGuardar'); cargando(b, true, 'Comprobando…');
    try { await api('/api/holded', { op: 'conectar', key }); $('#hdKey').value = ''; await estadoHolded(); toast('Holded conectado'); }
    catch (e) { toast(e.message, true); } finally { cargando(b, false); }
  });

  // ---------- seguimiento (mini CRM) ----------
  const ESTADOS = [
    ['solicitud', 'Solicitudes', 'Creada, sin enviar', '#8A8D91'],
    ['enviada', 'Enviadas', 'Salió de GHL', '#0866FF'],
    ['entregada', 'Recibidas', 'Entregada en su buzón', '#1078A8'],
    ['abierta', 'Abiertas', 'El cliente la abrió', '#B26A00'],
    ['respondida', 'Respondidas', 'Hay respuesta del cliente', '#7A3EC8'],
    ['ganada', 'Ganadas', 'Contrato firmado', '#31A24C'],
    ['perdida', 'Perdidas', 'Descartadas', '#E41E3F'],
  ];
  const NOMBRE_EST = Object.fromEntries(ESTADOS.map(([k, , d]) => [k, d])); NOMBRE_EST.error = 'Email no entregado';
  const ETIQ = { solicitud: 'Solicitud', enviada: 'Enviada', entregada: 'Recibida', abierta: 'Abierta', respondida: 'Respondida', ganada: 'Ganada', perdida: 'Perdida', error: 'No entregada' };
  const EMAIL_EST = { opened: 'Abierto', clicked: 'Abierto y con clic', read: 'Leído', delivered: 'Entregado', sent: 'Enviado', accepted: 'Enviado', queued: 'En cola', failed: 'Falló', bounced: 'Rebotado', undelivered: 'No entregado', rejected: 'Rechazado' };
  let crm = { items: [], filtro: 'todas', q: '', locationId: '', abierto: null };
  const fecha = (f) => (f ? new Date(f).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-');
  const fechaHora = (f) => (f ? new Date(f).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const hace = (f) => { if (!f) return '-'; const m = (Date.now() - Date.parse(f)) / 6e4; if (m < 60) return `hace ${Math.max(1, Math.round(m))} min`; if (m < 1440) return `hace ${Math.round(m / 60)} h`; const d = Math.round(m / 1440); return d < 31 ? `hace ${d} d` : fecha(f); };
  const enlaceGhl = (conv) => (conv && crm.locationId ? `https://app.gohighlevel.com/v2/location/${encodeURIComponent(crm.locationId)}/conversations/conversations/${encodeURIComponent(conv)}` : '');

  async function migrarLocales() {
    try {
      if (localStorage.getItem('crabhub.crm.migrado')) return;
      for (const p of todas()) {
        if (!p.cliente) continue;
        if (p.enviado && !(p.envios || []).length) p.envios = [{ fecha: p.enviado.fecha, para: p.email || '', asunto: '', mensaje: '', contactId: p.enviado.contactId, conversationId: p.enviado.conversationId }];
        await api('/api/crm', { op: 'guardar', p: { ...p, logos: undefined } }).catch(() => {});
      }
      localStorage.setItem('crabhub.crm.migrado', '1');
    } catch {}
  }

  async function cargarCrm(refrescar) {
    if (!crm.items.length) $('#crmFilas').innerHTML = '<tr><td colspan="7" class="hint">Cargando…</td></tr>';
    try {
      await sincronizar(null, true);
      const d = await api('/api/crm', { op: 'listar', refrescar: !!refrescar });
      crm.items = d.items || []; crm.locationId = d.locationId || '';
      pintarCrm();
      if (refrescar && !d.ghl) toast('Conecta GHL en Ajustes para ver aperturas y respuestas', true);
    } catch (e) { toast(e.message, true); }
  }

  function pintarCrm() {
    const its = crm.items;
    const cuenta = (k) => its.filter((x) => x.estado === k || (k === 'enviada' && x.estado === 'error')).length;
    const enviadas = its.filter((x) => x.envios);
    const abiertas = enviadas.filter((x) => x.abierto || ['respondida', 'ganada'].includes(x.estado) && x.respuestas);
    const enJuego = its.filter((x) => !['ganada', 'perdida'].includes(x.estado)).reduce((a, x) => a + (x.total || 0), 0);
    const ganado = its.filter((x) => x.estado === 'ganada').reduce((a, x) => a + (x.total || 0), 0);
    $('#crmKpis').innerHTML = ESTADOS.map(([k, n, d, c]) => `<button class="kpi${crm.filtro === k ? ' on' : ''}" data-f="${k}" style="--c:${c}" type="button"><span>${n}</span><b>${cuenta(k)}</b><small>${d}</small></button>`).join('')
      + `<div class="kpi dato" style="--c:#B26A00"><span>Tasa de apertura</span><b>${enviadas.length ? Math.round((abiertas.length / enviadas.length) * 100) : 0} %</b><small>${abiertas.length} de ${enviadas.length} enviadas</small></div>`
      + `<div class="kpi dato" style="--c:#0866FF"><span>En juego</span><b>${eur(enJuego)}</b><small>Ganado: ${eur(ganado)}</small></div>`;
    $('#crmTabs').innerHTML = [['todas', 'Todas', its.length], ...ESTADOS.map(([k, n]) => [k, n, cuenta(k)])].map(([k, n, c]) => `<button type="button" role="tab" data-f="${k}" class="${crm.filtro === k ? 'on' : ''}" aria-selected="${crm.filtro === k}">${n}<i>${c}</i></button>`).join('');
    const q = crm.q.toLowerCase();
    const filas = its.filter((x) => (crm.filtro === 'todas' || x.estado === crm.filtro || (crm.filtro === 'enviada' && x.estado === 'error')) && (!q || `${x.cliente} ${x.razon} ${x.email} ${x.ref}`.toLowerCase().includes(q)));
    $('#crmFilas').innerHTML = filas.map((x) => `<tr data-id="${esc(x.id)}" tabindex="0">
      <td><div class="cli">${x.logo ? `<img src="${esc(x.logo)}" alt="">` : `<span class="ini">${esc((x.cliente || '?')[0].toUpperCase())}</span>`}<div><b>${esc(x.cliente || 'Sin nombre')}</b><small>${esc(x.email || x.ref || '')}</small></div></div></td>
      <td><span class="est ${x.estado}" title="${esc(NOMBRE_EST[x.estado] || '')}">${ETIQ[x.estado] || x.estado}</span></td>
      <td class="r"><b>${eur(x.total || 0)}</b><br><span class="mut">${x.empleados} empleado${x.empleados === 1 ? '' : 's'}</span></td>
      <td class="mut">${x.ultimoEnvio ? fecha(x.ultimoEnvio) + (x.envios > 1 ? ` · ${x.envios} envíos` : '') : '-'}</td>
      <td class="mut">${x.abierto ? fechaHora(x.abierto) : x.envios ? 'Aún no' : '-'}</td>
      <td>${x.respuestas || '-'}${x.noLeidas ? `<span class="nuevo">${x.noLeidas} nueva${x.noLeidas > 1 ? 's' : ''}</span>` : ''}</td>
      <td class="mut">${hace(x.actividad)}</td></tr>`).join('');
    $('#crmVacio').hidden = !!filas.length;
    $('#crmVacio').textContent = its.length ? 'No hay propuestas en este estado.' : 'Todavía no hay propuestas. Se añaden solas al generar o enviar una.';
    const nl = its.reduce((a, x) => a + (x.noLeidas || 0), 0);
    $('#navNoLeidas').hidden = !nl; $('#navNoLeidas').textContent = nl;
  }
  const filtrar = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; crm.filtro = crm.filtro === b.dataset.f && b.classList.contains('kpi') ? 'todas' : b.dataset.f; pintarCrm(); };
  $('#crmKpis').addEventListener('click', filtrar);
  $('#crmTabs').addEventListener('click', filtrar);
  $('#crmBuscar').addEventListener('input', (e) => { crm.q = e.target.value.trim(); pintarCrm(); });
  $('#crmRefrescar').addEventListener('click', async () => { const b = $('#crmRefrescar'); cargando(b, true, 'Consultando GHL…'); try { await cargarCrm(true); toast('Estados actualizados'); } finally { cargando(b, false); } });
  $('#crmFilas').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) abrirDrawer(tr.dataset.id); });
  $('#crmFilas').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-id]'); if (tr) abrirDrawer(tr.dataset.id); } });

  // Ficha de una propuesta
  async function abrirDrawer(id) {
    $('#crmDrawer').hidden = false; $('#dwTitulo').textContent = 'Cargando…'; $('#dwSub').textContent = '';
    ['#dwRespuestas', '#dwEnvios', '#dwHistorial'].forEach((s) => ($(s).innerHTML = ''));
    $('#dwReenvio').hidden = true; $('#rsTexto').value = ''; $('#rsInstr').value = '';
    try {
      const d = await api('/api/crm', { op: 'detalle', id });
      if (d.locationId) crm.locationId = d.locationId;
      crm.abierto = d.reg; pintarDrawer();
      if ((d.reg.crm?.respuestas || []).some((r) => !r.leida)) api('/api/crm', { op: 'leidas', id }).then(() => { const it = crm.items.find((x) => x.id === id); if (it) { it.noLeidas = 0; pintarCrm(); } }).catch(() => {});
    } catch (e) { toast(e.message, true); cerrarDrawer(); }
  }
  function cerrarDrawer() { $('#crmDrawer').hidden = true; crm.abierto = null; }
  function pintarDrawer() {
    const r = crm.abierto; if (!r) return;
    const p = r.p || {}; const c = r.crm || {}; const envios = p.envios || []; const ult = envios[envios.length - 1];
    $('#dwTitulo').innerHTML = `${esc(p.cliente || 'Sin nombre')} <span class="est ${r.estado}">${ETIQ[r.estado] || r.estado}</span>`;
    $('#dwSub').textContent = [p.razon && p.razon !== p.cliente ? p.razon : '', p.ref, eur(r.total || 0) + ' + IGIC', `${(p.empleados || []).length} empleados`].filter(Boolean).join(' · ');
    const logo = /^(https?:|data:image)/.test(p.logo || '') ? p.logo : '';
    $('#dwLogo').hidden = !logo; if (logo) $('#dwLogo').src = logo;
    const cerrada = ['ganada', 'perdida'].includes(c.cierre?.estado);
    $('#dwGanada').hidden = cerrada; $('#dwPerdida').hidden = cerrada; $('#dwReabrir').hidden = !cerrada;
    $('#dwReenviar').hidden = !ult?.contactId;
    const link = enlaceGhl(ult?.conversationId); $('#dwGhl').hidden = !link; if (link) $('#dwGhl').href = link;
    const resp = c.respuestas || [];
    $('#dwRespuestas').innerHTML = resp.length ? resp.slice().reverse().map((x, i) => `<div class="resp${x.leida ? '' : ' nueva'}"><small>${fechaHora(x.fecha)}${x.asunto ? ' · ' + esc(x.asunto) : ''}${x.leida ? '' : ' · nueva'}</small>${esc(x.texto || '(sin texto)')}<br><button class="btn sm" type="button" data-resp="${resp.length - 1 - i}">Responder con IA</button></div>`).join('')
      : `<p class="hint">${envios.length ? 'El cliente aún no ha respondido. Si responde al email, aparece aquí al actualizar.' : 'Esta propuesta todavía no se ha enviado.'}</p>`;
    $('#dwEnvios').innerHTML = envios.length ? envios.slice().reverse().map((e) => `<div class="env"><div><b>${esc(e.asunto || 'Propuesta')}</b>${e.reenvio ? ' <span class="hint">(reenvío)</span>' : ''}<small>${fechaHora(e.fecha)} · ${esc(e.para || '')}${e.abierto ? ' · abierto el ' + fechaHora(e.abierto) : ''}</small></div><span class="est ${['opened', 'clicked', 'read'].includes(e.estadoEmail) ? 'abierta' : e.estadoEmail === 'delivered' ? 'entregada' : ['failed', 'bounced', 'undelivered', 'rejected'].includes(e.estadoEmail) ? 'error' : 'enviada'}">${EMAIL_EST[e.estadoEmail] || 'Enviado'}</span></div>`).join('') : '<p class="hint">Sin envíos. Genera el PDF y envíala por GHL desde el editor.</p>';
    const tl = [...(c.historial || []).map((h) => ({ ...h }))];
    envios.forEach((e) => e.abierto && tl.push({ fecha: e.abierto, tipo: 'abierta', texto: 'El cliente abrió el email' }));
    resp.forEach((x) => tl.push({ fecha: x.fecha, tipo: 'cliente', texto: 'Respuesta del cliente: ' + (x.texto || '').slice(0, 140) + ((x.texto || '').length > 140 ? '…' : '') }));
    if (p.academia) tl.push({ fecha: p.academia.fecha, tipo: 'ganada', texto: 'Alta en la Academia · código ' + (p.academia.codigo || '') });
    if (p.holded?.firma) tl.push({ fecha: p.holded.firma.fecha, tipo: 'nota', texto: 'Factura de firma en Holded (borrador) · ' + eur(p.holded.firma.importe) });
    tl.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    $('#dwHistorial').innerHTML = tl.map((h) => `<li class="${esc(h.tipo)}">${esc(h.texto)}<small>${fechaHora(h.fecha)}</small></li>`).join('') || '<li>Sin movimientos</li>';
  }
  $('#dwCerrar').addEventListener('click', cerrarDrawer);
  $('#crmDrawer').addEventListener('click', (e) => { if (e.target.id === 'crmDrawer') cerrarDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#crmDrawer').hidden) cerrarDrawer(); });
  const accionCrm = async (btn, datos, txt, ok) => {
    cargando(btn, true, txt);
    try { const d = await api('/api/crm', { id: crm.abierto.id, ...datos }); if (ok) toast(ok); return d; }
    catch (e) { toast(e.message, true); return null; } finally { cargando(btn, false); }
  };
  const recargarFicha = async () => { const id = crm.abierto?.id; await cargarCrm(false); if (id) await abrirDrawer(id); };
  $('#dwAbrir').addEventListener('click', () => {
    const p = crm.abierto?.p; if (!p) return;
    const local = todas().find((x) => x.id === p.id);
    estado = { ...nuevoEstado(), ...p, ...(local ? { logos: local.logos, logo: local.logo || p.logo } : {}), envios: p.envios };
    pintarCampos(); $('#hallazgos').hidden = true; $('#visor').hidden = true; $('#pdfActions').hidden = true;
    cerrarDrawer(); location.hash = '#propuestas'; toast('Propuesta de ' + (p.cliente || '') + ' abierta en el editor');
  });
  $('#dwGanada').addEventListener('click', async () => { if (await accionCrm($('#dwGanada'), { op: 'marcar', estado: 'ganada' }, 'Guardando…', 'Marcada como ganada')) recargarFicha(); });
  $('#dwPerdida').addEventListener('click', async () => {
    const motivo = prompt('¿Por qué se ha perdido? (opcional)'); if (motivo === null) return;
    if (await accionCrm($('#dwPerdida'), { op: 'marcar', estado: 'perdida', motivo }, 'Guardando…', 'Marcada como perdida')) recargarFicha();
  });
  $('#dwReabrir').addEventListener('click', async () => { if (await accionCrm($('#dwReabrir'), { op: 'marcar', estado: 'reabrir' }, 'Guardando…', 'Propuesta reabierta')) recargarFicha(); });
  $('#dwBorrar').addEventListener('click', async () => {
    if (!confirm('¿Quitar esta propuesta del seguimiento? No se borra de GHL ni del editor.')) return;
    if (await accionCrm($('#dwBorrar'), { op: 'borrar' }, 'Quitando…', 'Quitada del seguimiento')) { cerrarDrawer(); cargarCrm(false); }
  });
  $('#dwNotaOk').addEventListener('click', async () => {
    const texto = $('#dwNota').value.trim(); if (!texto) return;
    if (await accionCrm($('#dwNotaOk'), { op: 'nota', texto }, '…')) { $('#dwNota').value = ''; recargarFicha(); }
  });
  $('#dwNota').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#dwNotaOk').click(); });
  $('#dwReenviar').addEventListener('click', () => {
    const p = crm.abierto?.p || {}; const ult = (p.envios || []).slice(-1)[0] || {};
    $('#rvAsunto').value = ult.asunto || `Propuesta de empleados de inteligencia artificial · ${p.cliente || ''}`;
    $('#rvTexto').value = ult.mensaje || `Hola,\n\nTe reenvío la propuesta de empleados de inteligencia artificial para ${p.cliente || 'vosotros'} por si se quedó perdida entre los correos.\n\nCualquier duda me dices y lo vemos.\n\nUn saludo,`;
    $('#rvAdj').textContent = ult.pdfUrl ? 'Se adjunta de nuevo el PDF de la propuesta.' : 'No tengo el PDF guardado de ese envío: sale solo el texto. Si quieres adjuntarlo, ábrela en el editor y envíala desde allí.';
    $('#dwReenvio').hidden = false; $('#rvTexto').focus();
  });
  $('#rvCancelar').addEventListener('click', () => ($('#dwReenvio').hidden = true));
  $('#rvEnviar').addEventListener('click', async () => {
    const p = crm.abierto?.p || {}; const ult = (p.envios || []).slice(-1)[0] || {};
    if (!confirm(`¿Reenviar la propuesta a ${ult.para || 'el cliente'}?`)) return;
    if (await accionCrm($('#rvEnviar'), { op: 'reenviar', asunto: $('#rvAsunto').value, texto: $('#rvTexto').value }, 'Reenviando…', 'Propuesta reenviada')) recargarFicha();
  });
  async function borradorIA(mensaje) {
    const b = $('#rsIA');
    const d = await accionCrm(b, { op: 'ia-respuesta', mensaje, instrucciones: $('#rsInstr').value.trim() }, 'Redactando…');
    if (d?.texto) { $('#rsTexto').value = d.texto; $('#rsTexto').focus(); toast('Borrador listo: revísalo antes de enviar'); }
  }
  $('#rsIA').addEventListener('click', () => borradorIA());
  $('#dwRespuestas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-resp]'); if (!b) return;
    const x = (crm.abierto?.crm?.respuestas || [])[Number(b.dataset.resp)];
    $('#rsTexto').scrollIntoView({ behavior: 'smooth', block: 'center' }); borradorIA(x?.texto || '');
  });
  $('#rsEnviar').addEventListener('click', async () => {
    const texto = $('#rsTexto').value.trim(); if (texto.length < 5) return toast('Escribe la respuesta', true);
    const p = crm.abierto?.p || {}; const ult = (p.envios || []).slice(-1)[0] || {};
    if (!ult.contactId) return toast('Esta propuesta aún no se ha enviado por GHL', true);
    if (!confirm(`¿Enviar la respuesta a ${ult.para || 'el cliente'}?`)) return;
    if (await accionCrm($('#rsEnviar'), { op: 'responder', texto }, 'Enviando…', 'Respuesta enviada')) { $('#rsTexto').value = ''; $('#rsInstr').value = ''; recargarFicha(); }
  });

  // ---------- inicio ----------
  pintarCampos(); pintarGuardadas();
  fetch('/api/auth?a=me').then((r) => r.json()).then((d) => { if (d.ok) { mostrarApp(); vista(); migrarLocales().then(() => location.hash !== '#seguimiento' && api('/api/crm', { op: 'listar' }).then((x) => { crm.items = x.items || []; crm.locationId = x.locationId || ''; pintarCrm(); }).catch(() => {})); } else mostrarLogin(); }).catch(mostrarLogin);
})();
