// Exemplo: node exemplos/parceiros.js (com GESTOR_TOKEN no ambiente).
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });

try {
    const dados = {
        status: 'ativo',
        origem: 'nacional',
        tipo_pessoa: 'fisica',
        tipos: ['cliente'],
        nome_completo: 'Maria da Silva',
        cpf: '529.982.247-25',
        indicacao_inscricao_estadual: '9', // não contribuinte
        enderecos: [{ cep: '01310100', logradouro: 'Avenida Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', codigo_ibge: '3550308' }],
        contatos: [{ email: 'maria@exemplo.com.br', celular: '(11) 98888-7777' }],
    };

    const parceiro = await cliente.parceiros.cadastrar(dados);
    console.log(`Cadastrado: #${parceiro.id} ${parceiro.nome}`);

    // O PUT recebe o cadastro inteiro.
    await cliente.parceiros.atualizar(parceiro.id, { ...dados, tipos: ['cliente', 'fornecedor'] });

    for (const item of await cliente.parceiros.listar({ tipo: 'cliente', busca: 'silva' })) {
        console.log(`#${item.id} ${item.nome} ${item.documento}`);
    }

    await cliente.parceiros.remover(parceiro.id);
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
