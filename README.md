# Nexus-7 Architect

**A multi-agent app factory. Describe an app in plain English; Nexus-7 writes, type-checks, repairs and builds it — then hands you a running preview, a Git history and an Android APK.**

Built by **Tersoo Uganden** · THEAFFILMTISER Research · Abuja, Nigeria

> This repo is the control-room UI. The engine lives in `nexus-7-backend` (Node + PostgreSQL + Gemini).

---

## Why it exists

Most "AI app builders" stop at a code dump. Nexus-7 treats generation as a production line with quality gates: a project only ships if it compiles. It runs locally on a laptop, on a free model tier, so a single builder can turn briefs into working apps for Nigerian and African markets — fintech, logistics, education, agriculture, compliance.

Apps already produced with it include **OmniCipher** and an **AI Ad Optimisation & Personalisation** tool.

## How the factory works

```
Brief (text, PDF, Word or Markdown)
   │
   ▼
1. Contract   → shared types and module signatures every agent must honour
2. Agents     → UI, Logic and Data agents write their modules in parallel
3. Scaffold   → Vite + Capacitor project template
4. Verify     → static analysis + tsc --noEmit
5. Repair     → agents read the compiler errors and fix their own code
6. Build      → vite build → live preview in the dashboard
```

Every stage streams live to the UI over Server-Sent Events, with per-run token usage, cost estimate and stage timings.

## What you can do from the control room

| Area | Capability |
|---|---|
| **App Factory** | Generate from a brief or saved template · choose Flash or Pro model · watch stages live |
| **Refine** | Ask for a change in plain English ("add a settings screen to switch USD → NGN"), with full undo history |
| **Preview** | Run the app in desktop and mobile viewports inside a sandboxed frame |
| **Ship** | Download a zip · push to a private GitHub repo · build an Android APK |
| **Developer agents** | Code Reviewer, Project Planner, Debugger, Database Designer, UI/UX Critic, Security Auditor, Deployment Guide, Docs Writer — each can be pointed at a generated project for context, with conversation memory |
| **Guard** | Prompt-injection scrubbing, secret redaction and a directive size cap; blocked attempts are logged and shown |
| **Telemetry** | Every dispatch, latency and block recorded to PostgreSQL |

## Human in the loop

Nothing leaves the machine without the builder: generated code is reviewable file by file, every refinement is a Git commit that can be undone, and GitHub push and APK builds are explicit actions. Network mode adds an access-key login gate.

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · Framer Motion · react-markdown — backend: Node, PostgreSQL, Google Gemini, Capacitor for Android.

## Run it locally

```bash
# 1. start nexus-7-backend on port 8080 (needs GEMINI_API_KEY in its .env)
# 2. then:
npm install
npm run dev          # http://localhost:5173 — /api and /preview proxy to the backend
```

Set `BACKEND_URL` if the backend runs on another port.

## Roadmap

- Portfolio of Africa-focused apps built through the factory (AfCFTA compliance co-pilot, WAEC/JAMB tutor, Pidgin voice bookkeeping, crop-disease detection)
- Benchmark runs against a fixed set of briefs to track first-pass compile rate and repair cost

---

© Tersoo Uganden. All rights reserved.
