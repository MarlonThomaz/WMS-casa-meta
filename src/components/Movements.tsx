import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronLeft,
  Loader2,
  Plus,
  Search,
  Settings,
  Trash2,
} from 'lucide-react';
import { useCreateMovement, useMovement, useMovements } from '../hooks/useMovements';
import { useProducts } from '../hooks/useProducts';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import type { DBMovement } from '../types';

const typeLabel: Record<DBMovement['movement_type'], string> = {
  inbound: 'Entrada',
  outbound: 'Saída',
  transfer: 'Transferência',
  adjustment: 'Ajuste',
  count: 'Contagem',
};

const statusLabel: Record<DBMovement['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  failed: 'Falhou',
};

function typeClass(type: DBMovement['movement_type']) {
  switch (type) {
    case 'inbound': return 'bg-blue-100 text-blue-700';
    case 'outbound': return 'bg-red-100 text-red-700';
    case 'transfer': return 'bg-purple-100 text-purple-700';
    case 'adjustment': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function statusClass(status: DBMovement['status']) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-amber-100 text-amber-700';
    case 'in_progress': return 'bg-blue-100 text-blue-700';
    case 'cancelled':
    case 'failed': return 'bg-red-100 text-red-700';
  }
}

type ManualMovementType = Exclude<DBMovement['movement_type'], 'count'>;
type AdjustmentDirection = 'increase' | 'decrease';
type DraftLine = {
  product_id: string;
  quantity: number;
  from_location_id: string;
  to_location_id: string;
};

