# SDK Node.js do Gestor Integrado

Cliente da API do Gestor Integrado para Node.js 18+ (ESM, com tipos TypeScript): cadastros, vendas, compras, ordens de
serviço, financeiro, estoque e notas fiscais. Sem dependências (usa o `fetch` do Node).

Referência completa da API (campos de cada recurso, exemplos e respostas): **https://gestorintegrado.com/desenvolvedores**

## Instalação

```bash
npm install @ebitsistemas/gestor-sdk
```

Ou instale direto desta pasta (`npm install ../Gestor.SdkNode`) ou do repositório.

## Primeiros passos

1. No sistema, crie um token em **Configurações › Integrações › API do sistema** (só leitura ou leitura e escrita).
   Ele aparece uma vez só: guarde como uma senha. O token age como o usuário que o criou.
2. O endereço da API é o mesmo para todas as empresas (`https://hubintegrado.com`, o padrão do SDK): o token já diz de
   qual empresa é.

```js
import { Cliente } from '@ebitsistemas/gestor-sdk';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });

console.log((await cliente.eu()).nome); // o usuário dono do token

// Uma página (busca, pagina, por_pagina 10/25/50/100, ordem, direcao e os filtros do recurso)
const pagina = await cliente.produtos.listar({ busca: 'arroz', por_pagina: 25 });
for (const produto of pagina) console.log(produto.nome);
console.log(pagina.total);

// Todos os registros, página por página, sob demanda
for await (const parceiro of cliente.parceiros.todos({ busca: 'silva' })) { /* ... */ }

// Consultar, cadastrar, atualizar e remover
const venda = await cliente.vendas.consultar(15);
const unidade = await cliente.unidades.cadastrar({ sigla: 'CX', nome: 'Caixa' });
await cliente.unidades.atualizar(unidade.id, { sigla: 'CX', nome: 'Caixa com 12' });
await cliente.unidades.remover(unidade.id);

// Ações próprias do recurso: {recurso}/{id}/{acao}
await cliente.vendas.acao('status', 15, { status_id: 3 });
await cliente.vendas.acao('notafiscal', 15);

// Recurso com hífen: camelCase (ordens-servico) ou pelo nome
await cliente.ordensServico.listar();
await cliente.recurso('ordens-servico').listar();

// Qualquer endpoint (caminho sem /api/v1)
const painel = await cliente.get('dashboard');

// Arquivos (XML e PDF da nota, carta de correção): o conteúdo cru num Buffer
// import { writeFile } from 'node:fs/promises';
await writeFile('danfe.pdf', await cliente.baixar('notas-fiscais/nfe/10/pdf', { formato: 'danfe' }));
```

## Exemplos

Em [`exemplos/`](exemplos), com `GESTOR_TOKEN` no ambiente (`node exemplos/<arquivo>.js`):

| Arquivo | O que faz |
|---|---|
| [`parceiros.js`](exemplos/parceiros.js) | Cadastra, atualiza, lista e remove um cliente |
| [`produtos.js`](exemplos/produtos.js) | Cadastra, dá entrada no estoque, atualiza, lista e remove |
| [`servicos.js`](exemplos/servicos.js) | Cadastra, atualiza, lista e remove |
| [`vendas.js`](exemplos/vendas.js) | Cadastra uma venda e lista as do mês |
| [`financeiro.js`](exemplos/financeiro.js) | Lança uma conta a pagar, dá baixa, lista contas a receber e o calendário |
| [`nfe.js`](exemplos/nfe.js) | Emite a NF-e de uma venda, espera a SEFAZ e baixa o XML e o DANFE |
| [`listar-produtos.js`](exemplos/listar-produtos.js) | O mais curto: percorrer todos os produtos ativos |

## Erros

Toda resposta de erro vira um erro com a mensagem em português, pronta para mostrar:

| Classe | Status | Quando |
|---|---|---|
| `NaoAutenticado` | 401 | Token inválido, vencido ou revogado |
| `SemPermissao` | 403 | Sem permissão, token só de leitura gravando ou licença suspensa |
| `NaoEncontrado` | 404 | Registro não encontrado |
| `RegraDeNegocio` | 409 | A regra do negócio não deixou (ex.: remover algo em uso) |
| `Validacao` | 422 | Campos recusados: `erro.erros` traz campo => mensagens |
| `LimiteDeChamadas` | 429 | Muitas chamadas: `erro.esperarSegundos` |
| `ErroDeConexao` | — | Não chegou resposta (rede, DNS, tempo esgotado) |

Todos estendem `ErroDaApi` (`status`, `erros`, `resposta`).

```js
import { Validacao } from '@ebitsistemas/gestor-sdk';

try {
    await cliente.unidades.cadastrar({ nome: 'Caixa' });
} catch (erro) {
    if (erro instanceof Validacao) console.log(erro.erros); // { sigla: ['O campo sigla é obrigatório.'] }
    else throw erro;
}
```

