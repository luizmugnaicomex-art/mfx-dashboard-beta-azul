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

export type ModalType = 'MARÍTIMO' | 'AÉREO' | 'RODOVIÁRIO' | string;

export type IncotermType = 'FCA' | 'FOB' | 'CIF' | 'CFR' | 'EXW' | 'CPT' | 'DAP' | 'DDP' | string;

export type RegimeTributario =
  | 'Drawback Suspensão'
  | 'Recolhimento Integral'
  | 'Ex-Tarifário'
  | string;

export type CanalAduaneiro = 'Verde' | 'Amarelo' | 'Vermelho' | 'Pendente Registro' | string;

export type CurrencyCode = 'USD' | 'EUR' | 'CNY' | 'BRL';

export interface MfxRawItemRow {
  id: string;
  status: string;
  refMfx: string;
  compradorResponsavel: string;
  po: string;
  fornecedor: string;
  origem: string;
  invoice: string;
  codMaterial: string;
  descricao: string;
  qtd: number;
  valorUnitario: number;
  valorTotal: number;
  moeda: CurrencyCode;
  unidadeMedida: string;
  agenteCargas: string;
  blAwb: string;
  incoterm: string;
  modal: string;
  dataProntidaoCarga: string;
  etd: string;
  eta: string;
  transitTimeDias: number;
  projeto: string;
  atoConcessorio?: string;
}

export interface PedidoForecastRow {
  id: string;
  projeto: string;
  processo: string;
  compradorResponsavel?: string;
  fornecedor: string;
  origem?: string;
  oc: string;
  codMaterial?: string;
  descricao?: string;
  qtd?: number;
  unidadeMedida?: string;
  emissaoOC: string;
  incoterm: string;
  valorUnitario?: number;
  valor: number;
  moeda: CurrencyCode;
  prontidaoCarga: string;
  etd?: string;
  eta?: string;
  agenteCargas?: string;
  blAwb?: string;
  modal?: string;
  status: string;
}

export interface PedidoItem {
  id: string;
  oc: string; // Purchase Order (PO)
  processoId: string; // Linked REF. MFX / Processo
  compradorResponsavel?: string;
  invoice?: string;
  codigoItem: string; // COD. MATERIAL
  descricao: string; // DESCRIÇÃO
  ncm: string;
  ncmAtoConcessorio?: string; // If divergent in AC
  quantidade: number; // QTD
  qtdAutorizadaAC?: number; // e.g., 0.01 when Laudo Técnico error occurs
  unidade: string; // UNIDADE DE MEDIDA
  valorUnitarioMoeda: number; // VALOR UNITÁRIO
  valorTotalMoeda: number; // VALOR TOTAL
  moeda: CurrencyCode;
  fornecedor: string;
  origem?: string;
  projeto: string;
  dataEmissaoPO: string;
  previsaoProntidaoCarga: string;
  etd?: string;
  eta?: string;
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
  processosVinculados: string[]; // REF. MFX / IMP-XXX/26
  cargasParadasAguardando: number;
  itensDetalhados: AtoConcessorioItem[];
  riscoAC: RiskLevel;
}

