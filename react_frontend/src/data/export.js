import { strToU8, zipSync } from "fflate";
import { datasets } from "./workspace.js";

function safeText(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = typeof value === "string" ? safeText(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function serializeWorkspaceCsv(workspace) {
  const columns = [...new Set(Object.values(datasets).flatMap((dataset) => dataset.columns.map((column) => column.key)))];
  const headers = ["record_type", ...columns];
  const rows = Object.entries(datasets).flatMap(([kind]) =>
    workspace[kind].map((record) => [kind, ...columns.map((column) => record[column] ?? "")]),
  );
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

function xmlEscape(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function columnName(index) {
  let number = index + 1;
  let name = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    number = Math.floor((number - 1) / 26);
  }
  return name;
}

function inlineCell(reference, value, style = "") {
  const text = typeof value === "string" ? safeText(value) : String(value ?? "");
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(text)}</t></is></c>`;
}

function worksheetXml(dataset, records) {
  const lastColumn = columnName(dataset.columns.length - 1);
  const rows = [
    `<row r="1">${dataset.columns.map((column, index) => inlineCell(`${columnName(index)}1`, column.label, ' s="1"')).join("")}</row>`,
    ...records.map((record, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = dataset.columns.map(({ key }, columnIndex) => {
        const reference = `${columnName(columnIndex)}${rowNumber}`;
        const value = record[key];
        if (typeof value === "number") {
          if (!Number.isFinite(value)) throw new Error(`Cannot export non-finite value in ${key}.`);
          return `<c r="${reference}"><v>${value}</v></c>`;
        }
        return inlineCell(reference, value);
      });
      return `<row r="${rowNumber}">${cells.join("")}</row>`;
    }),
  ];
  const lastRow = records.length + 1;
  const lastCell = `${lastColumn}${lastRow}`;
  const widths = dataset.columns.map((column, index) => {
    const width = Math.min(Math.max(column.label.length, column.key.length) + 4, 32);
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCell}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${widths}</cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A1:${lastColumn}${lastRow}"/>
</worksheet>`;
}

function contentTypes(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets}
</Types>`;
}

function workbookXml(sheetNames) {
  const sheets = sheetNames.map((name, index) =>
    `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelationships(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

export function createWorkspaceExcel(workspace) {
  const entries = Object.entries(datasets);
  const sheetNames = entries.map(([, dataset]) => dataset.label.slice(0, 31));
  const files = {
    "[Content_Types].xml": strToU8(contentTypes(entries.length)),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(workbookXml(sheetNames)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelationships(entries.length)),
    "xl/styles.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
  };
  entries.forEach(([kind, dataset], index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(dataset, workspace[kind]));
  });
  return zipSync(files);
}