## Limites e novas tentativas

A API aceita até 120 chamadas por minuto por usuário. Ao receber 429, o SDK espera o `Retry-After` e tenta de novo
(até 3 tentativas). Falha de rede só é repetida em consultas (GET), que não gravam nada.

```js
const cliente = new Cliente({ token, tempoLimite: 30, tentativas: 3 });
```

Para usar outro cliente HTTP (ou nos testes), passe `fetch: meuFetch`.

## Recursos

O catálogo completo, com método e caminho de cada endpoint, está em [`recursos/endpoints.json`](recursos/endpoints.json).

| Recurso | Propriedade | Básico | Ações próprias (`acao(...)`) |
|---|---|---|---|
| Parceiros (clientes e fornecedores) | `parceiros` | listar, consultar, cadastrar, atualizar, remover, opcoes | `opcoes/{lista}` GET, `historico` (com id) GET |
| Produtos e estoque | `produtos` | listar, consultar, cadastrar, atualizar, remover, opcoes | `opcoes/{lista}` GET, `insumos` GET, `estoque` (com id) POST, `historico` (com id) GET, `historico-precos` (com id) GET, `limite-extra` (com id) POST |
| Serviços | `servicos` | listar, consultar, cadastrar, atualizar, remover, opcoes | `historico` (com id) GET, `historico-precos` (com id) GET |
| Categorias | `categorias` | listar, consultar, cadastrar, atualizar, remover, opcoes | `mover` (com id) POST |
| Grupos | `grupos` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Unidades | `unidades` | listar, consultar, cadastrar, atualizar, remover | — |
| Variações | `variacoes` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Grupos de impressão | `gruposImpressao` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Vendas | `vendas` | listar, consultar, cadastrar, atualizar, opcoes | `opcoes/{lista}` GET, `kanban` GET, `frete` POST, `calcular` POST, `aprovar` (com id) POST, `status` (com id) POST, `comprovante-entrega` (com id) GET, `cupom` (com id) GET e mais 3 |
| Compras | `compras` | listar, consultar, cadastrar, atualizar, opcoes | `opcoes/{lista}` GET, `kanban` GET, `calcular` POST, `aprovar` (com id) POST, `status` (com id) POST, `impressao` (com id) GET, `notafiscal` (com id) POST, `email` (com id) GET/POST |
| Ordens de serviço | `ordensServico` | listar, consultar, cadastrar, atualizar, opcoes | `opcoes/{lista}` GET, `kanban` GET, `equipamentos` GET, `agenda` GET, `indicadores` GET, `calcular` POST, `aprovar` (com id) POST, `nota-produto` (com id) GET/POST e mais 6 |
| Descontos | `descontos` | listar, consultar, cadastrar, atualizar, remover, opcoes | `opcoes/{lista}` GET |
| Financeiro: faturamentos e parcelas | `faturamentos` | listar, consultar, cadastrar, atualizar, opcoes | `impressao` (com id) GET, `opcoes/{lista}` GET, `kanban` GET, `status` (com id) POST, `pagamentos/{pagamento}/baixas/{baixa}/estorno` (com id) POST, `email/{modelo}` (com id) GET/POST |
| Boletos e PIX | `boletos` | listar, opcoes | `pendentes` GET, `enviar` POST, `nao-enviar` POST, `reabrir` (com id) POST, `cancelar` (com id) POST, `consultar` (com id) POST |
| Contas bancárias | `contasBancarias` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Caixas | `caixas` | listar, consultar, cadastrar, atualizar, remover | — |
| Fechamentos de caixa | `fechamentosCaixa` | listar, consultar, opcoes | `fechar` (com id) POST |
| Calendário financeiro | `calendario` | listar | — |
| Indicadores financeiros | `indicadores` | — | `financeiro` GET |
| Notas fiscais (NF-e, NFC-e e NFS-e) | `notasFiscais` | listar, consultar | `{nota}/transmitir` (com id) POST, `{nota}/consultar` (com id) POST, `{nota}/cancelar` (com id) POST, `{nota}/corrigir` (com id) POST, `{nota}/xml` (com id) GET, `{nota}/pdf` (com id) GET, `{nota}/cce/{evento}` (com id) GET, `nfse/{nota}/email` GET/POST e mais 6 |
| Notas recebidas | `notasRecebidas` | listar, consultar, opcoes | `importar` POST, `buscar-nfse` POST, `manifestar` (com id) POST, `itens/{item}/relacionar` (com id) POST, `compra` (com id) GET, `devolucao` (com id) GET, `xml` (com id) GET, `pdf` (com id) GET |
| Tributações | `tributacoes` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Operações fiscais | `operacoes` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Classificações fiscais | `classificacoes` | listar, consultar, atualizar, opcoes | `status` (com id) POST |
| Relatórios | `relatorios` | listar | `filtros` (com id) GET, `gerar` (com id) GET |
| Dashboard | `dashboard` | — | `dashboard` GET |
| Comanda | `comanda` | listar, consultar, cadastrar, atualizar, remover | `inicio` GET, `produtos/{produto}/imagem` GET, `clientes` GET, `vendas/{venda}/cobranca` GET/POST, `vendas/{venda}/cobranca/{parcela}/confirmar` POST, `vendas/{venda}/cobranca/cancelar-venda` POST, `vendas/ultima` GET, `vendas/{venda}/cupom` GET e mais 20 |
| PDV (frente de caixa) | `pdv` | listar, consultar, cadastrar | `inicio` GET, `produtos` GET, `produtos/codigo/{codigo}` GET, `clientes` GET, `vendas/{venda}/cobranca` GET/POST, `vendas/{venda}/cobranca/{parcela}/confirmar` POST, `vendas/{venda}/cobranca/cancelar-venda` POST, `vendas/salvar` POST e mais 10 |
| App do entregador | `entregador` | — | `entregas` GET, `posicao` POST, `entregas/{codigo}/posicao` POST, `entregas/{codigo}/{acao}` POST, `relatorio` GET, `rota/previa` POST, `rota/iniciar` POST |
| Autoatendimento (totem) | `autoatendimento` | consultar, cadastrar | `inicio` GET, `produtos/{produto}/imagem` GET, `pedidos/{venda}/cupom` GET, `pedidos/{venda}/cobranca` DELETE/GET/POST |
| Configurações | `configuracoes` | consultar, cadastrar, atualizar, remover | `notafiscal/emitente` POST, `notafiscal/backup` GET, `notafiscal/certificado` GET, `comanda/impressao` GET, `cardapio/geral` GET, `cardapio/layout` GET, `cardapio/layout/imagem` GET, `cardapio/horarios` GET e mais 4 |
| Usuários | `usuarios` | listar, consultar, cadastrar, atualizar, remover | — |
| Cargos | `cargos` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Status | `status` | listar, consultar, cadastrar, atualizar, remover, opcoes | — |
| Formas de pagamento | `formasPagamento` | listar, consultar, cadastrar, atualizar, remover | — |
| Empresa | `empresa` | consultar, atualizar | `resumo` GET, `logo` GET |
| Integrações | `integracoes` | listar, consultar, atualizar | `situacao` GET, `frete/{provedor}` GET, `tray` DELETE/GET, `tray/conectar` POST, `tray/produtos` GET/POST, `tray/sincronizar` POST, `tray/pedidos` GET/PUT, `tray/pedidos/conferir` POST e mais 12 |
| Anexos | `anexos` | listar, cadastrar, remover | `principal` (com id) PUT, `arquivo` (com id) GET |
| Auditoria | `auditoria` | listar, consultar, opcoes | — |
| Notificações | `notificacoes` | listar | `resumo` GET, `lidas` POST, `lida` (com id) POST |
| Consultas (CEP e CNPJ) | `consultas` | — | `cep/{cep}` GET, `cnpj/{cnpj}` GET |
| Ferramentas | `ferramentas` | — | `balanca` GET, `balanca/arquivo/{modelo}` GET, `etiquetas/produtos` GET |
| Ajuda | `ajuda` | — | `faq` GET, `perguntas` GET, `iris` POST |
| Usuário do token | `eu` | — | `eu` GET |
| Menu e permissões | `menu` | — | `menu` GET, `acessos` POST, `permissoes` GET |
| Cupons de desconto | `cupons` | listar, consultar, cadastrar, atualizar, remover | — |
| Contratos | `contratos` | listar, consultar, cadastrar, atualizar, remover, opcoes | `opcoes/{lista}` GET, `status` (com id) POST, `documento` (com id) GET, `assinatura` (com id) POST |
| Modelos de contrato | `contratosModelos` | listar, consultar, cadastrar, atualizar, remover | `gerar-com-ia` POST, `arquivo` (com id) GET |
| Assinaturas (contratos) | `assinaturas` | cadastrar, remover | `imagem` (com id) GET |
| Equipamentos (ordens de serviço) | `equipamentos` | listar, consultar, cadastrar, atualizar, remover, opcoes | `opcoes/{lista}` GET, `historico` (com id) GET |
| Pagamentos (recibos por e-mail) | `pagamentos` | — | `{modelo}/email` (com id) GET/POST |
| WhatsApp | `whatsapp` | — | `{id}` (com id) GET/POST |
| Íris (assistente) | `iris` | — | `mensagem` POST, `voz` GET/POST |
| Documentos legais | `documentosLegais` | — | `pdf` (com id) GET |
| Primeiro acesso | `primeiroAcesso` | consultar | `aceitar` POST, `configurar` POST |
## Testes

```bash
npm test
```

## Licença

MIT: veja [LICENSE](LICENSE).
