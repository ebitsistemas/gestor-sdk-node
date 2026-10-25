// Tipos do SDK da API do Gestor Integrado.

export const VERSAO: string;

/** Endereço central da API (https://hubintegrado.com). */
export const ENDERECO: string;

export interface OpcoesDoCliente {
    /** Endereço da API (padrão https://hubintegrado.com, o mesmo para todas as empresas). */
    endereco?: string;
    /** Token criado em Configurações › Integrações › API do sistema. */
    token: string;
    /** Segundos por chamada (padrão 30). */
    tempoLimite?: number;
    /** Tentativas no 429 e na falha de rede em consultas (padrão 3). */
    tentativas?: number;
    /** Outro fetch (padrão: o do Node 18+). */
    fetch?: typeof fetch;
    /** Como aguardar entre as tentativas (padrão: setTimeout). */
    esperar?: (segundos: number) => Promise<void>;
}

export type Registro = Record<string, any>;

export interface Meta {
    pagina?: number;
    por_pagina?: number;
    total?: number;
    total_sem_filtro?: number;
    [chave: string]: any;
}

export interface Filtros {
    busca?: string;
    pagina?: number;
    por_pagina?: 10 | 25 | 50 | 100;
    ordem?: string;
    direcao?: 'asc' | 'desc';
    [filtro: string]: any;
}

export class Pagina<T = Registro> implements Iterable<T> {
    readonly itens: T[];
    readonly meta: Meta;
    readonly numero: number;
    readonly porPagina: number;
    readonly total: number;
    readonly temProxima: boolean;
    [Symbol.iterator](): Iterator<T>;
}

export class Recurso<T = Registro> {
    readonly nome: string;
    listar(filtros?: Filtros): Promise<Pagina<T>>;
    todos(filtros?: Filtros, porPagina?: number): AsyncGenerator<T>;
    consultar(id: number | string): Promise<T>;
    cadastrar(dados: Registro): Promise<T>;
    atualizar(id: number | string, dados: Registro): Promise<T>;
    remover(id: number | string): Promise<Registro>;
    opcoes(): Promise<Registro>;
    acao(acao: string, id?: number | string | null, dados?: Registro, metodo?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'): Promise<Registro>;
}

export class Cliente {
    constructor(opcoes: OpcoesDoCliente);
    recurso<T = Registro>(nome: string): Recurso<T>;
    eu(): Promise<Registro>;
    get(caminho: string, consulta?: Registro): Promise<Registro>;
    post(caminho: string, dados?: Registro): Promise<Registro>;
    put(caminho: string, dados?: Registro): Promise<Registro>;
    patch(caminho: string, dados?: Registro): Promise<Registro>;
    delete(caminho: string): Promise<Registro>;
    chamar(metodo: string, caminho: string, dados?: Registro): Promise<Registro>;
    /** Um arquivo da API (XML e PDF da nota, carta de correção...): o conteúdo cru. */
    baixar(caminho: string, consulta?: Registro): Promise<Buffer>;

    readonly parceiros: Recurso;
    readonly produtos: Recurso;
    readonly servicos: Recurso;
    readonly categorias: Recurso;
    readonly grupos: Recurso;
    readonly unidades: Recurso;
    readonly variacoes: Recurso;
    readonly vendas: Recurso;
    readonly compras: Recurso;
    readonly ordensServico: Recurso;
    readonly descontos: Recurso;
    readonly faturamentos: Recurso;
    readonly boletos: Recurso;
    readonly contasBancarias: Recurso;
    readonly caixas: Recurso;
    readonly notasFiscais: Recurso;
    readonly notasRecebidas: Recurso;
    readonly tributacoes: Recurso;
    readonly operacoes: Recurso;
    readonly formasPagamento: Recurso;
    readonly usuarios: Recurso;
    readonly cargos: Recurso;
    readonly status: Recurso;
    readonly relatorios: Recurso;
    readonly cupons: Recurso;
    readonly contratos: Recurso;
    readonly equipamentos: Recurso;
    /** Qualquer outro recurso pelo nome em camelCase (ordens-servico → ordensServico). */
    readonly [recurso: string]: any;
}

export class ErroDaApi extends Error {
    readonly status: number;
    readonly erros: Record<string, string[]>;
    readonly resposta: Registro;
}
export class NaoAutenticado extends ErroDaApi {}
export class SemPermissao extends ErroDaApi {}
export class NaoEncontrado extends ErroDaApi {}
export class RegraDeNegocio extends ErroDaApi {}
export class Validacao extends ErroDaApi {}
export class LimiteDeChamadas extends ErroDaApi {
    readonly esperarSegundos: number | null;
}
export class ErroDeConexao extends ErroDaApi {}

export default Cliente;