export interface ImportProcess {
  id: string; // REF. MFX / PROCESSO (e.g. "MFX00040/26", "MFX00052/26", "MFX-00001/25")
  compradorResponsavel?: string; // COMPRADOR RESPONSAVEL (e.g. "EUDE", "BEATRIZ SANTANA", "GUSTAVO")
  oc: string; // PO / OC (e.g. "6000000015, 6000000019")
  posList?: string[]; // Individual POs inside this process
  commercialInvoice: string; // INVOICE / FATURA (e.g. "87267, 87333")
  invoicesList?: string[]; // Individual Invoices inside this process
  fornecedor: string; // FORNECEDOR / EXPORTADOR
  paisOrigem: string; // ORIGEM (e.g. "ALEMANHA", "ITALIA")
  projeto: string; // PROJETO (PETROBRAS, PRIO, ESTOQUE)
  status: string; // Normalized status for filters/charts
  statusRawExcel?: string; // Original STATUS text from Excel
  modal: ModalType; // MODAL (MARÍTIMO or AÉREO)
  incoterm: string; // INCOTERMS (EXW, FCA, CFR, FOB, CIF, CPT, DAP)
  regime: string; // Normalized regime (Drawback Suspensão, Recolhimento Integral, Ex-Tarifário)
  beneficioRaw?: string; // BENEFÍCIO from Excel (DRAWBACK, RECOLHIMENTO INTEGRAL, EX-TARIFÁRIO)
  atoConcessorio: string; // Linked AC ID
  despachante: string; // ÔMEGA
  agenteCarga: string; // AGENTE DE CARGAS (CRONOS, CAPITAL, MSC, DSV, DHL, KN, FEDEX)
  armadorCiaAerea: string;
  blAwb: string; // BL / AWB (e.g. "FRA-00014811", "SSA205038", "MEDUGK594042")
  numeroDiDuimp: string; // DI
  canal: string; // CANAL (Verde, Amarelo, Vermelho)
  liAnuente?: string; // ANUÊNCIA (ANP, INMETRO, NÃO)
  deferimentoLI?: string; // DEFERIMENTO LI
  portoAeroportoDestino: string; // LOCAL DESEMBARAÇO (SALVADOR, GUARULHOS, VIRACOPOS, SANTOS, SUAPE)

  // Dates & Lead Times
  dataPO: string; // EMISSÃO OC
  dataProntidaoCarga: string; // DATA PRONTIDÃO CARGA
  etd: string; // ETD / EMBARQUE
  etaOriginalPO: string;
  eta: string; // ETA / PREVISÃO CHEGADA
  dataChegadaEfetiva?: string; // CHEGADA
  dataRegistroDI?: string; // DATA DO REGISTRO
  dataDesembaraco?: string; // DESEMBARAÇO
  dataCarregamento?: string; // CARREGAMENTO
  prazoEntregaMFX: string;
  dataEntregaMFX?: string; // ENTREGA MFX
  etdFormatted?: string;
  etaFormatted?: string;
  clearanceDateFormatted?: string;
  deliveryDateFormatted?: string;
  hasExplicitRefMfx?: boolean;

  // Lead Time Metrics (Days)
  transitTimeDias: number; // TT / TR (ETA - ETD)
  tempoDesembaracoDias: number; // DIAS P/ LIBERAÇÃO (DESEMBARAÇO - CHEGADA)
  tempoEntregaRodoviariaDias: number; // TRÂNSITO (ENTREGA MFX - CARREGAMENTO)
  leadTimeTotalDias?: number; // LEAD TIME (ENTREGA MFX - EMBARQUE)
  freeTimeTotalDias: number;
  freeTimeDiasRestantes: number;

  // Operational Alerts & Date vs. Status Inconsistency Flags
  stageNumber?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  cargaParadaDrawback: boolean;
  motivoParadaDrawback?: string;
  diasParadoPortoAeroporto?: number;
  alertaPreAlertaAWB: boolean;
  alertaEtaVencido?: boolean;
  alertaEntregaAtrasada?: boolean;
  atrasoEtaDias: number;

  // Financial & Cashflow
  moeda: CurrencyCode; // MOEDA (EUR, USD, BRL, CNY)
  taxaPtaxDI: number;
  condicaoPagamento: string; // COND. PAGAMENTO (30 DDL, 90 DDL, 180 DDL, 360 DDL)
  dataVencimentoInvoice: string; // DATA DE VENCIMENTO
  statusPagamentoInvoice: 'Pago' | 'A Vencer' | 'Vencido / Crítico';

  valorFOBMoeda: number; // Sum of VALOR TOTAL / VMLE (Moeda)
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
  qtdTotalUnidades?: number; // Sum of QTD across all material lines

  // Linked Items from Flat Table / PEDIDOS
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
  showDelivered?: boolean;
}

export type LanguageCode = 'pt' | 'en' | 'zh';
