// Exemplo: node exemplos/servicos.js (com GESTOR_TOKEN no ambiente).
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });

try {
    const dados = {
        nome: 'Higienização de ar-condicionado',
        preco_venda: 180,
        garantia: true,
        periodo_garantia: 90, // dias
        emitir_nota: false,   // com true, informe codigo_servico (LC 116) e aliquota_iss
    };

    const servico = await cliente.servicos.cadastrar(dados);
    console.log(`Cadastrado: #${servico.id} ${servico.nome}`);

    // O PUT recebe o cadastro inteiro.
    await cliente.servicos.atualizar(servico.id, { ...dados, preco_venda: 195 });

    for (const item of await cliente.servicos.listar({ ativo: 'true' })) {
        console.log(`#${item.id} ${item.nome} R$ ${item.preco_venda}`);
    }

    await cliente.servicos.remover(servico.id);
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
