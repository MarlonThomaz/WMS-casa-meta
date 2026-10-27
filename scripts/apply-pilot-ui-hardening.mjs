import fs from 'node:fs';

function patch(path, replacements) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [needle, replacement] of replacements) {
    if (!text.includes(needle)) {
      throw new Error(`Trecho esperado não encontrado em ${path}: ${needle.slice(0, 120)}`);
    }
    text = text.replace(needle, replacement);
  }
  fs.writeFileSync(path, text);
}

patch('src/components/Receiving.tsx', [
  [
    "import { useLocations } from '../hooks/useLocations';\nimport type { DBReceipt } from '../types';",
    "import { useLocations } from '../hooks/useLocations';\nimport { useAuth } from '../contexts/AuthContext';\nimport type { DBReceipt } from '../types';"
  ],
  [
    "export default function Receiving() {\n  const { receipts, loading, error, refresh } = useReceipts();",
    "export default function Receiving() {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { receipts, loading, error, refresh } = useReceipts();"
  ],
  [
    "          onClick={() => setShowCreate(true)}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700\"",
    "          onClick={() => setShowCreate(true)}\n          disabled={!canOperate}\n          title={canOperate ? 'Criar recebimento' : 'Seu perfil é somente leitura'}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed\""
  ],
  [
    "function ReceiptDetail({ receiptId, onBack }: { receiptId: string; onBack: () => void }) {\n  const { receipt, loading, error, refresh } = useReceipt(receiptId);",
    "function ReceiptDetail({ receiptId, onBack }: { receiptId: string; onBack: () => void }) {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { receipt, loading, error, refresh } = useReceipt(receiptId);"
  ],
  [
    "  const editable = receipt.status === 'pending' || receipt.status === 'partial';",
    "  const editable = canOperate && (receipt.status === 'pending' || receipt.status === 'partial');"
  ]
]);

patch('src/components/Shipping.tsx', [
  [
    "import { useLocations } from '../hooks/useLocations';\nimport type { DBShipment } from '../types';",
    "import { useLocations } from '../hooks/useLocations';\nimport { useAuth } from '../contexts/AuthContext';\nimport type { DBShipment } from '../types';"
  ],
  [
    "export default function Shipping() {\n  const { shipments, loading, error, refresh } = useShipments();",
    "export default function Shipping() {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { shipments, loading, error, refresh } = useShipments();"
  ],
  [
    "          onClick={() => setShowCreate(true)}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700\"",
    "          onClick={() => setShowCreate(true)}\n          disabled={!canOperate}\n          title={canOperate ? 'Criar expedição' : 'Seu perfil é somente leitura'}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed\""
  ],
  [
    "function ShipmentDetail({ shipmentId, onBack }: { shipmentId: string; onBack: () => void }) {\n  const { shipment, loading, error, refresh } = useShipment(shipmentId);",
    "function ShipmentDetail({ shipmentId, onBack }: { shipmentId: string; onBack: () => void }) {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { shipment, loading, error, refresh } = useShipment(shipmentId);"
  ],
  [
    "                    {shipment.status === 'picking' ? (",
    "                    {shipment.status === 'picking' && canOperate ? ("
  ],
  [
    "        {(shipment.status === 'pending' || shipment.status === 'picking') && (",
    "        {canOperate && (shipment.status === 'pending' || shipment.status === 'picking') && ("
  ],
  [
    "        {shipment.status === 'pending' && (",
    "        {canOperate && shipment.status === 'pending' && ("
  ],
  [
    "        {shipment.status === 'picking' && (",
    "        {canOperate && shipment.status === 'picking' && ("
  ],
  [
    "        {shipment.status === 'packed' && (",
    "        {canOperate && shipment.status === 'packed' && ("
  ]
]);

patch('src/components/StockCount.tsx', [
  [
    "import { useLocations } from '../hooks/useLocations';\nimport type { StockCount as StockCountRecord } from '../services/stockCounts';",
    "import { useLocations } from '../hooks/useLocations';\nimport { useAuth } from '../contexts/AuthContext';\nimport type { StockCount as StockCountRecord } from '../services/stockCounts';"
  ],
  [
    "export default function StockCount() {\n  const { counts, loading, error, refresh } = useStockCounts();",
    "export default function StockCount() {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { counts, loading, error, refresh } = useStockCounts();"
  ],
  [
    "          onClick={() => setShowCreate(true)}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700\"",
    "          onClick={() => setShowCreate(true)}\n          disabled={!canOperate}\n          title={canOperate ? 'Criar contagem' : 'Seu perfil é somente leitura'}\n          className=\"flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed\""
  ],
  [
    "function StockCountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {\n  const { count, loading, error, refresh: refreshCount } = useStockCount(countId);",
    "function StockCountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {\n  const { user } = useAuth();\n  const canOperate = user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operator';\n  const { count, loading, error, refresh: refreshCount } = useStockCount(countId);"
  ],
  [
    "          {count.status === 'pending' && (",
    "          {canOperate && count.status === 'pending' && ("
  ],
  [
    "          {count.status === 'in_progress' && (",
    "          {canOperate && count.status === 'in_progress' && ("
  ],
  [
    "          {(count.status === 'pending' || count.status === 'in_progress') && (",
    "          {canOperate && (count.status === 'pending' || count.status === 'in_progress') && ("
  ],
  [
    "                      {count.status === 'in_progress' ? (",
    "                      {count.status === 'in_progress' && canOperate ? ("
  ]
]);

patch('src/services/stockCounts.ts', [
  [
`export async function getInventoryAccuracy(locationId?: string) {
  if (isDemoMode) {
    const data = demoStockCountLines.filter((line) => !locationId || line.location_id === locationId);
    if (data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
    const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
    return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
  }
  if (!isSupabaseConfigured) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
  let query = supabase.from('stock_count_lines').select('system_quantity, counted_quantity');
  if (locationId) query = query.eq('location_id', locationId);
  const { data, error } = await query;
  if (error) throw new Error(\`Erro ao calcular precisão: \${error.message}\`);
  if (!data || data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
  const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
  return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
}`,
`export async function getInventoryAccuracy(locationId?: string) {
  if (isDemoMode) {
    const completedIds = new Set(demoStockCounts.filter((count) => count.status === 'completed').map((count) => count.id));
    const data = demoStockCountLines.filter(
      (line) => completedIds.has(line.stock_count_id) && (!locationId || line.location_id === locationId)
    );
    if (data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };
    const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
    return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
  }

  if (!isSupabaseConfigured) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };

  const { data: completedCounts, error: countsError } = await supabase
    .from('stock_counts')
    .select('id')
    .eq('status', 'completed');
  if (countsError) throw new Error(\`Erro ao buscar contagens concluídas: \${countsError.message}\`);

  const completedIds = (completedCounts || []).map((count) => count.id);
  if (completedIds.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };

  let query = supabase
    .from('stock_count_lines')
    .select('system_quantity, counted_quantity')
    .in('stock_count_id', completedIds);
  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;
  if (error) throw new Error(\`Erro ao calcular precisão: \${error.message}\`);
  if (!data || data.length === 0) return { accuracy: 100, total_lines: 0, accurate_lines: 0, discrepancies: 0 };

  const accurateLines = data.filter((line) => Number(line.system_quantity) === Number(line.counted_quantity)).length;
  return { accuracy: (accurateLines / data.length) * 100, total_lines: data.length, accurate_lines: accurateLines, discrepancies: data.length - accurateLines };
}`
  ]
]);

console.log('UI/metrics hardening applied successfully');
