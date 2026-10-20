// Página pública de la demo de Empleados IA: app.mrcrab7hub.com/demo
// Firma el reproductor de Bunny en cada visita (la clave vive solo en Vercel: BUNNY_TOKEN_KEY).
import { DEMO, urlReproductor } from './_lib/demo.js';

const pagina = (src) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo · Empleados IA</title><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/crab.png">
<style>
@font-face{font-family:Inter;src:url(/assets/fonts/inter.woff2) format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:'Space Grotesk';src:url(/assets/fonts/space-grotesk.woff2) format('woff2');font-weight:300 700;font-display:swap}
*{box-sizing:border-box}html,body{margin:0}
body{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#16346b 0%,#0a1a3a 45%,#060f24 100%);color:#e8eefb;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}
.w{width:100%;max-width:1080px;margin:0 auto;padding:28px 16px 40px;flex:1}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:26px}
header img{height:22px;width:auto}.tag{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8fb3ff;border:1px solid #2a4c8f;border-radius:99px;padding:6px 12px}
h1{font-family:'Space Grotesk',Inter,sans-serif;font-size:clamp(26px,4.4vw,44px);line-height:1.08;margin:0 0 10px;letter-spacing:-.02em}
p.lead{margin:0 0 24px;color:#b7c6e6;font-size:clamp(15px,1.9vw,18px);max-width:680px}
.player{position:relative;padding-top:56.25%;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 30px 80px rgba(0,0,0,.45),0 0 0 1px rgba(143,179,255,.18)}
.player iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.aviso{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:#b7c6e6}
.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;align-items:center}
.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 20px;border-radius:10px;font-weight:600;text-decoration:none;font-size:15px}
.pri{background:#1677ff;color:#fff}.pri:hover{background:#0f63db}.sec{border:1px solid #2a4c8f;color:#e8eefb}.sec:hover{background:rgba(255,255,255,.06)}
footer{text-align:center;font-size:13px;color:#7f91b8;padding:18px 16px 26px}footer a{color:#b7c6e6;text-decoration:none}
</style></head><body><div class="w">
<header><img src="/assets/empleados-ia-wordmark.png" alt="Empleados IA" width="137" height="22"><span class="tag">Demo · ${DEMO.duracion}</span></header>
<h1>Empleados de inteligencia artificial, trabajando en pantalla real</h1>
<p class="lead">Así se encargan las tareas, así responden y así las revisa tu equipo antes de que salga nada. Sin humo: capturas reales de la plataforma.</p>
<div class="player">${src ? `<iframe src="${src}" title="Demo de Empleados IA" loading="lazy" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;fullscreen" allowfullscreen></iframe>` : '<div class="aviso">La demo estará disponible en unos minutos. Si tienes prisa, escríbenos y te la enseñamos en directo.</div>'}</div>
<div class="cta"><a class="btn pri" href="https://api.leadconnectorhq.com/widget/bookings/reunion-mrcrab7" target="_blank" rel="noopener">Agendar una llamada</a><a class="btn sec" href="https://wa.me/34828643217" target="_blank" rel="noopener">Escribir por WhatsApp</a></div>
</div><footer>Empleados IA by HUB iABOT · implantado por <a href="https://mrcrab7.com/" target="_blank" rel="noopener">©🦀MrCrab7 IA❤Canarias</a></footer></body></html>`;

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(pagina(urlReproductor()));
}
