import React, { useState } from "react";
import { Copy, Check, Clock, FileSpreadsheet, HardDrive, CheckCircle2, AlertOctagon, Loader2 } from "lucide-react";

export default function JobStatus({ job }) {
  const [copied, setCopied] = useState(false);

  if (!job) {
    return (
      <div className="card job-status-card empty-status">
        <div className="empty-status-inner">
          <FileSpreadsheet size={36} className="empty-icon text-muted" />
          <h3 className="empty-title">No Active Job Selected</h3>
          <p className="empty-desc">
            Upload a CSV or select a job from the history log to inspect real-time metrics.
          </p>
        </div>
      </div>
    );
  }

  const isCompleted = job.status === "COMPLETED";
  const isProcessing = job.status === "PROCESSING" || job.status === "QUEUED";
  const isFailed = job.status === "FAILED";

  function handleCopyId() {
    navigator.clipboard.writeText(job.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Pipeline stages calculation
  const stages = [
    { name: "Ingestion", done: true, current: false },
    { name: "Schema & Types", done: isCompleted, current: isProcessing },
    { name: "Deduplication", done: isCompleted, current: false },
    { name: "Artifacts Ready", done: isCompleted, current: false, failed: isFailed },
  ];

  return (
    <div className={`card job-status-card status-${job.status?.toLowerCase()}`}>
      <div className="card-header-row">
        <div>
          <span className="step-tag">JOB MONITOR</span>
          <div className="job-id-header">
            <h2 className="card-heading mono">{job.id}</h2>
            <button
              type="button"
              className="copy-id-btn"
              onClick={handleCopyId}
              title="Copy Job ID"
            >
              {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        <div className="status-badge-container">
          {isProcessing && (
            <span className="status-badge badge-processing">
              <Loader2 size={13} className="spin-icon" />
              <span>{job.status === "QUEUED" ? "QUEUED" : "PROCESSING"}</span>
            </span>
          )}
          {isCompleted && (
            <span className="status-badge badge-completed">
              <CheckCircle2 size={13} />
              <span>COMPLETED</span>
            </span>
          )}
          {isFailed && (
            <span className="status-badge badge-failed">
              <AlertOctagon size={13} />
              <span>FAILED</span>
            </span>
          )}
        </div>
      </div>

      {/* Visual Pipeline Progression */}
      <div className="pipeline-stepper">
        <div className="pipeline-track">
          {stages.map((stage, idx) => (
            <div
              key={idx}
              className={`pipeline-step ${stage.done ? "step-done" : ""} ${
                stage.current ? "step-current" : ""
              } ${stage.failed ? "step-failed" : ""}`}
            >
              <div className="step-node">
                {stage.done ? (
                  <Check size={12} strokeWidth={3} />
                ) : stage.current ? (
                  <span className="step-spinner" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span className="step-text">{stage.name}</span>
            </div>
          ))}
        </div>
        {isProcessing && <div className="pipeline-shimmer-bar" />}
      </div>

      {/* Meta Grid */}
      <div className="job-meta-grid">
        <div className="meta-tile">
          <div className="meta-tile-label">
            <FileSpreadsheet size={13} />
            <span>Dataset File</span>
          </div>
          <p className="meta-tile-value" title={job.fileName}>{job.fileName}</p>
        </div>

        <div className="meta-tile">
          <div className="meta-tile-label">
            <HardDrive size={13} />
            <span>File Size</span>
          </div>
          <p className="meta-tile-value">{job.fileSize || "Unknown"}</p>
        </div>

        <div className="meta-tile">
          <div className="meta-tile-label">
            <Clock size={13} />
            <span>Execution Time</span>
          </div>
          <p className="meta-tile-value text-cyan mono">
            {job.elapsedTime || (isProcessing ? "Processing..." : "—")}
          </p>
        </div>

        <div className="meta-tile">
          <div className="meta-tile-label">
            <CheckCircle2 size={13} />
            <span>Submitted</span>
          </div>
          <p className="meta-tile-value">{job.submittedAt || "Just now"}</p>
        </div>
      </div>

      {/* Error notification if failed */}
      {job.error && (
        <div className="job-error-box">
          <AlertOctagon size={18} className="error-box-icon text-rose" />
          <div className="error-box-content">
            <strong className="error-box-title">Execution Interrupted:</strong>
            <p className="error-box-message">{job.error}</p>
          </div>
        </div>
      )}
    </div>
  );
}