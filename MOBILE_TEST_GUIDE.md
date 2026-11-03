# Piloto mobile — Round8

A interface continua web: não exige APK, instalação nem alterações no banco.
Use o mesmo projeto Supabase nos dispositivos para comparar os dados reais.

## Computador e celular na mesma rede

```bash
git fetch origin
git switch mobile-browser-round8
npm ci
npm run dev:mobile
```

No celular, abra o endereço Network exibido pelo Vite (por exemplo,
`http://192.168.1.10:3000`). Use o IPv4 do computador, não `localhost`.
O computador precisa permanecer ligado e os aparelhos precisam estar na mesma
rede, sem isolamento entre clientes Wi-Fi. Se necessário, permita Node.js apenas
na rede privada pelo firewall do Windows; não desative o firewall.

O comando usa `.env.homologation`, com o Supabase do piloto e demo desativada.
Credenciais locais podem ser substituídas em `.env.homologation.local` (ignorado pelo Git).

## Câmera

Câmera ao vivo requer HTTPS (ou localhost no próprio computador).
Por HTTP no IP da rede, use entrada manual, leitor HID ou envio de imagem.
Não é necessário mudar permissões ou políticas do Supabase para usar celular.
A disponibilidade de câmera e reconhecimento deve ser validada em aparelho real.

## Acesso HTTPS do piloto

https://wms-casa-meta-mobile-piloto.marlonpl-98.chatgpt.site

A publicação Sites é privada: o proprietário precisa entrar na sua conta ChatGPT
em cada navegador, e depois entrar com a conta desejada do WMS. Para testes com
outras pessoas sem a conta do proprietário, utilize a rede local ou uma hospedagem
com acesso apropriado; não compartilhe a senha do ChatGPT.
A versão publicada usa o Supabase real do piloto, não a demo em memória.

## Teste simultâneo

1. Computador: admin. Celular: operator. Outro navegador/perfil: viewer.
   Abas do mesmo perfil de navegador compartilham a sessão; use dispositivos,
   perfis de navegador ou navegadores distintos para contas independentes.
2. Confira identidade e papel de cada sessão (menu ou cabeçalho mobile).
3. Crie uma ordem de teste em um dispositivo e atualize/reabra a lista no outro.
   Este pacote não adiciona sincronização Realtime; não espere atualização automática.
4. Registre recebimento parcial e confirme saldo/histórico nos dois dispositivos.
5. Tente repetir o processamento da mesma ordem: não deve duplicar saldo.
6. Com operator, faça separação/contagem; com viewer, verifique leitura sem mutações.
7. Teste duas saídas disputando o mesmo saldo em registros de teste e confira que
   o banco impede consumo acima do disponível.
8. Troque de tela após abrir câmera, volte e teste iniciar/parar novamente.
9. Recarregue cada navegador e confira sessão/perfil. Teste logout e novo login.
10. Use registros identificados como teste: as operações atingem o banco real.

## Verificação desta entrega

TypeScript e build de homologação; inspeção de navegação e cartões em viewport
estreito por iframe com dados de demonstração. Isso não certifica câmera física,
autenticação simultânea, concorrência ou experiência completa de Safari/iOS.
Nenhuma migration ou política de acesso foi alterada nesta entrega.
