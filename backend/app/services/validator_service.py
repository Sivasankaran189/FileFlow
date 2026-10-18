import io
import re
import csv
import pandas as pd
from typing import Tuple, Dict, Any, List

EMAIL_REGEX = re.compile(r"^[\w\.-]+@[\w\.-]+\.[a-zA-Z]{2,}$")
DATE_COL_NAMES = {"date", "created_at", "updated_at", "timestamp", "dob", "birth_date", "registered_at"}
POSITIVE_NUM_COLS = {"amount", "price", "quantity", "qty", "count", "age", "balance", "total", "fee", "cost"}


class ValidatorService:
    """
    High-performance CSV validation and automated data-cleaning engine.
    Analyzes schema conformity, detects malformed entries, duplicates,
    and missing values, producing an actionable audit report and a cleaned CSV.
    """

    def validate_and_clean(self, raw_bytes: bytes, filename: str) -> Tuple[Dict[str, Any], str]:
        if not raw_bytes or len(raw_bytes.strip()) == 0:
            raise ValueError("The submitted file is empty.")

        # Decode content with UTF-8 or Latin-1 fallback
        try:
            text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            try:
                text = raw_bytes.decode("latin-1")
            except Exception as e:
                raise ValueError(f"Unable to decode CSV file: {str(e)}")

        # Sniff delimiter
        sample = text[:4096]
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=",\t;|")
            delimiter = dialect.delimiter
        except Exception:
            delimiter = ","

        # Load into pandas DataFrame
        try:
            df = pd.read_csv(io.StringIO(text), sep=delimiter, dtype=str, keep_default_na=False)
        except Exception as e:
            raise ValueError(f"CSV Parsing error: {str(e)}")

        if df.empty:
            raise ValueError("CSV contains headers but no data rows.")

        total_rows = len(df)
        df_columns = [c.strip() for c in df.columns]
        df.columns = df_columns

        # Check for duplicate rows
        duplicates_mask = df.duplicated(keep="first")
        duplicate_rows_count = int(duplicates_mask.sum())

        error_breakdown: List[Dict[str, Any]] = []
        invalid_row_indices = set()

        # Iterate through rows for fine-grained validation
        for row_idx, row in df.iterrows():
            display_row = int(row_idx) + 1  # 1-indexed for humans

            # Check if this row is a duplicate
            if duplicates_mask.iloc[row_idx]:
                invalid_row_indices.add(row_idx)
                if len(error_breakdown) < 100:
                    error_breakdown.append({
                        "row": display_row,
                        "column": "(Entire Record)",
                        "issue": "Duplicate row identical to a preceding record",
                        "value": "Duplicate",
                    })

            for col in df_columns:
                val = str(row[col]).strip()
                col_lower = col.lower()

                # 1. Missing / Empty required field check
                if val == "" or val.lower() in ("null", "none", "nan", "undefined", "n/a"):
                    invalid_row_indices.add(row_idx)
                    if len(error_breakdown) < 100:
                        error_breakdown.append({
                            "row": display_row,
                            "column": col,
                            "issue": "Missing or null value in record",
                            "value": val or "null",
                        })
                    continue

                # 2. Email format validation
                if "email" in col_lower or "mail" in col_lower:
                    if not EMAIL_REGEX.match(val):
                        invalid_row_indices.add(row_idx)
                        if len(error_breakdown) < 100:
                            error_breakdown.append({
                                "row": display_row,
                                "column": col,
                                "issue": "Malformed email address format",
                                "value": val,
                            })

                # 3. Numeric constraints (e.g. Negative values in positive-only columns)
                if any(k in col_lower for k in POSITIVE_NUM_COLS):
                    clean_num = val.replace("$", "").replace(",", "")
                    try:
                        num_val = float(clean_num)
                        if num_val < 0:
                            invalid_row_indices.add(row_idx)
                            if len(error_breakdown) < 100:
                                error_breakdown.append({
                                    "row": display_row,
                                    "column": col,
                                    "issue": "Negative numeric value not permitted",
                                    "value": val,
                                })
                    except ValueError:
                        invalid_row_indices.add(row_idx)
                        if len(error_breakdown) < 100:
                            error_breakdown.append({
                                "row": display_row,
                                "column": col,
                                "issue": "Expected numeric value, received text",
                                "value": val,
                            })

                # 4. Date validation
                if any(k in col_lower for k in DATE_COL_NAMES):
                    if not self._is_valid_date(val):
                        invalid_row_indices.add(row_idx)
                        if len(error_breakdown) < 100:
                            error_breakdown.append({
                                "row": display_row,
                                "column": col,
                                "issue": "Invalid timestamp / date format",
                                "value": val,
                            })

        invalid_rows_count = len(invalid_row_indices)
        valid_rows_count = max(0, total_rows - invalid_rows_count)

        # Generate Cleaned CSV:
        # - Remove duplicate rows
        # - Strip trailing/leading whitespace from all cells
        cleaned_df = df.drop_duplicates(keep="first").copy()
        for col in cleaned_df.columns:
            cleaned_df[col] = cleaned_df[col].astype(str).str.strip()

        cleaned_csv_output = cleaned_df.to_csv(index=False)

        results = {
            "totalRows": total_rows,
            "validRows": valid_rows_count,
            "invalidRows": invalid_rows_count,
            "duplicateRows": duplicate_rows_count,
            "errorBreakdown": error_breakdown,
            "columns": df_columns,
            "columnCount": len(df_columns),
        }

        return results, cleaned_csv_output

    def _is_valid_date(self, val: str) -> bool:
        if not val or len(val) < 6:
            return False
        # Match common date patterns: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, ISO8601
        iso_pattern = re.compile(r"^\d{4}[-/]\d{1,2}[-/]\d{1,2}(T|\s)?.*$")
        common_pattern = re.compile(r"^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$")
        return bool(iso_pattern.match(val) or common_pattern.match(val))

    def generate_sample_csv(self) -> str:
        """Generates a realistic sample CSV with realistic anomalies for easy testing."""
        return (
            "transaction_id,customer_name,email,amount,quantity,status,created_at\n"
            "tx_1001,Sophia Bennett,sophia.bennett@example.com,249.50,2,COMPLETED,2026-03-15T09:30:00Z\n"
            "tx_1002,Liam Gallagher,liam_gallagher_at_domain,120.00,1,PENDING,2026-03-15T10:14:22Z\n"
            "tx_1003,Emma Watson,emma.w@corporate.co,-45.00,3,COMPLETED,2026-03-15T11:05:10Z\n"
            "tx_1004,Noah Patel,noah.patel@webmail.org,89.90,five,FAILED,2026-03-15T11:45:00Z\n"
            "tx_1005,Olivia Chen,,560.25,4,COMPLETED,2026-03-15T12:00:19Z\n"
            "tx_1006,Lucas Rodriguez,lucas.r@technova.io,310.00,1,COMPLETED,2026-03-15T13:21:40Z\n"
            "tx_1006,Lucas Rodriguez,lucas.r@technova.io,310.00,1,COMPLETED,2026-03-15T13:21:40Z\n"
            "tx_1007,Aria Montgomery,aria.m@designstudio.net,1420.00,6,COMPLETED,2026/99/99\n"
            "tx_1008,Ethan Vance,ethan.vance@acme.org,75.50,1,COMPLETED,2026-03-16T08:12:30Z\n"
            "tx_1009,Mia Tanaka,mia.tanaka@tokyotech.jp,430.00,2,COMPLETED,2026-03-16T09:40:11Z\n"
            "tx_1010,Alexander Wright,alex.wright@venture.co,99.95,null,PENDING,2026-03-16T10:15:00Z\n"
            "tx_1011,Charlotte Davis,charlotte.d@horizon.io,815.00,5,COMPLETED,2026-03-16T11:22:45Z\n"
        )


validator_service = ValidatorService()
