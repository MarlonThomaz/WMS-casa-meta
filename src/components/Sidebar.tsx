import { LayoutDashboard, Package, MapPin, ArrowDown, ArrowUp, ArrowLeftRight, Building2, Download, Box, HelpCircle, LogOut, ClipboardCheck, Activity } from 'lucide-react';
import { Page } from '../types';
import { downloadProjectZip } from '../downloadProject';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

const menuItems = [
  { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inventory' as Page, label: 'Inventário', icon: Package },
  { id: 'locations' as Page, label: 'Localizações', icon: MapPin },
  { id: 'receiving' as Page, label: 'Recebimento', icon: ArrowDown },
  { id: 'shipping' as Page, label: 'Expedição', icon: ArrowUp },
  { id: 'movements' as Page, label: 'Movimentações', icon: ArrowLeftRight },
  { id: 'barcode-kit' as Page, label: 'Kit Código de Barras', icon: Box },
  { id: 'stock-count' as Page, label: 'Contagem Física', icon: ClipboardCheck },
  { id: 'pilot-dashboard' as Page, label: 'Dashboard do Piloto', icon: Activity },
  { id: 'help' as Page, label: 'Ajuda', icon: HelpCircle },
];

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">WMS Pro</h1>
            <p className="text-xs text-slate-400">Warehouse Management</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-700 space-y-3">
        <button
          onClick={downloadProjectZip}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-600 hover:text-white transition-all border border-slate-700 hover:border-emerald-500"
        >
          <Download className="w-5 h-5" />
          Baixar Projeto (.zip)
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {user?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.role === 'admin' ? 'Administrador' : 
               user?.role === 'manager' ? 'Gerente' : 
               user?.role === 'operator' ? 'Operador' : 'Visualizador'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
