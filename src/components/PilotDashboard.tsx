import { useState, useEffect } from 'react';
import { Activity, Target, TrendingUp, CheckCircle, AlertCircle, Package, MapPin, ClipboardCheck } from 'lucide-react';
import { getStockCountStats, getInventoryAccuracy } from '../services/stockCounts';
import { getDashboardStats } from '../services/dashboard';

export default function PilotDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>(null);
  const [accuracy, setAccuracy] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, accuracyData, dashboardData] = await Promise.all([
        getStockCountStats(),
        getInventoryAccuracy(),
        getDashboardStats(),
      ]);

      setMetrics({
        stockCounts: statsData,
        dashboard: dashboardData,
      });
      setAccuracy(accuracyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-7 h-7 text-blue-600" />
          Dashboard do Piloto
        </h1>
        <p className="text-slate-500">Acompanhamento do piloto controlado do WMS</p>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Precisão do Inventário</span>
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {accuracy?.accuracy?.toFixed(1) || 0}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {accuracy?.accurate_lines || 0} de {accuracy?.total_lines || 0} itens corretos
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Contagens Realizadas</span>
            <ClipboardCheck className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {metrics?.stockCounts?.total || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.stockCounts?.byStatus?.completed || 0} concluídas
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">SKUs Cadastrados</span>
            <Package className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {metrics?.dashboard?.totalProducts || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.dashboard?.lowStockProducts || 0} com estoque baixo
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Localizações</span>
            <MapPin className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {metrics?.dashboard?.totalLocations || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.dashboard?.occupiedLocations || 0} ocupadas
          </div>
        </div>
      </div>

      {/* Status do Piloto */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Status do Piloto
        </h2>
        
        <div className="space-y-4">
          {/* Progresso Geral */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Progresso Geral</span>
              <span className="text-sm text-slate-600">
                {accuracy?.accuracy?.toFixed(1) || 0}% de precisão
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  (accuracy?.accuracy || 0) >= 95 ? 'bg-green-500' :
                  (accuracy?.accuracy || 0) >= 85 ? 'bg-blue-500' :
                  (accuracy?.accuracy || 0) >= 70 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${accuracy?.accuracy || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Checklist de Validação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Critérios de Sucesso</h3>
              
              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                  (accuracy?.accuracy || 0) >= 95 ? 'text-green-600' : 'text-slate-300'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Precisão ≥ 95%</p>
                  <p className="text-xs text-slate-500">Meta de precisão do inventário</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                  (metrics?.stockCounts?.total || 0) >= 3 ? 'text-green-600' : 'text-slate-300'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Mínimo 3 contagens realizadas</p>
                  <p className="text-xs text-slate-500">Validação do processo</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${
                  (metrics?.dashboard?.totalProducts || 0) >= 100 ? 'text-green-600' : 'text-slate-300'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">100+ SKUs cadastrados</p>
                  <p className="text-xs text-slate-500">Base mínima para piloto</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Próximos Passos</h3>
              
              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                  (accuracy?.accuracy || 0) < 95 ? 'text-amber-600' : 'text-green-600'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {(accuracy?.accuracy || 0) < 95 ? 'Melhorar precisão' : 'Precisão atingida'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(accuracy?.accuracy || 0) < 95 
                      ? `Faltam ${(95 - (accuracy?.accuracy || 0)).toFixed(1)}% para meta`
                      : 'Meta de precisão alcançada'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                  (metrics?.stockCounts?.total || 0) < 3 ? 'text-amber-600' : 'text-green-600'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {(metrics?.stockCounts?.total || 0) < 3 ? 'Realizar mais contagens' : 'Contagens suficientes'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(metrics?.stockCounts?.total || 0) < 3
                      ? `${3 - (metrics?.stockCounts?.total || 0)} contagens restantes`
                      : 'Processo validado'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${
                  (metrics?.dashboard?.totalProducts || 0) < 100 ? 'text-amber-600' : 'text-green-600'
                }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {(metrics?.dashboard?.totalProducts || 0) < 100 ? 'Cadastrar mais SKUs' : 'Base completa'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(metrics?.dashboard?.totalProducts || 0) < 100
                      ? `${100 - (metrics?.dashboard?.totalProducts || 0)} SKUs restantes`
                      : 'Base de produtos adequada'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas de Contagens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Contagens por Status</h3>
          <div className="space-y-3">
            {Object.entries(metrics?.stockCounts?.byStatus || {}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-600 capitalize">
                  {status === 'pending' ? 'Pendentes' :
                   status === 'in_progress' ? 'Em Andamento' :
                   status === 'completed' ? 'Concluídas' : 'Canceladas'}
                </span>
                <span className="text-sm font-semibold text-slate-900">{count as number}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Contagens por Tipo</h3>
          <div className="space-y-3">
            {Object.entries(metrics?.stockCounts?.byType || {}).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {type === 'full' ? 'Completas' :
                   type === 'cycle' ? 'Cíclicas' :
                   type === 'spot' ? 'Pontuais' : 'Reconciliações'}
                </span>
                <span className="text-sm font-semibold text-slate-900">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resumo de Divergências */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          Resumo de Divergências
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900">
              {accuracy?.total_lines || 0}
            </div>
            <div className="text-sm text-slate-600 mt-1">Total de Itens Contados</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">
              {accuracy?.accurate_lines || 0}
            </div>
            <div className="text-sm text-green-600 mt-1">Itens Corretos</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-700">
              {accuracy?.discrepancies || 0}
            </div>
            <div className="text-sm text-amber-600 mt-1">Divergências</div>
          </div>
        </div>
      </div>
    </div>
  );
}
