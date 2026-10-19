// Geobloqueo (regla de oro): corta el tráfico de países de alto riesgo antes de llegar al panel.
import { geolocation, next } from '@vercel/functions';

const BLOQUEADOS = new Set(('CN,HK,MO,RU,BY,KP,IR,IN,PK,AF,BD,VN,ID,TH,MY,PH,KH,LA,MM,NP,LK,KZ,UZ,TM,TJ,KG,AZ,AM,GE,IQ,SY,YE,SA,AE,QA,KW,BH,OM,JO,LB,IL,PS,TR,' +
  'DZ,AO,BJ,BW,BF,BI,CM,CV,CF,TD,KM,CG,CD,CI,DJ,EG,GQ,ER,SZ,ET,GA,GM,GH,GN,GW,KE,LS,LR,LY,MG,MW,ML,MR,MU,MA,MZ,NA,NE,NG,RW,ST,SN,SC,SL,SO,ZA,SS,SD,TZ,TG,TN,UG,ZM,ZW').split(','));

export const config = { matcher: ['/((?!robots.txt).*)'] };

export default function middleware(request) {
  const { country } = geolocation(request);
  if (country && BLOQUEADOS.has(country)) {
    return new Response('Acceso no disponible desde tu ubicación.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  return next();
}
