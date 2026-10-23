import { useState } from 'react';
import { Truck, Clock, Package, CheckCircle, XCircle, Plus } from 'lucide-react';
import { ShippingOrder } from '../types';
import { shippingOrders as initialOrders } from '../data';

export default function Shipping() {
  const [orders, setOrders] = useState<ShippingOrder[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredOrders = orders.filter(o => 
    statusFilter === 'all' || o.status === statusFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'picking': return <Package className="w-4 h-4" />;
      case 'packed': return <CheckCircle className="w-4 h-4" />;
      case 'shipped': return <Truck className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-slate-100 text-slate-700';
      case 'picking': return 'bg-amber-100 text-amber-700';
      case 'packed': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'picking': return 'Separação';
      case 'packed': return 'Embalado';
      case 'shipped': return 'Enviado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  const advanceStatus = (orderId: string) => {
    const statusFlow: Record<string, string> = {
      'pending': 'picking',
      'picking': 'packed',
      'packed': 'shipped',
    };
    setOrders(orders.map(o => {
      if (o.id === orderId && statusFlow[o.status]) {
        return { ...o, status: statusFlow[o.status] as ShippingOrder['status'] };
      }
      return o;
    }));
  };

  const summary = {
    pending: orders.filter(o => o.status === 'pending').length,
    picking: orders.filter(o => o.status === 'picking').length,
    packed: orders.filter(o => o.status === 'packed').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expedição</h1>
          <p className="text-slate-500">Ordens de expedição e despacho</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          Nova Expedição
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-slate-500" />
            <span className="text-sm text-slate-500">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-slate-700">{summary.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-500">Separação</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.picking}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-500">Embalados</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{summary.packed}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-4 h-4 text-green-500" />
            <span className="text-sm text-slate-500">Enviados</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{summary.shipped}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'picking', 'packed', 'shipped'].map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status === 'all' ? 'Todos' : getStatusLabel(status)}
          </button>
        ))}
      </div>

      {/* Orders */}
      <div className="space-y-4">
        {filteredOrders.map(order => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    order.priority === 'high' ? 'bg-red-100' :
                    order.priority === 'medium' ? 'bg-amber-100' : 'bg-green-100'
                  }`}>
                    <Truck className={`w-5 h-5 ${
                      order.priority === 'high' ? 'text-red-600' :
                      order.priority === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{order.orderNumber}</h3>
                    <p className="text-sm text-slate-500">{order.customer} • {order.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(order.priority)}`}>
                    {getPriorityLabel(order.priority)}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {getStatusLabel(order.status)}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">{order.carrier}</span>
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm text-slate-700">{item.productName}</span>
                    <span className="text-sm font-semibold text-slate-800">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            {order.status !== 'shipped' && order.status !== 'cancelled' && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => advanceStatus(order.id)}
                  className="px-3 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {order.status === 'pending' ? 'Iniciar Separação' :
                   order.status === 'picking' ? 'Confirmar Embalagem' :
                   'Despachar'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm border border-slate-100">
          Nenhuma ordem de expedição encontrada.
        </div>
      )}
    </div>
  );
}
