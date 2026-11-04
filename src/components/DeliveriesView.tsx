import React, { useState, useMemo } from 'react';
import { ImportProcess } from '../types/mfx';
import {
  WeekMode,
  WeekDateField,
  getWeekBounds,
  getBoundsFromIsoWeek,
  getIsoWeekString,
  getDayOfWeekInfo,
  getProcessTargetDate,
  filterDeliveries,
  isImportProcessDelivered,
  exportWeekDeliveriesToCSV,
  formatDateBR,
} from '../utils/deliveryFilter';
import { ComexTvSlidePanel } from './ComexTvSlidePanel';

interface DeliveriesViewProps {
  processos: ImportProcess[];
  onSelectProcess: (proc: ImportProcess) => void;
  isOnlineSynced?: boolean;
  presentationMode?: boolean;
  onTogglePresentationMode?: () => void;
  lastUpdatedTime?: string;
  sourceFileName?: string;
}

type DeliveryPill = 'TODOS' | 'TRANSITO' | 'PORTO' | 'ROTA' | 'ENTREGUE' | 'ATENCAO';

export const DeliveriesView: React.FC<DeliveriesViewProps> = ({
  processos,
  onSelectProcess,
  isOnlineSynced = true,
  presentationMode = false,
  onTogglePresentationMode,
  lastUpdatedTime,
  sourceFileName,
}) => {
  // Reference date: Current date (system date)
  const referenceToday = useMemo(() => new Date(), []);
  const todayIsoWeek = useMemo(() => getIsoWeekString(referenceToday), [referenceToday]);

  // Filter States
  const [showDelivered, setShowDelivered] = useState<boolean>(false); // MUST be false by default!
  const [weekMode, setWeekMode] = useState<WeekMode>('ALL');
  const [customIsoWeek, setCustomIsoWeek] = useState<string>(todayIsoWeek);
  const [weekDateField, setWeekDateField] = useState<WeekDateField>('DELIVERY_OR_ETA');
  const [filterText, setFilterText] = useState('');
  const [activePill, setActivePill] = useState<DeliveryPill>('TODOS');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState<boolean>(false);

  // Pre-calculate Quick Week Labels for Buttons
  const currentWeekBounds = useMemo(() => getWeekBounds(referenceToday, 0), [referenceToday]);
  const nextWeekBounds = useMemo(() => getWeekBounds(referenceToday, 1), [referenceToday]);
  const plus2WeeksBounds = useMemo(() => getWeekBounds(referenceToday, 2), [referenceToday]);

  // Pre-calculate active period info for the banner
  const activePeriodInfo = useMemo(() => {
    if (weekMode === 'ALL') {
      return {
        label: 'Todas as Semanas (Sem restrição de data)',
        dates: 'Todas as cargas pendentes da base',
      };
    }
    if (weekMode === 'OVERDUE') {
      return {
        label: `Atrasados (< ${formatDateBR(currentWeekBounds.startOfWeek)})`,
        dates: `Anteriores a Segunda-feira (${formatDateBR(currentWeekBounds.startOfWeek)})`,
      };
    }
    if (weekMode === 'CURRENT_WEEK') {
      return {
        label: `Esta Semana (${currentWeekBounds.label})`,
        dates: `${formatDateBR(currentWeekBounds.startOfWeek)} (Segunda-feira) até ${formatDateBR(currentWeekBounds.endOfWeek)} (Domingo)`,
      };
    }
    if (weekMode === 'NEXT_WEEK') {
      return {
        label: `Próxima Semana (${nextWeekBounds.label})`,
        dates: `${formatDateBR(nextWeekBounds.startOfWeek)} (Segunda-feira) até ${formatDateBR(nextWeekBounds.endOfWeek)} (Domingo)`,
      };
    }
    if (weekMode === 'PLUS_2_WEEKS') {
      return {
        label: `+2 Semanas (${plus2WeeksBounds.label})`,
        dates: `${formatDateBR(plus2WeeksBounds.startOfWeek)} (Segunda-feira) até ${formatDateBR(plus2WeeksBounds.endOfWeek)} (Domingo)`,
      };
    }
    if (weekMode === 'CUSTOM_WEEK' && customIsoWeek) {
      const b = getBoundsFromIsoWeek(customIsoWeek);
      if (b) {
        return {
          label: b.label,
          dates: `${formatDateBR(b.startOfWeek)} (Segunda-feira) até ${formatDateBR(b.endOfWeek)} (Domingo)`,
        };
      }
    }
    return {
      label: 'Semana Selecionada',
      dates: 'Período customizado',
    };
  }, [weekMode, customIsoWeek, currentWeekBounds, nextWeekBounds, plus2WeeksBounds]);

  // Extract all distinct ISO weeks present in the spreadsheet data
  const availableWeeksList = useMemo(() => {
    const weekMap = new Map<string, { iso: string; label: string; count: number }>();

    // Add current, next, +2 weeks to ensure they exist
    [currentWeekBounds, nextWeekBounds, plus2WeeksBounds].forEach((b) => {
      weekMap.set(b.isoWeekStr, {
        iso: b.isoWeekStr,
        label: `Semana ${b.weekNumber}: ${b.label}`,
        count: 0,
      });
    });

    processos.forEach((p) => {
      const dt = getProcessTargetDate(p, weekDateField);
      if (dt) {
        const iso = getIsoWeekString(dt);
        const bounds = getBoundsFromIsoWeek(iso);
        if (bounds) {
          const existing = weekMap.get(iso);
          if (existing) {
            existing.count += 1;
          } else {
            weekMap.set(iso, {
              iso,
              label: bounds.label,
              count: 1,
            });
          }
        }
      }
    });

    return Array.from(weekMap.values()).sort((a, b) => a.iso.localeCompare(b.iso));
  }, [processos, weekDateField, currentWeekBounds, nextWeekBounds, plus2WeeksBounds]);

  // Week Navigator: Previous / Next Week
  const handleShiftWeek = (delta: number) => {
    let currentIso = customIsoWeek;
    if (weekMode === 'CURRENT_WEEK') currentIso = currentWeekBounds.isoWeekStr;
    else if (weekMode === 'NEXT_WEEK') currentIso = nextWeekBounds.isoWeekStr;
    else if (weekMode === 'PLUS_2_WEEKS') currentIso = plus2WeeksBounds.isoWeekStr;

    const bounds = getBoundsFromIsoWeek(currentIso);
    if (!bounds) return;

    const newStart = new Date(bounds.startOfWeek);
    newStart.setDate(newStart.getDate() + delta * 7);
    const newIso = getIsoWeekString(newStart);

    setCustomIsoWeek(newIso);
    setWeekMode('CUSTOM_WEEK');
  };

  // Total delivered items in the dataset
  const totalDeliveredCount = useMemo(() => {
    return processos.filter(isImportProcessDelivered).length;
  }, [processos]);

  // Count delivered items that would match the current filters but are currently hidden
  const hiddenDeliveredCount = useMemo(() => {
    if (showDelivered) return 0;
    // Filter with showDelivered = true to find what is hidden
    const withDelivered = filterDeliveries(processos, {
      showDelivered: true,
      weekMode,
      customIsoWeek,
      weekDateField,
      referenceToday,
      searchQuery: filterText,
      projectFilter: selectedProject,
      activePill,
    });
    return withDelivered.filter(isImportProcessDelivered).length;
  }, [
    processos,
    showDelivered,
    weekMode,
    customIsoWeek,
    weekDateField,
    referenceToday,
    filterText,
    selectedProject,
    activePill,
  ]);

  // Master Filtered Deliveries List
  const filteredDeliveries = useMemo(() => {
    return filterDeliveries(processos, {
      showDelivered,
      weekMode,
      customIsoWeek,
      weekDateField,
      referenceToday,
      searchQuery: filterText,
      projectFilter: selectedProject,
      activePill,
    });
  }, [
    processos,
    showDelivered,
    weekMode,
    customIsoWeek,
    weekDateField,
    referenceToday,
    filterText,
    selectedProject,
    activePill,
  ]);

  // Top 3 Customer Summary Card Metrics (Dynamic based on filtered dataset)
  const countInTransitOrArriving = useMemo(() => {
    return filteredDeliveries.filter((p) => {
      const isDel = isImportProcessDelivered(p);
      if (isDel) return false;
      const stage = p.stageNumber ?? 3;
      const raw = (p.statusRawExcel || p.status || '').toUpperCase();
      return (
        stage === 3 ||
        stage === 4 ||
        stage === 5 ||
        raw.includes('TRANSITO') ||
        raw.includes('AG. CHEGADA') ||
        raw.includes('PORTO') ||
        raw.includes('DESEMBARAÇO') ||
        raw.includes('DESEMBARACO')
      );
    }).length;
  }, [filteredDeliveries]);

  const countNext15Days = useMemo(() => {
    const now = new Date();
    return filteredDeliveries.filter((p) => {
      if (isImportProcessDelivered(p)) return false;
      const targetDate = getProcessTargetDate(p, weekDateField);
      if (!targetDate) return false;
      const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= -2 && diffDays <= 15;
    }).length;
  }, [filteredDeliveries, weekDateField]);

  const countDelivered = useMemo(() => {
    return filteredDeliveries.filter(isImportProcessDelivered).length;
  }, [filteredDeliveries]);

  // Pill live counts (Calculated with showDelivered respected)
  const pillCounts = useMemo(() => {
    const baseList = filterDeliveries(processos, {
      showDelivered,
      weekMode,
      customIsoWeek,
      weekDateField,
      referenceToday,
      searchQuery: filterText,
      projectFilter: selectedProject,
      activePill: 'TODOS',
    });

    const isAttention = (p: ImportProcess) => {
      if (isImportProcessDelivered(p)) return false;
      const todayStr = referenceToday.toISOString().slice(0, 10);
      const etaPassed = p.eta && p.eta.length === 10 && p.eta < todayStr;
      const deliveryPassed = p.prazoEntregaMFX && p.prazoEntregaMFX.length === 10 && p.prazoEntregaMFX < todayStr;
      return Boolean(
        p.alertaEtaVencido ||
        p.alertaEntregaAtrasada ||
        etaPassed ||
        deliveryPassed ||
        p.cargaParadaDrawback ||
        p.riskLevel === 'high'
      );
    };

    return {
      TODOS: baseList.length,
      TRANSITO: baseList.filter((p) => {
        if (isImportProcessDelivered(p)) return false;
        const stage = p.stageNumber ?? 3;
        const raw = (p.statusRawExcel || p.status || '').toUpperCase();
        return stage === 3 || raw.includes('TRANSITO') || raw.includes('AG. CHEGADA') || raw.includes('EMBARCADO');
      }).length,
      PORTO: baseList.filter((p) => {
        if (isImportProcessDelivered(p)) return false;
        const stage = p.stageNumber ?? 3;
        const raw = (p.statusRawExcel || p.status || '').toUpperCase();
        return (
          stage === 4 ||
          stage === 5 ||
          raw.includes('PORTO') ||
          raw.includes('AEROPORTO') ||
          raw.includes('DESEMBARAÇO') ||
          raw.includes('DESEMBARACO') ||
          raw.includes('DRAWBACK')
        );
      }).length,
      ROTA: baseList.filter((p) => {
        if (isImportProcessDelivered(p)) return false;
        const stage = p.stageNumber ?? 3;
        const raw = (p.statusRawExcel || p.status || '').toUpperCase();
        return stage === 6 || raw.includes('RODOVIARIO') || raw.includes('AG. ENTREGA') || raw.includes('CARREGADO') || raw.includes('LIBERADO');
      }).length,
      ENTREGUE: baseList.filter(isImportProcessDelivered).length,
      ATENCAO: baseList.filter(isAttention).length,
    };
  }, [
    processos,
    showDelivered,
    weekMode,
    customIsoWeek,
    weekDateField,
    referenceToday,
    filterText,
    selectedProject,
  ]);

  // Projects list
  const projectsList = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => {
      if (p.projeto) set.add(p.projeto);
    });
    return Array.from(set);
  }, [processos]);

  // Handler for Exporting Weekly Schedule
  const handleExportWeek = () => {
    exportWeekDeliveriesToCSV(
      filteredDeliveries,
      activePeriodInfo.label,
      weekDateField
    );
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Aguardando' || dateStr === 'A Confirmar') return dateStr || 'A Confirmar';
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          CUSTOMER TOP HEADER & 3 SUMMARY CARDS
         ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-blue-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
                🚚 Portal de Entregas MFX — Relatório Seg/Qua/Sex
              </span>
              {isOnlineSynced ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  🟢 Online (Firebase Sync)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  🟠 Modo Cache Local
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3 text-white">
              Acompanhamento de Entregas da Semana
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mt-1">
              Visão simplificada em tempo real para Engenharia, Gerentes de Projetos (PETROBRAS, PRIO, EXPANSÃO), PCP e Diretoria.
            </p>
            {lastUpdatedTime && (
              <p className="text-[11px] text-blue-200/80 mt-2 font-mono">
                <i className="far fa-clock mr-1"></i>Última atualização da base: <strong>{lastUpdatedTime}</strong>
                {sourceFileName && ` • Fonte: ${sourceFileName}`}
              </p>
            )}
          </div>

          {/* Customer View Toggle, Slide Panel TV & Export */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
            {/* SLIDE PANEL BUTTON FOR COMEX ROOM TV */}
            <button
              id="open-slide-panel-btn"
              type="button"
              onClick={() => setIsSlidePanelOpen(true)}
              title="Abrir Painel de Slides Rotativo para TV na Sala Comex / Teams"
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 cursor-pointer border border-cyan-300/50 ring-2 ring-cyan-400/20"
            >
              <i className="fas fa-tv text-base animate-pulse"></i>
              <span>📺 Slide Panel (TV Sala Comex)</span>
            </button>

            {/* Export Weekly Schedule Button */}
            <button
              type="button"
              onClick={handleExportWeek}
              title="Baixar planilha de entregas filtradas para envio"
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer border border-emerald-400/50"
            >
              <i className="fas fa-file-csv"></i>
              <span>📤 Exportar Relatório da Semana ({filteredDeliveries.length})</span>
            </button>

            {onTogglePresentationMode && (
              <button
                type="button"
                onClick={onTogglePresentationMode}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                  presentationMode
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-900 border border-amber-300'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                }`}
              >
                <i className={`fas ${presentationMode ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                {presentationMode ? 'Sair do Modo Apresentação' : '👁️ Modo Apresentação / Cliente'}
              </button>
            )}
          </div>
        </div>

        {/* 3 Simple Customer-Centric Summary Cards (Dynamic) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/15">
          {/* Card 1: Em Trânsito / Chegando */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-blue-200 block">
                Pedidos em Trânsito / Chegando
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1 tabular-nums">
                {countInTransitOrArriving} <span className="text-sm font-normal text-blue-200">cargas</span>
              </div>
              <span className="text-[11px] text-slate-300 block mt-1">
                Em transporte marítimo/aéreo ou no porto
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 text-xl">
              <i className="fas fa-ship"></i>
            </div>
          </div>

          {/* Card 2: Próximas Entregas (7 a 15 Dias) */}
          <div className="bg-amber-500/15 backdrop-blur-md rounded-xl p-4 border border-amber-400/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-amber-200 block">
                Próximas Entregas (Janela 7 a 15 Dias)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300 mt-1 tabular-nums">
                {countNext15Days} <span className="text-sm font-normal text-amber-200">pedidos</span>
              </div>
              <span className="text-[11px] text-amber-200/90 block mt-1">
                Previsão de entrega imediata na fábrica MFX
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 text-xl">
              <i className="fas fa-calendar-check"></i>
            </div>
          </div>

          {/* Card 3: Entregas Concluídas */}
          <div className="bg-emerald-500/15 backdrop-blur-md rounded-xl p-4 border border-emerald-400/30 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-emerald-200 block">
                Entregas Concluídas (Exibidas)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300 mt-1 tabular-nums">
                {countDelivered} <span className="text-sm font-normal text-emerald-200">pedidos</span>
              </div>
              <span className="text-[11px] text-emerald-200/90 block mt-1">
                {showDelivered ? 'Materiais recebidos na MFX' : `${hiddenDeliveredCount} entregues ocultos (clique em Mostrar)`}
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 text-xl">
              <i className="fas fa-circle-check"></i>
            </div>
          </div>
        </div>

        {/* Quick Search & Status Pills */}
        <div className="mt-6 pt-5 border-t border-white/15 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8 relative">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-blue-200"></i>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="🔍 Rastrear por PO, Processo (REF. MFX), Material, Fornecedor ou Projeto..."
                className="w-full pl-11 pr-4 py-3 text-xs sm:text-sm bg-white/15 text-white placeholder-blue-200/70 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-inner"
              />
            </div>
            <div className="sm:col-span-4">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-4 py-3 text-xs sm:text-sm bg-white/15 text-white border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="ALL" className="text-gray-900">Todos os Projetos ({processos.length})</option>
                {projectsList.map((proj) => (
                  <option key={proj} value={proj} className="text-gray-900">
                    Projeto: {proj}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* One-Click Status Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {[
              { id: 'TODOS' as DeliveryPill, label: 'Todos os Pedidos', count: pillCounts.TODOS, icon: 'fa-list' },
              { id: 'TRANSITO' as DeliveryPill, label: '🚢 Em Trânsito / Ag. Chegada', count: pillCounts.TRANSITO },
              { id: 'PORTO' as DeliveryPill, label: '🛃 No Porto / Em Liberação', count: pillCounts.PORTO },
              { id: 'ROTA' as DeliveryPill, label: '🚛 Em Rota de Entrega', count: pillCounts.ROTA },
              { id: 'ENTREGUE' as DeliveryPill, label: '✅ Entregues na MFX', count: pillCounts.ENTREGUE },
              { id: 'ATENCAO' as DeliveryPill, label: '⚠️ Atenção / Atrasados', count: pillCounts.ATENCAO, highlightDanger: true },
            ].map((pill) => {
              const isSelected = activePill === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setActivePill(pill.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? pill.highlightDanger
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-white text-blue-950 shadow-md font-extrabold'
                      : pill.highlightDanger
                      ? 'bg-red-500/20 text-red-200 border border-red-400/40 hover:bg-red-500/30'
                      : 'bg-white/10 text-blue-100 hover:bg-white/20 border border-white/15'
                  }`}
                >
                  {pill.icon && <i className={`fas ${pill.icon}`}></i>}
                  <span>{pill.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected
                        ? 'bg-blue-900/20 text-blue-950 font-extrabold'
                        : 'bg-black/25 text-white'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MANDATORY WEEK & DELIVERED FILTER ENGINE BAR
          Barra de Controle de Entregas da Semana (Relatório Seg/Qua/Sex)
         ===================================================================== */}
      <section
        id="delivery-week-control-bar"
        className="bg-white dark:bg-[#1f2937] p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 space-y-4"
      >
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Left: Section Header & Date Base Switch */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <i className="far fa-calendar-check text-sm"></i>
              Relatório da Semana (Seg a Dom)
            </span>

            {/* Date Base Toggle: Delivery vs ETA */}
            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-100 dark:bg-gray-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setWeekDateField('DELIVERY_OR_ETA')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  weekDateField === 'DELIVERY_OR_ETA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>🎯 Previsão Entrega MFX (ou ETA)</span>
              </button>
              <button
                type="button"
                onClick={() => setWeekDateField('ETA_ONLY')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                  weekDateField === 'ETA_ONLY'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>🚢 Apenas ETA Porto/Aero</span>
              </button>
            </div>
          </div>

          {/* Right: Slide Panel TV Trigger & Flag "Mostrar Entregues" (Desmarcada por Padrão!) */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setIsSlidePanelOpen(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-extrabold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-xs flex items-center gap-2 cursor-pointer transition-all border border-slate-700 dark:border-blue-400"
            >
              <i className="fas fa-display text-cyan-400 dark:text-white"></i>
              <span>📺 Iniciar Slide Panel (Modo TV)</span>
            </button>

            <label
              htmlFor="show-delivered-flag"
              className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border cursor-pointer select-none font-semibold text-xs sm:text-sm transition-all ${
                showDelivered
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 shadow-xs'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <input
                type="checkbox"
                id="show-delivered-flag"
                checked={showDelivered}
                onChange={(e) => setShowDelivered(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span>Mostrar Entregues</span>
              <span
                id="hidden-delivered-badge"
                className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${
                  showDelivered
                    ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {showDelivered ? `${totalDeliveredCount} exibidos` : `${hiddenDeliveredCount} ocultos`}
              </span>
            </label>
          </div>
        </div>

        {/* Row of Quick Week Buttons & Week Selector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center pt-1">
          {/* Quick Buttons: 5 Modes */}
          <div className="lg:col-span-8 flex flex-wrap items-center gap-1.5">
            {/* 1. Todas Pendentes */}
            <button
              type="button"
              onClick={() => setWeekMode('ALL')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                weekMode === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 font-extrabold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <i className="far fa-calendar"></i>
              <span>📅 Todas Pendentes</span>
            </button>

            {/* 2. Atrasados (< Semana Atual) */}
            <button
              type="button"
              onClick={() => setWeekMode('OVERDUE')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                weekMode === 'OVERDUE'
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-500/30 font-extrabold'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-900'
              }`}
            >
              <i className="fas fa-triangle-exclamation"></i>
              <span>⚠️ Atrasados (&lt; Sem. Atual)</span>
            </button>

            {/* 3. Esta Semana */}
            <button
              type="button"
              onClick={() => {
                setWeekMode('CURRENT_WEEK');
                setCustomIsoWeek(currentWeekBounds.isoWeekStr);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                weekMode === 'CURRENT_WEEK'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 font-extrabold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <i className="fas fa-location-dot text-amber-500"></i>
              <span>📍 Esta Semana ({formatDateBR(currentWeekBounds.startOfWeek).slice(0, 5)} a {formatDateBR(currentWeekBounds.endOfWeek).slice(0, 5)})</span>
            </button>

            {/* 4. Próxima Semana */}
            <button
              type="button"
              onClick={() => {
                setWeekMode('NEXT_WEEK');
                setCustomIsoWeek(nextWeekBounds.isoWeekStr);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                weekMode === 'NEXT_WEEK'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 font-extrabold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <i className="fas fa-forward"></i>
              <span>⏭️ Próxima Semana ({formatDateBR(nextWeekBounds.startOfWeek).slice(0, 5)} a {formatDateBR(nextWeekBounds.endOfWeek).slice(0, 5)})</span>
            </button>

            {/* 5. +2 Semanas */}
            <button
              type="button"
              onClick={() => {
                setWeekMode('PLUS_2_WEEKS');
                setCustomIsoWeek(plus2WeeksBounds.isoWeekStr);
              }}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                weekMode === 'PLUS_2_WEEKS'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30 font-extrabold'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              <i className="far fa-calendar-plus"></i>
              <span>📆 +2 Semanas ({formatDateBR(plus2WeeksBounds.startOfWeek).slice(0, 5)} a {formatDateBR(plus2WeeksBounds.endOfWeek).slice(0, 5)})</span>
            </button>
          </div>

          {/* Specific Week Selector: Prev Button, Select/Input, Next Button */}
          <div className="lg:col-span-4 flex items-center gap-1.5 justify-start lg:justify-end">
            <button
              type="button"
              onClick={() => handleShiftWeek(-1)}
              title="Semana Anterior"
              className="p-2 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold cursor-pointer transition-colors"
            >
              <i className="fas fa-chevron-left mr-1"></i>
              <span>Sem. Ant.</span>
            </button>

            {/* Week Picker Dropdown & Input */}
            <div className="relative flex-1 min-w-[170px]">
              <select
                id="delivery-week-select"
                aria-label="Selecionar Semana Específica"
                value={weekMode === 'CUSTOM_WEEK' ? customIsoWeek : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setCustomIsoWeek(e.target.value);
                    setWeekMode('CUSTOM_WEEK');
                  }
                }}
                className={`w-full py-2 px-2.5 text-xs rounded-lg border font-bold bg-white dark:bg-[#111827] cursor-pointer ${
                  weekMode === 'CUSTOM_WEEK'
                    ? 'border-blue-600 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/20'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200'
                }`}
              >
                <option value="" disabled>
                  {weekMode === 'CUSTOM_WEEK' ? 'Semana Personalizada' : 'Outra Semana...'}
                </option>
                {availableWeeksList.map((w) => (
                  <option key={w.iso} value={w.iso}>
                    {w.label} {w.count > 0 ? `(${w.count})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleShiftWeek(1)}
              title="Próxima Semana"
              className="p-2 px-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold cursor-pointer transition-colors"
            >
              <span>Próx. Sem.</span>
              <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>

        {/* =====================================================================
            ACTIVE WEEK RANGE CONFIRMATION BANNER
           ===================================================================== */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl p-3.5 border border-blue-200 dark:border-blue-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"></span>
            <span className="font-extrabold text-blue-950 dark:text-blue-200">
              📅 Período Selecionado:
            </span>
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {activePeriodInfo.dates}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-gray-600 dark:text-gray-300 shrink-0">
            <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 font-bold">
              {filteredDeliveries.length} cargas listadas
            </span>
            {!showDelivered && hiddenDeliveredCount > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                ({hiddenDeliveredCount} entregues ocultos)
              </span>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          CLEAN VISUAL DELIVERY CARDS LIST (AMAZON / DHL STYLE TRACKER)
          Sorted chronologically Monday to Sunday with Day-of-Week badges
         ===================================================================== */}
      <div className="space-y-4">
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white dark:bg-[#1f2937] p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700 shadow-sm">
            <i className="fas fa-box-open text-4xl text-gray-400 mb-3"></i>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              Nenhuma entrega encontrada para a semana selecionada
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
              Não há processos agendados para este período. Experimente selecionar{' '}
              <button
                type="button"
                onClick={() => setWeekMode('ALL')}
                className="text-blue-600 dark:text-blue-400 underline font-bold"
              >
                📅 Todas Pendentes
              </button>{' '}
              ou marcar{' '}
              <button
                type="button"
                onClick={() => setShowDelivered(true)}
                className="text-emerald-600 dark:text-emerald-400 underline font-bold"
              >
                [✓] Mostrar Entregues
              </button>
              .
            </p>
          </div>
        ) : (
          filteredDeliveries.map((p) => {
            const isDelivered = isImportProcessDelivered(p);
            const targetDate = getProcessTargetDate(p, weekDateField);
            const dayInfo = getDayOfWeekInfo(targetDate);
            const stage = p.stageNumber ?? 3;
            const isAir = p.modal === 'AÉREO';

            // Check if process has attention alert
            const todayStr = referenceToday.toISOString().slice(0, 10);
            const etaPassed = p.eta && p.eta.length === 10 && p.eta < todayStr;
            const deliveryPassed = p.prazoEntregaMFX && p.prazoEntregaMFX.length === 10 && p.prazoEntregaMFX < todayStr;
            const isAttention =
              !isDelivered &&
              Boolean(
                p.alertaEtaVencido ||
                p.alertaEntregaAtrasada ||
                etaPassed ||
                deliveryPassed ||
                p.cargaParadaDrawback ||
                p.riskLevel === 'high'
              );

            const poTokens =
              p.posList && p.posList.length > 0
                ? p.posList
                : p.oc
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);

            // 4 Steps Tracker:
            // Step 1: Pedido & Embarque
            // Step 2: Chegada Brasil (ETA)
            // Step 3: Liberação Alfândega (DI/DUIMP)
            // Step 4: Entrega Fábrica MFX
            const step1State = stage >= 2 ? 'completed' : 'current';
            const step2State = stage >= 4 ? 'completed' : stage === 3 ? 'current' : 'forecast';
            const step3State = stage >= 6 ? 'completed' : stage === 4 || stage === 5 ? 'current' : 'forecast';
            const step4State = stage === 7 ? 'completed' : stage === 6 ? 'current' : 'forecast';

            return (
              <div
                key={p.id}
                onClick={() => onSelectProcess(p)}
                className={`bg-white dark:bg-[#1f2937] rounded-xl p-5 shadow-xs border transition-all hover:shadow-md cursor-pointer ${
                  isAttention
                    ? 'border-l-5 border-l-red-500 border-gray-200 dark:border-gray-700'
                    : isDelivered
                    ? 'border-l-5 border-l-emerald-500 border-gray-200 dark:border-gray-700'
                    : 'border-l-5 border-l-blue-500 border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* DAY OF THE WEEK BANNER & PROCESS HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-3 border-b border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Day-of-Week Badge (Segunda, Terça, Quarta, Quinta, Sexta...) */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                        isDelivered
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                          : isAttention
                          ? 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800'
                          : 'bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                      }`}
                    >
                      <i className="far fa-calendar-days text-sm"></i>
                      <span>📅 {dayInfo.dayName}, {dayInfo.formattedDate}</span>
                    </span>

                    <span className="font-mono font-extrabold text-sm text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800">
                      {p.id}
                    </span>

                    <div className="flex items-center gap-1 flex-wrap">
                      {poTokens.slice(0, 3).map((po, idx) => (
                        <span
                          key={idx}
                          className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                        >
                          PO: {po}
                        </span>
                      ))}
                      {poTokens.length > 3 && (
                        <span
                          title={poTokens.join(', ')}
                          className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                        >
                          +{poTokens.length - 3} POs
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Project, Pending Callout & Operational Regime */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {!isDelivered && (
                      <span
                        className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded border flex items-center gap-1 ${
                          p.cargaParadaDrawback
                            ? 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700 animate-pulse'
                            : isAttention
                            ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            : stage === 4 || stage === 5
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                        }`}
                      >
                        <i className="fas fa-circle-exclamation text-[10px]"></i>
                        {p.cargaParadaDrawback
                          ? 'PENDENTE: DRAWBACK / AC'
                          : isAttention
                          ? 'PENDENTE: PRAZO VENCIDO'
                          : stage === 4 || stage === 5
                          ? 'PENDENTE: LIBERAÇÃO PORTO/DI'
                          : stage === 6
                          ? 'PENDENTE: ENTREGA FÁBRICA'
                          : 'PENDENTE: CHEGADA / TRÂNSITO'}
                      </span>
                    )}
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
                      Projeto: {p.projeto}
                    </span>
                    {p.atoConcessorio && p.atoConcessorio !== 'NÃO' && (
                      <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800">
                        {p.atoConcessorio}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Left Column (5 Cols): Supplier, Buyer, Material Preview */}
                  <div className="lg:col-span-5 space-y-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {p.fornecedor} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({p.paisOrigem})</span>
                      </h4>
                      {p.compradorResponsavel && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Comprador Responsável: <strong className="text-gray-700 dark:text-gray-300">{p.compradorResponsavel}</strong>
                        </p>
                      )}
                    </div>

                    {/* Material Summary Preview */}
                    <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-gray-800 text-xs">
                      <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-0.5">
                        <span className="truncate pr-2">
                          <i className="fas fa-box text-blue-600 mr-1.5"></i>
                          [{p.itens[0]?.codigoItem || 'ITEM'}] {p.itens[0]?.descricao || 'Insumo Industrial MFX'}
                        </span>
                        <span className="font-mono font-extrabold text-blue-700 dark:text-blue-400 shrink-0">
                          {p.itens[0]?.quantidade.toLocaleString('pt-BR')} {p.itens[0]?.unidade || 'UN'}
                        </span>
                      </div>
                      {p.itens.length > 1 && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">
                          + {p.itens.length - 1} outros materiais neste lote de entrega
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Middle Column (4 Cols): Visual 4-Step Customer Progress Tracker */}
                  <div className="lg:col-span-4 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                        <i className={`fas ${isAir ? 'fa-plane text-sky-500' : 'fa-ship text-blue-500'}`}></i>
                        Status FUP (Col A):{' '}
                        <strong
                          className={
                            isDelivered
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : stage === 3
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {p.statusRawExcel || p.status}
                        </strong>
                      </span>
                    </div>

                    {/* Visual 4 Steps Progress Bar */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {/* Step 1: Pedido & Embarque */}
                      <div
                        className={`p-2 rounded-lg text-center border ${
                          step1State === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                            : 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 text-blue-800 dark:text-blue-300'
                        }`}
                      >
                        <div className="text-[10px] font-bold">1. Embarque</div>
                        <div className="text-[10px] mt-0.5">{step1State === 'completed' ? '✅ Concluído' : '⏳ Atual'}</div>
                      </div>

                      {/* Step 2: Chegada Brasil (ETA) */}
                      <div
                        className={`p-2 rounded-lg text-center border ${
                          step2State === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                            : step2State === 'current'
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-300 ring-2 ring-blue-400/20'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-dashed border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        <div className="text-[10px] font-bold">2. Chegada</div>
                        <div className="text-[10px] mt-0.5">
                          {step2State === 'completed' ? '✅ Chegou' : step2State === 'current' ? '⏳ No Mar' : '🕒 Previsto'}
                        </div>
                      </div>

                      {/* Step 3: Liberação Alfândega */}
                      <div
                        className={`p-2 rounded-lg text-center border ${
                          step3State === 'completed'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                            : step3State === 'current'
                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-400/20'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-dashed border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        <div className="text-[10px] font-bold">3. Liberação</div>
                        <div className="text-[10px] mt-0.5">
                          {step3State === 'completed' ? '✅ Liberado' : step3State === 'current' ? '⏳ Porto/DI' : '🕒 Previsto'}
                        </div>
                      </div>

                      {/* Step 4: Entrega Fábrica MFX */}
                      <div
                        className={`p-2 rounded-lg text-center border ${
                          step4State === 'completed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                            : step4State === 'current'
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-800 dark:text-blue-300 ring-2 ring-blue-400/20'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-dashed border-gray-300 dark:border-gray-700 text-gray-500'
                        }`}
                      >
                        <div className="text-[10px] font-bold">4. Fábrica</div>
                        <div className="text-[10px] mt-0.5">
                          {step4State === 'completed' ? '✅ Entregue' : step4State === 'current' ? '⏳ Em Rota' : '🕒 Previsto'}
                        </div>
                      </div>
                    </div>

                    {isAttention && (
                      <div className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5 pt-0.5">
                        <i className="fas fa-triangle-exclamation"></i>
                        <span>⚠️ Prazo Estimado Vencido — Verificar Status com Comex</span>
                      </div>
                    )}
                  </div>

                  {/* Right Column (3 Cols): Big Clear Delivery Box */}
                  <div className="lg:col-span-3 flex flex-col justify-center">
                    <div
                      className={`p-4 rounded-xl border text-center transition-all ${
                        isDelivered
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                          : isAttention
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800'
                          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                        {isDelivered ? '✅ Material Entregue em' : '📅 Previsão de Entrega MFX'}
                      </span>
                      <div
                        className={`text-lg sm:text-xl font-extrabold font-mono mt-1 tabular-nums ${
                          isDelivered
                            ? 'text-emerald-700 dark:text-emerald-300'
                            : isAttention
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {formatDateDisplay(isDelivered ? p.dataEntregaMFX || p.prazoEntregaMFX : p.prazoEntregaMFX)}
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">
                        <div>
                          ETA Porto: <strong className="font-mono">{formatDateDisplay(p.dataChegadaEfetiva || p.eta)}</strong>
                        </div>
                        <div>
                          Modal: <strong>{p.modal}</strong> ({p.blAwb})
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectProcess(p)}
                      className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      Ver Timeline Completa <i className="fas fa-chevron-right text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* =====================================================================
          COMEX ROOM TV SLIDE PANEL (FULLSCREEN WORKING PANEL)
         ===================================================================== */}
      <ComexTvSlidePanel
        isOpen={isSlidePanelOpen}
        onClose={() => setIsSlidePanelOpen(false)}
        filteredDeliveries={filteredDeliveries}
        allProcessos={processos}
        weekMode={weekMode}
        setWeekMode={setWeekMode}
        weekDateField={weekDateField}
        setWeekDateField={setWeekDateField}
        showDelivered={showDelivered}
        setShowDelivered={setShowDelivered}
        activePeriodLabel={activePeriodInfo.label}
        activePeriodDates={activePeriodInfo.dates}
        isOnlineSynced={isOnlineSynced}
        lastUpdatedTime={lastUpdatedTime}
        onSelectProcess={(proc) => {
          onSelectProcess(proc);
        }}
      />
    </div>
  );
};
