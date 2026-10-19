// Lee los materiales del cliente (audio, PDF, Word o texto) y extrae los requisitos útiles para la propuesta.
import { inflateRawSync } from 'node:zlib';
import { token } from './ia.js';

const GW = 'https://ai-gateway.vercel.sh/v1';

const PROMPT = `Eres analista de Mr Crab 7. Del material de un cliente (reunión, nota de voz o documento) extrae solo lo útil para diseñar su propuesta de empleados de inteligencia artificial.
Devuelve en español de España, con guiones, máximo 25 líneas y sin inventar nada:
- Necesidades y problemas que cuenta.
- Procesos y tareas que quiere cubrir (lo más concreto posible).
- Volúmenes: tiendas, sedes, personas, clientes, mensajes, pedidos…
- Herramientas y aplicaciones que usa hoy.
- Prioridades, plazos y presupuesto si los menciona.
- Frases literales clave entre comillas, si las hay.
Texto plano: sin asteriscos, negritas ni almohadillas. Si algo no aparece, no lo pongas. No incluyas datos personales sensibles (DNI, cuentas, salud).`;

async function autorizado() {
  const t = await token();
  if (!t) throw new Error('La IA no está configurada en Vercel (AI Gateway).');
  return t;
}

function errorIA(d, status) {
  const m = d?.error?.message || d?.message || '';
  if (/credit|insufficient|balance|quota/i.test(m)) return 'falta saldo en Vercel AI Gateway.';
  return m || `La IA respondió ${status}`;
}

// Audio: Gemini escucha la grabación y extrae los requisitos en una sola pasada.
async function desdeAudio(buf, mime, nombre) {
  const t = await autorizado();
  const r = await fetch(`${GW}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-3.8-flash',
      input: [{ role: 'user', content: [
        { type: 'input_text', text: PROMPT + '\nEs una grabación de audio: escúchala entera antes de resumir.' },
        { type: 'input_file', filename: nombre || 'audio', file_data: `data:${mime || 'audio/mpeg'};base64,${buf.toString('base64')}` },
      ] }],
    }),
    signal: AbortSignal.timeout(280000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errorIA(d, r.status));
  if (d.output_text) return d.output_text;
  return (d.output || []).flatMap((o) => o.content || []).filter((c) => c.type === 'output_text').map((c) => c.text).join('\n');
}

// PDF o texto: Claude Haiku lee el documento.
async function conClaude(contenido) {
  const t = await autorizado();
  const r = await fetch(`${GW}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'x-api-key': t, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'anthropic/claude-haiku-5.5', max_tokens: 1500, messages: [{ role: 'user', content: contenido }] }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errorIA(d, r.status));
  return (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// Word (.docx): se saca el texto de word/document.xml sin dependencias.
export function textoDocx(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El archivo Word no es válido');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let k = 0; k < total; k++) {
    const metodo = buf.readUInt16LE(p + 10), comp = buf.readUInt32LE(p + 20);
    const ln = buf.readUInt16LE(p + 28), le = buf.readUInt16LE(p + 30), lc = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + ln);
    if (nombre === 'word/document.xml') {
      const ini = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const datos = buf.subarray(ini, ini + comp);
      const xml = (metodo === 8 ? inflateRawSync(datos) : datos).toString('utf8');
      return xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/\n{3,}/g, '\n\n').trim();
    }
    p += 46 + ln + le + lc;
  }
  throw new Error('No encuentro el texto dentro del Word');
}

export function tipoDe(nombre = '', mime = '') {
  const n = nombre.toLowerCase();
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|oga|opus|aac|flac|webm|amr|3gp)$/.test(n)) return 'audio';
  if (mime === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (mime.startsWith('text/') || /\.(txt|md|csv)$/.test(n)) return 'texto';
  return '';
}

const MIME_AUDIO = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', flac: 'audio/flac', webm: 'audio/webm', amr: 'audio/amr', '3gp': 'audio/3gpp' };

export async function extraerRequisitos(buf, nombre, mime) {
  const tipo = tipoDe(nombre, mime);
  if (tipo === 'audio') {
    const ext = nombre.toLowerCase().split('.').pop();
    return { tipo, resumen: await desdeAudio(buf, mime && mime.startsWith('audio/') ? mime : MIME_AUDIO[ext] || 'audio/mpeg', nombre) };
  }
  if (tipo === 'pdf') {
    return { tipo, resumen: await conClaude([{ type: 'text', text: PROMPT }, { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buf.toString('base64') } }]) };
  }
  if (tipo === 'docx' || tipo === 'texto') {
    const txt = (tipo === 'docx' ? textoDocx(buf) : buf.toString('utf8')).slice(0, 80000);
    if (txt.trim().length < 5) throw new Error('El documento no tiene texto que leer');
    return { tipo, resumen: await conClaude([{ type: 'text', text: `${PROMPT}\n\nMaterial del cliente («${nombre}»):\n"""\n${txt}\n"""` }]) };
  }
  throw new Error('Formato no admitido. Sube audio, PDF, Word (.docx) o texto.');
}
