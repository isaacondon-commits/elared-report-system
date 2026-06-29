import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, UserCheck, UserX, CheckSquare, Trash2 } from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import {
  initializeApp,
  deleteApp,
} from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { format } from 'date-fns';
import { db, firebaseConfig } from '../../firebase';
import Header from '../../components/Header';
import { useAuthContext } from '../../contexts/AuthContext';
import type { UserDoc } from '../../hooks/useAuth';
import type { RolSistema } from '../../types';
import {
  NOMBRES_ROLES,
  PERMISOS_MODULOS,
  MODULO_LABELS,
  ROL_COLORS,
  tieneAcceso,
  type ModuloSistema,
} from '../../config/permisos';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAcceso(ts: Timestamp | null | undefined): string {
  if (!ts) return 'Nunca';
  try { return format(ts.toDate(), 'dd/MM/yyyy HH:mm'); }
  catch { return 'Nunca'; }
}

// ── Role chip ─────────────────────────────────────────────────────────────────

function RolChip({ rol }: { rol: RolSistema }) {
  return (
    <span
      className="inline-block text-white text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: ROL_COLORS[rol] }}
    >
      {NOMBRES_ROLES[rol]}
    </span>
  );
}

function RolesChips({ roles }: { roles: RolSistema[] }) {
  return (
    <div className="flex flex-wrap gap-1 justify-center">
      {roles.map(r => <RolChip key={r} rol={r} />)}
    </div>
  );
}

function EstadoBadge({ activo }: { activo: boolean }) {
  return (
    <span
      className="inline-block text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
      style={{ background: activo ? '#28a745' : '#E3000F' }}
    >
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

// ── Modal base ────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4 py-6 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-base">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
        {label}
      </label>
      {children}
    </div>
  );
}

const INPUT = 'w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors';

// ── Role info ─────────────────────────────────────────────────────────────────

const ROL_INFO: { rol: RolSistema; modulos: string }[] = [
  { rol: 'admin',               modulos: 'Acceso total al sistema' },
  { rol: 'rrhh',                modulos: 'Reloj de asistencia · Sanciones' },
  { rol: 'supervisor_movil',    modulos: 'Ventas · Comisiones Móvil · Pausas Vicidial · Chips' },
  { rol: 'supervisor_fibra',    modulos: 'Ventas · Comisiones Fibra · Pausas Vicidial · Chips' },
  { rol: 'supervisor_atencion', modulos: 'Atención al Cliente · Back Office' },
];

// ── RoleSelector component ────────────────────────────────────────────────────

