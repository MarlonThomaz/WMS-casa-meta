import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Clock,
  Package,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  useCancelReceipt,
  useConfirmReceipt,
  useCreateReceipt,
  useReceipt,
  useReceipts,
  useUpdateReceivedQuantity,
} from '../hooks/useReceiving';
import { useProducts } from '../hooks/useProducts';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import type { DBReceipt } from '../types';

const statusLabel: Record<DBReceipt['status'], string> = {
  pending: 'Pendente',
  partial: 'Parcial',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const statusClass: Record<DBReceipt['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  partial: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

type DraftLine = {
  product_id: string;
  expected_quantity: number;
  location_id: string;
};

export default function Receiving() {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { receipts, loading, error, refresh } = useReceipts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | DBReceipt['status']>('all');

  if (selectedId) {
    return (
      <ReceiptDetail
        receiptId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void refresh();
        }}
      />
    );
  }

  const filtered = receipts.filter((receipt) => filter === 'all' || receipt.status === filter);
  const counts = {
    pending: receipts.filter((r) => r.status === 'pending').length,
    partial: receipts.filter((r) => r.status === 'partial').length,
    completed: receipts.filter((r) => r.status === 'completed').length,
    cancelled: receipts.filter((r) => r.status === 'cancelled').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recebimento</h1>
          <p className="text-slate-500">Ordens reais de recebimento e conferência.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!canOperate}
          title={canOperate ? 'Criar recebimento' : 'Seu perfil é somente leitura'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Nova ordem
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Summary label="Pendentes" value={counts.pending} icon={<Clock className="w-4 h-4" />} />
        <Summary label="Parciais" value={counts.partial} icon={<AlertCircle className="w-4 h-4" />} />
        <Summary label="Concluídos" value={counts.completed} icon={<CheckCircle className="w-4 h-4" />} />
        <Summary label="Cancelados" value={counts.cancelled} icon={<XCircle className="w-4 h-4" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'partial', 'completed', 'cancelled'] as const).map((status) => (
          <button
            type="button"
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-2 rounded-lg text-sm border ${
              filter === status
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-slate-200 text-slate-600'
            }`}
          >
            {status === 'all' ? 'Todos' : statusLabel[status]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Número</th>
                <th className="text-left px-4 py-3">Fornecedor</th>
                <th className="text-left px-4 py-3">Previsto</th>
                <th className="text-left px-4 py-3">Doca</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-sm">{receipt.receipt_number}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{receipt.supplier_name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{receipt.expected_date || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{receipt.dock || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${statusClass[receipt.status]}`}>
                      {statusLabel[receipt.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(receipt.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Conferir
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhum recebimento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-slate-500">Carregando recebimentos...</div>}
      </div>

      {showCreate && (
        <CreateReceiptModal
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

function ReceiptDetail({ receiptId, onBack }: { receiptId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { receipt, loading, error, refresh } = useReceipt(receiptId);
  const { products } = useProducts();
  const { locations } = useLocations();
  const { update, loading: updating } = useUpdateReceivedQuantity();
  const { confirm, loading: confirming } = useConfirmReceipt();
  const { cancel, loading: cancelling } = useCancelReceipt();

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, `${product.sku} — ${product.name}`])),
    [products]
  );
  const locationNames = useMemo(
    () => new Map(locations.map((location) => [location.id, location.code])),
    [locations]
  );

  if (loading) return <div className="p-6 text-slate-500">Carregando recebimento...</div>;

  if (error || !receipt) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={onBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || 'Recebimento não encontrado'}
        </div>
      </div>
    );
  }

  const editable = canOperate && (receipt.status === 'pending' || receipt.status === 'partial');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-blue-600 mb-2">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{receipt.receipt_number}</h1>
          <p className="text-slate-500">{receipt.supplier_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${statusClass[receipt.status]}`}>
          {statusLabel[receipt.status]}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Destino</th>
                <th className="text-right px-4 py-3">Esperado</th>
                <th className="text-right px-4 py-3">Já processado</th>
                <th className="text-right px-4 py-3">Recebido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipt.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-3 text-sm">{productNames.get(line.product_id) || line.product_id}</td>
                  <td className="px-4 py-3 text-sm">{line.location_id ? locationNames.get(line.location_id) || line.location_id : '—'}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.expected_quantity}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.processed_quantity || 0}</td>
                  <td className="px-4 py-3 text-right">
                    {editable ? (
                      <input
                        type="number"
                        min={line.processed_quantity || 0}
                        max={line.expected_quantity}
                        defaultValue={line.received_quantity}
                        disabled={updating}
                        onBlur={async (event) => {
                          const quantity = Number(event.target.value);
                          if (!Number.isFinite(quantity)) return;
                          if (quantity === line.received_quantity) return;
                          try {
                            await update(line.id, quantity);
                            await refresh();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Erro ao atualizar quantidade');
                            event.target.value = String(line.received_quantity);
                          }
                        }}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                      />
                    ) : (
                      <span className="text-sm">{line.received_quantity}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editable && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={cancelling || confirming}
            onClick={async () => {
              if (!window.confirm('Cancelar este recebimento?')) return;
              try {
                await cancel(receipt.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao cancelar');
              }
            }}
            className="px-4 py-2 border border-red-200 text-red-700 rounded-lg disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={confirming || cancelling || receipt.lines.length === 0}
            onClick={async () => {
              try {
                await confirm(receipt.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao processar recebimento');
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            Processar recebido
          </button>
        </div>
      )}
    </div>
  );
}

function CreateReceiptModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const { products } = useProducts();
  const { locations } = useLocations();
  const { createNewReceipt, loading } = useCreateReceipt();
  const [supplier, setSupplier] = useState('');
  const [dock, setDock] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: '', expected_quantity: 1, location_id: '' },
  ]);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (lines.some((line) => !line.product_id || !line.location_id || line.expected_quantity <= 0)) {
        throw new Error('Preencha produto, destino e quantidade em todas as linhas.');
      }

      const created = await createNewReceipt({
        supplier_name: supplier,
        expected_date: expectedDate || undefined,
        dock: dock || undefined,
        lines,
      });

      await onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar recebimento');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Novo recebimento</h2>
          <button type="button" onClick={onClose} className="text-slate-500">Fechar</button>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          <div className="grid md:grid-cols-3 gap-4">
            <label className="md:col-span-1 text-sm">
              <span className="block mb-1 font-medium">Fornecedor</span>
              <input required value={supplier} onChange={(e) => setSupplier(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Doca</span>
              <input value={dock} onChange={(e) => setDock(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Data prevista</span>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Itens</h3>
              <button
                type="button"
                onClick={() => setLines((current) => [...current, { product_id: '', expected_quantity: 1, location_id: '' }])}
                className="text-sm text-blue-600"
              >
                + Adicionar item
              </button>
            </div>

            {lines.map((line, index) => (
              <div key={index} className="grid md:grid-cols-[1fr_1fr_120px_40px] gap-2 items-end bg-slate-50 p-3 rounded-lg">
                <label className="text-sm">
                  <span className="block mb-1">Produto</span>
                  <select required value={line.product_id} onChange={(e) => updateLine(index, { product_id: e.target.value })} className="w-full border rounded px-2 py-2 bg-white">
                    <option value="">Selecione</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.sku} — {product.name}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block mb-1">Destino</span>
                  <select required value={line.location_id} onChange={(e) => updateLine(index, { location_id: e.target.value })} className="w-full border rounded px-2 py-2 bg-white">
                    <option value="">Selecione</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block mb-1">Quantidade</span>
                  <input type="number" min={1} step="any" required value={line.expected_quantity} onChange={(e) => updateLine(index, { expected_quantity: Number(e.target.value) })} className="w-full border rounded px-2 py-2" />
                </label>
                <button type="button" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="p-2 text-red-500 disabled:opacity-30">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {loading ? 'Criando...' : 'Criar recebimento'}
          </button>
        </div>
      </form>
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
