import React, { useRef, useState } from "react";
import { UploadCloud, FileText, X, ArrowRight, Shield, Sparkles, AlertCircle } from "lucide-react";
import { formatBytes } from "../api/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function UploadSection({ onFileSubmit, onLoadSample, isProcessing }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  function validateAndSetFile(selectedFile) {
    setError("");
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      setFile(null);
      setError("Unsupported format. Please select a valid .csv file.");
      return;
    }

    if (selectedFile.size === 0) {
      setFile(null);
      setError("The selected file is empty. Please choose a file with data rows.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError("File exceeds the maximum limit of 10 MB.");
      return;
    }

    setFile(selectedFile);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }

  function handleClear() {
    setFile(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Please choose or drop a CSV file to begin.");
      return;
    }
    onFileSubmit(file);
    handleClear();
  }

  return (
    <div className="card upload-card">
      <div className="card-header-row">
        <div>
          <span className="step-tag">STEP 01</span>
          <h2 className="card-heading">Ingest CSV Dataset</h2>
          <p className="card-subtext">Drop your source file for automated validation and cleaning.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="upload-form">
        <div
          className={`dropzone ${dragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !file && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            className="file-input-hidden"
            accept=".csv,text/csv"
            onChange={(e) => validateAndSetFile(e.target.files?.[0])}
          />

          {file ? (
            <div className="file-selected-box" onClick={(e) => e.stopPropagation()}>
              <div className="file-avatar">
                <FileText size={26} className="text-primary" />
              </div>
              <div className="file-info-group">
                <span className="file-title">{file.name}</span>
                <span className="file-size-badge">
                  {formatBytes(file.size)} · CSV Document · Ready to analyze
                </span>
              </div>
              <button
                type="button"
                className="file-remove-btn"
                onClick={handleClear}
                title="Remove file"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="dropzone-content">
              <div className="upload-icon-circle">
                <UploadCloud size={28} className="upload-cloud-icon" />
              </div>
              <h3 className="dropzone-prompt">Drag & drop your CSV file here</h3>
              <p className="dropzone-subprompt">or click anywhere to browse from your device</p>
              <div className="dropzone-badges">
                <span className="badge-pill">CSV format only</span>
                <span className="badge-pill">Max 10 MB</span>
                <span className="badge-pill">Auto-sniff delimiter</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="error-alert">
            <AlertCircle size={16} className="error-icon" />
            <span>{error}</span>
          </div>
        )}

        <div className="upload-actions-bar">
          <div className="upload-tip">
            <Shield size={14} className="tip-shield text-emerald" />
            <span>Isolated concurrent worker validation</span>
          </div>

          <div className="buttons-cluster">
            {!file && (
              <button
                type="button"
                className="btn-secondary-sample"
                onClick={onLoadSample}
                disabled={isProcessing}
              >
                <Sparkles size={14} className="sample-sparkle" />
                <span>Try Sample CSV</span>
              </button>
            )}

            <button
              type="submit"
              className="btn-primary-upload"
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner-inline" />
                  <span>Processing Dataset...</span>
                </>
              ) : (
                <>
                  <span>Upload & Run Pipeline</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
