// FileFlow API Client & Resilient Data Layer
// Seamlessly connects to FastAPI backend (/api/v1) with intelligent local fallback

const API_BASE = "/api/v1";

// Embedded enterprise sample dataset for instant zero-dependency testing
export const SAMPLE_CSV_CONTENT = `transaction_id,customer_name,email,amount,quantity,status,created_at
tx_1001,Sophia Bennett,sophia.bennett@example.com,249.50,2,COMPLETED,2026-03-15T09:30:00Z
tx_1002,Liam Gallagher,liam_gallagher_at_domain,120.00,1,PENDING,2026-03-15T10:14:22Z
tx_1003,Emma Watson,emma.w@corporate.co,-45.00,3,COMPLETED,2026-03-15T11:05:10Z
tx_1004,Noah Patel,noah.patel@webmail.org,89.90,five,FAILED,2026-03-15T11:45:00Z
tx_1005,Olivia Chen,,560.25,4,COMPLETED,2026-03-15T12:00:19Z
tx_1006,Lucas Rodriguez,lucas.r@technova.io,310.00,1,COMPLETED,2026-03-15T13:21:40Z
tx_1006,Lucas Rodriguez,lucas.r@technova.io,310.00,1,COMPLETED,2026-03-15T13:21:40Z
tx_1007,Aria Montgomery,aria.m@designstudio.net,1420.00,6,COMPLETED,2026/99/99
tx_1008,Ethan Vance,ethan.vance@acme.org,75.50,1,COMPLETED,2026-03-16T08:12:30Z
tx_1009,Mia Tanaka,mia.tanaka@tokyotech.jp,430.00,2,COMPLETED,2026-03-16T09:40:11Z
tx_1010,Alexander Wright,alex.wright@venture.co,99.95,null,PENDING,2026-03-16T10:15:00Z
tx_1011,Charlotte Davis,charlotte.d@horizon.io,815.00,5,COMPLETED,2026-03-16T11:22:45Z`;

export const INITIAL_MOCK_HISTORY = [
  {
    id: "job-8f921a-2026",
    fileName: "q3_transactions.csv",
    fileSize: "4.2 MB",
    fileSizeBytes: 4404019,
    status: "COMPLETED",
    submittedAt: "12 mins ago",
    elapsedTime: "2.42s",
    results: {
      totalRows: 1250,
      validRows: 1180,
      invalidRows: 50,
      duplicateRows: 20,
      columnCount: 5,
      columns: ["transaction_id", "email", "amount", "quantity", "created_at"],
      errorBreakdown: [
        { row: 14, column: "email", issue: "Malformed email address format", value: "user_at_domain" },
        { row: 42, column: "amount", issue: "Negative amount not allowed", value: "-45.00" },
        { row: 89, column: "created_at", issue: "Invalid ISO 8601 timestamp", value: "2026/13/45" },
        { row: 112, column: "quantity", issue: "Expected integer, received string", value: "ten" },
        { row: 148, column: "email", issue: "Missing or null value in record", value: "null" },
      ],
    },
  },
  {
    id: "job-3a47c0-2026",
    fileName: "customer_leads.csv",
    fileSize: "1.1 MB",
    fileSizeBytes: 1153433,
    status: "FAILED",
    submittedAt: "1 hour ago",
    elapsedTime: "0.80s",
    error: "Missing required column: 'account_id'",
    results: null,
  },
];

