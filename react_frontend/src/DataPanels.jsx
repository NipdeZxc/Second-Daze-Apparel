import { useEffect, useState } from "react";
import { csvTemplate, datasets, MAX_CSV_BYTES, parseImport, readWorkspace, saveImport, updateRecord } from "./data/workspace.js";

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

export function RecordsTable({ kind, rows = [], title, authUser, canEdit = false, onRecordUpdated }) {
  const definition = datasets[kind];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState(definition.key);
  const [sortDirection, setSortDirection] = useState("asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [dialogMode, setDialogMode] = useState("");
  const [editValues, setEditValues] = useState({});
  const [dialogError, setDialogError] = useState("");
  const [message, setMessage] = useState("");

  const recordStatus = (record) => {
    if (typeof record.status === "string" && record.status) return record.status;
    if (kind === "products") {
      return Number(record.qty_available) <= Number(record.low_stock_threshold) ? "Low stock" : "In stock";
    }
    return "";
  };
  const statusColumn = definition.columns.find((column) => column.key === "status");
  const hasStatus = kind === "products" || Boolean(statusColumn);
  const statuses = statusColumn?.values || [...new Set(rows.map(recordStatus).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const filteredRows = rows.filter((record) => {
    const matchesQuery = !query.trim() || [
      ...Object.values(record),
      ...(hasStatus ? [recordStatus(record)] : []),
    ].some((value) => String(value ?? "").toLowerCase().includes(query.trim().toLowerCase()));
    return matchesQuery && (!statusFilter || recordStatus(record) === statusFilter);
  });
  const sortColumn = definition.columns.find((column) => column.key === sortKey);
  const sortedRows = [...filteredRows].sort((left, right) => {
    const leftValue = sortKey === "__status" ? recordStatus(left) : left[sortKey];
    const rightValue = sortKey === "__status" ? recordStatus(right) : right[sortKey];
    let order;
    if (sortColumn && ["money", "quantity"].includes(sortColumn.type)) {
      order = Number(leftValue) - Number(rightValue);
    } else if (sortColumn?.type === "date") {
      order = Date.parse(leftValue) - Date.parse(rightValue);
    } else {
      order = String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { numeric: true, sensitivity: "base" });
    }
    return sortDirection === "asc" ? order : -order;
  });
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const visibleRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    setQuery("");
    setStatusFilter("");
    setSortKey(definition.key);
    setSortDirection("asc");
    setPage(1);
    setMessage("");
  }, [kind, definition.key]);
  const closeDialog = () => {
    setSelectedRecord(null);
    setDialogMode("");
    setDialogError("");
  };
  const openEdit = (record) => {
    setSelectedRecord(record);
    setEditValues(Object.fromEntries(definition.columns.map((column) => [
      column.key,
      column.type === "date" ? String(record[column.key] ?? "").slice(0, 10) : String(record[column.key] ?? ""),
    ])));
    setDialogError("");
    setDialogMode("edit");
  };
  useEffect(() => {
    if (!selectedRecord) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && dialogMode === "view") closeDialog();
      if (event.key === "Escape" && dialogMode === "confirm") setDialogMode("edit");
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedRecord, dialogMode]);
  const changeSort = (key) => {
    setPage(1);
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };
  const saveEdit = () => {
    try {
      updateRecord(kind, selectedRecord[definition.key], editValues, authUser);
      setMessage(`${definition.label} record updated.`);
      closeDialog();
      window.setTimeout(() => setMessage(""), 5000);
      onRecordUpdated?.();
    } catch (error) {
      setDialogError(error.message || "The record could not be updated.");
      setDialogMode("edit");
    }
  };

  return (
    <section className="panel table-panel">
      <div className="panel__top">
        <div><h2>{title || definition.label}</h2><p>Imported records saved in this browser.</p></div>
        <span className="quiet-tag">{filteredRows.length} of {rows.length} records</span>
      </div>
      {message && <p className="table-message" role="status">{message}</p>}
      <div className="table-tools">
        <label className="table-search">
          <span>Search records</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} type="search" placeholder={`Search ${definition.label.toLowerCase()}`} />
        </label>
        {hasStatus && (
          <label className="table-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {statuses.map((status) => <option value={status} key={status}>{status}</option>)}
            </select>
          </label>
        )}
        <label className="table-page-size">
          <span>Rows</span>
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[10, 25, 50].map((size) => <option value={size} key={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {definition.columns.map((column) => (
                <th scope="col" aria-sort={sortKey === column.key ? (sortDirection === "asc" ? "ascending" : "descending") : "none"} key={column.key}>
                  <button className="table-sort" type="button" onClick={() => changeSort(column.key)} aria-label={`Sort by ${column.label} ${sortKey === column.key && sortDirection === "asc" ? "descending" : "ascending"}`}>
                    {column.label}{sortKey === column.key && <span aria-hidden="true">{sortDirection === "asc" ? " ↑" : " ↓"}</span>}
                  </button>
                </th>
              ))}
              {hasStatus && <th scope="col" aria-sort={sortKey === "__status" ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}><button className="table-sort" type="button" onClick={() => changeSort("__status")}>Status</button></th>}
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((record) => (
              <tr key={record[definition.key]}>
                {definition.columns.map((column) => <td key={column.key}>{displayValue(record[column.key], column)}</td>)}
                {hasStatus && <td><span className="record-status">{recordStatus(record)}</span></td>}
                <td className="record-actions">
                  <button type="button" className="table-action" onClick={() => { setSelectedRecord(record); setDialogMode("view"); }}>View</button>
                  {canEdit && <button type="button" className="table-action" onClick={() => openEdit(record)}>Edit</button>}
                </td>
              </tr>
            )) : (
              <tr><td className="empty-cell" colSpan={definition.columns.length + (hasStatus ? 2 : 1)}>{rows.length ? "No records match these filters." : "No records yet. An Admin can import a CSV to populate this list."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <span>Showing {sortedRows.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, sortedRows.length)} of {sortedRows.length}</span>
        <div>
          <button type="button" className="button button--outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button type="button" className="button button--outline" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>Next</button>
        </div>
      </div>

      {selectedRecord && (
        <div className="record-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && dialogMode === "view") closeDialog();
        }}>
          <section className="record-dialog" role={dialogMode === "confirm" ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby="record-dialog-title">
            <header className="record-dialog__header">
              <div><p className="eyebrow">{dialogMode === "view" ? "RECORD DETAILS" : dialogMode === "confirm" ? "CONFIRM UPDATE" : "EDIT RECORD"}</p><h2 id="record-dialog-title">{selectedRecord[definition.key]}</h2></div>
              <button type="button" className="record-dialog__close" onClick={() => dialogMode === "confirm" ? setDialogMode("edit") : closeDialog()} aria-label={dialogMode === "confirm" ? "Continue editing" : "Close"}>×</button>
            </header>
            {dialogMode === "view" ? (
              <>
                <dl className="record-details">
                  {definition.columns.map((column) => <div key={column.key}><dt>{column.label}</dt><dd>{displayValue(selectedRecord[column.key], column)}</dd></div>)}
                  {hasStatus && <div><dt>Status</dt><dd>{recordStatus(selectedRecord)}</dd></div>}
                </dl>
                <div className="record-dialog__actions"><button type="button" className="button button--outline" onClick={closeDialog}>Close</button></div>
              </>
            ) : dialogMode === "confirm" ? (
              <>
                <p className="record-dialog__copy">Save these changes to this browser’s imported data?</p>
                <div className="record-dialog__actions">
                  <button type="button" className="button button--outline" onClick={() => setDialogMode("edit")}>Continue editing</button>
                  <button type="button" className="button button--primary" onClick={saveEdit}>Save changes</button>
                </div>
              </>
            ) : (
              <form className="record-edit-form" onSubmit={(event) => { event.preventDefault(); setDialogError(""); setDialogMode("confirm"); }}>
                {definition.columns.map((column) => (
                  <label className="field" key={column.key}>
                    <span>{column.label}{column.optional ? " (optional)" : ""}</span>
                    {column.values ? (
                      <select required={!column.optional} value={editValues[column.key] || ""} onChange={(event) => setEditValues((previous) => ({ ...previous, [column.key]: event.target.value }))}>
                        {column.optional && <option value="">Select a status</option>}
                        {column.values.map((value) => <option value={value} key={value}>{value}</option>)}
                      </select>
                    ) : (
                      <input
                        type={column.type === "money" || column.type === "quantity" ? "number" : column.type === "date" ? "date" : column.key === "email" ? "email" : "text"}
                        min={["money", "quantity"].includes(column.type) ? 0 : undefined}
                        step={column.type === "money" ? "0.01" : column.type === "quantity" ? "1" : undefined}
                        required={!column.optional}
                        readOnly={column.key === definition.key}
                        value={editValues[column.key] ?? ""}
                        onChange={(event) => setEditValues((previous) => ({ ...previous, [column.key]: event.target.value }))}
                      />
                    )}
                  </label>
                ))}
                {dialogError && <p className="inline-error" role="alert">{dialogError}</p>}
                <div className="record-dialog__actions">
                  <button type="button" className="button button--outline" onClick={closeDialog}>Cancel</button>
                  <button type="submit" className="button button--primary">Review changes</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
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
