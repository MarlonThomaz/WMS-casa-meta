import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ClipboardCheck,
  MapPin,
  Package,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  getInventoryAccuracy,
  getStockCountStats,
  type InventoryAccuracy,
  type StockCountStats,
} from '../services/stockCounts';
import { getDashboardStats, type DashboardStats } from '../services/dashboard';

type PilotMetrics = {
  stockCounts: StockCountStats;
  dashboard: DashboardStats;
};

const STATUS_ROWS: Array<[keyof StockCountStats['byStatus'], string]> = [
  ['pending', 'Pendentes'],
  ['in_progress', 'Em Andamento'],
  ['completed', 'Concluídas'],
  ['cancelled', 'Canceladas'],
];

const TYPE_ROWS: Array<[keyof StockCountStats['byType'], string]> = [
  ['full', 'Completas'],
  ['cycle', 'Cíclicas'],
  ['spot', 'Pontuais'],
  ['reconciliation', 'Reconciliações'],
];

export default function PilotDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [accuracy, setAccuracy] = useState<InventoryAccuracy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadMetrics();
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

      setMetrics({ stockCounts: statsData, dashboard: dashboardData });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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

  const stockCounts = metrics?.stockCounts;
  const dashboard = metrics?.dashboard;
  const countTotal = stockCounts?.total ?? 0;
  const productTotal = dashboard?.totalProducts ?? 0;
  const hasAccuracySample = (accuracy?.total_lines ?? 0) > 0;
  const accuracyValue = hasAccuracySample ? accuracy?.accuracy ?? 0 : null;
  const precisionReached = accuracyValue !== null && accuracyValue >= 95;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-7 h-7 text-blue-600" />
          Dashboard do Piloto
        </h1>
        <p className="text-slate-500">Acompanhamento do piloto controlado do WMS</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Precisão do Inventário</span>
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            {accuracyValue === null ? '—' : `${accuracyValue.toFixed(1)}%`}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {hasAccuracySample
              ? `${accuracy?.accurate_lines ?? 0} de ${accuracy?.total_lines ?? 0} itens corretos`
              : 'Aguardando contagem concluída'}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Contagens Realizadas</span>
            <ClipboardCheck className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{countTotal}</div>
          <div className="text-xs text-slate-500 mt-1">
            {stockCounts?.byStatus.completed ?? 0} concluídas
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">SKUs Cadastrados</span>
            <Package className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{productTotal}</div>
          <div className="text-xs text-slate-500 mt-1">
            {dashboard?.lowStockProducts ?? 0} com estoque baixo
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Localizações</span>
            <MapPin className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">{dashboard?.totalLocations ?? 0}</div>
          <div className="text-xs text-slate-500 mt-1">
            {dashboard?.occupiedLocations ?? 0} ocupadas
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Status do Piloto
        </h2>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Progresso Geral</span>
              <span className="text-sm text-slate-600">
                {accuracyValue === null ? 'Precisão ainda não medida' : `${accuracyValue.toFixed(1)}% de precisão`}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  accuracyValue !== null && accuracyValue >= 95 ? 'bg-green-500' :
                  accuracyValue !== null && accuracyValue >= 85 ? 'bg-blue-500' :
                  accuracyValue !== null && accuracyValue >= 70 ? 'bg-amber-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${accuracyValue ?? 0}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Critérios de Sucesso</h3>

              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${precisionReached ? 'text-green-600' : 'text-slate-300'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Precisão ≥ 95%</p>
                  <p className="text-xs text-slate-500">Meta de precisão do inventário</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${countTotal >= 3 ? 'text-green-600' : 'text-slate-300'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">Mínimo 3 contagens realizadas</p>
                  <p className="text-xs text-slate-500">Validação do processo</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <CheckCircle className={`w-5 h-5 flex-shrink-0 ${productTotal >= 100 ? 'text-green-600' : 'text-slate-300'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">100+ SKUs cadastrados</p>
                  <p className="text-xs text-slate-500">Base mínima para piloto</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700">Próximos Passos</h3>

              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${precisionReached ? 'text-green-600' : 'text-amber-600'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {!hasAccuracySample ? 'Concluir uma contagem' : precisionReached ? 'Precisão atingida' : 'Melhorar precisão'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {!hasAccuracySample
                      ? 'Ainda não existe amostra concluída para medir precisão'
                      : precisionReached
                        ? 'Meta de precisão alcançada'
                        : `Faltam ${(95 - (accuracyValue ?? 0)).toFixed(1)}% para meta`}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${countTotal < 3 ? 'text-amber-600' : 'text-green-600'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {countTotal < 3 ? 'Realizar mais contagens' : 'Contagens suficientes'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {countTotal < 3 ? `${3 - countTotal} contagens restantes` : 'Processo validado'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <AlertCircle className={`w-5 h-5 flex-shrink-0 ${productTotal < 100 ? 'text-amber-600' : 'text-green-600'}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {productTotal < 100 ? 'Cadastrar mais SKUs' : 'Base completa'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {productTotal < 100 ? `${100 - productTotal} SKUs restantes` : 'Base de produtos adequada'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Contagens por Status</h3>
          <div className="space-y-3">
            {STATUS_ROWS.map(([status, label]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {stockCounts?.byStatus[status] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Contagens por Tipo</h3>
          <div className="space-y-3">
            {TYPE_ROWS.map(([type, label]) => (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{label}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {stockCounts?.byType[type] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600" />
          Resumo de Divergências
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <div className="text-2xl font-bold text-slate-900">{accuracy?.total_lines ?? 0}</div>
            <div className="text-sm text-slate-600 mt-1">Total de Itens Contados</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-700">{accuracy?.accurate_lines ?? 0}</div>
            <div className="text-sm text-green-600 mt-1">Itens Corretos</div>
          </div>
          <div className="text-center p-4 bg-amber-50 rounded-lg">
            <div className="text-2xl font-bold text-amber-700">{accuracy?.discrepancies ?? 0}</div>
            <div className="text-sm text-amber-600 mt-1">Divergências</div>
          </div>
        </div>
      </div>
    </div>
  );
}
