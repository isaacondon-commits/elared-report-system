/**
 * Crea el primer usuario admin en Firestore.
 *
 * Uso:
 *   npx tsx scripts/createAdmin.ts <UID> <EMAIL> <NOMBRE>
 *
 * Ejemplo:
 *   npx tsx scripts/createAdmin.ts AbCdEfGhIj isaac@elared.com.uy Isaac
 *
 * Requisito previo: descargar el Service Account JSON desde
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 *   y guardarlo como scripts/serviceAccount.json (NUNCA subir al repo).
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Argumentos ────────────────────────────────────────────────────────────────

const [uid, email, nombre] = process.argv.slice(2);

if (!uid || !email || !nombre) {
  console.error('\nUso:');
  console.error('  npx tsx scripts/createAdmin.ts <UID> <EMAIL> <NOMBRE>\n');
  console.error('Ejemplo:');
  console.error('  npx tsx scripts/createAdmin.ts AbCdEfGhIj isaac@elared.com.uy "Isaac Ondon"\n');
  process.exit(1);
}

// ── Cargar Service Account ────────────────────────────────────────────────────

const SA_PATH = resolve('scripts/serviceAccount.json');
let serviceAccount: ServiceAccount;

try {
  serviceAccount = JSON.parse(readFileSync(SA_PATH, 'utf-8')) as ServiceAccount;
} catch {
  console.error('\n⚠  No se encontró scripts/serviceAccount.json');
  console.error('\nPara obtenerlo:');
  console.error('  1. Firebase Console → Project Settings → Service accounts');
  console.error('  2. "Generate new private key" → descargar JSON');
  console.error('  3. Guardar como scripts/serviceAccount.json\n');
  process.exit(1);
}

// ── Crear documento en Firestore ──────────────────────────────────────────────

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

try {
  await db.collection('usuarios').doc(uid).set({
    uid,
    email,
    nombre,
    rol:          'admin',
    activo:       true,
    creadoEn:     Timestamp.now(),
    ultimoAcceso: null,
  });

  console.log('\n✅ Usuario admin creado correctamente:');
  console.log(`   Nombre: ${nombre}`);
  console.log(`   Email:  ${email}`);
  console.log(`   UID:    ${uid}`);
  console.log(`   Rol:    admin`);
  console.log('\nYa podés iniciar sesión en http://localhost:5173\n');
} catch (err) {
  console.error('\n❌ Error al crear el documento en Firestore:');
  console.error(err instanceof Error ? err.message : String(err));
  console.error('\nVerificá que el service account tenga permisos de escritura en Firestore.\n');
  process.exit(1);
}