export default function Movements() {
  const { user } = useAuth();
  const { movements, loading, error, refresh } = useMovements();
  const [typeFilter, setTypeFilter] = useState<'all' | DBMovement['movement_type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DBMovement['status']>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';

  if (selectedId) {
    return <MovementDetail movementId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = movements.filter((movement) => {
    const matchesType = typeFilter === 'all' || movement.movement_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || movement.status === statusFilter;
    const matchesSearch =
      normalizedSearch.length === 0 ||
      movement.reference.toLowerCase().includes(normalizedSearch) ||
      movement.source_reference?.toLowerCase().includes(normalizedSearch) ||
      movement.notes?.toLowerCase().includes(normalizedSearch);
    return matchesType && matchesStatus && matchesSearch;
  });

  const summary = {
    inbound: movements.filter((m) => m.movement_type === 'inbound').length,
    outbound: movements.filter((m) => m.movement_type === 'outbound').length,
    transfer: movements.filter((m) => m.movement_type === 'transfer').length,
    adjustment: movements.filter((m) => m.movement_type === 'adjustment').length,
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Movimentações</h1>
          <p className="text-slate-500">Histórico e lançamento transacional de entradas, saídas, transferências e ajustes.</p>
        </div>
        {canOperate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> Nova movimentação
          </button>
        )}
      </div>

      {!canOperate && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          Seu perfil é somente leitura. Você pode consultar o histórico, mas não lançar movimentos.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Entradas" value={summary.inbound} icon={<ArrowDownToLine className="w-4 h-4" />} />
        <Summary label="Saídas" value={summary.outbound} icon={<ArrowUpFromLine className="w-4 h-4" />} />
        <Summary label="Transferências" value={summary.transfer} icon={<ArrowLeftRight className="w-4 h-4" />} />
        <Summary label="Ajustes" value={summary.adjustment} icon={<Settings className="w-4 h-4" />} />
      </div>

      <div className="grid md:grid-cols-[1fr_220px_220px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Referência, origem do documento ou observação..."
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="all">Todos os tipos</option>
          <option value="inbound">Entrada</option>
          <option value="outbound">Saída</option>
          <option value="transfer">Transferência</option>
          <option value="adjustment">Ajuste</option>
          <option value="count">Contagem</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="border border-slate-200 rounded-lg px-3 py-2 bg-white">
          <option value="all">Todos os status</option>
          <option value="pending">Pendente</option>
          <option value="in_progress">Em andamento</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
          <option value="failed">Falhou</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Referência</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Documento</th>
                <th className="text-left px-4 py-3">Data</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((movement) => (
                <tr key={movement.id} className="hover:bg-slate-50">
                  <td data-label="Referência" className="px-4 py-3 font-mono text-sm">{movement.reference}</td>
                  <td data-label="Tipo" className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs ${typeClass(movement.movement_type)}`}>{typeLabel[movement.movement_type]}</span></td>
                  <td data-label="Documento" className="px-4 py-3 text-sm text-slate-600">{movement.source_reference || '—'}</td>
                  <td data-label="Data" className="px-4 py-3 text-sm text-slate-600">{new Date(movement.created_at).toLocaleString('pt-BR')}</td>
                  <td data-label="Status" className="px-4 py-3"><span className={`inline-flex px-2 py-1 rounded-full text-xs ${statusClass(movement.status)}`}>{statusLabel[movement.status]}</span></td>
                  <td data-label="Ação" className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setSelectedId(movement.id)} className="text-sm text-blue-600 font-medium hover:text-blue-800">Ver linhas</button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-slate-400">Nenhuma movimentação encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-slate-500">Carregando movimentações...</div>}
      </div>

      {showCreate && (
        <CreateMovementModal
          onClose={() => setShowCreate(false)}
          onCreated={async (movementId) => {
            setShowCreate(false);
            await refresh();
            setSelectedId(movementId);
          }}
        />
      )}
    </div>
  );
}

function CreateMovementModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> | void }) {
  const { products } = useProducts();
  const { locations } = useLocations();
  const { createMovement, loading } = useCreateMovement();
  const [movementType, setMovementType] = useState<ManualMovementType>('transfer');
  const [adjustmentDirection, setAdjustmentDirection] = useState<AdjustmentDirection>('increase');
  const [sourceReference, setSourceReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: '', quantity: 1, from_location_id: '', to_location_id: '' },
  ]);

  const needsFrom = movementType === 'outbound' || movementType === 'transfer' || (movementType === 'adjustment' && adjustmentDirection === 'decrease');
  const needsTo = movementType === 'inbound' || movementType === 'transfer' || (movementType === 'adjustment' && adjustmentDirection === 'increase');

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      for (const line of lines) {
        if (!line.product_id || !Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('Preencha produto e quantidade válida em todas as linhas.');
        if (needsFrom && !line.from_location_id) throw new Error('Selecione a localização de origem em todas as linhas.');
        if (needsTo && !line.to_location_id) throw new Error('Selecione a localização de destino em todas as linhas.');
        if (movementType === 'transfer' && line.from_location_id === line.to_location_id) throw new Error('Origem e destino da transferência precisam ser diferentes.');
      }

      const result = await createMovement({
        movement_type: movementType,
        source_reference: sourceReference.trim() || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((line) => ({
          product_id: line.product_id,
          quantity: line.quantity,
          from_location_id: needsFrom ? line.from_location_id : undefined,
          to_location_id: needsTo ? line.to_location_id : undefined,
          unit: products.find((product) => product.id === line.product_id)?.unit_base || 'un',
        })),
      });

      await onCreated(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar movimentação');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Nova movimentação</h2>
            <p className="text-sm text-slate-500">O lançamento é validado e processado atomicamente no banco.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500">Fechar</button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div className="grid md:grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="block font-medium text-slate-700 mb-1">Tipo</span>
              <select value={movementType} onChange={(event) => setMovementType(event.target.value as ManualMovementType)} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="inbound">Entrada</option>
                <option value="outbound">Saída</option>
                <option value="transfer">Transferência</option>
                <option value="adjustment">Ajuste</option>
              </select>
            </label>

            {movementType === 'adjustment' && (
              <label className="text-sm">
                <span className="block font-medium text-slate-700 mb-1">Direção do ajuste</span>
                <select value={adjustmentDirection} onChange={(event) => setAdjustmentDirection(event.target.value as AdjustmentDirection)} className="w-full border rounded-lg px-3 py-2 bg-white">
                  <option value="increase">Adicionar saldo</option>
                  <option value="decrease">Retirar saldo</option>
                </select>
              </label>
            )}

            <label className="text-sm">
              <span className="block font-medium text-slate-700 mb-1">Documento/referência (opcional)</span>
              <input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block font-medium text-slate-700 mb-1">Observação (opcional)</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Itens</h3>
              <button type="button" onClick={() => setLines((current) => [...current, { product_id: '', quantity: 1, from_location_id: '', to_location_id: '' }])} className="text-sm text-blue-600">+ Adicionar linha</button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid md:grid-cols-[2fr_1fr_1.5fr_1.5fr_auto] gap-3 p-3 border border-slate-200 rounded-lg items-end">
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Produto</span>
                  <select value={line.product_id} onChange={(event) => updateLine(index, { product_id: event.target.value })} className="w-full border rounded-lg px-2 py-2 bg-white" required>
                    <option value="">Selecione...</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Quantidade</span>
                  <input type="number" inputMode="decimal" min={0.0001} step="any" value={line.quantity} onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })} className="w-full border rounded-lg px-2 py-2" required />
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Origem</span>
                  <select disabled={!needsFrom} value={line.from_location_id} onChange={(event) => updateLine(index, { from_location_id: event.target.value })} className="w-full border rounded-lg px-2 py-2 bg-white disabled:bg-slate-100">
                    <option value="">{needsFrom ? 'Selecione...' : 'Não se aplica'}</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-slate-600 mb-1">Destino</span>
                  <select disabled={!needsTo} value={line.to_location_id} onChange={(event) => updateLine(index, { to_location_id: event.target.value })} className="w-full border rounded-lg px-2 py-2 bg-white disabled:bg-slate-100">
                    <option value="">{needsTo ? 'Selecione...' : 'Não se aplica'}</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
                  </select>
                </label>
                <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="p-2 text-red-500 disabled:text-slate-300" title="Remover linha">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Processar movimentação
          </button>
        </div>
      </form>
    </div>
  );
}

function MovementDetail({ movementId, onBack }: { movementId: string; onBack: () => void }) {
  const { movement, loading, error } = useMovement(movementId);
  const { products } = useProducts();
  const { locations } = useLocations();

  const productNames = useMemo(() => new Map(products.map((product) => [product.id, `${product.sku} — ${product.name}`])), [products]);
  const locationNames = useMemo(() => new Map(locations.map((location) => [location.id, location.code])), [locations]);

  if (loading) return <div className="p-6 text-slate-500">Carregando movimentação...</div>;
  if (error || !movement) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={onBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error || 'Movimentação não encontrada'}</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-blue-600 mb-2"><ChevronLeft className="w-4 h-4" /> Voltar</button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-800">{movement.reference}</h1>
          <span className={`px-2 py-1 rounded-full text-xs ${typeClass(movement.movement_type)}`}>{typeLabel[movement.movement_type]}</span>
          <span className={`px-2 py-1 rounded-full text-xs ${statusClass(movement.status)}`}>{statusLabel[movement.status]}</span>
        </div>
        {movement.notes && <p className="text-slate-500 mt-2">{movement.notes}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="text-left px-4 py-3">Produto</th><th className="text-left px-4 py-3">Origem</th><th className="text-left px-4 py-3">Destino</th><th className="text-right px-4 py-3">Quantidade</th><th className="text-left px-4 py-3">Unidade</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movement.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="Produto" className="px-4 py-3 text-sm">{productNames.get(line.product_id) || line.product_id}</td>
                  <td data-label="Origem" className="px-4 py-3 text-sm">{line.from_location_id ? locationNames.get(line.from_location_id) || line.from_location_id : '—'}</td>
                  <td data-label="Destino" className="px-4 py-3 text-sm">{line.to_location_id ? locationNames.get(line.to_location_id) || line.to_location_id : '—'}</td>
                  <td data-label="Quantidade" className="px-4 py-3 text-sm text-right font-medium">{line.quantity}</td>
                  <td data-label="Unidade" className="px-4 py-3 text-sm">{line.unit}</td>
                </tr>
              ))}
              {movement.lines.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Sem linhas registradas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-slate-500 text-sm">{icon}{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
