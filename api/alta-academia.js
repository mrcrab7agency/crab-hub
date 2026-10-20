// Alta en la Academia Empleados IA (código de empresa + email de bienvenida por GHL).
// Se puede llamar desde Crab Hub (sesión iniciada) o desde CertiMail al firmar (cabecera x-alta-secret).
import { autenticado, cuerpo, json } from './_lib/core.js';
import { secretoValido } from './_lib/academia.js';
import { altaAcademia } from './_lib/alta.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Método no permitido' });
  if (!autenticado(req) && !secretoValido(req)) return json(res, 401, { error: 'No autorizado' });
  try {
    json(res, 200, await altaAcademia(cuerpo(req)));
  } catch (e) {
    console.error(e);
    json(res, /email|empresa/i.test(e.message) ? 400 : 500, { error: e.message || 'Error interno' });
  }
}
