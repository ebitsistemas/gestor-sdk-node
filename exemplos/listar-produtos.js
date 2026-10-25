// Exemplo: node exemplos/listar-produtos.js (com GESTOR_TOKEN no ambiente).
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });

try {
    console.log(`Conectado como ${(await cliente.eu()).nome}`);
    for await (const produto of cliente.produtos.todos({ ativo: true })) {
        const preco = Number(produto.preco_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        console.log(`${String(produto.id).padStart(6, '0')}  ${produto.nome.padEnd(40)}  ${preco}`);
    }
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
