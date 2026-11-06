import React, { useState, useMemo } from 'react';
import { ImportProcess, PedidoForecastRow } from '../types/mfx';
import {
  isImportProcessDelivered,
  isImportProcessCancelled,
  parseStrictDate,
  formatDateBR,
} from '../utils/deliveryFilter';

interface SupplierCapexFollowupViewProps {
  processos: ImportProcess[];
  pedidosForecast: PedidoForecastRow[];
  onSelectProcess: (proc: ImportProcess) => void;
  onNotify?: (title: string, description: string, type?: 'success' | 'warning' | 'info') => void;
}

type FollowupQuickToggle = 'DELAYED' | 'MISSING_DATE' | 'ALL_PENDING_SHIPMENT' | 'ALL_PROJECT_ORDERS';

interface UnifiedPoRecord {
  uid: string;
  projeto: string;
  po: string;
  refMfx: string;
  hasExplicitRefMfx: boolean;
  fornecedor: string;
  origem: string;
  comprador: string;
  materiaisResumo: string;
  qtdTotal: number;
  unidade: string;
  itensCount: number;
  statusColA: string;
  dataProntidaoIso: string;
  dataProntidaoDisplay: string;
  etdIso: string;
  etdDisplay: string;
  etaIso: string;
  etaDisplay: string;
  prazoEntregaIso: string;
  prazoEntregaDisplay: string;
  blAwb: string;
  modal: string;
  moeda: string;
  valorMoeda: number;
  vmldBRL: number;
  capexStage: 1 | 2 | 3 | 4 | 5;
  isPreShipment: boolean;
  supplierHealth: 'CRITICAL_DELAY' | 'MISSING_DATE' | 'ON_TIME' | 'SHIPPED_OR_DELIVERED';
  delayDays: number; // positive = days overdue, negative = days remaining
  sourceProcess?: ImportProcess;
}

function stripAccentsUpper(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function formatIsoToBR(isoStr?: string): string {
  if (!isoStr) return '';
  const dt = parseStrictDate(isoStr);
  if (dt) return formatDateBR(dt);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoStr.trim())) return isoStr.trim();
  return '';
}

