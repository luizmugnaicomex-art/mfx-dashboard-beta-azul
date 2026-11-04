export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export type ProjectType = 'PETROBRAS' | 'PRIO' | 'ESTOQUE' | 'EXPANSÃO 140 CNTR' | string;

export type ProcessStatus =
  | 'Em Produção Fornecedor'
  | 'Ag. Embarque'
  | 'Em Trânsito'
  | 'No Porto/Aeroporto'
  | 'Parado Ag. Drawback'
  | 'Desembaraçado'
  | 'Entregue MFX'
  | string;

export type ModalType = 'MARÍTIMO' | 'AÉREO';

export type IncotermType = 'FCA' | 'FOB' | 'CIF' | 'EXW' | 'CPT' | 'DAP' | string;

export type RegimeTributario =
  | 'Drawback Suspensão'
  | 'Recolhimento Integral'
  | 'Ex-Tarifário'
  | string;

export type CanalAduaneiro = 'Verde' | 'Amarelo' | 'Vermelho' | 'Pendente Registro' | string;

export type CurrencyCode = 'USD' | 'EUR' | 'CNY';

export interface PedidoForecastRow {
  id: string;
  projeto: string;
  processo: string;
  fornecedor: string;
  oc: string;
  emissaoOC: string;
  incoterm: string;
  valor: number;
  moeda: CurrencyCode;
  prontidaoCarga: string;
  status: string;
}

export interface PedidoItem {
  id: string;
  oc: string; // Purchase Order from PEDIDOS
  processoId: string; // Linked IMP-XXX/26
  codigoItem: string;
  descricao: string;
  ncm: string;
  ncmAtoConcessorio?: string; // If divergent in AC
  quantidade: number;
  qtdAutorizadaAC?: number; // e.g., 0.01 when Laudo Técnico error occurs
  unidade: string;
  valorUnitarioMoeda: number;
  valorTotalMoeda: number;
  moeda: CurrencyCode;
  fornecedor: string;
  projeto: string;
  dataEmissaoPO: string;
  previsaoProntidaoCarga: string;
  statusItem: string;
  alertaLaudoTecnico?:
    | 'OK'
    | 'NCM Divergente entre ACs'
    | 'Qtd Irrisória (0,01 no AC)'
    | 'Sem Cobertura AC';
  acSugerido?: string;
}

export interface AtoConcessorioItem {
  itemAcNum: number;
  ncm: string;
  descricaoInsumo: string;
  qtdAutorizada: number;
  qtdUtilizada: number;
  unidade: string;
  valorAutorizadoUSD: number;
  valorUtilizadoUSD: number;
  alertaAuditoria: 'OK' | 'NCM Divergente entre ACs' | 'Qtd Irrisória (0,01)';
  observacaoLaudo?: string;
}

export interface AtoConcessorio {
  id: string; // e.g. "AC-2025/001482-9"
  numeroAC: string;
  modalidade: 'Suspensão Integrado';
  statusAC: 'Ativo' | 'Em Alteração';
  projetoVinculado: string;
  dataRegistro: string;
  dataVencimento: string;
  diasRestantes: number;
  limiteImportacaoUSD: number;
  utilizadoImportacaoUSD: number;
  saldoDisponivelUSD: number;
  compromissoExportacaoUSD: number;
  exportadoRealizadoUSD: number;
  totalItensCadastrados: number;
  itensComDivergenciaLaudo: number;
  processosVinculados: string[]; // IMP-XXX/26
  cargasParadasAguardando: number;
  itensDetalhados: AtoConcessorioItem[];
  riscoAC: RiskLevel;
}

export interface ImportProcess {
  id: string; // PROCESSO (e.g. "IMP-113/25", "IMP-001/26" ... "IMP-015/26")
  oc: string; // OC (e.g. "008074/008161")
  commercialInvoice: string; // FATURA
  fornecedor: string; // EXPORTADOR / FORNECEDOR
  paisOrigem: string;
  projeto: string; // PROJETO (PETROBRAS, PRIO, ESTOQUE)
  status: string; // Normalized status for filters/charts
  statusRawExcel?: string; // Original STATUS text from Excel
  modal: ModalType; // MODAL (MARÍTIMO or AÉREO)
  incoterm: string; // INCOTERM (FCA, FOB, CIF, EXW, CPT, DAP)
  regime: string; // Normalized regime (Drawback Suspensão, Recolhimento Integral, Ex-Tarifário)
  beneficioRaw?: string; // BENEFÍCIO from Excel (DRAWBACK, RECOLHIMENTO INTEGRAL, EX-TARIFÁRIO)
  atoConcessorio: string; // Linked AC ID
  despachante: string; // ÔMEGA
  agenteCarga: string; // AGENTE DE CARGA (DSV, DHL, KN, FEDEX, HELLMANN)
  armadorCiaAerea: string;
  blAwb: string;
  numeroDiDuimp: string; // DI
  canal: string; // CANAL (Verde, Amarelo, Vermelho)
  liAnuente?: string; // ANUÊNCIA (ANP, INMETRO, NÃO)
  deferimentoLI?: string; // DEFERIMENTO LI
  portoAeroportoDestino: string; // LOCAL DESEMBARAÇO (SALVADOR, GUARULHOS, VIRACOPOS, SANTOS, SUAPE)

