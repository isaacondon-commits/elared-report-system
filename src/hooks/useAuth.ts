import { useState, useEffect, useRef } from 'react';
import {
  type User,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  setPersistence,
  onAuthStateChanged,
} from 'firebase/auth';
import { useAnalisisStore } from '../store/analisisStore';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { RolSistema } from '../types';
import { tieneAcceso, type ModuloSistema } from '../config/permisos';

// Legacy alias kept for any stale imports — prefer RolSistema
export type UserRole = RolSistema;

export interface UserDoc {
  uid: string;
  email: string;
  nombre: string;
  roles: RolSistema[];
  activo: boolean;
  creadoEn: Timestamp;
  ultimoAcceso: Timestamp | null;
}

export interface AuthState {
  user: User | null;
  userDoc: UserDoc | null;
  loading: boolean;
  profileError: string | null;
  userRoles: RolSistema[];
  isAdmin: boolean;
  hasAccess: (modulo: ModuloSistema) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const MSG_DESACTIVADO = 'Usuario desactivado. Contactá al administrador.';

export function useAuth(): AuthState {
  const [user, setUser]                 = useState<User | null>(null);
  const [userDoc, setUserDoc]           = useState<UserDoc | null>(null);
  const [loading, setLoading]           = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const autoLogoutTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAutoLogout() {
    if (autoLogoutTimer.current) {
      clearTimeout(autoLogoutTimer.current);
      autoLogoutTimer.current = null;
    }
  }

  function scheduleAutoLogout() {
    clearAutoLogout();
    autoLogoutTimer.current = setTimeout(() => {
      signOut(auth).catch(() => {});
    }, 3000);
  }

  useEffect(() => {
    let unsubDoc: (() => void) | null = null;
    let provisioning = false;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }
      clearAutoLogout();
      provisioning = false;

      if (!firebaseUser) {
        setUser(null);
        setUserDoc(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      const userRef = doc(db, 'usuarios', firebaseUser.uid);

      unsubDoc = onSnapshot(userRef, async (snap) => {
        if (!snap.exists()) {
          if (provisioning) return;
          provisioning = true;

          // Check for existing admins (supports both old `rol` and new `roles` field)
          const [byRol, byRoles] = await Promise.all([
            getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'admin'), limit(1))),
            getDocs(query(collection(db, 'usuarios'), where('roles', 'array-contains', 'admin'), limit(1))),
          ]);
          const hasAdmin  = !byRol.empty || !byRoles.empty;
          const roles: RolSistema[] = hasAdmin ? ['supervisor_movil'] : ['admin'];

          await setDoc(userRef, {
            uid:          firebaseUser.uid,
            email:        firebaseUser.email ?? '',
            nombre:       firebaseUser.email?.split('@')[0] ?? 'Usuario',
            rol:          roles.includes('admin') ? 'admin' : 'supervisor', // legacy compat
            roles,
            activo:       true,
            creadoEn:     Timestamp.now(),
            ultimoAcceso: Timestamp.now(),
          });

          provisioning = false;
          return;
        }

        provisioning = false;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = snap.data() as Record<string, any>;

        // Migration: old documents have `rol` (string) but not `roles` (array)
        let effectiveRoles: RolSistema[];
        if (!raw['roles']) {
          const oldRol = raw['rol'] as string | undefined;
          effectiveRoles = oldRol === 'admin' ? ['admin'] : ['supervisor_movil'];
          updateDoc(userRef, { roles: effectiveRoles }).catch(() => {});
        } else {
          effectiveRoles = raw['roles'] as RolSistema[];
        }

        const data: UserDoc = {
          uid:          raw['uid'] as string,
          email:        raw['email'] as string,
          nombre:       raw['nombre'] as string,
          roles:        effectiveRoles,
          activo:       raw['activo'] as boolean,
          creadoEn:     raw['creadoEn'] as Timestamp,
          ultimoAcceso: raw['ultimoAcceso'] as Timestamp | null ?? null,
        };

        if (!data.activo) {
          setUserDoc(null);
          setProfileError(MSG_DESACTIVADO);
          setLoading(false);
          scheduleAutoLogout();
          return;
        }

        clearAutoLogout();
        setProfileError(null);
        setUserDoc(data);
        setLoading(false);
      });
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
      clearAutoLogout();
    };
  }, []);

  async function login(email: string, password: string): Promise<void> {
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);

    const userRef = doc(db, 'usuarios', credential.user.uid);
    const snap    = await getDoc(userRef);

    if (snap.exists() && !snap.data().activo) {
      await signOut(auth);
      throw new Error(MSG_DESACTIVADO);
    }

    if (snap.exists()) {
      await updateDoc(userRef, { ultimoAcceso: serverTimestamp() });
    }
  }

  async function logout(): Promise<void> {
    clearAutoLogout();
    useAnalisisStore.getState().clearAll();
    await signOut(auth);
  }

  const userRoles = userDoc?.roles ?? [];
  const isAdmin   = userRoles.includes('admin');
  const hasAccess = (modulo: ModuloSistema) => tieneAcceso(userRoles, modulo);

  return { user, userDoc, loading, profileError, userRoles, isAdmin, hasAccess, login, logout };
}
