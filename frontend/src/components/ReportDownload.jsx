import React, { useState } from "react";
import { Download, FileSpreadsheet, FileJson, Copy, Check, Sparkles } from "lucide-react";
import { fileFlowApi } from "../api/client";

export default function ReportDownload({ job }) {
  const [copied, setCopied] = useState(false);
  const [downloadingCleaned, setDownloadingCleaned] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  if (!job || job.status !== "COMPLETED") return null;

  async function handleDownloadCleaned() {
    setDownloadingCleaned(true);
    try {
      await fileFlowApi.downloadCleaned(job);
    } finally {
      setTimeout(() => setDownloadingCleaned(false), 800);
    }
  }

  async function handleDownloadReport() {
    setDownloadingReport(true);
    try {
      await fileFlowApi.downloadReport(job);
    } finally {
      setTimeout(() => setDownloadingReport(false), 800);
    }
  }

  function handleCopyJson() {
    const reportData = {
      jobId: job.id,
      fileName: job.fileName,
      status: job.status,
      elapsedTime: job.elapsedTime,
      submittedAt: job.submittedAt,
      results: job.results,
    };
    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const validCount = job.results?.validRows ?? "—";

  return (
    <div className="card download-card">
      <div className="card-header-row">
        <div>
          <span className="step-tag">OUTPUT ARTIFACTS</span>
          <h2 className="card-heading">Export Cleaned Data & Audit Log</h2>
          <p className="card-subtext">
            Ready-to-ingest sanitized dataset and full cryptographic schema compliance audit report.
          </p>
        </div>
        <div className="ready-records-pill">
          <Sparkles size={14} className="text-emerald" />
          <span>{validCount} Sanitized Records Ready</span>
        </div>
      </div>

      <div className="download-actions-grid">
        <button
          type="button"
          className="btn-download-primary"
          onClick={handleDownloadCleaned}
          disabled={downloadingCleaned}
        >
          <div className="download-btn-icon-box emerald-bg">
            <FileSpreadsheet size={22} className="text-emerald" />
          </div>
          <div className="download-btn-text">
            <span className="download-btn-title">Download Cleaned CSV</span>
            <span className="download-btn-sub">Deduplicated · Normalized · Cleaned</span>
          </div>
          <Download size={18} className="download-action-arrow" />
        </button>

        <button
          type="button"
          className="btn-download-secondary"
          onClick={handleDownloadReport}
          disabled={downloadingReport}
        >
          <div className="download-btn-icon-box primary-bg">
            <FileJson size={22} className="text-primary" />
          </div>
          <div className="download-btn-text">
            <span className="download-btn-title">Download Audit Report (JSON)</span>
            <span className="download-btn-sub">Detailed row-by-row violation matrix</span>
          </div>
          <Download size={18} className="download-action-arrow" />
        </button>

        <button
          type="button"
          className="btn-download-tertiary"
          onClick={handleCopyJson}
          title="Copy JSON to clipboard"
        >
          <div className="download-btn-icon-box cyan-bg">
            {copied ? (
              <Check size={22} className="text-emerald" />
            ) : (
              <Copy size={22} className="text-cyan" />
            )}
          </div>
          <div className="download-btn-text">
            <span className="download-btn-title">
              {copied ? "JSON Copied!" : "Copy Report JSON"}
            </span>
            <span className="download-btn-sub">Instant paste to clipboard</span>
          </div>
        </button>
      </div>
    </div>
  );
}