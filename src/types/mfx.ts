export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export type ProjectType = 'PETROBRAS' | 'PRIO' | 'ESTOQUE' | 'EXPANSÃO 140 CNTR';

export type ProcessStatus =
  | 'Em Produção Fornecedor'
  | 'Ag. Embarque'
  | 'Em Trânsito'
  | 'No Porto/Aeroporto'
  | 'Parado Ag. Drawback'
  | 'Desembaraçado'
  | 'Entregue MFX';

export type ModalType = 'MARÍTIMO' | 'AÉREO';

export type IncotermType = 'FCA' | 'FOB' | 'CIF' | 'EXW' | 'CPT' | 'DAP';

export type RegimeTributario = 'Drawback Suspensão' | 'Recolhimento Integral';

export type CanalAduaneiro = 'Verde' | 'Amarelo' | 'Vermelho' | 'Pendente Registro';

export type CurrencyCode = 'USD' | 'EUR' | 'CNY';

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
  projeto: ProjectType;
  dataEmissaoPO: string;
  previsaoProntidaoCarga: string;
  statusItem: 'Em Produção' | 'Carga Pronta' | 'Embarcado' | 'No Brasil' | 'Entregue MFX';
  alertaLaudoTecnico?: 'OK' | 'NCM Divergente entre ACs' | 'Qtd Irrisória (0,01 no AC)' | 'Sem Cobertura AC';
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
  projetoVinculado: ProjectType;
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
  id: string; // e.g. "IMP-042/26"
  oc: string; // e.g. "OC-2026-8841"
  commercialInvoice: string;
  fornecedor: string;
  paisOrigem: string;
  projeto: ProjectType;
  status: ProcessStatus;
  modal: ModalType;
  incoterm: IncotermType;
  regime: RegimeTributario;
  atoConcessorio: string; // AC ID or "SEM AC (Recolhimento)" or "AG. ALTERAÇÃO AC"
  despachante: string; // ÔMEGA
  agenteCarga: 'DSV' | 'DHL' | 'KN' | 'FEDEX' | 'Hellmann' | 'ÔMEGA';
  armadorCiaAerea: string;
  blAwb: string;
  numeroDiDuimp: string;
  canal: CanalAduaneiro;
  liAnuente?: string; // e.g. "ANP / INMETRO", "N/A"
  portoAeroportoDestino: string;

  // Dates & Lead Times
  dataPO: string;
  dataProntidaoCarga: string;
  etd: string; // Data Embarque
  etaOriginalPO: string;
  eta: string; // Previsão Chegada
  dataChegadaEfetiva?: string;
  dataRegistroDI?: string;
  dataDesembaraco?: string;
  prazoEntregaMFX: string;
  dataEntregaMFX?: string;

  // Lead Time Metrics (Days)
  transitTimeDias: number;
  tempoDesembaracoDias: number;
  tempoEntregaRodoviariaDias: number;
  freeTimeTotalDias: number;
  freeTimeDiasRestantes: number;

  // Operational Alerts
  cargaParadaDrawback: boolean; // True for the 9 stalled cargoes
  motivoParadaDrawback?: string;
  diasParadoPortoAeroporto?: number;
  alertaPreAlertaAWB: boolean; // True if Air shipment arrived/arriving without AWB pre-alert to Ômega
  atrasoEtaDias: number;

  // Financial & Cashflow
  moeda: CurrencyCode;
  taxaPtaxDI: number;
  condicaoPagamento: '30 DDL' | '60 DDL' | '90 DDL' | '180 DDL' | '360 DDL' | 'À Vista';
  dataVencimentoInvoice: string;
  statusPagamentoInvoice: 'Pago' | 'A Vencer' | 'Vencido / Crítico';

  valorFOBMoeda: number;
  freteInternacionalMoeda: number;
  seguroMoeda: number;
  vmleBRL: number; // Valor Mercadoria Local Embarque R$
  vmldBRL: number; // Valor Mercadoria Local Descarga (CIF) R$

  // Taxes (BRL)
  iiBRL: number;
  ipiBRL: number;
  pisBRL: number;
  cofinsBRL: number;
  icmsBRL: number;
  totalImpostosEstimadosBRL: number;
  impostosSuspensosDrawbackBRL: number;
  impostosPagosIndevidamenteBRL: number; // Leakage when registered under Recolhimento Integral instead of Drawback

  // Port/Airport Storage & Customs Expenses
  despesasAduaneirasBRL: number;
  armazenagemAcumuladaBRL: number;
  custoDiarioArmazenagemBRL: number;

  // Freight & Domestic Trucking Savings
  cotacaoFreteBRL: number;
  fretePagoBRL: number;
  savingFreteBRL: number;
  savingFretePercent: number;
  transportadoraNacional: string;
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
