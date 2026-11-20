import { useEffect, useState } from "react";
import { datasets } from "./data/schema.js";

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

export function RecordsTable({ kind, rows = [], title }) {
  const definition = datasets[kind];
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState(definition.key);
  const [sortDirection, setSortDirection] = useState("asc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);

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
  }, [kind, definition.key]);
  useEffect(() => {
    if (!selectedRecord) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setSelectedRecord(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedRecord]);
  const changeSort = (key) => {
    setPage(1);
    if (sortKey === key) setSortDirection((direction) => direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };
  return (
    <section className="panel table-panel">
      <div className="panel__top">
        <div><h2>{title || definition.label}</h2><p>Records will appear when this workflow's API is available.</p></div>
        <span className="quiet-tag">{filteredRows.length} of {rows.length} records</span>
      </div>
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
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((record) => (
              <tr key={record[definition.key]}>
                {definition.columns.map((column) => <td key={column.key}>{displayValue(record[column.key], column)}</td>)}
                {hasStatus && <td><span className="record-status">{recordStatus(record)}</span></td>}
                <td className="record-actions"><button type="button" className="table-action" onClick={() => setSelectedRecord(record)}>View</button></td>
              </tr>
            )) : (
              <tr><td className="empty-cell" colSpan={definition.columns.length + (hasStatus ? 2 : 1)}>{rows.length ? "No records match these filters." : "No records are available until this workflow API is implemented."}</td></tr>
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
          if (event.target === event.currentTarget) setSelectedRecord(null);
        }}>
          <section className="record-dialog" role="dialog" aria-modal="true" aria-labelledby="record-dialog-title">
            <header className="record-dialog__header">
              <div><p className="eyebrow">RECORD DETAILS</p><h2 id="record-dialog-title">{selectedRecord[definition.key]}</h2></div>
              <button type="button" className="record-dialog__close" onClick={() => setSelectedRecord(null)} aria-label="Close">×</button>
            </header>
            <dl className="record-details">
              {definition.columns.map((column) => <div key={column.key}><dt>{column.label}</dt><dd>{displayValue(selectedRecord[column.key], column)}</dd></div>)}
              {hasStatus && <div><dt>Status</dt><dd>{recordStatus(selectedRecord)}</dd></div>}
            </dl>
            <div className="record-dialog__actions"><button type="button" className="button button--outline" onClick={() => setSelectedRecord(null)}>Close</button></div>
          </section>
        </div>
      )}
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
          <p>{overview?.records ? "Calculated from records returned by the workspace API." : "Report data will appear when the reporting API is available."}</p>
          <div className="report-card__empty">{value}</div>
        </article>
      ))}
    </section>
  );
}
