import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  Layers,
  Database,
  ArrowRight,
  RotateCcw,
  Upload,
  FileJson,
  Copy,
  Download,
  Check,
  Info,
} from 'lucide-react';

// ---------- Sample data ----------
const SAMPLE_JSON = {
  Technology: {
    Software: {
      AAPL: { price: 178.23, marketCap: 2780, pe: 29.4 },
      MSFT: { price: 412.5, marketCap: 3060, pe: 35.2 },
      GOOGL: { price: 142.3, marketCap: 1780, pe: 26.1 },
    },
    Semiconductors: {
      NVDA: { price: 875.4, marketCap: 2160, pe: 73.5 },
      AMD: { price: 158.2, marketCap: 256, pe: 48.7 },
    },
  },
  Finance: {
    Banks: {
      JPM: { price: 198.4, marketCap: 570, pe: 12.1 },
      BAC: { price: 38.2, marketCap: 302, pe: 11.4 },
    },
    Insurance: {
      'BRK.B': { price: 415.3, marketCap: 905, pe: 9.8 },
    },
  },
  Healthcare: {
    Pharma: {
      JNJ: { price: 152.6, marketCap: 367, pe: 14.8 },
      PFE: { price: 26.9, marketCap: 152, pe: 11.2 },
    },
  },
};

const SAMPLE_KEYS = ['sector', 'industry', 'ticker'];

// ---------- Core: flatten + nest ----------
// Flatten an N-deep nested JSON into a list of records.
function flatten(obj, keys, d = 0, prefix = {}) {
  if (d === keys.length) {
    return [{ ...prefix, ...(typeof obj === 'object' && obj !== null ? obj : { value: obj }) }];
  }
  if (typeof obj !== 'object' || obj === null) return [];
  return Object.entries(obj).flatMap(([k, v]) =>
    flatten(v, keys, d + 1, { ...prefix, [keys[d]]: k })
  );
}

// Re-nest records by an ordered list of grouping keys.
// Non-grouping keys become properties on the leaf.
// Collisions (same path, different records) collapse into arrays.
function nest(records, grouping) {
  if (grouping.length === 0) return records.map((r) => ({ ...r }));
  const result = {};
  for (const record of records) {
    let cursor = result;
    for (let i = 0; i < grouping.length - 1; i++) {
      const val = String(record[grouping[i]]);
      if (!cursor[val] || typeof cursor[val] !== 'object' || Array.isArray(cursor[val])) {
        cursor[val] = {};
      }
      cursor = cursor[val];
    }
    const lastKey = grouping[grouping.length - 1];
    const lastVal = String(record[lastKey]);
    const leaf = {};
    for (const k of Object.keys(record)) {
      if (!grouping.includes(k)) leaf[k] = record[k];
    }
    if (cursor[lastVal] === undefined) cursor[lastVal] = leaf;
    else if (Array.isArray(cursor[lastVal])) cursor[lastVal].push(leaf);
    else cursor[lastVal] = [cursor[lastVal], leaf];
  }
  return result;
}

// ---------- Import helpers ----------
const isPlainObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Determine the grouping depth of a nested object. A "leaf" is the first level
// where the value is not a plain object, OR is a plain object whose values are
// all non-objects (so its keys describe data fields, not another grouping).
function detectDepth(root) {
  if (!isPlainObj(root)) throw new Error('Top level must be a JSON object.');
  if (Object.keys(root).length === 0) throw new Error('Top level object is empty.');

  const looksLikeLeaf = (v) => !isPlainObj(v) || Object.values(v).every((x) => !isPlainObj(x));

  let depth = 0;
  let level = [root];
  while (true) {
    if (level.every(looksLikeLeaf)) return depth;
    if (level.some(looksLikeLeaf)) {
      throw new Error(
        `Inconsistent nesting depth: some branches reach leaves at depth ${depth}, others go deeper.`
      );
    }
    const next = [];
    for (const node of level) for (const child of Object.values(node)) next.push(child);
    level = next;
    depth += 1;
    if (depth > 32) throw new Error('JSON is more than 32 levels deep; refusing to import.');
  }
}

const autoNameKeys = (depth) =>
  Array.from({ length: depth }, (_, i) => `depth${i + 1}`);

