// Genera el PDF de la propuesta en el servidor (Chromium) con la plantilla de Empleados IA.
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { proteger, cuerpo } from './_lib/core.js';
import { construirHTML } from './_lib/plantilla.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

async function logoComoData(url) {
  if (!url || url.startsWith('data:')) return url;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 CrabHub' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('No se pudo descargar el logo');
  const tipo = (r.headers.get('content-type') || 'image/png').split(';')[0];
  if (!tipo.startsWith('image/')) throw new Error('El enlace del logo no es una imagen');
  const buf = Buffer.from(await r.arrayBuffer());
  return `data:${tipo};base64,${buf.toString('base64')}`;
}

export default proteger(async (req, res) => {
  const p = cuerpo(req);
  if (!p.empleados?.length) { res.status(400).json({ error: 'Añade al menos un empleado de IA' }); return; }
  try { p.logo = await logoComoData(p.logo); } catch { p.logo = ''; }
  const html = construirHTML(p);
  const browser = await puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    const nombre = `Precios_Empleados_IA_${String(p.cliente || 'Cliente').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${nombre}"`);
    res.setHeader('X-Nombre-Archivo', nombre);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(Buffer.from(pdf));
  } finally { await browser.close(); }
});
