import { useState } from 'react';
import { Box, Package, ArrowLeftRight, MapPin } from 'lucide-react';

type Mode = 'register' | 'transfer' | 'locate';

export default function BarcodeKit() {
  const [mode, setMode] = useState<Mode>('register');

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Box className="w-7 h-7 text-blue-600" />
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
              <Package className="w-5 h-5" />
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

      {/* Placeholder content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
        <p className="text-slate-500">Funcionalidade em desenvolvimento...</p>
      </div>
    </div>
  );
}