// ---------- App ----------
export default function App() {
  const [records, setRecords] = useState(() => flatten(SAMPLE_JSON, SAMPLE_KEYS));
  const [hierarchy, setHierarchy] = useState(SAMPLE_KEYS);
  const [mode, setMode] = useState('schema');
  const [expanded, setExpanded] = useState({});
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [dropIdx, setDropIdx] = useState(null);

  const allKeys = useMemo(
    () => [...new Set(records.flatMap((r) => Object.keys(r)))],
    [records]
  );
  const groupable = useMemo(() => {
    const s = new Set(allKeys);
    for (const r of records)
      for (const [k, v] of Object.entries(r))
        if (v !== null && typeof v === 'object') s.delete(k);
    return s;
  }, [records, allKeys]);
  const nested = useMemo(() => nest(records, hierarchy), [records, hierarchy]);
  const jsonText = useMemo(() => JSON.stringify(nested, null, 2), [nested]);
  const available = allKeys.filter((k) => !hierarchy.includes(k));

  const onDragStart = (i) => setDraggedIdx(i);
  const onDragOver = (i, e) => {
    e.preventDefault();
    setDropIdx(i);
  };
  const onDragEnd = () => {
    setDraggedIdx(null);
    setDropIdx(null);
  };
  const onDrop = (i) => {
    if (draggedIdx === null || draggedIdx === i) {
      onDragEnd();
      return;
    }
    const next = [...hierarchy];
    const [m] = next.splice(draggedIdx, 1);
    next.splice(i, 0, m);
    setHierarchy(next);
    onDragEnd();
  };
  const removeKey = (i) => {
    if (hierarchy.length <= 1) return;
    setHierarchy(hierarchy.filter((_, idx) => idx !== i));
  };
  const addKey = (k) => {
    if (!groupable.has(k) || hierarchy.includes(k)) return;
    setHierarchy([...hierarchy, k]);
  };
  const reset = () => setHierarchy(allKeys.filter((k) => groupable.has(k)));

  const renameKey = (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === oldName) return false;
    if (allKeys.includes(trimmed)) return false;
    setRecords(
      records.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) out[k === oldName ? trimmed : k] = r[k];
        return out;
      })
    );
    setHierarchy(hierarchy.map((k) => (k === oldName ? trimmed : k)));
    return true;
  };

  const [copied, setCopied] = useState(false);
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / insecure contexts: fall back to a temporary textarea.
      const ta = document.createElement('textarea');
      ta.value = jsonText;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } finally {
        document.body.removeChild(ta);
      }
    }
  };
  const saveJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hierarchy-${hierarchy.join('-') || 'flat'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (parsed) => {
    const depth = detectDepth(parsed);
    const keys = autoNameKeys(depth);
    const recs = flatten(parsed, keys);
    setRecords(recs);
    setHierarchy(keys);
    setExpanded({});
    setMode('schema');
  };

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100"
      style={{ fontFamily: '"Manrope", system-ui, sans-serif' }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@300;400;500;600;700;800&display=swap');`}</style>

      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-md bg-amber-400 text-neutral-950 flex items-center justify-center font-bold text-sm"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {'{}'}
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight">JSON Hierarchy Editor</h1>
            <p
              className="text-xs text-neutral-500"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              pivot · regroup · restructure
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-800">
          <button
            onClick={() => setMode('schema')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${
              mode === 'schema'
                ? 'bg-amber-400 text-neutral-950'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Layers className="w-4 h-4" /> Schema
          </button>
          <button
            onClick={() => setMode('data')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${
              mode === 'data'
                ? 'bg-amber-400 text-neutral-950'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Database className="w-4 h-4" /> Data
          </button>
          <button
            onClick={() => setMode('import')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${
              mode === 'import'
                ? 'bg-amber-400 text-neutral-950'
                : 'text-neutral-400 hover:text-neutral-100'
            }`}
          >
            <Upload className="w-4 h-4" /> Import
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-5">
        <section className="lg:col-span-3 p-6 lg:border-r border-neutral-800 min-h-screen">
          {mode === 'schema' && (
            <SchemaView
              hierarchy={hierarchy}
              available={available}
              groupable={groupable}
              draggedIdx={draggedIdx}
              dropIdx={dropIdx}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              removeKey={removeKey}
              addKey={addKey}
              renameKey={renameKey}
              reset={reset}
              nested={nested}
            />
          )}
          {mode === 'data' && (
            <DataView nested={nested} expanded={expanded} setExpanded={setExpanded} />
          )}
          {mode === 'import' && <ImportView onImport={handleImport} initialText={jsonText} />}
        </section>
        <aside className="lg:col-span-2 p-6 bg-neutral-950">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
              JSON Output
            </h3>
            <div className="flex items-center gap-3">
              <span
                className="text-xs text-neutral-600"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {records.length} records
              </span>
              <button
                onClick={copyJson}
                title="Copy JSON to clipboard"
                className={`text-xs flex items-center gap-1.5 px-2 py-1 rounded-md border transition ${
                  copied
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-neutral-700 text-neutral-400 hover:border-amber-400 hover:text-amber-400'
                }`}
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3" /> copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" /> copy
                  </>
                )}
              </button>
              <button
                onClick={saveJson}
                title="Download as .json"
                className="text-xs flex items-center gap-1.5 px-2 py-1 rounded-md border border-neutral-700 text-neutral-400 hover:border-amber-400 hover:text-amber-400 transition"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                <Download className="w-3 h-3" /> save
              </button>
            </div>
          </div>
          <pre
            className="text-xs bg-neutral-900 border border-neutral-800 rounded-lg p-4 overflow-auto max-h-screen leading-relaxed"
            style={{ fontFamily: '"JetBrains Mono", monospace', maxHeight: 'calc(100vh - 8rem)' }}
          >
            <JsonHL text={jsonText} />
          </pre>
        </aside>
      </main>
    </div>
  );
}

// ---------- Schema view ----------
function SchemaView({
  hierarchy,
  available,
  groupable,
  draggedIdx,
  dropIdx,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  removeKey,
  addKey,
  renameKey,
  reset,
  nested,
}) {
  const examplePath = useMemo(() => {
    let cursor = nested;
    const path = [];
    for (
      let i = 0;
      i < hierarchy.length && cursor && typeof cursor === 'object' && !Array.isArray(cursor);
      i++
    ) {
      const key = Object.keys(cursor)[0];
      if (!key) break;
      path.push(key);
      cursor = cursor[key];
    }
    return { path, leaf: cursor };
  }, [nested, hierarchy]);

  return (
    <div>
      <div className="flex items-end justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-1">Schema</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Drag chips to reorder. Click <span className="text-amber-400">×</span> to demote a key
            to the leaf, or <span className="text-amber-400">+</span> to promote a leaf column.
            Double-click any chip to rename.
          </p>
          <p
            className="mt-2 text-xs text-neutral-500 max-w-md flex items-start gap-1.5"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-600" />
            <span>
              Works on JSON with standardised keys — every leaf should share the same shape.
              Heterogeneous leaves may pivot unpredictably.
            </span>
          </p>
        </div>
        <button
          onClick={reset}
          className="text-xs text-neutral-500 hover:text-amber-400 transition flex items-center gap-1.5"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          <RotateCcw className="w-3 h-3" /> reset
        </button>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-4">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3 font-semibold">
          Current Hierarchy
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {hierarchy.map((key, i) => (
            <React.Fragment key={key}>
              <Chip
                label={key}
                index={i}
                isDragged={draggedIdx === i}
                isTarget={dropIdx === i && draggedIdx !== i && draggedIdx !== null}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDrop={onDrop}
                onRemove={() => removeKey(i)}
                onRename={(next) => renameKey(key, next)}
                canRemove={hierarchy.length > 1}
              />
              {i < hierarchy.length - 1 && (
                <ArrowRight className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
          <ArrowRight className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
          <div
            className="px-3 py-2 rounded-md bg-neutral-950 border border-dashed border-neutral-700 text-xs text-neutral-500"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {available.length > 0 ? `{ ${available.join(', ')} }` : '{ }'}
          </div>
        </div>

        {available.length > 0 && (
          <div className="mt-5 pt-4 border-t border-neutral-800">
            <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3 font-semibold">
              Leaf columns
            </div>
            <div className="flex flex-wrap gap-2">
              {available.map((k) => (
                <LeafChip
                  key={k}
                  label={k}
                  canPromote={groupable.has(k)}
                  onPromote={() => addKey(k)}
                  onRename={(next) => renameKey(k, next)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="text-xs uppercase tracking-widest text-neutral-500 mb-3 font-semibold">
          Example traversal
        </div>
        <div
          className="flex items-center flex-wrap gap-2 mb-4 text-sm"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {examplePath.path.map((v, i) => (
            <React.Fragment key={i}>
              <span className="text-neutral-500">{hierarchy[i]}:</span>
              <span className="text-amber-400">{v}</span>
              {i < examplePath.path.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-neutral-700" />
              )}
            </React.Fragment>
          ))}
        </div>
        {examplePath.leaf &&
          typeof examplePath.leaf === 'object' &&
          !Array.isArray(examplePath.leaf) && (
            <div
              className="text-xs bg-neutral-950 rounded-md p-3 border border-neutral-800 space-y-1"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {Object.entries(examplePath.leaf).map(([k, v]) => (
                <div key={k} className="flex">
                  <span className="text-neutral-500 w-28 flex-shrink-0">{k}:</span>
                  <span
                    className={typeof v === 'number' ? 'text-emerald-400' : 'text-sky-400'}
                  >
                    {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        {Array.isArray(examplePath.leaf) && (
          <div
            className="text-xs text-amber-400 bg-neutral-950 rounded-md p-3 border border-amber-900"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            ⚠ collision: {examplePath.leaf.length} records share this path. Last hierarchy key
            isn't unique enough — they collapsed into an array.
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  index,
  isDragged,
  isTarget,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onRemove,
  onRename,
  canRemove,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [flash, setFlash] = useState(false);

  const begin = () => {
    setDraft(label);
    setEditing(true);
  };
  const commit = () => {
    if (!editing) return;
    const next = draft.trim();
    if (next === '' || next === label) {
      setEditing(false);
      return;
    }
    const ok = onRename(next);
    if (ok) {
      setEditing(false);
    } else {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      setDraft(label);
      setEditing(false);
    }
  };

  return (
    <div
      draggable={!editing}
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(index, e)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
      className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border select-none transition ${
        editing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'
      } ${isDragged ? 'opacity-30 scale-95' : ''} ${
        flash
          ? 'border-red-500 bg-red-950'
          : isTarget
          ? 'border-amber-400 bg-amber-950'
          : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
      }`}
    >
      <GripVertical className="w-3.5 h-3.5 opacity-50" />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="bg-transparent border-b border-amber-400 outline-none text-sm font-medium min-w-[3rem] w-auto"
          size={Math.max(draft.length, 4)}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        />
      ) : (
        <span
          onDoubleClick={begin}
          className="text-sm font-medium"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
          title="Double-click to rename"
        >
          {label}
        </span>
      )}
      {canRemove && !editing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 transition text-neutral-400 hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function LeafChip({ label, canPromote, onPromote, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [flash, setFlash] = useState(false);

  const begin = () => {
    setDraft(label);
    setEditing(true);
  };
  const commit = () => {
    if (!editing) return;
    const next = draft.trim();
    if (next === '' || next === label) {
      setEditing(false);
      return;
    }
    const ok = onRename(next);
    if (ok) {
      setEditing(false);
    } else {
      setFlash(true);
      setTimeout(() => setFlash(false), 400);
      setDraft(label);
      setEditing(false);
    }
  };

  const base =
    'px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition border';
  const tone = canPromote
    ? 'bg-neutral-950 border-neutral-700 text-neutral-300 hover:border-amber-400 hover:text-amber-400'
    : 'bg-neutral-950/50 border-neutral-800 text-neutral-500';

  return (
    <div
      className={`${base} ${flash ? 'border-red-500 bg-red-950 text-red-300' : tone}`}
      style={{ fontFamily: '"JetBrains Mono", monospace' }}
      title={
        canPromote
          ? 'Click + to promote to hierarchy. Double-click name to rename.'
          : 'Array/object values can’t be used as a grouping key — stays in leaf. Double-click to rename.'
      }
    >
      {canPromote ? (
        <button
          onClick={onPromote}
          className="flex items-center"
          aria-label={`Promote ${label}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      ) : (
        <span className="opacity-40">
          <Plus className="w-3 h-3" />
        </span>
      )}
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape') setEditing(false);
          }}
          className="bg-transparent border-b border-amber-400 outline-none text-sm min-w-[3rem]"
          size={Math.max(draft.length, 4)}
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        />
      ) : (
        <span onDoubleClick={begin}>{label}</span>
      )}
    </div>
  );
}

// ---------- Import view ----------
function ImportView({ onImport, initialText }) {
  const [text, setText] = useState(() => initialText ?? '');
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState(null);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setText(typeof reader.result === 'string' ? reader.result : '');
      setError(null);
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
    e.target.value = '';
  };

  const onLoad = () => {
    if (!text.trim()) {
      setError('Paste some JSON or upload a file first.');
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setError(`Invalid JSON: ${err.message}`);
      return;
    }
    try {
      onImport(parsed);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight mb-1">Import</h2>
        <p className="text-sm text-neutral-400 max-w-xl">
          The textarea is pre-filled with the current JSON — edit it in place, paste a different
          blob, or upload a <code className="text-amber-400">.json</code> file. Grouping keys are
          auto-named <code className="text-amber-400">depth1, depth2, …</code> from the detected
          nesting depth. Loading replaces the current data.
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs uppercase tracking-widest text-neutral-500 font-semibold">
            Paste JSON
          </div>
          <label
            className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-950 border border-neutral-700 text-neutral-300 hover:border-amber-400 hover:text-amber-400 transition cursor-pointer"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            <FileJson className="w-3.5 h-3.5" />
            {fileName ? fileName : 'Upload .json'}
            <input
              type="file"
              accept="application/json,.json"
              onChange={onFile}
              className="hidden"
            />
          </label>
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          placeholder={'{\n  "groupA": {\n    "subA": { "value": 1 }\n  }\n}'}
          rows={16}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-md p-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-400 leading-relaxed resize-y"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        />
        <div className="flex items-center justify-between mt-3">
          {error ? (
            <div
              className="text-xs text-red-400"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {error}
            </div>
          ) : (
            <div
              className="text-xs text-neutral-600"
              style={{ fontFamily: '"JetBrains Mono", monospace' }}
            >
              {text ? `${text.length} chars` : 'empty'}
              {initialText && text !== initialText && (
                <button
                  onClick={() => {
                    setText(initialText);
                    setError(null);
                    setFileName(null);
                  }}
                  className="ml-3 text-neutral-500 hover:text-amber-400 transition inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> reset to current
                </button>
              )}
            </div>
          )}
          <button
            onClick={onLoad}
            className="px-4 py-2 rounded-md bg-amber-400 text-neutral-950 text-sm font-semibold hover:bg-amber-300 transition flex items-center gap-2"
          >
            <Upload className="w-4 h-4" /> Load
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Data view ----------
function DataView({ nested, expanded, setExpanded }) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold tracking-tight mb-1">Data</h2>
        <p className="text-sm text-neutral-400">
          Browse the nested records. Switch to Schema to restructure all leaves at once.
        </p>
      </div>
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <TreeNode
          value={nested}
          path=""
          expanded={expanded}
          setExpanded={setExpanded}
          depth={0}
          isRoot
        />
      </div>
    </div>
  );
}

function TreeNode({ value, path, expanded, setExpanded, depth, keyName, isRoot }) {
  const isObj = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArr = Array.isArray(value);
  const isPrimitive = !isObj && !isArr;
  const defaultExp = depth < 2;
  const isExp = expanded[path] !== undefined ? expanded[path] : defaultExp;

  if (isPrimitive) {
    return (
      <div
        className="flex items-center gap-2 py-0.5 text-sm"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
      >
        <span className="text-neutral-500">{keyName}:</span>
        <span className={typeof value === 'number' ? 'text-emerald-400' : 'text-sky-400'}>
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      </div>
    );
  }

  const entries = isArr ? value.map((v, i) => [String(i), v]) : Object.entries(value);

  return (
    <div>
      {keyName !== undefined && (
        <button
          onClick={() => setExpanded((e) => ({ ...e, [path]: !isExp }))}
          className="flex items-center gap-1 py-0.5 hover:bg-neutral-800 rounded px-1 -ml-1 transition w-full text-left"
          style={{ fontFamily: '"JetBrains Mono", monospace' }}
        >
          {isExp ? (
            <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />
          )}
          <span className="text-sm font-medium text-amber-400">{keyName}</span>
          <span className="text-xs text-neutral-600 ml-1">
            {isArr ? `[${entries.length}]` : `{${entries.length}}`}
          </span>
        </button>
      )}
      {(isExp || isRoot) && (
        <div
          className={keyName !== undefined ? 'ml-3 border-l border-neutral-800 pl-3 mt-0.5' : ''}
        >
          {entries.map(([k, v]) => (
            <TreeNode
              key={k}
              value={v}
              keyName={k}
              path={path + '/' + k}
              expanded={expanded}
              setExpanded={setExpanded}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- JSON syntax highlighting ----------
function JsonHL({ text }) {
  const lines = text.split('\n');
  return (
    <code>
      {lines.map((line, i) => {
        const m = line.match(/^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)(.*)$/);
        if (m) {
          const [, indent, key, colon, rest] = m;
          return (
            <div key={i}>
              <span>{indent}</span>
              <span className="text-amber-300">{key}</span>
              <span className="text-neutral-600">{colon}</span>
              <ValueSpan v={rest} />
            </div>
          );
        }
        return (
          <div key={i} className="text-neutral-500">
            {line}
          </div>
        );
      })}
    </code>
  );
}

function ValueSpan({ v }) {
  const trailing = v.endsWith(',') ? ',' : '';
  const core = trailing ? v.slice(0, -1) : v;
  const t = core.trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return (
      <span>
        <span className="text-emerald-400">{core}</span>
        <span className="text-neutral-600">{trailing}</span>
      </span>
    );
  }
  if (t.startsWith('"') && t.endsWith('"')) {
    return (
      <span>
        <span className="text-sky-400">{core}</span>
        <span className="text-neutral-600">{trailing}</span>
      </span>
    );
  }
  return <span className="text-neutral-400">{v}</span>;
}
