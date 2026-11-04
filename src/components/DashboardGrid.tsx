import React from 'react';
import { ImportProcess, AtoConcessorio } from '../types/mfx';

interface DashboardGridProps {
  activeTab: number;
  processos: ImportProcess[];
  atosConcessorios: AtoConcessorio[];
  onSelectProcess: (proc: ImportProcess, tab?: 'overview' | 'espelho' | 'drawback') => void;
  onSelectAC: (ac: AtoConcessorio) => void;
}

export const DashboardGrid: React.FC<DashboardGridProps> = ({
  activeTab,
  processos,
  atosConcessorios,
  onSelectProcess,
  onSelectAC,
}) => {
  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmtCurr = (val: number, curr: string) =>
    `${curr} ${val.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

  if (processos.length === 0 && activeTab !== 5) {
    return (
      <div className="bg-white dark:bg-[#1f2937] p-12 rounded-xl shadow border border-gray-200 dark:border-[#374151] text-center">
        <i className="fas fa-filter-circle-xmark text-4xl text-gray-400 mb-3"></i>
        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">
          Nenhum processo encontrado para os filtros selecionados
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Clique no botão &quot;Limpar&quot; no painel de filtros acima para restaurar todos os processos da MFX.
        </p>
      </div>
    );
  }

  // ============================================================================
  // TAB 1: Forecast de POs & Entregas (PO Planning & Arrivals)
  // ============================================================================
  if (activeTab === 1) {
    return (
      <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {processos.map((p) => (
          <article
            key={p.id}
            onClick={() => onSelectProcess(p, 'overview')}
            className={`card risk-${p.riskLevel} cursor-pointer`}
          >
            <div className="card-header flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold font-mono text-gray-900 dark:text-white">
                    {p.id}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {p.oc}
                  </span>
                </div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">
                  {p.fornecedor} <span className="font-normal text-gray-500">({p.paisOrigem})</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 block">
                  {p.projeto}
                </span>
                <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                  <i className={`fas ${p.modal === 'AÉREO' ? 'fa-plane text-sky-500' : 'fa-ship text-blue-500'} mr-1`}></i>
                  {p.modal} · {p.incoterm}
                </span>
              </div>
            </div>

            <div className="card-body space-y-3 text-xs">
              {/* Alert if Air shipment missing AWB pre-alert */}
              {p.alertaPreAlertaAWB && (
                <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 font-bold flex items-center gap-2">
                  <i className="fas fa-bell-slash text-sm shrink-0"></i>
                  <span>ALERTA AÉREO: Sem Pré-Alerta AWB enviado para Ômega!</span>
                </div>
              )}

              {/* Stalled Drawback alert */}
              {p.cargaParadaDrawback && (
                <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 font-semibold">
                  <i className="fas fa-ban mr-1.5 text-red-600"></i>
                  <strong>CARGA PARADA ({p.diasParadoPortoAeroporto}d):</strong> {p.motivoParadaDrawback}
                </div>
              )}

              <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Status Atual</span>
                  <span
                    className={`font-extrabold ${
                      p.cargaParadaDrawback
                        ? 'text-red-600 dark:text-red-400'
                        : p.status === 'Entregue MFX'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Nº BL / AWB</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 truncate block">
                    {p.blAwb}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Data Embarque (ETD)</span>
                  <span className="font-mono font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {p.etd}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Previsão Chegada (ETA)</span>
                  <span className="font-mono font-bold tabular-nums text-gray-900 dark:text-white">
                    {p.eta}
                    {p.atrasoEtaDias > 0 && (
                      <span className="text-orange-600 dark:text-orange-400 ml-1">
                        (+{p.atrasoEtaDias}d)
                      </span>
                    )}
                  </span>
                </div>

                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Prazo Entrega MFX</span>
                  <span className="font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                    {p.dataEntregaMFX || p.prazoEntregaMFX}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">Ato Concessório</span>
                  <span className="font-mono font-semibold text-gray-700 dark:text-gray-300 truncate block">
                    {p.atoConcessorio}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 text-[11px] text-gray-600 dark:text-gray-400 truncate">
                <i className="fas fa-box-open mr-1.5 text-gray-400"></i>
                {p.itens[0]?.descricao} (NCM {p.itens[0]?.ncm})
              </div>
            </div>

            <div className="card-footer flex items-center justify-between text-xs">
              <span className="font-mono font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                VMLD: {fmtBRL(p.vmldBRL)}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                Ver Itens & Timeline <i className="fas fa-chevron-right text-[10px]"></i>
              </span>
            </div>
          </article>
        ))}
      </div>
    );
  }

  // ============================================================================
  // TAB 2: Análise de KPIs & Lead Times (Import Performance & Channels)
  // ============================================================================
  if (activeTab === 2) {
    return (
      <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {processos.map((p) => {
          const totalLeadTime =
            p.transitTimeDias + p.tempoDesembaracoDias + p.tempoEntregaRodoviariaDias;
          const isFreeTimeCritical =
            p.freeTimeDiasRestantes < 3 && p.status !== 'Entregue MFX' && p.status !== 'Em Trânsito';

          return (
            <article
              key={p.id}
              onClick={() => onSelectProcess(p, 'overview')}
              className={`card risk-${p.riskLevel} cursor-pointer`}
            >
              <div className="card-header flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold font-mono text-gray-900 dark:text-white">
                      {p.id}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {p.modal} ({p.agenteCarga})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Despachante: <strong className="text-gray-800 dark:text-gray-200">{p.despachante}</strong> · DI:{' '}
                    {p.numeroDiDuimp}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-extrabold block ${
                      p.canal === 'Verde'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : p.canal === 'Vermelho'
                        ? 'text-red-600 dark:text-red-400'
                        : p.canal === 'Amarelo'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500'
                    }`}
                  >
                    <i className="fas fa-traffic-light mr-1"></i>Canal {p.canal}
                  </span>
                  <span className="text-[11px] text-gray-500">LI: {p.liAnuente || 'Isento'}</span>
                </div>
              </div>

              <div className="card-body space-y-3 text-xs">
                {/* Lead Time Breakdown Bars */}
                <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 dark:bg-[#111827] p-2.5 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <span className="text-[10px] text-gray-500 block">Transit Time</span>
                    <span className="font-mono font-extrabold text-sm text-blue-600 dark:text-blue-400 tabular-nums">
                      {p.transitTimeDias}d
                    </span>
                  </div>
                  <div className="border-x border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 block">Desembaraço</span>
                    <span
                      className={`font-mono font-extrabold text-sm tabular-nums ${
                        p.tempoDesembaracoDias > 5 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {p.tempoDesembaracoDias}d
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Rodoviário</span>
                    <span className="font-mono font-extrabold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {p.tempoEntregaRodoviariaDias}d
                    </span>
                  </div>
                </div>

                {/* Free Time Countdown & Demurrage Risk */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">
                      Countdown Free Time Demurrage/TECA:
                    </span>
                    <span
                      className={`font-mono font-extrabold tabular-nums ${
                        isFreeTimeCritical ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {p.freeTimeDiasRestantes} dias restantes (de {p.freeTimeTotalDias}d)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        isFreeTimeCritical ? 'bg-red-600' : 'bg-emerald-500'
                      }`}
                      style={{
                        width: `${Math.max(
                          8,
                          Math.min(100, (p.freeTimeDiasRestantes / Math.max(1, p.freeTimeTotalDias)) * 100)
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-[11px] text-gray-600 dark:text-gray-400">
                  <span>Armazenagem Acumulada:</span>
                  <strong
                    className={`font-mono tabular-nums ${
                      p.armazenagemAcumuladaBRL > 15000 ? 'text-red-600 font-extrabold' : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {fmtBRL(p.armazenagemAcumuladaBRL)}{' '}
                    {p.custoDiarioArmazenagemBRL > 0 && `(+${fmtBRL(p.custoDiarioArmazenagemBRL)}/dia)`}
                  </strong>
                </div>
              </div>

              <div className="card-footer flex items-center justify-between text-xs">
                <span className="font-mono font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                  Lead Time Total: {totalLeadTime} dias
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  Auditar SLA <i className="fas fa-chevron-right text-[10px] ml-1"></i>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  // ============================================================================
  // TAB 3: Custos, Cashflow (PO/CI) & Impostos (Financial Forecast)
  // ============================================================================
  if (activeTab === 3) {
    return (
      <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {processos.map((p) => (
          <article
            key={p.id}
            onClick={() => onSelectProcess(p, 'espelho')}
            className={`card risk-${p.riskLevel} cursor-pointer`}
          >
            <div className="card-header flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold font-mono text-gray-900 dark:text-white">
                    {p.commercialInvoice}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                    {p.id}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {p.fornecedor} · PO {p.oc} · Projeto {p.projeto}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-extrabold text-gray-900 dark:text-white block tabular-nums">
                  {p.condicaoPagamento}
                </span>
                <span className="text-[11px] font-mono text-gray-500 tabular-nums">
                  Venc: {p.dataVencimentoInvoice}
                </span>
              </div>
            </div>

            <div className="card-body space-y-3 text-xs">
              {/* Alert if Recolhimento Integral Leakage */}
              {p.impostosPagosIndevidamenteBRL > 0 ? (
                <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 font-bold">
                  <i className="fas fa-triangle-exclamation mr-1.5 text-red-600"></i>
                  ALERTA VAZAMENTO FISCAL: {fmtBRL(p.impostosPagosIndevidamenteBRL)} recolhidos sem Drawback!
                </div>
              ) : p.regime === 'Drawback Suspensão' ? (
                <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-between">
                  <span>
                    <i className="fas fa-shield-halved mr-1.5"></i>Economia Drawback Suspensão:
                  </span>
                  <strong className="font-mono tabular-nums">
                    {fmtBRL(p.impostosSuspensosDrawbackBRL)}
                  </strong>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                    Valor FOB ({p.moeda})
                  </span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                    {fmtCurr(p.valorFOBMoeda, p.moeda)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                    Taxa PTAX / DI
                  </span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                    R$ {p.taxaPtaxDI.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                    Valor CIF / VMLD (R$)
                  </span>
                  <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 tabular-nums">
                    {fmtBRL(p.vmldBRL)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block text-[11px]">
                    Impostos DI (II+IPI+PIS+COF+ICMS)
                  </span>
                  <span className="font-mono font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                    {fmtBRL(p.totalImpostosEstimadosBRL)}
                  </span>
                </div>
              </div>
            </div>

            <div className="card-footer flex items-center justify-between">
              <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400">
                Desp. Porto/Armaz: {fmtBRL(p.despesasAduaneirasBRL + p.armazenagemAcumuladaBRL)}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectProcess(p, 'espelho');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-xs transition-colors cursor-pointer"
              >
                <i className="fas fa-file-invoice-dollar mr-1.5"></i>Ver Espelho de Custos / NF
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  }

  // ============================================================================
  // TAB 4: Fretes, Rodoviário & Saving (Freight & Trucking Savings)
  // ============================================================================
  if (activeTab === 4) {
    const agentesList = ['DSV', 'DHL', 'KN', 'FEDEX', 'Hellmann'] as const;
    const agentSummaries = agentesList
      .map((ag) => {
        const list = processos.filter(
          (p) => p.agenteCarga.toUpperCase() === ag.toUpperCase()
        );
        const cotado = list.reduce((s, p) => s + p.cotacaoFreteBRL, 0);
        const pago = list.reduce((s, p) => s + p.fretePagoBRL, 0);
        const saving = list.reduce((s, p) => s + p.savingFreteBRL, 0);
        const rodoviario = list.reduce((s, p) => s + p.freteRodoviarioBRL, 0);
        const pesoTotal = list.reduce((s, p) => s + p.pesoBrutoKg, 0);
        const cbmTotal = list.reduce((s, p) => s + p.cubagemCbm, 0);
        const pct = cotado > 0 ? (saving / cotado) * 100 : 0;
        return { ag, list, cotado, pago, saving, rodoviario, pesoTotal, cbmTotal, pct };
      })
      .filter((x) => x.list.length > 0);

    return (
      <div className="space-y-6">
        <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* First: Consolidated Agent / Forwarder Performance Cards */}
          {agentSummaries.map((item) => (
            <article
              key={item.ag}
              onClick={() => onSelectProcess(item.list[0], 'espelho')}
              className="card risk-low cursor-pointer"
            >
              <div className="card-header flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                    Consolidado Agente Internacional
                  </span>
                  <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                    <i className="fas fa-globe mr-2 text-blue-600"></i>
                    {item.ag} Global Forwarding
                  </h3>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                    {item.list.length} Embarques
                  </span>
                  <span className="text-[11px] text-gray-500 tabular-nums">
                    {(item.pesoTotal / 1000).toFixed(1)} ton · {item.cbmTotal.toFixed(0)} m³
                  </span>
                </div>
              </div>

              <div className="card-body space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">
                      Saving de Frete Gerado ({item.ag})
                    </span>
                    <span className="text-base font-extrabold font-mono text-emerald-700 dark:text-emerald-300 tabular-nums">
                      + {fmtBRL(item.saving)}
                    </span>
                  </div>
                  <span className="text-sm font-mono font-extrabold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    -{item.pct.toFixed(1)}% vs Cotado
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Frete Cotado (R$)</span>
                    <span className="font-mono font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                      {fmtBRL(item.cotado)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Frete Efetivo Pago (R$)</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                      {fmtBRL(item.pago)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[11px]">
                  <span className="text-gray-500">Frete Rodoviário Nacional Vinculado:</span>
                  <strong className="font-mono text-gray-800 dark:text-gray-200 tabular-nums">
                    {fmtBRL(item.rodoviario)}
                  </strong>
                </div>
              </div>

              <div className="card-footer flex items-center justify-between text-xs">
                <span className="text-gray-500 truncate">
                  Processos: {item.list.map((p) => p.id).join(', ')}
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold shrink-0 ml-2">
                  Detalhes <i className="fas fa-chevron-right text-[10px]"></i>
                </span>
              </div>
            </article>
          ))}

          {/* Individual Process Freight & Trucking Cards */}
          {processos.map((p) => (
            <article
              key={p.id}
              onClick={() => onSelectProcess(p, 'espelho')}
              className={`card risk-${p.riskLevel} cursor-pointer`}
            >
              <div className="card-header flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold font-mono text-gray-900 dark:text-white">
                      {p.id}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {p.agenteCarga} ({p.modal})
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Armador/Cia: {p.armadorCiaAerea} · Incoterm {p.incoterm}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 block tabular-nums">
                    +{fmtBRL(p.savingFreteBRL)}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                    Saving (-{p.savingFretePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="card-body space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Cotação Frete (R$)</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300 line-through tabular-nums">
                      {fmtBRL(p.cotacaoFreteBRL)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Frete Pago (R$)</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white tabular-nums">
                      {fmtBRL(p.fretePagoBRL)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Transportadora Nacional</span>
                    <span className="font-bold text-gray-800 dark:text-gray-200">
                      <i className="fas fa-truck mr-1 text-orange-500"></i>
                      {p.transportadoraNacional}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Custo Rodoviário MFX</span>
                    <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                      {fmtBRL(p.freteRodoviarioBRL)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="card-footer flex items-center justify-between text-xs">
                <span className="font-mono text-gray-600 dark:text-gray-400 tabular-nums">
                  {p.pesoBrutoKg.toLocaleString('pt-BR')} kg · {p.cubagemCbm} m³
                </span>
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  Auditar Frete <i className="fas fa-chevron-right text-[10px]"></i>
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TAB 5: Controle de Drawback (7 ACs) & The 9 Stalled Cargoes
  // ============================================================================
  const stalledCargoes = processos.filter((p) => p.cargaParadaDrawback);

  return (
    <div className="space-y-8">
      {/* SECTION A: THE 7 MASTER ATOS CONCESSÓRIOS CARDS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <i className="fas fa-shield-halved text-blue-600"></i>
            PAINEL DOS 7 ATOS CONCESSÓRIOS (DRAWBACK SUSPENSÃO INTEGRADO MFX)
          </h3>
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
            Clique em qualquer AC para abrir a lista completa de NCMs e Laudos Técnicos
          </span>
        </div>

        <div id="dashboard-grid" className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {atosConcessorios.map((ac) => {
            const pctUsed = Math.min(
              100,
              Math.round((ac.utilizadoImportacaoUSD / ac.limiteImportacaoUSD) * 100)
            );
            return (
              <article
                key={ac.id}
                onClick={() => onSelectAC(ac)}
                className={`card risk-${ac.riscoAC} cursor-pointer`}
              >
                <div className="card-header flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold font-mono text-gray-900 dark:text-white">
                        {ac.id}
                      </span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                        {ac.projetoVinculado}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                      SECEX Nº {ac.numeroAC} · Venc: {ac.dataVencimento}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-extrabold block ${
                        ac.statusAC === 'Ativo'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-orange-600 dark:text-orange-400'
                      }`}
                    >
                      {ac.statusAC === 'Ativo' ? '● ATIVO' : '▲ EM ALTERAÇÃO SECEX'}
                    </span>
                    <span className="text-[11px] font-mono text-gray-500 tabular-nums">
                      {ac.diasRestantes} dias restantes
                    </span>
                  </div>
                </div>

                <div className="card-body space-y-3 text-xs">
                  {ac.itensComDivergenciaLaudo > 0 && (
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 font-semibold text-[11px]">
                      <i className="fas fa-triangle-exclamation mr-1.5 text-red-600"></i>
                      {ac.itensComDivergenciaLaudo} item(ns) c/ Qtd 0,01 ou NCM divergente ·{' '}
                      {ac.cargasParadasAguardando} carga(s) parada(s)
                    </div>
                  )}

                  {/* Progress bar of Import Balance USD */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">Consumo do Saldo de Importação (USD):</span>
                      <span className="font-mono font-bold tabular-nums">{pctUsed}% utilizado</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          pctUsed > 85 ? 'bg-orange-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${pctUsed}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-500 block text-[11px]">Saldo Disponível Imp.</span>
                      <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        USD {ac.saldoDisponivelUSD.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Limite Total Imp.</span>
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                        USD {ac.limiteImportacaoUSD.toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Itens Cadastrados</span>
                      <span className="font-mono font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                        {ac.totalItensCadastrados} insumos (de ~308)
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[11px]">Compromisso Exportação</span>
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200 tabular-nums">
                        USD {(ac.compromissoExportacaoUSD / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-footer flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-mono truncate">
                    Processos: {ac.processosVinculados.join(', ')}
                  </span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0 ml-2">
                    Auditar NCMs <i className="fas fa-chevron-right text-[10px]"></i>
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* SECTION B: THE 9 STALLED CARGOES WAITING FOR DRAWBACK */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-red-600 dark:text-red-400 flex items-center gap-2">
            <i className="fas fa-ban"></i>
            AS {stalledCargoes.length} CARGAS PARADAS AGUARDANDO ATO CONCESSÓRIO / RETIFICAÇÃO DE LAUDO
          </h3>
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
            Clique em qualquer carga parada para alocar um AC ou corrigir o NCM
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {stalledCargoes.map((p) => (
            <article
              key={p.id}
              onClick={() => onSelectProcess(p, 'drawback')}
              className="card risk-high cursor-pointer"
            >
              <div className="card-header flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold font-mono text-red-600 dark:text-red-400">
                      {p.id}
                    </span>
                    <span className="text-xs text-gray-400">·</span>
                    <span className="text-xs font-mono font-bold text-gray-800 dark:text-gray-200">
                      {p.oc}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mt-0.5">
                    {p.fornecedor} · {p.projeto} ({p.modal})
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-red-600 dark:text-red-400 block tabular-nums">
                    {p.diasParadoPortoAeroporto} DIAS PARADO
                  </span>
                  <span className="text-[11px] font-mono text-gray-500">
                    Free Time: {p.freeTimeDiasRestantes}d rest.
                  </span>
                </div>
              </div>

              <div className="card-body space-y-3 text-xs">
                <div className="p-2.5 rounded bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-200 font-semibold">
                  <div className="text-[10px] font-extrabold uppercase text-red-600 dark:text-red-400 mb-0.5">
                    Bloqueio no Siscomex ({p.atoConcessorio}):
                  </div>
                  {p.motivoParadaDrawback}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 block">Custo Armazenagem Acum.</span>
                    <span className="font-mono font-extrabold text-red-600 dark:text-red-400 text-sm tabular-nums">
                      {fmtBRL(p.armazenagemAcumuladaBRL)}
                    </span>
                  </div>
                  <div className="p-2 rounded bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                    <span className="text-[10px] text-gray-500 block">Benefício Drawback a Salvar</span>
                    <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm tabular-nums">
                      {fmtBRL(p.impostosSuspensosDrawbackBRL)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-gray-600 dark:text-gray-400 font-mono truncate">
                  NCM Item: <strong>{p.itens[0]?.ncm}</strong> · Qtd PO: {p.itens[0]?.quantidade}{' '}
                  {p.itens[0]?.unidade} (Qtd AC: {p.itens[0]?.qtdAutorizadaAC})
                </div>
              </div>

              <div className="card-footer flex items-center justify-between">
                <span className="text-[11px] text-gray-500 font-mono">
                  Sugestão: {p.itens[0]?.acSugerido || p.atoConcessorio}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProcess(p, 'drawback');
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-xs cursor-pointer"
                >
                  <i className="fas fa-link mr-1.5"></i>Vincular AC & Destravar
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
