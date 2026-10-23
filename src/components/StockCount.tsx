import { useState } from 'react';
import { useStockCounts, useStockCount, useStockCountLines } from '../hooks/useStockCounts';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardCheck, Plus, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function StockCount() {
  const { user } = useAuth();
  const { counts, loading, error, refresh } = useStockCounts();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCount, setSelectedCount] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-green-100 text-green-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendente';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluída';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'full': return 'Completa';
      case 'cycle': return 'Cíclica';
      case 'spot': return 'Pontual';
      case 'reconciliation': return 'Reconciliação';
      default: return type;
    }
  };

  if (selectedCount) {
    return (
      <StockCountDetail
        countId={selectedCount}
        onBack={() => setSelectedCount(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-blue-600" />
            Contagem Física
          </h1>
          <p className="text-slate-500">Realize contagens físicas e ajuste divergências</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Contagem
        </button>
      </div>

      {error && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Número</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Criado em</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{count.count_number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{getTypeLabel(count.count_type)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(count.status)}`}>
                      {getStatusLabel(count.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {new Date(count.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedCount(count.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {counts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma contagem encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateStockCountModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function StockCountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {
  const { count, loading, error, refresh } = useStockCount(countId);
  const { lines, loading: linesLoading } = useStockCountLines(countId);

  if (loading || linesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !count) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-4">
          ← Voltar
        </button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error || 'Contagem não encontrada'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-2">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Contagem {count.count_number}</h1>
          <p className="text-slate-500">
            {count.count_type === 'full' ? 'Completa' : 
             count.count_type === 'cycle' ? 'Cíclica' : 
             count.count_type === 'spot' ? 'Pontual' : 'Reconciliação'}
          </p>
        </div>
        <div className="flex gap-2">
          {count.status === 'pending' && (
            <button
              onClick={async () => {
                const { startStockCount } = await import('../services/stockCounts');
                await startStockCount(countId);
                refresh();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Play className="w-4 h-4" />
              Iniciar Contagem
            </button>
          )}
          {count.status === 'in_progress' && (
            <button
              onClick={async () => {
                if (confirm('Deseja concluir esta contagem e gerar ajustes?')) {
                  const { completeStockCount } = await import('../services/stockCounts');
                  const result = await completeStockCount(countId);
                  alert(`Contagem concluída!\n${result.adjustments} ajustes gerados\n${result.discrepancies} divergências encontradas`);
                  refresh();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              Concluir Contagem
            </button>
          )}
          {(count.status === 'pending' || count.status === 'in_progress') && (
            <button
              onClick={async () => {
                if (confirm('Deseja cancelar esta contagem?')) {
                  const { cancelStockCount } = await import('../services/stockCounts');
                  await cancelStockCount(countId);
                  refresh();
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <XCircle className="w-4 h-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {count.notes && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-700">{count.notes}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Localização</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Sistema</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Contado</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Diferença</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {lines.map((line) => {
              const difference = line.counted_quantity - line.system_quantity;
              const hasDifference = difference !== 0;
              
              return (
                <tr key={line.id} className={hasDifference ? 'bg-amber-50' : ''}>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    <div className="font-medium">{(line as any).products?.name || 'Produto'}</div>
                    <div className="text-xs text-slate-500">{(line as any).products?.sku || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {(line as any).locations?.code || 'Localização'}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-slate-600">
                    {line.system_quantity}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {count.status === 'in_progress' ? (
                      <input
                        type="number"
                        defaultValue={line.counted_quantity}
                        onBlur={async (e) => {
                          const { updateCountedQuantity } = await import('../services/stockCounts');
                          await updateCountedQuantity(line.id, parseInt(e.target.value) || 0);
                          refresh();
                        }}
                        className="w-20 px-2 py-1 border border-slate-300 rounded text-center"
                      />
                    ) : (
                      line.counted_quantity
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span className={
                      difference > 0 ? 'text-green-600 font-semibold' :
                      difference < 0 ? 'text-red-600 font-semibold' :
                      'text-slate-600'
                    }>
                      {difference > 0 ? '+' : ''}{difference}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {hasDifference ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                        <AlertCircle className="w-3 h-3" />
                        Divergência
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        Correto
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Nenhum item nesta contagem
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateStockCountModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [countType, setCountType] = useState<'full' | 'cycle' | 'spot' | 'reconciliation'>('cycle');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { createStockCount } = await import('../services/stockCounts');
      await createStockCount({
        count_type: countType,
        operator_id: user?.id,
        notes,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar contagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Nova Contagem Física</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tipo de Contagem
            </label>
            <select
              value={countType}
              onChange={(e) => setCountType(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="cycle">Cíclica (rotina)</option>
              <option value="spot">Pontual (área específica)</option>
              <option value="full">Completa (todo inventário)</option>
              <option value="reconciliation">Reconciliação (ajuste)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Motivo da contagem, área específica, etc."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Criando...' : 'Criar Contagem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
