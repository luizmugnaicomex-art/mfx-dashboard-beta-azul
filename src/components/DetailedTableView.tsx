import React, { useState } from 'react';
import { ImportProcess, AtoConcessorio } from '../types/mfx';

interface DetailedTableViewProps {
  processos: ImportProcess[];
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
  | 'freeTimeDiasRestantes'
  | 'vmldBRL'
  | 'totalImpostosEstimadosBRL'
  | 'savingFreteBRL';

export const DetailedTableView: React.FC<DetailedTableViewProps> = ({
  processos,
  atosConcessorios,
  visibleColumns,
  onSelectProcess,
  onSelectAC,
  onExportExcel,
}) => {
  const [sheetSubView, setSheetSubView] = useState<'PROCESSOS' | 'PEDIDOS' | 'ACS'>('PROCESSOS');
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
      <div className="px-6 py-4 border-b border-gray-200 dark:border-[#374151] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            <i className="fas fa-boxes-stacked mr-1.5"></i>Aba PEDIDOS / Itens NCM (
            {processos.reduce((s, p) => s + p.itens.length, 0)})
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
        </div>

        <div className="flex items-center gap-4 text-xs">
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

      {/* SHEET 1: PROCESSOS */}
      {sheetSubView === 'PROCESSOS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                {visibleColumns.processo && (
                  <th
                    onClick={() => handleSort('id')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    Processo {renderSortIcon('id')}
                  </th>
                )}
                {visibleColumns.oc && (
                  <th
                    onClick={() => handleSort('oc')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    PO / OC {renderSortIcon('oc')}
                  </th>
                )}
                {visibleColumns.fornecedor && (
                  <th
                    onClick={() => handleSort('fornecedor')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    Fornecedor {renderSortIcon('fornecedor')}
                  </th>
                )}
                {visibleColumns.projeto && (
                  <th
                    onClick={() => handleSort('projeto')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    Projeto {renderSortIcon('projeto')}
                  </th>
                )}
                {visibleColumns.status && (
                  <th
                    onClick={() => handleSort('status')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    Status Atual {renderSortIcon('status')}
                  </th>
                )}
                {visibleColumns.modal && (
                  <th
                    onClick={() => handleSort('modal')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    Modal / Incoterm {renderSortIcon('modal')}
                  </th>
                )}
                {visibleColumns.blAwb && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">BL / AWB & DI</th>
                )}
                {visibleColumns.regimeAC && (
                  <th className="py-3 px-3 font-extrabold whitespace-nowrap">Regime / Ato Concessório</th>
                )}
                {visibleColumns.eta && (
                  <th
                    onClick={() => handleSort('eta')}
                    className="sortable-header py-3 px-3 font-extrabold whitespace-nowrap"
                  >
                    ETD ➔ ETA {renderSortIcon('eta')}
                  </th>
                )}
                {visibleColumns.freeTime && (
                  <th
                    onClick={() => handleSort('freeTimeDiasRestantes')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    Free Time {renderSortIcon('freeTimeDiasRestantes')}
                  </th>
                )}
                {visibleColumns.vmld && (
                  <th
                    onClick={() => handleSort('vmldBRL')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    VMLD / CIF (R$) {renderSortIcon('vmldBRL')}
                  </th>
                )}
                {visibleColumns.impostos && (
                  <th
                    onClick={() => handleSort('totalImpostosEstimadosBRL')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    Impostos (R$) {renderSortIcon('totalImpostosEstimadosBRL')}
                  </th>
                )}
                {visibleColumns.saving && (
                  <th
                    onClick={() => handleSort('savingFreteBRL')}
                    className="sortable-header py-3 px-3 font-extrabold text-right whitespace-nowrap"
                  >
                    Saving Frete {renderSortIcon('savingFreteBRL')}
                  </th>
                )}
                <th className="py-3 px-3 font-extrabold text-center whitespace-nowrap">Ações</th>
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
                    {visibleColumns.processo && (
                      <td className="py-2.5 px-3 font-mono font-extrabold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                        {p.id}
                        {p.alertaPreAlertaAWB && (
                          <span
                            title="Aéreo sem Pré-Alerta AWB à Ômega"
                            className="ml-1.5 text-red-600 dark:text-red-300"
                          >
                            <i className="fas fa-bell-slash"></i>
                          </span>
                        )}
                      </td>
                    )}
                    {visibleColumns.oc && (
                      <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">{p.oc}</td>
                    )}
                    {visibleColumns.fornecedor && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">{p.fornecedor}</td>
                    )}
                    {visibleColumns.projeto && (
                      <td className="py-2.5 px-3 font-semibold whitespace-nowrap">{p.projeto}</td>
                    )}
                    {visibleColumns.status && (
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        {p.cargaParadaDrawback ? (
                          <span className="text-red-700 dark:text-red-200 font-extrabold">
                            <i className="fas fa-ban mr-1"></i>Parado Ag. Drawback
                          </span>
                        ) : (
                          <span>{p.status}</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.modal && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <i
                          className={`fas ${
                            p.modal === 'AÉREO' ? 'fa-plane text-sky-600' : 'fa-ship text-blue-600'
                          } mr-1`}
                        ></i>
                        {p.modal} · {p.incoterm}
                      </td>
                    )}
                    {visibleColumns.blAwb && (
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                        <div>{p.blAwb}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-300">
                          DI: {p.numeroDiDuimp} ({p.canal})
                        </div>
                      </td>
                    )}
                    {visibleColumns.regimeAC && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold">{p.regime}</div>
                        <div className="text-[11px] font-mono text-blue-700 dark:text-blue-300">
                          {p.atoConcessorio}
                        </div>
                      </td>
                    )}
                    {visibleColumns.eta && (
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap tabular-nums">
                        <div>ETD: {p.etd}</div>
                        <div className="font-bold">ETA: {p.eta}</div>
                      </td>
                    )}
                    {visibleColumns.freeTime && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        <span className={p.freeTimeDiasRestantes < 3 ? 'text-red-600 font-extrabold' : ''}>
                          {p.freeTimeDiasRestantes}d / {p.freeTimeTotalDias}d
                        </span>
                      </td>
                    )}
                    {visibleColumns.vmld && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap tabular-nums">
                        {fmtBRL(p.vmldBRL)}
                      </td>
                    )}
                    {visibleColumns.impostos && (
                      <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap tabular-nums">
                        <div className="font-bold">{fmtBRL(p.totalImpostosEstimadosBRL)}</div>
                        {p.impostosPagosIndevidamenteBRL > 0 ? (
                          <div className="text-[10px] font-bold text-red-700 dark:text-red-300">
                            Leakage: {fmtBRL(p.impostosPagosIndevidamenteBRL)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            Suspenso Drawback
                          </div>
                        )}
                      </td>
                    )}
                    {visibleColumns.saving && (
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap tabular-nums">
                        + {fmtBRL(p.savingFreteBRL)}
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

      {/* SHEET 2: PEDIDOS (ITENS & NCMS) */}
      {sheetSubView === 'PEDIDOS' && (
        <div className="table-responsive">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="py-3 px-3 font-extrabold">OC / Pedido</th>
                <th className="py-3 px-3 font-extrabold">Processo</th>
                <th className="py-3 px-3 font-extrabold">Cód. Item</th>
                <th className="py-3 px-3 font-extrabold">Descrição do Insumo</th>
                <th className="py-3 px-3 font-extrabold">NCM Fatura</th>
                <th className="py-3 px-3 font-extrabold">NCM no AC</th>
                <th className="py-3 px-3 font-extrabold text-right">Qtd PO</th>
                <th className="py-3 px-3 font-extrabold text-right">Qtd no AC</th>
                <th className="py-3 px-3 font-extrabold text-right">Valor Total</th>
                <th className="py-3 px-3 font-extrabold">Auditoria Laudo Técnico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {processos.flatMap((p) =>
                p.itens.map((it) => {
                  const isHigh =
                    it.alertaLaudoTecnico === 'Qtd Irrisória (0,01 no AC)' ||
                    it.alertaLaudoTecnico === 'Sem Cobertura AC';
                  const isMed = it.alertaLaudoTecnico === 'NCM Divergente entre ACs';
                  return (
                    <tr
                      key={it.id}
                      onClick={() => onSelectProcess(p, 'overview')}
                      className={`${
                        isHigh
                          ? 'row-risk-high'
                          : isMed
                          ? 'row-risk-medium'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                      } cursor-pointer`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold">{it.oc}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {p.id}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{it.codigoItem}</td>
                      <td className="py-2.5 px-3 font-medium">{it.descricao}</td>
                      <td className="py-2.5 px-3 font-mono font-bold tabular-nums">{it.ncm}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums">{it.ncmAtoConcessorio || it.ncm}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        {it.quantidade.toLocaleString('pt-BR')} {it.unidade}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {it.qtdAutorizadaAC !== undefined
                          ? `${it.qtdAutorizadaAC.toLocaleString('pt-BR')} ${it.unidade}`
                          : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                        {it.moeda} {it.valorTotalMoeda.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        {it.alertaLaudoTecnico && it.alertaLaudoTecnico !== 'OK' ? (
                          <span className="text-red-700 dark:text-red-300">
                            <i className="fas fa-triangle-exclamation mr-1"></i>
                            {it.alertaLaudoTecnico}
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            <i className="fas fa-check mr-1"></i>Laudo OK
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SHEET 3: 7 ATOS CONCESSÓRIOS */}
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
