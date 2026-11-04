import * as XLSX from 'xlsx';
import {
  ImportProcess,
  PedidoItem,
  PedidoForecastRow,
  AtoConcessorio,
  PtaxRates,
  RiskLevel,
  ModalType,
  CurrencyCode,
} from '../types/mfx';

// ============================================================================
// A. HEADER NORMALIZATION, CLEAN NUMBER & EXCEL DATE HELPERS
// ============================================================================

export function normalizeHeader(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\r\n]+/g, ' ') // Replace line breaks (\n, \r) with space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim()
    .toUpperCase();
}

export function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function cleanNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const s = String(val).trim();
  if (s.startsWith('#') || s === '-' || s.toUpperCase() === 'N/A' || s.toUpperCase() === 'ISENTO') {
    return 0; // Ignore #VALUE!, #N/A, #REF!
  }
  // Handle Brazilian & US number formats safely
  const cleaned = s.replace(/[R$\sUSD€¥%a-zA-Z]/gi, '').trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // e.g. 1.234,56 vs 1,234.56
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  }
  if (cleaned.includes(',')) return parseFloat(cleaned.replace(',', '.')) || 0;
  return parseFloat(cleaned) || 0;
}

export function parseExcelDate(val: any): Date | null {
  if (val === null || val === undefined || val === '' || String(val).trim().startsWith('#')) {
    return null;
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && val > 20000 && val < 90000) {
    // Excel serial date to JS Date
    const utcDays = Math.floor(val - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const str = String(val).trim();
  if (!str || str === '-' || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'AGUARDANDO') {
    return null;
  }
  // Check numeric string that is an Excel serial number (e.g. "46050")
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 20000 && num < 90000) {
      const utcDays = Math.floor(num - 25569);
      return new Date(utcDays * 86400 * 1000);
    }
  }
  // Match YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.substring(0, 10).split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  // Match DD/MM/YYYY or DD/MM/YY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = dmy[3].length === 2 ? Number(`20${dmy[3]}`) : Number(dmy[3]);
    return new Date(Date.UTC(y, m - 1, d));
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateISO(val: any, fallback = ''): string {
  const d = parseExcelDate(val);
  if (!d) return fallback;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function diffDaysBetween(dateEndVal: any, dateStartVal: any, fallback = 0): number {
  const dEnd = parseExcelDate(dateEndVal);
  const dStart = parseExcelDate(dateStartVal);
  if (!dEnd || !dStart) return fallback;
  const diff = Math.round((dEnd.getTime() - dStart.getTime()) / (86400 * 1000));
  return diff >= 0 ? diff : fallback;
}

// ============================================================================
// B. FLEXIBLE DICTIONARY LOOKUP BY NORMALIZED HEADER
// ============================================================================

function getCell(rowDict: Record<string, any>, candidates: string[], fallback: any = ''): any {
  // 1. Exact match on normalizeHeader
  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    if (
      rowDict[normCand] !== undefined &&
      rowDict[normCand] !== null &&
      String(rowDict[normCand]).trim() !== ''
    ) {
      return rowDict[normCand];
    }
  }
  // 2. Accent-stripped match
  const accentStrippedMap: Record<string, any> = {};
  for (const k of Object.keys(rowDict)) {
    accentStrippedMap[stripAccents(k)] = rowDict[k];
  }
  for (const cand of candidates) {
    const strippedCand = stripAccents(normalizeHeader(cand));
    if (
      accentStrippedMap[strippedCand] !== undefined &&
      accentStrippedMap[strippedCand] !== null &&
      String(accentStrippedMap[strippedCand]).trim() !== ''
    ) {
      return accentStrippedMap[strippedCand];
    }
    // 3. Partial substring match
    const partialKey = Object.keys(accentStrippedMap).find((k) => k.includes(strippedCand));
    if (
      partialKey &&
      accentStrippedMap[partialKey] !== undefined &&
      String(accentStrippedMap[partialKey]).trim() !== ''
    ) {
      return accentStrippedMap[partialKey];
    }
  }
  return fallback;
}

// ============================================================================
// C. AUTO-FIND HEADER ROW & EXTRACT DICTIONARY ROWS
// ============================================================================

function extractRowsFromSheet(sheet: XLSX.WorkSheet): Record<string, any>[] {
  const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!matrix || matrix.length === 0) return [];

  // Scan the first 15 rows to find the row index headerRowIdx that contains
  // "PROCESSO" and ("EXPORTADOR" or "FORNECEDOR" or "OC" or "PROJETO")
  let headerRowIdx = -1;
  const maxScan = Math.min(15, matrix.length);

  for (let r = 0; r < maxScan; r++) {
    const rowCells = (matrix[r] || []).map((c) => stripAccents(normalizeHeader(c)));
    const hasProcesso = rowCells.some((c) => c === 'PROCESSO' || c.includes('PROCESSO'));
    const hasPartnerOrOC = rowCells.some(
      (c) =>
        c.includes('EXPORTADOR') ||
        c.includes('FORNECEDOR') ||
        c === 'OC' ||
        c.includes('PROJETO') ||
        c.includes('FATURA')
    );
    if (hasProcesso && hasPartnerOrOC) {
      headerRowIdx = r;
      break;
    }
  }

  // Fallback if sheet only has OC + FORNECEDOR
  if (headerRowIdx === -1) {
    for (let r = 0; r < maxScan; r++) {
      const rowCells = (matrix[r] || []).map((c) => stripAccents(normalizeHeader(c)));
      if (rowCells.some((c) => c === 'OC' || c.includes('FORNECEDOR') || c.includes('PROJETO'))) {
        headerRowIdx = r;
        break;
      }
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const rawHeaders = matrix[headerRowIdx] || [];
  const normalizedHeaders = rawHeaders.map((h, i) => {
    const norm = normalizeHeader(h);
    return norm || `COL_${i}`;
  });

  const rows: Record<string, any>[] = [];
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const rowArr = matrix[r];
    if (!rowArr || rowArr.length === 0) continue;

    const dict: Record<string, any> = {};
    for (let c = 0; c < normalizedHeaders.length; c++) {
      const key = normalizedHeaders[c];
      dict[key] = rowArr[c] !== undefined ? rowArr[c] : '';
    }

    const procVal = String(getCell(dict, ['PROCESSO'], '')).trim();
    const ocVal = String(getCell(dict, ['OC', 'PO', 'PEDIDO'], '')).trim();
    const expVal = String(getCell(dict, ['EXPORTADOR', 'FORNECEDOR'], '')).trim();

    // Skip completely empty rows or repeated header banners
    if (!procVal && !ocVal && !expVal) continue;
    if (
      procVal.toUpperCase() === 'PROCESSO' ||
      procVal.toUpperCase().includes('ACOMPANHAMENTO')
    ) {
      continue;
    }

    rows.push(dict);
  }

  return rows;
}

// ============================================================================
// D. STATUS, REGIME & RISK NORMALIZATION
// ============================================================================

export function normalizeStatus(rawStatus: string, entregaMFX: string, desembaraco: string, chegada: string, embarque: string): string {
  const s = stripAccents(String(rawStatus || '').toUpperCase().trim());
  if (s.includes('PARADO') || s.includes('AGUARDANDO DRAWBACK') || s.includes('AG. DRAWBACK') || s.includes('BLOQUEADO')) {
    return 'Parado Ag. Drawback';
  }
  if (s.includes('ENTREGUE') || s.includes('CONCLUIDO') || s.includes('FINALIZADO') || Boolean(entregaMFX)) {
    return 'Entregue MFX';
  }
  if (s.includes('DESEMBARACADO') || s.includes('LIBERADO') || Boolean(desembaraco)) {
    return 'Desembaraçado';
  }
  if (
    s.includes('PORTO') ||
    s.includes('AEROPORTO') ||
    s.includes('AGUARDANDO REGISTRO') ||
    s.includes('EM DESEMBARACO') ||
    s.includes('REGISTRADO') ||
    s.includes('PARAMETRIZADO') ||
    Boolean(chegada)
  ) {
    return 'No Porto/Aeroporto';
  }
  if (s.includes('TRANSITO') || s.includes('EMBARCADO') || Boolean(embarque)) {
    return 'Em Trânsito';
  }
  if (s.includes('PRODUCAO') || s.includes('FABRICACAO')) {
    return 'Em Produção Fornecedor';
  }
  if (s.includes('EMBARQUE') || s.includes('PRONTA') || s.includes('COLETADO') || s.includes('AG.')) {
    return 'Ag. Embarque';
  }
  return rawStatus ? String(rawStatus).trim() : 'Em Trânsito';
}

export function normalizeRegime(rawBeneficio: string): string {
  const b = stripAccents(String(rawBeneficio || '').toUpperCase().trim());
  if (b.includes('INTEGRAL') || b.includes('NORMAL') || b === 'NAO' || b === 'N/A') {
    return 'Recolhimento Integral';
  }
  if (b.includes('EX-TARIFARIO') || b.includes('EX TARIFARIO')) {
    return 'Ex-Tarifário';
  }
  return 'Drawback Suspensão';
}

export function normalizeCanal(rawCanal: string): string {
  const c = stripAccents(String(rawCanal || '').toUpperCase().trim());
  if (c.includes('VERDE')) return 'Verde';
  if (c.includes('AMARELO')) return 'Amarelo';
  if (c.includes('VERMELHO')) return 'Vermelho';
  if (c.includes('CINZA')) return 'Vermelho';
  return 'Pendente Registro';
}

export function computeProcessRisk(p: Partial<ImportProcess>): { riskLevel: RiskLevel; riskReason: string } {
  if (p.status === 'Entregue MFX' || Boolean(p.dataEntregaMFX)) {
    if ((p.impostosPagosIndevidamenteBRL || 0) > 0) {
      return {
        riskLevel: 'medium',
        riskReason: `Entregue MFX (${p.dataEntregaMFX || 'Concluído'}) · R$ ${(p.impostosPagosIndevidamenteBRL || 0).toLocaleString('pt-BR')} em Recolhimento Integral`,
      };
    }
    return {
      riskLevel: 'none',
      riskReason: `Concluído / Entregue na Planta MFX (${p.dataEntregaMFX || 'OK'})`,
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
      riskReason: `Free Time expirando (${p.freeTimeDiasRestantes}d restantes) em ${p.portoAeroportoDestino}`,
    };
  }
  if (p.modal === 'AÉREO' && p.alertaPreAlertaAWB) {
    return {
      riskLevel: 'high',
      riskReason: `Aéreo (${p.portoAeroportoDestino}) sem Pré-Alerta AWB confirmado p/ Ômega`,
    };
  }
  if ((p.impostosPagosIndevidamenteBRL || 0) > 0) {
    return {
      riskLevel: 'high',
      riskReason: `Alerta Fiscal: R$ ${(p.impostosPagosIndevidamenteBRL || 0).toLocaleString('pt-BR')} sob Recolhimento Integral`,
    };
  }
  if (p.canal === 'Vermelho' || p.canal === 'Amarelo' || (p.atrasoEtaDias || 0) > 2) {
    return {
      riskLevel: 'medium',
      riskReason:
        p.canal === 'Vermelho' || p.canal === 'Amarelo'
          ? `Parametrizado em Canal ${p.canal} (${p.portoAeroportoDestino})`
          : `Atraso de ${p.atrasoEtaDias} dias na Chegada vs. Previsão`,
    };
  }
  return {
    riskLevel: 'low',
    riskReason: `Operação no prazo · ${p.beneficioRaw || p.regime} · Saving R$ ${(p.savingFreteBRL || 0).toLocaleString('pt-BR')}`,
  };
}

// ============================================================================
// E. MAIN WORKBOOK PARSER (FUP IMPORTAÇÃO BI_2.xlsx)
// ============================================================================

export function parseMfxExcelFile(
  buffer: ArrayBuffer,
  ptax: PtaxRates
): {
  processos: ImportProcess[];
  pedidosForecast: PedidoForecastRow[];
  pedidosCount: number;
  sheetNames: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = wb.SheetNames;

  // Locate PROCESSOS and PEDIDOS sheets
  const processosSheetName =
    sheetNames.find((s) => /PROCESSO/i.test(stripAccents(s))) || sheetNames[0];
  const pedidosSheetName = sheetNames.find((s) => /PEDIDO/i.test(stripAccents(s)));

  const rawProcessos = processosSheetName ? extractRowsFromSheet(wb.Sheets[processosSheetName]) : [];
  const rawPedidos = pedidosSheetName ? extractRowsFromSheet(wb.Sheets[pedidosSheetName]) : [];

  // 1. Parse PEDIDOS sheet rows
  const pedidosForecast: PedidoForecastRow[] = [];
  const pedidosByProc: Record<string, PedidoItem[]> = {};
  const pedidosByOC: Record<string, PedidoItem[]> = {};

  rawPedidos.forEach((row, idx) => {
    const projeto = String(getCell(row, ['PROJETO'], 'PETROBRAS')).trim().toUpperCase() || 'PETROBRAS';
    const processo = String(getCell(row, ['PROCESSO'], '')).trim();
    const fornecedor = String(getCell(row, ['FORNECEDOR', 'EXPORTADOR'], 'NOV')).trim().toUpperCase() || 'NOV';
    const oc = String(getCell(row, ['OC', 'PO', 'PEDIDO'], `OC-${idx + 1}`)).trim();
    const emissaoOC = formatDateISO(getCell(row, ['EMISSÃO OC', 'EMISSAO OC', 'DATA OC', 'DATA PO'], ''), '2026-09-01');
    const incoterm = String(getCell(row, ['INCOTERM'], 'FCA')).trim().toUpperCase() || 'FCA';
    const valor = cleanNumber(getCell(row, ['VALOR', 'VALOR TOTAL', 'VMLE'], 0));
    const moedaRaw = String(getCell(row, ['MOEDA'], 'USD')).trim().toUpperCase();
    const moeda: CurrencyCode = moedaRaw.includes('EUR')
      ? 'EUR'
      : moedaRaw.includes('CNY') || moedaRaw.includes('RMB')
      ? 'CNY'
      : 'USD';
    const prontidaoCarga = formatDateISO(
      getCell(row, ['PRONTIDÃO DA CARGA', 'PRONTIDAO DA CARGA', 'PRONTIDAO'], ''),
      '2026-10-15'
    );
    const status = String(getCell(row, ['STATUS', 'SITUACAO'], 'AGUARDANDO EMBARQUE')).trim();

    pedidosForecast.push({
      id: `PED-ROW-${idx + 1}`,
      projeto,
      processo: processo || `PO-${oc}`,
      fornecedor,
      oc,
      emissaoOC,
      incoterm,
      valor,
      moeda,
      prontidaoCarga,
      status,
    });

    const item: PedidoItem = {
      id: `PED-IT-${idx + 1}`,
      oc,
      processoId: processo || `PO-${oc}`,
      codigoItem: `OC-${oc}`,
      descricao: `Pedido ${oc} — ${fornecedor} (${projeto})`,
      ncm: String(getCell(row, ['NCM'], '8481.80.99')),
      quantidade: cleanNumber(getCell(row, ['QTD', 'QUANTIDADE'], 1)) || 1,
      qtdAutorizadaAC: 100,
      unidade: 'LOTE',
      valorUnitarioMoeda: valor,
      valorTotalMoeda: valor,
      moeda,
      fornecedor,
      projeto,
      dataEmissaoPO: emissaoOC,
      previsaoProntidaoCarga: prontidaoCarga,
      statusItem: status,
      alertaLaudoTecnico: 'OK',
    };

    if (processo) {
      if (!pedidosByProc[processo]) pedidosByProc[processo] = [];
      pedidosByProc[processo].push(item);
    }
    if (oc) {
      if (!pedidosByOC[oc]) pedidosByOC[oc] = [];
      pedidosByOC[oc].push(item);
    }
  });

  // 2. Parse PROCESSOS sheet (36 columns)
  const seenProcessIds = new Set<string>();
  const parsedProcessos: ImportProcess[] = [];

  rawProcessos.forEach((row, idx) => {
    const projeto = String(getCell(row, ['PROJETO'], 'PETROBRAS')).trim().toUpperCase() || 'PETROBRAS';
    const id = String(
      getCell(row, ['PROCESSO'], `IMP-${String(idx + 1).padStart(3, '0')}/26`)
    ).trim();
    seenProcessIds.add(id);

    const fornecedor = String(
      getCell(row, ['EXPORTADOR', 'FORNECEDOR'], 'NOV')
    )
      .trim()
      .toUpperCase();
    const fatura = String(getCell(row, ['FATURA', 'INVOICE', 'CI'], `CI-${id}`)).trim();
    const oc = String(getCell(row, ['OC', 'PO'], `OC-${idx + 1}`)).trim();

    const modalRaw = stripAccents(String(getCell(row, ['MODAL'], 'MARÍTIMO')).toUpperCase());
    const modal: ModalType = modalRaw.includes('AER') || modalRaw.includes('AIR') ? 'AÉREO' : 'MARÍTIMO';

    const incoterm = String(getCell(row, ['INCOTERM'], 'FCA')).trim().toUpperCase() || 'FCA';

    const condPagRaw = String(getCell(row, ['COND. PAGAMENTO', 'COND PAGAMENTO'], '90')).trim();
    const condNum = cleanNumber(condPagRaw);
    const condicaoPagamento =
      condNum > 0 ? `${condNum} DDL` : condPagRaw ? condPagRaw.toUpperCase() : '90 DDL';

    const moedaRaw = String(getCell(row, ['MOEDA'], 'USD')).trim().toUpperCase();
    const moeda: CurrencyCode = moedaRaw.includes('EUR')
      ? 'EUR'
      : moedaRaw.includes('CNY') || moedaRaw.includes('RMB')
      ? 'CNY'
      : 'USD';
    const taxaPtaxDI = ptax[moeda] || 5.7842;

    const rawVmle = cleanNumber(getCell(row, ['VMLE', 'VALOR FOB'], 0));
    const rawVmld = cleanNumber(getCell(row, ['VMLD', 'VALOR CIF'], 0));

    // Determine whether VMLE/VMLD in the sheet are in foreign currency or BRL
    const valorFOBMoeda = rawVmle > 0 ? rawVmle : rawVmld > 0 ? rawVmld * 0.92 : 85000;
    const valorVMLDMoeda = rawVmld > 0 ? rawVmld : valorFOBMoeda * 1.06;

    const cotacaoFreteBRL = cleanNumber(
      getCell(row, ['COTAÇÃO FRETE R$', 'COTACAO FRETE R$', 'COTACAO FRETE'], 0)
    );
    const fretePagoBRL = cleanNumber(
      getCell(row, ['FRETE PAGO R$', 'FRETE PAGO'], 0)
    );

    // SAVING FRETE: Calculate as cleanNumber(row['COTAÇÃO FRETE R$']) - cleanNumber(row['FRETE PAGO R$'])
    // whenever the Excel cell has #VALUE! or is blank
    const rawSavingCell = getCell(row, ['SAVING FRETE', 'SAVING'], '');
    let savingFreteBRL = 0;
    if (
      rawSavingCell === '' ||
      rawSavingCell === null ||
      String(rawSavingCell).trim().startsWith('#')
    ) {
      savingFreteBRL = cotacaoFreteBRL > 0 && fretePagoBRL > 0 ? cotacaoFreteBRL - fretePagoBRL : 0;
    } else {
      savingFreteBRL = cleanNumber(rawSavingCell);
      if (savingFreteBRL === 0 && cotacaoFreteBRL > 0 && fretePagoBRL > 0) {
        savingFreteBRL = cotacaoFreteBRL - fretePagoBRL;
      }
    }
    const savingFretePercent =
      cotacaoFreteBRL > 0 ? (savingFreteBRL / cotacaoFreteBRL) * 100 : 0;

    const vmleBRL = valorFOBMoeda * taxaPtaxDI;
    const vmldBRL =
      valorVMLDMoeda * taxaPtaxDI > 0
        ? valorVMLDMoeda * taxaPtaxDI
        : vmleBRL + fretePagoBRL;
    const freteInternacionalMoeda =
      fretePagoBRL > 0 ? fretePagoBRL / taxaPtaxDI : Math.max(0, valorVMLDMoeda - valorFOBMoeda);

    const agenteCarga =
      String(getCell(row, ['AGENTE DE CARGA', 'AGENTE'], 'DSV')).trim().toUpperCase() || 'DSV';

    const etd = formatDateISO(getCell(row, ['EMBARQUE', 'ETD'], ''), '');
    const eta = formatDateISO(getCell(row, ['PREVISÃO CHEGADA', 'PREVISAO CHEGADA', 'ETA'], ''), '');
    const dataChegadaEfetiva = formatDateISO(getCell(row, ['CHEGADA'], ''), '');

    // TT: Transit Time in days (if #VALUE! or blank, auto-calculate as CHEGADA - EMBARQUE or PREVISÃO CHEGADA - EMBARQUE)
    const rawTT = getCell(row, ['TT', 'TRANSIT TIME'], '');
    let transitTimeDias = cleanNumber(rawTT);
    if (!transitTimeDias || String(rawTT).trim().startsWith('#')) {
      transitTimeDias = diffDaysBetween(
        dataChegadaEfetiva || eta,
        etd,
        modal === 'AÉREO' ? 4 : 24
      );
    }

    const localDesembaraco =
      String(getCell(row, ['LOCAL DESEMBARAÇO', 'LOCAL DESEMBARACO'], modal === 'AÉREO' ? 'VIRACOPOS' : 'SALVADOR'))
        .trim()
        .toUpperCase() || 'SALVADOR';

    const anuencia =
      String(getCell(row, ['ANUÊNCIA', 'ANUENCIA'], 'NÃO')).trim().toUpperCase() || 'NÃO';
    const deferimentoLI = formatDateISO(getCell(row, ['DEFERIMENTO LI'], ''), '');

    const beneficioRaw =
      String(getCell(row, ['BENEFÍCIO', 'BENEFICIO'], 'DRAWBACK')).trim().toUpperCase() ||
      'DRAWBACK';
    const regime = normalizeRegime(beneficioRaw);

    const numeroDiDuimp =
      String(getCell(row, ['DI', 'DUIMP'], '')).trim() || 'Pendente Registro';
    const dataRegistroDI = formatDateISO(getCell(row, ['DATA DO REGISTRO', 'DATA REGISTRO'], ''), '');
    const canal = normalizeCanal(String(getCell(row, ['CANAL'], '')));
    const dataDesembaraco = formatDateISO(getCell(row, ['DESEMBARAÇO', 'DESEMBARACO'], ''), '');

    // DIAS P/ LIBERAÇÃO (DESEMBARAÇO - CHEGADA)
    const rawDiasLib = getCell(row, ['DIAS P/ LIBERAÇÃO', 'DIAS P/ LIBERACAO', 'DIAS LIBERACAO'], '');
    let tempoDesembaracoDias = cleanNumber(rawDiasLib);
    if (!tempoDesembaracoDias || String(rawDiasLib).trim().startsWith('#')) {
      tempoDesembaracoDias = diffDaysBetween(
        dataDesembaraco,
        dataChegadaEfetiva || dataRegistroDI || eta,
        modal === 'AÉREO' ? 3 : 5
      );
    }

    const dataCarregamento = formatDateISO(getCell(row, ['CARREGAMENTO'], ''), '');
    const transportadoraNacional =
      String(getCell(row, ['TRANSPORTADORA'], 'RODOVIÁRIO MFX')).trim() || 'RODOVIÁRIO MFX';
    const dataEntregaMFX = formatDateISO(getCell(row, ['ENTREGA MFX', 'DATA ENTREGA MFX'], ''), '');

    // TRÂNSITO (ENTREGA MFX - CARREGAMENTO)
    const rawTransito = getCell(row, ['TRÂNSITO', 'TRANSITO'], '');
    let tempoEntregaRodoviariaDias = cleanNumber(rawTransito);
    if (!tempoEntregaRodoviariaDias || String(rawTransito).trim().startsWith('#')) {
      tempoEntregaRodoviariaDias = diffDaysBetween(dataEntregaMFX, dataCarregamento || dataDesembaraco, 2);
    }

    // LEAD TIME (ENTREGA MFX - EMBARQUE)
    const rawLeadTime = getCell(row, ['LEAD TIME'], '');
    let leadTimeTotalDias = cleanNumber(rawLeadTime);
    if (!leadTimeTotalDias || String(rawLeadTime).trim().startsWith('#')) {
      leadTimeTotalDias =
        diffDaysBetween(dataEntregaMFX, etd, 0) ||
        transitTimeDias + tempoDesembaracoDias + tempoEntregaRodoviariaDias;
    }

    const statusRawExcel = String(getCell(row, ['STATUS', 'SITUACAO'], '')).trim();
    const status = normalizeStatus(
      statusRawExcel,
      dataEntregaMFX,
      dataDesembaraco,
      dataChegadaEfetiva,
      etd
    );

    const dataVencimentoInvoice = formatDateISO(
      getCell(row, ['DATA DE VENCIMENTO', 'VENCIMENTO'], ''),
      eta || '2026-12-15'
    );

    // Taxes calculation (BRL)
    const iiBRL = vmldBRL * 0.14;
    const ipiBRL = (vmldBRL + iiBRL) * 0.05;
    const pisBRL = vmldBRL * 0.021;
    const cofinsBRL = vmldBRL * 0.0965;
    const icmsBRL = vmldBRL * 0.22;
    const totalImpostosEstimadosBRL = iiBRL + ipiBRL + pisBRL + cofinsBRL + icmsBRL;

    const impostosSuspensosDrawbackBRL =
      regime === 'Drawback Suspensão' || regime === 'Ex-Tarifário' ? totalImpostosEstimadosBRL : 0;
    const impostosPagosIndevidamenteBRL =
      regime === 'Recolhimento Integral' && projeto !== 'ESTOQUE' ? totalImpostosEstimadosBRL : 0;

    // Assign AC based on project
    const defaultAC =
      regime === 'Recolhimento Integral'
        ? 'SEM AC (Recolhimento)'
        : regime === 'Ex-Tarifário'
        ? 'EX-TARIFÁRIO'
        : projeto === 'PRIO'
        ? 'AC-2025/004115-2'
        : 'AC-2025/001482-9';

    // Link items from PEDIDOS by PROCESSO or OC
    const matchingPedidos =
      pedidosByProc[id] ||
      pedidosByOC[oc] ||
      Object.entries(pedidosByOC)
        .filter(([k]) => oc.includes(k) || k.includes(oc))
        .flatMap(([, v]) => v);

    const itens: PedidoItem[] =
      matchingPedidos.length > 0
        ? matchingPedidos
        : [
            {
              id: `IT-${id}`,
              oc,
              processoId: id,
              codigoItem: `OC-${oc}`,
              descricao: `Insumos & Equipamentos Importados — ${fornecedor} (${fatura || id})`,
              ncm: '8481.80.99',
              quantidade: 1,
              qtdAutorizadaAC: 100,
              unidade: 'LOTE',
              valorUnitarioMoeda: valorFOBMoeda,
              valorTotalMoeda: valorFOBMoeda,
              moeda,
              fornecedor,
              projeto,
              dataEmissaoPO: etd || '2026-08-15',
              previsaoProntidaoCarga: etd || '2026-09-15',
              statusItem: statusRawExcel || status,
              alertaLaudoTecnico: 'OK',
              acSugerido: defaultAC,
            },
          ];

    const cargaParadaDrawback =
      status === 'Parado Ag. Drawback' ||
      stripAccents(statusRawExcel.toUpperCase()).includes('DRAWBACK') ||
      (Boolean(dataChegadaEfetiva) && !dataRegistroDI && !dataEntregaMFX && regime === 'Drawback Suspensão');

    const alertaPreAlertaAWB =
      modal === 'AÉREO' && !dataEntregaMFX && (!numeroDiDuimp || numeroDiDuimp === 'Pendente Registro');

    const partialProc: ImportProcess = {
      id,
      oc,
      commercialInvoice: fatura || 'S/ FATURA',
      fornecedor,
      paisOrigem:
        fornecedor === 'KERUI'
          ? 'China'
          : fornecedor === 'BSP'
          ? 'Alemanha'
          : fornecedor === 'MID SUN'
          ? 'Canadá'
          : 'EUA',
      projeto,
      status: cargaParadaDrawback && status !== 'Entregue MFX' ? 'Parado Ag. Drawback' : status,
      statusRawExcel: statusRawExcel || status,
      modal,
      incoterm,
      regime,
      beneficioRaw,
      atoConcessorio: defaultAC,
      despachante: 'ÔMEGA',
      agenteCarga,
      armadorCiaAerea: modal === 'AÉREO' ? 'Cia Aérea Internacional' : 'Armador Marítimo',
      blAwb: numeroDiDuimp !== 'Pendente Registro' ? `DI ${numeroDiDuimp}` : `REF-${id}`,
      numeroDiDuimp,
      canal,
      liAnuente: anuencia,
      deferimentoLI: deferimentoLI || undefined,
      portoAeroportoDestino: localDesembaraco,
      dataPO: itens[0]?.dataEmissaoPO || etd || '2026-08-01',
      dataProntidaoCarga: itens[0]?.previsaoProntidaoCarga || etd || '2026-09-01',
      etd: etd || 'Aguardando',
      etaOriginalPO: eta || 'Aguardando',
      eta: eta || dataChegadaEfetiva || 'Aguardando',
      dataChegadaEfetiva: dataChegadaEfetiva || undefined,
      dataRegistroDI: dataRegistroDI || undefined,
      dataDesembaraco: dataDesembaraco || undefined,
      dataCarregamento: dataCarregamento || undefined,
      prazoEntregaMFX: dataEntregaMFX || eta || 'A Confirmar',
      dataEntregaMFX: dataEntregaMFX || undefined,
      transitTimeDias,
      tempoDesembaracoDias,
      tempoEntregaRodoviariaDias,
      leadTimeTotalDias,
      freeTimeTotalDias: modal === 'AÉREO' ? 5 : 14,
      freeTimeDiasRestantes: dataEntregaMFX ? 10 : cargaParadaDrawback ? 2 : 7,
      cargaParadaDrawback: cargaParadaDrawback && !dataEntregaMFX,
      motivoParadaDrawback:
        cargaParadaDrawback && !dataEntregaMFX
          ? `Aguardando liberação / vinculação de Ato Concessório (${defaultAC}) em ${localDesembaraco}`
          : undefined,
      diasParadoPortoAeroporto: cargaParadaDrawback && !dataEntregaMFX ? Math.max(4, tempoDesembaracoDias) : 0,
      alertaPreAlertaAWB,
      atrasoEtaDias: diffDaysBetween(dataChegadaEfetiva, eta, 0),
      moeda,
      taxaPtaxDI,
      condicaoPagamento,
      dataVencimentoInvoice,
      statusPagamentoInvoice: dataEntregaMFX ? 'Pago' : 'A Vencer',
      valorFOBMoeda,
      valorVMLDMoeda,
      freteInternacionalMoeda,
      seguroMoeda: 0,
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
      despesasAduaneirasBRL: Math.round(vmldBRL * 0.015),
      armazenagemAcumuladaBRL:
        cargaParadaDrawback && !dataEntregaMFX ? 24500 : Math.round(vmldBRL * 0.008),
      custoDiarioArmazenagemBRL: cargaParadaDrawback && !dataEntregaMFX ? 3100 : 0,
      cotacaoFreteBRL,
      fretePagoBRL,
      savingFreteBRL,
      savingFretePercent,
      transportadoraNacional,
      freteRodoviarioBRL: modal === 'MARÍTIMO' ? 11500 : 3400,
      pesoBrutoKg: modal === 'MARÍTIMO' ? 28500 : 1450,
      cubagemCbm: modal === 'MARÍTIMO' ? 42 : 5.5,
      qtdContainersFCL: modal === 'MARÍTIMO' ? 1 : 0,
      itens,
      riskLevel: 'low',
      riskReason: '',
    };

    const risk = computeProcessRisk(partialProc);
    partialProc.riskLevel = risk.riskLevel;
    partialProc.riskReason = risk.riskReason;

    parsedProcessos.push(partialProc);
  });

  // 3. Also merge any unshipped POs from PEDIDOS that do not exist yet in PROCESSOS
  pedidosForecast.forEach((ped, idx) => {
    const hasMatchInProcessos = parsedProcessos.some(
      (p) =>
        (ped.processo && p.id === ped.processo) ||
        (ped.oc && (p.oc === ped.oc || p.oc.includes(ped.oc)))
    );
    if (!hasMatchInProcessos && ped.valor > 0) {
      const id = ped.processo && !seenProcessIds.has(ped.processo)
        ? ped.processo
        : `PO-${ped.oc || idx + 1}`;
      seenProcessIds.add(id);

      const taxa = ptax[ped.moeda] || 5.7842;
      const vmleBRL = ped.valor * taxa;
      const vmldBRL = vmleBRL * 1.05;
      const statusNorm = normalizeStatus(ped.status, '', '', '', '');

      const poProc: ImportProcess = {
        id,
        oc: ped.oc,
        commercialInvoice: 'PO EM ABERTO',
        fornecedor: ped.fornecedor,
        paisOrigem: ped.fornecedor === 'KERUI' ? 'China' : ped.fornecedor === 'BSP' ? 'Alemanha' : 'EUA',
        projeto: ped.projeto,
        status: statusNorm === 'Em Trânsito' ? 'Em Produção Fornecedor' : statusNorm,
        statusRawExcel: ped.status,
        modal: 'MARÍTIMO',
        incoterm: ped.incoterm,
        regime: 'Drawback Suspensão',
        beneficioRaw: 'DRAWBACK',
        atoConcessorio: ped.projeto === 'PRIO' ? 'AC-2025/004115-2' : 'AC-2025/001482-9',
        despachante: 'ÔMEGA',
        agenteCarga: 'DSV',
        armadorCiaAerea: 'A Definir',
        blAwb: 'Ag. Embarque',
        numeroDiDuimp: 'Não Embarcado',
        canal: 'Pendente Registro',
        liAnuente: 'NÃO',
        portoAeroportoDestino: 'SALVADOR',
        dataPO: ped.emissaoOC,
        dataProntidaoCarga: ped.prontidaoCarga,
        etd: ped.prontidaoCarga,
        etaOriginalPO: ped.prontidaoCarga,
        eta: ped.prontidaoCarga,
        prazoEntregaMFX: ped.prontidaoCarga,
        transitTimeDias: 22,
        tempoDesembaracoDias: 4,
        tempoEntregaRodoviariaDias: 2,
        leadTimeTotalDias: 28,
        freeTimeTotalDias: 14,
        freeTimeDiasRestantes: 14,
        cargaParadaDrawback: false,
        alertaPreAlertaAWB: false,
        atrasoEtaDias: 0,
        moeda: ped.moeda,
        taxaPtaxDI: taxa,
        condicaoPagamento: '90 DDL',
        dataVencimentoInvoice: ped.prontidaoCarga || '2026-12-30',
        statusPagamentoInvoice: 'A Vencer',
        valorFOBMoeda: ped.valor,
        valorVMLDMoeda: ped.valor * 1.05,
        freteInternacionalMoeda: ped.valor * 0.05,
        seguroMoeda: 0,
        vmleBRL,
        vmldBRL,
        iiBRL: vmldBRL * 0.14,
        ipiBRL: vmldBRL * 0.057,
        pisBRL: vmldBRL * 0.021,
        cofinsBRL: vmldBRL * 0.0965,
        icmsBRL: vmldBRL * 0.22,
        totalImpostosEstimadosBRL: vmldBRL * 0.5345,
        impostosSuspensosDrawbackBRL: vmldBRL * 0.5345,
        impostosPagosIndevidamenteBRL: 0,
        despesasAduaneirasBRL: 15000,
        armazenagemAcumuladaBRL: 0,
        custoDiarioArmazenagemBRL: 0,
        cotacaoFreteBRL: 0,
        fretePagoBRL: 0,
        savingFreteBRL: 0,
        savingFretePercent: 0,
        transportadoraNacional: 'A Definir',
        freteRodoviarioBRL: 0,
        pesoBrutoKg: 15000,
        cubagemCbm: 25,
        qtdContainersFCL: 1,
        itens: [
          {
            id: `PED-ONLY-${idx}`,
            oc: ped.oc,
            processoId: id,
            codigoItem: `OC-${ped.oc}`,
            descricao: `Forecast de Pedido (Aba PEDIDOS) — ${ped.fornecedor}`,
            ncm: '8481.80.99',
            quantidade: 1,
            unidade: 'LOTE',
            valorUnitarioMoeda: ped.valor,
            valorTotalMoeda: ped.valor,
            moeda: ped.moeda,
            fornecedor: ped.fornecedor,
            projeto: ped.projeto,
            dataEmissaoPO: ped.emissaoOC,
            previsaoProntidaoCarga: ped.prontidaoCarga,
            statusItem: ped.status,
            alertaLaudoTecnico: 'OK',
          },
        ],
        riskLevel: 'low',
        riskReason: `Forecast PO (${ped.status}) · Prontidão da Carga: ${ped.prontidaoCarga}`,
      };
      parsedProcessos.push(poProc);
    }
  });

  return {
    processos: parsedProcessos,
    pedidosForecast,
    pedidosCount: rawPedidos.length,
    sheetNames,
  };
}

// ============================================================================
// F. EXPORT TO EXCEL IN EXACT FUP IMPORTAÇÃO BI_2.xlsx STRUCTURE
// ============================================================================

export function exportMfxToExcel(
  processos: ImportProcess[],
  atosConcessorios: AtoConcessorio[],
  pedidosForecast: PedidoForecastRow[] = [],
  filename = 'FUP_IMPORTACAO_BI_2_MFX_EXPORT.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet PROCESSOS (Matching the 36 columns + Title Banner on Row 1)
  const headersProcessos = [
    'PROJETO',
    'PROCESSO',
    'EXPORTADOR',
    'FATURA',
    'DATA DE VENCIMENTO',
    'OC',
    'MODAL',
    'INCOTERM',
    'COND. PAGAMENTO',
    'MOEDA',
    'VMLE',
    'VMLD',
    'COTAÇÃO FRETE R$',
    'FRETE PAGO R$',
    'SAVING FRETE',
    'AGENTE DE CARGA',
    'EMBARQUE',
    'PREVISÃO CHEGADA',
    'CHEGADA',
    'TT',
    'LOCAL DESEMBARAÇO',
    'ANUÊNCIA',
    'DEFERIMENTO LI',
    'BENEFÍCIO',
    'DI',
    'DATA DO REGISTRO',
    'CANAL',
    'DESEMBARAÇO',
    'DIAS P/ LIBERAÇÃO',
    'CARREGAMENTO',
    'TRANSPORTADORA',
    'ENTREGA MFX',
    'TRÂNSITO',
    'LEAD TIME',
    'STATUS',
    'ATO CONCESSÓRIO',
  ];

  const dataRowsProcessos = processos.map((p) => [
    p.projeto,
    p.id,
    p.fornecedor,
    p.commercialInvoice,
    p.dataVencimentoInvoice,
    p.oc,
    p.modal,
    p.incoterm,
    p.condicaoPagamento,
    p.moeda,
    p.valorFOBMoeda,
    p.valorVMLDMoeda ?? p.valorFOBMoeda,
    Math.round(p.cotacaoFreteBRL),
    Math.round(p.fretePagoBRL),
    Math.round(p.savingFreteBRL),
    p.agenteCarga,
    p.etd,
    p.eta,
    p.dataChegadaEfetiva || '',
    p.transitTimeDias,
    p.portoAeroportoDestino,
    p.liAnuente || 'NÃO',
    p.deferimentoLI || '',
    p.beneficioRaw || p.regime,
    p.numeroDiDuimp,
    p.dataRegistroDI || '',
    p.canal.toUpperCase(),
    p.dataDesembaraco || '',
    p.tempoDesembaracoDias,
    p.dataCarregamento || '',
    p.transportadoraNacional,
    p.dataEntregaMFX || '',
    p.tempoEntregaRodoviariaDias,
    p.leadTimeTotalDias ?? p.transitTimeDias + p.tempoDesembaracoDias + p.tempoEntregaRodoviariaDias,
    p.statusRawExcel || p.status,
    p.atoConcessorio,
  ]);

  const wsProcessos = XLSX.utils.aoa_to_sheet([
    ['ACOMPANHAMENTO DOS PROCESSOS DE IMPORTAÇÃO — MFX COMEX'],
    headersProcessos,
    ...dataRowsProcessos,
  ]);
  XLSX.utils.book_append_sheet(wb, wsProcessos, 'PROCESSOS');

  // 2. Sheet PEDIDOS
  const headersPedidos = [
    'PROJETO',
    'PROCESSO',
    'FORNECEDOR',
    'OC',
    'EMISSÃO OC',
    'INCOTERM',
    'VALOR',
    'MOEDA',
    'PRONTIDÃO DA CARGA',
    'STATUS',
  ];

  const rowsPedidos =
    pedidosForecast.length > 0
      ? pedidosForecast.map((pf) => [
          pf.projeto,
          pf.processo,
          pf.fornecedor,
          pf.oc,
          pf.emissaoOC,
          pf.incoterm,
          pf.valor,
          pf.moeda,
          pf.prontidaoCarga,
          pf.status,
        ])
      : processos.map((p) => [
          p.projeto,
          p.id,
          p.fornecedor,
          p.oc,
          p.dataPO,
          p.incoterm,
          p.valorFOBMoeda,
          p.moeda,
          p.dataProntidaoCarga,
          p.statusRawExcel || p.status,
        ]);

  const wsPedidos = XLSX.utils.aoa_to_sheet([
    ['FORECAST DE PEDIDOS DE IMPORTAÇÃO (POs / OCs) — MFX COMEX'],
    headersPedidos,
    ...rowsPedidos,
  ]);
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
