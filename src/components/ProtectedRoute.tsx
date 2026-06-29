import { Navigate, useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuthContext } from '../contexts/AuthContext';
import type { ModuloSistema } from '../config/permisos';

interface Props {
  children: React.ReactNode;
  modulo?: ModuloSistema;
}

function Spinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#003DA5]">
      <div className="text-white font-bold text-3xl tracking-widest mb-1">ELARED</div>
      <div className="text-blue-200 text-sm mb-8">Sistema de Reportes</div>
      <div className="w-9 h-9 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ProfileErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#003DA5] px-4">
      <div className="text-white font-bold text-3xl tracking-widest mb-1">ELARED</div>
      <div className="text-blue-200 text-sm mb-8">Sistema de Reportes</div>
      <div className="bg-white rounded-xl shadow-xl px-8 py-6 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-[#E3000F] text-xl font-bold">!</span>
        </div>
        <p className="text-gray-800 text-sm font-medium leading-relaxed">{message}</p>
        <p className="text-gray-400 text-xs mt-4">Cerrando sesión automáticamente…</p>
        <div className="mt-4 w-8 h-8 border-3 border-[#003DA5] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

function Page403() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <Lock size={64} className="mb-5" style={{ color: '#E3000F' }} />
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Acceso restringido</h1>
      <p className="text-slate-600 text-sm mb-1">No tenés permisos para ver este módulo.</p>
      <p className="text-slate-400 text-sm mb-8">Contactá al administrador si necesitás acceso.</p>
      <button
        onClick={() => navigate('/')}
        className="bg-[#003DA5] hover:bg-[#0052CC] text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors"
      >
        Volver al inicio
      </button>
    </div>
  );
}

export default function ProtectedRoute({ children, modulo }: Props) {
  const { user, userDoc, loading, profileError, hasAccess } = useAuthContext();

  if (loading)       return <Spinner />;
  if (profileError)  return <ProfileErrorScreen message={profileError} />;
  if (!user || !userDoc) return <Navigate to="/login" replace />;

  if (modulo && !hasAccess(modulo)) return <Page403 />;

  return <>{children}</>;
}
