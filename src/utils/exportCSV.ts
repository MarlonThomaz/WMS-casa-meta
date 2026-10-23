// Função para exportar dados para CSV
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (!data || data.length === 0) {
    alert('Não há dados para exportar');
    return;
  }

  // Se headers não forem fornecidos, usar as chaves do primeiro objeto
  const columns = headers || Object.keys(data[0]);
  
  // Criar linha de cabeçalho
  const csvHeaders = columns.map(header => {
    // Escapar aspas duplas e envolver em aspas se necessário
    const value = String(header);
    return value.includes(',') || value.includes('"') || value.includes('\n')
      ? `"${value.replace(/"/g, '""')}"`
      : value;
  }).join(',');

  // Criar linhas de dados
  const csvRows = data.map(row => {
    return columns.map(column => {
      const value = row[column];
      const stringValue = value === null || value === undefined ? '' : String(value);
      
      // Escapar aspas duplas e envolver em aspas se necessário
      return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
    }).join(',');
  });

  // Combinar cabeçalho e linhas
  const csvContent = [csvHeaders, ...csvRows].join('\n');

  // Criar blob e fazer download
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Função para exportar inventário
export function exportInventoryToCSV(products: any[]) {
  const formattedData = products.map(p => ({
    SKU: p.sku,
    Nome: p.name,
    Categoria: p.category,
    Quantidade: p.quantity,
    Unidade: p.unit,
    Localização: p.location,
    Estoque_Mínimo: p.minStock,
    Estoque_Máximo: p.maxStock,
    Status: p.quantity <= p.minStock ? 'Baixo' : 'Normal',
    Última_Atualização: p.lastUpdate,
  }));

  exportToCSV(formattedData, 'inventario');
}

// Função para exportar localizações
export function exportLocationsToCSV(locations: any[]) {
  const formattedData = locations.map(l => ({
    Código: l.code,
    Zona: l.zone,
    Corredor: l.aisle,
    Estante: l.rack,
    Nível: l.level,
    Capacidade: l.capacity,
    Ocupado: l.occupied,
    Ocupação: l.capacity > 0 ? `${Math.round((l.occupied / l.capacity) * 100)}%` : '0%',
    Status: l.status === 'available' ? 'Disponível' : 
            l.status === 'occupied' ? 'Ocupada' : 
            l.status === 'reserved' ? 'Reservada' : 'Manutenção',
  }));

  exportToCSV(formattedData, 'localizacoes');
}

// Função para exportar movimentações
export function exportMovementsToCSV(movements: any[]) {
  const formattedData = movements.map(m => ({
    Referência: m.reference,
    Tipo: m.type === 'inbound' ? 'Entrada' : 
          m.type === 'outbound' ? 'Saída' : 
          m.type === 'transfer' ? 'Transferência' : 'Ajuste',
    Produto: m.productName,
    Quantidade: m.quantity,
    Origem: m.fromLocation,
    Destino: m.toLocation,
    Data: m.date,
    Operador: m.operator,
    Status: m.status === 'completed' ? 'Concluído' : 
            m.status === 'pending' ? 'Pendente' : 'Cancelado',
  }));

  exportToCSV(formattedData, 'movimentacoes');
}

// Função para exportar recebimentos
export function exportReceiptsToCSV(receipts: any[]) {
  const formattedData = receipts.map(r => ({
    Número: r.orderNumber,
    Fornecedor: r.supplier,
    Data: r.date,
    Doca: r.dock,
    Status: r.status === 'pending' ? 'Pendente' : 
            r.status === 'partial' ? 'Parcial' : 
            r.status === 'completed' ? 'Concluído' : 'Cancelado',
    Total_Itens: r.items?.length || 0,
  }));

  exportToCSV(formattedData, 'recebimentos');
}

// Função para exportar expedições
export function exportShipmentsToCSV(shipments: any[]) {
  const formattedData = shipments.map(s => ({
    Número: s.orderNumber,
    Cliente: s.customer,
    Data: s.date,
    Transportadora: s.carrier,
    Prioridade: s.priority === 'high' ? 'Alta' : 
                s.priority === 'medium' ? 'Média' : 'Baixa',
    Status: s.status === 'pending' ? 'Pendente' : 
            s.status === 'picking' ? 'Separação' : 
            s.status === 'packed' ? 'Embalado' : 
            s.status === 'shipped' ? 'Enviado' : 'Cancelado',
    Total_Itens: s.items?.length || 0,
  }));

  exportToCSV(formattedData, 'expedicoes');
}