export const SupplierCapexFollowupView: React.FC<SupplierCapexFollowupViewProps> = ({
  processos,
  onSelectProcess,
  onNotify,
}) => {
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [quickToggle, setQuickToggle] = useState<FollowupQuickToggle>('ALL_PENDING_SHIPMENT');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Build unified list of PO/Process records from the active dataset
  const allRecords = useMemo<UnifiedPoRecord[]>(() => {
    const records: UnifiedPoRecord[] = [];

    processos.forEach((proc) => {
      // Avoid showing cancelled processes on the supplier expediting & follow-up panel
      if (isImportProcessCancelled(proc)) {
        return;
      }

      const rawStatus = proc.statusRawExcel || proc.status || 'AGUARDANDO EMBARQUE';
      const sNorm = stripAccentsUpper(rawStatus);
      const isDelivered = isImportProcessDelivered(proc);

      const cleanBl = String(proc.blAwb || '').trim();
      const hasValidBl =
        Boolean(cleanBl) &&
        !['A DEFINIR', 'AG. EMBARQUE', 'AGUARDANDO', 'PENDENTE', '-', 'N/A', 'S/ BL'].includes(
          stripAccentsUpper(cleanBl)
        );

      // Determine 5-Stage CAPEX Milestone Breakdown:
      // 1. Em Produção / Fornecedor
      // 2. Prontidão / Ag. Embarque
      // 3. Em Trânsito Internacional
      // 4. No Porto / Desembaraço
      // 5. Entregue na Fábrica
      let capexStage: 1 | 2 | 3 | 4 | 5 = 1;

      if (isDelivered) {
        capexStage = 5;
      } else if (
        sNorm.includes('PARADO') ||
        sNorm.includes('DRAWBACK') ||
        sNorm.includes('AG. ATO') ||
        sNorm.includes('AG. DI') ||
        sNorm.includes('AG. REGISTRO') ||
        sNorm.includes('PRESENCA') ||
        sNorm.includes('NO PORTO') ||
        sNorm.includes('NO AEROPORTO') ||
        sNorm.includes('DESEMBARAC') ||
        sNorm.includes('CANAL') ||
        sNorm.includes('LIBERADO') ||
        sNorm.includes('CARREGADO') ||
        sNorm.includes('RODOVIARIO') ||
        sNorm.includes('ROTA') ||
        (proc.stageNumber && proc.stageNumber >= 4)
      ) {
        capexStage = 4;
      } else if (
        sNorm.includes('TRANSITO') ||
        sNorm.includes('EM VOO') ||
        sNorm.includes('NO MAR') ||
        sNorm.includes('EMBARCADO') ||
        sNorm.includes('AG. CHEGADA') ||
        sNorm.includes('AGUARDANDO CHEGADA') ||
        proc.stageNumber === 3
      ) {
        capexStage = 3;
      } else if (
        sNorm.includes('AG. EMBARQUE') ||
        sNorm.includes('AGUARDANDO EMBARQUE') ||
        sNorm.includes('PRONTIDAO') ||
        sNorm.includes('PRONTO') ||
        sNorm.includes('COLETADO') ||
        sNorm.includes('BOOKING') ||
        proc.stageNumber === 2
      ) {
        capexStage = 2;
      } else {
        capexStage = 1;
      }

      // Check if PO/Process is Pending Shipment / Supplier Follow-up
      const hasPreShipmentKeyword =
        sNorm.includes('PRODUCAO') ||
        sNorm.includes('FORNECEDOR') ||
        sNorm.includes('AG. EMBARQUE') ||
        sNorm.includes('AGUARDANDO EMBARQUE') ||
        sNorm.includes('PENDENTE') ||
        sNorm.includes('PRONTIDAO') ||
        sNorm.includes('FABRICACAO') ||
        sNorm.includes('PEDIDO') ||
        sNorm.includes('BACKLOG') ||
        sNorm.includes('ABERTURA');

      const isPreShipment =
        !isDelivered &&
        capexStage <= 2 &&
        (hasPreShipmentKeyword || !hasValidBl || (proc.stageNumber !== undefined && proc.stageNumber <= 2));

      // Extract Readiness & ETD dates (strictly real sheet dates, no fake fallback if empty)
      const prontidaoRaw =
        proc.dataProntidaoCarga ||
        proc.itens.find((it) => it.previsaoProntidaoCarga)?.previsaoProntidaoCarga ||
        '';
      const etdRaw = proc.etd || proc.itens.find((it) => it.etd)?.etd || '';
      const etaRaw = proc.dataChegadaEfetiva || proc.eta || '';
      const entregaRaw = proc.dataEntregaMFX || proc.prazoEntregaMFX || etaRaw || '';

      const prontidaoDisplay = formatIsoToBR(prontidaoRaw);
      const etdDisplay =
        proc.etdFormatted && proc.etdFormatted !== 'S/ Data'
          ? proc.etdFormatted
          : formatIsoToBR(etdRaw);
      const etaDisplay =
        proc.etaFormatted && proc.etaFormatted !== 'S/ Data'
          ? proc.etaFormatted
          : formatIsoToBR(etaRaw);
      const entregaDisplay =
        proc.deliveryDateFormatted && proc.deliveryDateFormatted !== 'S/ Data'
          ? proc.deliveryDateFormatted
          : formatIsoToBR(entregaRaw);

      // Delay detection on Pre-Shipment (Atraso do Fornecedor)
      let supplierHealth: 'CRITICAL_DELAY' | 'MISSING_DATE' | 'ON_TIME' | 'SHIPPED_OR_DELIVERED' =
        'SHIPPED_OR_DELIVERED';
      let delayDays = 0;

      if (isPreShipment) {
        const dtProntidao = parseStrictDate(prontidaoRaw);
        const dtEtd = parseStrictDate(etdRaw);
        const referenceTarget = dtProntidao || dtEtd;

        if (!dtProntidao && !dtEtd) {
          supplierHealth = 'MISSING_DATE';
          delayDays = 0;
        } else {
          // Check if either readiness date or ETD has already passed today
          const earliestDue =
            dtProntidao && dtEtd
              ? dtProntidao.getTime() < dtEtd.getTime()
                ? dtProntidao
                : dtEtd
              : referenceTarget!;

          const diffMs = today.getTime() - earliestDue.getTime();
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffDays > 0) {
            supplierHealth = 'CRITICAL_DELAY';
            delayDays = diffDays;
          } else if (!dtProntidao || !dtEtd) {
            // One of the dates is missing, while the other is in the future
            supplierHealth = 'MISSING_DATE';
            delayDays = diffDays; // negative or 0
          } else {
            supplierHealth = 'ON_TIME';
            delayDays = diffDays; // negative or 0 (remaining days)
          }
        }
      }

      const explicitRef =
        proc.hasExplicitRefMfx !== undefined
          ? proc.hasExplicitRefMfx
          : !proc.id.startsWith('PO-') &&
            !proc.id.startsWith('SEM-REF-') &&
            !proc.id.startsWith('BL-');

      const firstItem = proc.itens[0];
      const qtdTotal = proc.itens.reduce((acc, it) => acc + (it.quantidade || 0), 0);
      const matResumo = firstItem
        ? `[${firstItem.codigoItem}] ${firstItem.descricao}`
        : `Pedido ${proc.oc}`;

      const projetoClean = (proc.projeto || 'GERAL / OPERACIONAL').trim().toUpperCase();

      records.push({
        uid: proc.id,
        projeto: projetoClean,
        po: proc.oc || 'S/ PO',
        refMfx: explicitRef ? proc.id : 'Sem Referência / Ag. Abertura',
        hasExplicitRefMfx: explicitRef,
        fornecedor: proc.fornecedor || 'FORNECEDOR MFX',
        origem: proc.paisOrigem || '-',
        comprador: (proc.compradorResponsavel || 'N/D').trim().toUpperCase(),
        materiaisResumo: matResumo,
        qtdTotal: qtdTotal || 1,
        unidade: firstItem?.unidade || 'UN',
        itensCount: proc.itens.length || 1,
        statusColA: rawStatus,
        dataProntidaoIso: prontidaoRaw,
        dataProntidaoDisplay: prontidaoDisplay,
        etdIso: etdRaw,
        etdDisplay: etdDisplay,
        etaIso: etaRaw,
        etaDisplay: etaDisplay,
        prazoEntregaIso: entregaRaw,
        prazoEntregaDisplay: entregaDisplay,
        blAwb: hasValidBl ? cleanBl : 'Aguardando Booking / BL',
        modal: proc.modal || 'MARÍTIMO',
        moeda: proc.moeda || 'USD',
        valorMoeda: proc.valorFOBMoeda || proc.valorVMLDMoeda || 0,
        vmldBRL: proc.vmldBRL || 0,
        capexStage,
        isPreShipment,
        supplierHealth,
        delayDays,
        sourceProcess: proc,
      });
    });

    return records;
  }, [processos, today]);

  // Group by PROJETO for Top CAPEX & Project Milestone Control Cards
  const projectCards = useMemo(() => {
    const map = new Map<
      string,
      {
        projeto: string;
        totalPos: number;
        totalBRL: number;
        totalUSD: number;
        totalEUR: number;
        stage1Prod: number;
        stage2Ready: number;
        stage3Transit: number;
        stage4Port: number;
        stage5Delivered: number;
        delayedSupplierCount: number;
        missingDateCount: number;
        latestCompletionDate: Date | null;
        latestCompletionStr: string;
        completionPercent: number;
      }
    >();

    allRecords.forEach((rec) => {
      const key = rec.projeto || 'GERAL / OPERACIONAL';
      if (!map.has(key)) {
        map.set(key, {
          projeto: key,
          totalPos: 0,
          totalBRL: 0,
          totalUSD: 0,
          totalEUR: 0,
          stage1Prod: 0,
          stage2Ready: 0,
          stage3Transit: 0,
          stage4Port: 0,
          stage5Delivered: 0,
          delayedSupplierCount: 0,
          missingDateCount: 0,
          latestCompletionDate: null,
          latestCompletionStr: 'A Definir',
          completionPercent: 0,
        });
      }

      const grp = map.get(key)!;
      grp.totalPos += 1;
      grp.totalBRL += rec.vmldBRL;
      if (rec.moeda === 'EUR') grp.totalEUR += rec.valorMoeda;
      else grp.totalUSD += rec.valorMoeda;

      if (rec.capexStage === 1) grp.stage1Prod += 1;
      else if (rec.capexStage === 2) grp.stage2Ready += 1;
      else if (rec.capexStage === 3) grp.stage3Transit += 1;
      else if (rec.capexStage === 4) grp.stage4Port += 1;
      else if (rec.capexStage === 5) grp.stage5Delivered += 1;

      if (rec.supplierHealth === 'CRITICAL_DELAY') {
        grp.delayedSupplierCount += 1;
      } else if (rec.supplierHealth === 'MISSING_DATE') {
        grp.missingDateCount += 1;
      }

      const dtCompletion =
        parseStrictDate(rec.prazoEntregaIso) ||
        parseStrictDate(rec.etaIso) ||
        parseStrictDate(rec.etdIso);
      if (dtCompletion) {
        if (!grp.latestCompletionDate || dtCompletion.getTime() > grp.latestCompletionDate.getTime()) {
          grp.latestCompletionDate = dtCompletion;
          grp.latestCompletionStr = formatDateBR(dtCompletion);
        }
      }
    });

    // Calculate weighted completion percent for each project
    const list = Array.from(map.values()).map((g) => {
      if (g.totalPos === 0) return g;
      // Weighting: Stage 1 = 15%, Stage 2 = 35%, Stage 3 = 60%, Stage 4 = 80%, Stage 5 = 100%
      const weightedPoints =
        g.stage1Prod * 15 +
        g.stage2Ready * 35 +
        g.stage3Transit * 60 +
        g.stage4Port * 80 +
        g.stage5Delivered * 100;
      g.completionPercent = Math.round(weightedPoints / g.totalPos);
      return g;
    });

    return list.sort((a, b) => b.totalPos - a.totalPos);
  }, [allRecords]);

  // Dynamic Buyers List (COMPRADOR RESPONSAVEL)
  const buyersList = useMemo(() => {
    const counts = new Map<string, number>();
    ['GUSTAVO', 'EUDE', 'BEATRIZ SANTANA'].forEach((b) => counts.set(b, 0));

    allRecords.forEach((r) => {
      if (r.comprador && r.comprador !== 'N/D') {
        counts.set(r.comprador, (counts.get(r.comprador) || 0) + 1);
      }
    });

    return Array.from(counts.entries())
      .filter(([name, cnt]) => cnt > 0 || ['GUSTAVO', 'EUDE', 'BEATRIZ SANTANA'].includes(name))
      .map(([name, count]) => ({ name, count }));
  }, [allRecords]);

  // Counts for the 4 Quick Toggles (respecting Project & Buyer filter)
  const toggleCounts = useMemo(() => {
    const base = allRecords.filter((r) => {
      if (selectedProject !== 'ALL' && r.projeto !== selectedProject) return false;
      if (selectedBuyer !== 'ALL' && r.comprador !== selectedBuyer) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const match =
          r.po.toLowerCase().includes(q) ||
          r.refMfx.toLowerCase().includes(q) ||
          r.fornecedor.toLowerCase().includes(q) ||
          r.materiaisResumo.toLowerCase().includes(q) ||
          r.projeto.toLowerCase().includes(q) ||
          r.comprador.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    return {
      DELAYED: base.filter((r) => r.isPreShipment && r.supplierHealth === 'CRITICAL_DELAY').length,
      MISSING_DATE: base.filter((r) => r.isPreShipment && r.supplierHealth === 'MISSING_DATE').length,
      ALL_PENDING_SHIPMENT: base.filter((r) => r.isPreShipment).length,
      ALL_PROJECT_ORDERS: base.length,
    };
  }, [allRecords, selectedProject, selectedBuyer, searchQuery]);

  // Filtered rows for the Supplier Follow-up Table
  const filteredRows = useMemo(() => {
    return allRecords
      .filter((r) => {
        if (selectedProject !== 'ALL' && r.projeto !== selectedProject) return false;
        if (selectedBuyer !== 'ALL' && r.comprador !== selectedBuyer) return false;

        if (quickToggle === 'DELAYED') {
          if (!r.isPreShipment || r.supplierHealth !== 'CRITICAL_DELAY') return false;
        } else if (quickToggle === 'MISSING_DATE') {
          if (!r.isPreShipment || r.supplierHealth !== 'MISSING_DATE') return false;
        } else if (quickToggle === 'ALL_PENDING_SHIPMENT') {
          if (!r.isPreShipment) return false;
        }

        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const match =
            r.po.toLowerCase().includes(q) ||
            r.refMfx.toLowerCase().includes(q) ||
            r.fornecedor.toLowerCase().includes(q) ||
            r.materiaisResumo.toLowerCase().includes(q) ||
            r.projeto.toLowerCase().includes(q) ||
            r.comprador.toLowerCase().includes(q) ||
            r.statusColA.toLowerCase().includes(q);
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort critical delays first, then missing dates, then by delayDays descending
        const score = (x: UnifiedPoRecord) =>
          x.supplierHealth === 'CRITICAL_DELAY'
            ? 3
            : x.supplierHealth === 'MISSING_DATE'
            ? 2
            : x.isPreShipment
            ? 1
            : 0;
        if (score(b) !== score(a)) return score(b) - score(a);
        return b.delayDays - a.delayDays;
      });
  }, [allRecords, selectedProject, selectedBuyer, quickToggle, searchQuery]);

  // Copy Follow-up Cobrança Email to Clipboard
  const handleCopyFollowupEmail = (e: React.MouseEvent, rec: UnifiedPoRecord) => {
    e.stopPropagation();
    const delayInfo =
      rec.supplierHealth === 'CRITICAL_DELAY'
        ? `⚠️ ALERTA CRÍTICO: Prontidão/ETD vencido há +${rec.delayDays} dia(s)!`
        : rec.supplierHealth === 'MISSING_DATE'
        ? `⚠️ PENDÊNCIA: Confirmar Data de Prontidão da Carga e Previsão de Embarque (ETD).`
        : `Status em acompanhamento preventivo.`;

    const emailBody = [
      `ASSUNTO: [FOLLOW-UP COMEX MFX] Cobrança de Prontidão / Embarque — PO ${rec.po} — ${rec.fornecedor} (Projeto: ${rec.projeto})`,
      ``,
      `Prezado(a) Fornecedor (${rec.fornecedor}) / Comprador Responsável (${rec.comprador}),`,
      ``,
      `Solicitamos atualização urgente de follow-up e cronograma de embarque para o pedido abaixo:`,
      `• Projeto / Aplicação: ${rec.projeto}`,
      `• Ordem de Compra (PO/OC): ${rec.po}`,
      `• Referência Comex (REF. MFX): ${rec.refMfx}`,
      `• Fornecedor / Origem: ${rec.fornecedor} (${rec.origem})`,
      `• Material / Qtd: ${rec.materiaisResumo} (${rec.qtdTotal.toLocaleString('pt-BR')} ${rec.unidade})`,
      `• Status Atual no FUP: ${rec.statusColA}`,
      `• Data Prontidão Carga: ${rec.dataProntidaoDisplay || 'PENDENTE / COBRAR DATA'}`,
      `• Previsão Embarque (ETD): ${rec.etdDisplay || 'PENDENTE / COBRAR ETD'}`,
      ``,
      `${delayInfo}`,
      ``,
      `Favor informar data firme de prontidão, Packing List/Invoice e disponibilidade para coleta/booking junto ao agente de cargas.`,
      ``,
      `Atenciosamente,`,
      `Equipe Comex & Suprimentos MFX`,
    ].join('\n');

    navigator.clipboard?.writeText(emailBody).catch(() => {});
    setCopiedRowId(rec.uid);
    setTimeout(() => setCopiedRowId(null), 3000);

    onNotify?.(
      `Cobrança Copiada — PO ${rec.po}`,
      `Texto de cobrança para ${rec.fornecedor} (Resp: ${rec.comprador}) copiado para a área de transferência!`,
      'info'
    );
  };

  const fmtCurrency = (val: number, curr = 'BRL') =>
    val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: curr === 'EUR' ? 'EUR' : curr === 'USD' ? 'USD' : 'BRL',
      maximumFractionDigits: 0,
    });

  return (
    <div className="space-y-6">
      {/* =====================================================================
          HEADER BANNER: FOLLOW-UP FORNECEDORES & CAPEX PROJETOS
         ===================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-800/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                🏭 Expediting & Follow-up de Fornecedores + Controle CAPEX
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                {allRecords.length} Processos / POs Mapeados
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2.5 text-white">
              Follow-up de POs Pendentes & Cronograma de Projetos (CAPEX)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1">
              Rastreamento ativo de pedidos em fabricação no fornecedor, cobrança de datas de prontidão/ETD vencidas e avanço físico consolidado por Projeto.
            </p>
          </div>

          {/* Summary Mini-KPIs */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="bg-red-500/20 border border-red-400/40 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-red-200 block">
                🔴 Atraso Fornecedor
              </span>
              <span className="text-2xl font-black font-mono text-red-300">
                {toggleCounts.DELAYED}
              </span>
            </div>
            <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-amber-200 block">
                🟠 Sem Data/ETD
              </span>
              <span className="text-2xl font-black font-mono text-amber-300">
                {toggleCounts.MISSING_DATE}
              </span>
            </div>
            <div className="bg-blue-500/20 border border-blue-400/40 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] font-bold uppercase text-blue-200 block">
                📦 Pré-Embarque
              </span>
              <span className="text-2xl font-black font-mono text-blue-200">
                {toggleCounts.ALL_PENDING_SHIPMENT}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TOP SECTION: CAPEX & PROJECT MILESTONE CONTROL CARDS
         ===================================================================== */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
              <i className="fas fa-diagram-project text-indigo-600 dark:text-indigo-400"></i>
              <span>Controle de Marcos por Projeto & CAPEX (Clique para Filtrar)</span>
            </h3>
          </div>
          {selectedProject !== 'ALL' && (
            <button
              type="button"
              onClick={() => setSelectedProject('ALL')}
              className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <i className="fas fa-filter-circle-xmark"></i>
              <span>Mostrando Projeto: {selectedProject} (Limpar Filtro)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projectCards.map((proj) => {
            const isSelected = selectedProject === proj.projeto;
            const hasDelays = proj.delayedSupplierCount > 0;

            return (
              <div
                key={proj.projeto}
                onClick={() =>
                  setSelectedProject((prev) => (prev === proj.projeto ? 'ALL' : proj.projeto))
                }
                className={`rounded-2xl p-5 border transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-2 border-indigo-600 dark:border-indigo-400 shadow-lg ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-600'
                }`}
              >
                {/* 1. Project Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider bg-indigo-600 text-white">
                        {proj.projeto}
                      </span>
                      <span className="text-xs font-mono font-extrabold text-gray-600 dark:text-gray-300">
                        {proj.totalPos} {proj.totalPos === 1 ? 'PO / Processo' : 'POs / Processos'}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                      VMLD Total: <strong className="text-gray-800 dark:text-gray-200">{fmtCurrency(proj.totalBRL, 'BRL')}</strong>
                      {proj.totalUSD > 0 && ` • ${fmtCurrency(proj.totalUSD, 'USD')}`}
                      {proj.totalEUR > 0 && ` • ${fmtCurrency(proj.totalEUR, 'EUR')}`}
                    </div>
                  </div>

                  {/* Completion Percentage Pill */}
                  <div className="text-right shrink-0">
                    <span className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400">
                      {proj.completionPercent}%
                    </span>
                    <span className="block text-[10px] font-bold uppercase text-gray-400">
                      Avanço Físico
                    </span>
                  </div>
                </div>

                {/* 2. Overall Project Completion Bar (0% to 100%) */}
                <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      proj.completionPercent === 100
                        ? 'bg-emerald-500'
                        : hasDelays
                        ? 'bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-600 to-emerald-500'
                    }`}
                    style={{ width: `${proj.completionPercent}%` }}
                  />
                </div>

                {/* 5-Stage CAPEX Milestone Breakdown */}
                <div className="grid grid-cols-5 gap-1.5 text-center mb-3">
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                    <div className="text-xs font-black font-mono text-slate-800 dark:text-slate-200">
                      {proj.stage1Prod}
                    </div>
                    <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                      1. Produção
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70">
                    <div className="text-xs font-black font-mono text-amber-800 dark:text-amber-300">
                      {proj.stage2Ready}
                    </div>
                    <div className="text-[9px] font-bold text-amber-700 dark:text-amber-400 leading-tight mt-0.5">
                      2. Ag. Emb.
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70">
                    <div className="text-xs font-black font-mono text-blue-800 dark:text-blue-300">
                      {proj.stage3Transit}
                    </div>
                    <div className="text-[9px] font-bold text-blue-700 dark:text-blue-400 leading-tight mt-0.5">
                      3. Trânsito
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/70">
                    <div className="text-xs font-black font-mono text-purple-800 dark:text-purple-300">
                      {proj.stage4Port}
                    </div>
                    <div className="text-[9px] font-bold text-purple-700 dark:text-purple-400 leading-tight mt-0.5">
                      4. Porto/DI
                    </div>
                  </div>

                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70">
                    <div className="text-xs font-black font-mono text-emerald-800 dark:text-emerald-300">
                      {proj.stage5Delivered}
                    </div>
                    <div className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 leading-tight mt-0.5">
                      5. Fábrica
                    </div>
                  </div>
                </div>

                {/* 3. Project Schedule Health Badge & Estimated Project Completion Date */}
                <div className="pt-2.5 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-[11px]">
                  {hasDelays ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                      <i className="fas fa-triangle-exclamation"></i>
                      {proj.delayedSupplierCount} PO(s) atrasada(s) no fornecedor
                    </span>
                  ) : proj.missingDateCount > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <i className="fas fa-clock"></i>
                      {proj.missingDateCount} PO(s) sem prontidão/ETD
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <i className="fas fa-check-circle"></i>
                      Cronograma Fornecedores OK
                    </span>
                  )}

                  <span className="font-mono text-gray-600 dark:text-gray-300 shrink-0">
                    Conclusão Prev.: <strong className="text-gray-900 dark:text-white">{proj.latestCompletionStr}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =====================================================================
          BOTTOM SECTION: PAINEL DE COBRANÇA DE FORNECEDORES (POs PENDENTES)
         ===================================================================== */}
      <section className="bg-white dark:bg-[#1f2937] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Controls Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <i className="fas fa-bell text-amber-500"></i>
                <span>Painel de Cobrança de Fornecedores (POs Pendentes de Embarque)</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Pedidos que ainda não embarcaram (Em Produção, Ag. Embarque, Sem BL/AWB) ou com Prontidão/ETD vencidos.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:w-96">
              <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar PO, Fornecedor, Material, REF. MFX ou Projeto..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-[#111827] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Quick Filter Toggles (4 Modes) */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickToggle('DELAYED')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                quickToggle === 'DELAYED'
                  ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/30'
                  : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900 hover:bg-red-100'
              }`}
            >
              <span>🔴 Atrasados no Fornecedor (Prontidão/ETD Vencido)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-current">
                {toggleCounts.DELAYED}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickToggle('MISSING_DATE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                quickToggle === 'MISSING_DATE'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md ring-2 ring-amber-400/30'
                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900 hover:bg-amber-100'
              }`}
            >
              <span>🟠 Sem Data de Prontidão/ETD (Cobrar Fornecedor)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/15 text-current">
                {toggleCounts.MISSING_DATE}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickToggle('ALL_PENDING_SHIPMENT')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                quickToggle === 'ALL_PENDING_SHIPMENT'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📦 Todos Pendentes de Embarque (Pré-Embarque)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-current">
                {toggleCounts.ALL_PENDING_SHIPMENT}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setQuickToggle('ALL_PROJECT_ORDERS')}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                quickToggle === 'ALL_PROJECT_ORDERS'
                  ? 'bg-slate-800 dark:bg-blue-600 text-white border-slate-800 shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200'
              }`}
            >
              <span>📊 Todos os Pedidos do Projeto (Visão Geral)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-black/20 text-current">
                {toggleCounts.ALL_PROJECT_ORDERS}
              </span>
            </button>
          </div>

          {/* Buyer Filter Row (COMPRADOR RESPONSAVEL) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs font-extrabold text-gray-500 dark:text-gray-400 uppercase mr-1">
              <i className="fas fa-user-tie mr-1"></i>Comprador Responsável:
            </span>
            <button
              type="button"
              onClick={() => setSelectedBuyer('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                selectedBuyer === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Todos ({allRecords.length})
            </button>
            {buyersList.map((b) => (
              <button
                key={b.name}
                type="button"
                onClick={() => setSelectedBuyer(b.name)}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  selectedBuyer === b.name
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
                }`}
              >
                {b.name} ({b.count})
              </button>
            ))}
          </div>
        </div>

        {/* Supplier Follow-up Table (9 Required Columns) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-[#111827] border-b border-gray-200 dark:border-gray-700 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3.5 px-4">1. Projeto</th>
                <th className="py-3.5 px-4">2. PO / OC &amp; REF. MFX</th>
                <th className="py-3.5 px-4">3. Fornecedor &amp; Origem</th>
                <th className="py-3.5 px-4">4. Comprador Resp.</th>
                <th className="py-3.5 px-4">5. Materiais / Qtd</th>
                <th className="py-3.5 px-4">6. Status Atual (Col A)</th>
                <th className="py-3.5 px-4">7. Data Prontidão Carga</th>
                <th className="py-3.5 px-4">8. Previsão Embarque (ETD)</th>
                <th className="py-3.5 px-4 text-right">9. Dias Atraso / Follow-up Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700/70 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500 dark:text-gray-400">
                    <i className="fas fa-clipboard-check text-3xl text-emerald-500 mb-2 block"></i>
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200 block">
                      Nenhum pedido pendente encontrado para este filtro
                    </span>
                    <span className="text-xs">
                      Experimente alternar para &ldquo;📦 Todos Pendentes de Embarque&rdquo; ou &ldquo;📊 Todos os Pedidos do Projeto&rdquo;.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isCritical = row.supplierHealth === 'CRITICAL_DELAY';
                  const isMissingDate = row.supplierHealth === 'MISSING_DATE';

                  return (
                    <tr
                      key={row.uid}
                      onClick={() => row.sourceProcess && onSelectProcess(row.sourceProcess)}
                      className={`transition-colors cursor-pointer ${
                        isCritical
                          ? 'bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50/80 dark:hover:bg-red-950/40'
                          : isMissingDate
                          ? 'bg-amber-50/30 dark:bg-amber-950/15 hover:bg-amber-50/70 dark:hover:bg-amber-950/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      {/* Col 1: PROJETO */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          {row.projeto}
                        </span>
                      </td>

                      {/* Col 2: PO / OC & REF. MFX */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono font-black text-sm text-gray-900 dark:text-white">
                          PO: {row.po}
                        </div>
                        {row.hasExplicitRefMfx ? (
                          <div className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                            REF: {row.refMfx}
                          </div>
                        ) : (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            Sem Referência / Ag. Abertura
                          </span>
                        )}
                      </td>

                      {/* Col 3: FORNECEDOR & ORIGEM */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-gray-900 dark:text-white">
                          {row.fornecedor}
                        </div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">
                          Origem: {row.origem} • {row.modal}
                        </div>
                      </td>

                      {/* Col 4: COMPRADOR RESPONSAVEL */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                          {row.comprador}
                        </span>
                      </td>

                      {/* Col 5: MATERIAIS / QTD */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-bold text-gray-800 dark:text-gray-200 truncate" title={row.materiaisResumo}>
                          {row.materiaisResumo}
                        </div>
                        <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                          Qtd: <strong>{row.qtdTotal.toLocaleString('pt-BR')} {row.unidade}</strong>
                          {row.itensCount > 1 && ` (${row.itensCount} itens)`}
                        </div>
                      </td>

                      {/* Col 6: STATUS ATUAL (COL A) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold uppercase border ${
                            row.capexStage === 5
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300'
                              : row.capexStage === 3 || row.capexStage === 4
                              ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 border-blue-300'
                              : 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300'
                          }`}
                        >
                          {row.statusColA}
                        </span>
                      </td>

                      {/* Col 7: DATA PRONTIDÃO CARGA */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        {row.dataProntidaoDisplay ? (
                          <span
                            className={`font-extrabold text-xs px-2 py-1 rounded ${
                              isCritical
                                ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {row.dataProntidaoDisplay}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-[11px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                            ⚠️ Cobrar Data
                          </span>
                        )}
                      </td>

                      {/* Col 8: PREVISÃO EMBARQUE (ETD) */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono">
                        {row.etdDisplay ? (
                          <span
                            className={`font-extrabold text-xs px-2 py-1 rounded ${
                              isCritical
                                ? 'bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {row.etdDisplay}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                            ⚠️ Cobrar ETD
                          </span>
                        )}
                      </td>

                      {/* Col 9: DIAS DE ATRASO / FOLLOW-UP ACTION */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right">
                        <div className="flex flex-col items-end gap-1.5">
                          {row.isPreShipment ? (
                            isCritical ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-red-600 text-white shadow-xs">
                                🔴 +{row.delayDays} dias em atraso no fornecedor
                              </span>
                            ) : isMissingDate ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-amber-500 text-slate-950">
                                🟠 S/ Data — Cobrar Fornecedor
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                                🟢 No Prazo (Faltam {Math.abs(row.delayDays)} dias)
                              </span>
                            )
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                              ✅ Já Embarcado ({row.blAwb})
                            </span>
                          )}

                          {/* 1-Click Copy Follow-up Cobrança Button */}
                          <button
                            type="button"
                            onClick={(e) => handleCopyFollowupEmail(e, row)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 border ${
                              copiedRowId === row.uid
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white border-slate-700'
                            }`}
                          >
                            <i className={`fas ${copiedRowId === row.uid ? 'fa-check' : 'fa-copy'}`}></i>
                            <span>
                              {copiedRowId === row.uid
                                ? 'Cobrança Copiada!'
                                : '📋 Copiar Cobrança (E-mail)'}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
