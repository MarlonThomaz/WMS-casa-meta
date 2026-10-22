import { Package, MapPin, AlertTriangle, TrendingUp, ArrowDown, ArrowUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { products, movements, receivingOrders, shippingOrders, locations } from '../data';

export default function Dashboard() {
  const totalProducts = products.length;
  const totalItems = products.reduce((sum, p) => sum + p.quantity, 0);
  const lowStockProducts = products.filter(p => p.quantity <= p.minStock);
  const occupiedLocations = locations.filter(l => l.status === 'occupied').length;
  const totalLocations = locations.length;
  const pendingReceiving = receivingOrders.filter(r => r.status === 'pending' || r.status === 'partial').length;
  const pendingShipping = shippingOrders.filter(s => s.status === 'pending' || s.status === 'picking').length;

  const stats = [
    { label: 'Total de SKUs', value: totalProducts, icon: Package, color: 'bg-blue-500', change: '+3 este mês' },
    { label: 'Itens em Estoque', value: totalItems.toLocaleString('pt-BR'), icon: TrendingUp, color: 'bg-green-500', change: '+12% vs mês anterior' },
    { label: 'Estoque Baixo', value: lowStockProducts.length, icon: AlertTriangle, color: 'bg-amber-500', change: 'Atenção necessária' },
    { label: 'Localizações Ocupadas', value: `${occupiedLocations}/${totalLocations}`, icon: MapPin, color: 'bg-purple-500', change: `${Math.round((occupiedLocations/totalLocations)*100)}% ocupação` },
    { label: 'Recebimentos Pendentes', value: pendingReceiving, icon: ArrowDown, color: 'bg-cyan-500', change: 'Aguardando doca' },
    { label: 'Expedições Pendentes', value: pendingShipping, icon: ArrowUp, color: 'bg-rose-500', change: 'Em processamento' },
  ];

  const categoryData = [
    { name: 'Eletrônicos', value: products.filter(p => p.category === 'Eletrônicos').reduce((s, p) => s + p.quantity, 0) },
    { name: 'Periféricos', value: products.filter(p => p.category === 'Periféricos').reduce((s, p) => s + p.quantity, 0) },
    { name: 'Componentes', value: products.filter(p => p.category === 'Componentes').reduce((s, p) => s + p.quantity, 0) },
    { name: 'Cabos', value: products.filter(p => p.category === 'Cabos').reduce((s, p) => s + p.quantity, 0) },
  ];

  const movementData = [
    { name: 'Seg', entradas: 45, saidas: 32 },
    { name: 'Ter', entradas: 52, saidas: 41 },
    { name: 'Qua', entradas: 38, saidas: 55 },
    { name: 'Qui', entradas: 65, saidas: 48 },
    { name: 'Sex', entradas: 71, saidas: 62 },
    { name: 'Sáb', entradas: 20, saidas: 15 },
    { name: 'Dom', entradas: 5, saidas: 3 },
  ];

  const zoneData = [
    { name: 'Zona A', ocupacao: 78 },
    { name: 'Zona B', ocupacao: 65 },
    { name: 'Zona C', ocupacao: 50 },
    { name: 'Zona D', ocupacao: 0 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  const recentMovements = movements.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-500">Visão geral do armazém</p>
        </div>
        <div className="text-sm text-slate-500">
          Última atualização: {new Date().toLocaleString('pt-BR')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-400 mt-1">{stat.change}</p>
                </div>
                <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Movement Chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Movimentações da Semana</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={movementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="entradas" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              <Line type="monotone" dataKey="saidas" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-xs text-slate-500">Entradas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-xs text-slate-500">Saídas</span>
            </div>
          </div>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Estoque por Categoria</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {categoryData.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {categoryData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }}></div>
                <span className="text-xs text-slate-500">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zone Occupancy & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Zone Occupancy */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Ocupação por Zona</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={zoneData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip />
              <Bar dataKey="ocupacao" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Movements */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Últimas Movimentações</h3>
          <div className="space-y-3">
            {recentMovements.map((mov) => (
              <div key={mov.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    mov.type === 'inbound' ? 'bg-blue-100 text-blue-600' :
                    mov.type === 'outbound' ? 'bg-red-100 text-red-600' :
                    mov.type === 'transfer' ? 'bg-purple-100 text-purple-600' :
                    'bg-amber-100 text-amber-600'
                  }`}>
                    {mov.type === 'inbound' ? '↓' : mov.type === 'outbound' ? '↑' : mov.type === 'transfer' ? '↔' : '±'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{mov.productName}</p>
                    <p className="text-xs text-slate-400">{mov.reference} • {mov.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    mov.status === 'completed' ? 'bg-green-100 text-green-700' :
                    mov.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {mov.status === 'completed' ? 'Concluído' : mov.status === 'pending' ? 'Pendente' : 'Cancelado'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
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
