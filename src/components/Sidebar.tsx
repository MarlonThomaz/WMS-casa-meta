import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  FileSearch,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  PackageSearch,
  ScanLine,
  Truck,
  Users,
  Warehouse,
  X,
} from 'lucide-react';
import type { Page, Role } from '../types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  currentPage: Page;
  onPageChange: (page: Page) => void;
}

type MenuItem = {
  id: Page;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
  section: 'core' | 'support' | 'admin';
};

const menuItems: MenuItem[] = [
  { id: 'dashboard', label: 'Armazém', icon: LayoutDashboard, section: 'core' },
  { id: 'locator', label: 'Localizar produto', icon: PackageSearch, section: 'core' },
  { id: 'locations', label: 'Localizações', icon: MapPin, section: 'core' },
  { id: 'movements', label: 'Movimentações', icon: ArrowLeftRight, section: 'core' },
  { id: 'stock-count', label: 'Contagem física', icon: ClipboardCheck, section: 'core' },
  { id: 'barcode-kit', label: 'Códigos de barras', icon: ScanLine, section: 'core' },
  { id: 'inventory', label: 'Produtos', icon: Package, section: 'core' },
  { id: 'receiving', label: 'Recebimento', icon: Warehouse, section: 'support' },
  { id: 'shipping', label: 'Expedição', icon: Truck, section: 'support' },
  { id: 'pilot-dashboard', label: 'Piloto', icon: BarChart3, section: 'support' },
  { id: 'audit', label: 'Auditoria', icon: FileSearch, roles: ['admin', 'manager'], section: 'admin' },
  { id: 'users', label: 'Usuários', icon: Users, roles: ['admin'], section: 'admin' },
  { id: 'help', label: 'Ajuda', icon: HelpCircle, section: 'admin' },
];

const sectionLabels: Record<MenuItem['section'], string> = {
  core: 'Estoque físico',
  support: 'Complementares',
  admin: 'Administração',
};

export default function Sidebar({ currentPage, onPageChange, open, onClose }: SidebarProps) {
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    panel?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panel) return;
      const buttons = Array.from(panel.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handleKey);
      previous?.focus();
    };
  }, [open, onClose]);

  const { user, signOut, isDemo } = useAuth();
  const visibleItems = menuItems.filter(
    (item) => !item.roles || (user?.role ? item.roles.includes(user.role) : false)
  );

  const sections: MenuItem['section'][] = ['core', 'support', 'admin'];

  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" aria-label="Fechar menu" onClick={onClose} />}
      <aside
        ref={panelRef}
        id="wms-navigation"
        aria-label="Menu principal"
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-white flex-col h-dvh shrink-0 lg:flex lg:sticky lg:top-0 lg:w-64 lg:z-30`}
      >
        <button type="button" onClick={onClose} className="lg:hidden self-end m-2 p-2 rounded-lg hover:bg-slate-800" aria-label="Fechar menu"><X className="w-6 h-6" /></button>

        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Annona Mercis</h1>
              <p className="text-xs text-slate-400">Warehouse Management</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="space-y-5">
            {sections.map((section) => {
              const sectionItems = visibleItems.filter((item) => item.section === section);
              if (sectionItems.length === 0) return null;

              return (
                <section key={section}>
                  <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {sectionLabels[section]}
                  </p>
                  <ul className="space-y-1">
                    {sectionItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentPage === item.id;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => { onPageChange(item.id); onClose(); }}
                            aria-current={isActive ? 'page' : undefined}
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
                </section>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium">
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name || 'Usuário'}</p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === 'admin'
                  ? 'Administrador'
                  : user?.role === 'manager'
                    ? 'Gerente'
                    : user?.role === 'operator'
                      ? 'Operador'
                      : 'Visualizador'}
                {isDemo && ' (Demo)'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