function RoleSelector({
  selected,
  onChange,
}: {
  selected: RolSistema[];
  onChange: (roles: RolSistema[]) => void;
}) {
  const isAdmin = selected.includes('admin');

  function toggle(rol: RolSistema) {
    if (rol === 'admin') {
      onChange(isAdmin ? [] : ['admin']);
      return;
    }
    if (isAdmin) return; // disabled when admin is checked
    if (selected.includes(rol)) {
      onChange(selected.filter(r => r !== rol));
    } else {
      onChange([...selected, rol]);
    }
  }

  // Modules accessible with current selection
  const accessibleModules = (Object.keys(PERMISOS_MODULOS) as ModuloSistema[]).filter(
    m => tieneAcceso(selected, m)
  );

  return (
    <div className="space-y-3">
      {ROL_INFO.map(({ rol, modulos }) => {
        const checked   = selected.includes(rol);
        const disabled  = rol !== 'admin' && isAdmin;
        return (
          <div
            key={rol}
            onClick={() => !disabled && toggle(rol)}
            className={`border rounded-lg p-3 cursor-pointer transition-all ${
              disabled
                ? 'border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed'
                : checked
                  ? 'border-[#003DA5] bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked ? 'border-[#003DA5] bg-[#003DA5]' : 'border-gray-300 bg-white'
              }`}>
                {checked && <CheckSquare size={12} className="text-white" />}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  {NOMBRES_ROLES[rol]}
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: ROL_COLORS[rol] }}
                  />
                </div>
                <div className="text-[11px] text-gray-400 mt-0.5">{modulos}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Access preview */}
      {selected.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 mt-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Este usuario tendrá acceso a:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {accessibleModules.map(m => (
              <span key={m} className="text-[11px] bg-white border border-slate-200 rounded-full px-2.5 py-0.5 text-slate-600 font-medium">
                {MODULO_LABELS[m]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Crear Usuario ───────────────────────────────────────────────────────

interface CreateForm { nombre: string; email: string; password: string; roles: RolSistema[] }
const EMPTY_CREATE: CreateForm = { nombre: '', email: '', password: '', roles: ['supervisor_movil'] };

function ModalCrear({ onClose }: { onClose: () => void }) {
  const [form, setForm]       = useState<CreateForm>(EMPTY_CREATE);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');

  function set<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault();
    if (form.roles.length === 0) {
      setError('Seleccioná al menos un rol.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setSaving(true);

    try {
      const secondaryApp  = initializeApp(firebaseConfig, `secondary_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      const credential    = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password);
      const newUid        = credential.user.uid;
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      const isAdmin = form.roles.includes('admin');
      await setDoc(doc(db, 'usuarios', newUid), {
        uid:          newUid,
        email:        form.email,
        nombre:       form.nombre,
        rol:          isAdmin ? 'admin' : 'supervisor', // legacy compat
        roles:        form.roles,
        activo:       true,
        creadoEn:     serverTimestamp(),
        ultimoAcceso: null,
      });

      setSuccess(`Usuario "${form.nombre}" creado correctamente.`);
      setForm(EMPTY_CREATE);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setError('Ya existe un usuario con ese correo electrónico.');
      } else {
        setError(`Error al crear usuario: ${msg}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo Usuario" onClose={onClose}>
      {success ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
            {success}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setSuccess('')}
              className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">
              Crear otro
            </button>
            <button onClick={onClose}
              className="flex-1 bg-[#003DA5] text-white rounded-lg py-2 text-sm hover:bg-[#0052CC] transition-colors">
              Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCrear} className="space-y-4">
          <Field label="Nombre completo">
            <input required value={form.nombre} onChange={e => set('nombre', e.target.value)} className={INPUT} placeholder="Ej: María García" />
          </Field>
          <Field label="Correo electrónico">
            <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className={INPUT} placeholder="usuario@elared.com.uy" />
          </Field>
          <Field label="Contraseña temporal">
            <input required type="password" value={form.password} onChange={e => set('password', e.target.value)} className={INPUT} placeholder="Mínimo 8 caracteres" minLength={8} />
          </Field>
          <Field label="Roles del usuario">
            <RoleSelector selected={form.roles} onChange={roles => set('roles', roles)} />
          </Field>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-[#003DA5] hover:bg-[#0052CC] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60">
              {saving ? 'Creando…' : 'Crear usuario'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ── Modal Editar Usuario ──────────────────────────────────────────────────────

function ModalEditar({ usuario, onClose }: { usuario: UserDoc; onClose: () => void }) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [roles, setRoles]   = useState<RolSistema[]>(usuario.roles ?? ['supervisor_movil']);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setError('Seleccioná al menos un rol.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const isAdmin = roles.includes('admin');
      await updateDoc(doc(db, 'usuarios', usuario.uid), {
        nombre,
        roles,
        rol: isAdmin ? 'admin' : 'supervisor', // legacy compat
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Editar Usuario" onClose={onClose}>
      <form onSubmit={handleGuardar} className="space-y-4">
        <Field label="Correo electrónico">
          <input disabled value={usuario.email} className={`${INPUT} bg-gray-50 text-gray-400 cursor-not-allowed`} />
          <p className="text-[11px] text-gray-400 mt-1">El email no se puede modificar.</p>
        </Field>
        <Field label="Nombre completo">
          <input required value={nombre} onChange={e => setNombre(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Roles del usuario">
          <RoleSelector selected={roles} onChange={setRoles} />
        </Field>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-2.5 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-[#003DA5] hover:bg-[#0052CC] text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Modal Eliminar Usuario ────────────────────────────────────────────────────

function ModalEliminar({ usuario, onClose, onDeleted }: {
  usuario: UserDoc;
  onClose: () => void;
  onDeleted: (nombre: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  async function handleEliminar() {
    setDeleting(true);
    setError('');
    try {
      await deleteDoc(doc(db, 'usuarios', usuario.uid));
      onDeleted(usuario.nombre);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al eliminar.');
      setDeleting(false);
    }
  }

  return (
    <Modal title="¿Eliminar usuario?" onClose={onClose}>
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <Trash2 size={28} style={{ color: '#E3000F' }} />
        </div>
        <div>
          <p className="text-gray-800 text-sm leading-relaxed">
            Estás por eliminar a <span className="font-semibold">{usuario.nombre}</span>{' '}
            (<span className="text-gray-500">{usuario.email}</span>).
          </p>
          <p className="text-gray-500 text-sm mt-1">Esta acción no se puede deshacer.</p>
        </div>

        {error && (
          <div className="w-full bg-red-50 border border-red-200 text-red-700 rounded-lg px-3.5 py-2.5 text-sm text-left">
            {error}
          </div>
        )}

        <div className="flex gap-3 w-full pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEliminar}
            disabled={deleting}
            className="flex-1 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-60"
            style={{ background: '#E3000F' }}
          >
            {deleting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user: currentUser }       = useAuthContext();
  const [usuarios, setUsuarios]     = useState<UserDoc[]>([]);
  const [cargando, setCargando]     = useState(true);
  const [modalCrear, setModalCrear] = useState(false);
  const [editar, setEditar]         = useState<UserDoc | null>(null);
  const [eliminar, setEliminar]     = useState<UserDoc | null>(null);
  const [toggling, setToggling]     = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snap) => {
      const docs = snap.docs.map(d => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = d.data() as Record<string, any>;
        // Normalize: ensure roles array exists (migration safety)
        const roles: RolSistema[] = raw['roles'] ?? (raw['rol'] === 'admin' ? ['admin'] : ['supervisor_movil']);
        return { ...raw, roles } as UserDoc;
      });
      docs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      setUsuarios(docs);
      setCargando(false);
    });
    return unsub;
  }, []);

  async function toggleActivo(u: UserDoc) {
    setToggling(u.uid);
    try {
      await updateDoc(doc(db, 'usuarios', u.uid), { activo: !u.activo });
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        title="Administración de Usuarios"
        subtitle="Gestioná los accesos al sistema"
        actions={
          <button
            onClick={() => setModalCrear(true)}
            className="flex items-center gap-2 bg-[#003DA5] hover:bg-[#0052CC] text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nuevo usuario
          </button>
        }
      />

      <div className="p-6 flex-1">
        {cargando ? (
          <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Cargando usuarios…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#003DA5] text-white">
                    <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-center font-semibold">Roles</th>
                    <th className="px-4 py-3 text-center font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold">Último acceso</th>
                    <th className="px-4 py-3 text-center font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u, i) => (
                    <tr key={u.uid} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.nombre}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3"><RolesChips roles={u.roles} /></td>
                      <td className="px-4 py-3 text-center"><EstadoBadge activo={u.activo} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatAcceso(u.ultimoAcceso)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditar(u)}
                            className="flex items-center gap-1 text-xs text-[#003DA5] hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-[#003DA5]/20 transition-colors font-medium"
                          >
                            <Pencil size={13} />
                            Editar
                          </button>
                          {u.roles.includes('admin') || u.uid === currentUser?.uid ? (
                            <button
                              disabled
                              title={u.roles.includes('admin') ? 'No se puede eliminar al administrador' : 'No podés eliminarte a vos mismo'}
                              className="flex items-center gap-1 text-xs text-red-300 px-2.5 py-1.5 rounded-lg border border-red-100 cursor-not-allowed font-medium opacity-40"
                            >
                              <Trash2 size={13} />
                              Eliminar
                            </button>
                          ) : (
                            <button
                              onClick={() => setEliminar(u)}
                              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-red-200 transition-colors"
                              style={{ color: '#E3000F' }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#fff5f5')}
                              onMouseLeave={e => (e.currentTarget.style.background = '')}
                            >
                              <Trash2 size={13} />
                              Eliminar
                            </button>
                          )}
                          <button
                            onClick={() => toggleActivo(u)}
                            disabled={toggling === u.uid}
                            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-medium disabled:opacity-50 ${
                              u.activo
                                ? 'text-red-600 border-red-200 hover:bg-red-50'
                                : 'text-green-700 border-green-200 hover:bg-green-50'
                            }`}
                          >
                            {u.activo ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Activar</>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                        No hay usuarios registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {modalCrear && <ModalCrear onClose={() => setModalCrear(false)} />}
      {editar     && <ModalEditar usuario={editar} onClose={() => setEditar(null)} />}
      {eliminar   && (
        <ModalEliminar
          usuario={eliminar}
          onClose={() => setEliminar(null)}
          onDeleted={nombre => showToast(`Usuario "${nombre}" eliminado correctamente`)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          {toast}
        </div>
      )}
    </div>
  );
}
