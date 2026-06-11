import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../public/splash-logo.png');
const out512 = resolve(__dirname, '../public/icon.png');
const out256 = resolve(__dirname, '../public/icon-256.png');
const outIco = resolve(__dirname, '../public/icon.ico');

await sharp(src).resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out512);
console.log('icon.png written:', out512);

await sharp(src).resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out256);
console.log('icon-256.png written:', out256);

const icoBuffer = await pngToIco([out256]);
writeFileSync(outIco, icoBuffer);
console.log('icon.ico written:', outIco);
