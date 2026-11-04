import React, { useState } from 'react';
import { ImportProcess, AtoConcessorio, PedidoForecastRow } from '../types/mfx';

interface DetailedTableViewProps {
  processos: ImportProcess[];
  pedidosForecast: PedidoForecastRow[];
  atosConcessorios: AtoConcessorio[];
  visibleColumns: Record<string, boolean>;
  onSelectProcess: (proc: ImportProcess, tab?: 'overview' | 'espelho' | 'drawback') => void;
  onSelectAC: (ac: AtoConcessorio) => void;
  onExportExcel: () => void;
}

type SortField =
  | 'id'
  | 'oc'
  | 'fornecedor'
  | 'projeto'
  | 'status'
  | 'modal'
  | 'eta'
  | 'transitTimeDias'
  | 'vmldBRL'
  | 'savingFreteBRL';

export const DetailedTableView: React.FC<DetailedTableViewProps> = ({
  processos,
  pedidosForecast,
  atosConcessorios,
  visibleColumns,
  onSelectProcess,
  onSelectAC,
  onExportExcel,
}) => {
  const [sheetSubView, setSheetSubView] = useState<'PROCESSOS' | 'PEDIDOS' | 'ACS'>('PROCESSOS');
  const [showAll36Cols, setShowAll36Cols] = useState<boolean>(true);
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedProcessos = [...processos].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortAsc ? valA - valB : valB - valA;
    }
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <i className="fas fa-sort text-gray-400 ml-1 text-[10px]"></i>;
    return sortAsc ? (
      <i className="fas fa-sort-up text-blue-600 ml-1 text-[10px]"></i>
    ) : (
      <i className="fas fa-sort-down text-blue-600 ml-1 text-[10px]"></i>
    );
  };

  return (
    <div className="bg-white dark:bg-[#1f2937] rounded-xl shadow border border-gray-200 dark:border-[#374151] overflow-hidden">
      {/* Top Toolbar */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-[#374151] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSheetSubView('PROCESSOS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              sheetSubView === 'PROCESSOS'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-ship mr-1.5"></i>Aba PROCESSOS ({processos.length})
          </button>
          <button
            type="button"
            onClick={() => setSheetSubView('PEDIDOS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              sheetSubView === 'PEDIDOS'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-boxes-stacked mr-1.5"></i>Aba PEDIDOS ({pedidosForecast.length})
          </button>
          <button
            type="button"
            onClick={() => setSheetSubView('ACS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              sheetSubView === 'ACS'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-shield-halved mr-1.5"></i>Aba 7 Atos Concessórios ({atosConcessorios.length})
          </button>

          {sheetSubView === 'PROCESSOS' && (
            <button
              type="button"
              onClick={() => setShowAll36Cols(!showAll36Cols)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fas fa-arrows-left-right mr-1.5 text-teal-600"></i>
              {showAll36Cols ? 'Modo Completo (36 Colunas FUP)' : 'Modo Resumido'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs flex-wrap">
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
              <span className="w-2.5 h-2.5 inline-block bg-red-200 dark:bg-red-900 border border-red-500 rounded-xs"></span>
              Crítico (Parado Drawback / AWB / Vazamento)
            </span>
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <span className="w-2.5 h-2.5 inline-block bg-orange-200 dark:bg-orange-900 border border-orange-500 rounded-xs"></span>
              Atenção (Canal / Atraso ETA)
            </span>
          </div>
          <button
            type="button"
            onClick={onExportExcel}
            className="bg-green-700 hover:bg-green-800 text-white font-bold px-3.5 py-1.5 rounded-md shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <i className="fas fa-file-excel"></i>Exportar Planilha (.XLSX)
          </button>
        </div>
      </div>

      {/* ===================================================================
          SHEET 1: ABA PROCESSOS (36 COLUMNS FROM FUP IMPORTAÇÃO BI_2.xlsx)
         =================================================================== */}
      {sheetSubView === 'PROCESSOS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                {visibleColumns.projeto && (
                  <th
                    onClick={() => handleSort('projeto')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    PROJETO {renderSortIcon('projeto')}
                  </th>
                )}
                {visibleColumns.processo && (
                  <th
                    onClick={() => handleSort('id')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    PROCESSO {renderSortIcon('id')}
                  </th>
                )}
                {visibleColumns.fornecedor && (
                  <th
                    onClick={() => handleSort('fornecedor')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    EXPORTADOR {renderSortIcon('fornecedor')}
                  </th>
                )}
                {showAll36Cols && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">FATURA</th>
                )}
                {showAll36Cols && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">DATA DE VENCIMENTO</th>
                )}
                {visibleColumns.oc && (
                  <th
                    onClick={() => handleSort('oc')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    OC {renderSortIcon('oc')}
                  </th>
                )}
                {visibleColumns.modal && (
                  <th
                    onClick={() => handleSort('modal')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    MODAL {renderSortIcon('modal')}
                  </th>
                )}
                {showAll36Cols && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">INCOTERM</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">COND. PAGAMENTO</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">MOEDA</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">VMLE</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">VMLD</th>
                  </>
                )}
                {visibleColumns.vmld && (
                  <th
                    onClick={() => handleSort('vmldBRL')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    VMLD (R$) {renderSortIcon('vmldBRL')}
                  </th>
                )}
                {showAll36Cols && (
                  <>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">
                      COTAÇÃO FRETE R$
                    </th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">
                      FRETE PAGO R$
                    </th>
                  </>
                )}
                {visibleColumns.saving && (
                  <th
                    onClick={() => handleSort('savingFreteBRL')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    SAVING FRETE {renderSortIcon('savingFreteBRL')}
                  </th>
                )}
                {showAll36Cols && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">AGENTE DE CARGA</th>
                )}
                {visibleColumns.eta && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">EMBARQUE</th>
                    <th
                      onClick={() => handleSort('eta')}
                      className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                    >
                      PREVISÃO CHEGADA {renderSortIcon('eta')}
                    </th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">CHEGADA</th>
                    <th
                      onClick={() => handleSort('transitTimeDias')}
                      className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                    >
                      TT {renderSortIcon('transitTimeDias')}
                    </th>
                  </>
                )}
                {showAll36Cols && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">LOCAL DESEMBARAÇO</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">ANUÊNCIA</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">DEFERIMENTO LI</th>
                  </>
                )}
                {visibleColumns.regimeAC && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">BENEFÍCIO / AC</th>
                )}
                {visibleColumns.blAwb && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">DI</th>
                    {showAll36Cols && (
                      <th className="py-3 px-3 font-extrabold whitespace-nowrap">DATA DO REGISTRO</th>
                    )}
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">CANAL</th>
                  </>
                )}
                {showAll36Cols && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">DESEMBARAÇO</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">
                      DIAS P/ LIBERAÇÃO
                    </th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">CARREGAMENTO</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">TRANSPORTADORA</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">ENTREGA MFX</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">TRÂNSITO</th>
                    <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">LEAD TIME</th>
                  </>
                )}
                {visibleColumns.status && (
                  <th
                    onClick={() => handleSort('status')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    STATUS {renderSortIcon('status')}
                  </th>
                )}
                <th className="py-3 px-3 font-extrabold text-center whitespace-nowrap">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedProcessos.map((p) => {
                const rowClass =
                  p.riskLevel === 'high'
                    ? 'row-risk-high'
                    : p.riskLevel === 'medium'
                    ? 'row-risk-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60';
                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelectProcess(p, 'overview')}
                    className={`${rowClass} cursor-pointer transition-colors`}
                  >
                    {visibleColumns.projeto && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.projeto}</td>
                    )}
                    {visibleColumns.processo && (
                      <td className="py-2.5 px-3 font-mono font-extrabold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {p.id}
                      </td>
                    )}
                    {visibleColumns.fornecedor && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.fornecedor}</td>
                    )}
                    {showAll36Cols && (
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        {p.commercialInvoice}
                      </td>
                    )}
                    {showAll36Cols && (
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                        {p.dataVencimentoInvoice}
                      </td>
                    )}
                    {visibleColumns.oc && (
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                        {p.oc}
                      </td>
                    )}
                    {visibleColumns.modal && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <i
                          className={`fas ${
                            p.modal === 'AÉREO' ? 'fa-plane text-sky-600' : 'fa-ship text-blue-600'
                          } mr-1`}
                        ></i>
                        {p.modal}
                      </td>
                    )}
                    {showAll36Cols && (
                      <>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">{p.incoterm}</td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {p.condicaoPagamento}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                          {p.moeda}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {p.valorFOBMoeda.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {(p.valorVMLDMoeda ?? p.valorFOBMoeda).toLocaleString('pt-BR')}
                        </td>
                      </>
                    )}
                    {visibleColumns.vmld && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        {fmtBRL(p.vmldBRL)}
                      </td>
                    )}
                    {showAll36Cols && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {fmtBRL(p.cotacaoFreteBRL)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {fmtBRL(p.fretePagoBRL)}
                        </td>
                      </>
                    )}
                    {visibleColumns.saving && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap tabular-nums">
                        + {fmtBRL(p.savingFreteBRL)}
                      </td>
                    )}
                    {showAll36Cols && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.agenteCarga}</td>
                    )}
                    {visibleColumns.eta && (
                      <>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.etd}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap tabular-nums">
                          {p.eta}
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.dataChegadaEfetiva || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                          {p.transitTimeDias}d
                        </td>
                      </>
                    )}
                    {showAll36Cols && (
                      <>
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          {p.portoAeroportoDestino}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{p.liAnuente || 'NÃO'}</td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.deferimentoLI || '-'}
                        </td>
                      </>
                    )}
                    {visibleColumns.regimeAC && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold">{p.beneficioRaw || p.regime}</div>
                        <div className="text-[11px] font-mono text-blue-700 dark:text-blue-300">
                          {p.atoConcessorio}
                        </div>
                      </td>
                    )}
                    {visibleColumns.blAwb && (
                      <>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {p.numeroDiDuimp}
                        </td>
                        {showAll36Cols && (
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                            {p.dataRegistroDI || '-'}
                          </td>
                        )}
                        <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.canal}</td>
                      </>
                    )}
                    {showAll36Cols && (
                      <>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.dataDesembaraco || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {p.tempoDesembaracoDias}d
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.dataCarregamento || '-'}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {p.transportadoraNacional}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap tabular-nums">
                          {p.dataEntregaMFX || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {p.tempoEntregaRodoviariaDias}d
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                          {p.leadTimeTotalDias ??
                            p.transitTimeDias +
                              p.tempoDesembaracoDias +
                              p.tempoEntregaRodoviariaDias}
                          d
                        </td>
                      </>
                    )}
                    {visibleColumns.status && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        {p.cargaParadaDrawback ? (
                          <span className="text-red-700 dark:text-red-200 font-extrabold">
                            <i className="fas fa-ban mr-1"></i>
                            {p.statusRawExcel || p.status}
                          </span>
                        ) : (
                          <span>{p.statusRawExcel || p.status}</span>
                        )}
                      </td>
                    )}
                    <td
                      className="py-2.5 px-3 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectProcess(p, 'espelho')}
                          title="Abrir Espelho de Custos / NF"
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                        >
                          NF/Custo
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectProcess(p, 'drawback')}
                          title="Vincular Ato Concessório"
                          className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                        >
                          AC
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================================================================
          SHEET 2: ABA PEDIDOS (EXACT COLUMNS FROM FUP IMPORTAÇÃO BI_2.xlsx)
         =================================================================== */}
      {sheetSubView === 'PEDIDOS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 font-extrabold">PROJETO</th>
                <th className="py-3 px-3 font-extrabold">PROCESSO</th>
                <th className="py-3 px-3 font-extrabold">FORNECEDOR</th>
                <th className="py-3 px-3 font-extrabold">OC</th>
                <th className="py-3 px-3 font-extrabold">EMISSÃO OC</th>
                <th className="py-3 px-3 font-extrabold">INCOTERM</th>
                <th className="py-3 px-3 font-extrabold text-right">VALOR</th>
                <th className="py-3 px-3 font-extrabold">MOEDA</th>
                <th className="py-3 px-3 font-extrabold">PRONTIDÃO DA CARGA</th>
                <th className="py-3 px-3 font-extrabold">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {pedidosForecast.map((pf) => {
                const linkedProc = processos.find(
                  (p) => p.id === pf.processo || p.oc === pf.oc || p.oc.includes(pf.oc)
                );
                const isHigh = linkedProc?.riskLevel === 'high';
                const isMed = linkedProc?.riskLevel === 'medium';
                return (
                  <tr
                    key={pf.id}
                    onClick={() => linkedProc && onSelectProcess(linkedProc, 'overview')}
                    className={`${
                      isHigh
                        ? 'row-risk-high'
                        : isMed
                        ? 'row-risk-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    } cursor-pointer`}
                  >
                    <td className="py-2.5 px-3 font-bold">{pf.projeto}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {pf.processo}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{pf.fornecedor}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold">{pf.oc}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{pf.emissaoOC}</td>
                    <td className="py-2.5 px-3 font-mono">{pf.incoterm}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {pf.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">{pf.moeda}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums">{pf.prontidaoCarga}</td>
                    <td className="py-2.5 px-3 font-bold">{pf.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================================================================
          SHEET 3: 7 ATOS CONCESSÓRIOS
         =================================================================== */}
      {sheetSubView === 'ACS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 font-extrabold">Nº Ato Concessório</th>
                <th className="py-3 px-3 font-extrabold">Status SECEX</th>
                <th className="py-3 px-3 font-extrabold">Projeto</th>
                <th className="py-3 px-3 font-extrabold">Vencimento</th>
                <th className="py-3 px-3 font-extrabold text-right">Limite Imp. (USD)</th>
                <th className="py-3 px-3 font-extrabold text-right">Utilizado (USD)</th>
                <th className="py-3 px-3 font-extrabold text-right">Saldo Disp. (USD)</th>
                <th className="py-3 px-3 font-extrabold text-center">Qtd Itens</th>
                <th className="py-3 px-3 font-extrabold text-center">Cargas Paradas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {atosConcessorios.map((ac) => (
                <tr
                  key={ac.id}
                  onClick={() => onSelectAC(ac)}
                  className={`${
                    ac.riscoAC === 'high'
                      ? 'row-risk-high'
                      : ac.riscoAC === 'medium'
                      ? 'row-risk-medium'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  } cursor-pointer`}
                >
                  <td className="py-3 px-3 font-mono font-extrabold text-blue-700 dark:text-blue-300">
                    {ac.id}
                  </td>
                  <td className="py-3 px-3 font-bold">{ac.statusAC}</td>
                  <td className="py-3 px-3 font-semibold">{ac.projetoVinculado}</td>
                  <td className="py-3 px-3 font-mono tabular-nums">
                    {ac.dataVencimento} ({ac.diasRestantes}d)
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    USD {ac.limiteImportacaoUSD.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums">
                    USD {ac.utilizadoImportacaoUSD.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    USD {ac.saldoDisponivelUSD.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-bold tabular-nums">
                    {ac.totalItensCadastrados} ({ac.itensComDivergenciaLaudo} div.)
                  </td>
                  <td className="py-3 px-3 text-center font-mono font-extrabold text-red-700 dark:text-red-300 tabular-nums">
                    {ac.cargasParadasAguardando}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
