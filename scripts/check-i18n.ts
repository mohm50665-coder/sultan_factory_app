import { en } from '../lib/i18n/en';
import { ar } from '../lib/i18n/ar';

const arKeys = Object.keys(ar);
const enKeys = Object.keys(en);

console.log('AR keys:', arKeys.length);
console.log('EN keys:', enKeys.length);

const missingInEn = arKeys.filter(k => !(k in en));
const missingInAr = enKeys.filter(k => !(k in ar));

if (missingInEn.length) console.log('Missing in EN:', missingInEn);
if (missingInAr.length) console.log('Missing in AR:', missingInAr);
if (!missingInEn.length && !missingInAr.length) console.log('All keys matched!');
