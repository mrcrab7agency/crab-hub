// Vídeo demo de Empleados IA (Bunny Stream, librería de la academia) y bloque para los emails de propuesta.
// La librería está protegida: solo se reproduce desde dominios permitidos y con token firmado.
// La página pública /demo firma el token en cada visita, así el enlace del email no caduca nunca.
import crypto from 'node:crypto';
import { env } from './core.js';

export const DEMO = {
  libreria: '776122',
  video: 'e2ead132-b2bf-4f27-aa2c-a80b44590585', // «Demo Larga Empleados IA» (6:16)
  duracion: '6 min',
  url: 'https://app.mrcrab7hub.com/demo',
  miniatura: 'https://app.mrcrab7hub.com/assets/demo-empleados-ia.jpg',
};

// Token de Bunny: SHA256_HEX(clave + idVideo + caducidad)
export function urlReproductor(horas = 6) {
  const clave = env('BUNNY_TOKEN_KEY') || env('BUNNY_API_KEY');
  if (!clave) return '';
  const expires = Math.floor(Date.now() / 1000) + horas * 3600;
  const token = crypto.createHash('sha256').update(clave + DEMO.video + expires).digest('hex');
  return `https://player.mediadelivery.net/embed/${DEMO.libreria}/${DEMO.video}?token=${token}&expires=${expires}&autoplay=false&preload=true&responsive=true`;
}

// Bloque del email: miniatura clicable + enlace de texto (por si el cliente de correo bloquea imágenes).
export const DEMO_HTML = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;max-width:560px;width:100%;font-family:Arial,Helvetica,sans-serif">
<tr><td style="font-size:15px;color:#0b1b33;font-weight:bold;padding-bottom:8px">Antes de hablar, mira cómo trabajan (${DEMO.duracion}):</td></tr>
<tr><td><a href="${DEMO.url}" target="_blank" style="text-decoration:none"><img src="${DEMO.miniatura}" width="560" alt="Ver la demo de Empleados IA (${DEMO.duracion})" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:10px"></a></td></tr>
<tr><td style="padding-top:12px"><a href="${DEMO.url}" target="_blank" style="display:inline-block;background:#1677ff;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:8px;font-size:14px">&#9654; Ver la demo</a></td></tr>
</table>`;
