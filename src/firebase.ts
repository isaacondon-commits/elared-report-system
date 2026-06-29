import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey:            'AIzaSyBBva5UG27h2jsjc5AI-aAuM3ZaETgvPp8',
  authDomain:        'elared-3789d.firebaseapp.com',
  projectId:         'elared-3789d',
  storageBucket:     'elared-3789d.firebasestorage.app',
  messagingSenderId: '763401392715',
  appId:             '1:763401392715:web:97e3c4af0211238fc705ce',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
