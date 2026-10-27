import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle,
  Loader2,
  MapPin,
  Package,
  ScanLine,
} from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { useAuth } from '../contexts/AuthContext';
import { useLocations } from '../hooks/useLocations';
import {
  getProductDetailsByBarcode,
  ProductBarcodeDetails,
  registerProductWithBarcode,
  validateBarcode,
} from '../services/barcodes';
import { createAndProcessMovement } from '../services/movements';

type Mode = 'register' | 'transfer' | 'locate';

export default function BarcodeKit() {
  const { user } = useAuth();
  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';
  const [mode, setMode] = useState<Mode>(canOperate ? 'register' : 'locate');
  const [showScanner, setShowScanner] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [details, setDetails] = useState<ProductBarcodeDetails | null>(null);
  const [scannedCode, setScannedCode] = useState('');

  const selectMode = (next: Mode) => {
    if (!canOperate && next !== 'locate') return;
    setMode(next);
    setDetails(null);
    setScannedCode('');
    setError(null);
    setSuccess(null);
    setShowScanner(false);
  };

  const handleScan = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setScannedCode(code);
    setShowScanner(false);
    setError(null);
    setSuccess(null);
    setLookupLoading(true);

    try {
      const found = await getProductDetailsByBarcode(code);
      setDetails(found);

      if (mode === 'register') {
        if (found) {
          setError(`O código ${code} já pertence ao SKU ${found.sku}.`);
        }
      } else if (!found) {
        setError(`Nenhum produto ativo encontrado para o código ${code}.`);
      }
    } catch (err) {
      setDetails(null);
      setError(err instanceof Error ? err.message : 'Erro ao consultar código');
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Código de barras</h1>
        <p className="text-slate-500">
          Cadastre SKUs, transfira estoque e localize produtos usando câmera ou entrada manual.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ModeButton
          active={mode === 'register'}
          disabled={!canOperate}
          title="Cadastrar produto"
          description="Produto + código + estoque inicial"
          icon={<Package className="w-5 h-5" />}
          onClick={() => selectMode('register')}
        />
        <ModeButton
          active={mode === 'transfer'}
          disabled={!canOperate}
          title="Transferir"
          description="Mover saldo entre endereços"
          icon={<ArrowLeftRight className="w-5 h-5" />}
          onClick={() => selectMode('transfer')}
        />
        <ModeButton
          active={mode === 'locate'}
          title="Localizar"
          description="Consultar saldo por endereço"
          icon={<MapPin className="w-5 h-5" />}
          onClick={() => selectMode('locate')}
        />
      </div>

      {!canOperate && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
          Seu perfil é somente leitura. Cadastro e transferência ficam disponíveis para operador, gerente e administrador.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-800">Código atual</h2>
            <p className="text-sm text-slate-500">
              {scannedCode || 'Nenhum código lido.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowScanner((value) => !value)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ScanLine className="w-4 h-4" />
            {showScanner ? 'Fechar scanner' : 'Escanear código'}
          </button>
        </div>

        {showScanner && (
          <BarcodeScanner
            onScan={(code) => void handleScan(code)}
            onClose={() => setShowScanner(false)}
          />
        )}

        {lookupLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Consultando cadastro e estoque...
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}
      </div>

      {mode === 'register' && canOperate && (
        <RegisterPanel
          barcode={scannedCode}
          existing={details}
          onRegistered={async (barcode, message) => {
            setSuccess(message);
            setError(null);
            const refreshed = await getProductDetailsByBarcode(barcode);
            setDetails(refreshed);
          }}
        />
      )}

      {mode === 'transfer' && canOperate && (
        <TransferPanel
          details={details}
          onTransferred={async (barcode, message) => {
            setSuccess(message);
            setError(null);
            const refreshed = await getProductDetailsByBarcode(barcode);
            setDetails(refreshed);
          }}
        />
      )}

      {mode === 'locate' && <LocatePanel details={details} />}
    </div>
  );
}

function RegisterPanel({
  barcode,
  existing,
  onRegistered,
}: {
  barcode: string;
  existing: ProductBarcodeDetails | null;
  onRegistered: (barcode: string, message: string) => Promise<void>;
}) {
  const { locations } = useLocations();
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('un');
  const [minStock, setMinStock] = useState('0');
  const [maxStock, setMaxStock] = useState('');
  const [packagingType, setPackagingType] = useState('unit');
  const [quantityPerPackage, setQuantityPerPackage] = useState('1');
  const [initialQuantity, setInitialQuantity] = useState('0');
  const [initialLocation, setInitialLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const usableLocations = locations.filter(
    (location) => location.status !== 'blocked' && location.status !== 'maintenance'
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const normalizedBarcode = barcode.trim();
    const barcodeValidation = validateBarcode(normalizedBarcode);
    const min = Number(minStock);
    const max = maxStock.trim() === '' ? undefined : Number(maxStock);
    const factor = Number(quantityPerPackage);
    const initial = Number(initialQuantity);

    if (!normalizedBarcode) {
      setFormError('Escaneie ou digite o código antes de cadastrar.');
      return;
    }
    if (existing) {
      setFormError(`Este código já pertence ao SKU ${existing.sku}.`);
      return;
    }
    if (!barcodeValidation.valid) {
      setFormError('Código inválido.');
      return;
    }
    if (!sku.trim() || !name.trim()) {
      setFormError('SKU e nome são obrigatórios.');
      return;
    }
    if (!Number.isFinite(min) || min < 0) {
      setFormError('Estoque mínimo inválido.');
      return;
    }
    if (max !== undefined && (!Number.isFinite(max) || max < min)) {
      setFormError('Estoque máximo precisa ser maior ou igual ao mínimo.');
      return;
    }
    if (!Number.isFinite(factor) || factor <= 0) {
      setFormError('Quantidade por embalagem precisa ser maior que zero.');
      return;
    }
    if (!Number.isFinite(initial) || initial < 0) {
      setFormError('Estoque inicial inválido.');
      return;
    }
    if (initial > 0 && !initialLocation) {
      setFormError('Selecione a localização do estoque inicial.');
      return;
    }

    try {
      setSaving(true);
      await registerProductWithBarcode({
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim() || undefined,
        unit_base: unit.trim() || 'un',
        min_stock: min,
        max_stock: max,
        barcode: normalizedBarcode,
        barcode_type: barcodeValidation.type,
        packaging_type: packagingType,
        quantity_per_package: factor,
        initial_location_id: initial > 0 ? initialLocation : undefined,
        initial_quantity: initial,
      });

      await onRegistered(
        normalizedBarcode,
        initial > 0
          ? `Produto ${sku.trim()} cadastrado e estoque inicial lançado.`
          : `Produto ${sku.trim()} cadastrado com sucesso.`
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar produto');
    } finally {
      setSaving(false);
    }
  };

  if (!barcode) {
    return <EmptyAction text="Escaneie um código novo para iniciar o cadastro." />;
  }

  if (existing) {
    return (
      <div className="bg-white border border-amber-200 rounded-xl p-5">
        <div className="font-semibold text-slate-800">Código já cadastrado</div>
        <div className="text-sm text-slate-600 mt-1">
          {existing.sku} — {existing.name} · saldo total {existing.total_stock}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Cadastrar produto pelo código</h2>
        <p className="text-sm text-slate-500 font-mono mt-1">{barcode}</p>
      </div>

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="SKU">
          <input required value={sku} onChange={(e) => setSku(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Nome">
          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Categoria">
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Unidade base">
          <input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Estoque mínimo">
          <input type="number" min={0} step="any" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Estoque máximo">
          <input type="number" min={0} step="any" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Tipo da embalagem">
          <select value={packagingType} onChange={(e) => setPackagingType(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white">
            <option value="unit">Unidade</option>
            <option value="box">Caixa</option>
            <option value="pack">Pacote</option>
            <option value="pallet">Pallet</option>
          </select>
        </Field>
        <Field label="Unidades por embalagem">
          <input type="number" min={0.000001} step="any" value={quantityPerPackage} onChange={(e) => setQuantityPerPackage(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
        <Field label="Estoque inicial (unidade base)">
          <input type="number" min={0} step="any" value={initialQuantity} onChange={(e) => setInitialQuantity(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
        </Field>
      </div>

      {Number(initialQuantity) > 0 && (
        <Field label="Localização do estoque inicial">
          <select required value={initialLocation} onChange={(e) => setInitialLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white">
            <option value="">Selecione</option>
            {usableLocations.map((location) => (
              <option key={location.id} value={location.id}>{location.code} — Zona {location.zone}</option>
            ))}
          </select>
        </Field>
      )}

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {saving ? 'Cadastrando...' : 'Cadastrar produto'}
        </button>
      </div>
    </form>
  );
}

function TransferPanel({
  details,
  onTransferred,
}: {
  details: ProductBarcodeDetails | null;
  onTransferred: (barcode: string, message: string) => Promise<void>;
}) {
  const { locations } = useLocations();
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sourceOptions = details?.stock_by_location.filter((stock) => stock.available_quantity > 0) || [];
  const source = sourceOptions.find((stock) => stock.location_id === fromLocation);
  const destinations = locations.filter(
    (location) =>
      location.id !== fromLocation &&
      location.status !== 'blocked' &&
      location.status !== 'maintenance'
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (!details) {
      setFormError('Escaneie um produto cadastrado.');
      return;
    }

    const qty = Number(quantity);
    if (!fromLocation || !toLocation) {
      setFormError('Selecione origem e destino.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Quantidade precisa ser maior que zero.');
      return;
    }
    if (!source || qty > source.available_quantity) {
      setFormError(`Saldo disponível insuficiente. Disponível: ${source?.available_quantity ?? 0}.`);
      return;
    }

    try {
      setSaving(true);
      await createAndProcessMovement({
        movement_type: 'transfer',
        source_reference: `BARCODE:${details.barcode}`,
        notes: `Transferência via scanner do SKU ${details.sku}`,
        lines: [
          {
            product_id: details.product_id,
            from_location_id: fromLocation,
            to_location_id: toLocation,
            quantity: qty,
            unit: 'un',
            notes: 'Transferência pelo kit de código de barras',
          },
        ],
      });

      setFromLocation('');
      setToLocation('');
      setQuantity('1');
      await onTransferred(details.barcode, `Transferência de ${qty} unidade(s) concluída.`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao transferir estoque');
    } finally {
      setSaving(false);
    }
  };

  if (!details) {
    return <EmptyAction text="Escaneie um produto cadastrado para transferir estoque." />;
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <ProductHeader details={details} />

      {formError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {formError}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Field label="Origem">
          <select value={fromLocation} onChange={(e) => { setFromLocation(e.target.value); setToLocation(''); }} className="w-full border rounded-lg px-3 py-2 bg-white" required>
            <option value="">Selecione</option>
            {sourceOptions.map((stock) => (
              <option key={stock.location_id} value={stock.location_id}>
                {stock.location_code} — disponível {stock.available_quantity}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Destino">
          <select value={toLocation} onChange={(e) => setToLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2 bg-white" required>
            <option value="">Selecione</option>
            {destinations.map((location) => (
              <option key={location.id} value={location.id}>{location.code} — Zona {location.zone}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantidade (unidade base)">
          <input type="number" min={0.000001} step="any" max={source?.available_quantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
        </Field>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving || sourceOptions.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
          {saving ? 'Transferindo...' : 'Confirmar transferência'}
        </button>
      </div>
    </form>
  );
}

function LocatePanel({ details }: { details: ProductBarcodeDetails | null }) {
  if (!details) {
    return <EmptyAction text="Escaneie um produto cadastrado para consultar onde ele está." />;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <ProductHeader details={details} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Metric label="Saldo total" value={details.total_stock} />
        <Metric
          label="Reservado"
          value={details.stock_by_location.reduce((sum, item) => sum + item.reserved_quantity, 0)}
        />
        <Metric
          label="Disponível"
          value={details.stock_by_location.reduce((sum, item) => sum + item.available_quantity, 0)}
        />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Localização</th>
              <th className="px-4 py-3 text-right">Físico</th>
              <th className="px-4 py-3 text-right">Reservado</th>
              <th className="px-4 py-3 text-right">Disponível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {details.stock_by_location.map((stock) => (
              <tr key={stock.location_id}>
                <td className="px-4 py-3 font-mono text-sm">{stock.location_code}</td>
                <td className="px-4 py-3 text-sm text-right">{stock.quantity}</td>
                <td className="px-4 py-3 text-sm text-right">{stock.reserved_quantity}</td>
                <td className="px-4 py-3 text-sm text-right font-semibold">{stock.available_quantity}</td>
              </tr>
            ))}
            {details.stock_by_location.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">Produto sem saldo em localização.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductHeader({ details }: { details: ProductBarcodeDetails }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <div className="text-xs font-mono text-slate-500">{details.sku}</div>
        <h2 className="text-xl font-bold text-slate-800">{details.name}</h2>
        <div className="text-sm text-slate-500 mt-1">
          Código {details.barcode} · embalagem {details.packaging_type} · fator {details.quantity_per_package}
        </div>
      </div>
      <div className="text-right">
        <div className="text-xs text-slate-500">Saldo total</div>
        <div className="text-2xl font-bold text-slate-800">{details.total_stock}</div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`p-4 rounded-xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'border-blue-500 bg-blue-50 text-blue-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-center gap-2 font-semibold">{icon}{title}</div>
      <div className="text-xs mt-1 opacity-75">{description}</div>
    </button>
  );
}

function EmptyAction({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
      <ScanLine className="w-8 h-8 mx-auto mb-3 text-slate-400" />
      {text}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-lg p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-800 mt-1">{value}</div>
    </div>
  );
}
