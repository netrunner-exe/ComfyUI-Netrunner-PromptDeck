# ComfyUI-Netrunner-PromptDeck

A ComfyUI prompt node with in-workflow preset management: save, tag, and recall prompt text without leaving the node.

## Features

- Multiline prompt input, single `STRING` output (`string`).
- Save, update, rename, select, and delete presets directly on the node.
- Each preset can be tagged by type: `REF2V`, `FL2V`, `KREA2`, a custom label, or no type at all.
- Preset labels include the save date, e.g. `2026-05-13 REF2V: My_preset` or `2026-05-13 My_preset` (no type).
- Presets are stored inside the workflow itself (node properties) — no external files, no server-side state.
- Renaming or updating a preset's stored text does **not** touch its original save date.

## Installation

```bash
cd ComfyUI/custom_nodes
git clone <repo-url> ComfyUI-Netrunner-PromptDeck
```

Or download and unzip a release into `ComfyUI/custom_nodes/ComfyUI-Netrunner-PromptDeck`.

Restart ComfyUI after installing.

## Usage

1. Add the **ComfyUI-Netrunner-PromptDeck** node (category: `utils/text`).
2. Type a prompt into the text field.
3. **Save preset** — stores the current text as a *new* preset dated today. Prompts for type (`REF2V`, `FL2V`, `KREA2`, a custom label, or blank for none) and name.
4. **Preset** dropdown — loads a saved preset's text into the text field.
5. **Update preset value** — overwrites the *stored text* of the currently selected preset with the current text field content. Date, type, and name are left untouched.
6. **Rename preset** — changes the type and/or name of the currently selected preset. Date and stored text are left untouched; leave a field at its default in the prompt to keep it unchanged.
7. **Delete preset** — removes the currently selected preset.

Saving under a type/name combination that already exists *for today's date* asks for confirmation before overwriting; on a different day it creates a new, separately dated entry instead of silently duplicating or overwriting older presets.

Saving under an existing full name (same date, type, and name) asks for confirmation before overwriting.

## How presets are stored

Presets are kept in the node's `properties.prompt_presets` array. ComfyUI/LiteGraph serializes node properties together with the rest of the graph, so presets are saved and loaded along with the workflow (`.json` file or PNG-embedded workflow) — no separate preset storage is used.

Each entry has the shape `{ date, type, name, value }`. If a workflow was saved with an earlier version of this node that stored presets differently, its presets will need to be re-saved after upgrading.

## Node reference

| | |
|---|---|
| Input | `text` — `STRING`, multiline |
| Output | `string` — `STRING` |
| Category | `utils/text` |

## Requirements

ComfyUI with support for the frontend extension API (`app.registerExtension`).
