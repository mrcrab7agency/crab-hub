// Requisitos del cliente para la propuesta: recibe audios y documentos por trozos (límite de 4,5 MB por petición en Vercel),
// los guarda un momento en el Blob privado, la IA los lee o los escucha y devuelve los requisitos extraídos.
// El archivo original se borra en cuanto se procesa.
import { put, get, list, del } from '@vercel/blob';
import { proteger, cuerpo, json } from './_lib/core.js';
import { extraerRequisitos, tipoDe } from './_lib/requisitos-ia.js';

export const config = { api: { bodyParser: { sizeLimit: '4.4mb' } } };
const MAX_MB = 40;
const okId = (s) => /^[a-z0-9-]{8,64}$/i.test(String(s || ''));

async function borrar(id) {
  try { const l = await list({ prefix: `requisitos/${id}/` }); if (l.blobs.length) await del(l.blobs.map((b) => b.url)); } catch {}
}

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  if (b.op === 'trozo') {
    if (!okId(b.id) || !Number.isInteger(b.n) || b.n < 0 || b.n > 40 || !b.datos) return json(res, 400, { error: 'Trozo no válido' });
    await put(`requisitos/${b.id}/${String(b.n).padStart(3, '0')}`, Buffer.from(b.datos, 'base64'), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/octet-stream' });
    return json(res, 200, { ok: true });
  }
  if (b.op === 'procesar') {
    const nombre = String(b.nombre || 'archivo').slice(0, 120);
    if (!tipoDe(nombre, b.mime || '')) return json(res, 400, { error: 'Formato no admitido. Sube audio, PDF, Word (.docx) o texto.' });
    if (!okId(b.id) || !Number.isInteger(b.partes) || b.partes < 1 || b.partes > 40) return json(res, 400, { error: 'Archivo no válido' });
    try {
      const trozos = [];
      for (let i = 0; i < b.partes; i++) {
        const r = await get(`requisitos/${b.id}/${String(i).padStart(3, '0')}`, { access: 'private', useCache: false });
        if (!r?.stream) throw new Error('Falta una parte del archivo; vuelve a subirlo');
        trozos.push(Buffer.from(await new Response(r.stream).arrayBuffer()));
      }
      const buf = Buffer.concat(trozos);
      if (buf.length > MAX_MB * 1024 * 1024) throw new Error(`El archivo supera ${MAX_MB} MB`);
      const out = await extraerRequisitos(buf, nombre, String(b.mime || ''));
      return json(res, 200, { ok: true, nombre, tipo: out.tipo, resumen: String(out.resumen || '').trim().slice(0, 4000) });
    } finally { await borrar(b.id); }
  }
  if (b.op === 'texto') {
    const t = String(b.texto || '').trim();
    if (t.length < 5) return json(res, 400, { error: 'Escribe los requisitos' });
    const out = await extraerRequisitos(Buffer.from(t.slice(0, 80000), 'utf8'), 'notas.txt', 'text/plain');
    return json(res, 200, { ok: true, nombre: 'Notas escritas', tipo: 'texto', resumen: String(out.resumen || '').trim().slice(0, 4000) });
  }
  json(res, 400, { error: 'Acción no válida' });
});
