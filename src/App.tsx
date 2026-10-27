import { useState } from 'react';
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
    <div className="min-h-screen bg-slate-100 flex">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 min-w-0 overflow-auto">
        {isDemo && (
          <div className="sticky top-0 z-40 bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs sm:text-sm text-amber-900">
            <strong>DEMO ISOLADA:</strong> dados fictícios em memória. Você pode testar cadastros e fluxos; tudo volta ao estado inicial ao recarregar a página.
          </div>
        )}
        {renderPage(currentPage)}
      </main>
    </div>
  );
}
