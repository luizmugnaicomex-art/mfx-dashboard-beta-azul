import * as XLSX from 'xlsx';
import {
  ImportProcess,
  PedidoItem,
  AtoConcessorio,
  PtaxRates,
  RiskLevel,
  ProjectType,
  ProcessStatus,
  ModalType,
  IncotermType,
  RegimeTributario,
  CanalAduaneiro,
  CurrencyCode,
} from '../types/mfx';

function cleanKey(key: string): string {
  return key
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getVal(row: Record<string, any>, candidates: string[], fallback: any = ''): any {
  const normalizedMap: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    normalizedMap[cleanKey(k)] = row[k];
  }
  for (const c of candidates) {
    const ck = cleanKey(c);
    if (normalizedMap[ck] !== undefined && normalizedMap[ck] !== null && normalizedMap[ck] !== '') {
      return normalizedMap[ck];
    }
    // Partial match check
    const foundKey = Object.keys(normalizedMap).find((k) => k.includes(ck));
    if (foundKey && normalizedMap[foundKey] !== undefined && normalizedMap[foundKey] !== '') {
      return normalizedMap[foundKey];
    }
  }
  return fallback;
}

function parseNum(val: any, fallback = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (!val) return fallback;
  const str = String(val)
    .replace(/[R$\sUSD€¥%]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? fallback : n;
}

function parseDateStr(val: any, fallback = '2026-11-10'): string {
  if (!val) return fallback;
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const y = String(date.y).padStart(4, '0');
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  // Check DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }
  // Check YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  return fallback;
}

export function computeProcessRisk(p: Partial<ImportProcess>): { riskLevel: RiskLevel; riskReason: string } {
  if (p.status === 'Entregue MFX' || p.dataEntregaMFX) {
    if ((p.impostosPagosIndevidamenteBRL || 0) > 0) {
      return {
        riskLevel: 'medium',
        riskReason: `Entregue MFX · R$ ${(p.impostosPagosIndevidamenteBRL || 0).toLocaleString('pt-BR')} pagos em Recolhimento Integral`,
      };
    }
    return {
      riskLevel: 'none',
      riskReason: 'Concluído / Entregue na Planta MFX',
    };
  }
  if (p.cargaParadaDrawback || p.status === 'Parado Ag. Drawback') {
    return {
      riskLevel: 'high',
      riskReason: p.motivoParadaDrawback || 'Carga Parada aguardando Ato Concessório Drawback',
    };
  }
  if ((p.freeTimeDiasRestantes ?? 10) < 3 && p.status === 'No Porto/Aeroporto') {
    return {
      riskLevel: 'high',
      riskReason: `Free Time expirando (${p.freeTimeDiasRestantes}d restantes) · Risco Iminente de Demurrage`,
    };
  }
  if (p.modal === 'AÉREO' && p.alertaPreAlertaAWB) {
    return {
      riskLevel: 'high',
      riskReason: 'Embarque Aéreo sem Pré-Alerta AWB enviado à Ômega',
    };
  }
  if ((p.impostosPagosIndevidamenteBRL || 0) > 0) {
    return {
      riskLevel: 'high',
      riskReason: `Vazamento Fiscal: R$ ${(p.impostosPagosIndevidamenteBRL || 0).toLocaleString('pt-BR')} em Recolhimento Integral`,
    };
  }
  if (p.canal === 'Vermelho' || p.canal === 'Amarelo' || (p.atrasoEtaDias || 0) > 2) {
    return {
      riskLevel: 'medium',
      riskReason:
        p.canal === 'Vermelho' || p.canal === 'Amarelo'
          ? `Parametrizado em Canal ${p.canal} · Exame Fiscal/Documental`
          : `Atraso de ${p.atrasoEtaDias} dias no ETA vs. PO Original`,
    };
  }
  return {
    riskLevel: 'low',
    riskReason: 'Processo no prazo · Drawback validado / Saving positivo',
  };
}

export function parseMfxExcelFile(
  buffer: ArrayBuffer,
  ptax: PtaxRates
): { processos: ImportProcess[]; pedidosCount: number; sheetNames: string[] } {
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheetNames = wb.SheetNames;

  // Locate PROCESSOS and PEDIDOS sheets
  const processosSheetName =
    sheetNames.find((s) => cleanKey(s).includes('PROCESSO') || cleanKey(s).includes('FUP')) || sheetNames[0];
  const pedidosSheetName =
    sheetNames.find((s) => cleanKey(s).includes('PEDIDO') || cleanKey(s).includes('PO') || cleanKey(s).includes('ITEN')) ||
    sheetNames[1];

  const rawProcessos: Record<string, any>[] = processosSheetName
    ? XLSX.utils.sheet_to_json(wb.Sheets[processosSheetName], { defval: '' })
    : [];
  const rawPedidos: Record<string, any>[] = pedidosSheetName
    ? XLSX.utils.sheet_to_json(wb.Sheets[pedidosSheetName], { defval: '' })
    : [];

  // Parse PEDIDOS items first so we can link them to PROCESSOS
  const pedidosByOC: Record<string, PedidoItem[]> = {};
  const pedidosByProc: Record<string, PedidoItem[]> = {};

  rawPedidos.forEach((row, idx) => {
    const oc = String(getVal(row, ['OC', 'PO', 'PEDIDO', 'ORDEM DE COMPRA'], `OC-2026-${5000 + idx}`)).trim();
    const processoId = String(getVal(row, ['PROCESSO', 'IMP', 'REF MFX', 'REFERENCIA'], '')).trim();
    const moedaRaw = String(getVal(row, ['MOEDA', 'CURR', 'CURRENCY'], 'USD')).toUpperCase();
    const moeda: CurrencyCode = moedaRaw.includes('EUR') ? 'EUR' : moedaRaw.includes('CNY') || moedaRaw.includes('RMB') ? 'CNY' : 'USD';
    const qtd = parseNum(getVal(row, ['QTD', 'QUANTIDADE', 'QTY'], 100), 100);
    const vlrUnit = parseNum(getVal(row, ['VALOR UNITARIO', 'VLR UNIT', 'PRECO UNIT', 'UNIT PRICE'], 1250), 1250);
    const vlrTotal = parseNum(getVal(row, ['VALOR TOTAL', 'VLR TOTAL', 'TOTAL'], qtd * vlrUnit), qtd * vlrUnit);
    const projetoRaw = String(getVal(row, ['PROJETO', 'CLIENTE', 'DESTINO'], 'PETROBRAS')).toUpperCase();
    const projeto: ProjectType = projetoRaw.includes('PRIO')
      ? 'PRIO'
      : projetoRaw.includes('140') || projetoRaw.includes('EXPANSAO')
      ? 'EXPANSÃO 140 CNTR'
      : projetoRaw.includes('ESTOQUE')
      ? 'ESTOQUE'
      : 'PETROBRAS';

    const item: PedidoItem = {
      id: `PED-${idx + 1}`,
      oc,
      processoId: processoId || `IMP-${String(idx + 1).padStart(3, '0')}/26`,
      codigoItem: String(getVal(row, ['CODIGO', 'COD ITEM', 'PART NUMBER', 'ITEM'], `MFX-IT-${idx + 101}`)),
      descricao: String(getVal(row, ['DESCRICAO', 'MERCADORIA', 'PRODUTO', 'INSUMO'], 'Insumo Subsea MFX Comex')),
      ncm: String(getVal(row, ['NCM', 'SH', 'CLASSIFICACAO'], '7304.29.39')),
      quantidade: qtd,
      qtdAutorizadaAC: parseNum(getVal(row, ['QTD AC', 'SALDO AC'], qtd * 2), qtd * 2),
      unidade: String(getVal(row, ['UN', 'UNIDADE', 'UOM'], 'UN')),
      valorUnitarioMoeda: vlrUnit,
      valorTotalMoeda: vlrTotal,
      moeda,
      fornecedor: String(getVal(row, ['FORNECEDOR', 'EXPORTADOR', 'SUPPLIER'], 'NOV')).toUpperCase(),
      projeto,
      dataEmissaoPO: parseDateStr(getVal(row, ['DATA PO', 'DATA OC', 'EMISSAO'], '2026-09-01')),
      previsaoProntidaoCarga: parseDateStr(getVal(row, ['PRONTIDAO', 'CARGA PRONTA', 'READY DATE'], '2026-10-15')),
      statusItem: 'Embarcado',
      alertaLaudoTecnico: 'OK',
    };

    if (!pedidosByOC[oc]) pedidosByOC[oc] = [];
    pedidosByOC[oc].push(item);
    if (processoId) {
      if (!pedidosByProc[processoId]) pedidosByProc[processoId] = [];
      pedidosByProc[processoId].push(item);
    }
  });

  const parsedProcessos: ImportProcess[] = rawProcessos.map((row, idx) => {
    const id = String(
      getVal(row, ['PROCESSO', 'IMP', 'REF MFX', 'N PROCESSO'], `IMP-${String(idx + 1).padStart(3, '0')}/26`)
    ).trim();
    const oc = String(getVal(row, ['OC', 'PO', 'PEDIDO', 'ORDEM DE COMPRA'], `OC-2026-${4100 + idx}`)).trim();
    const fornecedor = String(getVal(row, ['FORNECEDOR', 'EXPORTADOR', 'FABRICANTE'], 'NOV')).trim().toUpperCase();
    const projetoRaw = String(getVal(row, ['PROJETO', 'CENTRO CUSTO', 'CONTRATO'], 'PETROBRAS')).toUpperCase();
    const projeto: ProjectType = projetoRaw.includes('PRIO')
      ? 'PRIO'
      : projetoRaw.includes('140') || projetoRaw.includes('EXPANSAO')
      ? 'EXPANSÃO 140 CNTR'
      : projetoRaw.includes('ESTOQUE')
      ? 'ESTOQUE'
      : 'PETROBRAS';

    const statusRaw = String(getVal(row, ['STATUS', 'SITUACAO', 'FASE'], 'Em Trânsito')).toUpperCase();
    let status: ProcessStatus = 'Em Trânsito';
    if (statusRaw.includes('PARADO') || statusRaw.includes('DRAWBACK') || statusRaw.includes('BLOQUEADO')) {
      status = 'Parado Ag. Drawback';
    } else if (statusRaw.includes('ENTREGUE') || statusRaw.includes('CONCLUIDO') || statusRaw.includes('FINALIZADO')) {
      status = 'Entregue MFX';
    } else if (statusRaw.includes('DESEMBARACADO') || statusRaw.includes('LIBERADO')) {
      status = 'Desembaraçado';
    } else if (statusRaw.includes('PORTO') || statusRaw.includes('AEROPORTO') || statusRaw.includes('TECA') || statusRaw.includes('TECON')) {
      status = 'No Porto/Aeroporto';
    } else if (statusRaw.includes('EMBARQUE') || statusRaw.includes('PRONTA') || statusRaw.includes('BOOKING')) {
      status = 'Ag. Embarque';
    } else if (statusRaw.includes('PRODUCAO') || statusRaw.includes('FABRICACAO')) {
      status = 'Em Produção Fornecedor';
    }

    const modalRaw = String(getVal(row, ['MODAL', 'VIA', 'TRANSPORTE'], 'MARÍTIMO')).toUpperCase();
    const modal: ModalType = modalRaw.includes('AER') || modalRaw.includes('AIR') ? 'AÉREO' : 'MARÍTIMO';

    const incotermRaw = String(getVal(row, ['INCOTERM', 'INCOTERMS'], 'FOB')).toUpperCase().trim();
    const incoterm: IncotermType = (['FCA', 'FOB', 'CIF', 'EXW', 'CPT', 'DAP'].find((i) => incotermRaw.includes(i)) ||
      'FOB') as IncotermType;

    const regimeRaw = String(getVal(row, ['REGIME', 'TRIBUTACAO', 'MODALIDADE'], 'Drawback Suspensão')).toUpperCase();
    const regime: RegimeTributario =
      regimeRaw.includes('INTEGRAL') || regimeRaw.includes('NORMAL') ? 'Recolhimento Integral' : 'Drawback Suspensão';

    const atoConcessorio = String(
      getVal(
        row,
        ['ATO CONCESSORIO', 'AC', 'DRAWBACK', 'N AC'],
        regime === 'Drawback Suspensão' ? 'AC-2025/001482-9' : 'SEM AC (Recolhimento)'
      )
    );

    const moedaRaw = String(getVal(row, ['MOEDA', 'CURRENCY'], 'USD')).toUpperCase();
    const moeda: CurrencyCode = moedaRaw.includes('EUR') ? 'EUR' : moedaRaw.includes('CNY') ? 'CNY' : 'USD';
    const taxaPtaxDI = parseNum(getVal(row, ['PTAX', 'TAXA DI', 'CAMBIO'], ptax[moeda]), ptax[moeda]);

    const valorFOBMoeda = parseNum(getVal(row, ['VALOR FOB', 'FOB', 'VMLE MOEDA', 'VALOR INVOICE'], 250000), 250000);
    const freteInternacionalMoeda = parseNum(getVal(row, ['FRETE INT', 'FRETE MOEDA', 'FRETE INTERNACIONAL'], 14000), 14000);
    const seguroMoeda = parseNum(getVal(row, ['SEGURO', 'INSURANCE'], 400), 400);

    const vmleBRL = parseNum(getVal(row, ['VMLE R$', 'VMLE', 'FOB R$'], valorFOBMoeda * taxaPtaxDI), valorFOBMoeda * taxaPtaxDI);
    const vmldBRL = parseNum(
      getVal(row, ['VMLD R$', 'VMLD', 'VALOR CIF R$', 'CIF R$'], (valorFOBMoeda + freteInternacionalMoeda + seguroMoeda) * taxaPtaxDI),
      (valorFOBMoeda + freteInternacionalMoeda + seguroMoeda) * taxaPtaxDI
    );

    const cotacaoFreteBRL = parseNum(
      getVal(row, ['COTACAO FRETE R$', 'FRETE COTADO', 'BUDGET FRETE'], freteInternacionalMoeda * taxaPtaxDI * 1.16),
      freteInternacionalMoeda * taxaPtaxDI * 1.16
    );
    const fretePagoBRL = parseNum(
      getVal(row, ['FRETE PAGO R$', 'FRETE EFETIVO R$', 'CUSTO FRETE R$'], freteInternacionalMoeda * taxaPtaxDI),
      freteInternacionalMoeda * taxaPtaxDI
    );
    const savingFreteBRL = parseNum(getVal(row, ['SAVING FRETE', 'ECONOMIA FRETE'], cotacaoFreteBRL - fretePagoBRL), cotacaoFreteBRL - fretePagoBRL);
    const savingFretePercent = cotacaoFreteBRL > 0 ? (savingFreteBRL / cotacaoFreteBRL) * 100 : 14.5;

    const iiBRL = parseNum(getVal(row, ['II', 'IMPOSTO IMPORTACAO'], vmldBRL * 0.14), vmldBRL * 0.14);
    const ipiBRL = parseNum(getVal(row, ['IPI'], (vmldBRL + iiBRL) * 0.05), (vmldBRL + iiBRL) * 0.05);
    const pisBRL = parseNum(getVal(row, ['PIS'], vmldBRL * 0.021), vmldBRL * 0.021);
    const cofinsBRL = parseNum(getVal(row, ['COFINS'], vmldBRL * 0.0965), vmldBRL * 0.0965);
    const icmsBRL = parseNum(getVal(row, ['ICMS'], vmldBRL * 0.23), vmldBRL * 0.23);
    const totalImpostosEstimadosBRL = iiBRL + ipiBRL + pisBRL + cofinsBRL + icmsBRL;

    const impostosSuspensosDrawbackBRL = regime === 'Drawback Suspensão' ? totalImpostosEstimadosBRL : 0;
    const impostosPagosIndevidamenteBRL = parseNum(
      getVal(row, ['VAZAMENTO FISCAL', 'IMPOSTO PAGO INDEVIDO'], regime === 'Recolhimento Integral' && projeto !== 'ESTOQUE' ? totalImpostosEstimadosBRL * 0.6 : 0),
      0
    );

    const linkedItems = pedidosByProc[id] || pedidosByOC[oc] || [
      {
        id: `IT-${idx + 1}`,
        oc,
        processoId: id,
        codigoItem: `MFX-ITEM-${idx + 100}`,
        descricao: String(getVal(row, ['MERCADORIA', 'DESCRICAO', 'PRODUTO'], 'Componentes Subsea & Tubos Umbilicais')),
        ncm: String(getVal(row, ['NCM'], '7304.29.39')),
        quantidade: parseNum(getVal(row, ['QTD', 'QUANTIDADE'], 100), 100),
        unidade: 'UN',
        valorUnitarioMoeda: valorFOBMoeda / 100,
        valorTotalMoeda: valorFOBMoeda,
        moeda,
        fornecedor,
        projeto,
        dataEmissaoPO: parseDateStr(getVal(row, ['DATA PO', 'DATA OC'], '2026-09-01')),
        previsaoProntidaoCarga: parseDateStr(getVal(row, ['PRONTIDAO'], '2026-10-05')),
        statusItem: status === 'Entregue MFX' ? 'Entregue MFX' : 'Embarcado',
        alertaLaudoTecnico: 'OK',
      },
    ];

    const partialProc: ImportProcess = {
      id,
      oc,
      commercialInvoice: String(getVal(row, ['INVOICE', 'CI', 'FATURA'], `CI-${fornecedor.slice(0, 3)}-${20260 + idx}`)),
      fornecedor,
      paisOrigem: String(getVal(row, ['ORIGEM', 'PAIS'], 'EUA / Europa')),
      projeto,
      status,
      modal,
      incoterm,
      regime,
      atoConcessorio,
      despachante: String(getVal(row, ['DESPACHANTE'], 'ÔMEGA')).toUpperCase(),
      agenteCarga: (['DSV', 'DHL', 'KN', 'FEDEX', 'Hellmann'].find((a) =>
        String(getVal(row, ['AGENTE', 'AGENTE DE CARGA', 'FORWARDER'], 'DSV'))
          .toUpperCase()
          .includes(a.toUpperCase())
      ) || 'DSV') as any,
      armadorCiaAerea: String(getVal(row, ['ARMADOR', 'CIA AEREA'], modal === 'MARÍTIMO' ? 'Maersk Line' : 'Lufthansa Cargo')),
      blAwb: String(getVal(row, ['BL', 'AWB', 'CONHECIMENTO', 'BL/AWB'], `BL-${882910 + idx}`)),
      numeroDiDuimp: String(getVal(row, ['DI', 'DUIMP', 'N DI'], 'Pendente Registro')),
      canal: (['Verde', 'Amarelo', 'Vermelho'].find((c) =>
        String(getVal(row, ['CANAL', 'PARAMETRIZACAO'], '')).toUpperCase().includes(c.toUpperCase())
      ) || 'Pendente Registro') as CanalAduaneiro,
      liAnuente: String(getVal(row, ['LI', 'ANUENTE'], 'Isento')),
      portoAeroportoDestino:
        modal === 'AÉREO' ? 'Aeroporto de Salvador (SSA - TECA)' : 'Porto de Salvador (TECON)',
      dataPO: parseDateStr(getVal(row, ['DATA PO', 'DATA OC'], '2026-08-25')),
      dataProntidaoCarga: parseDateStr(getVal(row, ['DATA PRONTIDAO', 'PRONTIDAO'], '2026-09-25')),
      etd: parseDateStr(getVal(row, ['ETD', 'DATA EMBARQUE', 'EMBARQUE'], '2026-10-02')),
      etaOriginalPO: parseDateStr(getVal(row, ['ETA ORIGINAL', 'PREVISAO PO'], '2026-10-25')),
      eta: parseDateStr(getVal(row, ['ETA', 'PREVISAO CHEGADA', 'CHEGADA'], '2026-10-27')),
      prazoEntregaMFX: parseDateStr(getVal(row, ['PRAZO ENTREGA MFX', 'ENTREGA MFX', 'DATA ENTREGA MFX'], '2026-11-06')),
      dataEntregaMFX: status === 'Entregue MFX' ? parseDateStr(getVal(row, ['DATA ENTREGA MFX'], '2026-10-30')) : undefined,
      transitTimeDias: parseNum(getVal(row, ['TRANSIT TIME'], modal === 'AÉREO' ? 3 : 22), modal === 'AÉREO' ? 3 : 22),
      tempoDesembaracoDias: parseNum(getVal(row, ['TEMPO DESEMBARACO'], 4), 4),
      tempoEntregaRodoviariaDias: 2,
      freeTimeTotalDias: modal === 'AÉREO' ? 5 : 14,
      freeTimeDiasRestantes: parseNum(getVal(row, ['FREE TIME RESTANTE', 'FREE TIME'], 6), 6),
      cargaParadaDrawback: status === 'Parado Ag. Drawback',
      motivoParadaDrawback:
        status === 'Parado Ag. Drawback'
          ? String(getVal(row, ['MOTIVO PARADA', 'OBS DRAWBACK'], 'Aguardando Alteração / Aditivo de Ato Concessório na SECEX'))
          : undefined,
      diasParadoPortoAeroporto: status === 'Parado Ag. Drawback' ? 7 : 0,
      alertaPreAlertaAWB: modal === 'AÉREO' && Boolean(getVal(row, ['SEM PRE ALERTA', 'ALERTA AWB'], false)),
      atrasoEtaDias: parseNum(getVal(row, ['ATRASO DIAS'], 0), 0),
      moeda,
      taxaPtaxDI,
      condicaoPagamento: (getVal(row, ['COND PAGAMENTO', 'PRAZO PAGAMENTO'], '90 DDL') || '90 DDL') as any,
      dataVencimentoInvoice: parseDateStr(getVal(row, ['DATA DE VENCIMENTO', 'VENCIMENTO INVOICE', 'VENCIMENTO'], '2026-12-28')),
      statusPagamentoInvoice: 'A Vencer',
      valorFOBMoeda,
      freteInternacionalMoeda,
      seguroMoeda,
      vmleBRL,
      vmldBRL,
      iiBRL,
      ipiBRL,
      pisBRL,
      cofinsBRL,
      icmsBRL,
      totalImpostosEstimadosBRL,
      impostosSuspensosDrawbackBRL,
      impostosPagosIndevidamenteBRL,
      despesasAduaneirasBRL: parseNum(getVal(row, ['DESPESAS ADUANEIRAS'], 22000), 22000),
      armazenagemAcumuladaBRL: parseNum(getVal(row, ['ARMAZENAGEM'], status === 'Parado Ag. Drawback' ? 24500 : 8500), 8500),
      custoDiarioArmazenagemBRL: status === 'Parado Ag. Drawback' ? 3200 : 0,
      cotacaoFreteBRL,
      fretePagoBRL,
      savingFreteBRL,
      savingFretePercent,
      transportadoraNacional: String(getVal(row, ['TRANSPORTADORA', 'RODOVIARIO'], 'JSL Heavy')),
      freteRodoviarioBRL: parseNum(getVal(row, ['FRETE RODOVIARIO'], 12500), 12500),
      pesoBrutoKg: parseNum(getVal(row, ['PESO BRUTO', 'PESO KG'], 36000), 36000),
      cubagemCbm: parseNum(getVal(row, ['CUBAGEM', 'CBM'], 55), 55),
      qtdContainersFCL: parseNum(getVal(row, ['FCL', 'QTD CNTR', 'CONTAINERS'], modal === 'MARÍTIMO' ? 2 : 0), modal === 'MARÍTIMO' ? 2 : 0),
      itens: linkedItems,
      riskLevel: 'low',
      riskReason: '',
    };

    const risk = computeProcessRisk(partialProc);
    partialProc.riskLevel = risk.riskLevel;
    partialProc.riskReason = risk.riskReason;

    return partialProc;
  });

  return {
    processos: parsedProcessos,
    pedidosCount: rawPedidos.length,
    sheetNames,
  };
}

export function exportMfxToExcel(
  processos: ImportProcess[],
  atosConcessorios: AtoConcessorio[],
  filename = 'FUP_IMPORTACAO_BI_MFX_EXPORT.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet PROCESSOS
  const rowsProcessos = processos.map((p) => ({
    PROCESSO: p.id,
    OC: p.oc,
    INVOICE: p.commercialInvoice,
    FORNECEDOR: p.fornecedor,
    PROJETO: p.projeto,
    STATUS: p.status,
    MODAL: p.modal,
    INCOTERM: p.incoterm,
    REGIME: p.regime,
    'ATO CONCESSÓRIO': p.atoConcessorio,
    DESPACHANTE: p.despachante,
    'AGENTE DE CARGA': p.agenteCarga,
    'BL / AWB': p.blAwb,
    'DI / DUIMP': p.numeroDiDuimp,
    CANAL: p.canal,
    ETD: p.etd,
    ETA: p.eta,
    'PRAZO ENTREGA MFX': p.prazoEntregaMFX,
    'DATA ENTREGA MFX': p.dataEntregaMFX || '',
    'FREE TIME RESTANTE (DIAS)': p.freeTimeDiasRestantes,
    MOEDA: p.moeda,
    'TAXA PTAX': p.taxaPtaxDI,
    'VALOR FOB (MOEDA)': p.valorFOBMoeda,
    'VMLD / CIF (R$)': Math.round(p.vmldBRL),
    'TOTAL IMPOSTOS (R$)': Math.round(p.totalImpostosEstimadosBRL),
    'IMPOSTOS SUSPENSOS DRAWBACK (R$)': Math.round(p.impostosSuspensosDrawbackBRL),
    'RECOLHIMENTO INDEVIDO (R$)': Math.round(p.impostosPagosIndevidamenteBRL),
    'COTAÇÃO FRETE (R$)': Math.round(p.cotacaoFreteBRL),
    'FRETE PAGO (R$)': Math.round(p.fretePagoBRL),
    'SAVING FRETE (R$)': Math.round(p.savingFreteBRL),
    TRANSPORTADORA: p.transportadoraNacional,
    'FRETE RODOVIÁRIO (R$)': Math.round(p.freteRodoviarioBRL),
    'COND. PAGAMENTO': p.condicaoPagamento,
    'DATA DE VENCIMENTO': p.dataVencimentoInvoice,
    'ALERTA OPERACIONAL': p.riskReason,
  }));

  const wsProcessos = XLSX.utils.json_to_sheet(rowsProcessos);
  XLSX.utils.book_append_sheet(wb, wsProcessos, 'PROCESSOS');

  // 2. Sheet PEDIDOS
  const allPedidos: Record<string, any>[] = [];
  processos.forEach((p) => {
    p.itens.forEach((it) => {
      allPedidos.push({
        OC: it.oc,
        PROCESSO: p.id,
        'CÓDIGO ITEM': it.codigoItem,
        DESCRIÇÃO: it.descricao,
        NCM: it.ncm,
        'NCM NO AC': it.ncmAtoConcessorio || it.ncm,
        QUANTIDADE: it.quantidade,
        'QTD AUTORIZADA AC': it.qtdAutorizadaAC ?? '',
        UNIDADE: it.unidade,
        MOEDA: it.moeda,
        'VLR UNITÁRIO': it.valorUnitarioMoeda,
        'VLR TOTAL': it.valorTotalMoeda,
        FORNECEDOR: it.fornecedor,
        PROJETO: it.projeto,
        'STATUS ITEM': it.statusItem,
        'AUDITORIA LAUDO TÉCNICO': it.alertaLaudoTecnico || 'OK',
      });
    });
  });

  const wsPedidos = XLSX.utils.json_to_sheet(allPedidos);
  XLSX.utils.book_append_sheet(wb, wsPedidos, 'PEDIDOS');

  // 3. Sheet ATOS_CONCESSORIOS
  const rowsAC = atosConcessorios.map((ac) => ({
    'ATO CONCESSÓRIO': ac.id,
    'Nº SECEX': ac.numeroAC,
    STATUS: ac.statusAC,
    PROJETO: ac.projetoVinculado,
    VENCIMENTO: ac.dataVencimento,
    'DIAS RESTANTES': ac.diasRestantes,
    'LIMITE IMPORTAÇÃO (USD)': ac.limiteImportacaoUSD,
    'UTILIZADO IMPORTAÇÃO (USD)': ac.utilizadoImportacaoUSD,
    'SALDO DISPONÍVEL (USD)': ac.saldoDisponivelUSD,
    'TOTAL ITENS': ac.totalItensCadastrados,
    'DIVERGÊNCIAS LAUDO': ac.itensComDivergenciaLaudo,
    'CARGAS PARADAS': ac.cargasParadasAguardando,
    'PROCESSOS VINCULADOS': ac.processosVinculados.join(', '),
  }));

  const wsAC = XLSX.utils.json_to_sheet(rowsAC);
  XLSX.utils.book_append_sheet(wb, wsAC, 'ATOS_CONCESSORIOS');

  XLSX.writeFile(wb, filename);
}
