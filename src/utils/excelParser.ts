import * as XLSX from 'xlsx';
import {
  ImportProcess,
  PedidoItem,
  PedidoForecastRow,
  MfxRawItemRow,
  AtoConcessorio,
  PtaxRates,
  RiskLevel,
  ModalType,
  CurrencyCode,
} from '../types/mfx';

// ============================================================================
// A. HEADER NORMALIZATION, CURRENCY DETECTION, CLEAN NUMBER & EXCEL DATE HELPERS
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
  if (
    s.startsWith('#') ||
    s === '-' ||
    s.toUpperCase() === 'N/A' ||
    s.toUpperCase() === 'ISENTO' ||
    s.toUpperCase() === 'AGUARDANDO'
  ) {
    return 0; // Ignore #VALUE!, #N/A, #REF!
  }
  // Remove currency symbols and letters, keeping digits, dots, commas, and minus sign
  const cleaned = s.replace(/[R$\sUSD€¥%a-zA-Z]/gi, '').trim();
  if (!cleaned) return 0;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // e.g. 1.081,41 (BR/EU) vs 1,081.41 (US)
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else {
      return parseFloat(cleaned.replace(/,/g, '')) || 0;
    }
  }
  if (cleaned.includes(',')) return parseFloat(cleaned.replace(',', '.')) || 0;
  return parseFloat(cleaned) || 0;
}

