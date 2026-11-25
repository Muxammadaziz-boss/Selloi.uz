"use client";

/**
 * Download an Excel-compatible UTF-8 BOM CSV file from tabular rows.
 */
export function downloadCsvExport(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>
): void {
  if (typeof window === "undefined") return;

  const escapeCell = (value: string | number | boolean | null | undefined): string => {
    let str = value === null || value === undefined ? "" : String(value);
    if (/^[=+\t\r]/.test(str) || /^-[^0-9.]/.test(str)) {
      str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
