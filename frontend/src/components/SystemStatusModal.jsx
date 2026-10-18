import React from "react";
import { X, Server, Database, Layers, Cpu, CheckCircle2, Shield } from "lucide-react";

export default function SystemStatusModal({ isOpen, onClose, systemStatus }) {
  if (!isOpen) return null;

  const isCloudConnected = systemStatus?.cloudEmulator?.connected;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Server size={20} className="text-primary" />
            <div>
              <h3 className="modal-title">Cloud Infrastructure & Worker Telemetry</h3>
              <p className="modal-subtitle">FileFlow Distributed Microservice Architecture</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Status banner */}
          <div className={`system-status-banner ${isCloudConnected ? "banner-live" : "banner-local"}`}>
            {isCloudConnected ? (
              <CheckCircle2 size={20} className="text-emerald" />
            ) : (
              <Shield size={20} className="text-cyan" />
            )}
            <div>
              <strong>
                {isCloudConnected
                  ? "AWS Cloud-Emulation Operational (Floci/LocalStack)"
                  : "Resilient Local Processing Mode Active"}
              </strong>
              <p>
                {isCloudConnected
                  ? "Jobs are dispatched to AWS SQS and persisted in S3 & DynamoDB."
                  : "Zero-config engine enabled: local high-throughput worker handling ingestion & artifacts."}
              </p>
            </div>
          </div>

          {/* Architecture Grid */}
          <div className="architecture-grid">
            <div className="arch-card">
              <div className="arch-card-icon emerald-bg">
                <Database size={18} className="text-emerald" />
              </div>
              <div className="arch-card-info">
                <span className="arch-label">S3 Artifact Storage</span>
                <strong className="arch-value mono">
                  {systemStatus?.resources?.s3Bucket || "fileflow-bucket"}
                </strong>
                <span className="arch-desc">Raw uploads & cleaned CSVs</span>
              </div>
            </div>

            <div className="arch-card">
              <div className="arch-card-icon primary-bg">
                <Layers size={18} className="text-primary" />
              </div>
              <div className="arch-card-info">
                <span className="arch-label">SQS Job Queue</span>
                <strong className="arch-value mono">
                  {systemStatus?.resources?.sqsQueue || "fileflow-jobs-queue"}
                </strong>
                <span className="arch-desc">Decoupled async worker queue</span>
              </div>
            </div>

            <div className="arch-card">
              <div className="arch-card-icon amber-bg">
                <Database size={18} className="text-amber" />
              </div>
              <div className="arch-card-info">
                <span className="arch-label">DynamoDB Metadata</span>
                <strong className="arch-value mono">
                  {systemStatus?.resources?.dynamoDbTable || "fileflow-jobs"}
                </strong>
                <span className="arch-desc">Audit logs & status repository</span>
              </div>
            </div>

            <div className="arch-card">
              <div className="arch-card-icon cyan-bg">
                <Cpu size={18} className="text-cyan" />
              </div>
              <div className="arch-card-info">
                <span className="arch-label">Worker Engine</span>
                <strong className="arch-value mono">
                  {systemStatus?.worker?.engine || "ThreadPool Worker"}
                </strong>
                <span className="arch-desc">
                  Concurrency: {systemStatus?.worker?.concurrency || 4} parallel pipelines
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <span className="version-tag mono">FileFlow v{systemStatus?.version || "1.0.0"}</span>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