export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Client-side validator engine matching the Python backend rules
export function parseAndValidateCSVLocally(csvText, _filename) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) throw new Error("CSV file is empty.");

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
  if (lines.length === 1) throw new Error("CSV contains headers but no data records.");

  const dataRows = lines.slice(1);
  const totalRows = dataRows.length;
  const seenRows = new Set();
  const invalidRowIndices = new Set();
  const errorBreakdown = [];
  const cleanedRows = [headers.join(",")];

  const emailRegex = /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
  const positiveNumCols = ["amount", "price", "quantity", "qty", "count", "age", "total", "cost"];
  const dateCols = ["date", "created_at", "updated_at", "timestamp"];

  let duplicateCount = 0;

  dataRows.forEach((rowStr, idx) => {
    const rowNumber = idx + 2; // Line in original file
    const isDuplicate = seenRows.has(rowStr.trim());
    if (isDuplicate) {
      duplicateCount++;
      invalidRowIndices.add(idx);
      if (errorBreakdown.length < 50) {
        errorBreakdown.push({
          row: rowNumber,
          column: "(Entire Record)",
          issue: "Duplicate row identical to a preceding record",
          value: "Duplicate",
        });
      }
    } else {
      seenRows.add(rowStr.trim());
    }

    const cells = rowStr.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));

    headers.forEach((header, colIdx) => {
      const val = cells[colIdx] ?? "";
      const hLower = header.toLowerCase();

      // Check 1: Missing or null
      if (val === "" || ["null", "none", "nan", "undefined", "n/a"].includes(val.toLowerCase())) {
        invalidRowIndices.add(idx);
        if (errorBreakdown.length < 50) {
          errorBreakdown.push({
            row: rowNumber,
            column: header,
            issue: "Missing or null value in record",
            value: val || "null",
          });
        }
        return;
      }

      // Check 2: Email format
      if (hLower.includes("email") || hLower.includes("mail")) {
        if (!emailRegex.test(val)) {
          invalidRowIndices.add(idx);
          if (errorBreakdown.length < 50) {
            errorBreakdown.push({
              row: rowNumber,
              column: header,
              issue: "Malformed email address format",
              value: val,
            });
          }
        }
      }

      // Check 3: Numeric constraints
      if (positiveNumCols.some((k) => hLower.includes(k))) {
        const cleanNum = val.replace(/[$ ,]/g, "");
        const num = Number(cleanNum);
        if (isNaN(num)) {
          invalidRowIndices.add(idx);
          if (errorBreakdown.length < 50) {
            errorBreakdown.push({
              row: rowNumber,
              column: header,
              issue: "Expected numeric value, received text",
              value: val,
            });
          }
        } else if (num < 0) {
          invalidRowIndices.add(idx);
          if (errorBreakdown.length < 50) {
            errorBreakdown.push({
              row: rowNumber,
              column: header,
              issue: "Negative numeric value not permitted",
              value: val,
            });
          }
        }
      }

      // Check 4: Date sanity
      if (dateCols.some((k) => hLower.includes(k))) {
        const isLikelyDate = /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(val);
        const parsed = Date.parse(val);
        if (!isLikelyDate || isNaN(parsed)) {
          invalidRowIndices.add(idx);
          if (errorBreakdown.length < 50) {
            errorBreakdown.push({
              row: rowNumber,
              column: header,
              issue: "Invalid timestamp / date format",
              value: val,
            });
          }
        }
      }
    });

    if (!isDuplicate) {
      cleanedRows.push(cells.join(","));
    }
  });

  const invalidRows = invalidRowIndices.size;
  const validRows = Math.max(0, totalRows - invalidRows);

  return {
    results: {
      totalRows,
      validRows,
      invalidRows,
      duplicateRows: duplicateCount,
      columns: headers,
      columnCount: headers.length,
      errorBreakdown,
    },
    cleanedCsv: cleanedRows.join("\n"),
  };
}

export const fileFlowApi = {
  // Check backend health
  async checkBackendStatus() {
    try {
      const res = await fetch("/health", { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const data = await res.json();
        return { online: true, ...data };
      }
    } catch {
      // Backend not running on 8000
    }
    return { online: false, mode: "Resilient Local Sandbox" };
  },

  // Fetch full system architecture status
  async getSystemStatus() {
    try {
      const res = await fetch(`${API_BASE}/system/status`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return await res.json();
    } catch {}
    return {
      service: "FileFlow",
      version: "1.0.0",
      cloudEmulator: {
        endpoint: "http://localhost:4566",
        connected: false,
        mode: "Resilient Browser Sandbox (Zero-Config)",
      },
      resources: {
        s3Bucket: "fileflow-bucket",
        sqsQueue: "fileflow-jobs-queue",
        dynamoDbTable: "fileflow-jobs",
      },
      worker: {
        engine: "Concurrent Async Worker",
        concurrency: 4,
        status: "ready",
      },
    };
  },

  // Fetch jobs list
  async listJobs() {
    try {
      const res = await fetch(`${API_BASE}/jobs`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  // Upload and process CSV
  async uploadFile(file) {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/jobs/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  // Trigger sample enterprise processing
  async processSample() {
    try {
      const res = await fetch(`${API_BASE}/jobs/sample`, {
        method: "POST",
      });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  // Get job status
  async getJob(jobId) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return await res.json();
    } catch {}
    return null;
  },

  // Download cleaned file
  async downloadCleaned(job) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}/download/cleaned`);
      if (res.ok) {
        const blob = await res.blob();
        triggerBlobDownload(blob, `cleaned_${job.fileName}`);
        return true;
      }
    } catch {}

    // Fallback if backend artifact not stored
    if (job.cleanedContent) {
      const blob = new Blob([job.cleanedContent], { type: "text/csv;charset=utf-8;" });
      triggerBlobDownload(blob, `cleaned_${job.fileName}`);
      return true;
    }
    return false;
  },

  // Download audit report
  async downloadReport(job) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${job.id}/download/report`);
      if (res.ok) {
        const blob = await res.blob();
        triggerBlobDownload(blob, `audit_report_${job.id}.json`);
        return true;
      }
    } catch {}

    // Fallback JSON generation
    const reportData = {
      jobId: job.id,
      fileName: job.fileName,
      fileSize: job.fileSize,
      status: job.status,
      submittedAt: job.submittedAt,
      elapsedTime: job.elapsedTime,
      results: job.results,
      error: job.error,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    triggerBlobDownload(blob, `audit_report_${job.id}.json`);
    return true;
  },

  // Delete job
  async deleteJob(jobId) {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: "DELETE" });
      if (res.ok) return true;
    } catch {}
    return true;
  },
};

function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
