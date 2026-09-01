# ComfyUI-PromptDeck

A prompt node with built-in preset management — save, tag, rename, and recall prompt text without leaving the node.

## Features

- Multiline prompt input, single `STRING` output (`string`).
- A dropdown of saved presets, sorted newest first and grouped by type, plus **Save as new** / **Save** / **Rename** / **Delete** buttons.
- Right-click the dropdown to copy the selected preset's name to the clipboard.
- Save/Rename open a small dialog for the preset's type and name (only if "Use labels" is on — see Settings):
  - No configured types → just a **Custom label** text field.
  - Configured types → a dropdown of those types plus a **Custom label** option, which activates the text field once selected.
- Right-click the node itself for **Export `<preset name>`** (only when a preset is selected), **Export all**, and **Import presets**. Export uses the browser's native Save-As dialog where available, otherwise a plain download; Import opens the native file picker and warns you before overwriting any existing presets.

## Settings

Under **PromptDeck** in ComfyUI Settings:

- **Custom preset types** — comma-separated list offered in the Save/Rename dialog.
- **Add date before name** (on) — prefixes each preset's label with its save date, e.g. `2026-05-13 My_preset`. Off drops the date from labels and from the overwrite-collision check.
- **Use labels** (on) — shows the type field in Save/Rename and includes the type in labels. Off hides that field and presets save without a type.

## Usage

1. Add the **PromptDeck** node (category: `utils/text`).
2. Type a prompt into the text field.
3. **Save as new** — opens the dialog, then stores the current text as a new preset.
4. Pick a preset from the dropdown — applies its text to the field.
5. **Save** — overwrites the selected preset's stored text with whatever's currently in the field. Date, type, and name are untouched.
6. **Rename** — changes the type and/or name of the selected preset. Date and stored text are untouched.
7. **Delete** — removes the selected preset.
8. Right-click the node for export/import.

Saving under a type/name that already exists for the same date asks before overwriting; a different date creates a new, separately dated entry instead.

## How presets are stored

The preset library itself is **not** part of the workflow — it lives in one shared file, `user/default/prompt_deck/global_presets.json`, read and written through ComfyUI's `/userdata` API. Every PromptDeck node, in every workflow, reads and writes the same file, so a preset saved from one workflow shows up in all the others. Concurrent saves are last-write-wins, no merging.

Each preset entry has the shape `{ id, date, type, name, value }`.

## Node reference

| | |
|---|---|
| Input | `text` — `STRING`, multiline |
| Output | `string` — `STRING` |
| Category | `utils/text` |
