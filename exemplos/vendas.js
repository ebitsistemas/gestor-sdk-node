// Exemplo: node exemplos/vendas.js <cliente_id> <produto_id> <forma_pagamento_id> (com GESTOR_TOKEN no ambiente).
// Grava uma venda de verdade.
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });
const [clienteId, produtoId, formaId] = process.argv.slice(2).map(Number);
const hoje = new Date().toISOString().slice(0, 10);

try {
    const venda = await cliente.vendas.cadastrar({
        cliente_id: clienteId,
        data_venda: hoje,
        itens: [
            { produto_id: produtoId, quantidade: 2, valor_unitario: 30 },
        ],
        pagamentos: [{
            grupo: 'pix',
            forma_pagamento_id: formaId,
            indicador_pagamento: 0, // à vista
            parcela_numero: 1,
            parcela_total: 1,
            vencimento: hoje,
            valor_base_total: 60,
            valor: 60,
        }],
    });
    console.log(`Venda #${venda.id}: R$ ${venda.total_venda}, ${venda.status.nome}`);

    // Trocar o status (os permitidos estão em (await cliente.vendas.opcoes()).status[...].destinos).
    // await cliente.vendas.acao('status', venda.id, { status_id: 3 });

    for (const item of await cliente.vendas.listar({ data_de: `${hoje.slice(0, 8)}01`, data_ate: hoje })) {
        console.log(`#${item.id} ${item.data_venda} ${item.cliente.nome} R$ ${item.total_venda}`);
    }
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
