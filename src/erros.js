// Erros da API: o status HTTP, a mensagem (em português, pronta para mostrar), os erros por campo (422) e a resposta
// inteira. Cada status tem a sua classe, para tratar com instanceof.

export class ErroDaApi extends Error {
    constructor(mensagem, { status = 0, erros = {}, resposta = {} } = {}) {
        super(mensagem);
        this.name = new.target.name;
        this.status = status;
        this.erros = erros;
        this.resposta = resposta;
    }

    /** O erro certo pelo status HTTP da resposta. */
    static daResposta(status, corpo = {}, esperarSegundos = null) {
        const mensagem = typeof corpo.message === 'string' && corpo.message ? corpo.message : `A API respondeu com o status ${status}.`;
        const opcoes = { status, erros: corpo.errors && typeof corpo.errors === 'object' ? corpo.errors : {}, resposta: corpo };
        const Classe = { 401: NaoAutenticado, 403: SemPermissao, 404: NaoEncontrado, 409: RegraDeNegocio, 422: Validacao, 429: LimiteDeChamadas }[status] || ErroDaApi;
        const erro = new Classe(mensagem, opcoes);
        if (erro instanceof LimiteDeChamadas) erro.esperarSegundos = esperarSegundos;
        return erro;
    }
}

/** 401: token inválido, vencido ou revogado. */
export class NaoAutenticado extends ErroDaApi {}
/** 403: sem permissão, token só de leitura gravando ou licença suspensa. */
export class SemPermissao extends ErroDaApi {}
/** 404: registro não encontrado. */
export class NaoEncontrado extends ErroDaApi {}
/** 409: a regra do negócio não deixou (ex.: remover algo em uso). */
export class RegraDeNegocio extends ErroDaApi {}
/** 422: campos recusados; veja erro.erros (campo => mensagens). */
export class Validacao extends ErroDaApi {}
/** 429: muitas chamadas; erro.esperarSegundos traz o Retry-After. */
export class LimiteDeChamadas extends ErroDaApi {}
/** Não chegou resposta da API (rede, DNS, tempo esgotado). */
export class ErroDeConexao extends ErroDaApi {}
