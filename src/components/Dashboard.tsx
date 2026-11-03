import {
  AlertCircle,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  ClipboardCheck,
  MapPin,
  Package,
  PackageSearch,
  RefreshCw,
  ScanLine,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboard';
import { useProducts } from '../hooks/useProducts';
import type { Page } from '../types';

export default function Dashboard({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { stats, loading, error, refresh } = useDashboardStats();
  const { products } = useProducts();

  const lowStockProducts = products.filter(
    (product) => product.active && product.total_stock <= product.min_stock
  );

  if (loading && !stats) {
    return <div className="p-6 text-slate-500">Carregando painel do armazém...</div>;
  }

  const summaryCards = [
    { label: 'SKUs ativos', value: stats?.totalProducts ?? 0, icon: Package },
    { label: 'Localizações', value: stats?.totalLocations ?? 0, icon: MapPin },
    {
      label: 'Posições ocupadas',
      value: `${stats?.occupiedLocations ?? 0} / ${stats?.totalLocations ?? 0}`,
      icon: Warehouse,
    },
    {
      label: 'Unidades armazenadas',
      value: (stats?.totalStock ?? 0).toLocaleString('pt-BR'),
      icon: PackageSearch,
    },
  ];

  const mainActions: Array<{
    title: string;
    description: string;
    page: Page;
    icon: typeof Package;
  }> = [
    {
      title: 'Localizar produto',
      description: 'Encontre rapidamente todos os endereços físicos de um SKU.',
      page: 'locator',
      icon: PackageSearch,
    },
    {
      title: 'Guardar / endereçar',
      description: 'Registre entrada física ou movimentação para o endereço correto.',
      page: 'movements',
      icon: Warehouse,
    },
    {
      title: 'Transferir mercadoria',
      description: 'Mova produtos entre posições mantendo o histórico físico.',
      page: 'movements',
      icon: ArrowLeftRight,
    },
    {
      title: 'Mapa de endereços',
      description: 'Veja zonas, posições ocupadas, disponíveis e bloqueadas.',
      page: 'locations',
      icon: MapPin,
    },
    {
      title: 'Contagem física',
      description: 'Faça inventários pontuais, cíclicos ou completos.',
      page: 'stock-count',
      icon: ClipboardCheck,
    },
    {
      title: 'Código de barras',
      description: 'Cadastre e consulte produtos usando scanner ou câmera.',
      page: 'barcode-kit',
      icon: ScanLine,
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-5 sm:space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Armazém</h1>
          <p className="text-slate-500">Organização física, endereçamento e localização de mercadorias.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm text-slate-500">{label}</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{value}</p>
              </div>
              <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-slate-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Operação do estoque físico</h2>
          <p className="text-sm text-slate-500">As ações mais usadas para manter o armazém organizado.</p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {mainActions.map(({ title, description, page, icon: Icon }) => (
            <button
              key={title}
              type="button"
              onClick={() => onNavigate(page)}
              className="group bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 group-hover:bg-blue-100">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">{title}</h3>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-sm text-slate-500 mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-slate-800">Atenção de estoque</h2>
              <p className="text-sm text-slate-500">SKUs abaixo do mínimo cadastrado.</p>
            </div>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">Nenhum produto abaixo do estoque mínimo.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.slice(0, 6).map((product) => (
                <div key={product.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-800 truncate">{product.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
                  </div>
                  <div className="text-right text-sm shrink-0">
                    <div className="font-semibold text-red-600">{product.total_stock} {product.unit_base}</div>
                    <div className="text-slate-500">mín. {product.min_stock}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5">
          <h2 className="font-semibold text-slate-800">Módulos complementares</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Continuam disponíveis quando a operação precisar, mas não são o foco principal do WMS.
          </p>
          <div className="space-y-2">
            <SecondaryAction
              label="Recebimentos"
              value={stats?.pendingReceipts ?? 0}
              icon={<Warehouse className="w-5 h-5" />}
              onClick={() => onNavigate('receiving')}
            />
            <SecondaryAction
              label="Expedições"
              value={stats?.pendingShipments ?? 0}
              icon={<Truck className="w-5 h-5" />}
              onClick={() => onNavigate('shipping')}
            />
            <SecondaryAction
              label="Cadastro de produtos"
              value={stats?.totalProducts ?? 0}
              icon={<Package className="w-5 h-5" />}
              onClick={() => onNavigate('inventory')}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function SecondaryAction({
  label,
  value,
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-white border border-slate-200 rounded-lg p-3 flex items-center gap-3 text-left hover:border-blue-300"
    >
      <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-500">{value}</div>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-400" />
    </button>
  );
}
