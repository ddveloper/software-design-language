# Contributing to SDL

First off — thank you for taking the time to contribute. SDL is an early-stage project and every bit of feedback, discussion, and code genuinely matters at this point.

This document explains how to get involved, what kinds of contributions are most valuable right now, and how the process works.

---

## What Kind of Project Is This Right Now?

SDL is in **early design stage**. The specification is not finalized. This means:

- The most valuable contributions are **ideas and feedback**, not pull requests
- Breaking changes to the schema can and will happen before v1.0
- There are no wrong questions — if something is confusing, that's a bug in the spec

If you're here to debate design decisions, propose new primitives, or poke holes in the model — that's exactly what's needed.

---

## Ways to Contribute

### 1. Open an Issue to Discuss the Spec

This is the highest-value contribution right now. If you:

- Think a concept is missing or wrong
- Have a real system that doesn't model well in SDL
- Disagree with a schema decision and have a better idea
- Just have a question about how something is supposed to work

→ **Open an issue.** Label it `spec` or `discussion`.

Good spec discussions are concrete. If you can bring a real example — even a rough sketch of a system you've worked on — the discussion will be much more productive than abstract debate.

### 2. Contribute an Example

The `examples/` folder is the best place to show what SDL can and can't do. A good example:

- Models a real, recognizable system (e-commerce checkout, auth flow, data pipeline, etc.)
- Includes both schema files (nodes, edges, triggers) and at least one flow
- Has a short `README.md` explaining what the system does

You don't need to wait for the spec to be perfect. Rough examples that expose spec gaps are just as valuable as polished ones.

### 3. Improve the Documentation

If something in the spec or README is unclear, a PR that improves the wording is always welcome. No issue needed for small doc fixes — just open a PR.

### 4. Build Tooling

Once the core spec stabilizes, there's a lot of tooling to build:

- CLI validator / linter
- Renderers (web, Mermaid export, PlantUML export)
- IDE extensions (VS Code schema support, autocomplete)
- AI context integrations

If you want to start on something, **open an issue first** to discuss scope and avoid duplicate work.

---

## How to Submit a Pull Request

1. **Fork** the repository and create a branch from `main`
   ```
   git checkout -b your-feature-or-fix
   ```

2. **Make your changes.** Keep PRs focused — one concern per PR is much easier to review than several things bundled together.

3. **Describe what you did and why** in the PR description. For spec changes especially, explain the reasoning — what problem does this solve, what tradeoffs did you consider?

4. **Open the PR** and link any related issue with `Closes #123` or `Related to #123`.

5. A maintainer will review and respond. Expect back-and-forth on design decisions — that's normal and healthy.

---

## Issue and PR Labels

| Label | Meaning |
|---|---|
| `spec` | Discussion about the SDL specification itself |
| `discussion` | Open-ended question or idea |
| `tooling` | CLI, renderer, IDE plugins |
| `example` | New or improved example systems |
| `docs` | Documentation improvements |
| `good first issue` | Good entry point for new contributors |
| `breaking change` | Would require updates to existing SDL files |

---

## Design Principles

When proposing changes, keep these principles in mind. A good contribution moves SDL closer to these goals:

**Separation of concerns** — schema, semantics, and presentation are three distinct layers and should stay that way. Design data should never live in a theme file.

**Human and machine readable** — SDL files should be legible to a developer reading them directly, and parseable by tools without ambiguity.

**Extensible by default** — prefer open enums over closed ones. SDL should have a useful standard vocabulary without trapping users inside it.

**References over duplication** — SDL should reference other specs (OpenAPI, Avro, Protobuf) rather than reinvent them.

**Design intent, not implementation detail** — SDL is not a deployment spec, not a config format, not a process engine. When a proposal starts looking like those things, that's a signal it belongs in a different layer.

---

## Code of Conduct

This project follows a simple rule: **be constructive**. Disagreement about design decisions is expected and welcome. Personal attacks are not. Anyone who can't tell the difference will be removed.

---

## Questions?

Open an issue with the `discussion` label. There are no dumb questions at this stage of the project.
