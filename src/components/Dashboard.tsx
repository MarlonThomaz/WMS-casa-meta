import {
  AlertCircle,
  AlertTriangle,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  TrendingUp,
  Warehouse,
} from 'lucide-react';
import { useDashboardStats } from '../hooks/useDashboard';
import { useProducts } from '../hooks/useProducts';

export default function Dashboard() {
  const { stats, loading, error, refresh } = useDashboardStats();
  const { products } = useProducts();

  const lowStockProducts = products.filter(
    (product) => product.active && product.total_stock <= product.min_stock
  );

  if (loading && !stats) {
    return <div className="p-6 text-slate-500">Carregando dashboard...</div>;
  }

  const cards = [
    {
      label: 'SKUs ativos',
      value: stats?.totalProducts ?? 0,
      icon: Package,
    },
    {
      label: 'Itens em estoque',
      value: (stats?.totalStock ?? 0).toLocaleString('pt-BR'),
      icon: TrendingUp,
    },
    {
      label: 'Localizações',
      value: stats?.totalLocations ?? 0,
      icon: MapPin,
    },
    {
      label: 'Estoque baixo',
      value: lowStockProducts.length,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">Visão geral do armazém com dados do Supabase.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
              </div>
              <div className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center">
                <Icon className="w-5 h-5 text-slate-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <OperationalCard
          label="Recebimentos em aberto"
          value={stats?.pendingReceipts ?? 0}
          icon={<Warehouse className="w-5 h-5" />}
        />
        <OperationalCard
          label="Expedições em aberto"
          value={stats?.pendingShipments ?? 0}
          icon={<Truck className="w-5 h-5" />}
        />
        <OperationalCard
          label="Posições ocupadas"
          value={`${stats?.occupiedLocations ?? 0} / ${stats?.totalLocations ?? 0}`}
          icon={<MapPin className="w-5 h-5" />}
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="font-semibold text-slate-800">Itens abaixo do mínimo</h2>
            <p className="text-sm text-slate-500">Comparação entre saldo total e estoque mínimo cadastrado.</p>
          </div>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Nenhum produto abaixo do estoque mínimo.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lowStockProducts.slice(0, 12).map((product) => (
              <div key={product.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-slate-800">{product.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-red-600">{product.total_stock} {product.unit_base}</div>
                  <div className="text-slate-500">mínimo {product.min_stock}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OperationalCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-sm text-slate-500">{label}</div>
        <div className="text-xl font-bold text-slate-800">{value}</div>
      </div>
    </div>
  );
}
