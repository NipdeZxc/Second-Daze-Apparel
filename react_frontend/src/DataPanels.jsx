import { useState } from "react";
import { csvTemplate, datasets, MAX_CSV_BYTES, parseImport, readWorkspace, saveImport } from "./data/workspace.js";
import { createWorkspaceExcel, serializeWorkspaceCsv } from "./data/export.js";

export const screenDatasets = {
  "3.9-orders-status-tracking": "orders",
  "3.11-customers": "customers",
  "4-inventory-workspace": "products",
  "4.2-low-stock-alerts": "products",
  "2.5-reservations": "reservations",
  "5-reservations": "reservations",
  "2.8-sales": "sales",
};

export function formatMoney(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value)
    : "—";
}

function displayValue(value, column) {
  if (column.type === "money") return formatMoney(value);
  return value === "" || value == null ? "—" : String(value);
}

function RecordRows({ columns, rows, rowKey }) {
  return (
    <div className="table-scroll">
      <table>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col">{column.label}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row[rowKey]}>
              {columns.map((column) => <td key={column.key}>{displayValue(row[column.key], column)}</td>)}
            </tr>
          )) : <tr><td className="empty-cell" colSpan={columns.length}>No records yet. An Admin can import a CSV to populate this list.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function RecordsTable({ kind, rows = [], title }) {
  const definition = datasets[kind];
  return (
    <section className="panel table-panel">
      <div className="panel__top">
        <div><h2>{title || definition.label}</h2><p>Imported records saved in this browser.</p></div>
        <span className="quiet-tag">{rows.length} records</span>
      </div>
      <RecordRows columns={definition.columns} rows={rows} rowKey={definition.key} />
    </section>
  );
}

