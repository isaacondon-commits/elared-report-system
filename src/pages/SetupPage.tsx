import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

interface Props {
  onComplete: () => void;
}

export default function SetupPage({ onComplete }: Props) {
  const [nombre,   setNombre]   = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      // createUserWithEmailAndPassword también inicia sesión automáticamente
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const uid  = cred.user.uid;

      // Crear el documento en Firestore antes de que onSnapshot lo detecte
      await setDoc(doc(db, 'usuarios', uid), {
        uid,
        email,
        nombre,
        rol:          'admin',   // legacy compat
        roles:        ['admin'],
        activo:       true,
        creadoEn:     serverTimestamp(),
        ultimoAcceso: serverTimestamp(),
      });

      // Notificar al App que el setup completó — desbloquea las rutas
      onComplete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('email-already-in-use')) {
        setError('Este email ya está registrado. Intentá iniciar sesión en /login.');
      } else if (msg.includes('invalid-email')) {
        setError('El email ingresado no es válido.');
      } else if (msg.includes('weak-password')) {
        setError('La contraseña es demasiado débil. Usá al menos 8 caracteres.');
      } else {
        setError(`Error al crear el administrador: ${msg}`);
      }
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#003DA5] flex flex-col items-center justify-center px-4">

      {/* Marca sobre el panel */}
      <div className="text-center mb-7">
        <div className="text-white font-bold text-[28px] leading-tight tracking-widest">EFICIENCIA</div>
        <div className="text-[#CADCFC] text-sm mt-1">Sistema de Reportes</div>
        <div className="mx-auto mt-3 h-[3px] w-14 bg-[#E3000F] rounded-full" />
      </div>

      {/* Panel blanco */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[440px] px-10 py-9">

        {/* Encabezado del panel */}
        <div className="flex items-start gap-3 mb-5">
          <div className="bg-[#003DA5]/10 p-2 rounded-lg flex-shrink-0 mt-0.5">
            <ShieldCheck size={20} className="text-[#003DA5]" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-gray-900 leading-tight">
              Configuración inicial
            </h1>
            <p className="text-gray-400 text-[12px] mt-0.5">
              Este paso solo se ejecuta una vez — crea el administrador del sistema.
            </p>
          </div>
        </div>

        <hr className="border-gray-100 mb-5" />

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Nombre completo
            </label>
            <input
              required
              autoFocus
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Ej: Isaac Ondon"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Correo electrónico
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@elared.com.uy"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Contraseña
            </label>
            <div className="relative">
              <input
                required
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Confirmar contraseña
            </label>
            <input
              required
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repetí la contraseña"
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-1 focus:ring-[#003DA5] transition-colors"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3.5 py-2.5 leading-snug">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#003DA5] hover:bg-[#0052CC] active:bg-[#002D7A] text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
          >
            {loading ? 'Creando administrador…' : 'Crear administrador'}
          </button>
        </form>

        <p className="text-center text-gray-300 text-[11px] mt-6 pt-4 border-t border-gray-100">
          © Elared S.A. · Uso interno
        </p>
      </div>
    </div>
  );
}
