import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

// 1. Importación directa del archivo físico
import serviceAccount from './GestionHistorica.json';

// 2. Previene el error "duplicate-app" en los reinicios del emulador
if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount as any),
    storageBucket: 'sigah-itd-boveda.appspot.com' 
  });
}

// 3. Exportación de los módulos (Singletons)
export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();

db.settings({ ignoreUndefinedProperties: true });