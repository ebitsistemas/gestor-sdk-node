// Exemplo: node exemplos/nfe.js <venda_id> (com GESTOR_TOKEN no ambiente).
// Emite a NF-e da venda na SEFAZ de verdade e grava o XML e o DANFE na pasta atual.
import { writeFile } from 'node:fs/promises';
import { setTimeout as esperar } from 'node:timers/promises';
import { Cliente, ErroDaApi } from '../src/index.js';

const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });
const notas = cliente.recurso('notas-fiscais/nfe'); // NFC-e: notas-fiscais/nfce

try {
    // A nota sai da venda gravada. Se a venda já tem nota, volta a mesma.
    let nota = (await cliente.vendas.acao('notafiscal', Number(process.argv[2] ?? 0))).data;

    // O retorno da SEFAZ é assíncrono: consulta até sair de "processando".
    while (nota.status === 'processando') {
        await esperar(3000);
        nota = await notas.consultar(nota.id);
    }
    console.log(`NF-e nº ${nota.numero}: ${nota.status} ${nota.mensagem_erro ?? ''}`);

    if (nota.status === 'autorizada') {
        await writeFile(`${nota.chave_acesso}.xml`, await cliente.baixar(`notas-fiscais/nfe/${nota.id}/xml`));
        await writeFile(`${nota.chave_acesso}.pdf`, await cliente.baixar(`notas-fiscais/nfe/${nota.id}/pdf`));
    }

    // Carta de correção e cancelamento (justificativa com 15 caracteres ou mais):
    // await notas.acao('corrigir', nota.id, { justificativa: 'Corrige o endereço de entrega' });
    // await notas.acao('cancelar', nota.id, { justificativa: 'Venda cancelada pelo cliente' });
} catch (erro) {
    if (!(erro instanceof ErroDaApi)) throw erro;
    console.error(`Erro ${erro.status}: ${erro.message}`);
    process.exitCode = 1;
}
