import { Package, MapPin, AlertTriangle, TrendingUp } from 'lucide-react';
import { products } from '../data';

export default function Dashboard() {
  const totalProducts = products.length;
  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);

  const stats = [
    { label: 'Total de SKUs', value: totalProducts, icon: Package, color: 'bg-blue-500' },
    { label: 'Itens em Estoque', value: totalItems.toLocaleString('pt-BR'), icon: TrendingUp, color: 'bg-green-500' },
    { label: 'Estoque Baixo', value: lowStockProducts.length, icon: AlertTriangle, color: 'bg-amber-500' },
    { label: 'Localizações', value: '30', icon: MapPin, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500">Visão geral do armazém</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-amber-800">Alerta de Estoque Baixo</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg p-3 border border-amber-100">
                <p className="text-sm font-medium text-slate-700">{product.name}</p>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-slate-500">Atual: <strong className="text-red-600">{product.quantity}</strong></span>
                  <span className="text-xs text-slate-500">Mínimo: {product.minStock}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
