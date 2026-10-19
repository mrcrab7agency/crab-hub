// Proxy de logos: el navegador ve los logos de la web del cliente sin bloqueos de hotlink.
import { autenticado } from './_lib/core.js';

const PRIVADA = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?|metadata)/i;

export default async (req, res) => {
  if (req.method !== 'GET') return res.status(405).end();
  if (!autenticado(req)) return res.status(401).end();
  let u;
  try { u = new URL(String(req.query.u || '')); } catch { return res.status(400).end(); }
  if (!/^https?:$/.test(u.protocol) || PRIVADA.test(u.hostname)) return res.status(400).end();
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0 CrabHub', Referer: u.origin + '/' }, signal: AbortSignal.timeout(8000) });
    const tipo = (r.headers.get('content-type') || '').split(';')[0];
    if (!r.ok || !tipo.startsWith('image/')) return res.status(404).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 3e6) return res.status(413).end();
    res.setHeader('Content-Type', tipo);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.status(200).send(buf);
  } catch { res.status(502).end(); }
};
