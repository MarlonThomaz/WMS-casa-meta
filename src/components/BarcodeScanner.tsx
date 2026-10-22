import { useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

export default function BarcodeScanner({ onScan, onClose, compact = false }: BarcodeScannerProps) {
  const [manualCode, setManualCode] = useState('');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
      {/* Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
          <span className="text-sm font-medium text-slate-700">
            Scanner de Código de Barras
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scanner area placeholder */}
      <div className="relative bg-slate-900">
        <div
          className="w-full flex flex-col items-center justify-center text-white"
          style={{ minHeight: compact ? '180px' : '260px' }}
        >
          <Camera className="w-12 h-12 mb-3 text-slate-400" />
          <p className="text-sm text-slate-300 mb-1">Scanner de câmera</p>
          <p className="text-xs text-slate-500">Use o campo manual abaixo</p>
        </div>
      </div>

      {/* Manual input */}
      <div className="p-3">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Digite o código manualmente..."
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}
