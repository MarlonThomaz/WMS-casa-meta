# 📦 WMS Casa Meta - Guia de Instalação Rápida

Bem-vindo ao **WMS Casa Meta** - Sistema de Gerenciamento de Armazém!

Este aplicativo pode ser instalado em **Windows**, **Android** e **iOS**.

---

## 🚀 Instalação Rápida

### Opção 1: PWA (Recomendado) ⭐
**Funciona em:** Windows, Android, iOS
**Tempo:** 1 minuto

#### Windows (Chrome/Edge)
1. Acesse: `https://seu-dominio.com`
2. Clique no ícone de instalação na barra de endereço
3. Clique em "Instalar"
4. Pronto! O app aparece no Menu Iniciar

#### Android (Chrome)
1. Acesse: `https://seu-dominio.com`
2. Toque no menu ⋮ → "Adicionar à tela inicial"
3. Toque em "Adicionar"
4. Pronto! O ícone aparece na tela inicial

#### iOS (Safari)
1. Acesse: `https://seu-dominio.com` (use Safari!)
2. Toque no botão Compartilhar ↗️
3. Toque em "Adicionar à Tela de Início"
4. Toque em "Adicionar"
5. Pronto! O ícone aparece na tela inicial

---

### Opção 2: Aplicativo Desktop Windows (.exe)
**Tempo:** 2 minutos

1. Baixe o arquivo `WMS-Casa-Meta-Setup.exe`
2. Execute o instalador
3. Siga as instruções na tela
4. Abra o app pelo Menu Iniciar ou atalho na área de trabalho

**Versão Portátil (sem instalação):**
1. Baixe `WMS-Casa-Meta-Portable.exe`
2. Execute diretamente (não precisa instalar)
3. Pode rodar de um pendrive!

---

### Opção 3: Aplicativo Android (APK)
**Tempo:** 2 minutos

1. Baixe o arquivo `WMS-Casa-Meta.apk`
2. Transfira para seu dispositivo Android
3. Toque no arquivo APK
4. Se necessário, habilite "Instalar de fontes desconhecidas"
5. Toque em "Instalar"
6. Pronto! O app aparece na tela inicial

---

### Opção 4: Aplicativo iOS (App Store)
**Tempo:** 1 minuto

1. Abra a App Store no seu iPhone/iPad
2. Pesquise por "WMS Casa Meta"
3. Toque em "Obter" ou no ícone de download
4. Pronto! O app aparece na tela inicial

*Nota: Requer conta de desenvolvedor Apple para publicar na App Store*

---

## 📋 Requisitos do Sistema

### PWA (Todos os dispositivos)
- Navegador moderno (Chrome, Edge, Safari, Firefox)
- Conexão com internet (para instalação inicial)
- HTTPS (obrigatório para PWA)

### Windows Desktop
- Windows 10 ou 11 (64-bit)
- 2 GB de RAM mínimo
- 200 MB de espaço em disco
- Resolução: 1024x768 ou superior

### Android
- Android 7.0 (API 24) ou superior
- 2 GB de RAM mínimo
- 200 MB de espaço em disco
- Câmera (para scanner de código de barras)

### iOS
- iOS 13.0 ou superior
- iPhone 6s ou superior / iPad Air 2 ou superior
- 200 MB de espaço em disco
- Câmera (para scanner de código de barras)

---

## 🔧 Configuração Inicial

### 1. Configurar Supabase

O WMS Casa Meta usa Supabase como banco de dados.

1. Crie uma conta em: https://supabase.com
2. Crie um novo projeto
3. Copie as credenciais:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...`

4. Crie um arquivo `.env` na raiz do projeto:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 2. Executar Migrations do Banco

No painel do Supabase, vá em SQL Editor e execute:

```sql
-- Executar os arquivos na ordem:
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_stock_engine.sql
-- 3. supabase/migrations/003_seed_data.sql
```

### 3. Criar Usuário Administrador

1. No Supabase, vá em Authentication → Users
2. Clique em "Add user" → "Create new user"
3. Preencha email e senha
4. Copie o User UID
5. Execute no SQL Editor:

```sql
INSERT INTO profiles (id, email, full_name, role)
VALUES (
  'COLE_O_UID_AQUI',
  'admin@casameta.com',
  'Administrador',
  'admin'
);
```

### 4. Fazer Login

1. Abra o aplicativo
2. Use o email e senha criados
3. Pronto! Você está logado.

---

## 📚 Funcionalidades Principais

### 📊 Dashboard
- Visão geral do armazém
- KPIs em tempo real
- Gráficos de movimentações
- Alertas de estoque baixo

### 📦 Inventário
- Gestão completa de produtos
- Busca e filtros avançados
- Controle de estoque mínimo/máximo
- Exportação para CSV

### 📍 Localizações
- Mapa visual do armazém
- Controle de zonas e corredores
- Indicadores de ocupação
- Gestão de endereços

### 📥 Recebimento
- Conferência de mercadorias
- Validação de quantidades
- Atualização automática de estoque
- Histórico de recebimentos

### 📤 Expedição
- Separação de pedidos (picking)
- Embalagem e despacho
- Reserva de estoque
- Rastreamento de status

### 📷 Código de Barras
- Scanner de câmera
- Upload de imagem
- Entrada manual
- Busca por código

### 📋 Contagem Física
- Contagens cíclicas
- Ajustes automáticos
- Cálculo de precisão
- Geração de relatórios

### 📈 Dashboard do Piloto
- Métricas de performance
- Precisão do inventário
- Checklist de validação
- Próximos passos

---

## 🆘 Solução de Problemas

### App não instala (PWA)
- **Problema:** Botão de instalação não aparece
- **Solução:** Verifique se está usando HTTPS e navegador compatível

### Scanner não funciona
- **Problema:** Câmera não abre
- **Solução:** Permita acesso à câmera no navegador/app

### App não carrega dados
- **Problema:** Tela em branco ou erro de conexão
- **Solução:** Verifique as credenciais do Supabase no arquivo `.env`

### App lento
- **Problema:** Performance ruim
- **Solução:** Limpe o cache do navegador/app e recarregue

### Erro de autenticação
- **Problema:** Não consegue fazer login
- **Solução:** Verifique se o usuário foi criado no Supabase

---

## 📞 Suporte

### Documentação Completa
- `INSTALL_GUIDE.md` - Guia detalhado de instalação
- `SETUP_GUIDE.md` - Configuração do Supabase
- `ETAPA*.md` - Documentação técnica de cada etapa

### Contato
- Email: suporte@casameta.com
- GitHub: https://github.com/seu-usuario/wms-casa-meta
- Documentação: https://wms-docs.casameta.com

### Comunidade
- Fórum: https://community.casameta.com
- Discord: https://discord.gg/casameta

---

## 🎉 Pronto para Usar!

Seu WMS Casa Meta está instalado e configurado.

**Próximos passos:**
1. Faça login com suas credenciais
2. Explore o Dashboard
3. Cadastre produtos e localizações
4. Realize a primeira contagem física
5. Consulte o manual do usuário (menu "Ajuda")

**Bom trabalho!** 🚀

---

## 📝 Notas de Versão

### Versão 1.0.0 (2024)
- ✅ Sistema completo de gerenciamento de armazém
- ✅ Suporte multiplataforma (Windows, Android, iOS)
- ✅ Scanner de código de barras
- ✅ Contagem física com ajustes automáticos
- ✅ Dashboard com KPIs em tempo real
- ✅ Exportação de relatórios
- ✅ Funcionamento offline (PWA)

---

**Desenvolvido com ❤️ para Casa Meta**
