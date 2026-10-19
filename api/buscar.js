// Busca datos del cliente: lee su web (nombre, contacto, logo, colores) y completa con búsqueda de IA en internet.
import { proteger, cuerpo, json } from './_lib/core.js';
import { buscarConClaude, sacarJSON } from './_lib/ia.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';

function normalizarWeb(w) {
  if (!w) return '';
  w = w.trim();
  if (!/^https?:\/\//i.test(w)) w = 'https://' + w;
  try { return new URL(w).toString(); } catch { return ''; }
}

const limpiar = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();

function meta(html, attr, val) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${val}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag ? limpiar(tag.match(/content=["']([^"']*)["']/i)?.[1] || '') : '';
}

function abs(u, base) { try { return new URL(u, base).toString(); } catch { return ''; } }

function leerWeb(html, base) {
  const out = { logos: [], emails: [], telefonos: [], redes: [] };
  out.titulo = limpiar(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  out.descripcion = meta(html, 'name', 'description') || meta(html, 'property', 'og:description');
  out.nombre = meta(html, 'property', 'og:site_name');
  out.color = meta(html, 'name', 'theme-color');

  // JSON-LD (Organization / LocalBusiness)
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = JSON.parse(m[1].trim());
      const items = [].concat(raw['@graph'] || raw).flat();
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const tipo = [].concat(it['@type'] || []).join(' ');
        if (!/Organization|LocalBusiness|Store|Dealer|Corporation|Restaurant|Agency|Service/i.test(tipo)) continue;
        out.nombre ||= it.name || '';
        out.razon ||= it.legalName || '';
        out.cif ||= it.taxID || it.vatID || '';
        const lg = typeof it.logo === 'string' ? it.logo : it.logo?.url;
        if (lg) out.logos.push(abs(lg, base));
        if (it.telephone) out.telefonos.push(String(it.telephone));
        if (it.email) out.emails.push(String(it.email).replace(/^mailto:/, ''));
        const a = it.address;
        if (a && typeof a === 'object') out.direccion ||= [a.streetAddress, a.postalCode, a.addressLocality].filter(Boolean).join(', ');
        if (Array.isArray(it.sameAs)) out.redes.push(...it.sameAs);
      }
    } catch {}
  }

  // Imágenes con pinta de logo
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo|brand|marca/i.test(tag)) continue;
    const src = tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1];
    if (src && !src.startsWith('data:')) out.logos.push(abs(src, base));
  }
  for (const m of html.matchAll(/<link\b[^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*>/gi)) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (href) out.logos.push(abs(href, base));
  }
  const og = meta(html, 'property', 'og:image');
  if (og) out.logos.push(abs(og, base));

  const texto = limpiar(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' '));
  out.emails.push(...(html.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).filter((e) => !/\.(png|jpe?g|webp|svg|gif)$/i.test(e) && !/sentry|wixpress|example|domain/i.test(e)));
  out.telefonos.push(...(texto.match(/(?:\+34\s?)?[6789]\d{2}[\s.]?\d{2,3}[\s.]?\d{2,3}[\s.]?\d{0,3}/g) || []).map((t) => t.trim()).filter((t) => t.replace(/\D/g, '').length >= 9));
  out.cif ||= texto.match(/\b[ABCDEFGHJNPQRSUVW][-\s]?\d{7}[0-9A-J]\b/)?.[0]?.replace(/[-\s]/g, '') || '';
  for (const m of html.matchAll(/href=["'](https?:\/\/(?:www\.)?(?:facebook|instagram|linkedin|tiktok|youtube|x|twitter)\.com\/[^"'?#]+)/gi)) out.redes.push(m[1]);
  out.texto = texto.slice(0, 3500);

  const uniq = (a) => [...new Set(a.filter(Boolean))];
  out.logos = uniq(out.logos).slice(0, 8);
  out.emails = uniq(out.emails.map((e) => e.toLowerCase())).slice(0, 4);
  out.telefonos = uniq(out.telefonos).slice(0, 3);
  out.redes = uniq(out.redes).slice(0, 6);
  return out;
}

async function buscarEnInternet({ nombre, web, cif, pista }) {
  const sistema = 'Eres un analista que localiza datos públicos de empresas españolas. Responde solo con JSON válido. Si un dato no aparece en fuentes fiables, déjalo vacío: no inventes nada.';
  const usuario = `Busca datos públicos de esta empresa de España (Canarias si aplica):
Nombre: ${nombre || '-'}
Web: ${web || '-'}
CIF: ${cif || '-'}
Contexto de su web: ${pista || '-'}

Devuelve JSON con estas claves:
{"nombre":"nombre comercial","razon":"razón social exacta con S.L./S.A.","cif":"","direccion":"domicilio","actividad":"a qué se dedica en una frase","sector":"una o dos palabras","tamano":"plantilla aproximada si se conoce","telefono":"","email":"","web":"","redes":["url"],"puntos_clave":["3 a 5 rasgos del negocio útiles para proponer empleados de IA"],"fuentes":["url"]}`;
  const txt = await buscarConClaude({ sistema, usuario, maxTokens: 2000 });
  return sacarJSON(txt);
}

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  const web = normalizarWeb(b.web);
  const resultado = { web, avisos: [] };

  if (web) {
    try {
      const r = await fetch(web, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' }, redirect: 'follow', signal: AbortSignal.timeout(9000) });
      const html = await r.text();
      Object.assign(resultado, leerWeb(html, r.url || web));
      resultado.web = r.url || web;
    } catch (e) {
      resultado.avisos.push('No se pudo leer la web directamente.');
    }
  }

  try {
    resultado.ia = await buscarEnInternet({
      nombre: b.nombre || resultado.nombre || resultado.titulo,
      web: resultado.web, cif: b.cif || resultado.cif,
      pista: (resultado.descripcion || '') + ' ' + (resultado.texto || '').slice(0, 1200),
    });
  } catch (e) {
    resultado.avisos.push('Búsqueda en internet no disponible: ' + e.message);
  }

  delete resultado.texto;
  json(res, 200, resultado);
});
