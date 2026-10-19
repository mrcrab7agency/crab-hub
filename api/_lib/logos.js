// Logos de clientes para el seguimiento: busca el logo en la web del cliente y lo guarda en el Blob privado.
import { put, get } from '@vercel/blob';
import { buscarConClaude } from './ia.js';

const PRIVADA = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|metadata)/i;
const GENERICOS = /^(gmail|googlemail|hotmail|outlook|live|yahoo|icloud|me|msn|aol|proton|protonmail|gmx|telefonica|movistar)\./i;
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 CrabHub' };
const ruta = (id) => `crm-logo/${id}`;

export function tipoImagen(buf) {
  const h = buf.subarray(0, 16);
  if (h[0] === 0x89 && h[1] === 0x50) return 'image/png';
  if (h[0] === 0xff && h[1] === 0xd8) return 'image/jpeg';
  if (h.toString('ascii', 0, 4) === 'RIFF' && h.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (h.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
  const ini = buf.subarray(0, 600).toString('utf8').trim().toLowerCase();
  if (ini.startsWith('<svg') || (ini.startsWith('<?xml') && ini.includes('<svg'))) return 'image/svg+xml';
  if (h[0] === 0 && h[1] === 0 && h[2] === 1 && h[3] === 0) return 'image/x-icon';
  return '';
}

function urlSegura(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) && !PRIVADA.test(x.hostname) ? x : null; } catch { return null; }
}

export async function descargarImagen(u) {
  const x = urlSegura(u); if (!x) return null;
  try {
    const r = await fetch(x, { headers: { ...UA, Referer: x.origin + '/' }, signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    const tipo = tipoImagen(buf);
    if (!tipo || buf.length < 300 || buf.length > 2.5e6) return null;
    return { buf, tipo };
  } catch { return null; }
}

// Dominio de la web del cliente: la web indicada, el dominio del email (si no es genérico) o una búsqueda.
export async function sitioDe({ web, email, cliente, razon }) {
  if (web) { const x = urlSegura(/^https?:/i.test(web) ? web : 'https://' + web); if (x) return x.origin; }
  const dom = String(email || '').split('@')[1];
  if (dom && !GENERICOS.test(dom)) return 'https://' + dom;
  if (!cliente && !razon) return '';
  try {
    const t = await buscarConClaude({ sistema: 'Respondes solo con una URL, sin nada más.', usuario: `¿Cuál es la web oficial de la empresa "${razon || cliente}"${razon && cliente && razon !== cliente ? ` (nombre comercial ${cliente})` : ''}, en Canarias (España)? Responde solo con la URL de su página principal, o NO si no la encuentras.`, maxTokens: 300, maxBusquedas: 2 });
    const m = t.match(/https?:\/\/[^\s"'<>)]+/i);
    return m ? (urlSegura(m[0])?.origin || '') : '';
  } catch { return ''; }
}

export async function buscarLogo(sitio) {
  const base = urlSegura(sitio); if (!base) return null;
  let html = '', final = base;
  for (const u of [base.href, base.href.replace('://', '://www.')]) {
    try {
      const r = await fetch(u, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(9000) });
      if (r.ok) { html = (await r.text()).slice(0, 600000); final = new URL(r.url); break; }
    } catch {}
  }
  if (!html) return null;
  const abs = (s) => { try { return new URL(s.replace(/&amp;/g, '&'), final).href; } catch { return ''; } };
  const attr = (tag, n) => (tag.match(new RegExp(`\\b${n}\\s*=\\s*["']([^"']+)["']`, 'i')) || [])[1] || '';
  const cands = [];
  const tags = html.match(/<img\b[^>]*>/gi) || [];
  // 1) imágenes que se llaman o se marcan como logo (cabecera primero)
  for (const t of tags) {
    const src = attr(t, 'src') || attr(t, 'data-src') || (attr(t, 'srcset').split(/\s+/)[0] || '');
    if (src && /logo/i.test(t) && !/data:/.test(src)) cands.push(abs(src));
    if (cands.length > 4) break;
  }
  // 2) og:image si parece un logo, 3) iconos grandes, 4) og:image
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const og = metas.map((m) => (/og:image(?!:)/i.test(m) ? attr(m, 'content') : '')).filter(Boolean);
  og.filter((u) => /logo/i.test(u)).forEach((u) => cands.push(abs(u)));
  const links = html.match(/<link\b[^>]*>/gi) || [];
  links.filter((l) => /apple-touch-icon/i.test(attr(l, 'rel'))).forEach((l) => cands.push(abs(attr(l, 'href'))));
  links.filter((l) => /\bicon\b/i.test(attr(l, 'rel')) && /(\.svg|\.png|192|180|512)/i.test(attr(l, 'href'))).forEach((l) => cands.push(abs(attr(l, 'href'))));
  og.forEach((u) => cands.push(abs(u)));
  const vistos = new Set();
  for (const u of cands) {
    if (!u || vistos.has(u)) continue; vistos.add(u);
    const img = await descargarImagen(u);
    if (img) return { ...img, origen: u };
    if (vistos.size >= 7) break;
  }
  return null;
}

export async function guardarLogo(id, { buf, tipo }) {
  await put(ruta(id), buf, { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: tipo });
}

export async function leerLogo(id) {
  try {
    const r = await get(ruta(id), { access: 'private', useCache: false });
    if (!r?.stream) return null;
    const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
    return { buf, tipo: tipoImagen(buf) || 'application/octet-stream' };
  } catch { return null; }
}
