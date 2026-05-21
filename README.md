# JSON Hierarchy Editor

A browser-based tool for re-pivoting nested JSON. If you have JSON whose leaves all share a common shape — for example tickers nested under `sector → industry` — you can rearrange how the data is grouped without rewriting it by hand.

Deployed on Vercel — try it [here](https://json-hierarchy-editor.vercel.app/).

## What it does

Given input like this:

```json
{
  "Technology": {
    "Software":       { "AAPL":  { "price": 178.23, "marketCap": 2780 } },
    "Semiconductors": { "NVDA":  { "price": 875.40, "marketCap": 2160 } }
  }
}
```

…you can drag `industry` above `sector`, or pull `marketCap` up out of the leaf and make it a grouping level, and the whole structure re-nests instantly:

```json
{
  "Software":       { "Technology": { "AAPL": { "price": 178.23, "marketCap": 2780 } } },
  "Semiconductors": { "Technology": { "NVDA": { "price": 875.40, "marketCap": 2160 } } }
}
```

The records themselves don't change — only the grouping order does.

## Operations

- **Schema mode** — the grouping chips for the current hierarchy. Drag to reorder, `×` to demote a key into the leaf, `+` to promote a leaf column up to a grouping key, double-click a chip to rename it.
- **Data mode** — browse the resulting nested tree.
- **Import mode** — paste JSON or upload a `.json` file. The textarea pre-fills with the current output, so you can also hand-edit and re-load.
- **Copy / Save** — buttons in the JSON Output panel copy to clipboard or download the current pivot as `hierarchy-<keys>.json`.

## Constraints

The pivot only makes sense when every leaf has the same keys. Heterogeneous shapes can be loaded but will pivot unpredictably. Array- and object-valued columns stay in the leaf (they can't be promoted to grouping keys, since their values don't make useful group labels).

## Privacy

Everything runs in the browser. No data leaves the page; there is no backend and no storage.
