// SDK da API do Gestor Integrado. Sem dependências: usa o fetch do Node 18+.
//
//   import { Cliente } from '@ebitsistemas/gestor-integrado-sdk';
//   const cliente = new Cliente({ token: process.env.GESTOR_TOKEN });
//   for await (const produto of cliente.produtos.todos({ busca: 'arroz' })) { ... }
//   const venda = await cliente.vendas.consultar(15);
//
// Cada recurso é uma propriedade com o nome do endereço em camelCase: ordens-servico vira cliente.ordensServico.
// Muitas chamadas (429): espera o Retry-After e tenta de novo, até "tentativas". Falha de rede só tenta de novo nas
// consultas (GET), que não gravam nada.
import { ErroDaApi, ErroDeConexao, LimiteDeChamadas } from './erros.js';

export * from './erros.js';

export const VERSAO = '1.0.1';

/** Endereço central da API, o mesmo para todas as empresas: o token já diz de qual empresa é. */
export const ENDERECO = 'https://hubintegrado.com';

const esperarPadrao = (segundos) => new Promise((resolve) => setTimeout(resolve, segundos * 1000));
const paraJson = (texto) => {
    if (!texto.trim()) return {};
    try { return JSON.parse(texto); } catch { return { message: 'Resposta da API fora do formato JSON.', corpo: texto.slice(0, 500) }; }
};
const paraKebab = (nome) => nome.replace(/(?<!^)[A-Z]/g, (letra) => `-${letra.toLowerCase()}`);

/** Uma página de uma listagem: os registros (itens) e a paginação (meta). Dá para percorrer com for...of. */
export class Pagina {
    constructor(itens, meta) {
        this.itens = itens;
        this.meta = meta;
    }

    get numero() { return Number(this.meta.pagina ?? this.meta.current_page ?? 1); }

    get porPagina() { return Number(this.meta.por_pagina ?? this.meta.per_page ?? this.itens.length); }

    get total() { return Number(this.meta.total ?? this.itens.length); }

    get temProxima() { return this.itens.length > 0 && this.numero * Math.max(1, this.porPagina) < this.total; }

    [Symbol.iterator]() { return this.itens[Symbol.iterator](); }
}

/**
 * Um recurso da API (vendas, produtos, parceiros...): listar, percorrer todas as páginas, consultar, cadastrar,
 * atualizar, remover, as opções do formulário e as ações próprias (ex.: status da venda, nota fiscal).
 * Os campos de cada recurso estão na referência: https://gestorintegrado.com/desenvolvedores
 */
export class Recurso {
    constructor(cliente, nome) {
        this.cliente = cliente;
        this.nome = nome;
    }

    /** Uma página. Filtros: busca, pagina, por_pagina (10, 25, 50 ou 100), ordem, direcao e os do recurso. */
    async listar(filtros = {}) {
        const resposta = await this.cliente.get(this.nome, filtros);
        return new Pagina(Array.isArray(resposta.data) ? resposta.data : [], resposta.meta || {});
    }

    /** Todos os registros, página por página, sob demanda: for await (const item of recurso.todos()). */
    async *todos(filtros = {}, porPagina = 100) {
        let numero = Number(filtros.pagina ?? 1);
        let pagina;
        do {
            pagina = await this.listar({ ...filtros, pagina: numero, por_pagina: porPagina });
            yield* pagina.itens;
            numero += 1;
        } while (pagina.temProxima);
    }

    /** O registro (data). */
    async consultar(id) {
        return (await this.cliente.get(`${this.nome}/${id}`)).data ?? {};
    }

    /** O registro gravado (data). */
    async cadastrar(dados) {
        return (await this.cliente.post(this.nome, dados)).data ?? {};
    }

    /** O registro gravado (data). */
    async atualizar(id, dados) {
        return (await this.cliente.put(`${this.nome}/${id}`, dados)).data ?? {};
    }

    /** A resposta (mensagem). */
    remover(id) {
        return this.cliente.delete(`${this.nome}/${id}`);
    }

    /** Listas que o formulário usa (status, formas de pagamento...). */
    async opcoes() {
        return (await this.cliente.get(`${this.nome}/opcoes`)).data ?? {};
    }

    /**
     * Ação própria do recurso: "{recurso}/{id}/{acao}" (ou "{recurso}/{acao}" sem id). GET manda os dados na consulta.
     * Ex.: cliente.vendas.acao('status', 15, { status_id: 3 }). Devolve a resposta inteira (data e mensagem).
     */
    acao(acao, id = null, dados = {}, metodo = 'POST') {
        const caminho = `${this.nome}${id === null || id === undefined ? '' : `/${id}`}/${String(acao).replace(/^\/+|\/+$/g, '')}`;
        return this.cliente.chamar(metodo.toUpperCase(), caminho, dados);
    }
}

/**
 * Cliente da API: o token criado em Configurações › Integrações › API do sistema (age como o usuário que o criou e já diz
 * de qual empresa é). Opções: endereco (outro endereço da API, padrão https://hubintegrado.com), tempoLimite (segundos por chamada, 30), tentativas (no 429 e na falha de rede em
 * consultas, 3), fetch (outro cliente HTTP) e esperar (como aguardar entre tentativas).
 */
