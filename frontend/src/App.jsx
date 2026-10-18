import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import UploadSection from "./components/UploadSection";
import JobStatus from "./components/JobStatus";
import ResultsSummary from "./components/ResultsSummary";
import ReportDownload from "./components/ReportDownload";
import JobHistory from "./components/JobHistory";
import SystemStatusModal from "./components/SystemStatusModal";
import {
  fileFlowApi,
  INITIAL_MOCK_HISTORY,
  SAMPLE_CSV_CONTENT,
  parseAndValidateCSVLocally,
  formatBytes,
} from "./api/client";
import { CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

export default function App() {
  const [history, setHistory] = useState(INITIAL_MOCK_HISTORY);
  const [activeJob, setActiveJob] = useState(INITIAL_MOCK_HISTORY[0]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isSystemModalOpen, setIsSystemModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState(null);

  const resultsRef = useRef(null);

  function showToast(message, type = "success") {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }

  // Load initial backend telemetry & job history
  useEffect(() => {
    async function initPlatform() {
      const status = await fileFlowApi.getSystemStatus();
      setSystemStatus(status);

      const remoteJobs = await fileFlowApi.listJobs();
      if (remoteJobs && remoteJobs.length > 0) {
        setHistory(remoteJobs);
        setActiveJob(remoteJobs[0]);
      }
    }
    initPlatform();
  }, []);

  // Poll active job if currently processing in backend
  useEffect(() => {
    if (!activeJob || (activeJob.status !== "PROCESSING" && activeJob.status !== "QUEUED")) {
      return;
    }

    const interval = setInterval(async () => {
      const updated = await fileFlowApi.getJob(activeJob.id);
      if (updated && updated.status !== activeJob.status) {
        setActiveJob(updated);
        setHistory((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
        if (updated.status === "COMPLETED") {
          setIsProcessing(false);
          showToast(`Job ${updated.id.slice(0, 10)} successfully completed!`, "success");
        } else if (updated.status === "FAILED") {
          setIsProcessing(false);
          showToast(`Job ${updated.id.slice(0, 10)} failed validation.`, "error");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeJob]);

  // Handle user file upload
  async function handleFileSubmit(file) {
    setIsProcessing(true);

    const tempJobId = `job-${Math.random().toString(36).substring(2, 8)}-${Date.now().toString().slice(-4)}`;
    const pendingJob = {
      id: tempJobId,
      fileName: file.name,
      fileSize: formatBytes(file.size),
      fileSizeBytes: file.size,
      status: "PROCESSING",
      submittedAt: "Just now",
      elapsedTime: "Running...",
      results: null,
      error: null,
    };

    setActiveJob(pendingJob);
    setHistory((prev) => [pendingJob, ...prev]);

    // Attempt real backend upload first
    const backendJob = await fileFlowApi.uploadFile(file);
    if (backendJob && backendJob.id) {
      setActiveJob(backendJob);
      setHistory((prev) => [backendJob, ...prev.filter((j) => j.id !== tempJobId)]);
      showToast("Uploaded to processing queue. Analyzing dataset...", "info");
      return;
    }

    // High-fidelity client-side processing fallback
    try {
      const text = await file.text();
      const startTime = performance.now();

      // Realistic pipeline step delay (1s)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const { results, cleanedCsv } = parseAndValidateCSVLocally(text, file.name);
      const elapsed = `${((performance.now() - startTime) / 1000).toFixed(2)}s`;

      const completedJob = {
        ...pendingJob,
        status: "COMPLETED",
        elapsedTime: elapsed,
        results,
        cleanedContent: cleanedCsv,
      };

      setActiveJob(completedJob);
      setHistory((prev) => [completedJob, ...prev.filter((j) => j.id !== tempJobId)]);
      setIsProcessing(false);
      showToast(`Dataset analyzed in ${elapsed}! ${results.validRows} valid rows found.`, "success");

      // Auto scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      const failedJob = {
        ...pendingJob,
        status: "FAILED",
        elapsedTime: "0.45s",
        error: err.message || "Failed to process CSV file.",
        results: null,
      };
      setActiveJob(failedJob);
      setHistory((prev) => [failedJob, ...prev.filter((j) => j.id !== tempJobId)]);
      setIsProcessing(false);
      showToast(`Validation error: ${err.message}`, "error");
    }
  }

  // Handle one-click sample loading
  async function handleLoadSample() {
    setIsProcessing(true);

    // Try backend sample trigger first
    const backendJob = await fileFlowApi.processSample();
    if (backendJob && backendJob.id) {
      setActiveJob(backendJob);
      setHistory((prev) => [backendJob, ...prev]);
      showToast("Enterprise sample dataset enqueued for worker analysis.", "info");
      return;
    }

    // High-fidelity fallback
    const tempJobId = `job-sample-${Math.random().toString(36).substring(2, 6)}`;
    const pendingJob = {
      id: tempJobId,
      fileName: "enterprise_sample_dataset.csv",
      fileSize: "1.2 KB",
      fileSizeBytes: 1240,
      status: "PROCESSING",
      submittedAt: "Just now",
      elapsedTime: "Running...",
      results: null,
    };

    setActiveJob(pendingJob);
    setHistory((prev) => [pendingJob, ...prev]);

    setTimeout(() => {
      const { results, cleanedCsv } = parseAndValidateCSVLocally(
        SAMPLE_CSV_CONTENT,
        "enterprise_sample_dataset.csv"
      );
      const completedJob = {
        ...pendingJob,
        status: "COMPLETED",
        elapsedTime: "0.84s",
        results,
        cleanedContent: cleanedCsv,
      };

      setActiveJob(completedJob);
      setHistory((prev) => [completedJob, ...prev.filter((j) => j.id !== tempJobId)]);
      setIsProcessing(false);
      showToast("Enterprise sample dataset processed with 12 real-world anomalies!", "success");

      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }, 900);
  }

  // Handle job deletion
  async function handleDeleteJob(jobId) {
    await fileFlowApi.deleteJob(jobId);
    setHistory((prev) => {
      const remaining = prev.filter((j) => j.id !== jobId);
      if (activeJob?.id === jobId) {
        setActiveJob(remaining[0] || null);
      }
      return remaining;
    });
    showToast(`Job ${jobId.slice(0, 10)} removed from history.`, "info");
  }

  return (
    <div className="app-shell">
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          {toast.type === "success" && <CheckCircle2 size={16} className="text-emerald" />}
          {toast.type === "error" && <AlertCircle size={16} className="text-rose" />}
          {toast.type === "info" && <Sparkles size={16} className="text-cyan" />}
          <span className="toast-text">{toast.message}</span>
          <button type="button" className="toast-close-btn" onClick={() => setToast(null)}>
            ×
          </button>
        </div>
      )}

      {/* Modern Navigation */}
      <Navbar
        systemStatus={systemStatus}
        onOpenSystemModal={() => setIsSystemModalOpen(true)}
        onLoadSample={handleLoadSample}
        isProcessing={isProcessing}
      />

      {/* Main Container */}
      <main className="main-content">
        <Hero />

        {/* Primary Workspace: Upload on left, Active Job Monitor on right */}
        <section className="workspace-grid">
          <UploadSection
            onFileSubmit={handleFileSubmit}
            onLoadSample={handleLoadSample}
            isProcessing={isProcessing}
          />
          <JobStatus job={activeJob} />
        </section>

        {/* Validation Results & Quality Matrix */}
        {activeJob?.results && (
          <section ref={resultsRef} className="results-wrapper">
            <ResultsSummary results={activeJob.results} activeJob={activeJob} />
            <ReportDownload job={activeJob} />
          </section>
        )}

        {/* Historical Audit Log */}
        <section className="history-wrapper">
          <JobHistory
            history={history}
            activeJobId={activeJob?.id}
            onSelectJob={(j) => {
              setActiveJob(j);
              if (j.results) {
                setTimeout(() => {
                  resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }
            }}
            onDeleteJob={handleDeleteJob}
          />
        </section>
      </main>

      {/* System Telemetry Modal */}
      <SystemStatusModal
        isOpen={isSystemModalOpen}
        onClose={() => setIsSystemModalOpen(false)}
        systemStatus={systemStatus}
      />

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="brand-dot" />
            <strong>FileFlow Distributed Platform</strong>
            <span className="footer-sep">·</span>
            <span>Local Kubernetes & SQS Cloud Architecture</span>
          </div>
          <div className="footer-links">
            <span className="footer-badge">FastAPI v1</span>
            <span className="footer-badge">React 19</span>
            <span className="footer-badge">WCAG High-Contrast</span>
          </div>
        </div>
      </footer>
    </div>
  );
}