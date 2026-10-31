import { Menu, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import type { Page } from './types';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Locations from './components/Locations';
import Receiving from './components/Receiving';
import Shipping from './components/Shipping';
import Movements from './components/Movements';
import BarcodeKit from './components/BarcodeKit';
import StockCount from './components/StockCount';
import PilotDashboard from './components/PilotDashboard';
import AuditLog from './components/AuditLog';
import UserAdmin from './components/UserAdmin';
import Help from './components/Help';

function renderPage(page: Page) {
  switch (page) {
    case 'dashboard': return <Dashboard />;
    case 'inventory': return <Inventory />;
    case 'locations': return <Locations />;
    case 'receiving': return <Receiving />;
    case 'shipping': return <Shipping />;
    case 'movements': return <Movements />;
    case 'barcode-kit': return <BarcodeKit />;
    case 'stock-count': return <StockCount />;
    case 'pilot-dashboard': return <PilotDashboard />;
    case 'audit': return <AuditLog />;
    case 'users': return <UserAdmin />;
    case 'help': return <Help />;
    default: return <Dashboard />;
  }
}

export default function App() {
  const { user, loading, isDemo } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mx-auto" />
          <p className="mt-4 text-sm text-slate-300">Carregando WMS...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="min-h-dvh bg-slate-100 flex">
      <Sidebar open={menuOpen} onClose={closeMenu} currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="wms-main flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-slate-900 text-white px-3 py-2 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu" aria-controls="wms-navigation" aria-expanded={menuOpen} className="p-2 rounded-lg hover:bg-slate-800"><Menu className="w-6 h-6" /></button>
          <div className="min-w-0 flex-1"><p className="font-semibold">WMS Casa Meta</p><p className="text-xs text-slate-300 truncate">{user.email} · {user.role}</p></div>
        </header>
        {!online && <div role="status" className="flex items-center gap-2 bg-amber-100 text-amber-950 px-4 py-3 text-sm"><WifiOff className="w-5 h-5 shrink-0" />Sem conexão. As operações precisam de internet; confira os dados ao reconectar.</div>}
        {isDemo && (
          <div className="bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs sm:text-sm text-amber-900">
            <strong>DEMO ISOLADA:</strong> dados fictícios em memória. Você pode testar cadastros e fluxos; tudo volta ao estado inicial ao recarregar a página.
          </div>
        )}
        {renderPage(currentPage)}
      </main>
    </div>
  );
}
