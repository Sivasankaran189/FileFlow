import React from "react";
import { ShieldCheck, Zap, FileSpreadsheet, Layers } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-eyebrow">
        <span className="eyebrow-dot" />
        <span className="eyebrow-text">CLOUD-SCALE ASYNCHRONOUS DATA PIPELINE</span>
      </div>

      <h1 className="hero-title">
        Turn raw CSVs into{" "}
        <span className="hero-gradient-text">audit-grade validated data.</span>
      </h1>

      <p className="hero-description">
        Detect malformed records, eliminate duplicates, enforce numeric constraints,
        and generate instantaneous audit artifacts with sub-second latency.
      </p>

      <div className="hero-tags">
        <div className="hero-tag">
          <ShieldCheck size={14} className="tag-icon text-emerald" />
          <span>Strict Schema Checks</span>
        </div>
        <div className="hero-tag">
          <Zap size={14} className="tag-icon text-cyan" />
          <span>Concurrent Worker Engine</span>
        </div>
        <div className="hero-tag">
          <FileSpreadsheet size={14} className="tag-icon text-primary" />
          <span>Auto Deduplication</span>
        </div>
        <div className="hero-tag">
          <Layers size={14} className="tag-icon text-amber" />
          <span>Downloadable Cleaned CSV & JSON</span>
        </div>
      </div>
    </section>
  );
}
