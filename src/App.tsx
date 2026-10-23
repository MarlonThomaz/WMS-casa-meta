import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useState } from 'react';
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
import Help from './components/Help';
import Login from './components/Login';
import { Page } from './types';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  // Mostrar tela de loading enquanto verifica autenticação
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se não estiver autenticado, mostrar tela de login
  if (!user) {
    return <Login />;
  }

  // Usuário autenticado, mostrar app
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'inventory': return <Inventory />;
      case 'locations': return <Locations />;
      case 'receiving': return <Receiving />;
      case 'shipping': return <Shipping />;
      case 'movements': return <Movements />;
      case 'barcode-kit': return <BarcodeKit />;
      case 'stock-count': return <StockCount />;
      case 'pilot-dashboard': return <PilotDashboard />;
      case 'help': return <Help />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
      <main className="flex-1 overflow-auto">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
