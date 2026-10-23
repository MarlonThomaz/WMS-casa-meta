import { useState } from 'react';
import { Barcode, PackagePlus, ArrowLeftRight, MapPin } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { useBarcodeLookup, useBarcodeDetails } from '../hooks/useBarcodes';

type Mode = 'register' | 'transfer' | 'locate';

export default function BarcodeKit() {
  const [mode, setMode] = useState<Mode>('register');
  const [lastScanned, setLastScanned] = useState<string>('');
  const [scanHistory, setScanHistory] = useState<{ code: string; time: string; action: string }[]>([]);

  const handleScan = (code: string) => {
    setLastScanned(code);
    setScanHistory(prev => [
      { code, time: new Date().toLocaleTimeString('pt-BR'), action: getActionLabel(mode) },
      ...prev.slice(0, 19),
    ]);
  };

  const getActionLabel = (m: Mode) => {
    switch (m) {
      case 'register': return 'Cadastro SKU';
      case 'transfer': return 'Transferência';
      case 'locate': return 'Localização';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Barcode className="w-7 h-7 text-blue-600" />
          Kit Leitor de Código de Barras
        </h1>
        <p className="text-slate-500">Escaneie códigos para cadastro, transferência ou localização de estoque</p>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => setMode('register')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            mode === 'register'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
            }`}>
              <PackagePlus className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800">Cadastrar SKU</h3>
          </div>
          <p className="text-sm text-slate-500">
            Escaneie um novo produto para iniciar o cadastro no sistema
          </p>
        </button>

        <button
          onClick={() => setMode('transfer')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            mode === 'transfer'
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === 'transfer' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'
            }`}>
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800">Transferência</h3>
          </div>
          <p className="text-sm text-slate-500">
            Escaneie produto e localizações para transferir itens entre endereços
          </p>
        </button>

        <button
          onClick={() => setMode('locate')}
          className={`p-4 rounded-xl border-2 transition-all text-left ${
            mode === 'locate'
              ? 'border-green-500 bg-green-50 shadow-md'
              : 'border-slate-200 bg-white hover:border-green-200 hover:bg-green-50/50'
          }`}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              mode === 'locate' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'
            }`}>
              <MapPin className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800">Localizar Estoque</h3>
          </div>
          <p className="text-sm text-slate-500">
            Escaneie um produto para encontrar sua localização no armazém
          </p>
        </button>
      </div>

      {/* Content based on mode */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <div>
          <BarcodeScanner onScan={handleScan} />
          
          {/* Last scanned */}
          {lastScanned && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-green-800">Último código escaneado</span>
              </div>
              <p className="text-lg font-mono font-bold text-green-900">{lastScanned}</p>
            </div>
          )}
        </div>

        {/* Mode-specific panel */}
        <div>
          {mode === 'register' && <RegisterPanel scannedCode={lastScanned} />}
          {mode === 'transfer' && <TransferPanel scannedCode={lastScanned} />}
          {mode === 'locate' && <LocatePanel scannedCode={lastScanned} />}
        </div>
      </div>

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Histórico de Escaneamentos</h3>
            <button
              onClick={() => setScanHistory([])}
              className="text-xs text-slate-500 hover:text-red-600 transition-colors"
            >
              Limpar
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Código</th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Ação</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Hora</th>
                </tr>
              </thead>
              <tbody>
                {scanHistory.map((item, idx) => (
                  <tr key={idx} className="border-t border-slate-50">
                    <td className="px-4 py-2 font-mono text-sm text-slate-700">{item.code}</td>
                    <td className="px-4 py-2 text-sm text-slate-600">{item.action}</td>
                    <td className="px-4 py-2 text-sm text-slate-500 text-right">{item.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== REGISTER PANEL ====================
function RegisterPanel({ scannedCode }: { scannedCode: string }) {
  const { product, loading, error, lookupBarcode, clear } = useBarcodeLookup();
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    quantity: 0,
    location: '',
    minStock: 0,
    maxStock: 100,
  });
  const [saved, setSaved] = useState(false);

  // Auto-lookup when scanned
  if (scannedCode && scannedCode !== formData.sku) {
    lookupBarcode(scannedCode);
    setFormData(prev => ({ ...prev, sku: scannedCode }));
  }

  const handleSave = () => {
    // Aqui você integraria com o serviço de produtos
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">Cadastro de Novo SKU</h3>
      </div>

      {loading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-700">Buscando produto...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">Produto não encontrado. Cadastre um novo.</p>
        </div>
      )}

      {product && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-800">Produto encontrado!</p>
          <p className="text-xs text-green-700 mt-1">
            <strong>{product.name}</strong> - SKU: {product.sku}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras / SKU</label>
          <input
            type="text"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Escaneie ou digite o código"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Produto</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Nome do produto"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ex: Eletrônicos"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade Inicial</label>
            <input
              type="number"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Localização</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="A-01-01-01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Mín.</label>
            <input
              type="number"
              value={formData.minStock}
              onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Estoque Máx.</label>
            <input
              type="number"
              value={formData.maxStock}
              onChange={(e) => setFormData({ ...formData, maxStock: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!formData.sku || !formData.name}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cadastrar Produto
        </button>

        {saved && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">Produto cadastrado com sucesso!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TRANSFER PANEL ====================
function TransferPanel({ scannedCode }: { scannedCode: string }) {
  const { product, loading, error, lookupBarcode } = useBarcodeLookup();
  const [productCode, setProductCode] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [transferred, setTransferred] = useState(false);

  // Auto-lookup when scanned
  if (scannedCode && scannedCode !== productCode) {
    lookupBarcode(scannedCode);
    setProductCode(scannedCode);
  }

  const handleTransfer = () => {
    // Aqui você integraria com o serviço de movimentações
    setTransferred(true);
    setTimeout(() => setTransferred(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <ArrowLeftRight className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-slate-800">Transferência de Itens</h3>
      </div>

      <div className="space-y-3">
        {/* Product */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            1. Escaneie o Produto
          </label>
          <input
            type="text"
            value={productCode}
            onChange={(e) => {
              setProductCode(e.target.value);
              lookupBarcode(e.target.value);
            }}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Código do produto"
          />
        </div>

        {/* Found product info */}
        {loading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">Buscando produto...</p>
          </div>
        )}

        {product && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">{product.name}</p>
            <div className="flex gap-4 mt-1 text-xs text-blue-700">
              <span>SKU: {product.sku}</span>
              <span>Estoque: {product.quantity_per_package}</span>
            </div>
          </div>
        )}

        {!product && productCode && !loading && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">Produto não encontrado no sistema</p>
          </div>
        )}

        {/* From Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            2. Localização de Origem
          </label>
          <input
            type="text"
            value={fromLocation}
            onChange={(e) => setFromLocation(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Ex: A-01-03-02"
          />
        </div>

        {/* To Location */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            3. Localização de Destino
          </label>
          <input
            type="text"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
            placeholder="Escaneie ou digite o endereço de destino"
          />
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            4. Quantidade
          </label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
          />
        </div>

        <button
          onClick={handleTransfer}
          disabled={!productCode || !fromLocation || !toLocation || fromLocation === toLocation}
          className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirmar Transferência
        </button>

        {transferred && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              Transferência de {quantity} unidade(s) de <strong>{fromLocation}</strong> para <strong>{toLocation}</strong> registrada!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== LOCATE PANEL ====================
function LocatePanel({ scannedCode }: { scannedCode: string }) {
  const { details, loading, error, lookupDetails } = useBarcodeDetails();
  const [searchCode, setSearchCode] = useState('');
  const [searched, setSearched] = useState(false);

  // Auto-locate when scanned
  if (scannedCode && scannedCode !== searchCode) {
    lookupDetails(scannedCode);
    setSearchCode(scannedCode);
    setSearched(true);
  }

  const handleLocate = () => {
    lookupDetails(searchCode);
    setSearched(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-slate-800">Localização de Estoque</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Escaneie ou digite o código do produto
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-green-500 outline-none"
              placeholder="Código de barras ou SKU"
            />
            <button
              onClick={handleLocate}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Buscar
            </button>
          </div>
        </div>

        {loading && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">Buscando produto...</p>
          </div>
        )}

        {searched && !details && !loading && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm font-medium text-red-800">Produto não encontrado</p>
            <p className="text-xs text-red-700 mt-1">
              O código "{searchCode}" não está cadastrado no sistema.
            </p>
          </div>
        )}

        {details && (
          <div className="space-y-3">
            {/* Product info */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-green-900">{details.name}</h4>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-green-600">SKU:</span>
                  <span className="ml-1 font-mono text-green-900">{details.sku}</span>
                </div>
                <div>
                  <span className="text-green-600">Estoque Total:</span>
                  <span className="ml-1 font-bold text-green-900">{details.total_stock}</span>
                </div>
              </div>
            </div>

            {/* Stock by location */}
            {details.stock_by_location && details.stock_by_location.length > 0 && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Estoque por Localização</h4>
                <div className="space-y-2">
                  {details.stock_by_location.map((loc: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg">
                      <span className="font-mono text-sm text-blue-900">{loc.location_code}</span>
                      <span className="font-bold text-blue-900">{loc.quantity} un</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
