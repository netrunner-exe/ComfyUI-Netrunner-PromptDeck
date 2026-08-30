# ComfyUI-Netrunner-PromptDeck

A ComfyUI prompt node with in-workflow preset management: save, tag, and recall prompt text without leaving the node.

## Features

- Multiline prompt input, single `STRING` output (`string`).
- Save / select / delete presets directly on the node.
- Each preset can be tagged by type: `REF2V`, `FL2V`, a custom label, or no type at all.
- Preset labels include the save date, e.g. `2026-05-13 REF2V: My_preset` or `2026-05-13 My_preset` (no type).
- Presets are stored inside the workflow itself (node properties) — no external files, no server-side state.

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
3. Click **Save preset**. Enter `REF2V`, `FL2V`, a custom label, or leave the type prompt blank for no type, then enter a name.
4. Pick a saved entry from the **Preset** dropdown to load it back into the text field.
5. Select a preset and click **Delete preset** to remove it.

Saving under an existing full name (same date, type, and name) asks for confirmation before overwriting.

## How presets are stored

Presets are kept in the node's `properties.prompt_presets` array. ComfyUI/LiteGraph serializes node properties together with the rest of the graph, so presets are saved and loaded along with the workflow (`.json` file or PNG-embedded workflow) — no separate preset storage is used.

## Node reference

| | |
|---|---|
| Input | `text` — `STRING`, multiline |
| Output | `string` — `STRING` |
| Category | `utils/text` |

## Requirements

ComfyUI with support for the frontend extension API (`app.registerExtension`).
