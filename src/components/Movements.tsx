import { useState } from 'react';
import { useMovements } from '../hooks/useMovements';
import { useAuth } from '../contexts/AuthContext';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Settings, Search, Filter, AlertCircle } from 'lucide-react';
import { movements as demoMovements } from '../data';
import { Movement } from '../types';

export default function Movements() {
  const { user } = useAuth();
  const { movements: supabaseMovements, loading: supabaseLoading, error: supabaseError } = useMovements();
  
  // Usar dados do Supabase se disponíveis, senão usar dados de demonstração
  const [movements, setMovements] = useState<Movement[]>(demoMovements);
  const [usingSupabase, setUsingSupabase] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Tentar carregar do Supabase
  if (!supabaseLoading && supabaseMovements.length > 0 && !usingSupabase) {
    setMovements(supabaseMovements as unknown as Movement[]);
    setUsingSupabase(true);
  }

  const filteredMovements = movements.filter(m => {
    const matchesType = typeFilter === 'all' || m.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchesSearch = m.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.operator.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'inbound': return <ArrowDownToLine className="w-4 h-4" />;
      case 'outbound': return <ArrowUpFromLine className="w-4 h-4" />;
      case 'transfer': return <ArrowLeftRight className="w-4 h-4" />;
      case 'adjustment': return <Settings className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'inbound': return 'bg-blue-100 text-blue-700';
      case 'outbound': return 'bg-red-100 text-red-700';
      case 'transfer': return 'bg-purple-100 text-purple-700';
      case 'adjustment': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'inbound': return 'Entrada';
      case 'outbound': return 'Saída';
      case 'transfer': return 'Transferência';
      case 'adjustment': return 'Ajuste';
      default: return type;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'pending': return 'Pendente';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const summary = {
    inbound: movements.filter(m => m.type === 'inbound').length,
    outbound: movements.filter(m => m.type === 'outbound').length,
    transfer: movements.filter(m => m.type === 'transfer').length,
    adjustment: movements.filter(m => m.type === 'adjustment').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Movimentações</h1>
          <p className="text-slate-500">
            Histórico de movimentações do armazém
            {usingSupabase && (
              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Conectado ao Supabase
              </span>
            )}
            {!usingSupabase && !supabaseLoading && (
              <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Modo demonstração
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Error message */}
      {supabaseError && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Usando dados de demonstração</p>
            <p className="text-xs text-amber-700 mt-1">
              Não foi possível conectar ao Supabase: {supabaseError}. Configure o arquivo .env e execute as migrations.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownToLine className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-slate-500">Entradas</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{summary.inbound}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUpFromLine className="w-4 h-4 text-red-500" />
            <span className="text-sm text-slate-500">Saídas</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.outbound}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <ArrowLeftRight className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-slate-500">Transferências</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{summary.transfer}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-slate-500">Ajustes</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.adjustment}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por produto, referência ou operador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
          >
            <option value="all">Todos os Tipos</option>
            <option value="inbound">Entrada</option>
            <option value="outbound">Saída</option>
            <option value="transfer">Transferência</option>
            <option value="adjustment">Ajuste</option>
          </select>
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white"
          >
            <option value="all">Todos os Status</option>
            <option value="completed">Concluído</option>
            <option value="pending">Pendente</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Referência</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Produto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Qtd</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Origem</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Destino</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Data/Hora</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Operador</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((mov) => (
                <tr key={mov.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium text-slate-700">{mov.reference}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getTypeColor(mov.type)}`}>
                      {getTypeIcon(mov.type)}
                      {getTypeLabel(mov.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-700">{mov.productName}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${mov.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-slate-600">{mov.fromLocation}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-slate-600">{mov.toLocation}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{mov.date}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-slate-600">{mov.operator}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(mov.status)}`}>
                      {getStatusLabel(mov.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMovements.length === 0 && !supabaseLoading && (
          <div className="p-8 text-center text-slate-400">
            Nenhuma movimentação encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
