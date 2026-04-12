// ══════════════════════════════════════════
// Types
// ══════════════════════════════════════════

export interface VariableMeta {
  name: string;
  type: string;
  options?: string | string[];
}

// ══════════════════════════════════════════
// Built-in Variable Resolution
// ══════════════════════════════════════════

const DATE_TOKENS: Record<string, (d: Date) => string> = {
  YYYY: (d) => String(d.getFullYear()),
  YY: (d) => String(d.getFullYear()).slice(-2),
  MMMM: (d) => d.toLocaleString("en-US", { month: "long" }),
  MMM: (d) => d.toLocaleString("en-US", { month: "short" }),
  MM: (d) => String(d.getMonth() + 1).padStart(2, "0"),
  DD: (d) => String(d.getDate()).padStart(2, "0"),
  HH: (d) => String(d.getHours()).padStart(2, "0"),
  mm: (d) => String(d.getMinutes()).padStart(2, "0"),
  ss: (d) => String(d.getSeconds()).padStart(2, "0"),
};

function formatDate(date: Date, fmt: string): string {
  let result = fmt;
  // Replace longest tokens first to avoid partial matches (MMMM before MM)
  const sorted = Object.keys(DATE_TOKENS).sort((a, b) => b.length - a.length);
  for (const token of sorted) {
    result = result.replace(new RegExp(token, "g"), DATE_TOKENS[token](date));
  }
  return result;
}

function resolveBuiltin(name: string, format?: string): string | null {
  const now = new Date();
  switch (name) {
    case "TODAY":
      return formatDate(now, format || "DD/MM/YYYY");
    case "NOW":
      return formatDate(now, format || "DD/MM/YYYY HH:mm");
    case "WEEKDAY":
      return now.toLocaleString("en-US", { weekday: "long" });
    case "MONTH":
      return now.toLocaleString("en-US", { month: "long" });
    case "YEAR":
      return String(now.getFullYear());
    default:
      return null;
  }
}

function isBuiltinVariable(name: string): boolean {
  return /^[A-Z_]+$/.test(name);
}

export function resolveBuiltins(
  content: string,
  clipboardText?: string,
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, raw: string) => {
    const parts = raw.trim().split(":");
    const name = parts[0];
    if (!isBuiltinVariable(name)) return match;
    if (name === "CLIPBOARD") return clipboardText ?? match;
    const format = parts.slice(1).join(":");
    return resolveBuiltin(name, format || undefined) ?? match;
  });
}

// ══════════════════════════════════════════
// User Variable Parsing
// ══════════════════════════════════════════

export function parseVariableMeta(variablesJson: string): VariableMeta[] {
  try {
    const parsed = JSON.parse(variablesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v: any) => {
      if (typeof v === "string") return { name: v, type: "text" };
      return { name: v.name, type: v.type || "text", options: v.options };
    });
  } catch {
    return [];
  }
}

export function hasUserVariables(variablesJson: string): boolean {
  return parseVariableMeta(variablesJson).length > 0;
}

export function hasBuiltinVariables(content: string): boolean {
  return /\{\{([A-Z_]+(?::[^}]*)?)\}\}/.test(content);
}

// ══════════════════════════════════════════
// Value Formatting
// ══════════════════════════════════════════

const CURRENCY_CONFIG: Record<
  string,
  { locale: string; currency: string; minimumFractionDigits: number }
> = {
  VND: { locale: "vi-VN", currency: "VND", minimumFractionDigits: 0 },
  USD: { locale: "en-US", currency: "USD", minimumFractionDigits: 2 },
  EUR: { locale: "de-DE", currency: "EUR", minimumFractionDigits: 2 },
  JPY: { locale: "ja-JP", currency: "JPY", minimumFractionDigits: 0 },
};

export function formatCurrency(value: number, currencyCode: string): string {
  const cfg = CURRENCY_CONFIG[currencyCode.toUpperCase()];
  if (!cfg) return `${value} ${currencyCode}`;
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.currency,
    minimumFractionDigits: cfg.minimumFractionDigits,
  }).format(value);
}

export function formatValue(rawValue: string, varMeta: VariableMeta): string {
  if (!rawValue) return "";
  switch (varMeta.type) {
    case "currency": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      const code = typeof varMeta.options === "string" ? varMeta.options : "USD";
      return formatCurrency(num, code);
    }
    case "number": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      return new Intl.NumberFormat("en-US").format(num);
    }
    case "percent": {
      const num = parseFloat(rawValue.replace(/[^0-9.-]/g, ""));
      if (isNaN(num)) return rawValue;
      return `${(num * 100).toFixed(1)}%`;
    }
    case "date": {
      const d = new Date(rawValue + "T00:00:00");
      if (isNaN(d.getTime())) return rawValue;
      const fmt = typeof varMeta.options === "string" ? varMeta.options : "DD/MM/YYYY";
      return formatDate(d, fmt);
    }
    default:
      return rawValue;
  }
}

export function substituteVariables(
  content: string,
  values: Record<string, string>,
  variablesMeta: VariableMeta[],
): string {
  let result = content;
  const metaMap = new Map(variablesMeta.map((v) => [v.name, v]));

  for (const [name, rawValue] of Object.entries(values)) {
    const meta = metaMap.get(name) || { name, type: "text" };
    const formatted = formatValue(rawValue, meta);
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\{\\{${escapedName}(?::[^}]*)?\\}\\}`, "g");
    result = result.replace(pattern, formatted || `{{${name}}}`);
  }

  return result;
}