export function CsvImportPanel({ authUser, onImported }) {
  const [kind, setKind] = useState("products");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const definition = datasets[kind];
  const resetPreview = () => {
    setPreview(null);
    setError("");
    setMessage("");
  };
  if (authUser?.role !== "Admin") return <p role="alert">Only an Admin can import CSV data.</p>;
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([csvTemplate(kind)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-template.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel csv-import">
      <div className="panel__top">
        <div><h2>Import CSV data</h2><p>Preview and validate records before adding them.</p></div>
      </div>
      <div className="csv-import__content">
        <p className="data-notice">Temporary browser storage only. These records are not uploaded or shared between devices.
          Clearing this site's browser data removes them. Keep your original CSV files as backups.
          Demo accounts are not secure authentication; do not import sensitive or production data.</p>
        <form onSubmit={async (event) => {
          event.preventDefault();
          resetPreview();
          if (!file) { setError("Choose a CSV file first."); return; }
          if (!/\.csv$/i.test(file.name)) { setError("Choose a file with a .csv extension."); return; }
          if (file.size > MAX_CSV_BYTES) { setError("CSV files must be 2 MB or smaller."); return; }
          setBusy(true);
          try {
            const records = parseImport(kind, await file.text(), readWorkspace());
            setPreview(records);
          } catch (validationError) {
            setError(validationError.message || "The CSV could not be read.");
          } finally {
            setBusy(false);
          }
        }}>
          <fieldset disabled={busy}>
            <label className="field">
              <span>Data type</span>
              <select value={kind} onChange={(event) => { setKind(event.target.value); resetPreview(); }}>
                {Object.entries(datasets).map(([id, dataset]) => <option value={id} key={id}>{dataset.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>CSV file (UTF-8, max 2 MB / 5,000 rows)</span>
              <input type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files[0] || null); resetPreview(); }} />
            </label>
            <div className="csv-import__actions">
              <button type="button" className="button button--outline" onClick={downloadTemplate}>Download template</button>
              <button type="submit" className="button button--primary">{busy ? "Validating..." : "Preview CSV"}</button>
            </div>
          </fieldset>
        </form>
        <p className="form-note">Required columns: {definition.columns.filter((column) => !column.optional).map((column) => column.key).join(", ")}.</p>
        {definition.columns.some((column) => column.optional) && (
          <p className="form-note">Optional columns: {definition.columns.filter((column) => column.optional).map((column) => column.key).join(", ")}.</p>
        )}
        {definition.columns.find((column) => column.values) && (
          <p className="form-note">Allowed statuses: {definition.columns.find((column) => column.values).values.join(", ")}.</p>
        )}
        <p className="form-note">Use plain numbers without currency symbols or thousands separators, and YYYY-MM-DD dates or ISO timestamps with timezone.
          Imports only add records; duplicate identifiers reject the entire file. Import customers before orders/reservations, and orders before sales.
          Inventory quantities are imported snapshots; importing orders or sales does not alter stock.</p>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {message && <p className="form-note" role="status">{message}</p>}
        {preview && (
          <div className="csv-import__preview">
            <h3>{preview.length} valid records ready to import</h3>
            <p className="form-note">Showing the first {Math.min(preview.length, 10)} rows. Nothing is saved until you confirm.</p>
            <RecordRows columns={definition.columns} rows={preview.slice(0, 10)} rowKey={definition.key} />
            <button type="button" className="button button--pink" onClick={() => {
              setError("");
              try {
                saveImport(kind, preview, authUser);
                setMessage(`Imported ${preview.length} ${definition.label.toLowerCase()} record(s) into this browser.`);
                setPreview(null);
                onImported();
              } catch (saveError) {
                setError(saveError.message || "Import was not saved.");
              }
            }}>Import {preview.length} records</button>
          </div>
        )}
      </div>
    </section>
  );
}

function downloadFile(contents, mimeType, filename) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DataExportPanel({ authUser }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (authUser?.role !== "Admin") return <p role="alert">Only an Admin can export workspace data.</p>;

  if (!authUser.demo) {
    return (
      <p className="data-notice" role="status">
        Full CSV and Excel exports are currently available for browser-only demo records.
        Exporting shared backend records is not configured in this workspace.
      </p>
    );
  }

  const filename = `second-daze-records-${new Date().toISOString().slice(0, 10)}`;
  const runExport = async (format) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const workspace = readWorkspace();
      if (format === "csv") {
        downloadFile(serializeWorkspaceCsv(workspace), "text/csv;charset=utf-8", `${filename}.csv`);
      } else {
        const workbook = await createWorkspaceExcel(workspace);
        downloadFile(workbook, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${filename}.xlsx`);
      }
      const count = Object.keys(datasets).reduce((total, kind) => total + workspace[kind].length, 0);
      setMessage(`Exported ${count} records.`);
    } catch (exportError) {
      setError(exportError.message || "Workspace records could not be exported.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel csv-import">
      <div className="panel__top">
        <div><h2>Export all records</h2><p>Download every imported record available in this browser.</p></div>
      </div>
      <div className="csv-import__content">
        <p className="data-notice">
          Exports products, customers, orders, sales, and reservations. CSV combines these records into one file with a
          <code> record_type</code> column; Excel creates a workbook with a separate sheet for each record type.
          Only records stored in this browser are included.
        </p>
        <div className="csv-import__actions">
          <button type="button" className="button button--outline" disabled={busy} onClick={() => runExport("csv")}>
            {busy ? "Preparing export…" : "Download CSV"}
          </button>
          <button type="button" className="button button--primary" disabled={busy} onClick={() => runExport("excel")}>
            {busy ? "Preparing export…" : "Download Excel"}
          </button>
        </div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {message && <p className="form-note" role="status">{message}</p>}
      </div>
    </section>
  );
}

export function DataReports({ overview }) {
  const metrics = overview?.metrics;
  const reports = [
    ["Gross sales", formatMoney(metrics?.grossSales)],
    ["Recorded cost of sales", formatMoney(metrics?.totalCost)],
    ["Gross profit", formatMoney(metrics?.profit)],
    ["Orders", metrics?.ordersPlaced ?? "—"],
  ];
  return (
    <section className="report-grid">
      {reports.map(([label, value]) => (
        <article className="panel report-card" key={label}>
          <span className="eyebrow">IMPORTED DATA</span><h2>{label}</h2>
          <p>{overview?.records ? "Calculated from records saved in this browser." : "No imported data is available."}</p>
          <div className="report-card__empty">{value}</div>
        </article>
      ))}
    </section>
  );
}
