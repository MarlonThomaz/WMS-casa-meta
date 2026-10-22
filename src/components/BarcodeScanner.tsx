import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, CameraOff, Upload, X, Loader2 } from 'lucide-react';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef(`barcode-scanner-${Math.random().toString(36).substring(7)}`);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Preferir câmera traseira se disponível
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('rear')
          );
          setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
        }
      })
      .catch((err) => {
        setError('Não foi possível acessar as câmeras. Verifique as permissões.');
        console.error(err);
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    if (!selectedCamera) {
      setError('Nenhuma câmera selecionada.');
      return;
    }

    setError(null);

    try {
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
        (decodedText) => {
          onScan(decodedText);
          // Vibração como feedback (se suportado)
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        },
        () => {
          // Erro de leitura (ignorado - acontece continuamente)
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
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    scannerRef.current = null;
    setScanning(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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

    scanner
      .scanFile(file, true)
      .then((decodedText) => {
        onScan(decodedText);
      })
      .catch(() => {
        setError('Não foi possível detectar código de barras na imagem.');
      });
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

      {/* Error */}
      {error && (
        <div className="px-3 pb-3">
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
