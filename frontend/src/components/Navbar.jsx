import React from "react";
import { Server, Sparkles } from "lucide-react";

export default function Navbar({ systemStatus, onOpenSystemModal, onLoadSample, isProcessing }) {
  const isOnline = systemStatus?.cloudEmulator?.connected || systemStatus?.online;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand" href="/" aria-label="FileFlow home">
          <div className="brand-icon-wrapper">
            <span className="brand-icon">F</span>
          </div>
          <div className="brand-text-group">
            <span className="brand-title">FileFlow</span>
            <span className="brand-badge">PRO PIPELINE</span>
          </div>
        </a>

        <div className="topbar-actions">
          {/* Quick sample trigger */}
          <button
            type="button"
            className="sample-quick-btn"
            onClick={onLoadSample}
            disabled={isProcessing}
            title="Load enterprise sample CSV with realistic anomalies"
          >
            <Sparkles size={15} className="sparkle-icon" />
            <span>Load Sample Dataset</span>
          </button>

          {/* Cloud / Environment Status Pill */}
          <button
            type="button"
            className="env-status-pill"
            onClick={onOpenSystemModal}
            title="Click to view Cloud & Worker architecture details"
          >
            <span className={`status-indicator-dot ${isOnline ? "live" : "local"}`} />
            <span className="env-status-text">
              {isOnline ? "AWS Emulated (Live)" : "Local Engine Ready"}
            </span>
            <Server size={14} className="server-icon" />
          </button>
        </div>
      </div>
    </header>
  );
}
