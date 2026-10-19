// Propone la plantilla de empleados de IA con el criterio de precios de Mr Crab 7 (política Hub Bot v1.0).
import { proteger, cuerpo, json } from './_lib/core.js';
import { preguntar, sacarJSON } from './_lib/ia.js';

const COEFS = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2];

const SISTEMA = `Eres consultor sénior de Mr Crab 7 (La Buena IA) y preparas propuestas de "empleados de inteligencia artificial" (plataforma HUB iABOT).
Criterio de precio, obligatorio:
- Cada empleado se presupuesta en una línea: 1.000 € × coeficiente de dificultad.
- Coeficientes permitidos: 1.0 experto (procesos críticos con varias integraciones), 0.8 sénior, 0.6 semisénior, 0.5 intermedio, 0.4 básico adaptado, 0.3 junior, 0.2 becario (tareas acotadas y repetitivas).
- No todos los puestos son complejos: pocos perfiles altos y una base de juniors y becarios.
- Para llegar al precio objetivo se añaden empleados o fases, nunca se inflan coeficientes.
- Máximo 50 empleados.
Estilo: español de España, concreto, nada de frases de relleno. Nunca plantees la IA como sustitución de personas ni como ahorro de contrataciones: multiplica la plantilla y hace más eficiente al equipo que ya existe.
Responde solo con JSON válido.`;

export default proteger(async (req, res) => {
  const b = cuerpo(req);
  const objetivo = Number(b.objetivo) || 0;
  const usuario = `Cliente: ${b.cliente || '-'}
Actividad: ${b.actividad || '-'}
Sector: ${b.sector || '-'}
Tamaño: ${b.tamano || '-'}
Rasgos del negocio: ${(b.puntos || []).join('; ') || '-'}
Indicaciones de Javi: ${b.notas || '-'}
Número de empleados deseado: ${b.num || 'el que encaje'}
Tarifa objetivo (suma de 1.000 € × coeficientes): ${objetivo ? objetivo + ' €' : 'la que encaje con el negocio'}

Devuelve:
{"titular":"titular de portada, máx. 12 palabras, con la cifra de empleados en letra (ej. 'Diez empleados de inteligencia artificial para ...')",
"intro":"2 frases: fórmula 1.000 € × coeficiente y por qué unos puestos llevan más reglas que otros en este negocio",
"empleados":[{"nombre":"puesto, 2-4 palabras","alcance":"qué hace en una frase concreta de este negocio","coef":0.2}]}
Ordena de mayor a menor coeficiente.${objetivo ? ' La suma de coeficientes × 1.000 debe ser exactamente ' + objetivo + ' € o lo más cercana posible por debajo.' : ''}`;

  const txt = await preguntar({ modelo: 'anthropic/claude-sonnet-5.5', sistema: SISTEMA, usuario, maxTokens: 4000 });
  const d = sacarJSON(txt);
  d.empleados = (d.empleados || []).slice(0, 50).map((e) => {
    const c = Number(e.coef) || 0.2;
    const coef = COEFS.reduce((a, x) => (Math.abs(x - c) < Math.abs(a - c) ? x : a), 0.2);
    return { nombre: String(e.nombre || '').slice(0, 60), alcance: String(e.alcance || '').slice(0, 220), coef };
  });
  json(res, 200, d);
});
