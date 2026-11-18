# Round 12 — Aton ERP: ponte de arquivos e contrato de integração
## O que foi confirmado, e o que não foi
A Ambar-X anuncia integração via API aos marketplaces e exportação de consultas para Excel (https://ambarx.com.br/ e https://ambarx.com.br/o-aton-erp/). A documentação de parceiros LogManager (https://ajuda.logmanager.com.br/docs/integracao-da-aton/) e TRACKen (https://www.tracken.com.br/integracao-aton/) indica integrações específicas. Isso não confirma API pública de catálogo, saldo ou pedidos disponível para Annona, nem endpoints, permissões ou formatos. Não são usados endpoints inventados, scraping, credenciais ou acesso direto ao banco ERP.

## Piloto por arquivos (funcionalidade implementada)
Inventário > Integração ERP (admin/manager ativo). Aplicar migrations até 035 em homologação. Um WMS corresponde a **um armazém/empresa**; a soma inclui todos os seus endereços. No Aton, filtrar exclusivamente o mesmo armazém e empresa, sem misturar filiais, kits, embalagens ou depósitos virtuais. O campo armazém é referência de relatório, não um filtro do banco. Use SKU exato e unidade base. As sugestões de mapeamento são heurísticas genéricas, não um layout oficial. O usuário deve confirmar o mapeamento.
1. Exportar consulta do Aton para Excel e salvar como CSV UTF-8 (vírgula ou ponto e vírgula). Preservar códigos como texto. Não abrir e salvar novamente com conversão automática de zeros à esquerda. Arquivos até 5 MB/5.000 linhas.
2. Catálogo: selecionar campos SKU, nome obrigatório; demais opcionais. Validar e confirmar. Usa a mesma RPC atômica 034: novos SKUs apenas, equivalentes ignorados e conflitos bloqueiam o arquivo. Nenhuma quantidade física é importada. Colunas extras são ignoradas deliberadamente.
3. Saldo: selecionar SKU, unidade, quantidade; exatamente uma linha por SKU, exportar relatório agregado. Informar empresa/armazém, data/hora e se é saldo físico ou disponível. Físico = soma de quantity; disponível = soma de quantity - reserved_quantity. Não inferir unidade, não converter caixas para unidades, não interpretar ausência como zero. Saldo negativo, separador de milhares e duplicatas bloqueiam a consulta. Diferença = ERP menos WMS. A diferença fica nula quando SKU é desconhecido/inativo ou unidade não coincide.
4. JSON preserva dados e precisão decimal; CSV é apenas para conferência humana, não importação no Aton. Comparação feita em uma consulta de banco consistente; a exportação do ERP pode estar defasada. Preferir janela sem movimentações. O relatório não é ordem de ajuste, não faz nenhuma escrita ou confirmação no ERP. Arquivos e resultados são mantidos apenas na tela; guardar relatório aprovado em local protegido, conforme política do cliente.

## Contrato a obter do suporte
Solicitar a suporte@ambarx.com.br, sem compartilhar credenciais por e-mail:
- API de integração homologada para terceiro/WMS, versão e documentação OpenAPI, URL sandbox, procedimento de credenciais e homologação.
- Identificadores estáveis de empresa/CNPJ, depósito, produto, SKU, barcode, unidade e conversões/kit.
- Consultas de catálogo, saldo físico/disponível/reservado, pedidos de venda e compras, cancelamentos e devoluções.
- Atualização de status de separação e expedição, confirmação de recebimento e ajustes; sem emissão fiscal pelo Annona.
- Webhooks ou polling, paginação, limites, cursor/data de alteração, idempotência, timezone e semântica de erros.
- Se API indisponível: layouts de exportação/importação CSV/XML, relatórios e procedimentos oficiais.

## Arquitetura da próxima fase (não implementada)
Aton é fonte de cadastro comercial, documentos fiscais, pedidos e obrigações tributárias. Annona é fonte de localização física, execução e contagens; autoridade de quantidade global deverá ser acordada com o cliente para evitar dupla baixa. Não sincronizar ambos os saldos cegamente.
Backend separado (Edge Function/serviço) com segredo fora do browser, credenciais mínimas, filas de entrada/saída persistentes, chave de idempotência por empresa/depósito/documento/evento, deduplicação, retry limitado e dead letter, auditoria e reconciliação. Fluxo pretendido: Aton -> pedido aprovado -> documento operacional pendente Annona -> separação/recebimento confirmado -> evento de confirmação Aton -> ack. Separar confirmação logística de faturamento. Reprocessamento não pode duplicar movimentos. Testar primeiro em sandbox autorizado com contraexemplos (kit, devolução, cancelamento, alteração de pedido em picking, falha entre commit e ack).
Nenhum agendamento, sincronização direta, endpoint de escrita, tratamento fiscal, integração multiempresa ou transmissão automática de pedidos foi habilitado na Round 12A. Antes de ativar, obter contrato e amostras anonimizadas, homologar mapeamento e aprovar a autoridade de cada dado.
