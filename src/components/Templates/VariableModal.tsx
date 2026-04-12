import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Template, api } from "../../lib/tauri";
import { parseVariableMeta, VariableMeta } from "../../lib/variables";

interface Props {
  template: Template;
  onClose: () => void;
  onConfirm: (values: Record<string, string>) => void;
}

export function VariableModal({ template, onClose, onConfirm }: Props) {
  const variables = parseVariableMeta(template.variables);
  const [values, setValues] = useState<Record<string, string>>({});
  const [recentValues, setRecentValues] = useState<Record<string, string[]>>(
    {},
  );

  useEffect(() => {
    const initial: Record<string, string> = {};
    variables.forEach((v) => (initial[v.name] = ""));
    setValues(initial);

    variables.forEach((v) => {
      api.getRecentValues(template.id, v.name).then((recent) => {
        setRecentValues((prev) => ({ ...prev, [v.name]: recent }));
      });
    });
  }, [template.id]);

  const updateValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Fill Variables
          </p>
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 mt-1">
            {template.title}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[50vh] overflow-y-auto">
          {variables.map((v) => (
            <VariableField
              key={v.name}
              meta={v}
              value={values[v.name] || ""}
              recentValues={recentValues[v.name] || []}
              onChange={(val) => updateValue(v.name, val)}
            />
          ))}
        </div>

        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(values)}
            className="px-5 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            Continue
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VariableField({
  meta,
  value,
  recentValues,
  onChange,
}: {
  meta: VariableMeta;
  value: string;
  recentValues: string[];
  onChange: (val: string) => void;
}) {
  const label = meta.name.replace(/_/g, " ");
  const inputCls =
    "w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all";

  return (
    <div>
      <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
        {label}
        <span className="ml-1 text-zinc-400 normal-case font-normal tracking-normal">
          ({meta.type})
        </span>
      </label>

      {meta.type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          <option value="">Select...</option>
          {(Array.isArray(meta.options) ? meta.options : []).map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      ) : meta.type === "multiline" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}...`}
          rows={3}
          className={inputCls + " resize-none"}
        />
      ) : meta.type === "date" ? (
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      ) : meta.type === "currency" ||
        meta.type === "number" ||
        meta.type === "percent" ? (
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            meta.type === "currency"
              ? `Amount (${typeof meta.options === "string" ? meta.options : "USD"})`
              : meta.type === "percent"
                ? "e.g. 0.15 for 15%"
                : "Enter number..."
          }
          step={meta.type === "percent" ? "0.01" : "1"}
          className={inputCls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${label}...`}
          className={inputCls}
        />
      )}

      {recentValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {recentValues.map((rv, i) => (
            <button
              key={i}
              onClick={() => onChange(rv)}
              className="px-2 py-0.5 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-700 transition-colors"
            >
              {rv}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
