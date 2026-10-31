import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ClipboardCheck,
  Play,
  Plus,
  XCircle,
} from 'lucide-react';
import {
  useStockCount,
  useStockCountLines,
  useStockCounts,
} from '../hooks/useStockCounts';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import type { StockCount as StockCountRecord } from '../services/stockCounts';

const statusLabel: Record<StockCountRecord['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const typeLabel: Record<StockCountRecord['count_type'], string> = {
  full: 'Completa',
  cycle: 'Cíclica',
  spot: 'Pontual',
  reconciliation: 'Reconciliação',
};

function statusClass(status: StockCountRecord['status']) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
  }
}

export default function StockCount() {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { counts, loading, error, refresh } = useStockCounts();
  const { locations } = useLocations();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const locationCodes = useMemo(
    () => new Map(locations.map((location) => [location.id, location.code])),
    [locations]
  );

  if (selectedId) {
    return (
      <StockCountDetail
        countId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void refresh();
        }}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-blue-600" />
            Contagem física
          </h1>
          <p className="text-slate-500">
            Crie um snapshot do estoque, conte fisicamente e aplique somente a divergência.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!canOperate}
          title={canOperate ? 'Criar contagem' : 'Seu perfil é somente leitura'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Nova contagem
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Número</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Escopo</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Criada em</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {counts.map((count) => (
                <tr key={count.id} className="hover:bg-slate-50">
                  <td data-label="Número" className="px-4 py-3 text-sm font-mono font-medium">{count.count_number}</td>
                  <td data-label="Tipo" className="px-4 py-3 text-sm text-slate-600">{typeLabel[count.count_type]}</td>
                  <td data-label="Escopo" className="px-4 py-3 text-sm text-slate-600">
                    {count.location_id ? locationCodes.get(count.location_id) || count.location_id : 'Todas as localizações'}
                  </td>
                  <td data-label="Status" className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs ${statusClass(count.status)}`}>
                      {statusLabel[count.status]}
                    </span>
                  </td>
                  <td data-label="Criada em" className="px-4 py-3 text-sm text-slate-600">
                    {new Date(count.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td data-label="Ação" className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(count.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Abrir contagem
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && counts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma contagem encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-slate-500">Carregando contagens...</div>}
      </div>

      {showCreate && (
        <CreateStockCountModal
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => {
            setShowCreate(false);
            await refresh();
            setSelectedId(id);
          }}
        />
      )}
    </div>
  );
}

function StockCountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { count, loading, error, refresh: refreshCount } = useStockCount(countId);
  const {
    lines,
    loading: linesLoading,
    error: linesError,
    refresh: refreshLines,
  } = useStockCountLines(countId);
  const [busy, setBusy] = useState(false);

  const refreshAll = async () => {
    await Promise.all([refreshCount(), refreshLines()]);
  };

  if (loading || linesLoading) {
    return <div className="p-6 text-slate-500">Carregando contagem...</div>;
  }

  if (error || linesError || !count) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={onBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || linesError || 'Contagem não encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button type="button" onClick={onBack} className="text-blue-600 hover:text-blue-800 mb-2">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Contagem {count.count_number}</h1>
          <p className="text-slate-500">{typeLabel[count.count_type]} · {lines.length} linhas no snapshot</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canOperate && count.status === 'pending' && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                try {
                  setBusy(true);
                  const { startStockCount } = await import('../services/stockCounts');
                  await startStockCount(countId);
                  await refreshAll();
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Erro ao iniciar contagem');
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
              <Play className="w-4 h-4" /> Iniciar
            </button>
          )}

          {canOperate && count.status === 'in_progress' && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Concluir a contagem e aplicar as divergências ao estoque?')) return;
                try {
                  setBusy(true);
                  const { completeStockCount } = await import('../services/stockCounts');
                  const result = await completeStockCount(countId);
                  await refreshAll();
                  alert(`Contagem concluída. ${result.discrepancies} divergência(s) ajustada(s).`);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Erro ao concluir contagem');
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" /> Concluir
            </button>
          )}

          {canOperate && (count.status === 'pending' || count.status === 'in_progress') && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Cancelar esta contagem?')) return;
                try {
                  setBusy(true);
                  const { cancelStockCount } = await import('../services/stockCounts');
                  await cancelStockCount(countId);
                  await refreshAll();
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Erro ao cancelar contagem');
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>
      </div>

      {count.notes && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
          {count.notes}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Produto</th>
                <th className="px-4 py-3 text-left">Localização</th>
                <th className="px-4 py-3 text-right">Snapshot</th>
                <th className="px-4 py-3 text-right">Contado</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3 text-left">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lines.map((line) => {
                const systemQuantity = Number(line.system_quantity);
                const countedQuantity = Number(line.counted_quantity);
                const difference = countedQuantity - systemQuantity;
                const hasDifference = difference !== 0;

                return (
                  <tr key={line.id} className={hasDifference ? 'bg-amber-50/60' : ''}>
                    <td data-label="Produto" className="px-4 py-3 text-sm">
                      <div className="font-medium text-slate-900">{line.products?.name || line.product_id}</div>
                      {line.products?.sku && <div className="text-xs text-slate-500 font-mono">{line.products.sku}</div>}
                    </td>
                    <td data-label="Localização" className="px-4 py-3 text-sm text-slate-600">{line.locations?.code || line.location_id}</td>
                    <td data-label="Snapshot" className="px-4 py-3 text-sm text-right">{systemQuantity}</td>
                    <td data-label="Contado" className="px-4 py-3 text-right">
                      {count.status === 'in_progress' && canOperate ? (
                        <input
                          type="number" inputMode="decimal"
                          min={0}
                          step="any"
                          defaultValue={countedQuantity}
                          disabled={busy}
                          onBlur={async (event) => {
                            const value = Number(event.target.value);
                            if (!Number.isFinite(value) || value < 0 || value === countedQuantity) return;
                            try {
                              setBusy(true);
                              const { updateCountedQuantity } = await import('../services/stockCounts');
                              await updateCountedQuantity(line.id, value);
                              await refreshAll();
                            } catch (err) {
                              alert(err instanceof Error ? err.message : 'Erro ao atualizar contagem');
                              event.target.value = String(countedQuantity);
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                        />
                      ) : (
                        <span className="text-sm">{countedQuantity}</span>
                      )}
                    </td>
                    <td data-label="Diferença" className={`px-4 py-3 text-sm text-right font-semibold ${difference > 0 ? 'text-green-700' : difference < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                      {difference > 0 ? '+' : ''}{difference}
                    </td>
                    <td data-label="Resultado" className="px-4 py-3 text-sm">
                      {hasDifference ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertCircle className="w-4 h-4" /> Divergência
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-green-700">
                          <CheckCircle className="w-4 h-4" /> Correto
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CreateStockCountModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const { locations, loading: locationsLoading } = useLocations();
  const [countType, setCountType] = useState<StockCountRecord['count_type']>('cycle');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLocation = countType !== 'full';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (needsLocation && !locationId) {
      setError('Selecione a localização que será contada.');
      return;
    }

    try {
      setLoading(true);
      const { createStockCount } = await import('../services/stockCounts');
      const created = await createStockCount({
        count_type: countType,
        location_id: needsLocation ? locationId : undefined,
        notes: notes || undefined,
      });
      await onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar contagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90dvh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Nova contagem física</h2>
          <p className="text-sm text-slate-500 mt-1">O snapshot das linhas é criado automaticamente.</p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <label className="block text-sm">
            <span className="block font-medium text-slate-700 mb-2">Tipo de contagem</span>
            <select
              value={countType}
              onChange={(event) => {
                const next = event.target.value as StockCountRecord['count_type'];
                setCountType(next);
                if (next === 'full') setLocationId('');
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
            >
              <option value="cycle">Cíclica</option>
              <option value="spot">Pontual</option>
              <option value="full">Completa</option>
              <option value="reconciliation">Reconciliação</option>
            </select>
          </label>

          {needsLocation && (
            <label className="block text-sm">
              <span className="block font-medium text-slate-700 mb-2">Localização</span>
              <select
                required
                disabled={locationsLoading}
                value={locationId}
                onChange={(event) => setLocationId(event.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Selecione a localização</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.code} — Zona {location.zone}</option>
                ))}
              </select>
            </label>
          )}

          {countType === 'full' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              A contagem completa criará um snapshot de todos os saldos atuais do armazém.
            </div>
          )}

          <label className="block text-sm">
            <span className="block font-medium text-slate-700 mb-2">Observações</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Motivo da contagem, turno, responsável, etc."
            />
          </label>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || locationsLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Criando snapshot...' : 'Criar contagem'}
          </button>
        </div>
      </form>
    </div>
  );
}
