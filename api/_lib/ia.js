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
  if (!r.ok) {
    const m = d?.error?.message || '';
    throw new Error(errorIA(m, r.status));
  }
  return d.choices?.[0]?.message?.content || '';
}

function errorIA(m, status) {
  if (/credit card|credit|insufficient|balance|quota/i.test(m))
    return 'falta saldo en Vercel AI Gateway (recarga de crédito en vercel.com > AI Gateway).';
  return m || `La IA respondió ${status}`;
}

// Claude con búsqueda web (API de mensajes de Anthropic a través de AI Gateway).
export async function buscarConClaude({ modelo = 'anthropic/claude-haiku-5.5', sistema, usuario, maxTokens = 2000, maxBusquedas = 4 }) {
  const t = await token();
  if (!t) throw new Error('La IA no está configurada en Vercel (AI Gateway).');
  const r = await fetch('https://ai-gateway.vercel.sh/v1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'x-api-key': t, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      system: sistema,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: maxBusquedas }],
      messages: [{ role: 'user', content: usuario }],
    }),
    signal: AbortSignal.timeout(58000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errorIA(d?.error?.message || '', r.status));
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
}

// Extrae el primer objeto JSON de una respuesta de texto.
export function sacarJSON(txt) {
  const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('La IA no devolvió datos válidos');
  return JSON.parse(txt.slice(s, e + 1));
}
