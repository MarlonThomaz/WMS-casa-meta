import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronLeft,
  Search,
  Settings,
} from 'lucide-react';
import { useMovement, useMovements } from '../hooks/useMovements';
import { useProducts } from '../hooks/useProducts';
import { useLocations } from '../hooks/useLocations';
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
    case 'inbound':
      return 'bg-blue-100 text-blue-700';
    case 'outbound':
      return 'bg-red-100 text-red-700';
    case 'transfer':
      return 'bg-purple-100 text-purple-700';
    case 'adjustment':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function statusClass(status: DBMovement['status']) {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'cancelled':
    case 'failed':
      return 'bg-red-100 text-red-700';
  }
}

export default function Movements() {
  const { movements, loading, error } = useMovements();
  const [typeFilter, setTypeFilter] = useState<'all' | DBMovement['movement_type']>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | DBMovement['status']>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Movimentações</h1>
        <p className="text-slate-500">Histórico persistido de entradas, saídas, transferências e ajustes.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
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
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="all">Todos os tipos</option>
          <option value="inbound">Entrada</option>
          <option value="outbound">Saída</option>
          <option value="transfer">Transferência</option>
          <option value="adjustment">Ajuste</option>
          <option value="count">Contagem</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
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
          <table className="w-full">
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
                  <td className="px-4 py-3 font-mono text-sm">{movement.reference}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${typeClass(movement.movement_type)}`}>
                      {typeLabel[movement.movement_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{movement.source_reference || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{new Date(movement.created_at).toLocaleString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${statusClass(movement.status)}`}>
                      {statusLabel[movement.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(movement.id)}
                      className="text-sm text-blue-600 font-medium hover:text-blue-800"
                    >
                      Ver linhas
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Nenhuma movimentação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-slate-500">Carregando movimentações...</div>}
      </div>
    </div>
  );
}

function MovementDetail({ movementId, onBack }: { movementId: string; onBack: () => void }) {
  const { movement, loading, error } = useMovement(movementId);
  const { products } = useProducts();
  const { locations } = useLocations();

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, `${product.sku} — ${product.name}`])),
    [products]
  );
  const locationNames = useMemo(
    () => new Map(locations.map((location) => [location.id, location.code])),
    [locations]
  );

  if (loading) return <div className="p-6 text-slate-500">Carregando movimentação...</div>;
  if (error || !movement) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={onBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || 'Movimentação não encontrada'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-blue-600 mb-2">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-800">{movement.reference}</h1>
          <span className={`px-2 py-1 rounded-full text-xs ${typeClass(movement.movement_type)}`}>
            {typeLabel[movement.movement_type]}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs ${statusClass(movement.status)}`}>
            {statusLabel[movement.status]}
          </span>
        </div>
        {movement.notes && <p className="text-slate-500 mt-2">{movement.notes}</p>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-left px-4 py-3">Destino</th>
                <th className="text-right px-4 py-3">Quantidade</th>
                <th className="text-left px-4 py-3">Unidade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movement.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 text-sm">{productNames.get(line.product_id) || line.product_id}</td>
                  <td className="px-4 py-3 text-sm">{line.from_location_id ? locationNames.get(line.from_location_id) || line.from_location_id : '—'}</td>
                  <td className="px-4 py-3 text-sm">{line.to_location_id ? locationNames.get(line.to_location_id) || line.to_location_id : '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-medium">{line.quantity}</td>
                  <td className="px-4 py-3 text-sm">{line.unit}</td>
                </tr>
              ))}
              {movement.lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">Sem linhas registradas.</td>
                </tr>
              )}
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
