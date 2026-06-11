import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';

function Spinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#003DA5] to-[#001F6B]">
      <div className="text-white font-bold text-3xl tracking-widest mb-1">EFICIENCIA</div>
      <div className="text-blue-200 text-sm mb-8">Sistema de Reportes</div>
      <div className="w-9 h-9 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LoginPage() {
  const { user, loading, login } = useAuthContext();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Spinner />;
  if (user)    return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(
        msg.includes('desactivado')
          ? msg
          : 'Credenciales incorrectas. Verificá tu email y contraseña.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003DA5] to-[#001F6B] flex flex-col items-center justify-center px-4">

      {/* Decorative background shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-[#E3000F]/10" />
        <div className="absolute top-1/2 left-1/4 w-32 h-32 rounded-full bg-white/3" />
      </div>

      {/* Logo above card */}
      <div className="relative text-center mb-8">
        <div className="text-white font-bold text-[30px] leading-tight tracking-widest">EFICIENCIA</div>
        <div className="text-blue-200/80 text-sm mt-0.5">Sistema de Reportes</div>
        <div className="mx-auto mt-3 h-[3px] w-16 bg-[#E3000F] rounded-full" />
      </div>

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[420px] px-9 py-8">

        <h1 className="text-[21px] font-bold text-[#1A1A2E] mb-0.5">Iniciar sesión</h1>
        <p className="text-gray-400 text-[13px] mb-6">Agente Oficial Antel · Uso interno</p>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@elared.com.uy"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-2 focus:ring-[#003DA5]/20 transition-all bg-gray-50 hover:bg-white"
            />
          </div>

          {/* Contraseña */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-widest">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-[#003DA5] focus:ring-2 focus:ring-[#003DA5]/20 transition-all bg-gray-50 hover:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 leading-snug">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#003DA5] hover:bg-[#0052CC] active:bg-[#002D7A] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-blue-900/20"
          >
            {submitting ? 'Ingresando…' : 'Ingresar al sistema'}
          </button>
        </form>

        <p className="text-center text-gray-300 text-[11px] mt-6 pt-5 border-t border-gray-100">
          © Elared S.A. · Datos procesados localmente
        </p>
      </div>
    </div>
  );
}
