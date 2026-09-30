import type { ReactNode, KeyboardEvent } from "react";
import "./DataTable.css";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  isMono?: boolean;
  className?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  sortColumn?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (columnKey: string) => void;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  sortColumn,
  sortOrder = "asc",
  onSort,
  className = "",
}: DataTableProps<T>) {
  const handleKeyDown = (e: KeyboardEvent, row: T) => {
    if ((e.key === "Enter" || e.key === " ") && onRowClick) {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <div className={`table-container ${className}`.trim()}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sortColumn === col.key;
              return (
                <th
                  key={col.key}
                  className={`data-table__th ${
                    col.sortable ? "data-table__th--sortable" : ""
                  } ${col.className || ""}`.trim()}
                  onClick={() => col.sortable && onSort && onSort(col.key)}
                  aria-sort={
                    isSorted
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {col.label}
                  {col.sortable && isSorted && (
                    <span className="data-table__sort-icon" aria-hidden="true">
                      {sortOrder === "asc" ? " ↑" : " ↓"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => {
            const isClickable = Boolean(onRowClick);
            return (
              <tr
                key={rowKey(row, idx)}
                className={`data-table__tr ${
                  isClickable ? "data-table__tr--clickable" : ""
                }`.trim()}
                tabIndex={isClickable ? 0 : undefined}
                onClick={() => onRowClick && onRowClick(row)}
                onKeyDown={(e) => handleKeyDown(e, row)}
              >
                {columns.map((col) => {
                  const val = (row as Record<string, unknown>)[col.key];
                  return (
                    <td
                      key={col.key}
                      className={`data-table__td ${
                        col.isMono ? "data-table__td--mono" : ""
                      } ${col.className || ""}`.trim()}
                    >
                      {col.render ? (
                        col.render(row)
                      ) : (
                        <div
                          className="data-table__cell-truncate"
                          title={val != null ? String(val) : ""}
                        >
                          {val != null ? String(val) : "—"}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