export class Cliente {
    constructor({ endereco = ENDERECO, token, tempoLimite = 30, tentativas = 3, fetch: fetchProprio, esperar = esperarPadrao } = {}) {
        const base = String(endereco || '').trim().replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(base)) throw new TypeError(`Informe o endereço da API com http(s)://, ex.: ${ENDERECO}`);
        if (!String(token || '').trim()) throw new TypeError('Informe o token criado em Configurações › Integrações › API do sistema.');
        this.base = `${base.endsWith('/api/v1') ? base : `${base}/api/v1`}/`;
        this.token = token;
        this.tempoLimite = Math.max(1, tempoLimite);
        this.tentativas = Math.max(1, tentativas);
        this.fetch = fetchProprio || globalThis.fetch;
        this.esperar = esperar;
        this.recursos = new Map();
        if (typeof this.fetch !== 'function') throw new TypeError('Este Node não tem fetch: use o Node 18 ou mais novo, ou passe a opção fetch.');

        // cliente.ordensServico é o mesmo que cliente.recurso('ordens-servico').
        return new Proxy(this, {
            get: (alvo, propriedade, receptor) => (typeof propriedade === 'string' && !(propriedade in alvo) && !['then', 'toJSON'].includes(propriedade)
                ? alvo.recurso(paraKebab(propriedade))
                : Reflect.get(alvo, propriedade, receptor)),
        });
    }

    /** Recurso pelo endereço, ex.: recurso('ordens-servico'). */
    recurso(nome) {
        const chave = String(nome).replace(/^\/+|\/+$/g, '');
        if (!this.recursos.has(chave)) this.recursos.set(chave, new Recurso(this, chave));
        return this.recursos.get(chave);
    }

    /** O usuário dono do token (nome, e-mail, cargo). */
    async eu() {
        return (await this.get('eu')).data ?? {};
    }

    get(caminho, consulta = {}) { return this.chamar('GET', caminho, consulta); }

    post(caminho, dados = {}) { return this.chamar('POST', caminho, dados); }

    put(caminho, dados = {}) { return this.chamar('PUT', caminho, dados); }

    patch(caminho, dados = {}) { return this.chamar('PATCH', caminho, dados); }

    delete(caminho) { return this.chamar('DELETE', caminho); }

    /**
     * Qualquer endpoint da API (caminho sem /api/v1, ex.: "vendas/15/status"). GET leva os dados na consulta; os outros,
     * no corpo em JSON. Devolve a resposta (data, meta, mensagem...) ou lança um ErroDaApi.
     */
    async chamar(metodo, caminho, dados = {}) {
        return paraJson(await (await this.enviar(metodo, caminho, dados)).text());
    }

    /**
     * Um arquivo da API (XML e PDF da nota, carta de correção...): o conteúdo cru num Buffer, pronto para gravar.
     * Ex.: await writeFile('nota.pdf', await cliente.baixar('notas-fiscais/nfe/10/pdf')).
     */
    async baixar(caminho, consulta = {}) {
        return Buffer.from(await (await this.enviar('GET', caminho, consulta)).arrayBuffer());
    }

    /** A resposta 2xx do fetch; as outras viram ErroDaApi (com as novas tentativas no 429 e na falha de rede do GET). */
    async enviar(metodo, caminho, dados = {}) {
        metodo = metodo.toUpperCase();
        let url = this.base + String(caminho).replace(/^\/+/, '');
        const comDados = dados && Object.keys(dados).length > 0;
        if (metodo === 'GET' && comDados) {
            const consulta = new URLSearchParams();
            for (const [chave, valor] of Object.entries(dados)) {
                if (valor === undefined || valor === null) continue;
                consulta.append(chave, typeof valor === 'boolean' ? (valor ? '1' : '0') : String(valor));
            }
            url += (url.includes('?') ? '&' : '?') + consulta.toString();
        }
        const corpo = metodo === 'GET' || (metodo === 'DELETE' && !comDados) ? undefined : JSON.stringify(dados || {});
        const cabecalhos = { Authorization: `Bearer ${this.token}`, Accept: 'application/json', 'User-Agent': `gestor-integrado-sdk-node/${VERSAO}` };
        if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

        for (let tentativa = 1; ; tentativa += 1) {
            let resposta;
            try {
                resposta = await this.fetch(url, { method: metodo, headers: cabecalhos, body: corpo, signal: AbortSignal.timeout(this.tempoLimite * 1000) });
            } catch (falha) {
                if (metodo !== 'GET' || tentativa >= this.tentativas) {
                    throw new ErroDeConexao(`Não foi possível falar com a API: ${falha?.message || falha}`);
                }
                await this.esperar(tentativa);
                continue;
            }
            if (resposta.status >= 200 && resposta.status < 300) return resposta;

            const retryAfter = resposta.headers.get('retry-after');
            const erro = ErroDaApi.daResposta(resposta.status, paraJson(await resposta.text()), retryAfter !== null ? Number(retryAfter) : null);
            if (erro instanceof LimiteDeChamadas && tentativa < this.tentativas) {
                await this.esperar(Math.min(60, Math.max(1, erro.esperarSegundos ?? tentativa)));
                continue;
            }
            throw erro;
        }
    }
}

export default Cliente;
