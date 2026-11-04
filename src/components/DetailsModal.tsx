import React, { useState, useEffect } from 'react';
import { ImportProcess, AtoConcessorio } from '../types/mfx';

interface DetailsModalProps {
  selectedProcess: ImportProcess | null;
  selectedAC: AtoConcessorio | null;
  allACs: AtoConcessorio[];
  allProcessos: ImportProcess[];
  initialTab?: 'overview' | 'espelho' | 'drawback';
  onClose: () => void;
  onAssignDrawbackAC: (processId: string, acId: string, ncmItem: string) => void;
  onSendPreAlertaAWB: (processId: string) => void;
  onResolveACAmendment: (acId: string) => void;
  onSelectProcessFromAC: (processo: ImportProcess) => void;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  selectedProcess,
  selectedAC,
  allACs,
  allProcessos,
  initialTab = 'overview',
  onClose,
  onAssignDrawbackAC,
  onSendPreAlertaAWB,
  onResolveACAmendment,
  onSelectProcessFromAC,
}) => {
  const [modalTab, setModalTab] = useState<'overview' | 'espelho' | 'drawback'>(initialTab);
  const [chosenAC, setChosenAC] = useState<string>('');
  const [chosenNCM, setChosenNCM] = useState<string>('');

  useEffect(() => {
    setModalTab(initialTab);
    if (selectedProcess) {
      const defaultAC =
        allACs.find((a) => a.id === selectedProcess.atoConcessorio)?.id ||
        selectedProcess.itens[0]?.acSugerido ||
        allACs[0].id;
      setChosenAC(defaultAC);
      const acObj = allACs.find((a) => a.id === defaultAC);
      const firstNcm =
        acObj?.itensDetalhados[0]?.ncm || selectedProcess.itens[0]?.ncm || '7304.29.39';
      setChosenNCM(firstNcm);
    }
  }, [selectedProcess, selectedAC, initialTab, allACs]);

  if (!selectedProcess && !selectedAC) return null;

  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const fmtCurr = (val: number, curr: string) =>
    `${curr} ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // === CASE A: ATO CONCESSÓRIO MASTER DOSSIER MODAL ===
  if (selectedAC && !selectedProcess) {
    const linkedProcs = allProcessos.filter(
      (p) => p.atoConcessorio === selectedAC.id || selectedAC.processosVinculados.includes(p.id)
    );
    const pctUsed = Math.min(
      100,
      Math.round((selectedAC.utilizadoImportacaoUSD / selectedAC.limiteImportacaoUSD) * 100)
    );

    return (
      <div
        id="details-modal"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-white dark:bg-[#1f2937] w-full max-w-5xl rounded-xl shadow-2xl border border-gray-200 dark:border-[#374151] overflow-hidden my-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <i className="fas fa-shield-halved text-blue-400 text-xl"></i>
                <h2 className="text-lg font-extrabold tracking-tight">
                  DOSSIÊ DO ATO CONCESSÓRIO: {selectedAC.id} (SECEX Nº {selectedAC.numeroAC})
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Modalidade: {selectedAC.modalidade} · Projeto Principal: {selectedAC.projetoVinculado} · Vencimento:{' '}
                {selectedAC.dataVencimento} ({selectedAC.diasRestantes} dias restantes)
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>

          <div className="p-6 max-h-[80vh] overflow-y-auto custom-scrollbar space-y-6">
            {/* Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Status no Siscomex</span>
                <span
                  className={`text-base font-extrabold mt-1 block ${
                    selectedAC.statusAC === 'Ativo'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-orange-600 dark:text-orange-400'
                  }`}
                >
                  {selectedAC.statusAC === 'Ativo' ? 'ATIVO / LIBERADO' : 'EM ALTERAÇÃO (SECEX)'}
                </span>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Limite Importação (USD)</span>
                <span className="text-base font-extrabold font-mono text-gray-800 dark:text-gray-100 mt-1 block tabular-nums">
                  USD {selectedAC.limiteImportacaoUSD.toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Saldo Disponível (USD)</span>
                <span className="text-base font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                  USD {selectedAC.saldoDisponivelUSD.toLocaleString('pt-BR')} ({100 - pctUsed}%)
                </span>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400 block">Itens Cadastrados / Alertas</span>
                <span className="text-base font-extrabold font-mono text-gray-800 dark:text-gray-100 mt-1 block tabular-nums">
                  {selectedAC.totalItensCadastrados} itens ·{' '}
                  <span className={selectedAC.itensComDivergenciaLaudo > 0 ? 'text-red-600' : 'text-emerald-600'}>
                    {selectedAC.itensComDivergenciaLaudo} divergências
                  </span>
                </span>
              </div>
            </div>

            {/* Action Banner if AC is Em Alteração or has Laudo discrepancies */}
            {(selectedAC.statusAC === 'Em Alteração' || selectedAC.itensComDivergenciaLaudo > 0) && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    <i className="fas fa-triangle-exclamation mr-2"></i>
                    Auditoria de Laudo Técnico: {selectedAC.itensComDivergenciaLaudo} item(ns) com quantidade 0,01 ou NCM divergente
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    Você pode homologar a retificação do Laudo Técnico agora para liberar o saldo no Siscomex e destravar as cargas vinculadas.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onResolveACAmendment(selectedAC.id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow transition-colors shrink-0 cursor-pointer"
                >
                  <i className="fas fa-check-double mr-1.5"></i>
                  Homologar Aditivo SECEX & Corrigir Qtd 0,01
                </button>
              </div>
            )}

            {/* Table of NCM Items inside this AC */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
                <i className="fas fa-list-check text-blue-600 mr-2"></i>
                Itens do Ato Concessório & Auditoria de Laudo Técnico (Amostra Crítica de {selectedAC.totalItensCadastrados} itens)
              </h3>
              <div className="table-responsive rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Item AC</th>
                      <th className="py-2.5 px-3">NCM</th>
                      <th className="py-2.5 px-3">Descrição do Insumo no Ato</th>
                      <th className="py-2.5 px-3 text-right">Qtd Autorizada</th>
                      <th className="py-2.5 px-3 text-right">Qtd Utilizada</th>
                      <th className="py-2.5 px-3 text-right">Vlr Autorizado (USD)</th>
                      <th className="py-2.5 px-3">Status Laudo Técnico</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {selectedAC.itensDetalhados.map((item) => {
                      const rowRisk =
                        item.alertaAuditoria === 'Qtd Irrisória (0,01)'
                          ? 'row-risk-high'
                          : item.alertaAuditoria === 'NCM Divergente entre ACs'
                          ? 'row-risk-medium'
                          : '';
                      return (
                        <tr key={item.itemAcNum} className={rowRisk}>
                          <td className="py-2.5 px-3 font-mono font-bold tabular-nums">#{item.itemAcNum}</td>
                          <td className="py-2.5 px-3 font-mono font-semibold tabular-nums">{item.ncm}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">{item.descricaoInsumo}</div>
                            {item.observacaoLaudo && (
                              <div className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                                {item.observacaoLaudo}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                            {item.qtdAutorizada.toLocaleString('pt-BR')} {item.unidade}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {item.qtdUtilizada.toLocaleString('pt-BR')} {item.unidade}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            USD {item.valorAutorizadoUSD.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {item.alertaAuditoria === 'OK' ? (
                              <span className="text-emerald-700 dark:text-emerald-400">
                                <i className="fas fa-circle-check mr-1"></i>Laudo OK
                              </span>
                            ) : (
                              <span className="text-red-700 dark:text-red-300 font-bold">
                                <i className="fas fa-circle-exclamation mr-1"></i>
                                {item.alertaAuditoria}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Linked Import Processes (IMP-XXX/26) */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-3">
                <i className="fas fa-ship text-teal-600 mr-2"></i>
                Processos de Importação Vinculados a este AC ({linkedProcs.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {linkedProcs.map((proc) => (
                  <div
                    key={proc.id}
                    onClick={() => onSelectProcessFromAC(proc)}
                    className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 bg-gray-50 dark:bg-[#111827] flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                          {proc.id}
                        </span>
                        <span className="text-xs text-gray-500">· {proc.oc}</span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          · {proc.fornecedor}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        Status: <strong className="text-gray-900 dark:text-white">{proc.status}</strong> · DI/BL:{' '}
                        {proc.blAwb}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-xs text-gray-800 dark:text-gray-100 tabular-nums">
                        {fmtBRL(proc.vmldBRL)}
                      </div>
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                        Abrir Processo <i className="fas fa-arrow-right ml-1"></i>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="px-6 py-3 bg-gray-100 dark:bg-[#111827] border-t border-gray-200 dark:border-[#374151] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              Fechar Dossiê AC
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === CASE B: IMPORT PROCESS / PO DETAILS MODAL ===
  if (!selectedProcess) return null;

  const p = selectedProcess;
  const currentACObj = allACs.find((a) => a.id === chosenAC) || allACs[0];

  const steps = [
    {
      label: '1. Pedido (OC)',
      sub: p.oc,
      date: p.dataPO,
      done: true,
    },
    {
      label: '2. Embarque (BL/AWB)',
      sub: p.blAwb,
      date: p.etd,
      done: p.status !== 'Em Produção Fornecedor' && p.status !== 'Ag. Embarque',
    },
    {
      label: '3. Chegada Brasil',
      sub: p.portoAeroportoDestino.split('(')[0],
      date: p.dataChegadaEfetiva || p.eta,
      done:
        p.status === 'No Porto/Aeroporto' ||
        p.status === 'Parado Ag. Drawback' ||
        p.status === 'Desembaraçado' ||
        p.status === 'Entregue MFX',
    },
    {
      label: '4. Registro DI/DUIMP',
      sub: p.numeroDiDuimp,
      date: p.dataRegistroDI || (p.cargaParadaDrawback ? 'Bloqueado AC' : 'Ag. Chegada'),
      done: p.status === 'Desembaraçado' || p.status === 'Entregue MFX' || Boolean(p.dataRegistroDI),
      blocked: p.cargaParadaDrawback,
    },
    {
      label: '5. Desembaraço',
      sub: `Canal ${p.canal}`,
      date: p.dataDesembaraco || 'Pendente',
      done: p.status === 'Desembaraçado' || p.status === 'Entregue MFX',
    },
    {
      label: '6. Entrega MFX',
      sub: p.transportadoraNacional,
      date: p.dataEntregaMFX || `Prev: ${p.prazoEntregaMFX}`,
      done: p.status === 'Entregue MFX',
    },
  ];

  const landedCostTotal =
    p.vmldBRL +
    (p.regime === 'Drawback Suspensão' ? 0 : p.totalImpostosEstimadosBRL) +
    p.despesasAduaneirasBRL +
    p.armazenagemAcumuladaBRL +
    p.freteRodoviarioBRL;

  return (
    <div
      id="details-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1f2937] w-full max-w-5xl rounded-xl shadow-2xl border border-gray-200 dark:border-[#374151] overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-lg font-extrabold font-mono text-blue-400">{p.id}</span>
              <span className="text-sm font-semibold text-slate-300">· PO: {p.oc}</span>
              <span className="text-sm font-bold text-white">
                · {p.fornecedor} ({p.paisOrigem})
              </span>
              {p.compradorResponsavel && (
                <span className="text-xs font-mono text-emerald-300">
                  · Comprador: {p.compradorResponsavel}
                </span>
              )}
              <span className="text-xs font-mono text-amber-300">· Projeto: {p.projeto}</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Invoice: {p.commercialInvoice} · Modal: {p.modal} ({p.incoterm}) · BL/AWB: {p.blAwb} ·
              Agente: {p.agenteCarga} / Despachante: {p.despachante}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {p.alertaPreAlertaAWB && (
              <button
                type="button"
                onClick={() => onSendPreAlertaAWB(p.id)}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow cursor-pointer"
              >
                <i className="fas fa-paper-plane mr-1.5"></i>Enviar Pré-Alerta AWB à Ômega
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-lg transition-colors cursor-pointer"
            >
              <i className="fas fa-times text-lg"></i>
            </button>
          </div>
        </div>

        {/* Modal Sub-Navigation Tabs */}
        <div className="px-6 border-b border-gray-200 dark:border-[#374151] bg-gray-50 dark:bg-[#111827] flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setModalTab('overview')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              modalTab === 'overview'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <i className="fas fa-route mr-1.5"></i>1. Timeline, Itens (PEDIDOS) & Operacional
          </button>
          <button
            type="button"
            onClick={() => setModalTab('espelho')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              modalTab === 'espelho'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <i className="fas fa-file-invoice-dollar mr-1.5"></i>2. Espelho de Custos / NF-e & Impostos
          </button>
          <button
            type="button"
            onClick={() => setModalTab('drawback')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
              modalTab === 'drawback'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <i className="fas fa-shield-halved mr-1.5"></i>3. Vincular Ato Concessório (Drawback 7 ACs)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto custom-scrollbar space-y-6">
          {/* 1. COMPLETE PROCESS TIMELINE (Always visible at top of modal) */}
          <div className="bg-gray-50 dark:bg-[#111827] p-4 rounded-xl border border-gray-200 dark:border-[#374151]">
            <h3 className="text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 mb-3">
              Rastreamento End-to-End do Processo ({p.status})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {steps.map((st, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    st.blocked
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-400 dark:border-red-700'
                      : st.done
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700'
                      : 'bg-white dark:bg-[#1f2937] border-gray-200 dark:border-gray-700 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-extrabold text-gray-800 dark:text-gray-100">
                      {st.label}
                    </span>
                    {st.blocked ? (
                      <i className="fas fa-lock text-red-600 text-xs"></i>
                    ) : st.done ? (
                      <i className="fas fa-circle-check text-emerald-600 text-xs"></i>
                    ) : (
                      <i className="far fa-clock text-gray-400 text-xs"></i>
                    )}
                  </div>
                  <div className="text-xs font-mono font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {st.sub}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                    {st.date}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {modalTab === 'overview' && (
            <>
              {/* Alert callout if high/medium risk */}
              {p.riskLevel !== 'none' && (
                <div
                  className={`p-4 rounded-lg border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    p.riskLevel === 'high'
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
                      : p.riskLevel === 'medium'
                      ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-200'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  <div>
                    <div className="text-xs font-extrabold uppercase">Diagnóstico Operacional MFX</div>
                    <div className="text-sm font-semibold mt-0.5">{p.riskReason}</div>
                    {p.motivoParadaDrawback && (
                      <div className="text-xs mt-1 opacity-90">Detalhe Drawback: {p.motivoParadaDrawback}</div>
                    )}
                  </div>
                  {p.cargaParadaDrawback && (
                    <button
                      type="button"
                      onClick={() => setModalTab('drawback')}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-md shadow shrink-0 cursor-pointer"
                    >
                      <i className="fas fa-link mr-1.5"></i>Alocar AC & Liberar Registro DI
                    </button>
                  )}
                </div>
              )}

              {/* Key Operational & Logistics Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Regime & Ato Concessório</span>
                  <span className="text-xs font-extrabold text-gray-900 dark:text-white mt-1 block">
                    {p.regime}
                  </span>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {p.atoConcessorio}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Lead Time & Free Time</span>
                  <span className="text-xs font-extrabold text-gray-900 dark:text-white mt-1 block tabular-nums">
                    Transit: {p.transitTimeDias}d · Desemb: {p.tempoDesembaracoDias}d
                  </span>
                  <span
                    className={`text-xs font-mono font-bold tabular-nums ${
                      p.freeTimeDiasRestantes < 3 ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    Free Time Restante: {p.freeTimeDiasRestantes} / {p.freeTimeTotalDias} dias
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Peso / Cubagem / FCL</span>
                  <span className="text-xs font-extrabold font-mono text-gray-900 dark:text-white mt-1 block tabular-nums">
                    {p.pesoBrutoKg.toLocaleString('pt-BR')} kg · {p.cubagemCbm} m³
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                    {p.modal === 'MARÍTIMO' ? `${p.qtdContainersFCL} x 40'HC (FCL)` : 'Carga Aérea TECA'}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827]">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 block">Saving de Frete Obtido</span>
                  <span className="text-xs font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block tabular-nums">
                    + {fmtBRL(p.savingFreteBRL)} (-{p.savingFretePercent.toFixed(1)}%)
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono tabular-nums">
                    Cotado: {fmtBRL(p.cotacaoFreteBRL)} ➔ Pago: {fmtBRL(p.fretePagoBRL)}
                  </span>
                </div>
              </div>

              {/* Items Table from MFX Master Sheet / PEDIDOS */}
              <div>
                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2.5 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    <i className="fas fa-boxes-stacked text-blue-600 mr-2"></i>
                    Itens / Materiais do Processo ({p.id} — {p.itens.length} linha(s) · PO: {p.oc})
                  </span>
                  <span className="text-xs font-mono text-gray-500">
                    Moeda: {p.moeda} (PTAX R$ {p.taxaPtaxDI.toFixed(4)})
                  </span>
                </h4>
                <div className="table-responsive rounded-lg border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">PO</th>
                        <th className="py-2.5 px-3">Invoice</th>
                        <th className="py-2.5 px-3">Cód. Material</th>
                        <th className="py-2.5 px-3">Descrição do Material</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                        <th className="py-2.5 px-3">Unid.</th>
                        <th className="py-2.5 px-3 text-right">Vlr Unit. ({p.moeda})</th>
                        <th className="py-2.5 px-3 text-right">Vlr Total ({p.moeda})</th>
                        <th className="py-2.5 px-3">Auditoria Laudo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {p.itens.map((it) => {
                        const isHigh =
                          it.alertaLaudoTecnico === 'Qtd Irrisória (0,01 no AC)' ||
                          it.alertaLaudoTecnico === 'Sem Cobertura AC';
                        const isMed = it.alertaLaudoTecnico === 'NCM Divergente entre ACs';
                        return (
                          <tr
                            key={it.id}
                            className={isHigh ? 'row-risk-high' : isMed ? 'row-risk-medium' : ''}
                          >
                            <td className="py-2.5 px-3 font-mono font-semibold">
                              {it.oc || p.oc}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {it.invoice || p.commercialInvoice}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                              {it.codigoItem}
                            </td>
                            <td className="py-2.5 px-3 font-medium">{it.descricao}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                              {it.quantidade.toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold">{it.unidade}</td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {fmtCurr(it.valorUnitarioMoeda, it.moeda)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                              {fmtCurr(it.valorTotalMoeda, it.moeda)}
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              {it.alertaLaudoTecnico && it.alertaLaudoTecnico !== 'OK' ? (
                                <span className="text-red-700 dark:text-red-300 font-bold">
                                  <i className="fas fa-triangle-exclamation mr-1"></i>
                                  {it.alertaLaudoTecnico}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  <i className="fas fa-check mr-1"></i>Regular
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* 2. ESPELHO DE CUSTOS / NF-E & BREAKDOWN TRIBUTÁRIO */}
          {modalTab === 'espelho' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="text-sm font-extrabold text-gray-900 dark:text-white">
                    ESPELHO DE CUSTOS DE IMPORTAÇÃO & PRÉVIA DA NF-E DE ENTRADA — {p.id}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Câmbio PTAX/DI Aplicado: 1 {p.moeda} = R$ {p.taxaPtaxDI.toFixed(4)} · Condição de Pagamento:{' '}
                    {p.condicaoPagamento} (Venc. {p.dataVencimentoInvoice})
                  </p>
                </div>
                <span
                  className={`text-xs font-extrabold px-3 py-1 rounded border ${
                    p.regime === 'Drawback Suspensão'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/40 border-red-400 text-red-700 dark:text-red-300'
                  }`}
                >
                  Regime: {p.regime} ({p.atoConcessorio})
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Base Aduaneira VMLD */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827] space-y-2.5">
                  <h5 className="text-xs font-extrabold uppercase text-blue-600 dark:text-blue-400 mb-2">
                    A. Composição do Valor Aduaneiro (VMLE / VMLD)
                  </h5>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Valor FOB / Mercadoria ({p.moeda}):</span>
                    <span className="font-mono font-bold tabular-nums">{fmtCurr(p.valorFOBMoeda, p.moeda)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">VMLE Convertido (R$):</span>
                    <span className="font-mono font-semibold tabular-nums">{fmtBRL(p.vmleBRL)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Frete Internacional ({p.agenteCarga}):</span>
                    <span className="font-mono font-semibold tabular-nums">
                      {fmtCurr(p.freteInternacionalMoeda, p.moeda)} ({fmtBRL(p.fretePagoBRL)})
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Seguro Internacional:</span>
                    <span className="font-mono tabular-nums">{fmtCurr(p.seguroMoeda, p.moeda)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-extrabold">
                    <span>Valor Aduaneiro (VMLD / CIF R$):</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                      {fmtBRL(p.vmldBRL)}
                    </span>
                  </div>
                </div>

                {/* Tributos Federais e Estaduais */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827] space-y-2.5">
                  <h5 className="text-xs font-extrabold uppercase text-amber-600 dark:text-amber-400 mb-2">
                    B. Apuração de Impostos na DI/DUIMP ({p.regime})
                  </h5>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Imposto de Importação (II - 14%):</span>
                    <span className="font-mono tabular-nums">{fmtBRL(p.iiBRL)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">IPI Vinculado:</span>
                    <span className="font-mono tabular-nums">{fmtBRL(p.ipiBRL)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">PIS Importação (2,10%):</span>
                    <span className="font-mono tabular-nums">{fmtBRL(p.pisBRL)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">COFINS Importação (9,65%):</span>
                    <span className="font-mono tabular-nums">{fmtBRL(p.cofinsBRL)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">ICMS Bahia (Alíquota / Diferimento):</span>
                    <span className="font-mono tabular-nums">{fmtBRL(p.icmsBRL)}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm font-extrabold">
                    <span>
                      {p.regime === 'Drawback Suspensão'
                        ? 'Total Impostos Suspensos (Economia):'
                        : 'Total Impostos Recolhidos:'}
                    </span>
                    <span
                      className={`font-mono tabular-nums ${
                        p.regime === 'Drawback Suspensão' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {fmtBRL(p.totalImpostosEstimadosBRL)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Despesas Logísticas Nacionais & Landed Cost */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#111827] grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[11px] text-gray-500 block">Despesas Aduaneiras / SDA</span>
                  <span className="text-sm font-bold font-mono tabular-nums">
                    {fmtBRL(p.despesasAduaneirasBRL)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 block">Armazenagem TECON/TECA</span>
                  <span
                    className={`text-sm font-bold font-mono tabular-nums ${
                      p.armazenagemAcumuladaBRL > 15000 ? 'text-red-600' : ''
                    }`}
                  >
                    {fmtBRL(p.armazenagemAcumuladaBRL)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 block">
                    Frete Rodoviário ({p.transportadoraNacional})
                  </span>
                  <span className="text-sm font-bold font-mono tabular-nums">
                    {fmtBRL(p.freteRodoviarioBRL)}
                  </span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
                  <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 block">
                    Custo Total Landed MFX
                  </span>
                  <span className="text-base font-extrabold font-mono text-blue-700 dark:text-blue-300 tabular-nums">
                    {fmtBRL(landedCostTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 3. DRAWBACK AC LINKAGE SELECTOR */}
          {modalTab === 'drawback' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-extrabold text-blue-900 dark:text-blue-200">
                  <i className="fas fa-shield-halved mr-2"></i>
                  Alocação / Vinculação de Ato Concessório de Drawback para {p.id}
                </h4>
                <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                  Selecione qual dos 7 Atos Concessórios da MFX e qual item NCM cobre esta importação. Ao confirmar, o processo é atualizado para <strong>Drawback Suspensão</strong>, suspende <strong>{fmtBRL(p.totalImpostosEstimadosBRL)}</strong> em tributos e libera o registro da DI com a Ômega.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    1. Selecionar Ato Concessório (7 ACs MFX)
                  </label>
                  <select
                    value={chosenAC}
                    onChange={(e) => {
                      const nextAc = e.target.value;
                      setChosenAC(nextAc);
                      const found = allACs.find((a) => a.id === nextAc);
                      if (found && found.itensDetalhados[0]) {
                        setChosenNCM(found.itensDetalhados[0].ncm);
                      }
                    }}
                    className="w-full px-3 py-2.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111827] text-gray-900 dark:text-white"
                  >
                    {allACs.map((ac) => (
                      <option key={ac.id} value={ac.id}>
                        {ac.id} — Projeto {ac.projetoVinculado} ({ac.statusAC}) — Saldo: USD{' '}
                        {ac.saldoDisponivelUSD.toLocaleString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                    2. Selecionar Item / NCM do Ato Concessório
                  </label>
                  <select
                    value={chosenNCM}
                    onChange={(e) => setChosenNCM(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#111827] text-gray-900 dark:text-white"
                  >
                    {currentACObj.itensDetalhados.map((it) => (
                      <option key={it.itemAcNum} value={it.ncm}>
                        Item #{it.itemAcNum} · NCM {it.ncm} — {it.descricaoInsumo.slice(0, 48)}... (Qtd Aut:{' '}
                        {it.qtdAutorizada} {it.unidade})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selected AC Preview */}
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#111827] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-gray-500">AC Selecionado:</span>{' '}
                    <strong className="font-mono text-gray-900 dark:text-white">{currentACObj.id}</strong> (
                    {currentACObj.statusAC})
                  </div>
                  <div>
                    <span className="text-gray-500">Saldo Disponível no AC:</span>{' '}
                    <strong className="font-mono text-emerald-600">
                      USD {currentACObj.saldoDisponivelUSD.toLocaleString('pt-BR')}
                    </strong>{' '}
                    vs. Valor desta Importação:{' '}
                    <strong className="font-mono">
                      {p.moeda} {p.valorFOBMoeda.toLocaleString('pt-BR')}
                    </strong>
                  </div>
                  <div>
                    <span className="text-gray-500">Economia Tributária Imediata:</span>{' '}
                    <strong className="font-mono text-emerald-600">{fmtBRL(p.totalImpostosEstimadosBRL)}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAssignDrawbackAC(p.id, chosenAC, chosenNCM)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-lg shadow transition-colors cursor-pointer shrink-0"
                >
                  <i className="fas fa-check-circle mr-1.5"></i>
                  Confirmar Vínculo AC & Liberar Processo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-gray-100 dark:bg-[#111827] border-t border-gray-200 dark:border-[#374151] flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Despachante Aduaneiro: <strong>{p.despachante}</strong> · Porto/Aeroporto: {p.portoAeroportoDestino}
          </span>
          <div className="flex items-center gap-2">
            {modalTab !== 'espelho' && (
              <button
                type="button"
                onClick={() => setModalTab('espelho')}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md cursor-pointer"
              >
                <i className="fas fa-file-invoice-dollar mr-1.5"></i>Ver Espelho de Custos / NF
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white text-xs font-semibold rounded-md cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
