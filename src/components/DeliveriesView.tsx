import React, { useState, useMemo } from 'react';
import { ImportProcess } from '../types/mfx';

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
  const [filterText, setFilterText] = useState('');
  const [activePill, setActivePill] = useState<DeliveryPill>('TODOS');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Classify delivery state strictly according to Column A (STATUS)
  const isProcessDelivered = (p: ImportProcess): boolean => {
    return Boolean(p.stageNumber === 7 || p.status === 'Entregue MFX' || (p.statusRawExcel && p.statusRawExcel.toUpperCase().includes('ENTREGUE')));
  };

  const isProcessInTransit = (p: ImportProcess): boolean => {
    if (isProcessDelivered(p)) return false;
    const stage = p.stageNumber ?? 3;
    const raw = (p.statusRawExcel || p.status || '').toUpperCase();
    return Boolean(stage === 3 || raw.includes('TRANSITO') || raw.includes('AG. CHEGADA') || raw.includes('EMBARCADO'));
  };

  const isProcessInPortCustoms = (p: ImportProcess): boolean => {
    if (isProcessDelivered(p)) return false;
    const stage = p.stageNumber ?? 3;
    const raw = (p.statusRawExcel || p.status || '').toUpperCase();
    return Boolean(
      stage === 4 ||
      stage === 5 ||
      raw.includes('PORTO') ||
      raw.includes('AEROPORTO') ||
      raw.includes('DESEMBARAÇO') ||
      raw.includes('DESEMBARACO') ||
      raw.includes('DRAWBACK')
    );
  };

  const isProcessInRoadDelivery = (p: ImportProcess): boolean => {
    if (isProcessDelivered(p)) return false;
    const stage = p.stageNumber ?? 3;
    const raw = (p.statusRawExcel || p.status || '').toUpperCase();
    return Boolean(stage === 6 || raw.includes('RODOVIARIO') || raw.includes('AG. ENTREGA') || raw.includes('CARREGADO') || raw.includes('LIBERADO'));
  };

  const isProcessAttention = (p: ImportProcess) => {
    if (isProcessDelivered(p)) return false;
    // Estimated date expired vs today OR blocked drawback
    const etaPassed = p.eta && p.eta.length === 10 && p.eta < todayStr;
    const deliveryPassed = p.prazoEntregaMFX && p.prazoEntregaMFX.length === 10 && p.prazoEntregaMFX < todayStr;
    return Boolean(p.alertaEtaVencido || p.alertaEntregaAtrasada || etaPassed || deliveryPassed || p.cargaParadaDrawback || p.riskLevel === 'high');
  };

  // Deliveries within next 15 days
  const isWithinNext15Days = (p: ImportProcess) => {
    if (isProcessDelivered(p)) return false;
    const targetDate = p.prazoEntregaMFX || p.eta;
    if (!targetDate || targetDate.length !== 10) return false;
    const now = new Date();
    const target = new Date(targetDate);
    const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= -2 && diffDays <= 15;
  };

  // Top 3 KPI counts
  const countInTransitOrArriving = useMemo(() => {
    return processos.filter((p) => !isProcessDelivered(p) && (isProcessInTransit(p) || isProcessInPortCustoms(p))).length;
  }, [processos]);

  const countNext15Days = useMemo(() => {
    return processos.filter(isWithinNext15Days).length;
  }, [processos]);

  const countDelivered = useMemo(() => {
    return processos.filter(isProcessDelivered).length;
  }, [processos]);

  // Pill live counts
  const pillCounts = useMemo(() => {
    return {
      TODOS: processos.length,
      TRANSITO: processos.filter(isProcessInTransit).length,
      PORTO: processos.filter(isProcessInPortCustoms).length,
      ROTA: processos.filter(isProcessInRoadDelivery).length,
      ENTREGUE: processos.filter(isProcessDelivered).length,
      ATENCAO: processos.filter(isProcessAttention).length,
    };
  }, [processos]);

  // Projects list
  const projectsList = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => {
      if (p.projeto) set.add(p.projeto);
    });
    return Array.from(set);
  }, [processos]);

  // Filtered list
  const filteredDeliveries = useMemo(() => {
    return processos.filter((p) => {
      const q = filterText.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.oc.toLowerCase().includes(q) ||
        p.fornecedor.toLowerCase().includes(q) ||
        (p.compradorResponsavel && p.compradorResponsavel.toLowerCase().includes(q)) ||
        (p.projeto && p.projeto.toLowerCase().includes(q)) ||
        (p.commercialInvoice && p.commercialInvoice.toLowerCase().includes(q)) ||
        (p.blAwb && p.blAwb.toLowerCase().includes(q)) ||
        (p.itens && p.itens.some((it) => it.descricao.toLowerCase().includes(q) || it.codigoItem.toLowerCase().includes(q)));

      const matchProject = selectedProject === 'ALL' || p.projeto === selectedProject;

      let matchPill = true;
      if (activePill === 'TRANSITO') matchPill = isProcessInTransit(p);
      else if (activePill === 'PORTO') matchPill = isProcessInPortCustoms(p);
      else if (activePill === 'ROTA') matchPill = isProcessInRoadDelivery(p);
      else if (activePill === 'ENTREGUE') matchPill = isProcessDelivered(p);
      else if (activePill === 'ATENCAO') matchPill = isProcessAttention(p);

      return matchSearch && matchProject && matchPill;
    });
  }, [processos, filterText, selectedProject, activePill]);

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr || dateStr === 'Aguardando' || dateStr === 'A Confirmar') return dateStr || 'A Confirmar';
    // Format YYYY-MM-DD to DD/MM/YYYY
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
                🚚 Portal de Entregas MFX — Visão Cliente & Projetos
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
              Acompanhamento de Entregas & Pedidos
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

          {/* Customer View Toggle & Share */}
          <div className="flex items-center gap-3 self-start lg:self-center">
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

        {/* 3 Simple Customer-Centric Summary Cards */}
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
                Em transporte marítimo/aéreo ou porto
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
                Próximas Entregas (7 a 15 Dias)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-300 mt-1 tabular-nums">
                {countNext15Days} <span className="text-sm font-normal text-amber-200">pedidos</span>
              </div>
              <span className="text-[11px] text-amber-200/90 block mt-1">
                Previsão de entrega imediata na MFX
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
                Entregas Concluídas (No Prazo)
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-300 mt-1 tabular-nums">
                {countDelivered} <span className="text-sm font-normal text-emerald-200">pedidos</span>
              </div>
              <span className="text-[11px] text-emerald-200/90 block mt-1">
                Materiais recebidos na fábrica da MFX
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
          CLEAN VISUAL DELIVERY CARDS LIST (AMAZON / DHL STYLE TRACKER)
         ===================================================================== */}
      <div className="space-y-4">
        {filteredDeliveries.length === 0 ? (
          <div className="bg-white dark:bg-[#1f2937] p-12 rounded-2xl text-center border border-gray-200 dark:border-gray-700 shadow-sm">
            <i className="fas fa-box-open text-4xl text-gray-400 mb-3"></i>
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              Nenhuma entrega encontrada para os critérios selecionados
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Experimente limpar o texto de busca ou selecionar a pílula &quot;Todos os Pedidos&quot;.
            </p>
          </div>
        ) : (
          filteredDeliveries.map((p) => {
            const isDelivered = isProcessDelivered(p);
            const isAttention = isProcessAttention(p);
            const stage = p.stageNumber ?? 3;
            const isAir = p.modal === 'AÉREO';

            const poTokens =
              p.posList && p.posList.length > 0
                ? p.posList
                : p.oc
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);

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
                    ? 'border-l-4 border-l-red-500 border-gray-200 dark:border-gray-700'
                    : isDelivered
                    ? 'border-l-4 border-l-emerald-500 border-gray-200 dark:border-gray-700'
                    : 'border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  {/* Left Column (5 Cols): Process, PO, Supplier, Material Preview */}
                  <div className="lg:col-span-5 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-extrabold text-sm text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800">
                        {p.id}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {poTokens.slice(0, 2).map((po, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-xs font-bold text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                          >
                            PO: {po}
                          </span>
                        ))}
                        {poTokens.length > 2 && (
                          <span
                            title={poTokens.join(', ')}
                            className="text-[10px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          >
                            +{poTokens.length - 2} POs
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60">
                        {p.projeto}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                        {p.fornecedor} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({p.paisOrigem})</span>
                      </h4>
                      {p.compradorResponsavel && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
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
    </div>
  );
};
