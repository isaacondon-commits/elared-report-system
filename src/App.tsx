import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import SplashScreen from './components/SplashScreen';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import HomePage from './pages/HomePage';
import VentasModule from './modules/ventas/VentasModule';
import RelojModule from './modules/reloj/RelojModule';
import SancionesModule from './modules/sanciones/SancionesModule';
import ConfigPage from './pages/ConfigPage';
import UsuariosPage from './pages/admin/UsuariosPage';
import ComisionesMovilModule from './modules/comisiones/ComisionesMovilModule';
import ComisionesFibraModule from './modules/comisiones/fibra/ComisionesFibraModule';
import AtencionModule from './modules/atencion/AtencionModule';
import BackOfficePage from './pages/BackOfficePage';
import ChipsPage from './pages/ChipsPage';
import VicidialModule from './modules/vicidial/VicidialModule';
import PersonalPage from './pages/PersonalPage';
import CertificacionesPage from './pages/CertificacionesPage';
import PlanoCallCenterPage from './pages/PlanoCallCenterPage';
import { UpdateNotification } from './components/UpdateNotification';

// ── Spinner de carga inicial ──────────────────────────────────────────────────

function AppSpinner() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#003DA5]">
      <div className="text-white font-bold text-3xl tracking-widest mb-1">EFICIENCIA</div>
      <div className="text-blue-200 text-sm mb-8">Sistema de Reportes</div>
      <div className="w-9 h-9 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Layout protegido (todas las rutas autenticadas) ───────────────────────────

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('elared_sidebar_collapsed');
      if (stored !== null) return stored === 'true';
      return typeof window !== 'undefined' && window.innerWidth < 1200;
    } catch {
      return false;
    }
  });

  function handleToggleSidebar() {
    setSidebarCollapsed(v => {
      const next = !v;
      try { localStorage.setItem('elared_sidebar_collapsed', String(next)); } catch {}
      return next;
    });
  }

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-[#F5F7FA]">
        <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        {/* margin-left sincronizado con el ancho del sidebar */}
        <main className={`flex-1 flex flex-col min-h-screen transition-all duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute modulo="inicio"><HomePage /></ProtectedRoute>
            } />
            <Route path="/ventas" element={
              <ProtectedRoute modulo="ventas"><VentasModule /></ProtectedRoute>
            } />
            <Route path="/reloj" element={
              <ProtectedRoute modulo="reloj"><RelojModule /></ProtectedRoute>
            } />
            <Route path="/sanciones" element={
              <ProtectedRoute modulo="sanciones"><SancionesModule /></ProtectedRoute>
            } />
            <Route path="/comisiones-movil" element={
              <ProtectedRoute modulo="comisiones_movil"><ComisionesMovilModule /></ProtectedRoute>
            } />
            <Route path="/comisiones-fibra" element={
              <ProtectedRoute modulo="comisiones_fibra"><ComisionesFibraModule /></ProtectedRoute>
            } />
            <Route path="/atencion-cliente" element={
              <ProtectedRoute modulo="atencion_cliente"><AtencionModule /></ProtectedRoute>
            } />
            <Route path="/back-office" element={
              <ProtectedRoute modulo="back_office"><BackOfficePage /></ProtectedRoute>
            } />
            <Route path="/chips" element={
              <ProtectedRoute modulo="chips"><ChipsPage /></ProtectedRoute>
            } />
            <Route path="/pausas-vicidial" element={
              <ProtectedRoute modulo="pausas_vicidial"><VicidialModule /></ProtectedRoute>
            } />
            <Route path="/personal" element={
              <ProtectedRoute modulo="personal"><PersonalPage /></ProtectedRoute>
            } />
            <Route path="/certificaciones" element={
              <ProtectedRoute modulo="certificaciones"><CertificacionesPage /></ProtectedRoute>
            } />
            <Route path="/plano-call-center" element={
              <ProtectedRoute modulo="plano_call_center"><PlanoCallCenterPage /></ProtectedRoute>
            } />
            <Route path="/config" element={
              <ProtectedRoute modulo="configuracion"><ConfigPage /></ProtectedRoute>
            } />
            <Route path="/admin/usuarios" element={
              <ProtectedRoute modulo="usuarios"><UsuariosPage /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ProtectedRoute>
  );
}

// ── App root — verifica si el sistema necesita setup inicial ──────────────────

export default function App() {
  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splash_visto'));

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'usuarios'), where('rol', '==', 'admin'), limit(1))),
      getDocs(query(collection(db, 'usuarios'), where('roles', 'array-contains', 'admin'), limit(1))),
    ])
      .then(([byRol, byRoles]) => {
        setHasAdmin(!byRol.empty || !byRoles.empty);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  function handleSplashComplete() {
    setShowSplash(false);
    sessionStorage.setItem('splash_visto', '1');
  }

  const mainContent = checking ? (
    <AppSpinner />
  ) : (
    <BrowserRouter>
      <Routes>
        <Route
          path="/setup"
          element={
            hasAdmin
              ? <Navigate to="/login" replace />
              : <SetupPage onComplete={() => setHasAdmin(true)} />
          }
        />
        <Route
          path="/login"
          element={
            hasAdmin
              ? <LoginPage />
              : <Navigate to="/setup" replace />
          }
        />
        <Route
          path="/*"
          element={
            hasAdmin
              ? <AppLayout />
              : <Navigate to="/setup" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );

  return (
    <>
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <div style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.4s ease' }}>
        {mainContent}
        <UpdateNotification />
      </div>
    </>
  );
}
