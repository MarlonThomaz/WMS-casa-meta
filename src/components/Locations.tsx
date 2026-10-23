import { useLocationsWithOccupancy } from '../hooks/useLocations';
import { MapPin, CheckCircle, Clock, Wrench, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Locations() {
  const { isDemo } = useAuth();
  const { locations, loading, error } = useLocationsWithOccupancy();

  const zones = [...new Set(locations.map(l => l.zone))];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'occupied': return <MapPin className="w-4 h-4 text-blue-500" />;
      case 'reserved': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'maintenance': return <Wrench className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'border-green-200 bg-green-50';
      case 'occupied': return 'border-blue-200 bg-blue-50';
      case 'reserved': return 'border-amber-200 bg-amber-50';
      case 'maintenance': return 'border-red-200 bg-red-50';
      default: return 'border-slate-200 bg-slate-50';
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Localizações</h1>
        <p className="text-slate-500">
          Mapa do armazém e endereçamentos
          {isDemo && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Modo demonstração</span>}
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Mapa do Armazém</h3>
        <div className="space-y-6">
          {zones.map(zone => {
            const zoneLocations = locations.filter(l => l.zone === zone);
            return (
              <div key={zone}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-slate-800 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                    {zone}
                  </div>
                  <h4 className="font-medium text-slate-700">Zona {zone}</h4>
                  <span className="text-xs text-slate-400">({zoneLocations.length} posições)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {zoneLocations.map(loc => {
                    const capacity = loc.capacity || 0;
                    const occupancy = capacity > 0 ? (loc.total_quantity / capacity) * 100 : 0;
                    return (
                      <div
                        key={loc.id}
                        className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${getStatusColor(loc.status)}`}
                        title={`${loc.code} - Ocupação: ${Math.round(occupancy)}%`}
                      >
                        <div className="text-center">
                          <p className="text-xs font-mono font-bold text-slate-700">{loc.code}</p>
                          <div className="mt-1 flex items-center justify-center">
                            {getStatusIcon(loc.status)}
                          </div>
                          {loc.status === 'occupied' && (
                            <div className="mt-1">
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${occupancy >= 80 ? 'bg-red-500' : occupancy >= 60 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${occupancy}%` }}
                                ></div>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{Math.round(occupancy)}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