export function detectCurrencyAndCleanValue(
  rawVal: any,
  formattedStr?: any
): { value: number; currency: CurrencyCode | null } {
  const s = String(formattedStr || rawVal || '').trim();
  let currency: CurrencyCode | null = null;
  if (s.includes('€') || /\bEUR\b/i.test(s)) currency = 'EUR';
  else if (s.includes('R$') || /\bBRL\b/i.test(s)) currency = 'BRL';
  else if (s.includes('¥') || /\bCNY\b|\bRMB\b/i.test(s)) currency = 'CNY';
  else if (s.includes('$') || /\bUSD\b|\bUS\$\b/i.test(s)) currency = 'USD';

  const value = cleanNumber(typeof rawVal === 'number' ? rawVal : s);
  return { value, currency };
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
  if (
    !str ||
    str === '-' ||
    str.toUpperCase() === 'N/A' ||
    str.toUpperCase() === 'AGUARDANDO' ||
    str.toUpperCase() === 'A CONFIRMAR'
  ) {
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
  // Match DD/MM/YYYY or DD/MM/YY or MM/DD/YY
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    let p1 = Number(dmy[1]);
    let p2 = Number(dmy[2]);
    const y = dmy[3].length === 2 ? Number(`20${dmy[3]}`) : Number(dmy[3]);
    // In Brazilian Excel, DD/MM/YYYY is standard; if p2 > 12 and p1 <= 12, swap
    let day = p1;
    let month = p2;
    if (month > 12 && day <= 12) {
      day = p2;
      month = p1;
    }
    return new Date(Date.UTC(y, month - 1, day));
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

export function formatDateBR(val: any, fallback = ''): string {
  const d = parseExcelDate(val);
  if (!d) return fallback;
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

export function diffDaysBetween(dateEndVal: any, dateStartVal: any, fallback = 0): number {
  const dEnd = parseExcelDate(dateEndVal);
  const dStart = parseExcelDate(dateStartVal);
  if (!dEnd || !dStart) return fallback;
  const diff = Math.round((dEnd.getTime() - dStart.getTime()) / (86400 * 1000));
  return diff >= 0 ? diff : fallback;
}

// ============================================================================
// B. FLEXIBLE DICTIONARY LOOKUP BY NORMALIZED HEADER OR COLUMN INDEX
// ============================================================================

interface ExtractedRow {
  raw: Record<string, any>;
  fmt: Record<string, string>;
  rawCols: any[];
  fmtCols: string[];
}

function getField(
  row: ExtractedRow,
  candidates: string[],
  fallback: any = '',
  fallbackColIndex?: number
): { raw: any; fmt: string } {
  const rawDict = row.raw;
  const fmtDict = row.fmt;

  // 1. Exact match on normalizeHeader
  for (const cand of candidates) {
    const normCand = normalizeHeader(cand);
    if (
      rawDict[normCand] !== undefined &&
      rawDict[normCand] !== null &&
      String(rawDict[normCand]).trim() !== ''
    ) {
      return { raw: rawDict[normCand], fmt: fmtDict[normCand] || String(rawDict[normCand]) };
    }
  }

  // 2. Accent-stripped match
  const accentStrippedKeyMap: Record<string, string> = {};
  for (const k of Object.keys(rawDict)) {
    accentStrippedKeyMap[stripAccents(k)] = k;
  }

  for (const cand of candidates) {
    const strippedCand = stripAccents(normalizeHeader(cand));
    const origKey = accentStrippedKeyMap[strippedCand];
    if (
      origKey &&
      rawDict[origKey] !== undefined &&
      rawDict[origKey] !== null &&
      String(rawDict[origKey]).trim() !== ''
    ) {
      return { raw: rawDict[origKey], fmt: fmtDict[origKey] || String(rawDict[origKey]) };
    }

    // 3. Partial substring match (only for candidate strings >= 4 chars so 'PO' or 'DI' don't false-match)
    if (strippedCand.length >= 4) {
      const partialStripKey = Object.keys(accentStrippedKeyMap).find((k) =>
        k.includes(strippedCand)
      );
      if (partialStripKey) {
        const realKey = accentStrippedKeyMap[partialStripKey];
        if (
          realKey &&
          rawDict[realKey] !== undefined &&
          String(rawDict[realKey]).trim() !== ''
        ) {
          return { raw: rawDict[realKey], fmt: fmtDict[realKey] || String(rawDict[realKey]) };
        }
      }
    }
  }

  // 4. Optional positional column fallback (e.g., Col I = index 8 if header is blank)
  if (
    fallbackColIndex !== undefined &&
    row.rawCols[fallbackColIndex] !== undefined &&
    String(row.rawCols[fallbackColIndex]).trim() !== ''
  ) {
    return {
      raw: row.rawCols[fallbackColIndex],
      fmt: row.fmtCols[fallbackColIndex] || String(row.rawCols[fallbackColIndex]),
    };
  }

  return { raw: fallback, fmt: String(fallback ?? '') };
}

function getCell(
  row: ExtractedRow,
  candidates: string[],
  fallback: any = '',
  fallbackColIndex?: number
): any {
  const res = getField(row, candidates, fallback, fallbackColIndex);
  return res.raw !== '' && res.raw !== undefined && res.raw !== null ? res.raw : fallback;
}

function getCellDate(
  row: ExtractedRow,
  candidates: string[],
  fallback = ''
): string {
  const res = getField(row, candidates, '');
  // Try raw first (if serial number or ISO), then formatted string (e.g. DD/MM/YYYY)
  const isoFromRaw = formatDateISO(res.raw, '');
  if (isoFromRaw) return isoFromRaw;
  const isoFromFmt = formatDateISO(res.fmt, '');
  if (isoFromFmt) return isoFromFmt;
  return fallback;
}

// ============================================================================
// C. SCAN ANY SHEET TO LOCATE HEADER ROW & EXTRACT ROWS
// ============================================================================

const KNOWN_HEADER_KEYWORDS = [
  'REF. MFX',
  'REF MFX',
  'PROCESSO',
  'STATUS',
  'COMPRADOR',
  'COMPRADOR RESPONSAVEL',
  'PO',
  'OC',
  'FORNECEDOR',
  'EXPORTADOR',
  'ORIGEM',
  'INVOICE',
  'FATURA',
  'COD. MATERIAL',
  'COD MATERIAL',
  'DESCRICAO',
  'QTD',
  'QUANTIDADE',
  'VALOR UNITARIO',
  'VALOR TOTAL',
  'UNIDADE DE MEDIDA',
  'AGENTE DE CARGAS',
  'AGENTE DE CARGA',
  'BL / AWB',
  'BL/AWB',
  'INCOTERMS',
  'INCOTERM',
  'MODAL',
  'DATA PRONTIDAO CARGA',
  'PRONTIDAO DA CARGA',
  'ETD',
  'EMBARQUE',
  'ETA',
  'PREVISAO CHEGADA',
  'PROJETO',
  'VMLE',
  'VMLD',
];

function extractRowsFromSheet(sheet: XLSX.WorkSheet): {
  rows: ExtractedRow[];
  isRealFlatItemTable: boolean;
  isPedidosOnlySheet: boolean;
} {
  const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: '',
  });
  const fmtMatrix: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (!rawMatrix || rawMatrix.length === 0) {
    return { rows: [], isRealFlatItemTable: false, isPedidosOnlySheet: false };
  }

  // Scan the first 15 rows to find the row index with the most matching MFX header keywords
  let headerRowIdx = -1;
  let bestScore = 0;
  const maxScan = Math.min(15, rawMatrix.length);

  for (let r = 0; r < maxScan; r++) {
    const rowCells = (rawMatrix[r] || []).map((c) => stripAccents(normalizeHeader(c)));
    let score = 0;
    for (const cell of rowCells) {
      if (!cell) continue;
      if (
        KNOWN_HEADER_KEYWORDS.some(
          (kw) => cell === kw || (kw.length >= 4 && cell.includes(kw))
        )
      ) {
        score++;
      }
    }
    if (score > bestScore && score >= 2) {
      bestScore = score;
      headerRowIdx = r;
    }
  }

  if (headerRowIdx === -1) {
    headerRowIdx = 0;
  }

  const rawHeaders = rawMatrix[headerRowIdx] || [];
  const normalizedHeaders = rawHeaders.map((h, i) => {
    const norm = normalizeHeader(h);
    if (norm) return norm;
    // Special rule from prompt: Col I (index 8) is DESCRIÇÃO if header is blank
    if (i === 8) return 'DESCRIÇÃO';
    return `COL_${i}`;
  });

  const strippedHeaders = normalizedHeaders.map((h) => stripAccents(h));
  const isRealFlatItemTable = strippedHeaders.some(
    (h) =>
      h.includes('REF. MFX') ||
      h.includes('REF MFX') ||
      h.includes('COD. MATERIAL') ||
      h.includes('COD MATERIAL') ||
      h.includes('COMPRADOR') ||
      h.includes('VALOR UNITARIO') ||
      h.includes('BL / AWB') ||
      h.includes('BL/AWB')
  );

  const isPedidosOnlySheet =
    !isRealFlatItemTable &&
    strippedHeaders.some((h) => h === 'OC' || h === 'PO') &&
    strippedHeaders.some((h) => h.includes('PRONTIDAO')) &&
    !strippedHeaders.some((h) => h.includes('VMLE') || h.includes('DESEMBARACO'));

  const rows: ExtractedRow[] = [];

  for (let r = headerRowIdx + 1; r < rawMatrix.length; r++) {
    const rawArr = rawMatrix[r] || [];
    const fmtArr = fmtMatrix[r] || [];
    if (rawArr.length === 0) continue;

    const rawDict: Record<string, any> = {};
    const fmtDict: Record<string, string> = {};

    for (let c = 0; c < normalizedHeaders.length; c++) {
      const key = normalizedHeaders[c];
      rawDict[key] = rawArr[c] !== undefined ? rawArr[c] : '';
      fmtDict[key] = fmtArr[c] !== undefined ? String(fmtArr[c]) : '';
    }

    const rowObj: ExtractedRow = {
      raw: rawDict,
      fmt: fmtDict,
      rawCols: rawArr,
      fmtCols: fmtArr,
    };

    const refMfxVal = String(
      getCell(rowObj, ['REF. MFX', 'REF MFX', 'PROCESSO'], '')
    ).trim();
    const poVal = String(getCell(rowObj, ['PO', 'OC', 'PEDIDO'], '')).trim();
    const fornVal = String(getCell(rowObj, ['FORNECEDOR', 'EXPORTADOR'], '')).trim();
    const codMatVal = String(
      getCell(rowObj, ['COD. MATERIAL', 'COD MATERIAL', 'CODIGO MATERIAL'], '')
    ).trim();
    const blVal = String(getCell(rowObj, ['BL / AWB', 'BL/AWB', 'CONHECIMENTO'], '')).trim();

    // Skip blank rows where REF. MFX, PO, FORNECEDOR, COD. MATERIAL, and BL/AWB are all empty
    if (!refMfxVal && !poVal && !fornVal && !codMatVal && !blVal) continue;

    // Skip repeated header rows or title banners
    const upperRef = stripAccents(refMfxVal.toUpperCase());
    if (
      upperRef === 'REF. MFX' ||
      upperRef === 'REF MFX' ||
      upperRef === 'PROCESSO' ||
      upperRef.includes('ACOMPANHAMENTO DOS PROCESSOS')
    ) {
      continue;
    }

    rows.push(rowObj);
  }

  return { rows, isRealFlatItemTable, isPedidosOnlySheet };
}

// ============================================================================
// D. STATUS, REGIME & RISK NORMALIZATION
// ============================================================================

export function getProcessStage(rawStatus: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const s = stripAccents(String(rawStatus || '').toUpperCase().trim());
  if (!s) return 3;

  // Stage 6: Cleared / In National Road Transit (check AG. ENTREGA before ENTREGUE)
  if (
    s.includes('AG. ENTREGA') ||
    s.includes('AGUARDANDO ENTREGA') ||
    s.includes('TRANSITO RODOVIARIO') ||
    s.includes('EM TRANSITO RODOVIARIO') ||
    s.includes('DESEMBARACADO') ||
    s.includes('LIBERADO') ||
    s.includes('CARREGADO')
  ) {
    return 6;
  }

  // Stage 7: Delivered to MFX (ONLY when Column A explicitly states ENTREGUE / CONCLUIDO / FINALIZADO)
  if (s.includes('ENTREGUE') || s.includes('CONCLUID') || s.includes('FINALIZAD')) {
    return 7;
  }

  // Stage 3: Shipped / In International Transit / Waiting Arrival at Port/Airport
  // MUST check AG. CHEGADA / AGUARDANDO CHEGADA before PORTO/AEROPORTO because "AG. CHEGADA PORTO/AEROPORTO" contains PORTO/AEROPORTO
  if (
    s.includes('AG. CHEGADA') ||
    s.includes('AGUARDANDO CHEGADA') ||
    s.includes('EM TRANSITO') ||
    s.includes('TRANSITO') ||
    s.includes('EMBARCAD')
  ) {
    return 3;
  }

  // Stage 5: DI Registered / In Customs Clearance / Parameterized
  if (
    s.includes('DI REGISTRADA') ||
    s.includes('EM DESEMBARACO') ||
    s.includes('PARAMETRIZAD') ||
    s.includes('CANAL')
  ) {
    return 5;
  }

  // Stage 4: Arrived at Port/Airport / Waiting DI Registration / Blocked on Drawback AC
  if (
    s.includes('DRAWBACK') ||
    s.includes('ATO CONCESSORIO') ||
    s.includes('AG. AC') ||
    s.includes('PARAD') ||
    s.includes('BLOQUEAD') ||
    s.includes('NO PORTO') ||
    s.includes('NO AEROPORTO') ||
    s.includes('PRESENCA') ||
    s.includes('AG. REGISTRO') ||
    s.includes('AGUARDANDO REGISTRO') ||
    s.includes('PORTO') ||
    s.includes('AEROPORTO') ||
    s.includes('TECON') ||
    s.includes('TECA')
  ) {
    return 4;
  }

  // Stage 2: Cargo Ready / Waiting Shipment or AWB
  if (
    s.includes('CARGA PRONTA') ||
    s.includes('AG. EMBARQUE') ||
    s.includes('AGUARDANDO EMBARQUE') ||
    s.includes('AG. AWB') ||
    s.includes('AGUARDANDO AWB') ||
    s.includes('AG. COLETA') ||
    s.includes('AGUARDANDO COLETA') ||
    s.includes('COLETAD') ||
    s.includes('PRONTA')
  ) {
    return 2;
  }

  // Stage 1: In Production / PO Issued / Waiting Cargo Readiness
  if (
    s.includes('PRODUCAO') ||
    s.includes('FABRICACAO') ||
    s.includes('PEDIDO') ||
    s.includes('PRONTIDAO')
  ) {
    return 1;
  }

  return 3;
}

export function normalizeStatus(
  rawStatus: string,
  _entregaMFX?: string,
  _desembaraco?: string,
  _chegada?: string,
  _embarque?: string
): string {
  const s = stripAccents(String(rawStatus || '').toUpperCase().trim());
  const stage = getProcessStage(rawStatus);

  // Column A (STATUS) is the absolute source of truth. Never promote status based on forecast dates!
  if (stage === 7) return 'Entregue MFX';
  if (stage === 6) return 'Desembaraçado';
  if (stage === 5) return 'No Porto/Aeroporto';
  if (stage === 4) {
    if (
      s.includes('PARAD') ||
      s.includes('DRAWBACK') ||
      s.includes('ATO CONCESSORIO') ||
      s.includes('AG. AC') ||
      s.includes('BLOQUEAD')
    ) {
      return 'Parado Ag. Drawback';
    }
    return 'No Porto/Aeroporto';
  }
  if (stage === 3) return 'Em Trânsito';
  if (stage === 2) return 'Ag. Embarque';
  if (stage === 1) return 'Em Produção Fornecedor';

  return rawStatus ? String(rawStatus).trim() : 'Em Trânsito';
}

export function detectDateInconsistencies(
  stage: number,
  eta?: string,
  prazoEntrega?: string
): {
  alertaEtaVencido: boolean;
  alertaEntregaAtrasada: boolean;
} {
  const today = new Date().toISOString().slice(0, 10);
  const isIsoDate = (d?: string) => Boolean(d && /^\d{4}-\d{2}-\d{2}$/.test(d));

  const alertaEtaVencido = stage <= 3 && isIsoDate(eta) && String(eta) < today;
  const alertaEntregaAtrasada =
    stage < 7 && isIsoDate(prazoEntrega) && String(prazoEntrega) < today;

  return { alertaEtaVencido, alertaEntregaAtrasada };
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

export function computeProcessRisk(p: Partial<ImportProcess>): {
  riskLevel: RiskLevel;
  riskReason: string;
} {
  const stage = p.stageNumber ?? getProcessStage(p.statusRawExcel || p.status || '');

  // Completed / Delivered ONLY when Column A status explicitly resolves to Stage 7 (Entregue MFX)
  if (stage === 7 || p.status === 'Entregue MFX') {
    if ((p.impostosPagosIndevidamenteBRL || 0) > 0) {
      return {
        riskLevel: 'medium',
        riskReason: `Entregue MFX (${p.dataEntregaMFX || 'Concluído'}) · R$ ${(
          p.impostosPagosIndevidamenteBRL || 0
        ).toLocaleString('pt-BR')} em Recolhimento Integral`,
      };
    }
    return {
      riskLevel: 'none',
      riskReason: `Concluído / Entregue na Planta MFX (${p.dataEntregaMFX || p.eta || 'OK'})`,
    };
  }
  if (p.cargaParadaDrawback || p.status === 'Parado Ag. Drawback') {
    return {
      riskLevel: 'high',
      riskReason: p.motivoParadaDrawback || 'Carga Parada aguardando Ato Concessório Drawback',
    };
  }
  if (p.alertaEntregaAtrasada) {
    return {
      riskLevel: 'high',
      riskReason: `🚨 Entrega Atrasada vs. Forecast (${p.prazoEntregaMFX}) · Status FUP: ${
        p.statusRawExcel || p.status
      }`,
    };
  }
  if ((p.freeTimeDiasRestantes ?? 10) < 3 && stage >= 4 && stage < 7) {
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
      riskReason: `Alerta Fiscal: R$ ${(p.impostosPagosIndevidamenteBRL || 0).toLocaleString(
        'pt-BR'
      )} sob Recolhimento Integral`,
    };
  }
  if (p.alertaEtaVencido) {
    return {
      riskLevel: 'medium',
      riskReason: `⚠️ ETA Vencido (${p.eta}) / Atualizar Status (${p.statusRawExcel || p.status})`,
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
    riskReason: `${p.statusRawExcel || p.status} · ${p.fornecedor} (${p.paisOrigem}) · BL/AWB ${p.blAwb}`,
  };
}

// ============================================================================
// E. MAIN WORKBOOK PARSER (SUPPORTS REAL MFX ITEM-LEVEL FLAT SHEET + LEGACY)
// ============================================================================

export function parseMfxExcelFile(
  buffer: ArrayBuffer,
  ptax: PtaxRates
): {
  processos: ImportProcess[];
  pedidosForecast: PedidoForecastRow[];
  rawItems: MfxRawItemRow[];
  pedidosCount: number;
  sheetNames: string[];
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetNames = wb.SheetNames || [];

  const allFlatRows: ExtractedRow[] = [];
  const allLegacyProcessRows: ExtractedRow[] = [];
  const allLegacyPedidoRows: ExtractedRow[] = [];

  // Scan ALL sheets in workbook.SheetNames! Never fail if sheet isn't named PROCESSOS/PEDIDOS
  for (const sName of sheetNames) {
    const sheet = wb.Sheets[sName];
    if (!sheet) continue;
    const { rows, isRealFlatItemTable, isPedidosOnlySheet } = extractRowsFromSheet(sheet);
    if (rows.length === 0) continue;

    if (isRealFlatItemTable) {
      allFlatRows.push(...rows);
    } else if (isPedidosOnlySheet || /PEDIDO/i.test(stripAccents(sName))) {
      allLegacyPedidoRows.push(...rows);
    } else {
      // Could be either flat item table or legacy PROCESSOS table
      allLegacyProcessRows.push(...rows);
    }
  }

  // Cross-reference PROJETO across all extracted rows by PO/OC and REF. MFX/PROCESSO
  const PROJETO_HEADERS = [
    'PROJETO',
    'PROJETOS',
    'APLICAÇÃO',
    'APLICACAO',
    'CLIENTE',
    'CENTRO DE CUSTO',
    'DESTINO',
  ];
  const projetoLookup = new Map<string, string>();
  [...allFlatRows, ...allLegacyPedidoRows, ...allLegacyProcessRows].forEach((r) => {
    const proj = String(getCell(r, PROJETO_HEADERS, '')).trim().toUpperCase();
    if (!proj) return;
    const ref = String(getCell(r, ['REF. MFX', 'REF MFX', 'PROCESSO', 'REF'], '')).trim().toUpperCase();
    const po = String(getCell(r, ['PO', 'OC', 'PEDIDO', 'ORDEM DE COMPRA'], '')).trim().toUpperCase();
    if (ref) projetoLookup.set(ref, proj);
    if (po) {
      po.split(',').forEach((token) => {
        const t = token.trim();
        if (t) projetoLookup.set(t, proj);
      });
    }
  });

  // If the workbook has both a flat table and a separate PEDIDOS tab, append unshipped PEDIDOS rows not yet in allFlatRows
  if (allFlatRows.length > 0 && allLegacyPedidoRows.length > 0) {
    const existingRefsAndPos = new Set<string>();
    allFlatRows.forEach((r) => {
      const ref = String(getCell(r, ['REF. MFX', 'REF MFX', 'PROCESSO', 'REF'], '')).trim().toUpperCase();
      const po = String(getCell(r, ['PO', 'OC', 'PEDIDO', 'ORDEM DE COMPRA'], '')).trim().toUpperCase();
      if (ref) existingRefsAndPos.add(ref);
      if (po) existingRefsAndPos.add(po);
    });
    allLegacyPedidoRows.forEach((r) => {
      const ref = String(getCell(r, ['REF. MFX', 'REF MFX', 'PROCESSO', 'REF'], '')).trim().toUpperCase();
      const po = String(getCell(r, ['PO', 'OC', 'PEDIDO', 'ORDEM DE COMPRA'], '')).trim().toUpperCase();
      if ((ref && existingRefsAndPos.has(ref)) || (po && existingRefsAndPos.has(po))) return;
      allFlatRows.push(r);
    });
  }

  // ==========================================================================
  // CASE 1: REAL MFX MASTER FLAT TABLE (Col A STATUS, Col B REF. MFX, Col C COMPRADOR, Col D PO...)
  // ==========================================================================
  if (allFlatRows.length > 0) {
    const rawItems: MfxRawItemRow[] = [];
    const pedidosForecast: PedidoForecastRow[] = [];
    const groupedByRefMfx = new Map<
      string,
      {
        refMfx: string;
        hasExplicitRefMfx: boolean;
        rows: ExtractedRow[];
        items: MfxRawItemRow[];
      }
    >();

    allFlatRows.forEach((row, idx) => {
      // Col A — STATUS
      const rawStatus = String(
        getCell(row, ['STATUS', 'SITUACAO', 'SITUAÇÃO'], '', 0)
      ).trim();

      // Col B — REF. MFX (or PROCESSO / REF MFX)
      let refMfx = String(
        getCell(row, ['REF. MFX', 'REF MFX', 'PROCESSO', 'REF'], '', 1)
      ).trim();
      const hasExplicitRefMfx = Boolean(refMfx && !refMfx.startsWith('#'));

      // Col C — COMPRADOR RESPONSAVEL
      const comprador = String(
        getCell(
          row,
          ['COMPRADOR RESPONSAVEL', 'COMPRADOR RESPONSÁVEL', 'COMPRADOR'],
          'COMEX MFX',
          2
        )
      )
        .trim()
        .toUpperCase();

      // Col D — PO (or OC / PEDIDO)
      const po = String(
        getCell(row, ['PO', 'OC', 'PEDIDO', 'ORDEM DE COMPRA'], '', 3)
      ).trim();

      // Col E — FORNECEDOR (or EXPORTADOR)
      const fornecedor = String(
        getCell(row, ['FORNECEDOR', 'EXPORTADOR'], 'FORNECEDOR MFX', 4)
      )
        .trim()
        .toUpperCase();

      // Col F — ORIGEM (or PAÍS / PAIS)
      const origem = String(
        getCell(row, ['ORIGEM', 'PAÍS', 'PAIS', 'PAIS DE ORIGEM'], 'ALEMANHA', 5)
      )
        .trim()
        .toUpperCase();

      // Col G — INVOICE (or FATURA)
      const invoice = String(
        getCell(row, ['INVOICE', 'FATURA', 'COMMERCIAL INVOICE', 'CI'], '', 6)
      ).trim();

      // Col H — COD. MATERIAL (or COD MATERIAL / CODIGO MATERIAL / ITEM)
      const codMaterial = String(
        getCell(
          row,
          ['COD. MATERIAL', 'COD MATERIAL', 'CODIGO MATERIAL', 'ITEM', 'CODIGO'],
          `ITEM-${idx + 1}`,
          7
        )
      ).trim();

      // Col I — DESCRIÇÃO (or DESCRICAO / DESCRIÇÃO DO MATERIAL / MERCADORIA / Col index 8 if header is blank)
      const descricao = String(
        getCell(
          row,
          [
            'DESCRIÇÃO',
            'DESCRICAO',
            'DESCRIÇÃO DO MATERIAL',
            'DESCRICAO DO MATERIAL',
            'MERCADORIA',
          ],
          `Material ${codMaterial}`,
          8
        )
      ).trim();

      // Col J — QTD (or QUANTIDADE)
      const qtd = cleanNumber(getCell(row, ['QTD', 'QUANTIDADE', 'QTDE'], 1, 9)) || 1;

      // Col K — VALOR UNITÁRIO (with currency detection)
      const unitField = getField(
        row,
        ['VALOR UNITÁRIO', 'VALOR UNITARIO', 'VLR UNIT', 'PRECO UNITARIO'],
        0,
        10
      );
      const parsedUnit = detectCurrencyAndCleanValue(unitField.raw, unitField.fmt);

      // Col L — VALOR TOTAL (with currency detection)
      const totalField = getField(
        row,
        ['VALOR TOTAL', 'VLR TOTAL', 'VMLD', 'VMLE', 'VALOR'],
        0,
        11
      );
      const parsedTotal = detectCurrencyAndCleanValue(totalField.raw, totalField.fmt);

      // Currency resolution
      const explicitMoedaRaw = String(getCell(row, ['MOEDA'], '')).trim().toUpperCase();
      let moeda: CurrencyCode = 'USD';
      if (parsedTotal.currency) {
        moeda = parsedTotal.currency;
      } else if (parsedUnit.currency) {
        moeda = parsedUnit.currency;
      } else if (explicitMoedaRaw.includes('EUR') || explicitMoedaRaw.includes('€')) {
        moeda = 'EUR';
      } else if (explicitMoedaRaw.includes('BRL') || explicitMoedaRaw.includes('R$')) {
        moeda = 'BRL';
      } else if (explicitMoedaRaw.includes('CNY') || explicitMoedaRaw.includes('RMB')) {
        moeda = 'CNY';
      } else if (origem === 'ALEMANHA' || origem === 'ITALIA' || origem === 'FRANCA') {
        // Default European origins to EUR if no symbol was present
        moeda = 'EUR';
      }

      const valorUnitario =
        parsedUnit.value > 0
          ? parsedUnit.value
          : parsedTotal.value > 0 && qtd > 0
          ? Number((parsedTotal.value / qtd).toFixed(2))
          : 0;
      const valorTotal =
        parsedTotal.value > 0 ? parsedTotal.value : Number((valorUnitario * qtd).toFixed(2));

      // Col M — UNIDADE DE MEDIDA
      const unidadeMedida = String(
        getCell(row, ['UNIDADE DE MEDIDA', 'UNID', 'UM', 'UNIDADE'], 'PC', 12)
      )
        .trim()
        .toUpperCase();

      // Col N — AGENTE DE CARGAS
      const agenteCargas = String(
        getCell(row, ['AGENTE DE CARGAS', 'AGENTE DE CARGA', 'AGENTE'], 'CRONOS', 13)
      )
        .trim()
        .toUpperCase();

      // Col O — BL / AWB
      const blAwb = String(
        getCell(
          row,
          ['BL / AWB', 'BL/AWB', 'BL/ AWB', 'BL /AWB', 'CONHECIMENTO', 'BL', 'AWB'],
          '',
          14
        )
      ).trim();

      // Col P — INCOTERMS
      const incoterm = String(
        getCell(row, ['INCOTERMS', 'INCOTERM'], 'FCA', 15)
      )
        .trim()
        .toUpperCase();

      // Col Q — MODAL
      const modalRaw = stripAccents(
        String(getCell(row, ['MODAL'], 'MARÍTIMO', 16)).trim().toUpperCase()
      );
      const modal: ModalType =
        modalRaw.includes('AER') || modalRaw.includes('AIR')
          ? 'AÉREO'
          : modalRaw.includes('ROD')
          ? 'RODOVIÁRIO'
          : 'MARÍTIMO';

      // Col R — DATA PRONTIDÃO CARGA
      const dataProntidaoCarga = getCellDate(
        row,
        [
          'DATA PRONTIDÃO CARGA',
          'DATA PRONTIDAO CARGA',
          'PRONTIDÃO DA CARGA',
          'PRONTIDAO DA CARGA',
          'PRONTIDÃO CARGA',
          'PRONTIDAO CARGA',
        ],
        ''
      );

      // Col S — ETD
      const etd = getCellDate(row, ['ETD', 'EMBARQUE', 'DATA EMBARQUE'], '');

      // Col T — ETA
      const eta = getCellDate(
        row,
        ['ETA', 'PREVISÃO CHEGADA', 'PREVISAO CHEGADA', 'CHEGADA'],
        ''
      );

      // Col U+ — TR / TRANSIT TIME / TT (if blank, calculate cleanly as ETA - ETD in days)
      const rawTT = getCell(row, ['TR', 'TRANSIT TIME', 'TT'], '');
      let transitTimeDias = cleanNumber(rawTT);
      if (!transitTimeDias || String(rawTT).trim().startsWith('#')) {
        transitTimeDias = diffDaysBetween(eta, etd, modal === 'AÉREO' ? 3 : 20);
      }

      const explicitRowProj = String(getCell(row, PROJETO_HEADERS, '')).trim().toUpperCase();
      const crossRefProj =
        (refMfx && projetoLookup.get(refMfx.toUpperCase())) ||
        (po && projetoLookup.get(po.toUpperCase())) ||
        '';
      const projeto =
        explicitRowProj ||
        crossRefProj ||
        (fornecedor.includes('TRATOS') || fornecedor.includes('WALTHER')
          ? 'PETROBRAS'
          : fornecedor.includes('ACOTEQ')
          ? 'PRIO'
          : 'PETROBRAS');

      // Fallback key if REF. MFX is blank on a row
      if (!refMfx) {
        refMfx = blAwb ? `BL-${blAwb}` : po ? `PO-${po}` : `SEM-REF-${idx + 1}`;
      }

      const rawItem: MfxRawItemRow = {
        id: `RAW-${idx + 1}`,
        status: rawStatus || (blAwb ? 'EM TRÂNSITO' : 'EM PRODUÇÃO FORNECEDOR'),
        refMfx,
        compradorResponsavel: comprador,
        po: po || 'S/ PO',
        fornecedor,
        origem,
        invoice: invoice || 'S/ INV',
        codMaterial,
        descricao,
        qtd,
        valorUnitario,
        valorTotal,
        moeda,
        unidadeMedida,
        agenteCargas: agenteCargas || 'A DEFINIR',
        blAwb: blAwb || '',
        incoterm: incoterm || 'FCA',
        modal,
        dataProntidaoCarga: dataProntidaoCarga || '',
        etd: etd || '',
        eta: eta || '',
        transitTimeDias,
        projeto,
      };

      rawItems.push(rawItem);

      pedidosForecast.push({
        id: `PO-LINE-${idx + 1}`,
        projeto,
        processo: hasExplicitRefMfx ? refMfx : 'Sem Referência / Ag. Abertura',
        compradorResponsavel: comprador,
        fornecedor,
        origem,
        oc: po || 'S/ PO',
        codMaterial,
        descricao,
        qtd,
        unidadeMedida,
        emissaoOC: getCellDate(row, ['EMISSÃO OC', 'EMISSAO OC', 'DATA PO', 'DATA OC'], '') || dataProntidaoCarga || '',
        incoterm: incoterm || 'FCA',
        valorUnitario,
        valor: valorTotal,
        moeda,
        prontidaoCarga: dataProntidaoCarga || '',
        etd: etd || '',
        eta: eta || '',
        agenteCargas,
        blAwb: blAwb || '',
        modal,
        status: rawItem.status,
      });

      if (!groupedByRefMfx.has(refMfx)) {
        groupedByRefMfx.set(refMfx, { refMfx, hasExplicitRefMfx, rows: [], items: [] });
      }
      const group = groupedByRefMfx.get(refMfx)!;
      group.rows.push(row);
      group.items.push(rawItem);
    });

    // Build Grouped Processes (processosConsolidados) from groupedByRefMfx
    const parsedProcessos: ImportProcess[] = [];

    Array.from(groupedByRefMfx.values()).forEach((group, gIdx) => {
      const firstRow = group.rows[0];
      const firstItem = group.items[0];
      const id = group.refMfx;

      const uniquePOs = Array.from(
        new Set(group.items.map((i) => i.po).filter((x) => x && x !== 'S/ PO'))
      );
      const oc = uniquePOs.length > 0 ? uniquePOs.join(', ') : firstItem.po;

      const uniqueInvoices = Array.from(
        new Set(group.items.map((i) => i.invoice).filter((x) => x && x !== 'S/ INV'))
      );
      const commercialInvoice =
        uniqueInvoices.length > 0 ? uniqueInvoices.join(', ') : firstItem.invoice;

      const compradorResponsavel = firstItem.compradorResponsavel || 'EUDE';
      const fornecedor = firstItem.fornecedor;
      const paisOrigem = firstItem.origem;
      const moeda = firstItem.moeda;
      const taxaPtaxDI =
        moeda === 'BRL' ? 1 : ptax[moeda as 'USD' | 'EUR' | 'CNY'] || 5.7842;

      const totalValorMoeda = Number(
        group.items.reduce((sum, item) => sum + item.valorTotal, 0).toFixed(2)
      );
      const totalQtdUnidades = group.items.reduce((sum, item) => sum + item.qtd, 0);

      // Check optional Col U+ columns if present in the sheet
      const rawChegadaCell = getCellDate(firstRow, ['CHEGADA', 'DATA CHEGADA'], '');
      const rawRegistroDICell = getCellDate(
        firstRow,
        ['DATA DO REGISTRO', 'DATA REGISTRO'],
        ''
      );
      const rawDesembaracoCell = getCellDate(
        firstRow,
        ['DESEMBARAÇO', 'DESEMBARACO', 'DATA DESEMBARACO'],
        ''
      );
      const rawEntregaMFXCell = getCellDate(
        firstRow,
        ['ENTREGA MFX', 'DATA ENTREGA MFX', 'DATA ENTREGA', 'PRAZO ENTREGA'],
        ''
      );

      const statusRawExcel = firstItem.status;
      const stageNumber = getProcessStage(statusRawExcel);
      const status = normalizeStatus(statusRawExcel);

      // Helper to add days to an ISO YYYY-MM-DD date string
      const addDaysIso = (isoStr: string, daysToAdd: number): string => {
        if (!isoStr || !/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return '';
        const [y, m, d] = isoStr.split('-').map(Number);
        const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd));
        return dt.toISOString().slice(0, 10);
      };

      const isAirModal = firstItem.modal === 'AÉREO';
      const estimatedClearanceIso =
        rawDesembaracoCell ||
        rawRegistroDICell ||
        (firstItem.eta ? addDaysIso(firstItem.eta, isAirModal ? 4 : 7) : '');
      const estimatedDeliveryIso =
        rawEntregaMFXCell ||
        (firstItem.eta ? addDaysIso(firstItem.eta, isAirModal ? 6 : 10) : '');

      // Forecast dates vs. Actual completed dates based strictly on Column A stageNumber
      const dataChegadaEfetiva =
        stageNumber >= 4 ? rawChegadaCell || firstItem.eta || undefined : undefined;
      const dataRegistroDI =
        rawRegistroDICell || (stageNumber >= 5 ? estimatedClearanceIso || undefined : undefined);
      const dataDesembaraco =
        rawDesembaracoCell || (stageNumber >= 6 ? estimatedClearanceIso || undefined : undefined);
      const effectiveDeliveryDate =
        stageNumber === 7 ? rawEntregaMFXCell || estimatedDeliveryIso || '' : '';
      const forecastDeliveryDate =
        rawEntregaMFXCell || estimatedDeliveryIso || '';
      const { alertaEtaVencido, alertaEntregaAtrasada } = detectDateInconsistencies(
        stageNumber,
        firstItem.eta,
        forecastDeliveryDate
      );

      const beneficioRaw = String(
        getCell(firstRow, ['BENEFÍCIO', 'BENEFICIO', 'REGIME', 'DRAWBACK'], 'DRAWBACK')
      )
        .trim()
        .toUpperCase();
      const regime = normalizeRegime(beneficioRaw);

      const projeto = firstItem.projeto || 'PETROBRAS';

      const defaultAC =
        String(getCell(firstRow, ['ATO CONCESSÓRIO', 'ATO CONCESSORIO', 'AC'], '')).trim() ||
        (regime === 'Recolhimento Integral'
          ? 'SEM AC (Recolhimento)'
          : projeto === 'PRIO'
          ? 'AC-2025/004115-2'
          : 'AC-2025/001482-9');

      const vmleBRL = Math.round(totalValorMoeda * taxaPtaxDI);
      const cotacaoFreteBRL =
        cleanNumber(
          getCell(firstRow, ['COTAÇÃO FRETE R$', 'COTACAO FRETE R$', 'COTACAO FRETE'], 0)
        ) || Math.round(vmleBRL * 0.085);
      const fretePagoBRL =
        cleanNumber(getCell(firstRow, ['FRETE PAGO R$', 'FRETE PAGO', 'FRETE'], 0)) ||
        Math.round(cotacaoFreteBRL * 0.84);

      const rawSavingCell = getCell(firstRow, ['SAVING FRETE', 'SAVING'], '');
      const savingFreteBRL =
        rawSavingCell && !String(rawSavingCell).startsWith('#')
          ? cleanNumber(rawSavingCell)
          : Math.max(0, cotacaoFreteBRL - fretePagoBRL);
      const savingFretePercent =
        cotacaoFreteBRL > 0 ? (savingFreteBRL / cotacaoFreteBRL) * 100 : 16.0;

      const vmldBRL = vmleBRL + fretePagoBRL;
      const freteInternacionalMoeda = Number((fretePagoBRL / taxaPtaxDI).toFixed(2));

      // Taxes calculation (BRL)
      const iiBRL = Math.round(vmldBRL * 0.14);
      const ipiBRL = Math.round((vmldBRL + iiBRL) * 0.05);
      const pisBRL = Math.round(vmldBRL * 0.021);
      const cofinsBRL = Math.round(vmldBRL * 0.0965);
      const icmsBRL = Math.round(vmldBRL * 0.22);
      const totalImpostosEstimadosBRL = iiBRL + ipiBRL + pisBRL + cofinsBRL + icmsBRL;

      const impostosSuspensosDrawbackBRL =
        regime === 'Drawback Suspensão' || regime === 'Ex-Tarifário'
          ? totalImpostosEstimadosBRL
          : 0;
      const impostosPagosIndevidamenteBRL =
        regime === 'Recolhimento Integral' && projeto !== 'ESTOQUE'
          ? totalImpostosEstimadosBRL
          : 0;

      const rawDiFromSheet = String(getCell(firstRow, ['DI', 'DUIMP'], '')).trim();
      const numeroDiDuimp =
        rawDiFromSheet ||
        (stageNumber === 7
          ? `26/04819${gIdx + 1}-0`
          : stageNumber <= 3
          ? 'Aguardando Chegada'
          : 'Pendente Registro');
      const canalRaw = String(getCell(firstRow, ['CANAL'], '')).trim();
      const canal =
        canalRaw && stageNumber >= 5
          ? normalizeCanal(canalRaw)
          : stageNumber >= 6
          ? normalizeCanal(canalRaw) !== 'Pendente Registro'
            ? normalizeCanal(canalRaw)
            : 'Verde'
          : 'Pendente Registro';

      const localDesembaraco =
        String(
          getCell(
            firstRow,
            ['LOCAL DESEMBARAÇO', 'LOCAL DESEMBARACO'],
            firstItem.modal === 'AÉREO' ? 'GUARULHOS / TECA SSA' : 'SALVADOR (TECON)'
          )
        )
          .trim()
          .toUpperCase() || 'SALVADOR';

      const itens: PedidoItem[] = group.items.map((it, itemIdx) => ({
        id: `IT-${id}-${itemIdx + 1}`,
        oc: it.po,
        processoId: id,
        compradorResponsavel: it.compradorResponsavel,
        invoice: it.invoice,
        codigoItem: it.codMaterial,
        descricao: it.descricao,
        ncm: it.descricao.includes('CABO')
          ? '8544.60.00'
          : it.descricao.includes('ENGATE')
          ? '7307.99.00'
          : it.descricao.includes('MOTOR')
          ? '8501.52.10'
          : '8481.80.99',
        ncmAtoConcessorio: it.descricao.includes('CABO')
          ? '8544.60.00'
          : it.descricao.includes('ENGATE')
          ? '7307.99.00'
          : '8481.80.99',
        quantidade: it.qtd,
        qtdAutorizadaAC: it.qtd * 2,
        unidade: it.unidadeMedida,
        valorUnitarioMoeda: it.valorUnitario,
        valorTotalMoeda: it.valorTotal,
        moeda: it.moeda,
        fornecedor: it.fornecedor,
        origem: it.origem,
        projeto,
        dataEmissaoPO: it.dataProntidaoCarga || it.etd || '',
        previsaoProntidaoCarga: it.dataProntidaoCarga || '',
        etd: it.etd,
        eta: it.eta,
        statusItem: it.status,
        alertaLaudoTecnico: 'OK',
        acSugerido: defaultAC,
      }));

      const cargaParadaDrawback =
        status === 'Parado Ag. Drawback' ||
        stripAccents(statusRawExcel.toUpperCase()).includes('DRAWBACK');

      const alertaPreAlertaAWB =
        firstItem.modal === 'AÉREO' &&
        status !== 'Entregue MFX' &&
        (!firstItem.blAwb || firstItem.blAwb === 'A DEFINIR');

      const tempoDesembaracoDias = firstItem.modal === 'AÉREO' ? 2 : 4;
      const tempoEntregaRodoviariaDias = 2;

      const partialProc: ImportProcess = {
        id,
        hasExplicitRefMfx: group.hasExplicitRefMfx,
        compradorResponsavel,
        oc,
        posList: uniquePOs,
        commercialInvoice,
        invoicesList: uniqueInvoices,
        fornecedor,
        paisOrigem,
        projeto,
        status,
        statusRawExcel,
        stageNumber,
        modal: firstItem.modal,
        incoterm: firstItem.incoterm,
        regime,
        beneficioRaw,
        atoConcessorio: defaultAC,
        despachante: 'ÔMEGA',
        agenteCarga: firstItem.agenteCargas,
        armadorCiaAerea: firstItem.agenteCargas,
        blAwb: firstItem.blAwb || 'A DEFINIR',
        numeroDiDuimp,
        canal,
        liAnuente: 'NÃO',
        portoAeroportoDestino: localDesembaraco,
        dataPO: firstItem.dataProntidaoCarga || firstItem.etd || '',
        dataProntidaoCarga: firstItem.dataProntidaoCarga || '',
        etd: firstItem.etd || '',
        etaOriginalPO: firstItem.eta || '',
        eta: firstItem.eta || '',
        dataChegadaEfetiva,
        dataRegistroDI,
        dataDesembaraco,
        dataEntregaMFX: effectiveDeliveryDate || undefined,
        prazoEntregaMFX: effectiveDeliveryDate || forecastDeliveryDate || '',
        etdFormatted: formatDateBR(firstItem.etd || firstItem.dataProntidaoCarga, 'S/ Data'),
        etaFormatted: formatDateBR(rawChegadaCell || firstItem.eta, 'S/ Data'),
        clearanceDateFormatted:
          rawDesembaracoCell || rawRegistroDICell
            ? formatDateBR(rawDesembaracoCell || rawRegistroDICell, 'S/ Data')
            : estimatedClearanceIso
            ? `Est. ${formatDateBR(estimatedClearanceIso, 'S/ Data')}`
            : 'S/ Data',
        deliveryDateFormatted:
          rawEntregaMFXCell
            ? formatDateBR(rawEntregaMFXCell, 'S/ Data')
            : estimatedDeliveryIso
            ? `Est. ${formatDateBR(estimatedDeliveryIso, 'S/ Data')}`
            : 'S/ Data',
        transitTimeDias: firstItem.transitTimeDias,
        tempoDesembaracoDias,
        tempoEntregaRodoviariaDias,
        leadTimeTotalDias:
          firstItem.transitTimeDias + tempoDesembaracoDias + tempoEntregaRodoviariaDias,
        freeTimeTotalDias: firstItem.modal === 'AÉREO' ? 5 : 14,
        freeTimeDiasRestantes: stageNumber === 7 ? 10 : cargaParadaDrawback ? 2 : 9,
        cargaParadaDrawback,
        motivoParadaDrawback: cargaParadaDrawback
          ? `Aguardando vinculação de Ato Concessório (${defaultAC})`
          : undefined,
        diasParadoPortoAeroporto: cargaParadaDrawback ? 6 : 0,
        alertaPreAlertaAWB,
        alertaEtaVencido,
        alertaEntregaAtrasada,
        atrasoEtaDias: 0,
        moeda,
        taxaPtaxDI,
        condicaoPagamento: '90 DDL',
        dataVencimentoInvoice: firstItem.eta || '2026-06-30',
        statusPagamentoInvoice: stageNumber === 7 ? 'Pago' : 'A Vencer',
        valorFOBMoeda: totalValorMoeda,
        valorVMLDMoeda: Number((totalValorMoeda + freteInternacionalMoeda).toFixed(2)),
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
        armazenagemAcumuladaBRL: Math.round(vmldBRL * 0.008),
        custoDiarioArmazenagemBRL: 0,
        cotacaoFreteBRL,
        fretePagoBRL,
        savingFreteBRL,
        savingFretePercent,
        transportadoraNacional: 'RODOVIÁRIO MFX',
        freteRodoviarioBRL: firstItem.modal === 'MARÍTIMO' ? 8500 : 2400,
        pesoBrutoKg: Math.max(150, totalQtdUnidades * 12),
        cubagemCbm: firstItem.modal === 'MARÍTIMO' ? 28 : 3.5,
        qtdContainersFCL: firstItem.modal === 'MARÍTIMO' ? 1 : 0,
        qtdTotalUnidades: totalQtdUnidades,
        itens,
        riskLevel: 'low',
        riskReason: '',
      };

      const risk = computeProcessRisk(partialProc);
      partialProc.riskLevel = risk.riskLevel;
      partialProc.riskReason = risk.riskReason;

      parsedProcessos.push(partialProc);
    });

    return {
      processos: parsedProcessos,
      pedidosForecast,
      rawItems,
      pedidosCount: rawItems.length,
      sheetNames,
    };
  }

  // ==========================================================================
  // CASE 2: SECONDARY FALLBACK — LEGACY PROCESSOS / PEDIDOS SHEETS
  // ==========================================================================
  const pedidosForecast: PedidoForecastRow[] = [];
  const rawItems: MfxRawItemRow[] = [];
  const pedidosByProc: Record<string, PedidoItem[]> = {};
  const pedidosByOC: Record<string, PedidoItem[]> = {};

  allLegacyPedidoRows.forEach((row, idx) => {
    const projeto =
      String(getCell(row, ['PROJETO'], 'PETROBRAS')).trim().toUpperCase() || 'PETROBRAS';
    const processo = String(getCell(row, ['PROCESSO', 'REF. MFX', 'REF MFX'], '')).trim();
    const fornecedor =
      String(getCell(row, ['FORNECEDOR', 'EXPORTADOR'], 'NOV')).trim().toUpperCase() || 'NOV';
    const oc = String(getCell(row, ['OC', 'PO', 'PEDIDO'], `OC-${idx + 1}`)).trim();
    const emissaoOC = getCellDate(
      row,
      ['EMISSÃO OC', 'EMISSAO OC', 'DATA OC', 'DATA PO'],
      '2026-09-01'
    );
    const incoterm =
      String(getCell(row, ['INCOTERM', 'INCOTERMS'], 'FCA')).trim().toUpperCase() || 'FCA';
    const valField = getField(row, ['VALOR', 'VALOR TOTAL', 'VMLE'], 0);
    const parsedVal = detectCurrencyAndCleanValue(valField.raw, valField.fmt);
    const valor = parsedVal.value;
    const moedaRaw = String(getCell(row, ['MOEDA'], '')).trim().toUpperCase();
    const moeda: CurrencyCode =
      parsedVal.currency ||
      (moedaRaw.includes('EUR')
        ? 'EUR'
        : moedaRaw.includes('CNY') || moedaRaw.includes('RMB')
        ? 'CNY'
        : 'USD');
    const prontidaoCarga = getCellDate(
      row,
      ['PRONTIDÃO DA CARGA', 'PRONTIDAO DA CARGA', 'DATA PRONTIDÃO CARGA', 'PRONTIDAO'],
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
      codigoItem: String(getCell(row, ['COD. MATERIAL', 'COD MATERIAL'], `OC-${oc}`)).trim(),
      descricao: String(
        getCell(row, ['DESCRIÇÃO', 'DESCRICAO'], `Pedido ${oc} — ${fornecedor} (${projeto})`)
      ).trim(),
      ncm: String(getCell(row, ['NCM'], '8481.80.99')),
      quantidade: cleanNumber(getCell(row, ['QTD', 'QUANTIDADE'], 1)) || 1,
      qtdAutorizadaAC: 100,
      unidade: String(getCell(row, ['UNIDADE DE MEDIDA', 'UNID', 'UM'], 'UN')).trim(),
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

  const seenProcessIds = new Set<string>();
  const parsedProcessos: ImportProcess[] = [];

  allLegacyProcessRows.forEach((row, idx) => {
    const projeto =
      String(getCell(row, ['PROJETO'], 'PETROBRAS')).trim().toUpperCase() || 'PETROBRAS';
    const id = String(
      getCell(
        row,
        ['REF. MFX', 'REF MFX', 'PROCESSO'],
        `IMP-${String(idx + 1).padStart(3, '0')}/26`
      )
    ).trim();
    seenProcessIds.add(id);

    const compradorResponsavel = String(
      getCell(row, ['COMPRADOR RESPONSAVEL', 'COMPRADOR'], 'EUDE')
    )
      .trim()
      .toUpperCase();
    const fornecedor = String(getCell(row, ['EXPORTADOR', 'FORNECEDOR'], 'NOV'))
      .trim()
      .toUpperCase();
    const fatura = String(getCell(row, ['INVOICE', 'FATURA', 'CI'], `CI-${id}`)).trim();
    const oc = String(getCell(row, ['PO', 'OC', 'PEDIDO'], `OC-${idx + 1}`)).trim();

    const modalRaw = stripAccents(String(getCell(row, ['MODAL'], 'MARÍTIMO')).toUpperCase());
    const modal: ModalType =
      modalRaw.includes('AER') || modalRaw.includes('AIR') ? 'AÉREO' : 'MARÍTIMO';

    const incoterm =
      String(getCell(row, ['INCOTERMS', 'INCOTERM'], 'FCA')).trim().toUpperCase() || 'FCA';

    const condPagRaw = String(getCell(row, ['COND. PAGAMENTO', 'COND PAGAMENTO'], '90')).trim();
    const condNum = cleanNumber(condPagRaw);
    const condicaoPagamento =
      condNum > 0 ? `${condNum} DDL` : condPagRaw ? condPagRaw.toUpperCase() : '90 DDL';

    const vmleField = getField(row, ['VALOR TOTAL', 'VMLE', 'VALOR FOB', 'VALOR'], 0);
    const vmldField = getField(row, ['VMLD', 'VALOR CIF'], 0);
    const parsedVmle = detectCurrencyAndCleanValue(vmleField.raw, vmleField.fmt);
    const parsedVmld = detectCurrencyAndCleanValue(vmldField.raw, vmldField.fmt);

    const moedaRaw = String(getCell(row, ['MOEDA'], '')).trim().toUpperCase();
    const moeda: CurrencyCode =
      parsedVmle.currency ||
      parsedVmld.currency ||
      (moedaRaw.includes('EUR')
        ? 'EUR'
        : moedaRaw.includes('CNY') || moedaRaw.includes('RMB')
        ? 'CNY'
        : 'USD');
    const taxaPtaxDI = moeda === 'BRL' ? 1 : ptax[moeda as 'USD' | 'EUR' | 'CNY'] || 5.7842;

    const valorFOBMoeda =
      parsedVmle.value > 0
        ? parsedVmle.value
        : parsedVmld.value > 0
        ? parsedVmld.value * 0.92
        : 85000;
    const valorVMLDMoeda = parsedVmld.value > 0 ? parsedVmld.value : valorFOBMoeda * 1.06;

    const cotacaoFreteBRL = cleanNumber(
      getCell(row, ['COTAÇÃO FRETE R$', 'COTACAO FRETE R$', 'COTACAO FRETE'], 0)
    );
    const fretePagoBRL = cleanNumber(getCell(row, ['FRETE PAGO R$', 'FRETE PAGO'], 0));

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
      String(getCell(row, ['AGENTE DE CARGAS', 'AGENTE DE CARGA', 'AGENTE'], 'DSV'))
        .trim()
        .toUpperCase() || 'DSV';

    const etd = getCellDate(row, ['ETD', 'EMBARQUE', 'DATA EMBARQUE'], '');
    const eta = getCellDate(
      row,
      ['ETA', 'PREVISÃO CHEGADA', 'PREVISAO CHEGADA'],
      ''
    );
    const dataChegadaEfetiva = getCellDate(row, ['CHEGADA'], '');

    const rawTT = getCell(row, ['TT', 'TR', 'TRANSIT TIME'], '');
    let transitTimeDias = cleanNumber(rawTT);
    if (!transitTimeDias || String(rawTT).trim().startsWith('#')) {
      transitTimeDias = diffDaysBetween(
        dataChegadaEfetiva || eta,
        etd,
        modal === 'AÉREO' ? 4 : 24
      );
    }

    const localDesembaraco =
      String(
        getCell(
          row,
          ['LOCAL DESEMBARAÇO', 'LOCAL DESEMBARACO'],
          modal === 'AÉREO' ? 'VIRACOPOS' : 'SALVADOR'
        )
      )
        .trim()
        .toUpperCase() || 'SALVADOR';

    const anuencia =
      String(getCell(row, ['ANUÊNCIA', 'ANUENCIA'], 'NÃO')).trim().toUpperCase() || 'NÃO';
    const deferimentoLI = getCellDate(row, ['DEFERIMENTO LI'], '');

    const beneficioRaw =
      String(getCell(row, ['BENEFÍCIO', 'BENEFICIO'], 'DRAWBACK')).trim().toUpperCase() ||
      'DRAWBACK';
    const regime = normalizeRegime(beneficioRaw);

    const numeroDiDuimp =
      String(getCell(row, ['DI', 'DUIMP'], '')).trim() || 'Pendente Registro';
    const dataRegistroDI = getCellDate(row, ['DATA DO REGISTRO', 'DATA REGISTRO'], '');
    const canal = normalizeCanal(String(getCell(row, ['CANAL'], '')));
    const dataDesembaraco = getCellDate(row, ['DESEMBARAÇO', 'DESEMBARACO'], '');

    const rawDiasLib = getCell(
      row,
      ['DIAS P/ LIBERAÇÃO', 'DIAS P/ LIBERACAO', 'DIAS LIBERACAO'],
      ''
    );
    let tempoDesembaracoDias = cleanNumber(rawDiasLib);
    if (!tempoDesembaracoDias || String(rawDiasLib).trim().startsWith('#')) {
      tempoDesembaracoDias = diffDaysBetween(
        dataDesembaraco,
        dataChegadaEfetiva || dataRegistroDI || eta,
        modal === 'AÉREO' ? 3 : 5
      );
    }

    const dataCarregamento = getCellDate(row, ['CARREGAMENTO'], '');
    const transportadoraNacional =
      String(getCell(row, ['TRANSPORTADORA'], 'RODOVIÁRIO MFX')).trim() || 'RODOVIÁRIO MFX';
    const dataEntregaMFX = getCellDate(row, ['ENTREGA MFX', 'DATA ENTREGA MFX'], '');

    const rawTransito = getCell(row, ['TRÂNSITO', 'TRANSITO'], '');
    let tempoEntregaRodoviariaDias = cleanNumber(rawTransito);
    if (!tempoEntregaRodoviariaDias || String(rawTransito).trim().startsWith('#')) {
      tempoEntregaRodoviariaDias = diffDaysBetween(
        dataEntregaMFX,
        dataCarregamento || dataDesembaraco,
        2
      );
    }

    const rawLeadTime = getCell(row, ['LEAD TIME'], '');
    let leadTimeTotalDias = cleanNumber(rawLeadTime);
    if (!leadTimeTotalDias || String(rawLeadTime).trim().startsWith('#')) {
      leadTimeTotalDias =
        diffDaysBetween(dataEntregaMFX, etd, 0) ||
        transitTimeDias + tempoDesembaracoDias + tempoEntregaRodoviariaDias;
    }

    const statusRawExcel = String(getCell(row, ['STATUS', 'SITUACAO'], 'EM TRÂNSITO')).trim();
    const stageNumber = getProcessStage(statusRawExcel);
    const status = normalizeStatus(statusRawExcel);

    // Forecast dates vs. Actual completed dates based strictly on Column A stageNumber
    const forecastEntregaMFX = dataEntregaMFX || eta || 'A Confirmar';
    const actualChegadaEfetiva = stageNumber >= 4 ? dataChegadaEfetiva || eta || undefined : undefined;
    const actualRegistroDI = stageNumber >= 5 ? dataRegistroDI || undefined : undefined;
    const actualDesembaraco = stageNumber >= 6 ? dataDesembaraco || undefined : undefined;
    const actualEntregaMFX = stageNumber === 7 ? dataEntregaMFX || eta || undefined : undefined;
    const { alertaEtaVencido, alertaEntregaAtrasada } = detectDateInconsistencies(
      stageNumber,
      eta,
      forecastEntregaMFX
    );

    const dataVencimentoInvoice = getCellDate(
      row,
      ['DATA DE VENCIMENTO', 'VENCIMENTO'],
      eta || '2026-12-15'
    );

    const iiBRL = vmldBRL * 0.14;
    const ipiBRL = (vmldBRL + iiBRL) * 0.05;
    const pisBRL = vmldBRL * 0.021;
    const cofinsBRL = vmldBRL * 0.0965;
    const icmsBRL = vmldBRL * 0.22;
    const totalImpostosEstimadosBRL = iiBRL + ipiBRL + pisBRL + cofinsBRL + icmsBRL;

    const impostosSuspensosDrawbackBRL =
      regime === 'Drawback Suspensão' || regime === 'Ex-Tarifário'
        ? totalImpostosEstimadosBRL
        : 0;
    const impostosPagosIndevidamenteBRL =
      regime === 'Recolhimento Integral' && projeto !== 'ESTOQUE'
        ? totalImpostosEstimadosBRL
        : 0;

    const defaultAC =
      regime === 'Recolhimento Integral'
        ? 'SEM AC (Recolhimento)'
        : regime === 'Ex-Tarifário'
        ? 'EX-TARIFÁRIO'
        : projeto === 'PRIO'
        ? 'AC-2025/004115-2'
        : 'AC-2025/001482-9';

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
              compradorResponsavel,
              invoice: fatura,
              codigoItem: `OC-${oc}`,
              descricao: `Insumos & Equipamentos Importados — ${fornecedor} (${fatura || id})`,
              ncm: '8481.80.99',
              quantidade: 1,
              qtdAutorizadaAC: 100,
              unidade: 'UN',
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
      stripAccents(statusRawExcel.toUpperCase()).includes('DRAWBACK');

    const alertaPreAlertaAWB =
      modal === 'AÉREO' &&
      stageNumber < 7 &&
      (!numeroDiDuimp || numeroDiDuimp === 'Pendente Registro' || numeroDiDuimp === 'Aguardando Chegada');

    const blAwbCell = String(
      getCell(row, ['BL / AWB', 'BL/AWB', 'CONHECIMENTO'], '')
    ).trim();

    const effectiveNumeroDi =
      numeroDiDuimp !== 'Pendente Registro'
        ? numeroDiDuimp
        : stageNumber <= 3
        ? 'Aguardando Chegada'
        : 'Pendente Registro';
    const effectiveCanal = stageNumber >= 5 ? canal : 'Pendente Registro';

    const partialProc: ImportProcess = {
      id,
      compradorResponsavel,
      oc,
      commercialInvoice: fatura || 'S/ FATURA',
      fornecedor,
      paisOrigem:
        String(getCell(row, ['ORIGEM', 'PAIS'], '')).trim().toUpperCase() ||
        (fornecedor === 'KERUI'
          ? 'CHINA'
          : fornecedor === 'BSP' || fornecedor.includes('WALTHER') || fornecedor.includes('ACOTEQ')
          ? 'ALEMANHA'
          : fornecedor.includes('TRATOS')
          ? 'ITALIA'
          : 'EUA'),
      projeto,
      status: cargaParadaDrawback && stageNumber !== 7 ? 'Parado Ag. Drawback' : status,
      statusRawExcel: statusRawExcel || status,
      stageNumber,
      modal,
      incoterm,
      regime,
      beneficioRaw,
      atoConcessorio: defaultAC,
      despachante: 'ÔMEGA',
      agenteCarga,
      armadorCiaAerea: modal === 'AÉREO' ? 'Cia Aérea Internacional' : 'Armador Marítimo',
      blAwb:
        blAwbCell ||
        (effectiveNumeroDi !== 'Pendente Registro' && effectiveNumeroDi !== 'Aguardando Chegada'
          ? `DI ${effectiveNumeroDi}`
          : `REF-${id}`),
      numeroDiDuimp: effectiveNumeroDi,
      canal: effectiveCanal,
      liAnuente: anuencia,
      deferimentoLI: deferimentoLI || undefined,
      portoAeroportoDestino: localDesembaraco,
      dataPO: itens[0]?.dataEmissaoPO || etd || '2026-08-01',
      dataProntidaoCarga: itens[0]?.previsaoProntidaoCarga || etd || '2026-09-01',
      etd: etd || 'Aguardando',
      etaOriginalPO: eta || 'Aguardando',
      eta: eta || dataChegadaEfetiva || 'Aguardando',
      dataChegadaEfetiva: actualChegadaEfetiva,
      dataRegistroDI: actualRegistroDI,
      dataDesembaraco: actualDesembaraco,
      dataCarregamento: stageNumber >= 6 ? dataCarregamento || undefined : undefined,
      prazoEntregaMFX: actualEntregaMFX || forecastEntregaMFX,
      dataEntregaMFX: actualEntregaMFX,
      transitTimeDias,
      tempoDesembaracoDias,
      tempoEntregaRodoviariaDias,
      leadTimeTotalDias,
      freeTimeTotalDias: modal === 'AÉREO' ? 5 : 14,
      freeTimeDiasRestantes: stageNumber === 7 ? 10 : cargaParadaDrawback ? 2 : 7,
      cargaParadaDrawback: cargaParadaDrawback && stageNumber !== 7,
      motivoParadaDrawback:
        cargaParadaDrawback && stageNumber !== 7
          ? `Aguardando liberação / vinculação de Ato Concessório (${defaultAC}) em ${localDesembaraco}`
          : undefined,
      diasParadoPortoAeroporto:
        cargaParadaDrawback && stageNumber !== 7 ? Math.max(4, tempoDesembaracoDias) : 0,
      alertaPreAlertaAWB,
      alertaEtaVencido,
      alertaEntregaAtrasada,
      atrasoEtaDias: actualChegadaEfetiva ? diffDaysBetween(actualChegadaEfetiva, eta, 0) : 0,
      moeda,
      taxaPtaxDI,
      condicaoPagamento,
      dataVencimentoInvoice,
      statusPagamentoInvoice: stageNumber === 7 ? 'Pago' : 'A Vencer',
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

  // Merge any unshipped POs from PEDIDOS
  pedidosForecast.forEach((ped, idx) => {
    const hasMatchInProcessos = parsedProcessos.some(
      (p) =>
        (ped.processo && p.id === ped.processo) ||
        (ped.oc && (p.oc === ped.oc || p.oc.includes(ped.oc)))
    );
    if (!hasMatchInProcessos && ped.valor > 0) {
      const id =
        ped.processo && !seenProcessIds.has(ped.processo)
          ? ped.processo
          : `PO-${ped.oc || idx + 1}`;
      seenProcessIds.add(id);

      const taxa = ped.moeda === 'BRL' ? 1 : ptax[ped.moeda as 'USD' | 'EUR' | 'CNY'] || 5.7842;
      const vmleBRL = ped.valor * taxa;
      const vmldBRL = vmleBRL * 1.05;
      const statusNorm = normalizeStatus(ped.status, '', '', '', '');

      const poProc: ImportProcess = {
        id,
        compradorResponsavel: ped.compradorResponsavel || 'EUDE',
        oc: ped.oc,
        commercialInvoice: 'PO EM ABERTO',
        fornecedor: ped.fornecedor,
        paisOrigem:
          ped.fornecedor === 'KERUI'
            ? 'CHINA'
            : ped.fornecedor === 'BSP'
            ? 'ALEMANHA'
            : 'EUA',
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
    rawItems,
    pedidosCount:
      allLegacyPedidoRows.length > 0 ? allLegacyPedidoRows.length : parsedProcessos.length,
    sheetNames,
  };
}

// ============================================================================
// F. EXPORT TO EXCEL (INCLUDES MASTER FLAT ITEM SHEET + PROCESSOS + PEDIDOS)
// ============================================================================

export function exportMfxToExcel(
  processos: ImportProcess[],
  atosConcessorios: AtoConcessorio[],
  pedidosForecast: PedidoForecastRow[] = [],
  filename = 'FUP_IMPORTACAO_BI_MFX_EXPORT.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // 1. Sheet FUP_ITENS_MFX (Exact Real MFX Flat Item Table Col A - Col U)
  const headersFlat = [
    'STATUS',
    'REF. MFX',
    'COMPRADOR RESPONSAVEL',
    'PO',
    'FORNECEDOR',
    'ORIGEM',
    'INVOICE',
    'COD. MATERIAL',
    'DESCRIÇÃO',
    'QTD',
    'VALOR UNITÁRIO',
    'VALOR TOTAL',
    'UNIDADE DE MEDIDA',
    'AGENTE DE CARGAS',
    'BL / AWB',
    'INCOTERMS',
    'MODAL',
    'DATA PRONTIDÃO CARGA',
    'ETD',
    'ETA',
    'TT',
  ];

  const flatRows: any[][] = [];
  processos.forEach((p) => {
    p.itens.forEach((it) => {
      const sym = it.moeda === 'EUR' ? '€ ' : it.moeda === 'BRL' ? 'R$ ' : '$ ';
      flatRows.push([
        it.statusItem || p.statusRawExcel || p.status,
        p.id,
        it.compradorResponsavel || p.compradorResponsavel || 'EUDE',
        it.oc || p.oc,
        it.fornecedor || p.fornecedor,
        it.origem || p.paisOrigem,
        it.invoice || p.commercialInvoice,
        it.codigoItem,
        it.descricao,
        it.quantidade,
        `${sym}${it.valorUnitarioMoeda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        `${sym}${it.valorTotalMoeda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        it.unidade,
        p.agenteCarga,
        p.blAwb,
        p.incoterm,
        p.modal,
        it.previsaoProntidaoCarga || p.dataProntidaoCarga,
        it.etd || p.etd,
        it.eta || p.eta,
        p.transitTimeDias,
      ]);
    });
  });

  const wsFlat = XLSX.utils.aoa_to_sheet([headersFlat, ...flatRows]);
  XLSX.utils.book_append_sheet(wb, wsFlat, 'FUP IMPORTAÇÃO BI');

  // 2. Sheet PROCESSOS (36 Consolidated Columns)
  const headersProcessos = [
    'PROJETO',
    'PROCESSO',
    'COMPRADOR RESPONSAVEL',
    'EXPORTADOR',
    'ORIGEM',
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
    'BL / AWB',
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
    p.compradorResponsavel || 'EUDE',
    p.fornecedor,
    p.paisOrigem,
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
    p.blAwb,
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
    p.leadTimeTotalDias ??
      p.transitTimeDias + p.tempoDesembaracoDias + p.tempoEntregaRodoviariaDias,
    p.statusRawExcel || p.status,
    p.atoConcessorio,
  ]);

  const wsProcessos = XLSX.utils.aoa_to_sheet([
    ['ACOMPANHAMENTO DOS PROCESSOS DE IMPORTAÇÃO — MFX COMEX'],
    headersProcessos,
    ...dataRowsProcessos,
  ]);
  XLSX.utils.book_append_sheet(wb, wsProcessos, 'PROCESSOS');

  // 3. Sheet PEDIDOS
  const headersPedidos = [
    'PROJETO',
    'PROCESSO',
    'COMPRADOR RESPONSAVEL',
    'FORNECEDOR',
    'OC',
    'COD. MATERIAL',
    'DESCRIÇÃO',
    'QTD',
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
          pf.compradorResponsavel || 'EUDE',
          pf.fornecedor,
          pf.oc,
          pf.codMaterial || `OC-${pf.oc}`,
          pf.descricao || `Pedido ${pf.oc}`,
          pf.qtd || 1,
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
          p.compradorResponsavel || 'EUDE',
          p.fornecedor,
          p.oc,
          p.itens[0]?.codigoItem || `OC-${p.oc}`,
          p.itens[0]?.descricao || p.fornecedor,
          p.itens[0]?.quantidade || 1,
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

  // 4. Sheet ATOS_CONCESSORIOS
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
