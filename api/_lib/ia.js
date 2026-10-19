// IA vía Vercel AI Gateway (compatible con la API de OpenAI).
// En Vercel se autentica sola con el token OIDC del proyecto; si existe AI_GATEWAY_API_KEY, se usa esa.
import { env } from './core.js';
import { getVercelOidcToken } from '@vercel/functions/oidc';

const URL_GW = 'https://ai-gateway.vercel.sh/v1/chat/completions';

async function token() {
  if (env('AI_GATEWAY_API_KEY')) return env('AI_GATEWAY_API_KEY');
  try { return await getVercelOidcToken(); } catch { return env('VERCEL_OIDC_TOKEN'); }
}

export async function preguntar({ modelo, sistema, usuario, maxTokens = 2500, temperatura = 0.3 }) {
  const t = await token();
  if (!t) throw new Error('La IA no está configurada en Vercel (AI Gateway).');
  const r = await fetch(URL_GW, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      temperature: temperatura,
      messages: [{ role: 'system', content: sistema }, { role: 'user', content: usuario }],
    }),
    signal: AbortSignal.timeout(55000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `La IA respondió ${r.status}`);
  return d.choices?.[0]?.message?.content || '';
}

// Extrae el primer objeto JSON de una respuesta de texto.
export function sacarJSON(txt) {
  const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('La IA no devolvió datos válidos');
  return JSON.parse(txt.slice(s, e + 1));
}
