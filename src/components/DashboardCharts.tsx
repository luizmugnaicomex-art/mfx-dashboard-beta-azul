import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ImportProcess, AtoConcessorio } from '../types/mfx';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface DashboardChartsProps {
  activeTab: number;
  processos: ImportProcess[];
  atosConcessorios: AtoConcessorio[];
  darkMode: boolean;
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  activeTab,
  processos,
  atosConcessorios,
  darkMode,
}) => {
  if (activeTab === 6) return null;

  const textColor = darkMode ? '#e5e7eb' : '#374151';
  const gridColor = darkMode ? 'rgba(75, 85, 99, 0.35)' : 'rgba(209, 213, 219, 0.6)';

  const commonOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: { family: "'Inter', sans-serif", size: 11, weight: '600' },
          boxWidth: 12,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: darkMode ? '#111827' : '#1e293b',
        titleFont: { family: "'Inter', sans-serif", size: 12, weight: '700' },
        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
        padding: 10,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { family: "'Inter', sans-serif", size: 10 } },
        grid: { color: gridColor },
      },
      y: {
        ticks: { color: textColor, font: { family: "'JetBrains Mono', monospace", size: 10 } },
        grid: { color: gridColor },
      },
    },
  };

  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: textColor,
          font: { family: "'Inter', sans-serif", size: 11, weight: '600' },
          boxWidth: 12,
          padding: 10,
        },
      },
    },
  };

  // === TAB 1 CHARTS: Forecast de POs & Entregas ===
  if (activeTab === 1) {
    const emProducao = processos.filter((p) => p.status === 'Em Produção Fornecedor').length;
    const cargaPronta = processos.filter((p) => p.status === 'Ag. Embarque').length;
    const embarcado = processos.filter((p) => p.status === 'Em Trânsito').length;
    const emDesembaraco = processos.filter(
      (p) =>
        p.status === 'No Porto/Aeroporto' ||
        p.status === 'Parado Ag. Drawback' ||
        p.status === 'Desembaraçado'
    ).length;
    const entregue = processos.filter((p) => p.status === 'Entregue MFX').length;

    const chart1Data = {
      labels: [
        '1. Em Produção',
        '2. Carga Pronta',
        '3. Embarcado (BL/AWB)',
        '4. Porto / Desembaraço',
        '5. Entregue MFX',
      ],
      datasets: [
        {
          label: 'Qtd Processos / POs',
          data: [emProducao, cargaPronta, embarcado, emDesembaraco, entregue],
          backgroundColor: ['#6366f1', '#3b82f6', '#0ea5e9', '#f97316', '#22c55e'],
          borderRadius: 6,
        },
      ],
    };

    const projetosList = ['PETROBRAS', 'PRIO', 'EXPANSÃO 140 CNTR', 'ESTOQUE'] as const;
    const chart2Data = {
      labels: ['PETROBRAS', 'PRIO', 'EXPANSÃO 140 CNTR', 'ESTOQUE'],
      datasets: [
        {
          label: 'Valor VMLD (R$ Milhões)',
          data: projetosList.map((proj) =>
            Number(
              (
                processos
                  .filter((p) => p.projeto === proj)
                  .reduce((acc, p) => acc + p.vmldBRL, 0) / 1_000_000
              ).toFixed(2)
            )
          ),
          backgroundColor: ['#2563eb', '#0d9488', '#7c3aed', '#64748b'],
          borderWidth: 1,
        },
      ],
    };

    const activeArrivals = processos
      .filter((p) => p.status !== 'Entregue MFX')
      .slice(0, 8);
    const chart3Data = {
      labels: activeArrivals.map((p) => `${p.id} (${p.modal === 'AÉREO' ? 'AIR' : 'SEA'})`),
      datasets: [
        {
          label: 'Transit Time (Dias)',
          data: activeArrivals.map((p) => p.transitTimeDias),
          backgroundColor: activeArrivals.map((p) =>
            p.alertaPreAlertaAWB ? '#ef4444' : p.cargaParadaDrawback ? '#f97316' : '#3b82f6'
          ),
          borderRadius: 4,
        },
        {
          label: 'Atraso vs. PO (Dias)',
          data: activeArrivals.map((p) => p.atrasoEtaDias),
          backgroundColor: '#ef4444',
          borderRadius: 4,
        },
      ],
    };

    return (
      <div id="charts-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-filter text-blue-600 mr-2"></i>Funil de Pedidos (POs) & Embarques
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
              {processos.length} POs
            </span>
          </div>
          <div className="h-60">
            <Bar data={chart1Data} options={commonOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-diagram-project text-teal-600 mr-2"></i>POs por Projeto (VMLD R$ Mi)
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
              PETROBRAS · PRIO · 140 CNTR
            </span>
          </div>
          <div className="h-60">
            <Doughnut data={chart2Data} options={pieOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-plane-arrival text-red-500 mr-2"></i>Prazos Chegada & Alertas AWB
            </h3>
            <span className="text-xs font-mono text-red-600 dark:text-red-400 font-semibold tabular-nums">
              {processos.filter((p) => p.alertaPreAlertaAWB).length} AWB s/ Pré-Alerta
            </span>
          </div>
          <div className="h-60">
            <Bar data={chart3Data} options={commonOptions} />
          </div>
        </div>
      </div>
    );
  }

  // === TAB 2 CHARTS: Análise de KPIs & Lead Times ===
  if (activeTab === 2) {
    const maritimos = processos.filter((p) => p.modal === 'MARÍTIMO');
    const aereos = processos.filter((p) => p.modal === 'AÉREO');

    const avg = (arr: ImportProcess[], fn: (p: ImportProcess) => number) =>
      arr.length ? Number((arr.reduce((s, x) => s + fn(x), 0) / arr.length).toFixed(1)) : 0;

    const chart1Data = {
      labels: ['Modal Marítimo (FCL)', 'Modal Aéreo (TECA SSA)'],
      datasets: [
        {
          label: 'Transit Time (ETA - ETD)',
          data: [avg(maritimos, (p) => p.transitTimeDias), avg(aereos, (p) => p.transitTimeDias)],
          backgroundColor: '#3b82f6',
          borderRadius: 4,
        },
        {
          label: 'Desembaraço / Retenção (Dias)',
          data: [avg(maritimos, (p) => p.tempoDesembaracoDias), avg(aereos, (p) => p.tempoDesembaracoDias)],
          backgroundColor: '#f97316',
          borderRadius: 4,
        },
        {
          label: 'Entrega Rodoviária MFX',
          data: [
            avg(maritimos, (p) => p.tempoEntregaRodoviariaDias),
            avg(aereos, (p) => p.tempoEntregaRodoviariaDias),
          ],
          backgroundColor: '#22c55e',
          borderRadius: 4,
        },
      ],
    };

    const verde = processos.filter((p) => p.canal === 'Verde').length;
    const amarelo = processos.filter((p) => p.canal === 'Amarelo').length;
    const vermelho = processos.filter((p) => p.canal === 'Vermelho').length;
    const liAnuente = processos.filter((p) => p.liAnuente && p.liAnuente !== 'Isento').length;
    const pendenteReg = processos.filter((p) => p.canal === 'Pendente Registro').length;

    const chart2Data = {
      labels: [
        'Canal Verde',
        'Canal Amarelo',
        'Canal Vermelho',
        'LI Anuente (ANP/INMETRO)',
        'Ag. Registro DI (Drawback/Trânsito)',
      ],
      datasets: [
        {
          data: [verde, amarelo, vermelho, liAnuente, pendenteReg],
          backgroundColor: ['#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#64748b'],
          borderWidth: 1,
        },
      ],
    };

    const agentes = ['DSV', 'DHL', 'KN', 'FEDEX', 'Hellmann'] as const;
    const chart3Data = {
      labels: agentes.map((a) => `${a} / ÔMEGA`),
      datasets: [
        {
          label: 'Lead Time Total Médio (Dias)',
          data: agentes.map((ag) => {
            const list = processos.filter((p) => p.agenteCarga === ag);
            return avg(list, (p) => p.transitTimeDias + p.tempoDesembaracoDias + p.tempoEntregaRodoviariaDias);
          }),
          backgroundColor: '#0ea5e9',
          borderRadius: 5,
        },
        {
          label: 'Free Time Médio Restante (Dias)',
          data: agentes.map((ag) => {
            const list = processos.filter((p) => p.agenteCarga === ag);
            return avg(list, (p) => p.freeTimeDiasRestantes);
          }),
          backgroundColor: '#10b981',
          borderRadius: 5,
        },
      ],
    };

    return (
      <div id="charts-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-stopwatch text-blue-600 mr-2"></i>Breakdown de Lead Time Médio (Dias)
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Marítimo vs. Aéreo</span>
          </div>
          <div className="h-60">
            <Bar data={chart1Data} options={commonOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-traffic-light text-amber-500 mr-2"></i>Distribuição de Canais DI/DUIMP
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Receita Federal</span>
          </div>
          <div className="h-60">
            <Doughnut data={chart2Data} options={pieOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-award text-emerald-600 mr-2"></i>Performance Agente / Despachante (Ômega)
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">SLA Desembaraço</span>
          </div>
          <div className="h-60">
            <Bar data={chart3Data} options={commonOptions} />
          </div>
        </div>
      </div>
    );
  }

  // === TAB 3 CHARTS: Custos, Cashflow (PO/CI) & Impostos ===
  if (activeTab === 3) {
    const condicoes = ['30 DDL', '60 DDL', '90 DDL', '180 DDL', '360 DDL'] as const;
    const chart1Data = {
      labels: condicoes.map((c) => `Venc. ${c}`),
      datasets: [
        {
          label: 'Desembolso Projetado (R$ Mil)',
          data: condicoes.map((c) =>
            Math.round(
              processos
                .filter((p) => p.condicaoPagamento === c)
                .reduce((acc, p) => acc + p.vmleBRL, 0) / 1000
            )
          ),
          backgroundColor: ['#ef4444', '#f97316', '#3b82f6', '#6366f1', '#10b981'],
          borderRadius: 6,
        },
      ],
    };

    const topCIs = processos.slice(0, 7);
    const chart2Data = {
      labels: topCIs.map((p) => p.id),
      datasets: [
        {
          label: 'VMLD / Mercadoria (R$ Mil)',
          data: topCIs.map((p) => Math.round(p.vmldBRL / 1000)),
          backgroundColor: '#3b82f6',
        },
        {
          label: 'Impostos DI (II+IPI+PIS+COF+ICMS R$ Mil)',
          data: topCIs.map((p) => Math.round(p.totalImpostosEstimadosBRL / 1000)),
          backgroundColor: '#f59e0b',
        },
        {
          label: 'Armazenagem & Desp. Aduaneiras (R$ Mil)',
          data: topCIs.map((p) => Math.round((p.despesasAduaneirasBRL + p.armazenagemAcumuladaBRL) / 1000)),
          backgroundColor: '#ef4444',
        },
      ],
    };

    const stackedOptions = {
      ...commonOptions,
      scales: {
        x: { ...commonOptions.scales.x, stacked: true },
        y: { ...commonOptions.scales.y, stacked: true },
      },
    };

    const totalSuspenso = processos.reduce((s, p) => s + p.impostosSuspensosDrawbackBRL, 0);
    const totalVazamento = processos.reduce((s, p) => s + p.impostosPagosIndevidamenteBRL, 0);
    const totalEstoqueNormal = processos
      .filter((p) => p.regime === 'Recolhimento Integral' && p.impostosPagosIndevidamenteBRL === 0)
      .reduce((s, p) => s + p.totalImpostosEstimadosBRL, 0);

    const chart3Data = {
      labels: [
        'Suspensos via Drawback (Economia)',
        'Vazamento Fiscal (Pago s/ AC)',
        'Recolhimento Normal (Estoque)',
      ],
      datasets: [
        {
          data: [
            Math.round(totalSuspenso / 1000),
            Math.round(totalVazamento / 1000),
            Math.round(totalEstoqueNormal / 1000),
          ],
          backgroundColor: ['#22c55e', '#ef4444', '#64748b'],
          borderWidth: 1,
        },
      ],
    };

    return (
      <div id="charts-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-calendar-check text-blue-600 mr-2"></i>Cashflow de POs / Invoices por Prazo
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Convertido PTAX (R$ Mil)</span>
          </div>
          <div className="h-60">
            <Bar data={chart1Data} options={commonOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-layer-group text-amber-500 mr-2"></i>Custo de CIs Embarcadas (Landed Cost)
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">VMLD + Impostos + Porto</span>
          </div>
          <div className="h-60">
            <Bar data={chart2Data} options={stackedOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-scale-balanced text-red-600 mr-2"></i>Impostos Suspensos vs. Vazamento Fiscal
            </h3>
            <span className="text-xs font-mono text-red-600 dark:text-red-400 font-bold tabular-nums">
              Leakage: R$ {(totalVazamento / 1000).toFixed(1)}k
            </span>
          </div>
          <div className="h-60">
            <Doughnut data={chart3Data} options={pieOptions} />
          </div>
        </div>
      </div>
    );
  }

  // === TAB 4 CHARTS: Fretes, Rodoviário & Saving ===
  if (activeTab === 4) {
    const sampleProcs = processos.slice(0, 8);
    const chart1Data = {
      labels: sampleProcs.map((p) => p.id),
      datasets: [
        {
          label: 'Frete Cotado / Budget (R$ Mil)',
          data: sampleProcs.map((p) => Math.round(p.cotacaoFreteBRL / 1000)),
          backgroundColor: '#94a3b8',
          borderRadius: 4,
        },
        {
          label: 'Frete Efetivamente Pago (R$ Mil)',
          data: sampleProcs.map((p) => Math.round(p.fretePagoBRL / 1000)),
          backgroundColor: '#2563eb',
          borderRadius: 4,
        },
      ],
    };

    const agentes = ['DSV', 'DHL', 'KN', 'FEDEX', 'Hellmann'] as const;
    const chart2Data = {
      labels: agentes,
      datasets: [
        {
          label: 'Saving Acumulado de Frete (R$ Mil)',
          data: agentes.map((ag) =>
            Number(
              (
                processos
                  .filter((p) => p.agenteCarga === ag)
                  .reduce((s, p) => s + p.savingFreteBRL, 0) / 1000
              ).toFixed(1)
            )
          ),
          backgroundColor: ['#22c55e', '#10b981', '#059669', '#0d9488', '#14b8a6'],
          borderRadius: 6,
        },
      ],
    };

    const transportadoras = ['JSL Heavy', 'Patrus Transportes', 'TNT Mercúrio', 'Braspress', 'Translovato'];
    const chart3Data = {
      labels: transportadoras,
      datasets: [
        {
          label: 'Frete Internacional Vinculado (R$ Mil)',
          data: transportadoras.map((tr) =>
            Math.round(
              processos
                .filter((p) => p.transportadoraNacional === tr)
                .reduce((s, p) => s + p.fretePagoBRL, 0) / 1000
            )
          ),
          backgroundColor: '#3b82f6',
          borderRadius: 4,
        },
        {
          label: 'Frete Rodoviário Nacional até MFX (R$ Mil)',
          data: transportadoras.map((tr) =>
            Math.round(
              processos
                .filter((p) => p.transportadoraNacional === tr)
                .reduce((s, p) => s + p.freteRodoviarioBRL, 0) / 1000
            )
          ),
          backgroundColor: '#f97316',
          borderRadius: 4,
        },
      ],
    };

    return (
      <div id="charts-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-chart-column text-blue-600 mr-2"></i>Frete Cotado vs. Frete Pago (R$ Mil)
            </h3>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
              Média -15.4%
            </span>
          </div>
          <div className="h-60">
            <Bar data={chart1Data} options={commonOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-piggy-bank text-emerald-600 mr-2"></i>Saving Acumulado por Agente (R$ Mil)
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Negociação Comex</span>
          </div>
          <div className="h-60">
            <Bar data={chart2Data} options={commonOptions} />
          </div>
        </div>

        <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              <i className="fas fa-truck-fast text-orange-500 mr-2"></i>Frete Internacional vs. Rodoviário MFX
            </h3>
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">Por Transportadora</span>
          </div>
          <div className="h-60">
            <Bar data={chart3Data} options={commonOptions} />
          </div>
        </div>
      </div>
    );
  }

  // === TAB 5 CHARTS: Controle de Drawback (7 ACs) ===
  const stalledCargoes = processos.filter((p) => p.cargaParadaDrawback);

  const chart1Data = {
    labels: atosConcessorios.map((ac) => ac.id.replace('AC-', '')),
    datasets: [
      {
        label: 'Saldo Utilizado (USD Mil)',
        data: atosConcessorios.map((ac) => Math.round(ac.utilizadoImportacaoUSD / 1000)),
        backgroundColor: '#3b82f6',
      },
      {
        label: 'Saldo Disponível (USD Mil)',
        data: atosConcessorios.map((ac) => Math.round(ac.saldoDisponivelUSD / 1000)),
        backgroundColor: atosConcessorios.map((ac) =>
          ac.statusAC === 'Em Alteração' ? '#f97316' : '#22c55e'
        ),
      },
    ],
  };

  const chart2Data = {
    labels: stalledCargoes.map((p) => p.id),
    datasets: [
      {
        label: 'Armazenagem Acumulada (R$ Mil)',
        data: stalledCargoes.map((p) => Number((p.armazenagemAcumuladaBRL / 1000).toFixed(1))),
        backgroundColor: '#ef4444',
        borderRadius: 4,
      },
      {
        label: 'Benefício Fiscal Drawback (R$ Mil)',
        data: stalledCargoes.map((p) => Number((p.impostosSuspensosDrawbackBRL / 1000).toFixed(1))),
        backgroundColor: '#22c55e',
        borderRadius: 4,
      },
    ],
  };

  const chart3Data = {
    labels: [
      'Itens Regulares c/ Laudo Validado (297)',
      'Itens c/ Qtd Irrisória 0,01 no AC (6)',
      'Itens c/ NCM Divergente entre ACs (5)',
    ],
    datasets: [
      {
        data: [297, 6, 5],
        backgroundColor: ['#22c55e', '#ef4444', '#f97316'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div id="charts-container" className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-shield-halved text-blue-600 mr-2"></i>Status dos 7 Atos Concessórios (USD Mil)
          </h3>
          <span className="text-xs font-mono text-orange-600 dark:text-orange-400 font-semibold">
            3 Em Alteração SECEX
          </span>
        </div>
        <div className="h-60">
          <Bar
            data={chart1Data}
            options={{
              ...commonOptions,
              scales: {
                x: { ...commonOptions.scales.x, stacked: true },
                y: { ...commonOptions.scales.y, stacked: true },
              },
            }}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-triangle-exclamation text-red-600 mr-2"></i>Impacto das {stalledCargoes.length} Cargas Paradas (R$ Mil)
          </h3>
          <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
            Armazenagem vs. Drawback
          </span>
        </div>
        <div className="h-60">
          <Bar data={chart2Data} options={commonOptions} />
        </div>
      </div>

      <div className="bg-white dark:bg-[#1f2937] p-5 rounded-xl shadow border border-gray-200 dark:border-[#374151]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            <i className="fas fa-clipboard-check text-amber-500 mr-2"></i>Auditoria de Laudos Técnicos (~308 Itens)
          </h3>
          <span className="text-xs font-mono text-red-600 dark:text-red-400 font-semibold">
            11 Divergências Críticas
          </span>
        </div>
        <div className="h-60">
          <Doughnut data={chart3Data} options={pieOptions} />
        </div>
      </div>
    </div>
  );
};
