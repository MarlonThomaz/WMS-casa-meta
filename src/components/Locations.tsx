import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import { useLocationMap } from '../hooks/useLocationMap';
import { useAuth } from '../contexts/AuthContext';
import {
  createLocation,
  updateLocation,
  type LocationMapItem,
} from '../services/locations';
import type { DBLocation } from '../types';

const PAGE_SIZE = 50;

const statusLabel: Record<DBLocation['status'], string> = {
  available: 'Disponível',
  occupied: 'Ocupada',
  reserved: 'Reservada',
  blocked: 'Bloqueada',
  maintenance: 'Manutenção',
};

const typeLabel: Record<DBLocation['location_type'], string> = {
  storage: 'Armazenagem',
  picking: 'Picking',
  staging: 'Staging',
  receiving: 'Recebimento',
  shipping: 'Expedição',
  quarantine: 'Quarentena',
};

export default function Locations() {
  const { user, isDemo } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DBLocation['status'] | null>(null);
  const [page, setPage] = useState(1);
  const {
    locations,
    total,
    totalPages,
    stats,
    loading,
    error,
    refresh,
  } = useLocationMap(searchTerm, statusFilter, page, PAGE_SIZE);
  const [showCreate, setShowCreate] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationMapItem | null>(null);

  const canMaintainLocations = user?.role === 'admin' || user?.role === 'manager';
  const zones = useMemo(
    () => [...new Set(locations.map((location) => location.zone))].sort(),
    [locations]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const getStatusIcon = (status: DBLocation['status']) => {
    switch (status) {
      case 'available':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'occupied':
        return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'reserved':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'maintenance':
      case 'blocked':
        return <Wrench className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: DBLocation['status']) => {
    switch (status) {
      case 'available':
        return 'border-green-200 bg-green-50';
      case 'occupied':
        return 'border-blue-200 bg-blue-50';
      case 'reserved':
        return 'border-amber-200 bg-amber-50';
      case 'maintenance':
      case 'blocked':
        return 'border-red-200 bg-red-50';
    }
  };

  if (loading && locations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Localizações</h1>
          <p className="text-slate-500">
            Mapa e endereçamento físico do armazém
            {isDemo && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Modo demonstração
              </span>
            )}
          </p>
        </div>

        {canMaintainLocations && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Nova localização
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Total" value={stats.totalLocations} />
        <Stat label="Disponíveis" value={stats.availableLocations} />
        <Stat label="Ocupadas" value={stats.occupiedLocations} />
        <Stat label="Bloqueadas/manutenção" value={stats.unavailableLocations} />
      </div>

      <div className="grid md:grid-cols-[1fr_230px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar código, zona, corredor, rack ou nível..."
            className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
          )}
        </div>
        <select
          value={statusFilter || 'all'}
          onChange={(event) => {
            setStatusFilter(event.target.value === 'all' ? null : event.target.value as DBLocation['status']);
            setPage(1);
          }}
          className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="all">Todas as situações</option>
          <option value="available">Disponíveis</option>
          <option value="occupied">Ocupadas</option>
          <option value="reserved">Reservadas</option>
          <option value="blocked">Bloqueadas</option>
          <option value="maintenance">Manutenção</option>
        </select>
      </div>

      <div className="bg-white rounded-xl p-4 sm:p-6 border border-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Mapa do armazém</h2>
            <p className="text-sm text-slate-500">
              {total} posição(ões) encontrada(s) · página {page} de {totalPages}
            </p>
          </div>
          {(searchTerm.trim() || statusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter(null);
                setPage(1);
              }}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {zones.length === 0 ? (
          <div className="py-10 text-center text-slate-400">Nenhuma localização encontrada.</div>
        ) : (
          <div className="space-y-6">
            {zones.map((zone) => {
              const zoneLocations = locations.filter((location) => location.zone === zone);

              return (
                <section key={zone}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="min-w-8 h-8 px-2 bg-slate-800 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                      {zone}
                    </div>
                    <h3 className="font-medium text-slate-700">Zona {zone}</h3>
                    <span className="text-xs text-slate-400">({zoneLocations.length} nesta página)</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {zoneLocations.map((location) => {
                      const capacity = Number(location.capacity || 0);
                      const totalQuantity = Number(location.total_quantity || 0);
                      const occupancy = Number(location.occupancy_percentage || 0);

                      return (
                        <button
                          type="button"
                          key={location.id}
                          onClick={() => canMaintainLocations && setEditingLocation(location)}
                          className={`relative p-3 rounded-lg border-2 text-left transition-transform ${
                            canMaintainLocations ? 'hover:scale-[1.02]' : 'cursor-default'
                          } ${getStatusColor(location.status)}`}
                          title={`${location.code} · ${typeLabel[location.location_type]} · ${Math.round(occupancy)}%`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-mono font-bold text-slate-700 truncate">{location.code}</p>
                              <p className="text-[11px] text-slate-500 mt-1 truncate">{typeLabel[location.location_type]}</p>
                            </div>
                            {canMaintainLocations ? (
                              <Edit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              getStatusIcon(location.status)
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                            {getStatusIcon(location.status)}
                            <span>{statusLabel[location.status]}</span>
                          </div>

                          {totalQuantity > 0 && (
                            <p className="text-[10px] text-slate-500 mt-1">
                              {location.total_items} SKU(s) · {totalQuantity} un.
                            </p>
                          )}

                          {capacity > 0 && (
                            <div className="mt-2">
                              <div className="w-full h-1.5 bg-white/70 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    occupancy >= 90
                                      ? 'bg-red-500'
                                      : occupancy >= 70
                                        ? 'bg-amber-500'
                                        : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${occupancy}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {totalQuantity}/{capacity} · {Math.round(occupancy)}%
                              </p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Mostrando {Math.min((page - 1) * PAGE_SIZE + 1, total)}–{Math.min(page * PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm text-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-sm text-slate-700 disabled:opacity-40"
              >
                Próxima <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <LocationModal
          title="Nova localização"
          onClose={() => setShowCreate(false)}
          onSubmit={async (values) => {
            await createLocation(values);
            await refresh();
            setShowCreate(false);
          }}
        />
      )}

      {editingLocation && (
        <LocationModal
          title={`Editar ${editingLocation.code}`}
          initial={editingLocation}
          onClose={() => setEditingLocation(null)}
          onSubmit={async (values) => {
            await updateLocation(editingLocation.id, values);
            await refresh();
            setEditingLocation(null);
          }}
        />
      )}
    </div>
  );
}

type LocationFormValues = Omit<DBLocation, 'id' | 'created_at' | 'updated_at'>;

function LocationModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: LocationMapItem;
  onClose: () => void;
  onSubmit: (values: LocationFormValues) => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [zone, setZone] = useState(initial?.zone || '');
  const [aisle, setAisle] = useState(initial?.aisle || '');
  const [rack, setRack] = useState(initial?.rack || '');
  const [level, setLevel] = useState(initial?.level || '');
  const [locationType, setLocationType] = useState<DBLocation['location_type']>(initial?.location_type || 'storage');
  const [status, setStatus] = useState<DBLocation['status']>(initial?.stored_status || 'available');
  const [capacity, setCapacity] = useState(initial?.capacity == null ? '' : String(initial.capacity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const parsedCapacity = capacity.trim() === '' ? undefined : Number(capacity);

    if (!code.trim() || !zone.trim()) {
      setError('Código e zona são obrigatórios.');
      return;
    }

    if (parsedCapacity !== undefined && (!Number.isFinite(parsedCapacity) || parsedCapacity < 0)) {
      setError('Capacidade precisa ser zero ou maior.');
      return;
    }

    try {
      setSaving(true);
      await onSubmit({
        code: code.trim().toUpperCase(),
        zone: zone.trim().toUpperCase(),
        aisle: aisle.trim() || undefined,
        rack: rack.trim() || undefined,
        level: level.trim() || undefined,
        location_type: locationType,
        capacity: parsedCapacity,
        status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar localização');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{title}</h2>
            <p className="text-sm text-slate-500">Endereço físico utilizado pelos saldos e operações do WMS.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500">Fechar</button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Código">
              <input required value={code} onChange={(e) => setCode(e.target.value)} className="w-full border rounded-lg px-3 py-2 font-mono" placeholder="A-01-01-01" />
            </Field>
            <Field label="Zona">
              <input required value={zone} onChange={(e) => setZone(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="A" />
            </Field>
            <Field label="Corredor">
              <input value={aisle} onChange={(e) => setAisle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Rack/estrutura">
              <input value={rack} onChange={(e) => setRack(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Nível">
              <input value={level} onChange={(e) => setLevel(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Capacidade">
              <input type="number" inputMode="decimal" min={0} step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
            </Field>
            <Field label="Tipo">
              <select value={locationType} onChange={(e) => setLocationType(e.target.value as DBLocation['location_type'])} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="storage">Armazenagem</option>
                <option value="picking">Picking</option>
                <option value="staging">Staging</option>
                <option value="receiving">Recebimento</option>
                <option value="shipping">Expedição</option>
                <option value="quarantine">Quarentena</option>
              </select>
            </Field>
            <Field label="Status administrativo">
              <select value={status} onChange={(e) => setStatus(e.target.value as DBLocation['status'])} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="available">Disponível</option>
                <option value="occupied">Ocupada</option>
                <option value="reserved">Reservada</option>
                <option value="blocked">Bloqueada</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </Field>
          </div>

          {initial && initial.status !== initial.stored_status && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              Situação física atual: <strong>{statusLabel[initial.status]}</strong>. O campo acima representa o status salvo do endereço; a ocupação é calculada automaticamente pelo estoque existente.
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar localização'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
