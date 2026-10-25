// Exemplo: node exemplos/produtos.js <unidade_id> (com GESTOR_TOKEN no ambiente).
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });

try {
    const dados = {
        nome: 'Café Torrado 500 g',
        unidade_id: Number(process.argv[2] ?? 1),
        preco_custo: 12.4,
        preco_venda: 19.9,
        controlar_estoque: true,
        emitir_nota: false,
    };

    const produto = await cliente.produtos.cadastrar(dados);
    console.log(`Cadastrado: #${produto.id} ${produto.nome}`);

    // Estoque: tipo 1 entrada, 2 saída, 3 saldo.
    const estoque = await cliente.produtos.acao('estoque', produto.id, { tipo: 1, quantidade: 40 });
    console.log(`Estoque: ${estoque.data.estoque_atual}`);

    // O PUT recebe o cadastro inteiro.
    await cliente.produtos.atualizar(produto.id, { ...dados, preco_venda: 21.5 });

    for (const item of await cliente.produtos.listar({ busca: 'café', ativo: 'true' })) {
        console.log(`#${item.id} ${item.nome} R$ ${item.preco_venda}`);
    }

    await cliente.produtos.remover(produto.id);
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
