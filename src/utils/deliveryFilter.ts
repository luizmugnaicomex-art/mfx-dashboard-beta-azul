import { ImportProcess } from '../types/mfx';

// ============================================================================
// DELIVERY FILTER, 4-STEP DATE ENGINE & WEEK CALCULATION ENGINE
// Strict mathematical week ranges (Monday to Sunday) & Column A (STATUS) fidelity
// ============================================================================

export type WeekMode = 'ALL' | 'OVERDUE' | 'CURRENT_WEEK' | 'NEXT_WEEK' | 'PLUS_2_WEEKS' | 'CUSTOM_WEEK';
export type WeekDateField = 'DELIVERY_OR_ETA' | 'ETA_ONLY';

export interface WeekBounds {
  startOfWeek: Date;
  endOfWeek: Date;
  label: string;
  isoWeekStr: string;
  weekNumber: number;
  year: number;
}

// 1. Helper: Check if a process is Delivered based strictly on Column A (STATUS)
export function isProcessDelivered(statusRaw?: string): boolean {
  const norm = (statusRaw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // Match "ENTREGUE", "ENTREGUE MFX", "ENTREGUE NA FABRICA", "CONCLUIDO", "FINALIZADO"
  return (
    norm === 'ENTREGUE' ||
    norm.startsWith('ENTREGUE ') ||
    norm === 'CONCLUIDO' ||
    norm === 'FINALIZADO'
  );
}

// Check if an ImportProcess object is considered delivered
export function isImportProcessDelivered(proc: ImportProcess): boolean {
  if (proc.stageNumber === 7) return true;
  if (isProcessDelivered(proc.statusRawExcel)) return true;
  if (isProcessDelivered(proc.status)) return true;
  return false;
}

// Helper: Check if a process is Cancelled based strictly on Column A (STATUS)
export function isProcessCancelled(statusRaw?: string): boolean {
  const norm = (statusRaw || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  return norm.includes('CANCELAD') || norm.includes('CANCEL');
}

// Check if an ImportProcess object is considered cancelled
export function isImportProcessCancelled(proc: ImportProcess): boolean {
  if (isProcessCancelled(proc.statusRawExcel)) return true;
  if (isProcessCancelled(proc.status)) return true;
  return false;
}

// 2. Helper: Parse date string safely into a Date object at noon (12:00:00)
export function parseDateSafe(dateVal?: string | Date | null): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  const str = String(dateVal).trim();
  if (
    !str ||
    str === 'Aguardando' ||
    str === 'A Confirmar' ||
    str === 'S/ Data' ||
    str === '-' ||
    str.startsWith('#') ||
    str === 'N/A'
  ) {
    return null;
  }

  // Strip optional "Est. " prefix if present
  const cleanStr = str.replace(/^Est\.\s*/i, '').trim();

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(cleanStr)) {
    const [y, m, d] = cleanStr.slice(0, 10).split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  // Format: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(cleanStr)) {
    const [d, m, y] = cleanStr.slice(0, 10).split('/').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(cleanStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const parseStrictDate = parseDateSafe;

// 3. Helper: Format Date to DD/MM/YYYY
export function formatDateBR(dt: Date | null): string {
  if (!dt || isNaN(dt.getTime())) return 'S/ Data';
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
}

export function addDaysToDate(dt: Date, days: number): Date {
  const result = new Date(dt.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================================================
// 4-STEP TRACKER ENGINE WITH EXACT DATES (DD/MM/YYYY) & DRAWBACK/MODAL RULES
// ============================================================================

export interface StepBoxItem {
  title: string;
  badge: string;
  dateFormatted: string;
  state: 'completed' | 'current' | 'stalled' | 'forecast';
  style: string;
}

export interface Step4TrackerInfo {
  etdFormatted: string;
  etaFormatted: string;
  clearanceDateFormatted: string;
  deliveryDateFormatted: string;
  step1StatusLabel: string;
  step2StatusLabel: string;
  step3StatusLabel: string;
  step4StatusLabel: string;
  step1Style: string;
  step2Style: string;
  step3Style: string;
  step4Style: string;
  isDrawbackBlocked: boolean;
  isCustomsStage: boolean;
  numericStep: 1 | 2 | 3 | 3.5 | 4;
  currentStepIndex: 1 | 2 | 3 | 3.5 | 4;
  step1: StepBoxItem;
  step2: StepBoxItem;
  step3: StepBoxItem;
  step4: StepBoxItem;
}

export function getProcess4StepTrackerInfo(proc: ImportProcess): Step4TrackerInfo {
  const rawNorm = (proc.statusRawExcel || proc.status || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const isAir = proc.modal === 'AÉREO' || String(proc.modal || '').toUpperCase().includes('AER');
  const delivered = isImportProcessDelivered(proc);

  // 1. Parse base dates
  const etdDate = parseDateSafe(proc.etd) || parseDateSafe(proc.dataProntidaoCarga);
  const etaDate = parseDateSafe(proc.dataChegadaEfetiva) || parseDateSafe(proc.eta);
  const explicitClearanceDate = parseDateSafe(proc.dataDesembaraco) || parseDateSafe(proc.dataRegistroDI);
  const explicitDeliveryDate = parseDateSafe(proc.dataEntregaMFX) || parseDateSafe(proc.prazoEntregaMFX);

  // Format ETD (Box 1)
  const etdFormatted = proc.etdFormatted || (etdDate ? formatDateBR(etdDate) : 'S/ Data');

  // Format ETA (Box 2)
  const etaFormatted = proc.etaFormatted || (etaDate ? formatDateBR(etaDate) : 'S/ Data');

  // Format Clearance Date (Box 3): Explicit DI/Clearance date, or Estimated ETA + 4d (Air) / + 7d (Sea)
  let clearanceDateFormatted = proc.clearanceDateFormatted || '';
  if (!clearanceDateFormatted) {
    if (explicitClearanceDate && (!etaDate || explicitClearanceDate.getTime() !== etaDate.getTime())) {
      clearanceDateFormatted = formatDateBR(explicitClearanceDate);
    } else if (etaDate) {
      const estClearance = addDaysToDate(etaDate, isAir ? 4 : 7);
      clearanceDateFormatted = `Est. ${formatDateBR(estClearance)}`;
    } else {
      clearanceDateFormatted = 'S/ Data';
    }
  }

  // Format Factory Delivery Date (Box 4): Explicit Delivery date, or Estimated ETA + 6d (Air) / + 10d (Sea)
  let deliveryDateFormatted = proc.deliveryDateFormatted || '';
  if (!deliveryDateFormatted) {
    if (delivered && explicitDeliveryDate) {
      deliveryDateFormatted = formatDateBR(explicitDeliveryDate);
    } else if (
      explicitDeliveryDate &&
      (!etaDate || explicitDeliveryDate.getTime() !== etaDate.getTime())
    ) {
      deliveryDateFormatted = formatDateBR(explicitDeliveryDate);
    } else if (etaDate) {
      const estDelivery = addDaysToDate(etaDate, isAir ? 6 : 10);
      deliveryDateFormatted = `Est. ${formatDateBR(estDelivery)}`;
    } else {
      deliveryDateFormatted = 'S/ Data';
    }
  }

  // 2. Determine exact operational step from Column A (STATUS)
  const isCancelled = isImportProcessCancelled(proc);

  const isWaitingArrival =
    !isCancelled &&
    (rawNorm.includes('AG. CHEGADA') ||
      rawNorm.includes('AGUARDANDO CHEGADA') ||
      rawNorm.includes('EM TRANSITO') ||
      (rawNorm.includes('TRANSITO') && !rawNorm.includes('RODOVIARIO')) ||
      rawNorm.includes('EMBARCAD'));

  const isDrawbackBlocked =
    !delivered &&
    !isCancelled &&
    (proc.cargaParadaDrawback ||
      rawNorm.includes('DRAWBACK') ||
      rawNorm.includes('PARADO') ||
      rawNorm.includes('AG. ATO') ||
      rawNorm.includes('ATO CONCESSORIO') ||
      rawNorm.includes('AG. AC') ||
      rawNorm.includes('BLOQUEAD'));

  const isCustomsKeyword =
    !isWaitingArrival &&
    !isCancelled &&
    (isDrawbackBlocked ||
      rawNorm.includes('AG. DI') ||
      rawNorm.includes('AG. REGISTRO') ||
      rawNorm.includes('AGUARDANDO REGISTRO') ||
      rawNorm.includes('PRESENCA') ||
      rawNorm.includes('NO PORTO') ||
      rawNorm.includes('NO AEROPORTO') ||
      rawNorm.includes('DESEMBARACO') ||
      rawNorm.includes('CANAL') ||
      rawNorm.includes('PARAMETRIZAD') ||
      rawNorm.includes('PORTO') ||
      rawNorm.includes('AEROPORTO') ||
      rawNorm.includes('TECON') ||
      rawNorm.includes('TECA'));

  const isRoadDelivery =
    !delivered &&
    !isCancelled &&
    (proc.stageNumber === 6 ||
      rawNorm.includes('RODOVIARIO') ||
      rawNorm.includes('AG. ENTREGA') ||
      rawNorm.includes('AGUARDANDO ENTREGA') ||
      rawNorm.includes('DESEMBARACADO') ||
      rawNorm.includes('LIBERADO') ||
      rawNorm.includes('CARREGADO') ||
      rawNorm.includes('EM ROTA'));

  const isPreShipment =
    !delivered &&
    !isCancelled &&
    !isRoadDelivery &&
    !isCustomsKeyword &&
    !isWaitingArrival &&
    (proc.stageNumber === 1 ||
      proc.stageNumber === 2 ||
      rawNorm.includes('PRODUCAO') ||
      rawNorm.includes('FORNECEDOR') ||
      rawNorm.includes('AG. EMBARQUE') ||
      rawNorm.includes('AGUARDANDO EMBARQUE') ||
      rawNorm.includes('PRONTIDAO') ||
      rawNorm.includes('FABRICACAO') ||
      rawNorm.includes('PEDIDO') ||
      rawNorm.includes('COLETA') ||
      rawNorm.includes('AWB'));

  // Special check from Requirement 4:
  // If in customs/drawback, Step 2 is completed unless ETA is in the future AND there is no ETD
  const now = new Date();
  const etaInFutureWithoutEtd = Boolean(!etdDate && etaDate && etaDate.getTime() > now.getTime());

  let numericStep: 1 | 2 | 3 | 3.5 | 4 = 2;
  if (isCancelled) {
    numericStep = 1;
  } else if (delivered) {
    numericStep = 4;
  } else if (isRoadDelivery) {
    numericStep = 3.5;
  } else if (isCustomsKeyword || proc.stageNumber === 4 || proc.stageNumber === 5) {
    numericStep = etaInFutureWithoutEtd ? 1 : 3;
  } else if (isPreShipment) {
    numericStep = 1;
  } else {
    numericStep = 2;
  }

  // Styles palette
  const styleCompleted =
    'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300';
  const styleCurrentBlue =
    'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-300 ring-2 ring-blue-400/20';
  const styleCurrentAmber =
    'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-400/20';
  const styleCurrentRed =
    'bg-red-50 dark:bg-red-950/60 border-red-500 text-red-800 dark:text-red-200 ring-2 ring-red-500/30';
  const styleForecast =
    'bg-gray-50 dark:bg-gray-800/60 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400';

  // Step 1: 1. Embarque
  const step1Completed = numericStep > 1;
  const step1StatusLabel = step1Completed
    ? numericStep === 3 && isCustomsKeyword
      ? '✅ Concluído'
      : '✅ Embarcado'
    : '⏳ Ag. Embarque';
  const step1Style = step1Completed ? styleCompleted : styleCurrentBlue;

  // Step 2: 2. Chegada
  const step2Completed = numericStep > 2;
  const step2Active = numericStep === 2;
  const step2StatusLabel = step2Completed
    ? isCustomsKeyword
      ? '✅ Chegou Brasil'
      : '✅ No Porto/Aerop.'
    : step2Active
    ? isAir
      ? '✈️ Em Voo'
      : '🚢 No Mar'
    : '🕒 Previsto';
  const step2Style = step2Completed
    ? styleCompleted
    : step2Active
    ? styleCurrentBlue
    : styleForecast;

  // Step 3: 3. Liberação
  const step3Completed = numericStep > 3;
  const step3Active = numericStep === 3;
  const step3StatusLabel = step3Completed
    ? '✅ Desembaraçado'
    : isDrawbackBlocked
    ? '🛑 Parado Drawback'
    : step3Active
    ? '⏳ Em Liberação'
    : '🕒 Previsto';
  const step3Style = step3Completed
    ? styleCompleted
    : isDrawbackBlocked
    ? styleCurrentRed
    : step3Active
    ? styleCurrentAmber
    : styleForecast;

  // Step 4: 4. Fábrica
  const step4Completed = numericStep === 4;
  const step4Active = numericStep === 3.5;
  const step4StatusLabel = step4Completed
    ? '✅ Entregue MFX'
    : step4Active
    ? '🚛 Em Rota MFX'
    : '🕒 Previsto';
  const step4Style = step4Completed
    ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200'
    : step4Active
    ? styleCurrentBlue
    : styleForecast;

  return {
    etdFormatted,
    etaFormatted,
    clearanceDateFormatted,
    deliveryDateFormatted,
    step1StatusLabel,
    step2StatusLabel,
    step3StatusLabel,
    step4StatusLabel,
    step1Style,
    step2Style,
    step3Style,
    step4Style,
    isDrawbackBlocked,
    isCustomsStage: numericStep === 3,
    numericStep,
    currentStepIndex: numericStep,
    step1: {
      title: '1. Embarque',
      badge: step1StatusLabel,
      dateFormatted: etdFormatted,
      state: step1Completed ? 'completed' : 'current',
      style: step1Style,
    },
    step2: {
      title: '2. Chegada',
      badge: step2StatusLabel,
      dateFormatted: etaFormatted,
      state: step2Completed ? 'completed' : step2Active ? 'current' : 'forecast',
      style: step2Style,
    },
    step3: {
      title: '3. Liberação',
      badge: step3StatusLabel,
      dateFormatted: clearanceDateFormatted,
      state: step3Completed
        ? 'completed'
        : isDrawbackBlocked
        ? 'stalled'
        : step3Active
        ? 'current'
        : 'forecast',
      style: step3Style,
    },
    step4: {
      title: '4. Fábrica',
      badge: step4StatusLabel,
      dateFormatted: deliveryDateFormatted,
      state: step4Completed ? 'completed' : step4Active ? 'current' : 'forecast',
      style: step4Style,
    },
  };
}

// 4. Helper: Get ISO Week string ("YYYY-Www") for a Date
export function getIsoWeekString(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7; // Monday = 1, Sunday = 7
  d.setDate(d.getDate() + 4 - day); // Thursday of this week determines the ISO year
  const year = d.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

// 5. Helper: Get Monday 00:00:00 and Sunday 23:59:59 for any reference date and week offset
export function getWeekBounds(referenceDate: Date, weekOffset: number = 0): WeekBounds {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const dayOfWeek = d.getDay(); // 0 (Sun) to 6 (Sat)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() + diffToMonday + weekOffset * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const isoWeekStr = getIsoWeekString(startOfWeek);
  const weekNumber = parseInt(isoWeekStr.split('-W')[1], 10) || 1;

  return {
    startOfWeek,
    endOfWeek,
    label: `${formatDateBR(startOfWeek)} (Seg) a ${formatDateBR(endOfWeek)} (Dom)`,
    isoWeekStr,
    weekNumber,
    year: startOfWeek.getFullYear(),
  };
}

// 6. Helper: Parse ISO Week string ("2026-W45") into Monday 00:00:00 - Sunday 23:59:59 bounds
export function getBoundsFromIsoWeek(isoWeekStr: string): WeekBounds | null {
  if (!isoWeekStr || !isoWeekStr.includes('-W')) return null;
  const [yearStr, weekPart] = isoWeekStr.split('-W');
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekPart, 10);
  if (isNaN(year) || isNaN(week)) return null;

  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

  const startOfWeek = new Date(mondayWeek1);
  startOfWeek.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    startOfWeek,
    endOfWeek,
    label: `Semana ${week}: ${formatDateBR(startOfWeek)} (Seg) a ${formatDateBR(endOfWeek)} (Dom)`,
    isoWeekStr,
    weekNumber: week,
    year,
  };
}

// 7. Helper: Get Day-of-Week info for display badges
export function getDayOfWeekInfo(date: Date | null): {
  dayIndex: number;
  dayName: string;
  dayAbbr: string;
  formattedDate: string;
} {
  if (!date || isNaN(date.getTime())) {
    return {
      dayIndex: -1,
      dayName: 'DATA A CONFIRMAR',
      dayAbbr: 'A Conf.',
      formattedDate: 'S/ Data',
    };
  }

  const dayIndex = date.getDay();
  const names = [
    'DOMINGO',
    'SEGUNDA-FEIRA',
    'TERÇA-FEIRA',
    'QUARTA-FEIRA',
    'QUINTA-FEIRA',
    'SEXTA-FEIRA',
    'SÁBADO',
  ];
  const abbrs = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return {
    dayIndex,
    dayName: names[dayIndex] || 'SEGUNDA-FEIRA',
    dayAbbr: abbrs[dayIndex] || 'Seg',
    formattedDate: formatDateBR(date),
  };
}

// 8. Helper: Resolve the active target date for a process
export function getProcessTargetDate(
  proc: ImportProcess,
  weekDateField: WeekDateField = 'DELIVERY_OR_ETA'
): Date | null {
  if (weekDateField === 'ETA_ONLY') {
    return parseDateSafe(proc.dataChegadaEfetiva || proc.eta);
  }
  // 'DELIVERY_OR_ETA': Use explicit Delivery date if available, else calculated delivery date, fallback to ETA
  const explicitDel = parseDateSafe(proc.dataEntregaMFX || proc.prazoEntregaMFX);
  if (explicitDel) return explicitDel;
  const etaDt = parseDateSafe(proc.dataChegadaEfetiva || proc.eta);
  if (etaDt) {
    const isAir = proc.modal === 'AÉREO' || String(proc.modal || '').toUpperCase().includes('AER');
    return addDaysToDate(etaDt, isAir ? 6 : 10);
  }
  return null;
}

// 9. Master Filter Options interface
export interface FilterDeliveriesOptions {
  showDelivered: boolean; // MUST be false by default!
  weekMode: WeekMode;
  customIsoWeek?: string;
  weekDateField: WeekDateField;
  referenceToday: Date;
  searchQuery?: string;
  projectFilter?: string;
  activePill?: 'TODOS' | 'TRANSITO' | 'PORTO' | 'ROTA' | 'ENTREGUE' | 'ATENCAO';
}

// 10. Master Filter Function for Deliveries
export function filterDeliveries(
  allProcesses: ImportProcess[],
  options: FilterDeliveriesOptions
): ImportProcess[] {
  const {
    showDelivered,
    weekMode,
    customIsoWeek,
    weekDateField,
    referenceToday,
    searchQuery = '',
    projectFilter = 'ALL',
    activePill = 'TODOS',
  } = options;

  const todayBounds = getWeekBounds(referenceToday, 0);
  const q = searchQuery.toLowerCase().trim();

  let targetBounds: WeekBounds | null = null;
  if (weekMode === 'CURRENT_WEEK') {
    targetBounds = todayBounds;
  } else if (weekMode === 'NEXT_WEEK') {
    targetBounds = getWeekBounds(referenceToday, 1);
  } else if (weekMode === 'PLUS_2_WEEKS') {
    targetBounds = getWeekBounds(referenceToday, 2);
  } else if (weekMode === 'CUSTOM_WEEK' && customIsoWeek) {
    targetBounds = getBoundsFromIsoWeek(customIsoWeek);
  }

  return allProcesses
    .filter((proc) => {
      // RULE 0: Never show Cancelled processes on the Deliveries panel (prevents confusion)
      if (isImportProcessCancelled(proc)) {
        return false;
      }

      const delivered = isImportProcessDelivered(proc);

      // RULE 1: Hide Delivered by default unless showDelivered flag is TRUE (or ENTREGUE pill explicitly clicked)
      if (!showDelivered && delivered && activePill !== 'ENTREGUE') {
        return false;
      }

      // Search Query Filter
      if (q) {
        const matchSearch =
          proc.id.toLowerCase().includes(q) ||
          proc.oc.toLowerCase().includes(q) ||
          proc.fornecedor.toLowerCase().includes(q) ||
          (proc.compradorResponsavel && proc.compradorResponsavel.toLowerCase().includes(q)) ||
          (proc.projeto && proc.projeto.toLowerCase().includes(q)) ||
          (proc.commercialInvoice && proc.commercialInvoice.toLowerCase().includes(q)) ||
          (proc.blAwb && proc.blAwb.toLowerCase().includes(q)) ||
          (proc.itens &&
            proc.itens.some(
              (it) => it.descricao.toLowerCase().includes(q) || it.codigoItem.toLowerCase().includes(q)
            ));

        if (!matchSearch) return false;
      }

      // Project Filter
      if (projectFilter !== 'ALL' && proc.projeto !== projectFilter) {
        return false;
      }

      // Status Pill Filter
      if (activePill !== 'TODOS') {
        const stepInfo = getProcess4StepTrackerInfo(proc);

        if (activePill === 'TRANSITO') {
          if (delivered) return false;
          if (stepInfo.numericStep !== 2) return false;
        } else if (activePill === 'PORTO') {
          if (delivered) return false;
          if (stepInfo.numericStep !== 3) return false;
        } else if (activePill === 'ROTA') {
          if (delivered) return false;
          if (stepInfo.numericStep !== 3.5) return false;
        } else if (activePill === 'ENTREGUE') {
          if (!delivered) return false;
        } else if (activePill === 'ATENCAO') {
          if (delivered) return false;
          const todayStr = referenceToday.toISOString().slice(0, 10);
          const etaPassed = proc.eta && proc.eta.length === 10 && proc.eta < todayStr;
          const deliveryPassed = proc.prazoEntregaMFX && proc.prazoEntregaMFX.length === 10 && proc.prazoEntregaMFX < todayStr;
          const attention = Boolean(
            proc.alertaEtaVencido ||
            proc.alertaEntregaAtrasada ||
            etaPassed ||
            deliveryPassed ||
            stepInfo.isDrawbackBlocked ||
            proc.riskLevel === 'high'
          );
          if (!attention) return false;
        }
      }

      // RULE 2: Week Filter
      if (weekMode === 'ALL') {
        return true;
      }

      const targetDateObj = getProcessTargetDate(proc, weekDateField);

      if (!targetDateObj || isNaN(targetDateObj.getTime())) {
        return false;
      }

      const t = targetDateObj.getTime();

      if (weekMode === 'OVERDUE') {
        return t < todayBounds.startOfWeek.getTime() && !delivered;
      }

      if (!targetBounds) {
        return true;
      }

      return t >= targetBounds.startOfWeek.getTime() && t <= targetBounds.endOfWeek.getTime();
    })
    // Sort chronologically by target date (Monday to Sunday)
    .sort((a, b) => {
      const dtA = getProcessTargetDate(a, weekDateField);
      const dtB = getProcessTargetDate(b, weekDateField);
      if (!dtA && !dtB) return 0;
      if (!dtA) return 1;
      if (!dtB) return -1;
      return dtA.getTime() - dtB.getTime();
    });
}

// 11. Helper: Export the currently filtered week deliveries to a clean CSV
export function exportWeekDeliveriesToCSV(
  processes: ImportProcess[],
  weekDescription: string,
  weekDateField: WeekDateField
): void {
  const headers = [
    'REF. MFX',
    'PO / OC',
    'PROJETO',
    'FORNECEDOR',
    'ORIGEM',
    'MATERIAL PRINCIPAL',
    'QUANTIDADE',
    'UNIDADE',
    'MODAL',
    'BL / AWB',
    'STATUS FUP (COL A)',
    'DIA DA SEMANA',
    '1. EMBARQUE (ETD)',
    '2. CHEGADA (ETA)',
    '3. LIBERACAO (DI/ADUANA)',
    '4. FABRICA MFX (ENTREGA)',
    'DESPACHANTE / AGENTE',
  ];

  const rows = processes.map((p) => {
    const targetDate = getProcessTargetDate(p, weekDateField);
    const dayInfo = getDayOfWeekInfo(targetDate);
    const stepInfo = getProcess4StepTrackerInfo(p);
    const item = p.itens[0];

    return [
      `"${p.id}"`,
      `"${p.oc.replace(/"/g, '""')}"`,
      `"${p.projeto}"`,
      `"${p.fornecedor.replace(/"/g, '""')}"`,
      `"${p.paisOrigem}"`,
      `"${(item?.descricao || 'Material Comex').replace(/"/g, '""')}"`,
      item ? item.quantidade : '',
      `"${item?.unidade || 'UN'}"`,
      `"${p.modal}"`,
      `"${p.blAwb}"`,
      `"${(p.statusRawExcel || p.status).replace(/"/g, '""')}"`,
      `"${dayInfo.dayName}"`,
      `"${stepInfo.etdFormatted}"`,
      `"${stepInfo.etaFormatted}"`,
      `"${stepInfo.clearanceDateFormatted}"`,
      `"${stepInfo.deliveryDateFormatted}"`,
      `"${p.despachante || p.agenteCarga || 'ÔMEGA'}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = weekDescription.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  a.href = url;
  a.download = `Relatorio_Entregas_Semana_${safeTitle}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
