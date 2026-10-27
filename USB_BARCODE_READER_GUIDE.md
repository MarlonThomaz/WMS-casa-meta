# Leitor de código de barras USB genérico

O WMS Casa Meta suporta leitores USB comuns que funcionam em modo **HID Keyboard / Keyboard Wedge**. Esse é o comportamento da maioria dos leitores laser genéricos: ao ler um código, o aparelho envia os caracteres como se fossem digitados em um teclado.

## Configuração recomendada do leitor

No manual do leitor, configure:

- Interface: **USB HID Keyboard** / **USB Keyboard**
- Sufixo após leitura: **Enter / CR** (recomendado)
- `Tab` também é aceito pelo WMS
- Prefixo: nenhum
- Layout de teclado: compatível com o computador (normalmente US ou ABNT2; códigos numéricos não são afetados)

Em muitos leitores essas opções são configuradas simplesmente escaneando códigos especiais impressos no próprio manual.

## Como testar no WMS

1. Conecte o leitor USB ao notebook.
2. Aguarde o sistema operacional reconhecê-lo como teclado.
3. Abra **Código de barras** no WMS.
4. Clique em **Escanear código**.
5. O painel deve mostrar **Leitor USB HID ativo**.
6. Leia uma etiqueta.
7. O código deve aparecer como `Último:` e seguir automaticamente para o fluxo selecionado (cadastrar, transferir ou localizar).

Não é necessário instalar driver ou software do fabricante quando o aparelho opera como USB HID.

## Como o WMS diferencia o leitor de uma pessoa digitando

O leitor normalmente envia todos os caracteres em poucos milissegundos. O WMS mantém um buffer temporário e considera uma leitura USB quando:

- há pelo menos 4 caracteres;
- os caracteres chegam rapidamente (intervalo médio de até 80 ms);
- a leitura termina com `Enter` ou `Tab`.

O buffer é descartado automaticamente após 180 ms de inatividade.

Esses limites evitam que digitação humana comum seja interpretada como leitura do scanner.

## Teste fora do WMS

Se houver dúvida sobre o leitor:

1. abra o Bloco de Notas;
2. clique numa linha vazia;
3. leia uma etiqueta.

Se aparecer algo como:

```text
7891234567890
```

e o cursor pular automaticamente para a linha seguinte, o leitor já está no modo ideal para o WMS.

## Leitores sem Enter no final

Se o leitor apenas digitar o código e não finalizar a leitura, configure **Enter/CR suffix** no manual do aparelho. O WMS também aceita `Tab`, mas `Enter` é o padrão recomendado.

## Compatibilidade

O modo USB HID funciona no navegador e no aplicativo web sem WebUSB e sem permissões especiais. Para o WMS, o aparelho é tratado como um teclado rápido, o que mantém compatibilidade com leitores genéricos de diferentes fabricantes.

O scanner por câmera, upload de imagem e entrada manual continuam disponíveis em paralelo.
