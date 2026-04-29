export interface Transform {
  id: string;
  label: string;
  category: string;
  fn: (text: string) => string;
}

function titleCase(t: string): string {
  return t.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function sentenceCase(t: string): string {
  return t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase());
}

function b64Encode(t: string): string {
  const bytes = new TextEncoder().encode(t);
  return btoa(bytes.reduce((s, b) => s + String.fromCharCode(b), ""));
}

function b64Decode(t: string): string {
  const binary = atob(t.trim());
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export const TRANSFORMS: Transform[] = [
  // Case
  { id: "upper",     label: "UPPERCASE",         category: "Case",   fn: t => t.toUpperCase() },
  { id: "lower",     label: "lowercase",          category: "Case",   fn: t => t.toLowerCase() },
  { id: "title",     label: "Title Case",         category: "Case",   fn: titleCase },
  { id: "sentence",  label: "Sentence case",      category: "Case",   fn: sentenceCase },
  // Clean
  { id: "trim",      label: "Trim spaces",        category: "Clean",  fn: t => t.trim().replace(/[ \t]+/g, " ") },
  { id: "no-breaks", label: "Remove line breaks", category: "Clean",  fn: t => t.replace(/\r?\n/g, " ").trim() },
  { id: "no-empty",  label: "Remove empty lines", category: "Clean",  fn: t => t.split("\n").filter(l => l.trim()).join("\n") },
  { id: "no-dupes",  label: "Remove duplicates",  category: "Clean",  fn: t => [...new Set(t.split("\n"))].join("\n") },
  // Lines
  { id: "sort-asc",  label: "Sort A → Z",         category: "Lines",  fn: t => t.split("\n").sort((a, b) => a.localeCompare(b)).join("\n") },
  { id: "sort-desc", label: "Sort Z → A",         category: "Lines",  fn: t => t.split("\n").sort((a, b) => b.localeCompare(a)).join("\n") },
  { id: "reverse",   label: "Reverse lines",      category: "Lines",  fn: t => t.split("\n").reverse().join("\n") },
  // Encode
  { id: "url-enc",   label: "URL encode",         category: "Encode", fn: t => encodeURIComponent(t) },
  { id: "url-dec",   label: "URL decode",         category: "Encode", fn: t => decodeURIComponent(t) },
  { id: "b64-enc",   label: "Base64 encode",      category: "Encode", fn: b64Encode },
  { id: "b64-dec",   label: "Base64 decode",      category: "Encode", fn: b64Decode },
  // Format
  { id: "json-fmt",  label: "Format JSON",        category: "Format", fn: t => JSON.stringify(JSON.parse(t), null, 2) },
  { id: "json-min",  label: "Minify JSON",        category: "Format", fn: t => JSON.stringify(JSON.parse(t)) },
];

export const TRANSFORM_CATEGORIES = [...new Set(TRANSFORMS.map(t => t.category))];

export function applyTransform(
  transform: Transform,
  text: string,
): { ok: true; result: string } | { ok: false; error: string } {
  try {
    return { ok: true, result: transform.fn(text) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
