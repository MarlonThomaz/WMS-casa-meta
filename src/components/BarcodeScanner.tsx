import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Keyboard, Upload, X } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose?: () => void;
  compact?: boolean;
}

type UsbScannerState = 'idle' | 'reading' | 'success';

const USB_SCAN_MIN_LENGTH = 4;
const USB_SCAN_MAX_KEY_INTERVAL_MS = 80;
const USB_SCAN_RESET_MS = 180;

export default function BarcodeScanner({ onScan, onClose, compact = false }: BarcodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [usbState, setUsbState] = useState<UsbScannerState>('idle');
  const [lastUsbCode, setLastUsbCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef(`barcode-scanner-${Math.random().toString(36).substring(7)}`);

  const usbBufferRef = useRef('');
  const usbStartedAtRef = useRef(0);
  const usbLastKeyAtRef = useRef(0);
  const usbResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const resetUsbBuffer = () => {
      usbBufferRef.current = '';
      usbStartedAtRef.current = 0;
      usbLastKeyAtRef.current = 0;
      setUsbState('idle');
    };

    const scheduleReset = () => {
      if (usbResetTimerRef.current !== null) {
        window.clearTimeout(usbResetTimerRef.current);
      }
      usbResetTimerRef.current = window.setTimeout(resetUsbBuffer, USB_SCAN_RESET_MS);
    };

    const finishUsbScan = () => {
      const code = usbBufferRef.current.trim();
      const startedAt = usbStartedAtRef.current;
      const lastKeyAt = usbLastKeyAtRef.current;
      const elapsed = startedAt > 0 && lastKeyAt >= startedAt ? lastKeyAt - startedAt : 0;
      const avgInterval = code.length > 1 ? elapsed / (code.length - 1) : 0;

      const looksLikeScanner =
        code.length >= USB_SCAN_MIN_LENGTH &&
        (code.length === 1 || avgInterval <= USB_SCAN_MAX_KEY_INTERVAL_MS);

      if (looksLikeScanner) {
        setLastUsbCode(code);
        setUsbState('success');
        onScan(code);
        if (navigator.vibrate) navigator.vibrate(120);
        window.setTimeout(() => setUsbState('idle'), 900);
      } else {
        resetUsbBuffer();
      }

      usbBufferRef.current = '';
      usbStartedAtRef.current = 0;
      usbLastKeyAtRef.current = 0;
      if (usbResetTimerRef.current !== null) {
        window.clearTimeout(usbResetTimerRef.current);
        usbResetTimerRef.current = null;
      }
    };

    const handleUsbKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (usbBufferRef.current.length > 0) {
          event.preventDefault();
          finishUsbScan();
        }
        return;
      }

      if (event.key.length !== 1) return;

      const now = performance.now();
      if (
        usbLastKeyAtRef.current > 0 &&
        now - usbLastKeyAtRef.current > USB_SCAN_RESET_MS
      ) {
        usbBufferRef.current = '';
        usbStartedAtRef.current = 0;
      }

      if (!usbStartedAtRef.current) usbStartedAtRef.current = now;
      usbLastKeyAtRef.current = now;
      usbBufferRef.current += event.key;
      setUsbState('reading');
      scheduleReset();
    };

    window.addEventListener('keydown', handleUsbKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleUsbKeyDown, true);
      if (usbResetTimerRef.current !== null) {
        window.clearTimeout(usbResetTimerRef.current);
      }
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  const startScanning = async () => {
    try {
      setError(null);

      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }
        },
        (errorMessage) => {
          if (!errorMessage.includes('NotFoundException')) {
            console.warn('Scan error:', errorMessage);
          }
        }
      );

      setScanning(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao iniciar câmera';
      setError(errorMessage);
      console.error('Scanner error:', err);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        setScanning(false);
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      const scanner = new Html5Qrcode(containerId.current);
      const decodedText = await scanner.scanFile(file, true);
      onScan(decodedText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao ler imagem';
      setError(errorMessage);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  };

  const usbStatusClass =
    usbState === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : usbState === 'reading'
        ? 'bg-amber-50 border-amber-200 text-amber-800'
        : 'bg-blue-50 border-blue-200 text-blue-800';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${compact ? '' : 'shadow-sm'}`}>
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${scanning ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
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

      <div className={`m-3 p-3 rounded-lg border ${usbStatusClass}`}>
        <div className="flex items-start gap-2">
          <Keyboard className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {usbState === 'success'
                ? 'Leitura USB recebida'
                : usbState === 'reading'
                  ? 'Recebendo leitura USB...'
                  : 'Leitor USB HID ativo'}
            </div>
            <div className="text-xs mt-0.5 opacity-90">
              Conecte um leitor laser genérico configurado como teclado. O WMS reconhece códigos rápidos finalizados por Enter ou Tab.
            </div>
            {lastUsbCode && (
              <div className="text-xs font-mono mt-1 break-all">Último: {lastUsbCode}</div>
            )}
          </div>
        </div>
      </div>

      <div className="relative bg-slate-900">
        <div
          id={containerId.current}
          className="w-full"
          style={{ minHeight: compact ? '180px' : '260px' }}
        />
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white pointer-events-none">
            <Camera className="w-12 h-12 mb-3 text-slate-400" />
            <p className="text-sm text-slate-300 mb-1">Scanner de câmera</p>
            <p className="text-xs text-slate-500">Ou use leitor USB / entrada manual abaixo</p>
          </div>
        )}
      </div>

      <div className="p-3 flex items-center gap-2">
        {!scanning ? (
          <button
            onClick={startScanning}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Camera className="w-4 h-4" />
            Iniciar Câmera
          </button>
        ) : (
          <button
            onClick={stopScanning}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
          >
            <CameraOff className="w-4 h-4" />
            Parar Câmera
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

      {error && (
        <div className="px-3 pb-3">
          <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}
