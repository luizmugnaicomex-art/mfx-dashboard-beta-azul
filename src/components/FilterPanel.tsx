import React, { useState, useRef, useEffect } from 'react';
import { FilterState, LanguageCode } from '../types/mfx';
import { TRANSLATIONS } from '../data/mfxData';

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  availablePOs: string[];
  availableSuppliers: string[];
  availableACs: string[];
  visibleColumns: Record<string, boolean>;
  onToggleColumn: (colKey: string) => void;
  columnLabels: Record<string, string>;
  lang: LanguageCode;
  activeFilterCount: number;
  totalCount: number;
  filteredCount: number;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  setFilters,
  onApplyFilters,
  onClearFilters,
  availablePOs,
  availableSuppliers,
  availableACs,
  visibleColumns,
  onToggleColumn,
  columnLabels,
  lang,
  activeFilterCount,
  totalCount,
  filteredCount,
}) => {
  const t = TRANSLATIONS[lang];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close columns dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowColumnsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMultiSelect = (field: keyof FilterState, value: string) => {
    setFilters((prev) => {
      const current = prev[field] as string[];
      const exists = current.includes(value);
      const updated = exists ? current.filter((item) => item !== value) : [...current, value];
      return { ...prev, [field]: updated };
    });
  };

  const renderMultiSelectBox = (
    label: string,
    icon: string,
    field: keyof FilterState,
    options: string[]
  ) => {
    const selected = filters[field] as string[];
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
            <i className={`fas ${icon} mr-1.5 text-blue-600 dark:text-blue-400`}></i>
            {label}
          </span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, [field]: [] }))}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              ({selected.length}) Limpar
            </button>
          )}
        </div>
        <div
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="h-32 overflow-y-auto custom-scrollbar border border-gray-300 dark:border-[#374151] rounded-md bg-gray-50 dark:bg-[#111827] p-1.5 space-y-1"
        >
          {options.map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isChecked}
                onClick={() => toggleMultiSelect(field, opt)}
                className={`w-full flex items-center gap-2 px-2 py-1 rounded text-xs text-left cursor-pointer select-none transition-colors ${
                  isChecked
                    ? 'bg-blue-600 text-white font-semibold shadow-2xs'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <i
                  className={`${
                    isChecked
                      ? 'fas fa-square-check text-white'
                      : 'far fa-square text-gray-400 dark:text-gray-500'
                  } text-xs shrink-0`}
                ></i>
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section
      id="filter-container"
      className="bg-white dark:bg-[#1f2937] p-6 rounded-lg shadow mb-6 border border-gray-200 dark:border-[#374151]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <i className="fas fa-sliders text-blue-600"></i>
            PAINEL DE FILTROS MULTIDIMENSIONAL — MFX COMEX (PROCESSOS & PEDIDOS)
          </h2>
          <span className="text-xs font-mono font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
            · Exibindo <strong className="text-blue-600 dark:text-blue-400">{filteredCount}</strong> de{' '}
            <strong>{totalCount}</strong> processos
          </span>
          {activeFilterCount > 0 && (
            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              · {activeFilterCount} filtro(s) ativo(s)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700 cursor-pointer"
        >
          <i className={`fas ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`}></i>
          {isCollapsed ? 'Expandir Filtros' : 'Recolher Filtros'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* ROW 1: 7 Multi-Select Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-4">
            {renderMultiSelectBox(t.filterPOs, 'fa-file-invoice', 'pos', availablePOs)}
            {renderMultiSelectBox(t.filterProjects, 'fa-oil-well', 'projetos', [
              'PETROBRAS',
              'PRIO',
              'ESTOQUE',
              'EXPANSÃO 140 CNTR',
            ])}
            {renderMultiSelectBox(t.filterStatus, 'fa-bars-progress', 'status', [
              'Em Produção Fornecedor',
              'Ag. Embarque',
              'Em Trânsito',
              'No Porto/Aeroporto',
              'Parado Ag. Drawback',
              'Desembaraçado',
              'Entregue MFX',
            ])}
            {renderMultiSelectBox(t.filterModalIncoterm, 'fa-ship', 'modalIncoterm', [
              'MARÍTIMO',
              'AÉREO',
              'FCA',
              'FOB',
              'CIF',
              'EXW',
              'CPT',
              'DAP',
            ])}
            {renderMultiSelectBox(t.filterRegimeAC, 'fa-shield-halved', 'regimeAC', [
              'Drawback Suspensão',
              'Recolhimento Integral',
              'Ex-Tarifário',
              ...availableACs,
            ])}
            {renderMultiSelectBox(t.filterSupplier, 'fa-industry', 'fornecedores', availableSuppliers)}
            {renderMultiSelectBox(t.filterBroker, 'fa-user-tie', 'agentes', [
              'ÔMEGA',
              'DSV',
              'DHL',
              'KN',
              'FEDEX',
              'Hellmann',
            ])}
          </div>

          {/* ROW 2: Quick Search Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={filters.searchPO}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchPO: e.target.value }))}
                placeholder={t.searchPOPlaceholder}
                className="w-full pl-8 pr-7 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {filters.searchPO && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, searchPO: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            <div className="relative">
              <i className="fas fa-folder-open absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={filters.searchProcesso}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchProcesso: e.target.value }))}
                placeholder={t.searchProcessPlaceholder}
                className="w-full pl-8 pr-7 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {filters.searchProcesso && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, searchProcesso: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
            <div className="relative">
              <i className="fas fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={filters.searchBlDi}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchBlDi: e.target.value }))}
                placeholder={t.searchBlDiPlaceholder}
                className="w-full pl-8 pr-7 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {filters.searchBlDi && (
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, searchBlDi: '' }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>

          {/* ROW 3: Date Ranges & Action Buttons */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-end justify-between gap-4 pt-2 border-t border-gray-100 dark:border-gray-700/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  <i className="fas fa-calendar-day mr-1 text-blue-600"></i>
                  {t.etaRangeLabel} (Início / Fim)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.etaStart}
                    onChange={(e) => setFilters((prev) => ({ ...prev, etaStart: e.target.value }))}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 tabular-nums"
                  />
                  <input
                    type="date"
                    value={filters.etaEnd}
                    onChange={(e) => setFilters((prev) => ({ ...prev, etaEnd: e.target.value }))}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                  <i className="fas fa-money-bill-transfer mr-1 text-emerald-600"></i>
                  {t.cashflowRangeLabel} (Início / Fim)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.cashflowStart}
                    onChange={(e) => setFilters((prev) => ({ ...prev, cashflowStart: e.target.value }))}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 tabular-nums"
                  />
                  <input
                    type="date"
                    value={filters.cashflowEnd}
                    onChange={(e) => setFilters((prev) => ({ ...prev, cashflowEnd: e.target.value }))}
                    className="px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons: Filtrar, Limpar, Colunas */}
            <div className="flex items-center gap-2 shrink-0 relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={onApplyFilters}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fas fa-filter"></i>
                {t.btnFilter}
              </button>

              <button
                type="button"
                onClick={onClearFilters}
                className="bg-gray-500 hover:bg-gray-600 text-white font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <i className="fas fa-eraser"></i>
                {t.btnClear}
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnsDropdown(!showColumnsDropdown)}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2 rounded-md shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <i className="fas fa-table-columns"></i>
                  {t.btnColumns}
                </button>

                {showColumnsDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-[#374151] rounded-lg shadow-xl z-40 p-3">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                        Colunas Visíveis (Planilha)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowColumnsDropdown(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1.5">
                      {Object.entries(columnLabels).map(([colKey, label]) => {
                        const checked = visibleColumns[colKey] ?? true;
                        return (
                          <button
                            key={colKey}
                            type="button"
                            onClick={() => onToggleColumn(colKey)}
                            className="w-full flex items-center gap-2 text-xs text-left text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
                          >
                            <i
                              className={`${
                                checked ? 'fas fa-square-check text-teal-600' : 'far fa-square text-gray-400'
                              }`}
                            ></i>
                            <span>{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 4: Quick Executive Filter Shortcuts */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mr-1">
              <i className="fas fa-bolt text-amber-500 mr-1"></i>Atalhos Rápidos:
            </span>
            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  status:
                    prev.status.length === 1 && prev.status[0] === 'Parado Ag. Drawback'
                      ? []
                      : ['Parado Ag. Drawback'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.status.includes('Parado Ag. Drawback') && filters.status.length === 1
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              9 Cargas Paradas (Drawback)
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  modalIncoterm:
                    prev.modalIncoterm.length === 1 && prev.modalIncoterm[0] === 'AÉREO'
                      ? []
                      : ['AÉREO'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.modalIncoterm.includes('AÉREO') && filters.modalIncoterm.length === 1
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Embarques Aéreos (TECA)
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  regimeAC:
                    prev.regimeAC.length === 1 && prev.regimeAC[0] === 'Recolhimento Integral'
                      ? []
                      : ['Recolhimento Integral'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.regimeAC.includes('Recolhimento Integral') && filters.regimeAC.length === 1
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Recolhimento Integral (Auditoria Vazamento)
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  projetos:
                    prev.projetos.length === 1 && prev.projetos[0] === 'EXPANSÃO 140 CNTR'
                      ? []
                      : ['EXPANSÃO 140 CNTR'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.projetos.includes('EXPANSÃO 140 CNTR') && filters.projetos.length === 1
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Projeto Expansão 140 CNTR
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  projetos:
                    prev.projetos.length === 1 && prev.projetos[0] === 'PETROBRAS'
                      ? []
                      : ['PETROBRAS'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.projetos.includes('PETROBRAS') && filters.projetos.length === 1
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Projeto PETROBRAS
            </button>

            <button
              type="button"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  projetos:
                    prev.projetos.length === 1 && prev.projetos[0] === 'PRIO' ? [] : ['PRIO'],
                }))
              }
              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                filters.projetos.includes('PRIO') && filters.projetos.length === 1
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
              }`}
            >
              Projeto PRIO
            </button>
          </div>
        </>
      )}
    </section>
  );
};
