# WMS Casa Meta

Sistema web de gerenciamento de armazém para a operação da Casa Meta, desenvolvido com React, TypeScript, Vite, Supabase e PostgreSQL.

## Estado do projeto

O projeto está em **estabilização para piloto web controlado**. O núcleo transacional já cobre os fluxos principais do MVP, mas a versão ainda deve ser homologada em um projeto Supabase de teste real antes de qualquer uso em produção.

A branch de estabilização é `wms-stabilization-round8` e o trabalho entra na `main` somente por pull request após CI e homologação.

## Escopo atual

A versão web cobre:

- autenticação com Supabase Auth;
- papéis `admin`, `manager`, `operator` e `viewer`;
- administração de perfis e ativação de usuários;
- produtos e códigos de barras;
- endereçamento/localizações;
- saldo e reserva de estoque;
- recebimento parcial e idempotente;
- expedição, reserva, picking parcial, packing e shipping;
- entradas, saídas, transferências e ajustes manuais;
- contagem física com snapshot e reconciliação;
- auditoria de operações e catálogo;
- scanner por câmera, arquivo, entrada manual e leitor USB HID;
- dashboard operacional e dashboard do piloto.

## Fora do critério de pronto desta fase

PWA instalável, Electron/Windows, Capacitor/Android, iOS, operação offline e sincronização offline ficam para uma etapa posterior ao piloto web.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Supabase Auth
- PostgreSQL / Supabase
- Row Level Security (RLS)
- GitHub Actions

## Desenvolvimento local

Recomendado: Node.js 22.

```bash
npm ci
cp .env.example .env
npm run dev
```

Para backend real de homologação:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
VITE_ENABLE_DEMO=false
```

Para demonstração isolada, sem credenciais e sem persistência real:

```env
VITE_ENABLE_DEMO=true
```

Nunca coloque `service_role`, secret key ou qualquer chave privilegiada em variável `VITE_*`.

## Checks locais

```bash
npm run typecheck
npm run build
```

## Banco de dados

As migrations ficam em `supabase/migrations` e são aplicadas em ordem numérica. A cadeia atual inclui a migration `017_pilot_inventory_integrity.sql`, que reforça integridade de reservas, estoque disponível, picking parcial e reconciliação de contagem.

A CI aplica todas as migrations do zero em PostgreSQL isolado e executa regressões de:

- recebimento parcial e retry idempotente;
- autorização e RLS;
- picking parcial e linha separada com quantidade zero;
- cancelamento e liberação de reservas;
- proteção contra consumo de estoque reservado;
- preservação de movimentos posteriores à contagem física;
- cadastro atômico de produto + código de barras + estoque inicial.

A CI não reproduz integralmente Supabase Auth/PostgREST. Por isso, **CI verde não substitui homologação em Supabase real**.

## Regras de arquitetura

### Autoridade no banco

O navegador não é fonte confiável para autoria, saldo, reservas ou eventos de auditoria. Operações críticas passam por RPCs/triggers e o banco deriva o usuário a partir da sessão autenticada.

### Estoque

`stock_balances` não deve ser alterado diretamente pelo cliente. Saídas, transferências e ajustes negativos usam estoque **disponível**, sem consumir quantidade reservada para expedições.

### Recebimento

`processed_quantity` é interno ao banco. Reprocessar um recebimento parcial não duplica saldo: somente o delta ainda não contabilizado é aplicado.

### Expedição

Ao iniciar picking, a quantidade solicitada é reservada. Ao confirmar o picking, a quantidade realmente separada vira saída física e toda reserva não utilizada é liberada, inclusive linhas com `picked_quantity = 0`.

### Contagem

A contagem possui snapshot do sistema e instante físico de contagem. Na conclusão, movimentos legítimos posteriores ao instante contado são preservados; a reconciliação não deve apagar operações que ocorreram depois da contagem física.

### RLS e papéis

- `admin`: operação completa, usuários e auditoria;
- `manager`: operação completa, endereços e auditoria;
- `operator`: fluxos operacionais permitidos;
- `viewer`: somente leitura.

Uma conta criada no Supabase Auth nasce como `viewer` e `active = false`. O admin ativa e define o papel pela tela **Usuários**.

### Auditoria

Eventos autoritativos são gravados por funções e triggers do banco. O navegador consulta a auditoria, mas não pode fabricar eventos diretamente.

## Antes do piloto físico

Obrigatório homologar num projeto Supabase descartável/de teste:

1. login real com admin, manager, operator e viewer;
2. ativação e troca de papéis pela tela Usuários;
3. recebimento parcial, retry e conclusão;
4. reserva, picking completo/parcial/zero, cancelamento e despacho;
5. movimentações manuais e conflito com estoque reservado;
6. contagem com movimentação posterior ao instante físico;
7. auditoria;
8. scanner USB físico;
9. câmera em Android via HTTPS;
10. backup, restauração e rollback.

Use `PILOT_RUNBOOK.md` como checklist de homologação.

## Instalação e distribuição

Para o piloto, utilize o aplicativo **web** em navegador moderno. Consulte `INSTALL_GUIDE.md`.

PWA/APK/EXE não são entregáveis desta etapa e não devem ser apresentados como prontos.
