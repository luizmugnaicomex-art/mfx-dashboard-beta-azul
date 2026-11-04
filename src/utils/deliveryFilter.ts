import { ImportProcess } from '../types/mfx';

// ============================================================================
// DELIVERY FILTER & WEEK CALCULATION ENGINE
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

// 2. Helper: Parse date string safely into a Date object at noon (12:00:00)
// To prevent timezone offset shifts when comparing calendar dates
export function parseDateSafe(dateVal?: string | Date | null): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  const str = String(dateVal).trim();
  if (
    !str ||
    str === 'Aguardando' ||
    str === 'A Confirmar' ||
    str === '-' ||
    str.startsWith('#') ||
    str === 'N/A'
  ) {
    return null;
  }

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  // Format: DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [d, m, y] = str.slice(0, 10).split('/').map(Number);
    const date = new Date(y, m - 1, d, 12, 0, 0);
    return isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// 3. Helper: Format Date to DD/MM/YYYY
export function formatDateBR(dt: Date | null): string {
  if (!dt || isNaN(dt.getTime())) return '-';
  const d = String(dt.getDate()).padStart(2, '0');
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const y = dt.getFullYear();
  return `${d}/${m}/${y}`;
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
  // Distance to Monday (if Sunday (0), go back 6 days; otherwise go back dayOfWeek - 1)
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

  // Jan 4th is always in ISO Week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1 (Mon) to 7 (Sun)
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
      formattedDate: 'A Confirmar',
    };
  }

  const dayIndex = date.getDay(); // 0 = Dom, 1 = Seg, 2 = Ter, 3 = Qua, 4 = Qui, 5 = Sex, 6 = Sáb
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
  // 'DELIVERY_OR_ETA': Use Delivery date if available, fallback to ETA
  return parseDateSafe(proc.dataEntregaMFX || proc.prazoEntregaMFX || proc.dataChegadaEfetiva || proc.eta);
}

// 9. Master Filter Options interface
export interface FilterDeliveriesOptions {
  showDelivered: boolean; // MUST be false by default!
  weekMode: WeekMode;
  customIsoWeek?: string; // e.g. "2026-W45"
  weekDateField: WeekDateField; // 'DELIVERY_OR_ETA' | 'ETA_ONLY'
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

  // Determine current active week bounds
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
      const delivered = isImportProcessDelivered(proc);

      // RULE 1: Hide Delivered by default unless showDelivered flag is TRUE
      if (!showDelivered && delivered) {
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
        const stage = proc.stageNumber ?? 3;
        const raw = (proc.statusRawExcel || proc.status || '').toUpperCase();

        if (activePill === 'TRANSITO') {
          if (delivered) return false;
          const inTransit = stage === 3 || raw.includes('TRANSITO') || raw.includes('AG. CHEGADA') || raw.includes('EMBARCADO');
          if (!inTransit) return false;
        } else if (activePill === 'PORTO') {
          if (delivered) return false;
          const inPort =
            stage === 4 ||
            stage === 5 ||
            raw.includes('PORTO') ||
            raw.includes('AEROPORTO') ||
            raw.includes('DESEMBARAÇO') ||
            raw.includes('DESEMBARACO') ||
            raw.includes('DRAWBACK');
          if (!inPort) return false;
        } else if (activePill === 'ROTA') {
          if (delivered) return false;
          const inRoad =
            stage === 6 ||
            raw.includes('RODOVIARIO') ||
            raw.includes('AG. ENTREGA') ||
            raw.includes('CARREGADO') ||
            raw.includes('LIBERADO');
          if (!inRoad) return false;
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
            proc.cargaParadaDrawback ||
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
        return false; // No valid date to match the selected week
      }

      const t = targetDateObj.getTime();

      if (weekMode === 'OVERDUE') {
        // Overdue = Target date is before Monday 00:00:00 of the reference week and NOT delivered
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
    'DATA BASE PREVISTA',
    'ETA PORTO',
    'ENTREGA MFX',
    'DESPACHANTE / AGENTE',
  ];

  const rows = processes.map((p) => {
    const targetDate = getProcessTargetDate(p, weekDateField);
    const dayInfo = getDayOfWeekInfo(targetDate);
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
      `"${dayInfo.formattedDate}"`,
      `"${formatDateBR(parseDateSafe(p.dataChegadaEfetiva || p.eta))}"`,
      `"${formatDateBR(parseDateSafe(p.dataEntregaMFX || p.prazoEntregaMFX))}"`,
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
