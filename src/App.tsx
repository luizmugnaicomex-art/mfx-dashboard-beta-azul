import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ImportProcess,
  AtoConcessorio,
  PedidoForecastRow,
  FilterState,
  PtaxRates,
  LanguageCode,
} from './types/mfx';
import {
  PROCESSOS_MFX,
  PEDIDOS_FORECAST_MFX,
  ATOS_CONCESSORIOS_MFX,
  INITIAL_PTAX,
  TRANSLATIONS,
} from './data/mfxData';
import { parseMfxExcelFile, exportMfxToExcel, computeProcessRisk } from './utils/excelParser';
import { FilterPanel } from './components/FilterPanel';
import { DashboardCharts } from './components/DashboardCharts';
import { DashboardGrid } from './components/DashboardGrid';
import { DetailedTableView } from './components/DetailedTableView';
import { DetailsModal } from './components/DetailsModal';
import { DeliveriesView } from './components/DeliveriesView';
import {
  testConnection,
  subscribeToOnlineProcessos,
  publishToCloudFirestore,
} from './services/firebaseService';
import { isImportProcessDelivered } from './utils/deliveryFilter';

const INITIAL_FILTERS: FilterState = {
  pos: [],
  projetos: [],
  status: [],
  modalIncoterm: [],
  regimeAC: [],
  fornecedores: [],
  agentes: [],
  searchPO: '',
  searchProcesso: '',
  searchBlDi: '',
  etaStart: '',
  etaEnd: '',
  cashflowStart: '',
  cashflowEnd: '',
  showDelivered: false,
};

const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
  processo: true,
  oc: true,
  fornecedor: true,
  projeto: true,
  status: true,
  modal: true,
  blAwb: true,
  regimeAC: true,
  eta: true,
  freeTime: true,
  vmld: true,
  impostos: true,
  saving: true,
};

const COLUMN_LABELS: Record<string, string> = {
  processo: 'REF. MFX / Processo',
  oc: 'Ordem de Compra (PO/OC)',
  fornecedor: 'Fornecedor / Origem',
  projeto: 'Comprador / Projeto',
  status: 'Status Operacional',
  modal: 'Modal & Incoterm',
  blAwb: 'BL / AWB & DI',
  regimeAC: 'Regime / Ato Concessório',
  eta: 'Datas Embarque, ETA & TT',
  freeTime: 'Free Time Restante',
  vmld: 'Valor Aduaneiro VMLD (R$)',
  impostos: 'Impostos DI & Drawback',
  saving: 'Saving de Frete (R$)',
};

interface ToastMessage {
  id: number;
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info';
}

