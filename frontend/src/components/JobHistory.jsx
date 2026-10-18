import React, { useState, useMemo } from "react";
import { Search, FileText, Trash2, Eye, CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";

export default function JobHistory({ history, activeJobId, onSelectJob, onDeleteJob }) {
  const [search, setSearch] = useState("");

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    return history.filter((j) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        j.fileName?.toLowerCase().includes(q) ||
        j.id?.toLowerCase().includes(q) ||
        j.status?.toLowerCase().includes(q)
      );
    });
  }, [history, search]);

  if (!history || history.length === 0) return null;

  return (
    <div className="card history-card">
      <div className="card-header-row">
        <div>
          <span className="step-tag">AUDIT TRAIL</span>
          <h2 className="card-heading">Recent Execution History</h2>
          <p className="card-subtext">Click any job to load its validation report and metrics.</p>
        </div>

        <div className="history-search-wrapper">
          <Search size={14} className="history-search-icon" />
          <input
            type="text"
            className="history-search-input"
            placeholder="Filter past jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-responsive">
        <table className="fileflow-table history-table">
          <thead>
            <tr>
              <th>Job Identifier</th>
              <th>Dataset File</th>
              <th>Status</th>
              <th>Records</th>
              <th>Integrity</th>
              <th>Submitted</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-matches-cell">
                  No execution logs match "{search}".
                </td>
              </tr>
            ) : (
              filteredHistory.map((j) => {
                const isActive = activeJobId === j.id;
                const total = j.results?.totalRows;
                const valid = j.results?.validRows;
                const validPct = total && valid !== undefined ? Math.round((valid / total) * 100) : null;

                return (
                  <tr
                    key={j.id}
                    className={`history-row ${isActive ? "active-row" : ""}`}
                    onClick={() => onSelectJob(j)}
                  >
                    <td>
                      <span className="job-id-pill mono">{j.id.slice(0, 14)}...</span>
                    </td>
                    <td>
                      <div className="history-file-cell">
                        <FileText size={15} className="text-muted" />
                        <span className="history-filename" title={j.fileName}>
                          {j.fileName}
                        </span>
                      </div>
                    </td>
                    <td>
                      {j.status === "COMPLETED" && (
                        <span className="status-badge badge-completed">
                          <CheckCircle2 size={12} /> COMPLETED
                        </span>
                      )}
                      {j.status === "PROCESSING" && (
                        <span className="status-badge badge-processing">
                          <Loader2 size={12} className="spin-icon" /> PROCESSING
                        </span>
                      )}
                      {j.status === "QUEUED" && (
                        <span className="status-badge badge-queued">QUEUED</span>
                      )}
                      {j.status === "FAILED" && (
                        <span className="status-badge badge-failed">
                          <AlertOctagon size={12} /> FAILED
                        </span>
                      )}
                    </td>
                    <td className="mono">{total !== undefined ? total.toLocaleString() : "—"}</td>
                    <td>
                      {validPct !== null ? (
                        <span
                          className={`accuracy-chip mono ${
                            validPct >= 90
                              ? "accuracy-high"
                              : validPct >= 70
                              ? "accuracy-med"
                              : "accuracy-low"
                          }`}
                        >
                          {validPct}%
                        </span>
                      ) : (
                        <span className="text-dim">—</span>
                      )}
                    </td>
                    <td className="history-time-cell">{j.submittedAt || "Recent"}</td>
                    <td style={{ textAlign: "right" }}>
                      <div className="history-action-btns" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="history-view-btn"
                          onClick={() => onSelectJob(j)}
                          title="Inspect job results"
                        >
                          <Eye size={14} />
                          <span>Inspect</span>
                        </button>
                        {onDeleteJob && (
                          <button
                            type="button"
                            className="history-delete-btn"
                            onClick={() => onDeleteJob(j.id)}
                            title="Delete this job from audit history"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}