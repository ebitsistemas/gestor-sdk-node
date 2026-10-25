// Testes do SDK com um fetch falso (sem rede): node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cliente, ErroDeConexao, LimiteDeChamadas, NaoEncontrado, SemPermissao, Validacao } from '../src/index.js';

const json = (status, corpo, cabecalhos = {}) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json', ...cabecalhos } });

/** Cliente com respostas programadas: devolve o cliente, as chamadas feitas e as esperas (sem esperar de verdade). */
function cliente(respostas) {
    const chamadas = [];
    const esperas = [];
    const fila = [...respostas];
    const c = new Cliente({
        endereco: 'https://api.exemplo.com/',
        token: 'token-de-teste',
        fetch: async (url, opcoes) => {
            chamadas.push({ url, ...opcoes });
            const proxima = fila.shift();
            if (!proxima) throw new Error(`Chamada sem resposta programada: ${opcoes.method} ${url}`);
            if (proxima instanceof Error) throw proxima;
            return proxima;
        },
        esperar: async (segundos) => { esperas.push(segundos); },
    });
    return { c, chamadas, esperas };
}

test('lista com filtros e manda o token', async () => {
    const { c, chamadas } = cliente([json(200, { data: [{ id: 1, nome: 'Arroz' }], meta: { pagina: 1, por_pagina: 25, total: 1 } })]);
    const pagina = await c.produtos.listar({ busca: 'arroz', ativo: true });
    assert.equal(pagina.itens[0].nome, 'Arroz');
    assert.equal(pagina.temProxima, false);
    assert.equal(chamadas[0].url, 'https://api.exemplo.com/api/v1/produtos?busca=arroz&ativo=1');
    assert.equal(chamadas[0].headers.Authorization, 'Bearer token-de-teste');
    assert.equal(chamadas[0].body, undefined);
});

test('todos percorre as páginas', async () => {
    const { c, chamadas } = cliente([
        json(200, { data: [{ id: 1 }, { id: 2 }], meta: { pagina: 1, por_pagina: 2, total: 3 } }),
        json(200, { data: [{ id: 3 }], meta: { pagina: 2, por_pagina: 2, total: 3 } }),
    ]);
    const ids = [];
    for await (const parceiro of c.parceiros.todos({}, 2)) ids.push(parceiro.id);
    assert.deepEqual(ids, [1, 2, 3]);
    assert.match(chamadas[1].url, /pagina=2/);
});

test('cadastro, ação e remoção com o recurso em camelCase', async () => {
    const { c, chamadas } = cliente([
        json(201, { data: { id: 9, codigo: '000009' }, mensagem: 'Ordem de serviço cadastrada.' }),
        json(200, { data: { id: 9 }, mensagem: 'Status atualizado.' }),
        json(200, { mensagem: 'Removida.' }),
    ]);
    assert.equal((await c.ordensServico.cadastrar({ cliente_id: 1, descricao: 'Ação' })).codigo, '000009');
    assert.match(chamadas[0].url, /\/api\/v1\/ordens-servico$/);
    assert.equal(chamadas[0].body, '{"cliente_id":1,"descricao":"Ação"}');
    assert.equal((await c.vendas.acao('status', 9, { status_id: 3 })).mensagem, 'Status atualizado.');
    assert.match(chamadas[1].url, /\/vendas\/9\/status$/);
    await c.unidades.remover(4);
    assert.equal(chamadas[2].method, 'DELETE');
});

test('erros pelo status', async () => {
    const { c } = cliente([
        json(422, { message: 'O campo nome é obrigatório.', errors: { nome: ['O campo nome é obrigatório.'] } }),
        json(404, { message: 'Registro não encontrado.' }),
        json(403, { message: 'Token só de leitura.' }),
    ]);
    await assert.rejects(c.unidades.cadastrar({}), (e) => e instanceof Validacao && e.status === 422 && e.erros.nome[0] === 'O campo nome é obrigatório.');
    await assert.rejects(c.vendas.consultar(999), (e) => e instanceof NaoEncontrado && e.message === 'Registro não encontrado.');
    await assert.rejects(c.produtos.cadastrar({ nome: 'X' }), SemPermissao);
});

test('limite de chamadas espera o Retry-After e tenta de novo', async () => {
    const { c, esperas } = cliente([json(429, { message: 'Muitas chamadas.' }, { 'Retry-After': '7' }), json(200, { data: { nome: 'Maria' } })]);
    assert.equal((await c.eu()).nome, 'Maria');
    assert.deepEqual(esperas, [7]);

    const outro = cliente(Array.from({ length: 3 }, () => json(429, { message: 'Muitas chamadas.' }, { 'Retry-After': '2' })));
    await assert.rejects(outro.c.eu(), (e) => e instanceof LimiteDeChamadas && e.esperarSegundos === 2);
});

test('falha de rede só repete consulta', async () => {
    const consulta = cliente([new TypeError('fetch failed'), json(200, { data: { id: 1 } })]);
    assert.deepEqual(await consulta.c.produtos.consultar(1), { id: 1 });

    const gravacao = cliente([new TypeError('fetch failed')]);
    await assert.rejects(gravacao.c.produtos.cadastrar({ nome: 'X' }), ErroDeConexao);
    assert.equal(gravacao.chamadas.length, 1);
});

test('endereço e token obrigatórios', () => {
    assert.throws(() => new Cliente({ endereco: 'hubintegrado.com', token: 'x' }), TypeError);
    assert.throws(() => new Cliente({ token: ' ' }), TypeError);
});

test('sem o endereço, vai para o central', async () => {
    const urls = [];
    const c = new Cliente({ token: 'empresa:1|abc', fetch: async (url) => { urls.push(url); return new Response('{"data":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }); } });
    await c.get('dashboard');
    assert.equal(urls[0], 'https://hubintegrado.com/api/v1/dashboard');
});

test('baixar devolve o arquivo cru e o erro vira exceção', async () => {
    const { c, chamadas } = cliente([
        new Response('%PDF-1.4 conteudo', { status: 200, headers: { 'Content-Type': 'application/pdf' } }),
        json(404, { message: 'Nota sem PDF.' }),
    ]);
    const arquivo = await c.baixar('notas-fiscais/nfe/10/pdf', { formato: 'danfe' });
    assert.ok(Buffer.isBuffer(arquivo));
    assert.equal(arquivo.toString(), '%PDF-1.4 conteudo');
    assert.equal(chamadas[0].url, 'https://api.exemplo.com/api/v1/notas-fiscais/nfe/10/pdf?formato=danfe');
    await assert.rejects(c.baixar('notas-fiscais/nfe/10/xml'), (e) => e instanceof NaoEncontrado && e.message === 'Nota sem PDF.');
});
