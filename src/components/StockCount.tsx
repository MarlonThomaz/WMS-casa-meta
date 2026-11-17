import { FormEvent, useEffect, useRef, useState } from 'react';
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
import LocationSearchSelect from './LocationSearchSelect';
import type { LocationSearchOption } from '../services/locationSearch';
import { canCompleteCount } from '../services/stockCounts';
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

const PAGE_SIZE = 50;

function Pagination({page,total,busy,onChange}:{page:number;total:number;busy:boolean;onChange:(page:number)=>void}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t border-slate-200 text-sm">
    <span aria-live="polite">{total} resultado(s) · Página {page} de {pages}</span>
    <div className="flex gap-2">
      <button type="button" disabled={busy || page <= 1} onClick={() => onChange(page-1)} className="px-3 py-2 border rounded disabled:opacity-40">Anterior</button>
      <button type="button" disabled={busy || page >= pages} onClick={() => onChange(page+1)} className="px-3 py-2 border rounded disabled:opacity-40">Próxima</button>
    </div>
  </div>;
}

export default function StockCount() {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const [page, setPage] = useState(1);
  const { counts, total, loading, error, refresh } = useStockCounts(page,PAGE_SIZE);
  useEffect(() => {
    if (!loading && !error) setPage(current => Math.min(current, Math.max(1,Math.ceil(total/PAGE_SIZE))));
  },[loading,error,total]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
                    {count.location_id ? count.location_code || count.location_id : 'Todas as localizações'}
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
        <Pagination page={page} total={total} busy={loading} onChange={setPage} />
      </div>

      {showCreate && (
        <CreateStockCountModal
          onClose={() => setShowCreate(false)}
          onCreated={async (id) => {
            setShowCreate(false);
            setPage(1);
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
  const [page,setPage] = useState(1);
  const [query,setQuery] = useState('');
  const [search,setSearch] = useState('');
  const {lines,total,progress,loading:linesLoading,error:linesError,refresh:refreshLines} =
    useStockCountLines(countId,search,page,PAGE_SIZE);
  const [busy,setBusy] = useState(false);
  const [drafts,setDrafts] = useState<Record<string,string>>({});
  const writeLock = useRef(false);
  const dirtyCount = Object.keys(drafts).length;
  useEffect(() => {
    const timer = window.setTimeout(() => {setSearch(query.trim());setPage(1);},250);
    return () => window.clearTimeout(timer);
  },[query]);
  useEffect(() => {
    if (!linesLoading && !linesError) setPage(current => Math.min(current,Math.max(1,Math.ceil(total/PAGE_SIZE))));
  },[linesLoading,linesError,total]);
  const searching = query.trim() !== search;
  const locked = busy || loading || linesLoading || searching || Boolean(linesError);
  const saveLine = async (id:string) => {
    if (locked || writeLock.current || !(id in drafts)) return;
    const raw = drafts[id].trim();
    const value = Number(raw);
    if (!raw || !Number.isFinite(value) || value < 0) {
      alert('Informe uma quantidade física válida, inclusive zero.');
      return;
    }
    writeLock.current = true;
    setBusy(true);
    try {
      const {updateCountedQuantity} = await import('../services/stockCounts');
      await updateCountedQuantity(id,value);
      setDrafts(current => {const next = {...current};delete next[id];return next;});
      await refreshAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar contagem');
    } finally {writeLock.current = false;setBusy(false);}
  };
  const safeBack = () => {
    if (!dirtyCount || window.confirm('Existem quantidades não confirmadas. Descartá-las e voltar?')) onBack();
  };

  const refreshAll = async () => {
    await Promise.all([refreshCount(), refreshLines()]);
  };

  if (loading && !count) {
    return <div className="p-6 text-slate-500">Carregando contagem...</div>;
  }

  if (error || !count) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={safeBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || 'Contagem não encontrada'}
        </div>
      </div>
    );
  }

  const confirmedLines = progress?.confirmed ?? 0;
  const allLinesConfirmed = !locked && dirtyCount === 0 && canCompleteCount(progress);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button type="button" onClick={safeBack} disabled={busy} className="text-blue-600 hover:text-blue-800 mb-2 disabled:opacity-40">
            ← Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800">Contagem {count.count_number}</h1>
          <p className="text-slate-500">
            {typeLabel[count.count_type]} · {progress ? `${progress.total} linhas no snapshot · ${confirmedLines}/${progress.total} confirmadas · ${progress.discrepancies} divergências` : 'Consultando progresso global…'}
          </p>
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
              disabled={!allLinesConfirmed}
              title={allLinesConfirmed ? 'Concluir contagem' : 'Confirme todas as linhas antes de concluir'}
              onClick={async () => {
                if (!window.confirm('Concluir a contagem e aplicar as divergências ao estoque?')) return;
                try {
                  setBusy(true);
                  const { completeStockCount } = await import('../services/stockCounts');
                  const result = await completeStockCount(countId);
                  await refreshAll();
                  alert(result.discrepancies === null ? 'Contagem concluída. Atualize a tela para consultar as divergências.' : `Contagem concluída. ${result.discrepancies} divergência(s) ajustada(s).`);
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Erro ao concluir contagem');
                } finally {
                  setBusy(false);
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" /> Concluir
            </button>
          )}

          {canOperate && (count.status === 'pending' || count.status === 'in_progress') && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Cancelar esta contagem? Quantidades não confirmadas serão descartadas.')) return;
                try {
                  setBusy(true);
                  const { cancelStockCount } = await import('../services/stockCounts');
                  await cancelStockCount(countId);
                  setDrafts({});
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

      {count.status === 'in_progress' && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Digite a quantidade física e confirme com o botão ou Enter, inclusive para zero.
          {progress && ` Restam ${Math.max(0,progress.total-confirmedLines)} linha(s) em toda a contagem.`}
          {dirtyCount > 0 && <p className="mt-1 font-semibold">{dirtyCount} edição(ões) aguardando confirmação. As edições são mantidas ao trocar de página ou pesquisar.</p>}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-48 text-sm font-medium text-slate-700">
          Buscar linhas por SKU, produto ou endereço
          <input type="search" value={query} disabled={busy} onChange={event => setQuery(event.target.value)}
            placeholder="Ex.: SKU-011 ou A-01" className="block w-full px-3 py-2 mt-1 border rounded-lg bg-white" />
        </label>
        <button type="button" disabled={busy || linesLoading} onClick={() => void refreshAll()} className="px-3 py-2 border rounded-lg disabled:opacity-40">Atualizar</button>
      </div>
      {linesError && <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-lg">{linesError}. Atualize para tentar novamente.</p>}
      {(linesLoading || searching) && <p role="status" className="text-sm text-slate-500">Carregando linhas…</p>}

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
              {!linesLoading && !searching && !linesError && lines.length === 0 && <tr><td colSpan={6} className="text-center p-5 text-slate-500">Nenhuma linha encontrada.</td></tr>}
              {!searching && lines.map((line) => {
                const systemQuantity = Number(line.system_quantity);
                const countedQuantity = Number(line.counted_quantity);
                const isCounted = Boolean(line.counted_at);
                const difference = isCounted ? countedQuantity - systemQuantity : 0;
                const hasDifference = isCounted && difference !== 0;

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
                        <div className="flex flex-wrap justify-end items-center gap-1">
                          <input type="number" inputMode="decimal" min={0} step="any"
                            aria-label={`Quantidade física de ${line.products?.sku || line.product_id} em ${line.locations?.code || line.location_id}`}
                            value={drafts[line.id] ?? (isCounted ? String(countedQuantity) : '')}
                            placeholder="Contar" disabled={locked}
                            onChange={event => {const value = event.target.value;setDrafts(current => ({...current,[line.id]:value}));}}
                            onKeyDown={event => {if(event.key === 'Enter') {event.preventDefault();void saveLine(line.id);}}}
                            className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                          />
                          <button type="button" disabled={locked || !(line.id in drafts)}
                            onClick={() => void saveLine(line.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-40">Confirmar</button>
                          {line.id in drafts && <button type="button" disabled={busy} onClick={() => setDrafts(current => {const next={...current};delete next[line.id];return next;})} className="px-1 text-xs text-slate-600 underline">Descartar</button>}
                        </div>
                      ) : (
                        <span className="text-sm">{isCounted ? countedQuantity : '—'}</span>
                      )}
                    </td>
                    <td data-label="Diferença" className={`px-4 py-3 text-sm text-right font-semibold ${isCounted ? (difference > 0 ? 'text-green-700' : difference < 0 ? 'text-red-700' : 'text-slate-600') : 'text-slate-400'}`}>
                      {isCounted ? `${difference > 0 ? '+' : ''}${difference}` : '—'}
                    </td>
                    <td data-label="Resultado" className="px-4 py-3 text-sm">
                      {!isCounted ? (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <AlertCircle className="w-4 h-4" /> Não contado
                        </span>
                      ) : hasDifference ? (
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
        <Pagination page={page} total={total} busy={locked} onChange={setPage} />
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
  const [countType, setCountType] = useState<StockCountRecord['count_type']>('cycle');
  const [location, setLocation] = useState<LocationSearchOption | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLocation = countType !== 'full';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (needsLocation && !location) {
      setError('Selecione a localização que será contada.');
      return;
    }

    try {
      setLoading(true);
      const { createStockCount } = await import('../services/stockCounts');
      const created = await createStockCount({
        count_type: countType,
        location_id: needsLocation ? location?.id : undefined,
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
                if (next === 'full') setLocation(null);
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
              <LocationSearchSelect value={location} onChange={setLocation} mode="any"
                disabled={loading} placeholder="Pesquisar qualquer endereço..." />
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
            disabled={loading || (needsLocation && !location)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Criando snapshot...' : 'Criar contagem'}
          </button>
        </div>
      </form>
    </div>
  );
}
