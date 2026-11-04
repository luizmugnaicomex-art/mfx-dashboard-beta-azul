import React, { useState, useEffect, useMemo } from 'react';
import { ImportProcess } from '../types/mfx';
import {
  WeekMode,
  WeekDateField,
  getDayOfWeekInfo,
  getProcessTargetDate,
  isImportProcessDelivered,
  formatDateBR,
} from '../utils/deliveryFilter';

interface ComexTvSlidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  filteredDeliveries: ImportProcess[];
  allProcessos: ImportProcess[];
  weekMode: WeekMode;
  setWeekMode: (mode: WeekMode) => void;
  weekDateField: WeekDateField;
  setWeekDateField: (field: WeekDateField) => void;
  showDelivered: boolean;
  setShowDelivered: (val: boolean) => void;
  activePeriodLabel: string;
  activePeriodDates: string;
  isOnlineSynced: boolean;
  lastUpdatedTime?: string;
  onSelectProcess: (proc: ImportProcess) => void;
}

type TvDisplayMode = 'AUTO_CYCLE' | 'PENDING_ONLY' | 'WEEK_BOARD';

export const ComexTvSlidePanel: React.FC<ComexTvSlidePanelProps> = ({
  isOpen,
  onClose,
  filteredDeliveries,
  allProcessos,
  weekMode,
  setWeekMode,
  weekDateField,
  setWeekDateField,
  showDelivered,
  setShowDelivered,
  activePeriodDates,
  isOnlineSynced,
  lastUpdatedTime,
  onSelectProcess,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [intervalSeconds, setIntervalSeconds] = useState<number>(12);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [tvMode, setTvMode] = useState<TvDisplayMode>('AUTO_CYCLE');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const referenceToday = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => referenceToday.toISOString().slice(0, 10), [referenceToday]);

  // Live Clock for the Comex TV Room
  useEffect(() => {
    if (!isOpen) return;
    const updateClock = () => {
      const now = new Date();
      const days = [
        'DOMINGO',
        'SEGUNDA-FEIRA',
        'TERÇA-FEIRA',
        'QUARTA-FEIRA',
        'QUINTA-FEIRA',
        'SEXTA-FEIRA',
        'SÁBADO',
      ];
      const dayName = days[now.getDay()];
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setCurrentTimeStr(`${dayName}, ${dateStr} • ${timeStr}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Keyboard navigation (ESC to close, Left/Right arrows to change slides, Space to pause)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => (prev + 1) % Math.max(1, slides.length));
        setProgressPercent(0);
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => (prev - 1 + Math.max(1, slides.length)) % Math.max(1, slides.length));
        setProgressPercent(0);
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Helper: Identify if a process has a critical or operational pending issue
  const getProcessPendingStatus = (p: ImportProcess) => {
    const delivered = isImportProcessDelivered(p);
    if (delivered) {
      return {
        isPending: false,
        isCritical: false,
        badge: '✅ ENTREGUE NA MFX',
        reason: 'Entrega finalizada na fábrica',
        colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      };
    }

    const raw = (p.statusRawExcel || p.status || '').toUpperCase();
    const etaPassed = p.eta && p.eta.length === 10 && p.eta < todayStr;
    const deliveryPassed = p.prazoEntregaMFX && p.prazoEntregaMFX.length === 10 && p.prazoEntregaMFX < todayStr;

    if (p.cargaParadaDrawback || raw.includes('DRAWBACK') || raw.includes('ATO CONCESSORIO') || raw.includes('ATO CONCESSÓRIO')) {
      return {
        isPending: true,
        isCritical: true,
        badge: '🚨 PENDENTE: DRAWBACK / AC',
        reason: p.motivoParadaDrawback || 'Aguardando liberação de Ato Concessório para registro DI',
        colorClass: 'bg-red-500/30 text-red-200 border-red-400 animate-pulse',
      };
    }

    if (deliveryPassed || etaPassed || p.alertaEtaVencido || p.alertaEntregaAtrasada) {
      return {
        isPending: true,
        isCritical: true,
        badge: '⚠️ PENDENTE: PRAZO VENCIDO / ATRASO',
        reason: 'Data estimada ultrapassada — Atualizar follow-up urgente com agente/despachante',
        colorClass: 'bg-red-500/25 text-red-200 border-red-400/80',
      };
    }

    if (raw.includes('DESEMBARAÇO') || raw.includes('DESEMBARACO') || raw.includes('PORTO') || raw.includes('AEROPORTO') || (p.stageNumber === 4 || p.stageNumber === 5)) {
      return {
        isPending: true,
        isCritical: p.canal === 'Vermelho' || p.canal === 'Amarelo' || p.freeTimeDiasRestantes <= 4,
        badge: '🛃 PENDENTE: LIBERAÇÃO ADUANEIRA',
        reason: `No recinto (${p.portoAeroportoDestino || 'Porto/Aero'}) • Canal: ${p.canal || 'Em análise'}`,
        colorClass: 'bg-amber-500/25 text-amber-200 border-amber-400/80',
      };
    }

    if (p.stageNumber === 6 || raw.includes('RODOVIARIO') || raw.includes('CARREGADO') || raw.includes('LIBERADO')) {
      return {
        isPending: true,
        isCritical: false,
        badge: '🚛 PENDENTE: RECEBIMENTO FÁBRICA',
        reason: `Carga liberada • Em trânsito rodoviário (${p.transportadoraNacional || 'Transportadora'})`,
        colorClass: 'bg-sky-500/25 text-sky-200 border-sky-400/70',
      };
    }

    return {
      isPending: true,
      isCritical: false,
      badge: '🚢 PENDENTE: CHEGADA / TRÂNSITO',
      reason: `Em trânsito ${p.modal} (${p.blAwb || 'BL/AWB'}) • Acompanhar confirmação de chegada`,
      colorClass: 'bg-blue-500/25 text-blue-200 border-blue-400/60',
    };
  };

  // Lists of Pending & Critical Processes
  const pendingDeliveries = useMemo(() => {
    return filteredDeliveries.filter((p) => !isImportProcessDelivered(p));
  }, [filteredDeliveries]);

  const criticalDeliveries = useMemo(() => {
    return pendingDeliveries.filter((p) => getProcessPendingStatus(p).isCritical);
  }, [pendingDeliveries, todayStr]);

  const inCustomsDeliveries = useMemo(() => {
    return pendingDeliveries.filter((p) => {
      const st = p.stageNumber ?? 3;
      const raw = (p.statusRawExcel || p.status || '').toUpperCase();
      return st === 4 || st === 5 || raw.includes('PORTO') || raw.includes('DESEMBARAÇO') || raw.includes('DRAWBACK');
    });
  }, [pendingDeliveries]);

  const inTransitDeliveries = useMemo(() => {
    return pendingDeliveries.filter((p) => {
      const st = p.stageNumber ?? 3;
      const raw = (p.statusRawExcel || p.status || '').toUpperCase();
      return st <= 3 && !raw.includes('PORTO') && !raw.includes('DESEMBARAÇO') && !raw.includes('DRAWBACK');
    });
  }, [pendingDeliveries]);

  const inRoadDeliveries = useMemo(() => {
    return pendingDeliveries.filter((p) => {
      const st = p.stageNumber ?? 3;
      const raw = (p.statusRawExcel || p.status || '').toUpperCase();
      return st === 6 || raw.includes('RODOVIARIO') || raw.includes('LIBERADO');
    });
  }, [pendingDeliveries]);

  // Build dynamic slides based on tvMode and filteredDeliveries
  const slides = useMemo(() => {
    const result: Array<{
      id: string;
      title: string;
      subtitle: string;
      type: 'CRITICAL_SPOTLIGHT' | 'DELIVERY_CARDS' | 'WEEK_BOARD';
      items: ImportProcess[];
    }> = [];

    if (tvMode === 'WEEK_BOARD') {
      result.push({
        id: 'week-board-only',
        title: '🗓️ QUADRO SINÓTICO DE ENTREGAS DA SEMANA (SEGUNDA A SEXTA)',
        subtitle: activePeriodDates,
        type: 'WEEK_BOARD',
        items: filteredDeliveries,
      });
      return result;
    }

    if (tvMode === 'PENDING_ONLY') {
      const source = criticalDeliveries.length > 0 ? criticalDeliveries : pendingDeliveries;
      const pageSize = 4;
      const totalPages = Math.max(1, Math.ceil(source.length / pageSize));
      for (let i = 0; i < totalPages; i++) {
        result.push({
          id: `pending-page-${i}`,
          title: `🚨 FOCO EM PENDÊNCIAS & PRIORIDADES COMEX (${i + 1}/${totalPages})`,
          subtitle: 'Processos aguardando ação imediata, desembaraço ou chegada programada',
          type: 'CRITICAL_SPOTLIGHT',
          items: source.slice(i * pageSize, (i + 1) * pageSize),
        });
      }
      return result;
    }

    // AUTO_CYCLE:
    // 1. If there are critical/pending items in customs or overdue, show a Priority Spotlight Slide first
    const priorityItems = [
      ...criticalDeliveries,
      ...inCustomsDeliveries.filter((p) => !criticalDeliveries.some((c) => c.id === p.id)),
    ];

    if (priorityItems.length > 0) {
      result.push({
        id: 'spotlight-priority',
        title: '🚨 DESTAQUE DE PENDÊNCIAS & ATENÇÃO IMEDIATA (SALA COMEX)',
        subtitle: `${priorityItems.length} processo(s) exigindo acompanhamento prioritário nesta janela`,
        type: 'CRITICAL_SPOTLIGHT',
        items: priorityItems.slice(0, 4),
      });
    }

    // 2. Paginated Delivery Cards (4 per slide for big TV readability)
    const pageSize = 4;
    const totalCardSlides = Math.max(1, Math.ceil(filteredDeliveries.length / pageSize));
    for (let i = 0; i < totalCardSlides; i++) {
      result.push({
        id: `cards-page-${i}`,
        title: `🚚 CRONOGRAMA DE ENTREGAS — SLIDE ${i + 1} DE ${totalCardSlides}`,
        subtitle: activePeriodDates,
        type: 'DELIVERY_CARDS',
        items: filteredDeliveries.slice(i * pageSize, (i + 1) * pageSize),
      });
    }

    // 3. Synoptic Week Board (Mon - Fri columns)
    if (filteredDeliveries.length > 0) {
      result.push({
        id: 'synoptic-week-board',
        title: '🗓️ MAPA SEMANAL DE ENTREGAS (VISÃO SEG / QUA / SEX)',
        subtitle: activePeriodDates,
        type: 'WEEK_BOARD',
        items: filteredDeliveries,
      });
    }

    return result;
  }, [tvMode, filteredDeliveries, criticalDeliveries, inCustomsDeliveries, pendingDeliveries, activePeriodDates]);

  // Reset slide index if slides array shrinks
  useEffect(() => {
    if (currentSlideIndex >= slides.length) {
      setCurrentSlideIndex(0);
    }
  }, [slides.length, currentSlideIndex]);

  // Auto-rotation timer with smooth progress bar
  useEffect(() => {
    if (!isOpen || !isPlaying || slides.length <= 1) {
      setProgressPercent(0);
      return;
    }

    const stepMs = 100;
    const totalSteps = (intervalSeconds * 1000) / stepMs;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep += 1;
      setProgressPercent(Math.min(100, (currentStep / totalSteps) * 100));
      if (currentStep >= totalSteps) {
        setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
        currentStep = 0;
        setProgressPercent(0);
      }
    }, stepMs);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, intervalSeconds, slides.length, currentSlideIndex]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!isOpen) return null;

  const currentSlide = slides[currentSlideIndex] || slides[0];

  // Group items by Day of Week for the WEEK_BOARD view
  const dayColumns = [
    { key: 1, label: 'SEGUNDA-FEIRA', short: 'SEG', items: [] as ImportProcess[] },
    { key: 2, label: 'TERÇA-FEIRA', short: 'TER', items: [] as ImportProcess[] },
    { key: 3, label: 'QUARTA-FEIRA', short: 'QUA', items: [] as ImportProcess[] },
    { key: 4, label: 'QUINTA-FEIRA', short: 'QUI', items: [] as ImportProcess[] },
    { key: 5, label: 'SEXTA / SÁB / DOM', short: 'SEX-DOM', items: [] as ImportProcess[] },
  ];

  filteredDeliveries.forEach((p) => {
    const dt = getProcessTargetDate(p, weekDateField);
    const info = getDayOfWeekInfo(dt);
    if (info.dayIndex === 1) dayColumns[0].items.push(p);
    else if (info.dayIndex === 2) dayColumns[1].items.push(p);
    else if (info.dayIndex === 3) dayColumns[2].items.push(p);
    else if (info.dayIndex === 4) dayColumns[3].items.push(p);
    else dayColumns[4].items.push(p);
  });

  return (
    <div
      id="comex-tv-slide-panel"
      className="fixed inset-0 z-50 bg-[#060b16] text-white flex flex-col justify-between overflow-hidden select-none"
    >
      {/* TOP AUTO-SLIDE PROGRESS BAR */}
      <div className="w-full h-1.5 bg-slate-900 overflow-hidden shrink-0">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 transition-all duration-100 ease-linear"
          style={{ width: `${isPlaying && slides.length > 1 ? progressPercent : 100}%` }}
        />
      </div>

      {/* =====================================================================
          TV HEADER BAR: BRANDING, LIVE CLOCK, FIREBASE STATUS & CONTROLS
         ===================================================================== */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: MFX TV Title & Sync Status */}
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg border border-blue-400/40">
              <i className="fas fa-tv text-xl text-white"></i>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white">
                  MFX COMEX — PAINEL TV SALA DE OPERAÇÕES
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    isOnlineSynced
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isOnlineSynced ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  {isOnlineSynced ? 'FIREBASE LIVE SYNC' : 'CACHE LOCAL'}
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-3 font-mono mt-0.5">
                <span>
                  <i className="far fa-calendar-check text-blue-400 mr-1.5"></i>
                  {activePeriodDates}
                </span>
                {lastUpdatedTime && <span>• Atualizado: {lastUpdatedTime}</span>}
              </div>
            </div>
          </div>

          {/* Center: Live Digital Clock */}
          <div className="hidden xl:flex items-center gap-2.5 bg-slate-950/90 border border-slate-800 px-4 py-2 rounded-xl shadow-inner">
            <i className="far fa-clock text-cyan-400 text-sm animate-pulse"></i>
            <span className="font-mono text-sm font-extrabold tracking-wider text-cyan-300">
              {currentTimeStr}
            </span>
          </div>

          {/* Right: Slide Controls & Exit */}
          <div className="flex flex-wrap items-center gap-2">
            {/* TV View Mode Selector */}
            <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setTvMode('AUTO_CYCLE');
                  setCurrentSlideIndex(0);
                }}
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${
                  tvMode === 'AUTO_CYCLE'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🔄 Ciclo Completo
              </button>
              <button
                type="button"
                onClick={() => {
                  setTvMode('PENDING_ONLY');
                  setCurrentSlideIndex(0);
                }}
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${
                  tvMode === 'PENDING_ONLY'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🚨 Só Pendências ({pendingDeliveries.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setTvMode('WEEK_BOARD');
                  setCurrentSlideIndex(0);
                }}
                className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all ${
                  tvMode === 'WEEK_BOARD'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🗓️ Quadro Seg-Sex
              </button>
            </div>

            {/* Play / Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-2 rounded-lg text-xs font-extrabold border cursor-pointer flex items-center gap-1.5 transition-all ${
                isPlaying
                  ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300 hover:bg-emerald-600/30'
                  : 'bg-amber-500 text-slate-950 border-amber-400'
              }`}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
              <span>{isPlaying ? 'Auto-Slide' : 'Pausado'}</span>
            </button>

            {/* Interval Speed */}
            <select
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              aria-label="Tempo por slide"
              className="bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-2.5 py-2 cursor-pointer"
            >
              <option value={8}>⏱️ 8s / slide</option>
              <option value={12}>⏱️ 12s / slide</option>
              <option value={20}>⏱️ 20s / slide</option>
              <option value={30}>⏱️ 30s / slide</option>
            </select>

            {/* Prev / Next Slide */}
            <div className="inline-flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => {
                  setCurrentSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
                  setProgressPercent(0);
                }}
                className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                title="Slide Anterior"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              <span className="px-2 text-xs font-mono font-bold text-blue-300">
                {currentSlideIndex + 1} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
                  setProgressPercent(0);
                }}
                className="px-2.5 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
                title="Próximo Slide"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleBrowserFullscreen}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 cursor-pointer"
              title="Alternar Tela Cheia na TV"
            >
              <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'} mr-1`}></i>
              TV Full
            </button>

            {/* Close TV Mode */}
            <button
              type="button"
              onClick={() => {
                if (document.fullscreenElement) {
                  document.exitFullscreen?.().catch(() => {});
                }
                onClose();
              }}
              className="px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold shadow cursor-pointer flex items-center gap-1.5"
            >
              <i className="fas fa-times"></i>
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Sub-Bar: Quick Week & KPI Ribbon for TV */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3 pt-3 border-t border-slate-800/80 items-center">
          {/* KPI 1: Total Programado */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total na Janela
              </span>
              <span className="text-xl font-black font-mono text-white">
                {filteredDeliveries.length} <span className="text-xs font-normal text-slate-400">processos</span>
              </span>
            </div>
            <i className="fas fa-boxes-stacked text-blue-400 text-lg"></i>
          </div>

          {/* KPI 2: Pendências Críticas / Atrasos */}
          <div
            className={`rounded-xl px-3.5 py-2 flex items-center justify-between border ${
              criticalDeliveries.length > 0
                ? 'bg-red-950/70 border-red-500/70 text-red-200'
                : 'bg-slate-950/90 border-slate-800 text-slate-300'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-300 block">
                🚨 Pendências Críticas
              </span>
              <span className="text-xl font-black font-mono text-red-400">
                {criticalDeliveries.length} <span className="text-xs font-normal text-red-200">alertas</span>
              </span>
            </div>
            <i className="fas fa-triangle-exclamation text-red-400 text-lg animate-bounce"></i>
          </div>

          {/* KPI 3: No Porto / Desembaraço */}
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 block">
                🛃 Pendente Liberação
              </span>
              <span className="text-xl font-black font-mono text-amber-300">
                {inCustomsDeliveries.length} <span className="text-xs font-normal text-amber-200">no porto</span>
              </span>
            </div>
            <i className="fas fa-anchor text-amber-400 text-lg"></i>
          </div>

          {/* KPI 4: Em Trânsito Internacional */}
          <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block">
                🚢 Em Trânsito / Mar-Ar
              </span>
              <span className="text-xl font-black font-mono text-blue-300">
                {inTransitDeliveries.length} <span className="text-xs font-normal text-blue-200">chegando</span>
              </span>
            </div>
            <i className="fas fa-ship text-blue-400 text-lg"></i>
          </div>

          {/* KPI 5: Em Rota Rodoviária */}
          <div className="bg-sky-950/40 border border-sky-500/40 rounded-xl px-3.5 py-2 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block">
                🚛 Em Rota p/ MFX
              </span>
              <span className="text-xl font-black font-mono text-sky-300">
                {inRoadDeliveries.length} <span className="text-xs font-normal text-sky-200">liberados</span>
              </span>
            </div>
            <i className="fas fa-truck-fast text-sky-400 text-lg"></i>
          </div>

          {/* Quick Week Switcher on TV */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setWeekMode('CURRENT_WEEK')}
                className={`flex-1 py-1 px-2 rounded text-[10px] font-extrabold cursor-pointer truncate ${
                  weekMode === 'CURRENT_WEEK'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📍 Esta Sem.
              </button>
              <button
                type="button"
                onClick={() => setWeekMode('NEXT_WEEK')}
                className={`flex-1 py-1 px-2 rounded text-[10px] font-extrabold cursor-pointer truncate ${
                  weekMode === 'NEXT_WEEK'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                ⏭️ Próx. Sem.
              </button>
              <button
                type="button"
                onClick={() => setWeekMode('ALL')}
                className={`flex-1 py-1 px-2 rounded text-[10px] font-extrabold cursor-pointer truncate ${
                  weekMode === 'ALL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📅 Todas
              </button>
            </div>
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => setWeekMode('OVERDUE')}
                className={`flex-1 py-1 px-2 rounded text-[10px] font-extrabold cursor-pointer truncate ${
                  weekMode === 'OVERDUE'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-950/60 text-red-300 border border-red-800/60'
                }`}
              >
                ⚠️ Atrasados
              </button>
              <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-300 bg-slate-800 px-2 py-1 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDelivered}
                  onChange={(e) => setShowDelivered(e.target.checked)}
                  className="w-3 h-3 rounded"
                />
                <span>+Entregues</span>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN TV STAGE: DYNAMIC SLIDE CONTENT
         ===================================================================== */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col justify-between">
        {/* Slide Section Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${
                currentSlide?.type === 'CRITICAL_SPOTLIGHT'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                  : currentSlide?.type === 'WEEK_BOARD'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
              }`}
            >
              {currentSlide?.title}
            </span>
            <span className="text-xs sm:text-sm text-slate-300 font-semibold">
              {currentSlide?.subtitle}
            </span>
          </div>

          {/* Date Field Switcher */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-bold">Data Base TV:</span>
            <button
              type="button"
              onClick={() => setWeekDateField('DELIVERY_OR_ETA')}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                weekDateField === 'DELIVERY_OR_ETA'
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              🎯 Entrega MFX
            </button>
            <button
              type="button"
              onClick={() => setWeekDateField('ETA_ONLY')}
              className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                weekDateField === 'ETA_ONLY'
                  ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              🚢 ETA Porto
            </button>
          </div>
        </div>

        {/* SLIDE CONTENT RENDERER */}
        {filteredDeliveries.length === 0 ? (
          <div className="my-auto text-center py-16 bg-slate-900/60 rounded-3xl border border-slate-800">
            <i className="fas fa-calendar-check text-5xl text-slate-500 mb-4"></i>
            <h3 className="text-2xl font-black text-white">
              Nenhuma entrega pendente para o filtro selecionado
            </h3>
            <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
              Use os botões no topo direito da TV para alternar para{' '}
              <button
                type="button"
                onClick={() => setWeekMode('ALL')}
                className="text-blue-400 underline font-bold cursor-pointer"
              >
                📅 Todas Pendentes
              </button>{' '}
              ou{' '}
              <button
                type="button"
                onClick={() => setWeekMode('NEXT_WEEK')}
                className="text-blue-400 underline font-bold cursor-pointer"
              >
                ⏭️ Próxima Semana
              </button>
              .
            </p>
          </div>
        ) : currentSlide?.type === 'WEEK_BOARD' ? (
          /* ===================================================================
             VIEW 3: 5-COLUMN SYNOPTIC MONDAY-TO-FRIDAY BOARD FOR THE TV ROOM
             =================================================================== */
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 flex-1 min-h-0">
            {dayColumns.map((col) => (
              <div
                key={col.key}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden"
              >
                <div className="bg-slate-800/90 px-3.5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-black tracking-wider text-blue-300 uppercase">
                    📅 {col.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-extrabold bg-blue-600 text-white">
                    {col.items.length}
                  </span>
                </div>

                <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1 custom-scrollbar">
                  {col.items.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-xs text-slate-600 font-semibold italic">
                      Sem entregas previstas
                    </div>
                  ) : (
                    col.items.map((p) => {
                      const pend = getProcessPendingStatus(p);
                      const dt = getProcessTargetDate(p, weekDateField);
                      return (
                        <div
                          key={p.id}
                          onClick={() => onSelectProcess(p)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer hover:scale-[1.01] ${
                            pend.isCritical
                              ? 'bg-red-950/50 border-red-500/80 shadow-md shadow-red-950/50'
                              : pend.isPending
                              ? 'bg-slate-950/90 border-blue-500/40'
                              : 'bg-emerald-950/40 border-emerald-500/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono font-black text-sm text-white bg-blue-600/30 px-2 py-0.5 rounded border border-blue-400/40">
                              {p.id}
                            </span>
                            <span className="font-mono text-xs font-extrabold text-cyan-300">
                              {formatDateBR(dt)}
                            </span>
                          </div>

                          <div className="text-xs font-extrabold text-white truncate">
                            {p.fornecedor}
                          </div>
                          <div className="text-[11px] font-mono text-slate-300 truncate">
                            PO: {p.oc} • <strong className="text-indigo-300">{p.projeto}</strong>
                          </div>

                          <div className="mt-1.5 text-[11px] text-slate-300 bg-slate-900/90 p-1.5 rounded border border-slate-800 truncate">
                            <i className="fas fa-box text-blue-400 mr-1"></i>
                            {p.itens[0]?.descricao || 'Material MFX'} ({p.itens[0]?.quantidade}{' '}
                            {p.itens[0]?.unidade})
                          </div>

                          <div
                            className={`mt-2 px-2 py-1 rounded text-[10px] font-black border truncate ${pend.colorClass}`}
                          >
                            {pend.badge}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ===================================================================
             VIEW 1 & 2: HIGH-VISIBILITY TV CARDS (2x2 GRID FOR LARGE TV SCREEN)
             =================================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 content-start">
            {currentSlide?.items.map((p) => {
              const isDelivered = isImportProcessDelivered(p);
              const targetDate = getProcessTargetDate(p, weekDateField);
              const dayInfo = getDayOfWeekInfo(targetDate);
              const pend = getProcessPendingStatus(p);
              const stage = p.stageNumber ?? 3;

              const step1Done = stage >= 2;
              const step2Done = stage >= 4;
              const step3Done = stage >= 6;
              const step4Done = stage === 7;

              return (
                <div
                  key={p.id}
                  onClick={() => onSelectProcess(p)}
                  className={`rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between shadow-xl ${
                    pend.isCritical
                      ? 'bg-gradient-to-br from-slate-900 via-red-950/35 to-slate-900 border-red-500/80'
                      : isDelivered
                      ? 'bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 border-emerald-500/70'
                      : 'bg-gradient-to-br from-slate-900 via-blue-950/30 to-slate-900 border-blue-500/60'
                  }`}
                >
                  {/* Top Row: Day of Week + Process ID + Pending Status Highlight */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wider ${
                            pend.isCritical
                              ? 'bg-red-600 text-white'
                              : isDelivered
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          📅 {dayInfo.dayName}, {dayInfo.formattedDate}
                        </span>

                        <span className="font-mono text-base sm:text-lg font-black text-cyan-300 bg-slate-950 px-3 py-1 rounded-lg border border-cyan-500/40">
                          {p.id}
                        </span>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-indigo-500/25 text-indigo-200 border border-indigo-400/40">
                          {p.projeto}
                        </span>
                      </div>

                      {/* Prominent Pending Callout Badge */}
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-black border ${pend.colorClass}`}
                      >
                        {pend.badge}
                      </span>
                    </div>

                    {/* Middle Content: Supplier, POs, Material & Big Date Box */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      <div className="sm:col-span-8 space-y-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <h4 className="text-lg sm:text-xl font-black text-white truncate">
                            {p.fornecedor}{' '}
                            <span className="text-xs font-normal text-slate-400">
                              ({p.paisOrigem})
                            </span>
                          </h4>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
                          <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 font-bold text-amber-300">
                            PO: {p.oc}
                          </span>
                          <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                            {p.modal} • {p.blAwb}
                          </span>
                          {p.compradorResponsavel && (
                            <span className="bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-300">
                              Resp: {p.compradorResponsavel}
                            </span>
                          )}
                        </div>

                        {/* Material Box */}
                        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-slate-200">
                            <span className="truncate pr-2">
                              <i className="fas fa-Gear text-blue-400 mr-1.5"></i>[
                              {p.itens[0]?.codigoItem || 'ITEM'}] {p.itens[0]?.descricao}
                            </span>
                            <span className="font-mono font-black text-cyan-300 shrink-0">
                              {p.itens[0]?.quantidade.toLocaleString('pt-BR')}{' '}
                              {p.itens[0]?.unidade || 'UN'}
                            </span>
                          </div>
                          {p.itens.length > 1 && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              + {p.itens.length - 1} item(ns) vinculado(s) a este embarque
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right 4 Cols: Giant TV Date & ETA Box */}
                      <div className="sm:col-span-4">
                        <div
                          className={`p-3.5 rounded-2xl border text-center ${
                            pend.isCritical
                              ? 'bg-red-950/60 border-red-500/70'
                              : isDelivered
                              ? 'bg-emerald-950/60 border-emerald-500/70'
                              : 'bg-blue-950/60 border-blue-500/60'
                          }`}
                        >
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">
                            {isDelivered ? '✅ ENTREGUE NA MFX' : '🎯 PREVISÃO ENTREGA MFX'}
                          </span>
                          <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                            {formatDateBR(
                              getProcessTargetDate(p, 'DELIVERY_OR_ETA')
                            )}
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px] font-mono text-slate-300">
                            ETA Porto: <strong>{formatDateBR(getProcessTargetDate(p, 'ETA_ONLY'))}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom 4-Step Visual Progress & Pending Action Reason */}
                  <div className="mt-3 pt-3 border-t border-slate-800/90 space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: '1. Embarque', done: step1Done, active: stage === 2 },
                        { label: '2. Chegada', done: step2Done, active: stage === 3 },
                        { label: '3. Liberação', done: step3Done, active: stage === 4 || stage === 5 },
                        { label: '4. Fábrica MFX', done: step4Done, active: stage === 6 },
                      ].map((st, idx) => (
                        <div
                          key={idx}
                          className={`py-1.5 px-2 rounded-lg text-center text-xs font-extrabold border ${
                            st.done
                              ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                              : st.active
                              ? 'bg-amber-500/30 border-amber-400 text-amber-200 ring-2 ring-amber-400/30'
                              : 'bg-slate-950/70 border-slate-800 text-slate-500'
                          }`}
                        >
                          {st.done ? '✅ ' : st.active ? '⏳ ' : '🕒 '}
                          {st.label}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-xs bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800">
                      <span className="font-bold text-slate-300 truncate">
                        <strong className="text-amber-400 uppercase mr-1.5">
                          Status Col A ({p.statusRawExcel || p.status}):
                        </strong>
                        {pend.reason}
                      </span>
                      <span className="font-mono text-[11px] text-blue-400 shrink-0 ml-2">
                        Clique p/ Detalhes ➔
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =====================================================================
          TV FOOTER: LIVE TICKER OF PENDING DELIVERIES FOR THE COMEX ROOM
         ===================================================================== */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-2.5 shrink-0 flex items-center gap-4 overflow-hidden">
        <span className="px-3 py-1 rounded bg-red-600 text-white text-xs font-black uppercase tracking-wider shrink-0 flex items-center gap-1.5 shadow">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          RADAR PENDÊNCIAS COMEX
        </span>

        <div className="flex-1 overflow-x-auto whitespace-nowrap no-scrollbar flex items-center gap-6 text-xs font-mono">
          {pendingDeliveries.length === 0 ? (
            <span className="text-emerald-400 font-bold">
              ✅ Todas as entregas da janela selecionada estão concluídas!
            </span>
          ) : (
            pendingDeliveries.map((p) => {
              const pend = getProcessPendingStatus(p);
              const dt = getProcessTargetDate(p, weekDateField);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProcess(p)}
                  className="inline-flex items-center gap-2 hover:text-cyan-300 cursor-pointer"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      pend.isCritical ? 'bg-red-500 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                  <strong className="text-white">{p.id}</strong>
                  <span className="text-slate-400">({p.fornecedor})</span>
                  <span className="text-amber-300 font-bold">
                    [{p.statusRawExcel || p.status}]
                  </span>
                  <span className="text-cyan-300">Prev: {formatDateBR(dt)}</span>
                  <span className="text-slate-700">|</span>
                </button>
              );
            })
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-400 shrink-0 hidden md:block">
          Total Base Online: <strong className="text-white">{allProcessos.length}</strong> processos
        </div>
      </footer>
    </div>
  );
};
