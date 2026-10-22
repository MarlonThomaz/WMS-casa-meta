import { MapPin, CheckCircle, XCircle, Clock, Wrench } from 'lucide-react';
import { locations } from '../data';

export default function Locations() {
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      case 'maintenance': return 'Manutenção';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700';
      case 'occupied': return 'bg-blue-100 text-blue-700';
      case 'reserved': return 'bg-amber-100 text-amber-700';
      case 'maintenance': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getOccupancyColor = (percentage: number) => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 60) return 'bg-amber-500';
    if (percentage >= 30) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const summary = {
    available: locations.filter(l => l.status === 'available').length,
    occupied: locations.filter(l => l.status === 'occupied').length,
    reserved: locations.filter(l => l.status === 'reserved').length,
    maintenance: locations.filter(l => l.status === 'maintenance').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Localizações</h1>
          <p className="text-slate-500">Mapa do armazém e endereçamentos</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm text-slate-500">Disponíveis</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{summary.available}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            <span className="text-sm text-slate-500">Ocupadas</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">{summary.occupied}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <span className="text-sm text-slate-500">Reservadas</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{summary.reserved}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-5 h-5 text-red-500" />
            <span className="text-sm text-slate-500">Manutenção</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{summary.maintenance}</p>
        </div>
      </div>

      {/* Warehouse Map Visualization */}
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
                    const occupancy = loc.capacity > 0 ? (loc.occupied / loc.capacity) * 100 : 0;
                    return (
                      <div
                        key={loc.id}
                        className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer ${
                          loc.status === 'available' ? 'border-green-200 bg-green-50' :
                          loc.status === 'occupied' ? 'border-blue-200 bg-blue-50' :
                          loc.status === 'reserved' ? 'border-amber-200 bg-amber-50' :
                          'border-red-200 bg-red-50'
                        }`}
                        title={`${loc.code} - ${getStatusLabel(loc.status)}\nOcupação: ${Math.round(occupancy)}%`}
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
                                  className={`h-full rounded-full ${getOccupancyColor(occupancy)}`}
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

      {/* Locations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-800">Detalhes das Localizações</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Código</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Zona</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Corredor</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Estante</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Nível</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Capacidade</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Ocupação</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {locations.map(loc => {
                const occupancy = loc.capacity > 0 ? (loc.occupied / loc.capacity) * 100 : 0;
                return (
                  <tr key={loc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono font-medium text-slate-800">{loc.code}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold text-slate-700">{loc.zone}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{loc.aisle}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{loc.rack}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{loc.level}</td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{loc.capacity}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getOccupancyColor(occupancy)}`}
                            style={{ width: `${occupancy}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-slate-500 w-10">{Math.round(occupancy)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${getStatusColor(loc.status)}`}>
                        {getStatusIcon(loc.status)}
                        {getStatusLabel(loc.status)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
