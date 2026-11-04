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
  const [sheetSubView, setSheetSubView] = useState<
    'FLAT_ITENS' | 'PROCESSOS' | 'PEDIDOS' | 'ACS'
  >('FLAT_ITENS');
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

  // Derive flat item rows from filtered processos so filters apply to the flat item table too
  const flatItemRows = sortedProcessos.flatMap((p) =>
    p.itens.map((it) => ({
      proc: p,
      item: it,
    }))
  );

  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  const fmtSymbol = (moeda: string) =>
    moeda === 'EUR' ? '€ ' : moeda === 'BRL' ? 'R$ ' : '$ ';

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
            onClick={() => setSheetSubView('FLAT_ITENS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              sheetSubView === 'FLAT_ITENS'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-table-list mr-1.5"></i>Planilha Geral MFX — Itens ({flatItemRows.length})
          </button>
          <button
            type="button"
            onClick={() => setSheetSubView('PROCESSOS')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
              sheetSubView === 'PROCESSOS'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            <i className="fas fa-ship mr-1.5"></i>Processos Consolidados ({processos.length})
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
            <i className="fas fa-boxes-stacked mr-1.5"></i>Forecast de POs / Pedidos ({pedidosForecast.length})
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
            <i className="fas fa-shield-halved mr-1.5"></i>7 Atos Concessórios ({atosConcessorios.length})
          </button>

          {sheetSubView === 'PROCESSOS' && (
            <button
              type="button"
              onClick={() => setShowAll36Cols(!showAll36Cols)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
            >
              <i className="fas fa-arrows-left-right mr-1.5 text-teal-600"></i>
              {showAll36Cols ? 'Modo Completo (36 Colunas)' : 'Modo Resumido'}
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
          SHEET 0: PLANILHA GERAL MFX (EXACT ITEM-LEVEL FLAT TABLE COL A - U)
         =================================================================== */}
      {sheetSubView === 'FLAT_ITENS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">STATUS</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">REF. MFX</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">COMPRADOR RESPONSAVEL</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">PO</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">FORNECEDOR</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">ORIGEM</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">INVOICE</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">COD. MATERIAL</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">DESCRIÇÃO</th>
                <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">QTD</th>
                <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">
                  VALOR UNITÁRIO
                </th>
                <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">
                  VALOR TOTAL
                </th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">UNIDADE DE MEDIDA</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">AGENTE DE CARGAS</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">BL / AWB</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">INCOTERMS</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">MODAL</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">
                  DATA PRONTIDÃO CARGA
                </th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">ETD</th>
                <th className="py-3 px-3 font-extrabold whitespace-nowrap">ETA</th>
                <th className="py-3 px-3 font-extrabold text-right whitespace-nowrap">TT (DIAS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {flatItemRows.map(({ proc, item }, idx) => {
                const rowClass =
                  proc.riskLevel === 'high'
                    ? 'row-risk-high'
                    : proc.riskLevel === 'medium'
                    ? 'row-risk-medium'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/60';
                const sym = fmtSymbol(item.moeda || proc.moeda);
                return (
                  <tr
                    key={`${proc.id}-${item.id}-${idx}`}
                    onClick={() => onSelectProcess(proc, 'overview')}
                    className={`${rowClass} cursor-pointer transition-colors`}
                  >
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                      {item.statusItem || proc.statusRawExcel || proc.status}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-extrabold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                      {proc.id}
                    </td>
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                      {item.compradorResponsavel || proc.compradorResponsavel || 'EUDE'}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                      {item.oc || proc.oc}
                    </td>
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                      {item.fornecedor || proc.fornecedor}
                    </td>
                    <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {item.origem || proc.paisOrigem}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                      {item.invoice || proc.commercialInvoice}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                      {item.codigoItem}
                    </td>
                    <td className="py-2.5 px-3 font-medium whitespace-nowrap">{item.descricao}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                      {item.quantidade.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                      {sym}
                      {item.valorUnitarioMoeda.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                      {sym}
                      {item.valorTotalMoeda.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                      {item.unidade}
                    </td>
                    <td className="py-2.5 px-3 font-bold whitespace-nowrap">{proc.agenteCarga}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                      {proc.blAwb}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap">{proc.incoterm}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <i
                        className={`fas ${
                          proc.modal === 'AÉREO' ? 'fa-plane text-sky-600' : 'fa-ship text-blue-600'
                        } mr-1`}
                      ></i>
                      {proc.modal}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                      {item.previsaoProntidaoCarga || proc.dataProntidaoCarga}
                    </td>
                    <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                      {item.etd || proc.etd}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap tabular-nums">
                      {item.eta || proc.eta}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                      {proc.transitTimeDias}d
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================================================================
          SHEET 1: ABA PROCESSOS CONSOLIDADOS (36 COLUMNS)
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
                    PROJETO / COMP. {renderSortIcon('projeto')}
                  </th>
                )}
                {visibleColumns.processo && (
                  <th
                    onClick={() => handleSort('id')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    REF. MFX / PROCESSO {renderSortIcon('id')}
                  </th>
                )}
                {visibleColumns.fornecedor && (
                  <th
                    onClick={() => handleSort('fornecedor')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    FORNECEDOR (ORIGEM) {renderSortIcon('fornecedor')}
                  </th>
                )}
                {showAll36Cols && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">INVOICE / FATURA</th>
                )}
                {showAll36Cols && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">DATA DE VENCIMENTO</th>
                )}
                {visibleColumns.oc && (
                  <th
                    onClick={() => handleSort('oc')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    PO / OC {renderSortIcon('oc')}
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
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">AGENTE DE CARGAS</th>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">BL / AWB</th>
                  </>
                )}
                {visibleColumns.eta && (
                  <>
                    <th className="py-3 px-3 font-extrabold whitespace-nowrap">ETD / EMBARQUE</th>
                    <th
                      onClick={() => handleSort('eta')}
                      className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                    >
                      ETA / CHEGADA {renderSortIcon('eta')}
                    </th>
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
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-bold">{p.projeto}</div>
                        {p.compradorResponsavel && (
                          <div className="text-[11px] font-mono text-gray-500">
                            Comp: {p.compradorResponsavel}
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.processo && (
                      <td className="py-2.5 px-3 font-mono font-extrabold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {p.id}
                      </td>
                    )}
                    {visibleColumns.fornecedor && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold">{p.fornecedor}</span>{' '}
                        <span className="text-[11px] text-gray-500">({p.paisOrigem})</span>
                      </td>
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
                          {p.valorFOBMoeda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                          {(p.valorVMLDMoeda ?? p.valorFOBMoeda).toLocaleString('pt-BR', {
                            minimumFractionDigits: 2,
                          })}
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
                      <>
                        <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.agenteCarga}</td>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                          {p.blAwb}
                        </td>
                      </>
                    )}
                    {visibleColumns.eta && (
                      <>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                          {p.etd}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap tabular-nums">
                          {p.eta}
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
          SHEET 2: ABA PEDIDOS / POs CONSOLIDADOS
         =================================================================== */}
      {sheetSubView === 'PEDIDOS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 font-extrabold">PO / OC</th>
                <th className="py-3 px-3 font-extrabold">REF. MFX</th>
                <th className="py-3 px-3 font-extrabold">COMPRADOR</th>
                <th className="py-3 px-3 font-extrabold">FORNECEDOR</th>
                <th className="py-3 px-3 font-extrabold">COD. MATERIAL</th>
                <th className="py-3 px-3 font-extrabold">DESCRIÇÃO</th>
                <th className="py-3 px-3 font-extrabold text-right">QTD</th>
                <th className="py-3 px-3 font-extrabold">INCOTERM</th>
                <th className="py-3 px-3 font-extrabold text-right">VALOR TOTAL</th>
                <th className="py-3 px-3 font-extrabold">MOEDA</th>
                <th className="py-3 px-3 font-extrabold">PRONTIDÃO CARGA</th>
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
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 dark:text-indigo-300">
                      {pf.oc}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {pf.processo}
                    </td>
                    <td className="py-2.5 px-3 font-semibold">
                      {pf.compradorResponsavel || 'EUDE'}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{pf.fornecedor}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {pf.codMaterial || `OC-${pf.oc}`}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {pf.descricao || `Pedido ${pf.oc} — ${pf.fornecedor}`}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                      {(pf.qtd || 1).toLocaleString('pt-BR')} {pf.unidadeMedida || ''}
                    </td>
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
