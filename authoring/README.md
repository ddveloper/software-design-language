# SDL Authoring Tool

AI-powered authoring surface for SDL. Describe a software system in plain language — the tool compiles it into the four SDL JSON files (`nodes.json`, `edges.json`, `triggers.json`, `flows.json`), renders a live diagram, and lets you arrange nodes by drag and drop. Layouts persist across sessions.

## Try it

> **[Open in Claude.ai →](https://claude.ai/public/artifacts/b673dc3f-983f-489b-9845-0421e532bb22)**
>

No installation required. Runs entirely in your browser using your Claude.ai session.

---

## What it does

| Feature | Details |
|---|---|
| **Natural language → SDL** | Describe any system; the tool generates all four files |
| **Multi-turn refinement** | "Add a Redis cache", "make payment calls async" — iterates on existing SDL |
| **Live diagram** | Layered graph with Sugiyama crossing minimisation, colour-coded by kind and protocol |
| **Drag & drop layout** | Move nodes freely; edges follow live using Bezier port spreading |
| **Layout persistence** | Positions saved to `window.storage` and restored on re-open |
| **Flow highlighting** | Click a flow to highlight its path; click a step to spotlight that node |
| **Download** | Export each file individually or all four at once |

---

## How it works

The tool sends your description to the Anthropic API with a compact system prompt (~500 tokens) that encodes the full SDL schema and referential integrity rules. The model returns a JSON object; the tool validates the four required arrays, renders the diagram inline, and saves the result. For refinements, the current SDL is injected into the next API call so the model treats it as a patch instruction.

See [`PROMPT.md`](./PROMPT.md) for the full system prompt and usage notes.

---

## Output files

```
nodes.json      — services, databases, actors, queues, etc.
edges.json      — communication channels with protocol, auth, reliability
triggers.json   — what starts each flow (user action, schedule, webhook, event)
flows.json      — ordered step sequences representing use cases
```

Drop these into an SDL example folder and run the validator and renderer:

```bash
node cli/validate.js examples/my-system
node renderer/render.js examples/my-system
```

---

## Layout file round-trip

The authoring tool saves drag positions to `window.storage` (keyed by node IDs). To use those positions in the CLI renderer:

1. Add an "Export layout.json" button to the tool (or copy `nodePositions` from browser devtools)
2. Save as `examples/my-system/layout.json`:

```json
{
  "api-gateway":    { "x": 262, "y": 52  },
  "auth-service":   { "x": 472, "y": 52  },
  "order-service":  { "x": 472, "y": 192 }
}
```

The renderer auto-detects this file and overlays the saved positions on top of the computed layout:

```bash
node renderer/render.js examples/my-system
# → Layout  : loaded 8 positions from layout.json
```

You can also pass an explicit path:

```bash
node renderer/render.js examples/my-system --layout path/to/layout.json
```

---

## Self-hosting

The artifact uses `window.storage` for layout persistence, which is specific to Claude.ai. To run it as a standalone app:

1. Swap `window.storage.get/set/delete` for `localStorage.getItem/setItem/removeItem`
2. Add a backend proxy to forward API calls (the Anthropic API does not allow direct browser calls):

```js
// server.js — 15 lines with express
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
const app = express();
app.use(express.json());
app.post('/api/messages', async (req, res) => {
  const client = new Anthropic();
  const msg = await client.messages.create(req.body);
  res.json(msg);
});
app.listen(3000);
```

Then point the `fetch` URL in `sdl-author.jsx` to `http://localhost:3000/api/messages`.

---

## Files

| File | Purpose |
|---|---|
| `sdl-author.jsx` | Full React source — layout engine, renderer, chat UI, drag/drop, persistence |
| `PROMPT.md` | System prompt extracted for standalone use |
| `README.md` | This file |
