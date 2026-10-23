import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Wrench,
} from 'lucide-react';
import { useLocationsWithOccupancy } from '../hooks/useLocations';
import { useAuth } from '../contexts/AuthContext';
import { createLocation, updateLocation } from '../services/locations';
import type { DBLocation, LocationWithOccupancy } from '../types';

export default function Locations() {
  const { user, isDemo } = useAuth();
  const { locations, loading, error, refresh } = useLocationsWithOccupancy();
  const [showCreate, setShowCreate] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationWithOccupancy | null>(null);

  const canMaintainLocations = user?.role === 'admin' || user?.role === 'manager';
  const zones = useMemo(
    () => [...new Set(locations.map((location) => location.zone))].sort(),
    [locations]
  );

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
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
        <Stat label="Total" value={locations.length} />
        <Stat label="Disponíveis" value={locations.filter((location) => location.status === 'available').length} />
        <Stat label="Ocupadas" value={locations.filter((location) => location.status === 'occupied').length} />
        <Stat label="Bloqueadas/manutenção" value={locations.filter((location) => location.status === 'blocked' || location.status === 'maintenance').length} />
      </div>

      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Mapa do armazém</h2>

        {zones.length === 0 ? (
          <div className="py-10 text-center text-slate-400">Nenhuma localização cadastrada.</div>
        ) : (
          <div className="space-y-6">
            {zones.map((zone) => {
              const zoneLocations = locations.filter((location) => location.zone === zone);

              return (
                <section key={zone}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                      {zone}
                    </div>
                    <h3 className="font-medium text-slate-700">Zona {zone}</h3>
                    <span className="text-xs text-slate-400">({zoneLocations.length} posições)</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {zoneLocations.map((location) => {
                      const capacity = Number(location.capacity || 0);
                      const totalQuantity = Number(location.total_quantity || 0);
                      const occupancy = capacity > 0
                        ? Math.min(100, (totalQuantity / capacity) * 100)
                        : 0;

                      return (
                        <button
                          type="button"
                          key={location.id}
                          onClick={() => canMaintainLocations && setEditingLocation(location)}
                          className={`relative p-3 rounded-lg border-2 text-left transition-transform ${
                            canMaintainLocations ? 'hover:scale-[1.02]' : 'cursor-default'
                          } ${getStatusColor(location.status)}`}
                          title={`${location.code} · ${location.location_type} · ${Math.round(occupancy)}%`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs font-mono font-bold text-slate-700">{location.code}</p>
                              <p className="text-[11px] text-slate-500 mt-1">{location.location_type}</p>
                            </div>
                            {canMaintainLocations ? (
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            ) : (
                              getStatusIcon(location.status)
                            )}
                          </div>

                          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                            {getStatusIcon(location.status)}
                            <span>{location.status}</span>
                          </div>

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
  initial?: LocationWithOccupancy;
  onClose: () => void;
  onSubmit: (values: LocationFormValues) => Promise<void>;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [zone, setZone] = useState(initial?.zone || '');
  const [aisle, setAisle] = useState(initial?.aisle || '');
  const [rack, setRack] = useState(initial?.rack || '');
  const [level, setLevel] = useState(initial?.level || '');
  const [locationType, setLocationType] = useState<DBLocation['location_type']>(initial?.location_type || 'storage');
  const [status, setStatus] = useState<DBLocation['status']>(initial?.status || 'available');
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
              <input type="number" min={0} step="any" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
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
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as DBLocation['status'])} className="w-full border rounded-lg px-3 py-2 bg-white">
                <option value="available">Disponível</option>
                <option value="occupied">Ocupada</option>
                <option value="reserved">Reservada</option>
                <option value="blocked">Bloqueada</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </Field>
          </div>
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
