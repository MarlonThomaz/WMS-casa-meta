import { useState, useEffect, useRef } from 'react';
import { Barcode, PackagePlus, ArrowLeftRight, MapPin, CheckCircle, AlertCircle, Info } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { products as initialProducts, locations } from '../data';
import { Product } from '../types';

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
                <CheckCircle className="w-4 h-4 text-green-600" />
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
  const [existingProduct, setExistingProduct] = useState<Product | null>(null);
  const lastScannedRef = useRef<string>('');

  // Auto-fill SKU when scanned
  useEffect(() => {
    if (scannedCode && scannedCode !== lastScannedRef.current) {
      lastScannedRef.current = scannedCode;
      setFormData(prev => ({ ...prev, sku: scannedCode }));
      const existing = initialProducts.find(p => p.sku === scannedCode);
      setExistingProduct(existing || null);
    }
  }, [scannedCode]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <PackagePlus className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-slate-800">Cadastro de Novo SKU</h3>
      </div>

      {existingProduct && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">Produto já cadastrado!</p>
            <p className="text-xs text-amber-700 mt-1">
              <strong>{existingProduct.name}</strong> está localizado em <strong>{existingProduct.location}</strong> com {existingProduct.quantity} unidades em estoque.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras / SKU</label>
          <input
            type="text"
            value={formData.sku || scannedCode}
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
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">Produto cadastrado com sucesso!</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== TRANSFER PANEL ====================
function TransferPanel({ scannedCode }: { scannedCode: string }) {
  const [productCode, setProductCode] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [transferred, setTransferred] = useState(false);
  const lastScannedRef = useRef<string>('');

  // Auto-detect product when scanned
  const handleProductScan = (code: string) => {
    setProductCode(code);
    const product = initialProducts.find(p => p.sku === code || p.id === code);
    if (product) {
      setFoundProduct(product);
      setFromLocation(product.location);
    } else {
      setFoundProduct(null);
    }
  };

  // Use scannedCode if it's a product
  useEffect(() => {
    if (scannedCode && scannedCode !== lastScannedRef.current) {
      lastScannedRef.current = scannedCode;
      const product = initialProducts.find(p => p.sku === scannedCode);
      if (product) {
        setFoundProduct(product);
        setProductCode(scannedCode);
        setFromLocation(product.location);
      }
    }
  }, [scannedCode]);

  const handleTransfer = () => {
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
          <div className="flex gap-2">
            <input
              type="text"
              value={productCode}
              onChange={(e) => {
                setProductCode(e.target.value);
                handleProductScan(e.target.value);
              }}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg font-mono focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Código do produto"
            />
            <button
              onClick={() => handleProductScan(scannedCode)}
              className="px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
            >
              Usar Último
            </button>
          </div>
        </div>

        {/* Found product info */}
        {foundProduct && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800">{foundProduct.name}</p>
            <div className="flex gap-4 mt-1 text-xs text-blue-700">
              <span>SKU: {foundProduct.sku}</span>
              <span>Estoque: {foundProduct.quantity} {foundProduct.unit}</span>
              <span>Local: {foundProduct.location}</span>
            </div>
          </div>
        )}

        {!foundProduct && productCode && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">Produto não encontrado no sistema</span>
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
          {/* Quick location selector */}
          <div className="mt-2 flex flex-wrap gap-1">
            {locations.filter(l => l.status === 'available').slice(0, 5).map(loc => (
              <button
                key={loc.id}
                onClick={() => setToLocation(loc.code)}
                className="text-xs px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors font-mono"
              >
                {loc.code}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            4. Quantidade
          </label>
          <input
            type="number"
            min={1}
            max={foundProduct?.quantity || 999}
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
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">
              Transferência de {quantity} unidade(s) de <strong>{fromLocation}</strong> para <strong>{toLocation}</strong> registrada!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== LOCATE PANEL ====================
function LocatePanel({ scannedCode }: { scannedCode: string }) {
  const [searchCode, setSearchCode] = useState('');
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [searched, setSearched] = useState(false);
  const lastScannedRef = useRef<string>('');

  const handleLocate = (code: string) => {
    setSearchCode(code);
    const product = initialProducts.find(p => p.sku === code || p.id === code);
    setFoundProduct(product || null);
    setSearched(true);
  };

  // Auto-locate when scanned
  useEffect(() => {
    if (scannedCode && scannedCode !== lastScannedRef.current) {
      lastScannedRef.current = scannedCode;
      handleLocate(scannedCode);
    }
  }, [scannedCode]);

  const foundLocation = foundProduct 
    ? locations.find(l => l.code === foundProduct.location)
    : null;

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
              onClick={() => handleLocate(searchCode)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
            >
              Buscar
            </button>
          </div>
        </div>

        {searched && !foundProduct && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Produto não encontrado</p>
              <p className="text-xs text-red-700 mt-1">
                O código "{searchCode}" não está cadastrado no sistema. Verifique o código e tente novamente.
              </p>
            </div>
          </div>
        )}

        {foundProduct && (
          <div className="space-y-3">
            {/* Product info */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-green-900">{foundProduct.name}</h4>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <div>
                      <span className="text-green-600">SKU:</span>
                      <span className="ml-1 font-mono text-green-900">{foundProduct.sku}</span>
                    </div>
                    <div>
                      <span className="text-green-600">Categoria:</span>
                      <span className="ml-1 text-green-900">{foundProduct.category}</span>
                    </div>
                    <div>
                      <span className="text-green-600">Estoque:</span>
                      <span className="ml-1 font-bold text-green-900">{foundProduct.quantity} {foundProduct.unit}</span>
                    </div>
                    <div>
                      <span className="text-green-600">Última Atualização:</span>
                      <span className="ml-1 text-green-900">{foundProduct.lastUpdate}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location info */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">Localização no Armazém</h4>
              </div>
              
              <div className="text-center mb-3">
                <div className="inline-block px-6 py-3 bg-white rounded-xl border-2 border-blue-300 shadow-sm">
                  <p className="text-xs text-blue-500 uppercase font-medium">Endereço</p>
                  <p className="text-2xl font-mono font-bold text-blue-900">{foundProduct.location}</p>
                </div>
              </div>

              {foundLocation && (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg">
                    <p className="text-xs text-blue-500">Zona</p>
                    <p className="font-bold text-blue-900">{foundLocation.zone}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg">
                    <p className="text-xs text-blue-500">Corredor</p>
                    <p className="font-bold text-blue-900">{foundLocation.aisle}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg">
                    <p className="text-xs text-blue-500">Estante</p>
                    <p className="font-bold text-blue-900">{foundLocation.rack}</p>
                  </div>
                  <div className="p-2 bg-white rounded-lg">
                    <p className="text-xs text-blue-500">Nível</p>
                    <p className="font-bold text-blue-900">{foundLocation.level}</p>
                  </div>
                </div>
              )}

              {/* Visual guide */}
              <div className="mt-3 p-3 bg-white rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <Info className="w-4 h-4" />
                  <span>
                    Dirija-se à <strong>Zona {foundLocation?.zone}</strong>, 
                    corredor <strong>{foundLocation?.aisle}</strong>, 
                    estante <strong>{foundLocation?.rack}</strong>, 
                    nível <strong>{foundLocation?.level}</strong>.
                  </span>
                </div>
              </div>
            </div>

            {/* Stock level indicator */}
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Nível de Estoque</span>
                <span className="text-xs font-medium text-slate-700">
                  {foundProduct.quantity} / {foundProduct.maxStock}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    foundProduct.quantity <= foundProduct.minStock
                      ? 'bg-red-500'
                      : foundProduct.quantity >= foundProduct.maxStock * 0.8
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min(100, (foundProduct.quantity / foundProduct.maxStock) * 100)}%` }}
                ></div>
              </div>
              {foundProduct.quantity <= foundProduct.minStock && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Estoque abaixo do mínimo ({foundProduct.minStock})
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
