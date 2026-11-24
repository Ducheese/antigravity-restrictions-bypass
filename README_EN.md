# Antigravity Restrictions Bypass

[English](README_EN.md) | [中文](README.md)

This repository documents the reverse engineering analysis, defense mechanism deconstruction, post-mortem validations, and patch tooling for internal restrictions inside the Google Antigravity CLI (`agy.exe`).

---

## Topics Index

| Topic | Status | Core Mechanism | Solution / Finding | Documentation |
| :--- | :---: | :--- | :--- | :--- |
| **Topic 1: Context Capacity Expansion & Compaction Threshold Postponement**<br>*(Checkpointer & Context Window)* | ✅ Resolved<br>(Dynamic Trampoline) | The official backend forcibly overrides the ceiling to 256k at the final exit of `applyFeatureProviderCheckpointOverrideConfig` | Mounts a dynamic assembly trampoline via an unreferenced setter at the final configuration merge exit; preserves native `hooks.checkpointNeeded` safety airbag; supports three tiers (512K / 734K / 983K) | [01-context-compaction-interception.md](docs/01-context-compaction-interception.md) |
| **Topic 2: Removing Workspace Rules Truncation**<br>*(GEMINI.md / CLAUDE.md Rules)* | ✅ Resolved<br>(Dynamic Alignment) | Rule injection enforces a two-layer hardcoded barrier: layer 1 truncates single files at newline when crossing 24,000 bytes; layer 2 completely drops the ruleset if aggregate tokens exceed 20,000 | Dynamic symbol resolution via Go `pclntab`; expands single files to 1MB and aggregate rule budget to 131,072 tokens; zero control flow disruption; paired with canary probes | [02-workspace-rules-truncation-bypass.md](docs/02-workspace-rules-truncation-bypass.md) |

---

## Script Catalog (`scripts/`)

- **[patch-context.py](scripts/patch-context.py)**: **Universal Dynamic Patcher** (Python 3, standard library only, zero external dependencies). Utilizes Go `pclntab` dynamic symbol resolution and exit trampoline mounting. A single script simultaneously handles **Context Expansion** (postponing the 256K compaction trigger to 512K/734K/983K) and **Rules Limit Relaxation** (expanding single-file rule limits to 1MB and total rule budget to 131K tokens).
  - Supports three presets: **Tier 1 (512K Recommended Mainline)**, **Tier 2 (734K High Capacity)**, and **Tier 3 (983K Ultra Long Context)**.
  - `python scripts/patch-context.py --status`: Read-only preflight check for detected backend binaries and recent active session SQLite metadata.
  - `python scripts/patch-context.py --tier 1 -y`: One-click patch for 512K recommended tier + rule limit relaxation (default full patch).
  - `python scripts/patch-context.py --tier 1 --skip-rules -y`: Patch context only, leaving rule limits untouched.
  - `python scripts/patch-context.py --restore -y`: One-click restore to pristine official original binaries.
- **[verify_session.py](scripts/verify_session.py)**: **Low-Level Session Metadata Verifier** (Python 3). Directly decodes SQLite `gen_metadata` and `executor_metadata` protobuf binaries to display the live turn request token budget and progress bar.

---

## Architectural Principles & Red Lines

1. **Zero Control Flow Disruption**:
   Never alter branch or jump instructions (`cmp`, `jle`, `jmp`, `cmov`). Only expand immediate integer constants using identical instruction lengths, strictly preserving Go runtime calling conventions, stack alignment, and traceback chains.
2. **Atomic File Replacement**:
   On Windows, running executables are protected by OS file locks. Safe replacement must be performed via two-step atomic renaming (`rename` running binary -> write new binary).
3. **Backup First & Canary Probe**:
   Pristine official backups and SHA-256 hashes must always be verified prior to modification. Deploy a canary probe string (e.g. `AGY-CANARY-OMEGA-483`) at the end of workspace rules to immediately detect if rules are truncated by the engine.
