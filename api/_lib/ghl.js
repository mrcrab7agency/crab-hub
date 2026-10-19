// Cliente mínimo de la API v2 de GoHighLevel (LeadConnector) con una Private Integration Token.
const BASE = 'https://services.leadconnectorhq.com';

export async function ghl(cfg, metodo, ruta, cuerpo, extra = {}) {
  const headers = { Authorization: `Bearer ${cfg.token}`, Version: '2021-07-28', Accept: 'application/json', ...(extra.headers || {}) };
  let body;
  if (cuerpo instanceof FormData) body = cuerpo;
  else if (cuerpo) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(cuerpo); }
  const r = await fetch(BASE + ruta, { method: metodo, headers, body, signal: AbortSignal.timeout(25000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = Array.isArray(d.message) ? d.message.join(', ') : d.message || d.error || `GHL respondió ${r.status}`;
    const e = new Error(m); e.status = r.status; throw e;
  }
  return d;
}

export async function embudos(cfg) {
  const d = await ghl(cfg, 'GET', `/opportunities/pipelines?locationId=${encodeURIComponent(cfg.locationId)}`);
  return (d.pipelines || []).map((p) => ({ id: p.id, nombre: p.name, etapas: (p.stages || []).map((s) => ({ id: s.id, nombre: s.name })) }));
}
