import React, { useState } from 'react';
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
}) => {
  const t = TRANSLATIONS[lang];
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showColumnsDropdown, setShowColumnsDropdown] = useState(false);

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
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate">
            <i className={`fas ${icon} mr-1.5 text-blue-600 dark:text-blue-400`}></i>
            {label}
          </label>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, [field]: [] }))}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              ({selected.length}) Limpar
            </button>
          )}
        </div>
        <div className="h-28 overflow-y-auto custom-scrollbar border border-gray-300 dark:border-[#374151] rounded-md bg-gray-50 dark:bg-[#111827] p-1.5 space-y-1">
          {options.map((opt) => {
            const isChecked = selected.includes(opt);
            return (
              <label
                key={opt}
                onClick={() => toggleMultiSelect(field, opt)}
                className={`flex items-center gap-2 px-2 py-1 rounded text-xs cursor-pointer select-none transition-colors ${
                  isChecked
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3 w-3 pointer-events-none"
                />
                <span className="truncate">{opt}</span>
              </label>
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <i className="fas fa-sliders text-blue-600"></i>
            PAINEL DE FILTROS MULTIDIMENSIONAL — MFX COMEX (PROCESSOS & PEDIDOS)
          </h2>
          {activeFilterCount > 0 && (
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              · {activeFilterCount} filtro(s) ativo(s)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 px-2.5 py-1 rounded border border-gray-200 dark:border-gray-700"
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
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <i className="fas fa-folder-open absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={filters.searchProcesso}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchProcesso: e.target.value }))}
                placeholder={t.searchProcessPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative">
              <i className="fas fa-barcode absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                type="text"
                value={filters.searchBlDi}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchBlDi: e.target.value }))}
                placeholder={t.searchBlDiPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-md border border-gray-300 dark:border-[#374151] bg-white dark:bg-[#111827] text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            <div className="flex items-center gap-2 shrink-0 relative">
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
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1.5">
                      {Object.entries(columnLabels).map(([colKey, label]) => (
                        <label
                          key={colKey}
                          className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={visibleColumns[colKey] ?? true}
                            onChange={() => onToggleColumn(colKey)}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
