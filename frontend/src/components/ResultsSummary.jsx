import React, { useState, useMemo } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Copy,
  Table,
  Filter,
  Search,
  FileCheck2,
} from "lucide-react";

export default function ResultsSummary({ results }) {
  const [activeTab, setActiveTab] = useState("issues");
  const [columnFilter, setColumnFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const totalRows = results?.totalRows || 0;
  const validRows = results?.validRows || 0;
  const invalidRows = results?.invalidRows || 0;
  const duplicateRows = results?.duplicateRows || 0;
  const errorBreakdown = useMemo(() => results?.errorBreakdown || [], [results]);
  const columns = useMemo(() => results?.columns || [], [results]);
  const columnCount = results?.columnCount || columns.length;

  const cleanlinessPercentage = totalRows > 0 ? Math.round((validRows / totalRows) * 100) : 0;

  // Extract unique columns present in errors
  const errorColumns = useMemo(() => {
    const set = new Set();
    errorBreakdown.forEach((item) => {
      if (item.column) set.add(item.column);
    });
    return Array.from(set);
  }, [errorBreakdown]);

  // Filtered issues
  const filteredIssues = useMemo(() => {
    return errorBreakdown.filter((item) => {
      const matchCol = columnFilter === "ALL" || item.column === columnFilter;
      const matchSearch =
        !searchQuery ||
        item.issue?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.column?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.value)?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(item.row).includes(searchQuery);
      return matchCol && matchSearch;
    });
  }, [errorBreakdown, columnFilter, searchQuery]);

  if (!results) return null;

  return (
    <div className="card results-card">
      <div className="card-header-row">
        <div>
          <span className="step-tag">AUDIT SUMMARY</span>
          <h2 className="card-heading">Data Quality Intelligence</h2>
          <p className="card-subtext">Comprehensive schema conformity, integrity, and anomaly audit.</p>
        </div>

        {/* Quality Health Score Pill */}
        <div className="health-score-container">
          <div className="health-score-text-group">
            <span className="health-score-label">DATA INTEGRITY</span>
            <span className="health-score-value text-emerald">{cleanlinessPercentage}%</span>
          </div>
          <div className="health-score-bar-bg">
            <div
              className="health-score-bar-fill"
              style={{
                width: `${cleanlinessPercentage}%`,
                background:
                  cleanlinessPercentage >= 90
                    ? "linear-gradient(90deg, #10b981, #06b6d4)"
                    : cleanlinessPercentage >= 70
                    ? "linear-gradient(90deg, #f59e0b, #10b981)"
                    : "linear-gradient(90deg, #f43f5e, #f59e0b)",
              }}
            />
          </div>
        </div>
      </div>

      {/* 4 High-Contrast KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-card-header">
            <span className="stat-title">Total Records</span>
            <Table size={18} className="stat-card-icon text-cyan" />
          </div>
          <div className="stat-number-wrapper">
            <span className="stat-number mono">{totalRows.toLocaleString()}</span>
            <span className="stat-subtext">{columnCount} columns</span>
          </div>
        </div>

        <div className="stat-card stat-valid">
          <div className="stat-card-header">
            <span className="stat-title">Valid Records</span>
            <CheckCircle size={18} className="stat-card-icon text-emerald" />
          </div>
          <div className="stat-number-wrapper">
            <span className="stat-number text-emerald mono">{validRows.toLocaleString()}</span>
            <span className="stat-pill-badge badge-emerald">
              {cleanlinessPercentage}% passed
            </span>
          </div>
        </div>

        <div className="stat-card stat-invalid">
          <div className="stat-card-header">
            <span className="stat-title">Invalid Records</span>
            <AlertTriangle size={18} className="stat-card-icon text-rose" />
          </div>
          <div className="stat-number-wrapper">
            <span className="stat-number text-rose mono">{invalidRows.toLocaleString()}</span>
            <span className="stat-pill-badge badge-rose">
              {totalRows > 0 ? ((invalidRows / totalRows) * 100).toFixed(1) : 0}% flawed
            </span>
          </div>
        </div>

        <div className="stat-card stat-duplicate">
          <div className="stat-card-header">
            <span className="stat-title">Duplicates Purged</span>
            <Copy size={18} className="stat-card-icon text-amber" />
          </div>
          <div className="stat-number-wrapper">
            <span className="stat-number text-amber mono">{duplicateRows.toLocaleString()}</span>
            <span className="stat-pill-badge badge-amber">Auto-deduped</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="results-tab-bar">
        <button
          type="button"
          className={`tab-btn ${activeTab === "issues" ? "active" : ""}`}
          onClick={() => setActiveTab("issues")}
        >
          <AlertTriangle size={15} />
          <span>Detected Anomalies</span>
          <span className="tab-count-pill">{errorBreakdown.length}</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "schema" ? "active" : ""}`}
          onClick={() => setActiveTab("schema")}
        >
          <FileCheck2 size={15} />
          <span>Schema & Columns</span>
          <span className="tab-count-pill">{columns.length}</span>
        </button>
      </div>

      {/* Tab 1: Issues Explorer */}
      {activeTab === "issues" && (
        <div className="issues-explorer-section">
          {errorBreakdown.length === 0 ? (
            <div className="clean-dataset-celebration">
              <CheckCircle size={42} className="text-emerald" />
              <h3>Flawless Dataset!</h3>
              <p>No schema violations, missing values, or format anomalies were identified.</p>
            </div>
          ) : (
            <>
              {/* Filter controls */}
              <div className="issues-filter-bar">
                <div className="search-box">
                  <Search size={15} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search issues, rows, or values..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="search-clear-btn"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="filter-dropdown-box">
                  <Filter size={15} className="filter-icon" />
                  <select
                    value={columnFilter}
                    onChange={(e) => setColumnFilter(e.target.value)}
                    className="filter-select"
                  >
                    <option value="ALL">All Columns ({errorBreakdown.length})</option>
                    {errorColumns.map((col) => (
                      <option key={col} value={col}>
                        Column: {col}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* High-Contrast Table */}
              <div className="table-responsive">
                <table className="fileflow-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>Row</th>
                      <th style={{ width: "170px" }}>Column Field</th>
                      <th>Issue Description</th>
                      <th>Offending Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssues.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="no-matches-cell">
                          No issues match the active search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredIssues.map((item, idx) => (
                        <tr key={idx} className="issue-row">
                          <td>
                            <span className="row-badge mono">#{item.row}</span>
                          </td>
                          <td>
                            <span className="column-chip mono">{item.column}</span>
                          </td>
                          <td className="issue-desc-cell">
                            <span className="issue-desc-text">{item.issue}</span>
                          </td>
                          <td>
                            <span className="bad-value-chip mono" title={String(item.value)}>
                              {item.value !== undefined && item.value !== null && item.value !== ""
                                ? String(item.value)
                                : "null"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Schema & Columns */}
      {activeTab === "schema" && (
        <div className="schema-view-section">
          <div className="columns-grid">
            {columns.map((col, idx) => {
              const issuesInCol = errorBreakdown.filter((i) => i.column === col).length;
              return (
                <div key={idx} className="column-metric-card">
                  <div className="col-header">
                    <span className="col-index mono">#{idx + 1}</span>
                    <strong className="col-name mono">{col}</strong>
                  </div>
                  <div className="col-footer">
                    {issuesInCol > 0 ? (
                      <span className="col-error-tag text-rose">
                        <AlertTriangle size={12} /> {issuesInCol} anomalies
                      </span>
                    ) : (
                      <span className="col-clean-tag text-emerald">
                        <CheckCircle size={12} /> 100% Valid
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}