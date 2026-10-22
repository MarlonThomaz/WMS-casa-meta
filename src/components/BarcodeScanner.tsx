import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Upload, X } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

export default function BarcodeScanner({ onScan, onClose, compact = false }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<any>(null);
  const containerId = useRef(`barcode-scanner-${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    let mounted = true;
    
    const loadCameras = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        const devices = await Html5Qrcode.getCameras();
        if (mounted && devices && devices.length) {
          setCameras(devices);
          const backCamera = devices.find((d: any) => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('rear')
          );
          setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        }
      } catch (err) {
        if (mounted) {
          console.warn('Câmera não disponível:', err);
          setError('Câmera não disponível neste dispositivo. Use o campo manual abaixo.');
        }
      }
    };

    loadCameras();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  const startScanning = async () => {
    if (!selectedCamera) {
      setError('Nenhuma câmera selecionada.');
      return;
    }

    setError(null);

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      const scanner = new Html5Qrcode(containerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.CODABAR,
        ],
        verbose: false,
      });

      await scanner.start(
        selectedCamera,
        {
          fps: 10,
          qrbox: compact ? { width: 200, height: 120 } : { width: 280, height: 160 },
          aspectRatio: 1.777,
        },
        (decodedText: string) => {
          onScan(decodedText);
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        },
        () => {
          // Erro de leitura (ignorado)
        }
      );

      scannerRef.current = scanner;
      setScanning(true);
    } catch (err) {
      setError('Erro ao iniciar a câmera. Verifique as permissões.');
      console.error(err);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    scannerRef.current = null;
    setScanning(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
      
      const scanner = new Html5Qrcode(containerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });

      const decodedText = await scanner.scanFile(file, true);
      onScan(decodedText);
    } catch {
      setError('Não foi possível detectar código de barras na imagem.');
    }
  };

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
          <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
          <span className="text-sm font-medium text-slate-700">
            {scanning ? 'Escaneando...' : 'Aguardando'}
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Camera selector */}
      {cameras.length > 1 && (
        <div className="p-3 border-b border-slate-100">
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            disabled={scanning}
            className="w-full text-sm px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
          >
            {cameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.label || `Câmera ${cam.id}`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Scanner area */}
      <div className="relative bg-black">
        <div
          id={containerId.current}
          className="w-full"
          style={{ minHeight: compact ? '180px' : '260px' }}
        />
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white">
            <Camera className="w-12 h-12 mb-3 text-slate-400" />
            <p className="text-sm text-slate-300 mb-1">Câmera desativada</p>
            <p className="text-xs text-slate-500">Clique em iniciar para escanear</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 flex items-center gap-2">
        {!scanning ? (
          <button
            onClick={startScanning}
            disabled={!selectedCamera}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            Iniciar Scanner
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
          >
            <CameraOff className="w-4 h-4" />
            Parar Scanner
          </button>
        )}
        <label className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer text-sm font-medium">
          <Upload className="w-4 h-4" />
          Imagem
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Manual input */}
      <div className="p-3 border-t border-slate-100">
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

      {/* Error */}
      {error && (
        <div className="px-3 pb-3">
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
