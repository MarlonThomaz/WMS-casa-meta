import { useState, useEffect } from 'react';
import { useReceipts, useCreateReceipt, useConfirmReceipt, useCancelReceipt, useUpdateReceivedQuantity } from '../hooks/useReceiving';
import { useAuth } from '../contexts/AuthContext';
import { Plus, CheckCircle, XCircle, Clock, AlertCircle, Package } from 'lucide-react';
import { receivingOrders as demoReceipts } from '../data';
import { ReceivingOrder } from '../types';

export default function Receiving() {
  const { user } = useAuth();
  const { receipts: supabaseReceipts, loading: supabaseLoading, error: supabaseError, refresh } = useReceipts();
  const { createNewReceipt, loading: creating } = useCreateReceipt();
  const { confirm, loading: confirming } = useConfirmReceipt();
  const { cancel, loading: cancelling } = useCancelReceipt();
  const { update, loading: updating } = useUpdateReceivedQuantity();
  
  // Usar dados do Supabase se disponíveis, senão usar dados de demonstração
  const [receipts, setReceipts] = useState<ReceivingOrder[]>(demoReceipts);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ReceivingOrder['status']>('all');
  const [showModal, setShowModal] = useState(false);

  // Tentar carregar do Supabase
  useEffect(() => {
    if (!supabaseLoading && supabaseReceipts.length > 0 && !usingSupabase) {
      setReceipts(supabaseReceipts as unknown as ReceivingOrder[]);
      setUsingSupabase(true);
    }
  }, [supabaseLoading, supabaseReceipts]);

  const filteredReceipts = receipts.filter(r => 
    statusFilter === 'all' || r.status === statusFilter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'partial': return <AlertCircle className="w-4 h-4" />;
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'cancelled': return <XCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'partial': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'partial': return 'Parcial';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      if (usingSupabase) {
        await confirm(orderId);
        await refresh();
      } else {
        setReceipts(receipts.map(o => 
          o.id === orderId 
            ? { ...o, status: 'completed' as const, items: o.items.map((i: any) => ({ ...i, received: i.expected })) }
            : o
        ));
      }
    } catch (error) {
      alert('Erro ao confirmar recebimento: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta ordem de recebimento?')) return;
    
    try {
      if (usingSupabase) {
        await cancel(orderId);
        await refresh();
      } else {
        setReceipts(receipts.map(o => 
          o.id === orderId ? { ...o, status: 'cancelled' as const } : o
        ));
      }
    } catch (error) {
      alert('Erro ao cancelar recebimento: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const summary = {
    pending: receipts.filter(o => o.status === 'pending').length,
    partial: receipts.filter(o => o.status === 'partial').length,
    completed: receipts.filter(o => o.status === 'completed').length,
    cancelled: receipts.filter(o => o.status === 'cancelled').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recebimento</h1>
          <p className="text-slate-500">
            Ordens de recebimento e conferência
            {usingSupabase && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Conectado ao Supabase
              </span>
            )}
            {!usingSupabase && !supabaseLoading && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Modo demonstração
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Ordem
        </button>
      </div>

      {/* Error message */}
      {supabaseError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Usando dados de demonstração</p>
            <p className="text-xs text-amber-700 mt-1">
              Não foi possível conectar ao Supabase: {supabaseError}. Configure o arquivo .env e execute as migrations.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-500">Pendentes</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-500">Parciais</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{summary.partial}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-slate-500">Concluídos</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{summary.completed}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm text-slate-500">Cancelados</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.cancelled}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pending', 'partial', 'completed', 'cancelled'] as const).map(status => (
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

      {/* Orders List */}
      <div className="space-y-4">
        {filteredReceipts.map(order => (
          <div key={order.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{order.orderNumber}</h3>
                  <p className="text-sm text-slate-500">{order.supplier} • {order.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                  {getStatusIcon(order.status)}
                  {getStatusLabel(order.status)}
                </span>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">{order.dock}</span>
              </div>
            </div>
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase">
                    <th className="text-left pb-2">Produto</th>
                    <th className="text-center pb-2">Esperado</th>
                    <th className="text-center pb-2">Recebido</th>
                    <th className="text-center pb-2">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => {
                    const progress = item.expected > 0 ? (item.received / item.expected) * 100 : 0;
                    return (
                      <tr key={idx} className="border-t border-slate-50">
                        <td className="py-2 text-sm text-slate-700">{item.productName}</td>
                        <td className="py-2 text-center text-sm text-slate-600">{item.expected}</td>
                        <td className="py-2 text-center text-sm font-medium text-slate-700">{item.received}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-blue-500' : 'bg-slate-200'
                                }`}
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-slate-500 w-10">{Math.round(progress)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(order.status === 'pending' || order.status === 'partial') && (
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => handleCancel(order.id)}
                  disabled={cancelling}
                  className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleComplete(order.id)}
                  disabled={confirming}
                  className="px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  Concluir Recebimento
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredReceipts.length === 0 && !supabaseLoading && (
        <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm border border-slate-100">
          Nenhuma ordem de recebimento encontrada.
        </div>
      )}

      {/* New Order Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">Nova Ordem de Recebimento</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nome do fornecedor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Doca</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option>Doca 1</option>
                  <option>Doca 2</option>
                  <option>Doca 3</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data Prevista</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Criar Ordem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
