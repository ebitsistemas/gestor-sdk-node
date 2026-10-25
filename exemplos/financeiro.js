// Exemplo: node exemplos/financeiro.js <forma_pagamento_id> (com GESTOR_TOKEN no ambiente).
// Grava uma conta a pagar de verdade e dá baixa nela.
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });
const formaId = Number(process.argv[2] ?? 0);
const data = (dias = 0) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

try {
    // natureza: entrada (a receber) ou saida (a pagar).
    let conta = await cliente.faturamentos.cadastrar({
        natureza: 'saida',
        nome: 'Aluguel',
        data_lancamento: data(),
        valor_total: 1500,
        pagamentos: [{
            grupo: 'aluguel',
            forma_pagamento_id: formaId,
            indicador_pagamento: 1, // a prazo
            parcela_numero: 1,
            parcela_total: 1,
            vencimento: data(30),
            valor_base_total: 1500,
            valor: 1500,
        }],
    });
    console.log(`Conta #${conta.id}: ${conta.status.nome}`);

    // Baixa (pagamento) da parcela: total ou parcial (com valor).
    const parcela = conta.pagamentos[0].id;
    conta = (await cliente.faturamentos.acao(`pagamentos/${parcela}/baixas`, conta.id, {
        tipo_baixa: 'total',
        data_baixa: data(),
        forma_pagamento_baixa_id: formaId,
    })).data;
    console.log(`Depois da baixa: ${conta.status.nome}`);

    // Contas a receber em aberto.
    for (const item of await cliente.faturamentos.listar({ natureza: 'entrada', status: 'aguardando-pagamento' })) {
        console.log(`#${item.id} ${item.nome} R$ ${item.valor_total}`);
    }

    // Vencimentos dos próximos 30 dias (a receber e a pagar).
    for (const item of await cliente.calendario.listar({ inicio: data(), fim: data(30) })) {
        console.log(`${item.data} ${item.natureza} ${item.descricao} R$ ${item.saldo}`);
    }
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