  // Dates & Lead Times from 36 columns
  dataPO: string; // EMISSÃO OC
  dataProntidaoCarga: string; // PRONTIDÃO DA CARGA
  etd: string; // EMBARQUE
  etaOriginalPO: string;
  eta: string; // PREVISÃO CHEGADA
  dataChegadaEfetiva?: string; // CHEGADA
  dataRegistroDI?: string; // DATA DO REGISTRO
  dataDesembaraco?: string; // DESEMBARAÇO
  dataCarregamento?: string; // CARREGAMENTO
  prazoEntregaMFX: string;
  dataEntregaMFX?: string; // ENTREGA MFX

  // Lead Time Metrics (Days)
  transitTimeDias: number; // TT
  tempoDesembaracoDias: number; // DIAS P/ LIBERAÇÃO (DESEMBARAÇO - CHEGADA)
  tempoEntregaRodoviariaDias: number; // TRÂNSITO (ENTREGA MFX - CARREGAMENTO)
  leadTimeTotalDias?: number; // LEAD TIME (ENTREGA MFX - EMBARQUE)
  freeTimeTotalDias: number;
  freeTimeDiasRestantes: number;

  // Operational Alerts
  cargaParadaDrawback: boolean;
  motivoParadaDrawback?: string;
  diasParadoPortoAeroporto?: number;
  alertaPreAlertaAWB: boolean;
  atrasoEtaDias: number;

  // Financial & Cashflow
  moeda: CurrencyCode; // MOEDA
  taxaPtaxDI: number;
  condicaoPagamento: string; // COND. PAGAMENTO (30 DDL, 90 DDL, 180 DDL, 360 DDL)
  dataVencimentoInvoice: string; // DATA DE VENCIMENTO
  statusPagamentoInvoice: 'Pago' | 'A Vencer' | 'Vencido / Crítico';

  valorFOBMoeda: number; // VMLE (Moeda)
  valorVMLDMoeda?: number; // VMLD (Moeda)
  freteInternacionalMoeda: number;
  seguroMoeda: number;
  vmleBRL: number; // VMLE R$
  vmldBRL: number; // VMLD R$

  // Taxes (BRL)
  iiBRL: number;
  ipiBRL: number;
  pisBRL: number;
  cofinsBRL: number;
  icmsBRL: number;
  totalImpostosEstimadosBRL: number;
  impostosSuspensosDrawbackBRL: number;
  impostosPagosIndevidamenteBRL: number;

  // Port/Airport Storage & Customs Expenses
  despesasAduaneirasBRL: number;
  armazenagemAcumuladaBRL: number;
  custoDiarioArmazenagemBRL: number;

  // Freight & Domestic Trucking Savings
  cotacaoFreteBRL: number; // COTAÇÃO FRETE R$
  fretePagoBRL: number; // FRETE PAGO R$
  savingFreteBRL: number; // SAVING FRETE
  savingFretePercent: number;
  transportadoraNacional: string; // TRANSPORTADORA
  freteRodoviarioBRL: number;
  pesoBrutoKg: number;
  cubagemCbm: number;
  qtdContainersFCL: number;

  // Linked Items from PEDIDOS
  itens: PedidoItem[];

  // Computed Risk Level
  riskLevel: RiskLevel;
  riskReason: string;
}

export interface PtaxRates {
  USD: number;
  EUR: number;
  CNY: number;
  updatedAt: string;
}

export interface FilterState {
  pos: string[];
  projetos: string[];
  status: string[];
  modalIncoterm: string[];
  regimeAC: string[];
  fornecedores: string[];
  agentes: string[];
  searchPO: string;
  searchProcesso: string;
  searchBlDi: string;
  etaStart: string;
  etaEnd: string;
  cashflowStart: string;
  cashflowEnd: string;
}

export type LanguageCode = 'pt' | 'en' | 'zh';
