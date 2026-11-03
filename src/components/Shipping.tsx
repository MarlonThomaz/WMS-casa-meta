import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  Clock,
  Package,
  Plus,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import {
  useCancelShipment,
  useConfirmPacked,
  useConfirmPickedQuantity,
  useConfirmShipped,
  useCreateShipment,
  useShipment,
  useShipments,
  useStartPicking,
} from '../hooks/useShipping';
import { useProducts } from '../hooks/useProducts';
import { useLocations } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import type { DBShipment } from '../types';

const statusLabel: Record<DBShipment['status'], string> = {
  pending: 'Pendente',
  picking: 'Separação',
  packed: 'Embalado',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
};

const statusClass: Record<DBShipment['status'], string> = {
  pending: 'bg-slate-100 text-slate-700',
  picking: 'bg-amber-100 text-amber-700',
  packed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const priorityLabel: Record<DBShipment['priority'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

type DraftLine = {
  product_id: string;
  requested_quantity: number;
  from_location_id: string;
};

export default function Shipping() {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { shipments, loading, error, refresh } = useShipments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | DBShipment['status']>('all');

  if (selectedId) {
    return (
      <ShipmentDetail
        shipmentId={selectedId}
        onBack={() => {
          setSelectedId(null);
          void refresh();
        }}
      />
    );
  }

  const filtered = shipments.filter((shipment) => filter === 'all' || shipment.status === filter);
  const counts = {
    pending: shipments.filter((s) => s.status === 'pending').length,
    picking: shipments.filter((s) => s.status === 'picking').length,
    packed: shipments.filter((s) => s.status === 'packed').length,
    shipped: shipments.filter((s) => s.status === 'shipped').length,
  };

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Expedição</h1>
          <p className="text-slate-500">Separação, embalagem e despacho com reserva de estoque.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={!canOperate}
          title={canOperate ? 'Criar expedição' : 'Seu perfil é somente leitura'}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Nova expedição
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
        <Summary label="Separação" value={counts.picking} icon={<Package className="w-4 h-4" />} />
        <Summary label="Embalados" value={counts.packed} icon={<CheckCircle className="w-4 h-4" />} />
        <Summary label="Enviados" value={counts.shipped} icon={<Truck className="w-4 h-4" />} />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'picking', 'packed', 'shipped', 'cancelled'] as const).map((status) => (
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
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Número</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Transportadora</th>
                <th className="text-left px-4 py-3">Prioridade</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-slate-50">
                  <td data-label="Número" className="px-4 py-3 font-mono text-sm">{shipment.shipment_number}</td>
                  <td data-label="Cliente" className="px-4 py-3 text-sm font-medium text-slate-800">{shipment.customer_name}</td>
                  <td data-label="Transportadora" className="px-4 py-3 text-sm text-slate-600">{shipment.carrier || '—'}</td>
                  <td data-label="Prioridade" className="px-4 py-3 text-sm text-slate-600">{priorityLabel[shipment.priority]}</td>
                  <td data-label="Status" className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs ${statusClass[shipment.status]}`}>
                      {statusLabel[shipment.status]}
                    </span>
                  </td>
                  <td data-label="Ação" className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(shipment.id)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      Operar
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    Nenhuma expedição encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && <div className="p-6 text-center text-slate-500">Carregando expedições...</div>}
      </div>

      {showCreate && (
        <CreateShipmentModal
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

function ShipmentDetail({ shipmentId, onBack }: { shipmentId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const { shipment, loading, error, refresh } = useShipment(shipmentId);
  const { products } = useProducts();
  const { locations } = useLocations();
  const { start, loading: starting } = useStartPicking();
  const { update, loading: updating } = useConfirmPickedQuantity();
  const { confirm: pack, loading: packing } = useConfirmPacked();
  const { confirm: ship, loading: shipping } = useConfirmShipped();
  const { cancel, loading: cancelling } = useCancelShipment();

  const productNames = useMemo(
    () => new Map(products.map((product) => [product.id, `${product.sku} — ${product.name}`])),
    [products]
  );
  const locationNames = useMemo(
    () => new Map(locations.map((location) => [location.id, location.code])),
    [locations]
  );

  if (loading) return <div className="p-6 text-slate-500">Carregando expedição...</div>;
  if (error || !shipment) {
    return (
      <div className="p-6 space-y-4">
        <button type="button" onClick={onBack} className="text-blue-600">← Voltar</button>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || 'Expedição não encontrada'}
        </div>
      </div>
    );
  }

  const busy = starting || updating || packing || shipping || cancelling;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-blue-600 mb-2">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-slate-800">{shipment.shipment_number}</h1>
          <p className="text-slate-500">{shipment.customer_name}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${statusClass[shipment.status]}`}>
          {statusLabel[shipment.status]}
        </span>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full mobile-cards">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Produto</th>
                <th className="text-left px-4 py-3">Origem</th>
                <th className="text-right px-4 py-3">Solicitado</th>
                <th className="text-right px-4 py-3">Separado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shipment.lines.map((line) => (
                <tr key={line.id}>
                  <td data-label="Produto" className="px-4 py-3 text-sm">{productNames.get(line.product_id) || line.product_id}</td>
                  <td data-label="Origem" className="px-4 py-3 text-sm">{line.from_location_id ? locationNames.get(line.from_location_id) || line.from_location_id : '—'}</td>
                  <td data-label="Solicitado" className="px-4 py-3 text-sm text-right">{line.requested_quantity}</td>
                  <td data-label="Separado" className="px-4 py-3 text-right">
                    {shipment.status === 'picking' && canOperate ? (
                      <input
                        type="number" inputMode="decimal"
                        min={0}
                        max={line.requested_quantity}
                        step="any"
                        defaultValue={line.picked_quantity}
                        disabled={busy}
                        onBlur={async (event) => {
                          const quantity = Number(event.target.value);
                          if (!Number.isFinite(quantity) || quantity === line.picked_quantity) return;
                          try {
                            await update(line.id, quantity);
                            await refresh();
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Erro ao atualizar quantidade separada');
                            event.target.value = String(line.picked_quantity);
                          }
                        }}
                        className="w-24 px-2 py-1 border border-slate-300 rounded text-right"
                      />
                    ) : (
                      <span className="text-sm">{line.picked_quantity}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        {canOperate && (shipment.status === 'pending' || shipment.status === 'picking') && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm('Cancelar esta expedição?')) return;
              try {
                await cancel(shipment.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao cancelar expedição');
              }
            }}
            className="px-4 py-2 border border-red-200 text-red-700 rounded-lg disabled:opacity-50"
          >
            <XCircle className="w-4 h-4 inline mr-1" /> Cancelar
          </button>
        )}

        {canOperate && shipment.status === 'pending' && (
          <button
            type="button"
            disabled={busy || shipment.lines.length === 0}
            onClick={async () => {
              try {
                await start(shipment.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao iniciar separação');
              }
            }}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
          >
            Iniciar separação
          </button>
        )}

        {canOperate && shipment.status === 'picking' && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              try {
                await pack(shipment.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao confirmar embalagem');
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            Confirmar embalagem
          </button>
        )}

        {canOperate && shipment.status === 'packed' && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              try {
                await ship(shipment.id);
                await refresh();
              } catch (err) {
                alert(err instanceof Error ? err.message : 'Erro ao despachar');
              }
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            Despachar
          </button>
        )}
      </div>
    </div>
  );
}

function CreateShipmentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const { products } = useProducts();
  const { locations } = useLocations();
  const { createNewShipment, loading } = useCreateShipment();
  const [customer, setCustomer] = useState('');
  const [carrier, setCarrier] = useState('');
  const [priority, setPriority] = useState<DBShipment['priority']>('medium');
  const [expectedDate, setExpectedDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([
    { product_id: '', requested_quantity: 1, from_location_id: '' },
  ]);

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    try {
      if (lines.some((line) => !line.product_id || !line.from_location_id || line.requested_quantity <= 0)) {
        throw new Error('Preencha produto, origem e quantidade em todas as linhas.');
      }

      const created = await createNewShipment({
        customer_name: customer,
        carrier: carrier || undefined,
        priority,
        expected_date: expectedDate || undefined,
        lines,
      });

      await onCreated(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar expedição');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Nova expedição</h2>
          <button type="button" onClick={onClose} className="text-slate-500">Fechar</button>
        </div>
        <div className="p-5 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

          <div className="grid md:grid-cols-4 gap-4">
            <label className="text-sm md:col-span-2">
              <span className="block mb-1 font-medium">Cliente</span>
              <input required value={customer} onChange={(e) => setCustomer(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Transportadora</span>
              <input value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Prioridade</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as DBShipment['priority'])} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block mb-1 font-medium">Data prevista</span>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Itens</h3>
              <button type="button" onClick={() => setLines((current) => [...current, { product_id: '', requested_quantity: 1, from_location_id: '' }])} className="text-sm text-blue-600">
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
                  <span className="block mb-1">Origem</span>
                  <select required value={line.from_location_id} onChange={(e) => updateLine(index, { from_location_id: e.target.value })} className="w-full border rounded px-2 py-2 bg-white">
                    <option value="">Selecione</option>
                    {locations.map((location) => <option key={location.id} value={location.id}>{location.code}</option>)}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block mb-1">Quantidade</span>
                  <input type="number" inputMode="decimal" min={1} step="any" required value={line.requested_quantity} onChange={(e) => updateLine(index, { requested_quantity: Number(e.target.value) })} className="w-full border rounded px-2 py-2" />
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
            {loading ? 'Criando...' : 'Criar expedição'}
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
