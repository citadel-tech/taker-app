import type { HTMLAttributes } from "react";

function formatSatsNumber(sats: number) {
  return Math.abs(Math.round(sats)).toLocaleString();
}

export function SatsSymbol({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`cs-sats-symbol ${className ?? ""}`} role="img" aria-label="satoshis" {...props}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function SatsAmount({ sats, showPlus = false, className }: {
  sats: number;
  showPlus?: boolean;
  className?: string;
}) {
  const rounded = Math.round(sats);
  const sign = rounded < 0 ? "-" : showPlus ? "+" : "";
  return (
    <span className={`cs-sats-amount ${className ?? ""}`}>
      {sign}{formatSatsNumber(rounded)}<SatsSymbol />
    </span>
  );
}
