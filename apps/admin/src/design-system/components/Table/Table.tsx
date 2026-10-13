import { createContext, useContext, type HTMLAttributes, type ReactNode, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cx } from "../../utils";
import { EmptyState, type EmptyStateProps } from "../EmptyState/EmptyState";
import { Skeleton } from "../Spinner/Spinner";
import styles from "./Table.module.css";

/* The table FOUNDATION: structure and states only — header, rows, hover,
   selected, empty, loading, horizontal overflow, compact density. No
   sorting, filtering or pagination yet; those arrive with the modules
   that need them, built on these parts.

     <Table label="Pages">
       <TableHeader><TableRow><TableHead>Title</TableHead>…</TableRow></TableHeader>
       <TableBody>…<TableRow selected>…</TableRow>…</TableBody>
     </Table>

   A wide table scrolls inside its own frame, which is a focusable,
   labelled region so keyboard users can scroll it too. */

type Density = "default" | "compact";
const DensityContext = createContext<Density>("compact");

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Names the table (and its scroll region) for screen readers. */
  label: string;
  /** Compact by default: the admin is a working tool, so tables show as
   * many rows as fit. "default" is the roomier spacing. */
  density?: Density;
  /** Marks the table busy while rows load. */
  loading?: boolean;
  /** Keeps the header row in view while the frame scrolls vertically. */
  stickyHeader?: boolean;
  /** A height cap that makes the frame scroll vertically. */
  maxHeight?: number | string;
  children: ReactNode;
}

export function Table({ label, density = "compact", loading = false, stickyHeader, maxHeight, className, children, ...rest }: TableProps) {
  return (
    <DensityContext.Provider value={density}>
      <div className={styles.frame} role="region" aria-label={label} tabIndex={0} style={maxHeight !== undefined ? { maxHeight } : undefined}>
        <table className={cx(styles.table, styles[density], stickyHeader && styles.sticky, className)} aria-label={label} aria-busy={loading || undefined} {...rest}>
          {children}
        </table>
      </div>
    </DensityContext.Provider>
  );
}

export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Drawn as selected. Pair with a row checkbox, which carries the state
   * for assistive technology. */
  selected?: boolean;
}

export function TableRow({ selected, className, ...rest }: TableRowProps) {
  return <tr className={cx(styles.row, className)} data-selected={selected || undefined} {...rest} />;
}

type Align = "start" | "center" | "end";

export interface TableHeadProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: Align;
  /** A narrow column, e.g. for a checkbox or a row menu. */
  shrink?: boolean;
}

export function TableHead({ align = "start", shrink, className, scope = "col", ...rest }: TableHeadProps) {
  return <th scope={scope} className={cx(styles.head, styles[align], shrink && styles.shrink, className)} {...rest} />;
}

export interface TableCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  align?: Align;
  /** Identifiers, codes, figures: Geist Mono with tabular numbers. */
  mono?: boolean;
  /** Secondary information, in the muted colour. */
  muted?: boolean;
  shrink?: boolean;
}

export function TableCell({ align = "start", mono, muted, shrink, className, ...rest }: TableCellProps) {
  return <td className={cx(styles.cell, styles[align], mono && styles.mono, muted && styles.muted, shrink && styles.shrink, className)} {...rest} />;
}

/** One full-width row holding an empty state. */
export function TableEmpty({ colSpan, ...empty }: { colSpan: number } & EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={styles.emptyCell}>
        <EmptyState size="sm" as="h3" {...empty} />
      </td>
    </tr>
  );
}

/** Placeholder rows while data loads (set `loading` on the Table too). */
export function TableLoading({ colSpan, rows = 3 }: { colSpan: number; rows?: number }) {
  const density = useContext(DensityContext);
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className={styles.loadingRow}>
          {Array.from({ length: colSpan }, (_, col) => (
            <td key={col} className={styles.cell}>
              <Skeleton width={col === 0 ? "70%" : "45%"} height={density === "compact" ? 10 : 12} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
