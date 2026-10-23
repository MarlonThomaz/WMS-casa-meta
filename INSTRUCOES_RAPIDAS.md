# 🚀 Instruções Rápidas - Etapa 1

## ✅ O que foi implementado

A **Etapa 1** do plano de evolução do WMS Casa Meta está **CONCLUÍDA**:

- ✅ Estrutura completa do banco de dados Supabase (13 tabelas)
- ✅ Motor de estoque transacional (funções SQL)
- ✅ Camada de serviços TypeScript (products, locations, movements, stock)
- ✅ Dados de exemplo (10 produtos, 30 localizações, saldos iniciais)
- ✅ Documentação completa

## 📋 Próximos Passos (Para Você Executar)

### 1. Criar Projeto no Supabase (5 minutos)

1. Acesse https://supabase.com/
2. Faça login ou crie conta gratuita
3. Clique em **"New Project"**
4. Preencha:
   - Name: `wms-casa-meta-dev`
   - Database Password: (crie e ANOTE esta senha)
   - Region: South America (São Paulo)
5. Aguarde ~2 minutos

### 2. Configurar Variáveis de Ambiente (2 minutos)

1. No Supabase, vá em **Settings** → **API**
2. Copie:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...`
3. No projeto, copie `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```
4. Edite `.env` e cole os valores copiados

### 3. Executar Migrations (10 minutos)

No Supabase, vá em **SQL Editor** → **New query** e execute na ordem:

1. Cole o conteúdo de `supabase/migrations/001_initial_schema.sql` → **Run**
2. Cole o conteúdo de `supabase/migrations/002_stock_engine.sql` → **Run**
3. Cole o conteúdo de `supabase/migrations/003_seed_data.sql` → **Run**

### 4. Verificar Dados (2 minutos)

No Supabase, vá em **Table Editor** e confirme:
- ✅ Tabela `products` tem 10 registros
- ✅ Tabela `locations` tem 30 registros
- ✅ Tabela `stock_balances` tem registros

### 5. Testar o App (1 minuto)

```bash
npm run dev
```

Acesse http://localhost:3000 - O app continua funcionando normalmente!

## 📚 Documentação Disponível

- **SETUP_GUIDE.md** - Guia completo de configuração
- **ETAPA1_CONCLUIDA.md** - Detalhes técnicos da implementação
- **README.md** - Visão geral do projeto

## 🎯 O que Vem na Etapa 2?

Na próxima sessão de desenvolvimento, vamos:

1. **Criar hooks React** para usar os serviços
   ```typescript
   useProducts() - Carregar produtos do Supabase
   useLocations() - Carregar localizações
   useStock() - Consultar saldos
   ```

2. **Migrar Inventory.tsx** para usar dados reais
   - Substituir `data.ts` por consultas ao Supabase
   - Implementar CRUD completo
   - Adicionar loading states e tratamento de erros

3. **Migrar Locations.tsx** para usar dados reais
   - Mapa baseado em localizações reais
   - Cálculo de ocupação dinâmico

4. **Implementar autenticação**
   - Login/logout
   - Proteção de rotas
   - Perfis de usuário

## 🔍 Testar Funções SQL

Para testar o motor de estoque, execute no **SQL Editor** do Supabase:

```sql
-- Ver estoque total de um produto
SELECT get_product_total_stock(
  (SELECT id FROM products WHERE sku = 'SKU-001')
);

-- Ver estoque por localização
SELECT * FROM get_product_stock_by_location(
  (SELECT id FROM products WHERE sku = 'SKU-002')
);

-- Ver ocupação de um endereço
SELECT * FROM get_location_occupancy(
  (SELECT id FROM locations WHERE code = 'A-01-01-01')
);

-- Buscar produto por código de barras
SELECT * FROM find_product_by_barcode('7890000000001');
```

## ⚠️ Importante

- **NÃO** commite o arquivo `.env` no Git
- **NÃO** use a chave `service_role` no frontend
- O frontend continua funcionando com dados de demonstração até a Etapa 2
- Todas as migrations são idempotentes (podem ser executadas múltiplas vezes)

## 🆘 Problemas?

### Erro: "Missing Supabase environment variables"
- Verifique se o arquivo `.env` existe e está preenchido
- Reinicie o servidor (`Ctrl+C` e `npm run dev`)

### Erro: "relation does not exist"
- Execute as migrations no SQL Editor do Supabase

### App não abre
- Verifique se o servidor está rodando (`npm run dev`)
- Acesse http://localhost:3000

## 📞 Suporte

- Consulte `SETUP_GUIDE.md` para instruções detalhadas
- Verifique `ETAPA1_CONCLUIDA.md` para detalhes técnicos
- Documentação do Supabase: https://supabase.com/docs

---

**Status**: ✅ Etapa 1 concluída e pronta para testes!

**Próximo passo**: Configurar Supabase e executar migrations conforme instruções acima.