export default function App() {
  const [processos, setProcessos] = useState<ImportProcess[]>(PROCESSOS_MFX);
  const [pedidosForecast, setPedidosForecast] =
    useState<PedidoForecastRow[]>(PEDIDOS_FORECAST_MFX);
  const [atosConcessorios, setAtosConcessorios] = useState<AtoConcessorio[]>(ATOS_CONCESSORIOS_MFX);
  const [ptax] = useState<PtaxRates>(INITIAL_PTAX);
  const [sourceFileName, setSourceFileName] = useState<string>(
    'FUP IMPORTAÇÃO BI (REF. MFX, POs & MATERIAIS)'
  );
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('03/11/2026 18:05');

  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [lang, setLang] = useState<LanguageCode>('pt');
  const [activeTab, setActiveTab] = useState<number>(0); // 0 = Deliveries (Customer View), 1-5 = Analytics/Operations, 6 = Master Table
  const [isOnlineConnected, setIsOnlineConnected] = useState<boolean>(true);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [presentationMode, setPresentationMode] = useState<boolean>(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [visibleColumns, setVisibleColumns] =
    useState<Record<string, boolean>>(DEFAULT_VISIBLE_COLUMNS);

  // Modal state
  const [selectedProcess, setSelectedProcess] = useState<ImportProcess | null>(null);
  const [selectedAC, setSelectedAC] = useState<AtoConcessorio | null>(null);
  const [modalInitialTab, setModalInitialTab] = useState<'overview' | 'espelho' | 'drawback'>(
    'overview'
  );

  // Toast Notification state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  const t = TRANSLATIONS[lang];

  const addToast = (
    title: string,
    description: string,
    type: 'success' | 'warning' | 'info' = 'success'
  ) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5000);
  };

  // Test Firebase connection & Subscribe to online Firestore updates
  useEffect(() => {
    testConnection().then((connected) => {
      setIsOnlineConnected(connected);
    });

    const unsubscribe = subscribeToOnlineProcessos(
      (onlineProcessos, meta) => {
        if (onlineProcessos.length > 0) {
          setProcessos(onlineProcessos);
        }
        if (meta?.sourceFileName) {
          setSourceFileName(meta.sourceFileName);
        }
        if (meta?.lastUpdatedTime) {
          setLastUpdatedTime(meta.lastUpdatedTime);
        }
      },
      () => {
        setIsOnlineConnected(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync dark mode class on body & html
  const toggleDarkMode = (targetDark?: boolean) => {
    const nextDark = targetDark !== undefined ? targetDark : !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.body.classList.add('dark');
      document.documentElement.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
      document.documentElement.classList.remove('dark');
    }
  };

  // Sync modal-open class on body
  useEffect(() => {
    if (selectedProcess || selectedAC) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
  }, [selectedProcess, selectedAC]);

  // Dynamic options for the 7 multi-select filter boxes
  const availablePOs = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => {
      if (p.id) set.add(p.id);
      if (p.oc) set.add(p.oc);
      p.posList?.forEach((po) => set.add(po));
      p.itens.forEach((it) => {
        if (it.oc) set.add(it.oc);
      });
    });
    return Array.from(set);
  }, [processos]);

  const availableBuyersProjects = useMemo(() => {
    const set = new Set<string>(['EUDE', 'BEATRIZ SANTANA', 'GUSTAVO']);
    processos.forEach((p) => {
      if (p.compradorResponsavel) set.add(p.compradorResponsavel);
      if (p.projeto) set.add(p.projeto);
      p.itens.forEach((it) => {
        if (it.compradorResponsavel) set.add(it.compradorResponsavel);
      });
    });
    ['PETROBRAS', 'PRIO', 'ESTOQUE', 'EXPANSÃO 140 CNTR'].forEach((proj) => set.add(proj));
    return Array.from(set);
  }, [processos]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>([
      'Entregue MFX',
      'Em Trânsito',
      'Ag. Embarque',
      'Parado Ag. Drawback',
      'No Porto/Aeroporto',
      'Desembaraçado',
      'Em Produção Fornecedor',
    ]);
    processos.forEach((p) => {
      if (p.status) set.add(p.status);
    });
    return Array.from(set);
  }, [processos]);

  const availableModalsIncoterms = useMemo(() => {
    const set = new Set<string>(['AÉREO', 'MARÍTIMO', 'EXW', 'FCA', 'CFR', 'FOB', 'CIF', 'CPT', 'DAP']);
    processos.forEach((p) => {
      if (p.modal) set.add(p.modal);
      if (p.incoterm) set.add(p.incoterm);
    });
    return Array.from(set);
  }, [processos]);

  const availableSuppliers = useMemo(() => {
    const set = new Set<string>();
    processos.forEach((p) => {
      if (p.fornecedor) set.add(p.fornecedor);
    });
    return Array.from(set);
  }, [processos]);

  const availableAgents = useMemo(() => {
    const set = new Set<string>(['CRONOS', 'CAPITAL', 'MSC', 'DSV', 'DHL', 'KN', 'FEDEX', 'ÔMEGA']);
    processos.forEach((p) => {
      if (p.agenteCarga) set.add(p.agenteCarga);
    });
    return Array.from(set);
  }, [processos]);

  const availableACs = useMemo(
    () => atosConcessorios.map((ac) => ac.id),
    [atosConcessorios]
  );

  // Filtered Processes (Accurate multi-dimensional filtering across REF. MFX, PO, Buyer, Supplier, Material Code, BL/AWB)
  const filteredProcessos = useMemo(() => {
    const f = filters;

    const modalOptions = ['MARÍTIMO', 'AÉREO', 'RODOVIÁRIO'];
    const selectedModals = f.modalIncoterm.filter((x) => modalOptions.includes(x));
    const selectedIncoterms = f.modalIncoterm.filter((x) => !modalOptions.includes(x));

    const regimeOptions = ['Drawback Suspensão', 'Recolhimento Integral', 'Ex-Tarifário'];
    const selectedRegimes = f.regimeAC.filter((x) => regimeOptions.includes(x));
    const selectedACs = f.regimeAC.filter((x) => !regimeOptions.includes(x));

    const despOptions = ['ÔMEGA'];
    const selectedDespachantes = f.agentes.filter((x) => despOptions.includes(x));
    const selectedForwarders = f.agentes.filter((x) => !despOptions.includes(x));

    return processos.filter((p) => {
      // RULE: Hide Delivered by default unless showDelivered flag is true or user explicitly selected 'Entregue MFX' in status filter
      const isDelivered = isImportProcessDelivered(p);
      if (!f.showDelivered && isDelivered && !f.status.includes('Entregue MFX')) {
        return false;
      }

      if (f.pos.length > 0) {
        const matchPOOrRef = f.pos.some(
          (sel) =>
            p.id === sel ||
            p.oc === sel ||
            p.oc.includes(sel) ||
            p.posList?.includes(sel) ||
            p.itens.some((it) => it.oc === sel)
        );
        if (!matchPOOrRef) return false;
      }

      if (f.projetos.length > 0) {
        const matchBuyerOrProject = f.projetos.some(
          (sel) =>
            p.projeto.toUpperCase() === sel.toUpperCase() ||
            (p.compradorResponsavel || '').toUpperCase() === sel.toUpperCase() ||
            p.itens.some(
              (it) => (it.compradorResponsavel || '').toUpperCase() === sel.toUpperCase()
            )
        );
        if (!matchBuyerOrProject) return false;
      }

      if (f.status.length > 0 && !f.status.includes(p.status)) return false;

      if (selectedModals.length > 0 && !selectedModals.includes(p.modal)) return false;
      if (
        selectedIncoterms.length > 0 &&
        !selectedIncoterms.some((inc) => inc.toUpperCase() === p.incoterm.toUpperCase())
      ) {
        return false;
      }

      if (selectedRegimes.length > 0 && !selectedRegimes.includes(p.regime)) return false;
      if (selectedACs.length > 0 && !selectedACs.includes(p.atoConcessorio)) return false;

      if (
        f.fornecedores.length > 0 &&
        !f.fornecedores.some(
          (sup) =>
            sup.toUpperCase() === p.fornecedor.toUpperCase() ||
            sup.toUpperCase() === p.paisOrigem.toUpperCase()
        )
      ) {
        return false;
      }

      if (
        selectedDespachantes.length > 0 &&
        !selectedDespachantes.some((d) => d.toUpperCase() === p.despachante.toUpperCase())
      ) {
        return false;
      }
      if (
        selectedForwarders.length > 0 &&
        !selectedForwarders.some((ag) => ag.toUpperCase() === p.agenteCarga.toUpperCase())
      ) {
        return false;
      }

      // Quick search 1: PO, Invoice, COD. MATERIAL (e.g. 2100000290), or Material Description
      if (f.searchPO.trim()) {
        const q = f.searchPO.trim().toLowerCase();
        const matchSearch1 =
          p.oc.toLowerCase().includes(q) ||
          p.commercialInvoice.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          p.itens.some(
            (it) =>
              it.codigoItem.toLowerCase().includes(q) ||
              it.descricao.toLowerCase().includes(q) ||
              (it.oc || '').toLowerCase().includes(q) ||
              (it.invoice || '').toLowerCase().includes(q)
          );
        if (!matchSearch1) return false;
      }

      // Quick search 2: REF. MFX / Processo / Comprador / Fornecedor
      if (f.searchProcesso.trim()) {
        const q = f.searchProcesso.trim().toLowerCase();
        const matchSearch2 =
          p.id.toLowerCase().includes(q) ||
          (p.compradorResponsavel || '').toLowerCase().includes(q) ||
          p.fornecedor.toLowerCase().includes(q) ||
          p.oc.toLowerCase().includes(q);
        if (!matchSearch2) return false;
      }

      // Quick search 3: BL / AWB / DI / Agente
      if (f.searchBlDi.trim()) {
        const q = f.searchBlDi.trim().toLowerCase();
        const matchSearch3 =
          p.blAwb.toLowerCase().includes(q) ||
          p.numeroDiDuimp.toLowerCase().includes(q) ||
          p.agenteCarga.toLowerCase().includes(q);
        if (!matchSearch3) return false;
      }

      if (f.etaStart && p.eta < f.etaStart) return false;
      if (f.etaEnd && p.eta > f.etaEnd) return false;
      if (f.cashflowStart && p.dataVencimentoInvoice < f.cashflowStart) return false;
      if (f.cashflowEnd && p.dataVencimentoInvoice > f.cashflowEnd) return false;

      return true;
    });
  }, [processos, filters]);

  // Filtered Atos Concessórios
  const filteredAtosConcessorios = useMemo(() => {
    const f = filters;
    const regimeOptions = ['Drawback Suspensão', 'Recolhimento Integral', 'Ex-Tarifário'];
    const selectedACs = f.regimeAC.filter((x) => !regimeOptions.includes(x));

    return atosConcessorios.filter((ac) => {
      if (selectedACs.length > 0 && !selectedACs.includes(ac.id)) return false;
      if (
        f.pos.length > 0 ||
        f.fornecedores.length > 0 ||
        f.searchPO.trim() ||
        f.searchProcesso.trim()
      ) {
        const linkedToFiltered = filteredProcessos.some(
          (p) => p.atoConcessorio === ac.id || ac.processosVinculados.includes(p.id)
        );
        if (!linkedToFiltered) return false;
      }
      return true;
    });
  }, [atosConcessorios, filters, filteredProcessos]);

  const activeFilterCount = useMemo(() => {
    let count =
      filters.pos.length +
      filters.projetos.length +
      filters.status.length +
      filters.modalIncoterm.length +
      filters.regimeAC.length +
      filters.fornecedores.length +
      filters.agentes.length;
    if (filters.searchPO) count++;
    if (filters.searchProcesso) count++;
    if (filters.searchBlDi) count++;
    if (filters.etaStart || filters.etaEnd) count++;
    if (filters.cashflowStart || filters.cashflowEnd) count++;
    return count;
  }, [filters]);

  // Dynamic Counter Ribbon Metrics
  const kpiMetrics = useMemo(() => {
    const totalCount = filteredProcessos.length;
    const totalVmld = filteredProcessos.reduce((s, p) => s + p.vmldBRL, 0);
    const totalSaving = filteredProcessos.reduce((s, p) => s + p.savingFreteBRL, 0);
    const totalDrawbackSuspended = filteredProcessos.reduce(
      (s, p) => s + p.impostosSuspensosDrawbackBRL,
      0
    );
    const totalStalled = filteredProcessos.filter((p) => p.cargaParadaDrawback).length;
    const totalFcl = filteredProcessos.reduce((s, p) => s + p.qtdContainersFCL, 0);
    return {
      totalCount,
      totalVmld,
      totalSaving,
      totalDrawbackSuspended,
      totalStalled,
      totalFcl,
    };
  }, [filteredProcessos]);

  // Handlers
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoUrl(reader.result);
        addToast(
          'Logo Atualizada',
          'A logomarca personalizada da MFX foi aplicada ao cabeçalho.',
          'info'
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // Bulletproof XLSX Upload Handler on #file-upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const parsed = parseMfxExcelFile(buffer, ptax);
        if (parsed.processos.length > 0) {
          setProcessos(parsed.processos);
          setPedidosForecast(
            parsed.pedidosForecast.length > 0
              ? parsed.pedidosForecast
              : parsed.processos.flatMap((p) =>
                  p.itens.map((it, i) => ({
                    id: `PED-UP-${p.id}-${i + 1}`,
                    projeto: p.projeto,
                    processo: p.id,
                    compradorResponsavel:
                      it.compradorResponsavel || p.compradorResponsavel || 'EUDE',
                    fornecedor: it.fornecedor || p.fornecedor,
                    origem: it.origem || p.paisOrigem,
                    oc: it.oc || p.oc,
                    codMaterial: it.codigoItem,
                    descricao: it.descricao,
                    qtd: it.quantidade,
                    unidadeMedida: it.unidade,
                    emissaoOC: it.dataEmissaoPO || p.dataPO,
                    incoterm: p.incoterm,
                    valorUnitario: it.valorUnitarioMoeda,
                    valor: it.valorTotalMoeda,
                    moeda: it.moeda,
                    prontidaoCarga: it.previsaoProntidaoCarga || p.dataProntidaoCarga,
                    etd: it.etd || p.etd,
                    eta: it.eta || p.eta,
                    agenteCargas: p.agenteCarga,
                    blAwb: p.blAwb,
                    modal: p.modal,
                    status: it.statusItem || p.statusRawExcel || p.status,
                  }))
                )
          );
          const newFileName = `${fileName} (Abas: ${parsed.sheetNames.join(', ')})`;
          setSourceFileName(newFileName);
          const now = new Date();
          const newTime = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
          })}`;
          setLastUpdatedTime(newTime);
          addToast(
            `Arquivo ${fileName} carregado com sucesso!`,
            `${parsed.processos.length} processos (REF. MFX) e ${parsed.pedidosCount} itens/POs sincronizados.`,
            'success'
          );

          // Auto-sync to Firebase Cloud Firestore so all users and clients see it online
          publishToCloudFirestore(parsed.processos, newFileName, newTime).then((res) => {
            if (res.success) {
              addToast(
                'Sincronizado Online (Firebase)',
                `${res.count} processos enviados para a nuvem. Disponíveis em tempo real para todos os clientes!`,
                'success'
              );
            }
          });
        } else {
          addToast(
            'Planilha sem linhas válidas',
            'Verifique se o arquivo XLSX possui dados preenchidos.',
            'warning'
          );
        }
      } catch (err) {
        console.error('XLSX Parse Error:', err);
        addToast(
          'Erro ao processar arquivo XLSX',
          'Não foi possível ler a estrutura da planilha selecionada.',
          'warning'
        );
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input so the user can re-upload the exact same file after editing it in Excel
    e.target.value = '';
  };

  const handlePublishToFirebase = async () => {
    setIsSyncingCloud(true);
    const now = new Date();
    const formattedTime = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    const result = await publishToCloudFirestore(processos, sourceFileName, formattedTime);
    setIsSyncingCloud(false);
    if (result.success) {
      setLastUpdatedTime(formattedTime);
      addToast(
        'Publicado na Nuvem (Firebase)!',
        `${result.count} processos publicados online. Qualquer cliente acessando agora verá as atualizações ao vivo.`,
        'success'
      );
    } else {
      addToast(
        'Falha na Sincronização Online',
        result.error || 'Verifique a conexão com a internet.',
        'warning'
      );
    }
  };

  const handleLoadDemoData = () => {
    setProcessos(PROCESSOS_MFX);
    setPedidosForecast(PEDIDOS_FORECAST_MFX);
    setAtosConcessorios(ATOS_CONCESSORIOS_MFX);
    setFilters(INITIAL_FILTERS);
    setSourceFileName('FUP IMPORTAÇÃO BI (Dados Reais MFX — REF. MFX, POs & MATERIAIS)');
    const now = new Date();
    const timeStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    setLastUpdatedTime(timeStr);
    addToast(
      'Dados Reais MFX Carregados!',
      `${PROCESSOS_MFX.length} processos (MFX00166/26, MFX00040/26, MFX00052/26, MFX-00001/25, MFX-00002/25 + IMP) sincronizados.`,
      'success'
    );
    // Also broadcast demo data to Firestore
    publishToCloudFirestore(
      PROCESSOS_MFX,
      'FUP IMPORTAÇÃO BI (Dados Reais MFX — REF. MFX, POs & MATERIAIS)',
      timeStr
    );
  };

  const handleExportExcel = () => {
    exportMfxToExcel(
      filteredProcessos,
      filteredAtosConcessorios,
      pedidosForecast,
      'FUP_IMPORTACAO_BI_MFX_CONSOLIDADO.xlsx'
    );
    addToast(
      'Planilha Exportada (.XLSX)',
      `O arquivo FUP_IMPORTACAO_BI_MFX_CONSOLIDADO.xlsx contendo a Planilha Geral de Itens (REF. MFX / PO / COD. MATERIAL), PROCESSOS e PEDIDOS foi gerado.`,
      'success'
    );
  };

  const handleAssignDrawbackAC = (processId: string, acId: string, ncmItem: string) => {
    setProcessos((prev) =>
      prev.map((p) => {
        if (p.id !== processId) return p;
        const updated: ImportProcess = {
          ...p,
          regime: 'Drawback Suspensão',
          beneficioRaw: 'DRAWBACK',
          atoConcessorio: acId,
          status: p.cargaParadaDrawback ? 'No Porto/Aeroporto' : p.status,
          statusRawExcel: p.cargaParadaDrawback ? 'EM DESEMBARAÇO' : p.statusRawExcel,
          cargaParadaDrawback: false,
          motivoParadaDrawback: undefined,
          impostosSuspensosDrawbackBRL: p.totalImpostosEstimadosBRL,
          impostosPagosIndevidamenteBRL: 0,
          itens: p.itens.map((it) => ({
            ...it,
            ncmAtoConcessorio: ncmItem,
            alertaLaudoTecnico: 'OK',
          })),
        };
        const nextRisk = computeProcessRisk(updated);
        updated.riskLevel = nextRisk.riskLevel;
        updated.riskReason = `Vinculado ao ${acId} (NCM ${ncmItem}) · Liberado p/ Registro DI Ômega`;
        setSelectedProcess(updated);
        return updated;
      })
    );

    addToast(
      `Drawback Vinculado: ${processId} ➔ ${acId}`,
      `Item NCM ${ncmItem} alocado com sucesso. Carga destravada para registro de DI com suspensão tributária!`,
      'success'
    );
  };

  const handleSendPreAlertaAWB = (processId: string) => {
    setProcessos((prev) =>
      prev.map((p) => {
        if (p.id !== processId) return p;
        const updated: ImportProcess = {
          ...p,
          alertaPreAlertaAWB: false,
        };
        const nextRisk = computeProcessRisk(updated);
        updated.riskLevel = nextRisk.riskLevel;
        updated.riskReason = nextRisk.riskReason;
        setSelectedProcess(updated);
        return updated;
      })
    );
    addToast(
      `Pré-Alerta AWB Enviado à Ômega (${processId})`,
      'Documentação AWB, Packing List e Commercial Invoice transmitidos ao despachante para agilizar liberação no TECA.',
      'success'
    );
  };

  const handleResolveACAmendment = (acId: string) => {
    setAtosConcessorios((prev) =>
      prev.map((ac) => {
        if (ac.id !== acId) return ac;
        const updatedAC: AtoConcessorio = {
          ...ac,
          statusAC: 'Ativo',
          itensComDivergenciaLaudo: 0,
          cargasParadasAguardando: 0,
          riscoAC: 'low',
          itensDetalhados: ac.itensDetalhados.map((it) => ({
            ...it,
            qtdAutorizada: it.qtdAutorizada < 1 ? 2500 : it.qtdAutorizada,
            alertaAuditoria: 'OK',
            observacaoLaudo: 'Laudo Técnico retificado e aditivo deferido no Siscomex.',
          })),
        };
        setSelectedAC(updatedAC);
        return updatedAC;
      })
    );

    setProcessos((prev) =>
      prev.map((p) => {
        if (p.atoConcessorio !== acId || !p.cargaParadaDrawback) return p;
        const updated: ImportProcess = {
          ...p,
          status: 'No Porto/Aeroporto',
          statusRawExcel: 'EM DESEMBARAÇO',
          cargaParadaDrawback: false,
          motivoParadaDrawback: undefined,
          itens: p.itens.map((it) => ({ ...it, alertaLaudoTecnico: 'OK' })),
        };
        const nextRisk = computeProcessRisk(updated);
        updated.riskLevel = nextRisk.riskLevel;
        updated.riskReason = `Aditivo do ${acId} deferido · Liberado para Registro de DI`;
        return updated;
      })
    );

    addToast(
      `Aditivo SECEX Deferido — ${acId}`,
      'Quantidades 0,01 e divergências de NCM do Laudo Técnico foram retificadas e as cargas vinculadas foram destravadas!',
      'success'
    );
  };

  const fmtBRL = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="max-w-screen-2xl mx-auto p-4 md:p-8">
      {/* =====================================================================
          TOP HEADER BAR (EXACT CONTROLS FROM REFERENCE)
         ===================================================================== */}
      <header className="bg-white dark:bg-[#1f2937] p-6 rounded-xl shadow mb-6 border border-gray-200 dark:border-[#374151]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          {/* LEFT SIDE */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Company Logo Uploader */}
            <div className="relative group shrink-0">
              {logoUrl ? (
                <div className="relative">
                  <img
                    id="company-logo"
                    src={logoUrl}
                    alt="MFX Comex Logo"
                    referrerPolicy="no-referrer"
                    className="h-16 w-auto max-w-[160px] object-contain rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-white"
                  />
                  <button
                    id="remove-logo-btn"
                    type="button"
                    onClick={() => setLogoUrl(null)}
                    title="Remover Logo"
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow hover:bg-red-700 cursor-pointer"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ) : (
                <div
                  id="company-logo"
                  onClick={() => logoInputRef.current?.click()}
                  title="Clique para enviar a logo da empresa"
                  className="h-16 w-24 rounded-xl bg-slate-900 dark:bg-blue-950 border-2 border-blue-600 flex flex-col items-center justify-center text-white cursor-pointer hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <span className="text-lg font-black tracking-wider text-blue-400 leading-none">
                    MFX
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-300 mt-1">
                    COMEX
                  </span>
                </div>
              )}
              <input
                id="logo-upload"
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            {/* Main Title & Subtitle */}
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-gray-100 tracking-tight">
                {t.mainTitle}
              </h1>
              <div
                id="last-update"
                className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span>
                  <i className="fas fa-file-excel text-green-600 mr-1"></i>
                  {t.lastUpdatePrefix}{' '}
                  <strong className="text-gray-700 dark:text-gray-200">{sourceFileName}</strong>
                </span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  <i className="far fa-clock mr-1"></i>Atualizado: {lastUpdatedTime}
                </span>
                <span>·</span>
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300 tabular-nums">
                  PTAX BCB: USD R$ {ptax.USD.toFixed(4)} | EUR R$ {ptax.EUR.toFixed(4)} | CNY R${' '}
                  {ptax.CNY.toFixed(4)}
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT SIDE ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Language Selector */}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as LanguageCode)}
              aria-label="Selecionar Idioma"
              className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-300 dark:border-[#374151] bg-gray-50 dark:bg-[#111827] text-gray-800 dark:text-gray-100 cursor-pointer"
            >
              <option value="pt">🇧🇷 Português (PT)</option>
              <option value="en">🇬🇧 English (EN)</option>
              <option value="zh">🇨🇳 中文 (ZH)</option>
            </select>

            {/* Logo Upload Trigger Button */}
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              title="Alterar Logo MFX"
              className="p-2 px-3 text-xs font-semibold rounded-lg border border-gray-300 dark:border-[#374151] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            >
              <i className="fas fa-image"></i>
            </button>

            {/* Working Dark / Light Mode Toggle */}
            {!darkMode ? (
              <button
                id="dark-mode-btn"
                type="button"
                onClick={() => toggleDarkMode(true)}
                title="Ativar Modo Escuro"
                className="p-2 px-3 text-xs font-semibold rounded-lg border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <i className="fas fa-moon"></i>
              </button>
            ) : (
              <button
                id="light-mode-btn"
                type="button"
                onClick={() => toggleDarkMode(false)}
                title="Ativar Modo Claro"
                className="p-2 px-3 text-xs font-semibold rounded-lg border border-[#374151] bg-gray-800 text-amber-400 hover:bg-gray-700 transition-colors cursor-pointer"
              >
                <i className="fas fa-sun"></i>
              </button>
            )}

            {/* Sincronizar na Nuvem (Firebase) Button - Hidden in Presentation Mode */}
            {!presentationMode && (
              <button
                type="button"
                onClick={handlePublishToFirebase}
                disabled={isSyncingCloud}
                title="Salvar alterações online no Firebase Firestore"
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className={`fas ${isSyncingCloud ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
                {isSyncingCloud ? 'Sincronizando...' : 'Publicar Online (Firebase)'}
              </button>
            )}

            {/* Carregar Dados Demo MFX Button - Hidden in Presentation Mode */}
            {!presentationMode && (
              <button
                type="button"
                onClick={handleLoadDemoData}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fas fa-database"></i>
                {t.loadDemoBtn}
              </button>
            )}

            {/* Exportar Excel Button */}
            <button
              id="export-excel-btn"
              type="button"
              onClick={handleExportExcel}
              className="bg-green-700 hover:bg-green-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <i className="fas fa-file-excel"></i>
              {t.exportExcelBtn}
            </button>

            {/* Carregar XLSX Button - Hidden in Presentation Mode */}
            {!presentationMode && (
              <>
                <label
                  htmlFor="file-upload"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <i className="fas fa-upload"></i>
                  {t.uploadXlsxBtn}
                </label>
                <input
                  id="file-upload"
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
        </div>

        {/* DYNAMIC COUNTER RIBBON (#total-fcl-display) */}
        <div
          id="total-fcl-display"
          className="mt-5 pt-4 border-t border-gray-200 dark:border-[#374151] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
        >
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">
                {t.totalProcesses}
              </span>
              <span className="text-lg font-extrabold font-mono text-gray-900 dark:text-white tabular-nums">
                {kpiMetrics.totalCount} Processos ({kpiMetrics.totalFcl} FCL)
              </span>
            </div>
            <i className="fas fa-ship text-blue-600 text-xl opacity-80"></i>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">
                {t.totalCifFob}
              </span>
              <span className="text-lg font-extrabold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                {fmtBRL(kpiMetrics.totalVmld)}
              </span>
            </div>
            <i className="fas fa-coins text-blue-500 text-xl opacity-80"></i>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                {t.totalFreightSaving}
              </span>
              <span className="text-lg font-extrabold font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                + {fmtBRL(kpiMetrics.totalSaving)}
              </span>
            </div>
            <i className="fas fa-piggy-bank text-emerald-600 text-xl opacity-80"></i>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 dark:bg-[#111827] border border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block">
                Impostos Suspensos (7 ACs)
              </span>
              <span className="text-lg font-extrabold font-mono text-teal-600 dark:text-teal-400 tabular-nums">
                {fmtBRL(kpiMetrics.totalDrawbackSuspended)}
              </span>
            </div>
            <i className="fas fa-shield-halved text-teal-600 text-xl opacity-80"></i>
          </div>

          <div
            onClick={() => setActiveTab(5)}
            className="p-3 rounded-lg bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-between cursor-pointer hover:bg-red-100/80 transition-colors"
          >
            <div>
              <span className="text-[11px] font-bold text-red-800 dark:text-red-300 block">
                Cargas Paradas Ag. Drawback
              </span>
              <span className="text-lg font-extrabold font-mono text-red-600 dark:text-red-400 tabular-nums">
                {kpiMetrics.totalStalled} Cargas Críticas
              </span>
            </div>
            <i className="fas fa-triangle-exclamation text-red-600 text-xl"></i>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MULTI-SELECT FILTER PANEL (#filter-container) - Hidden on Tab 0 (Deliveries has its own dedicated search)
         ===================================================================== */}
      {activeTab !== 0 && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onApplyFilters={() => {
            addToast(
              'Filtros Aplicados',
              `Exibindo ${filteredProcessos.length} de ${processos.length} processos MFX.`,
              'info'
            );
          }}
          onClearFilters={() => {
            setFilters(INITIAL_FILTERS);
            addToast('Filtros Limpos', 'Todos os filtros foram redefinidos.', 'info');
          }}
          availablePOs={availablePOs}
          availableBuyersProjects={availableBuyersProjects}
          availableStatuses={availableStatuses}
          availableModalsIncoterms={availableModalsIncoterms}
          availableSuppliers={availableSuppliers}
          availableAgents={availableAgents}
          availableACs={availableACs}
          visibleColumns={visibleColumns}
          onToggleColumn={(colKey) =>
            setVisibleColumns((prev) => ({ ...prev, [colKey]: !prev[colKey] }))
          }
          columnLabels={COLUMN_LABELS}
          lang={lang}
          activeFilterCount={activeFilterCount}
          totalCount={processos.length}
          filteredCount={filteredProcessos.length}
        />
      )}

      {/* =====================================================================
          THE 7 VIEW TABS (#view-tabs-container)
         ===================================================================== */}
      <nav
        id="view-tabs-container"
        className="border-b border-gray-200 dark:border-[#374151] mb-6 bg-white dark:bg-[#1f2937] rounded-t-xl px-4 shadow-xs overflow-x-auto"
      >
        <div className="flex items-center space-x-2 md:space-x-6 min-w-max">
          {[
            { id: 0, icon: 'fa-box-open', label: t.tabDeliveries, highlight: true },
            { id: 1, icon: 'fa-file-invoice', label: t.tab1 },
            { id: 2, icon: 'fa-stopwatch', label: t.tab2 },
            { id: 3, icon: 'fa-coins', label: t.tab3 },
            { id: 4, icon: 'fa-truck-fast', label: t.tab4 },
            { id: 5, icon: 'fa-shield-halved', label: t.tab5 },
            { id: 6, icon: 'fa-table-list', label: t.tab6 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 text-xs md:text-sm font-bold border-b-3 transition-all whitespace-nowrap cursor-pointer flex items-center ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                <i className={`fas ${tab.icon} mr-2 ${tab.highlight ? 'text-amber-500' : ''}`}></i>
                {tab.label}
                {tab.highlight && (
                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">
                    Novo
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* =====================================================================
          3 TOP CHARTS (#charts-container) FOR TABS 1 TO 5
         ===================================================================== */}
      {activeTab >= 1 && activeTab <= 5 && (
        <DashboardCharts
          activeTab={activeTab}
          processos={filteredProcessos}
          atosConcessorios={filteredAtosConcessorios}
          darkMode={darkMode}
        />
      )}

      {/* =====================================================================
          MAIN DISPLAY: TAB 0 (DELIVERIES), TAB 6 (MASTER TABLE), OR TABS 1-5 (GRID)
         ===================================================================== */}
      <main>
        {activeTab === 0 ? (
          <DeliveriesView
            processos={processos}
            onSelectProcess={(proc) => {
              setSelectedAC(null);
              setModalInitialTab('overview');
              setSelectedProcess(proc);
            }}
            isOnlineSynced={isOnlineConnected}
            presentationMode={presentationMode}
            onTogglePresentationMode={() => setPresentationMode(!presentationMode)}
            lastUpdatedTime={lastUpdatedTime}
            sourceFileName={sourceFileName}
          />
        ) : activeTab === 6 ? (
          <DetailedTableView
            processos={filteredProcessos}
            pedidosForecast={pedidosForecast}
            atosConcessorios={filteredAtosConcessorios}
            visibleColumns={visibleColumns}
            onSelectProcess={(proc, subTab = 'overview') => {
              setSelectedAC(null);
              setModalInitialTab(subTab);
              setSelectedProcess(proc);
            }}
            onSelectAC={(ac) => {
              setSelectedProcess(null);
              setSelectedAC(ac);
            }}
            onExportExcel={handleExportExcel}
          />
        ) : (
          <DashboardGrid
            activeTab={activeTab}
            processos={filteredProcessos}
            atosConcessorios={filteredAtosConcessorios}
            onSelectProcess={(proc, subTab = 'overview') => {
              setSelectedAC(null);
              setModalInitialTab(subTab);
              setSelectedProcess(proc);
            }}
            onSelectAC={(ac) => {
              setSelectedProcess(null);
              setSelectedAC(ac);
            }}
          />
        )}
      </main>

      {/* =====================================================================
          INTERACTIVE DETAILS MODAL (#details-modal)
         ===================================================================== */}
      <DetailsModal
        selectedProcess={selectedProcess}
        selectedAC={selectedAC}
        allACs={atosConcessorios}
        allProcessos={processos}
        initialTab={modalInitialTab}
        onClose={() => {
          setSelectedProcess(null);
          setSelectedAC(null);
        }}
        onAssignDrawbackAC={handleAssignDrawbackAC}
        onSendPreAlertaAWB={handleSendPreAlertaAWB}
        onResolveACAmendment={handleResolveACAmendment}
        onSelectProcessFromAC={(proc) => {
          setSelectedAC(null);
          setModalInitialTab('overview');
          setSelectedProcess(proc);
        }}
      />

      {/* =====================================================================
          TOAST NOTIFICATIONS CONTAINER
         ===================================================================== */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-xl border flex items-start gap-3 transition-all ${
              toast.type === 'success'
                ? 'bg-emerald-900/95 border-emerald-500 text-white'
                : toast.type === 'warning'
                ? 'bg-red-900/95 border-red-500 text-white'
                : 'bg-slate-900/95 border-blue-500 text-white'
            }`}
          >
            <i
              className={`fas ${
                toast.type === 'success'
                  ? 'fa-circle-check text-emerald-400'
                  : toast.type === 'warning'
                  ? 'fa-triangle-exclamation text-amber-400'
                  : 'fa-circle-info text-blue-400'
              } text-lg mt-0.5`}
            ></i>
            <div className="flex-1 text-xs">
              <h4 className="font-extrabold">{toast.title}</h4>
              <p className="text-slate-200 mt-0.5 leading-relaxed">{toast.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
