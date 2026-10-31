import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, FileSearch, Loader2, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAuditEvents } from '../services/audit';
import type { DBAuditEvent } from '../types';

const eventLabels: Record<string, string> = {
  movement_processed: 'Movimentação processada',
  shipment_picking_started: 'Picking iniciado',
  shipment_picked: 'Picking confirmado',
  shipment_reservations_released: 'Reservas liberadas',
  shipment_cancelled_empty: 'Expedição cancelada sem separação',
  receipt_processed: 'Recebimento processado',
  stock_count_completed: 'Contagem concluída',
  product_created: 'Produto criado',
  product_updated: 'Produto atualizado',
  location_created: 'Localização criada',
  location_updated: 'Localização atualizada',
  user_login: 'Login',
  user_logout: 'Logout',
};

export default function AuditLog() {
  const { user } = useAuth();
  const [events, setEvents] = useState<DBAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setEvents(await getAuditEvents());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar auditoria');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const entities = useMemo(
    () => [...new Set(events.map((event) => event.entity_type))].sort(),
    [events]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesEntity = entityFilter === 'all' || event.entity_type === entityFilter;
      if (!matchesEntity) return false;
      if (!term) return true;

      return [
        event.event_type,
        event.entity_type,
        event.entity_id,
        event.user_email,
        JSON.stringify(event.details ?? {}),
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [events, entityFilter, search]);

  if (user?.role !== 'admin' && user?.role !== 'manager') {
    return (
      <div className="p-6">
        <div className="max-w-xl p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          Auditoria é visível somente para administradores e gerentes.
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-600" />
          Auditoria
        </h1>
        <p className="text-slate-500">
          Eventos autoritativos registrados pelo banco durante operações e alterações de catálogo.
        </p>
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-900">
        A aplicação web apenas consulta este histórico. Eventos operacionais são gerados por RPCs e triggers no banco e não podem ser fabricados pelo navegador.
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-[1fr_240px] gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por evento, usuário, entidade ou detalhes..."
            className="w-full pl-10 pr-3 py-2 border border-slate-200 rounded-lg"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="all">Todas as entidades</option>
          {entities.map((entity) => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Evento</th>
                <th className="px-4 py-3 text-left">Entidade</th>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((event) => (
                <tr key={event.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(event.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">
                    {eventLabels[event.event_type] || event.event_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <div>{event.entity_type}</div>
                    {event.entity_id && <div className="text-xs font-mono text-slate-400 mt-1">{event.entity_id}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{event.user_email || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-xl">
                    <pre className="whitespace-pre-wrap break-words font-mono bg-slate-50 rounded-lg p-2 border border-slate-100">
                      {JSON.stringify(event.details ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-400">
                    <FileSearch className="w-8 h-8 mx-auto mb-2" />
                    Nenhum evento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando auditoria...
          </div>
        )}
      </div>
    </div>
  );
}
