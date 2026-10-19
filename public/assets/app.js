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

  function nuevoEstado() {
    return { id: 'p' + Date.now(), empleados: [], otros: [], logo: '', logos: [], logoFondo: false, logoAlto: 56, acento: '#1677ff', plan: 'autonomos', validezDias: 15 };
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
    try {
      const r = await fetch('/api/auth?a=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      $('#pw').value = ''; mostrarApp();
    } catch (err) { $('#loginErr').textContent = err.message || 'No se pudo entrar'; }
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
    pintarLogo(); pintarCandidatos(); pintarEmpleados(); pintarOtros(); resumen();
  }

  // ---------- logo ----------
  function pintarLogo() {
    const box = $('#logoPrev');
    box.style.setProperty('--acc', estado.acento || '#1677ff');
    box.innerHTML = '';
    if (!estado.logo) { box.innerHTML = '<span>Sin logo</span>'; return; }
    const img = new Image(); img.src = estado.logo; img.alt = 'Logo del cliente';
    img.style.height = Math.round((estado.logoAlto || 56) * (estado.logoFondo ? 0.75 : 1)) + 'px';
    img.onerror = () => { box.innerHTML = '<span>No se puede mostrar este logo</span>'; };
    if (estado.logoFondo) { const s = document.createElement('span'); s.className = 'clbox'; s.append(img); box.append(s); } else box.append(img);
  }
  function pintarCandidatos() {
    const c = $('#cands'); c.innerHTML = '';
    for (const u of estado.logos || []) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cand' + (u === estado.logo ? ' on' : '');
      b.title = 'Usar este logo';
      const img = new Image(); img.src = u; img.alt = ''; img.loading = 'lazy';
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
      poner('cliente', ia.nombre || (d.titulo || '').split(/[|\-–·]/)[0].trim() || d.nombre);
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
      const d = await api('/api/sugerir', { cliente: estado.cliente, actividad: estado.actividad, sector: estado.sector, tamano: estado.tamano, puntos: estado.puntos, notas: estado.notas, num: estado.num, objetivo: estado.objetivo });
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

  // ---------- inicio ----------
  pintarCampos(); pintarGuardadas();
  fetch('/api/auth?a=me').then((r) => r.json()).then((d) => (d.ok ? mostrarApp() : mostrarLogin())).catch(mostrarLogin);
})();
