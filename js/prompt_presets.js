import { app } from "../../scripts/app.js";
import { showFormDialog, showConfirmDialog, showAlertDialog } from "./dialog.js";
import { downloadJSON, pickJSONFile } from "./file.js";
import { loadDiskPresets, saveDiskPresets } from "./diskstore.js";

const NODE_TYPE = "PromptDeck";

const TYPES_SETTING_ID = "PromptDeck.customTypes";
const DATE_SETTING_ID = "PromptDeck.includeDate";
const LABELS_SETTING_ID = "PromptDeck.useLabels";
const DEFAULT_TYPES_SETTING = "REF2VA, FL2VA, KREA 2";
const SETTINGS_CATEGORY_ROOT = "PromptDeck";

const NO_SELECTION = "";
const EMPTY_PRESET_LABEL = "Empty preset";
const DIRTY_MARKER = "*";
const MAX_LISTED_OVERWRITES = 5;

const PICKER_STYLE =
    "width: 100%; height: 20px; box-sizing: border-box; padding: 2px 4px; background: #2a2a2a; color: #eee; border: 1px solid #555; border-radius: 4px; font-size: 11px; text-align: right;";

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function generateId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSettings() {
    const read = (id, fallback) => {
        try {
            const value = app.extensionManager?.setting?.get(id);
            return value === undefined ? fallback : value;
        } catch {
            return fallback;
        }
    };

    return {
        includeDate: read(DATE_SETTING_ID, true),
        useLabels: read(LABELS_SETTING_ID, true),
    };
}

function getKnownTypes() {
    let custom = "";
    try {
        custom = app.extensionManager?.setting?.get(TYPES_SETTING_ID) ?? "";
    } catch {
        custom = "";
    }

    return custom.split(",").map((item) => item.trim()).filter(Boolean);
}

function presetLabel(preset) {
    const settings = getSettings();
    const datePart = settings.includeDate && preset.date ? `${preset.date} ` : "";
    const typePart = settings.useLabels && preset.type ? `${preset.type}: ` : "";
    return `${datePart}${typePart}${preset.name}`;
}

function cleanLabel(value) {
    return value.startsWith(`${DIRTY_MARKER} `) ? value.slice(DIRTY_MARKER.length + 1) : value;
}

function typeDialogField(knownTypes, currentType) {
    const isKnown = knownTypes.includes(currentType);
    return {
        id: "type",
        kind: "type",
        label: "Type",
        options: knownTypes,
        defaultOption: isKnown ? currentType : "",
        defaultCustom: isKnown ? "" : currentType,
        isCustom: !isKnown,
    };
}

// Presets always live in a shared disk file (see diskstore.js), not in the
// workflow. This is an in-memory snapshot of that file for the current node.
function getPresets(node) {
    if (!Array.isArray(node._promptDeckPresets)) {
        node._promptDeckPresets = [];
    }
    return node._promptDeckPresets;
}

function findPreset(node, name) {
    return getPresets(node).find((preset) => presetLabel(preset) === name);
}

function sortedPresets(node) {
    return [...getPresets(node)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function sortedPresetLabels(node) {
    return sortedPresets(node).map(presetLabel);
}

function getTextWidget(node) {
    return node.widgets.find((widget) => widget.name === "text");
}

async function loadPresetsForNode(node) {
    try {
        node._promptDeckPresets = await loadDiskPresets();
    } catch (error) {
        await showAlertDialog(`PromptDeck: failed to load presets from disk (${error?.message || error}). Starting empty.`);
        node._promptDeckPresets = [];
    }
    node._promptDeckRefresh?.();
    node.graph?.setDirtyCanvas(true, true);
}

async function persistPresets(node) {
    try {
        await saveDiskPresets(getPresets(node));
    } catch (error) {
        await showAlertDialog(`PromptDeck: failed to save presets to disk (${error?.message || error}).`);
    }
    node.graph.setDirtyCanvas(true, true);
}

function applyPreset(node, name) {
    if (!name) return;

    if (name === EMPTY_PRESET_LABEL) {
        getTextWidget(node).value = "";
        node.graph.setDirtyCanvas(true, true);
        return;
    }

    const preset = findPreset(node, name);
    if (!preset) return;

    getTextWidget(node).value = preset.value;
    node.graph.setDirtyCanvas(true, true);
}

// Real <select>: it can only display a value that matches an existing
// <option>, so the dirty marker is a temporary synthetic option.
function updateDirtyMarker(node, selectEl) {
    const label = cleanLabel(selectEl.value);
    if (!label || label === EMPTY_PRESET_LABEL) return;

    const preset = findPreset(node, label);
    if (!preset) return;

    selectEl.querySelector('option[data-dirty="true"]')?.remove();

    const isDirty = getTextWidget(node).value !== preset.value;
    if (isDirty) {
        const option = document.createElement("option");
        option.value = `${DIRTY_MARKER} ${label}`;
        option.textContent = `${DIRTY_MARKER} ${label}`;
        option.dataset.dirty = "true";
        selectEl.insertBefore(option, selectEl.firstChild);
        selectEl.value = option.value;
    } else {
        selectEl.value = label;
    }
}

// Builds the option list: "Empty preset" followed by every saved preset,
// grouped by type. No leading blank <option> - if the current value isn't
// among the options, the browser leaves the select showing nothing selected
// on its own (selectedIndex -1), so that extra "duplicate empty" row isn't
// needed at all.
function refreshPickerOptions(node, selectEl) {
    const currentValue = cleanLabel(selectEl.value);
    selectEl.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = EMPTY_PRESET_LABEL;
    emptyOption.textContent = EMPTY_PRESET_LABEL;
    selectEl.appendChild(emptyOption);

    const groups = new Map();
    for (const preset of sortedPresets(node)) {
        const groupKey = preset.type || "No type";
        if (!groups.has(groupKey)) {
            const group = document.createElement("optgroup");
            group.label = groupKey;
            groups.set(groupKey, group);
            selectEl.appendChild(group);
        }

        const label = presetLabel(preset);
        const option = document.createElement("option");
        option.value = label;
        option.textContent = label;
        option.title = preset.value.length > 200 ? `${preset.value.slice(0, 200)}\u2026` : preset.value;
        groups.get(groupKey).appendChild(option);
    }

    const values = Array.from(selectEl.options).map((opt) => opt.value);

    // A value restored from the saved workflow (see setValue in buildPicker)
    // couldn't be applied yet if it arrived before presets were loaded from
    // disk - options exist now, so give it priority over anything else.
    const pendingValue = selectEl._promptDeckPendingValue;
    if (pendingValue != null && values.includes(pendingValue)) {
        selectEl.value = pendingValue;
        selectEl._promptDeckPendingValue = undefined;
        return;
    }

    if (values.includes(currentValue)) {
        selectEl.value = currentValue;
        return;
    }

    // Neither a restored nor a live selection is known (e.g. very first time
    // this node is created, or an old workflow saved before the picker was
    // serialized). Fall back to matching whatever text is already there.
    const textValue = getTextWidget(node).value;
    if (textValue === "") {
        selectEl.value = EMPTY_PRESET_LABEL;
        return;
    }
    const matched = getPresets(node).find((preset) => preset.value === textValue);
    selectEl.value = matched ? presetLabel(matched) : NO_SELECTION;
}

async function copyToClipboard(text) {
    if (!text) return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy fallback below
    }
    try {
        const helper = document.createElement("textarea");
        helper.value = text;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
        return true;
    } catch {
        return false;
    }
}

function flashCopyFeedback(selectEl) {
    const previousOutline = selectEl.style.outline;
    selectEl.style.outline = "2px solid #4caf50";
    setTimeout(() => {
        selectEl.style.outline = previousOutline;
    }, 350);
}

async function savePreset(node, presetSelector, refreshPicker) {
    const settings = getSettings();
    const knownTypes = getKnownTypes();
    const fields = settings.useLabels
        ? [typeDialogField(knownTypes, ""), { id: "name", label: "Name", defaultValue: "" }]
        : [{ id: "name", label: "Name", defaultValue: "" }];

    const result = await showFormDialog({ title: "Save preset", fields });
    if (!result) return;

    const name = result.name.trim();
    if (!name) {
        await showAlertDialog("Preset name cannot be empty.");
        return;
    }

    const type = settings.useLabels ? result.type : "";
    const value = getTextWidget(node).value;
    const candidate = { date: todayISO(), type, name };
    const label = presetLabel(candidate);
    const existing = findPreset(node, label);

    if (existing) {
        if (!(await showConfirmDialog(`Preset "${label}" already exists. Overwrite its value?`))) return;
        existing.value = value;
    } else {
        getPresets(node).push({ id: generateId(), ...candidate, value });
    }

    await persistPresets(node);
    refreshPicker();
    presetSelector.value = label;
}

async function updatePresetValue(node, presetSelector, refreshPicker) {
    const label = cleanLabel(presetSelector.value);
    const preset = findPreset(node, label);
    if (!preset) {
        await showAlertDialog("Select a preset to save first.");
        return;
    }

    if (!(await showConfirmDialog(`Overwrite the stored text of "${label}" with the current prompt?`))) return;

    preset.value = getTextWidget(node).value;
    await persistPresets(node);
    refreshPicker();
    presetSelector.value = label;
}

async function renamePreset(node, presetSelector, refreshPicker) {
    const currentLabel = cleanLabel(presetSelector.value);
    const preset = findPreset(node, currentLabel);
    if (!preset) {
        await showAlertDialog("Select a preset to rename first.");
        return;
    }

    const settings = getSettings();
    const knownTypes = getKnownTypes();
    const fields = settings.useLabels
        ? [typeDialogField(knownTypes, preset.type), { id: "name", label: "Name", defaultValue: preset.name }]
        : [{ id: "name", label: "Name", defaultValue: preset.name }];

    const result = await showFormDialog({ title: "Rename preset", fields });
    if (!result) return;

    const name = result.name.trim();
    if (!name) {
        await showAlertDialog("Preset name cannot be empty.");
        return;
    }

    const type = settings.useLabels ? result.type : "";
    const newLabel = presetLabel({ date: preset.date, type, name });
    const collision = getPresets(node).find((other) => other.id !== preset.id && presetLabel(other) === newLabel);
    if (collision) {
        await showAlertDialog(`Preset "${newLabel}" already exists.`);
        return;
    }

    preset.type = type;
    preset.name = name;
    await persistPresets(node);
    refreshPicker();
    presetSelector.value = newLabel;
}

async function deletePreset(node, presetSelector, refreshPicker) {
    const label = cleanLabel(presetSelector.value);
    if (!label) {
        await showAlertDialog("Select a preset to delete first.");
        return;
    }

    if (!(await showConfirmDialog(`Delete preset "${label}"?`))) return;

    node._promptDeckPresets = getPresets(node).filter((preset) => presetLabel(preset) !== label);
    await persistPresets(node);
    refreshPicker();
    presetSelector.value = NO_SELECTION;
}

async function exportAllPresets(node) {
    try {
        await downloadJSON(`promptdeck-presets-${todayISO()}.json`, getPresets(node));
    } catch (error) {
        await showAlertDialog(`PromptDeck: export failed (${error?.message || error}).`);
    }
}

async function exportSinglePreset(node, preset) {
    const safeName = preset.name.replace(/[^a-zA-Z0-9_-]+/g, "_") || "preset";
    try {
        await downloadJSON(`promptdeck-${safeName}-${todayISO()}.json`, [preset]);
    } catch (error) {
        await showAlertDialog(`PromptDeck: export failed (${error?.message || error}).`);
    }
}

function formatOverwriteList(items) {
    const shown = items.slice(0, MAX_LISTED_OVERWRITES).map((item) => `- ${presetLabel(item)}`);
    const remaining = items.length - MAX_LISTED_OVERWRITES;
    if (remaining > 0) shown.push(`- ...and ${remaining} more`);
    return shown.join("\n");
}

async function importPresets(node, refreshPicker) {
    const text = await pickJSONFile();
    if (text === null) return;

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        await showAlertDialog("Invalid JSON file.");
        return;
    }

    if (!Array.isArray(parsed)) {
        await showAlertDialog("Expected a JSON array of presets.");
        return;
    }

    const incoming = [];
    for (const item of parsed) {
        const name = typeof item?.name === "string" ? item.name.trim() : "";
        if (!name) continue;

        incoming.push({
            date: typeof item.date === "string" && item.date ? item.date : todayISO(),
            type: typeof item.type === "string" ? item.type.trim() : "",
            name,
            value: typeof item.value === "string" ? item.value : "",
        });
    }

    if (!incoming.length) {
        await showAlertDialog("No valid presets found in the file.");
        return;
    }

    const existingPresets = getPresets(node);
    const overwritten = incoming.filter((item) => existingPresets.some((preset) => presetLabel(preset) === presetLabel(item)));

    if (overwritten.length) {
        const confirmed = await showConfirmDialog(
            `This will overwrite ${overwritten.length} existing preset(s):\n\n${formatOverwriteList(overwritten)}\n\nContinue?`
        );
        if (!confirmed) return;
    }

    let added = 0;
    let replaced = 0;

    for (const item of incoming) {
        const label = presetLabel(item);
        const existing = existingPresets.find((preset) => presetLabel(preset) === label);
        if (existing) {
            existing.date = item.date;
            existing.type = item.type;
            existing.name = item.name;
            existing.value = item.value;
            replaced += 1;
        } else {
            existingPresets.push({ id: generateId(), ...item });
            added += 1;
        }
    }

    await persistPresets(node);
    refreshPicker?.();
    await showAlertDialog(`Imported ${added} new, updated ${replaced} existing preset(s).`);
}

function addFixedHeightDOMWidget(node, name, element, height) {
    const widget = node.addDOMWidget(name, "custom", element, {
        getMinHeight: () => height,
        getMaxHeight: () => height,
        getHeight: () => height,
    });
    if (widget) widget.serialize = false;
    return widget;
}

// The dropdown itself is a plain native <select> again (grouped by type,
// hover preview via title) - untouched from how it originally worked.
// To drop the separate "Selected preset name" field while still letting you
// grab the name, right-click (context menu) on the picker copies the current
// selection's name to the clipboard instead of opening the browser's menu.
//
// Unlike addFixedHeightDOMWidget, this widget is NOT serialize:false - it
// defines getValue/setValue so ComfyUI saves/restores which preset was
// selected as part of the workflow, like any normal widget. setValue can
// arrive before presets have finished loading from disk (and so before any
// matching <option> exists yet); in that case the value is stashed on the
// element and applied later by refreshPickerOptions once options are real.
function buildPicker(node, onApply) {
    const selectEl = document.createElement("select");
    selectEl.style.cssText = PICKER_STYLE;
    selectEl.title = "Right-click to copy the preset name";

    node.addDOMWidget("prompt_deck_preset_picker", "custom", selectEl, {
        getMinHeight: () => 26,
        getMaxHeight: () => 26,
        getHeight: () => 26,
        getValue: () => cleanLabel(selectEl.value),
        setValue: (value) => {
            const wanted = value || NO_SELECTION;
            const values = Array.from(selectEl.options).map((opt) => opt.value);
            if (values.includes(wanted)) {
                selectEl.value = wanted;
                selectEl._promptDeckPendingValue = undefined;
            } else {
                selectEl._promptDeckPendingValue = wanted;
            }
        },
    });

    selectEl.addEventListener("change", () => {
        const dirtyOption = selectEl.querySelector('option[data-dirty="true"]');
        if (dirtyOption && selectEl.value !== dirtyOption.value) dirtyOption.remove();
        onApply(cleanLabel(selectEl.value));
    });

    selectEl.addEventListener("contextmenu", async (event) => {
        event.preventDefault();
        const label = cleanLabel(selectEl.value);
        if (!label) return;
        if (await copyToClipboard(label)) flashCopyFeedback(selectEl);
    });

    const refresh = () => refreshPickerOptions(node, selectEl);
    refresh();

    return { element: selectEl, refresh };
}

// A blank DOM widget of its own, used purely to reserve extra vertical space
// between two other widgets. Kept separate from the picker itself because
// changing the picker's own declared height turned out to also shift the
// gap ABOVE it (likely due to how ComfyUI redistributes space when the
// node's total content height changes) - an isolated spacer avoids that.
function addSpacer(node, height) {
    const spacer = document.createElement("div");
    addFixedHeightDOMWidget(node, "prompt_deck_picker_spacer", spacer, height);
}

const BUTTON_HEIGHT = 24;
const BUTTON_ROW_GAP = 6; // gap between Save as new / Save / Rename
const BUTTON_STACK_GAP = 8; // gap between that row and Delete
const BUTTON_STYLE =
    `box-sizing: border-box; height: ${BUTTON_HEIGHT}px; padding: 0 8px; background: #353535; color: #ddd; border: 1px solid #4a4a4a; border-radius: 4px; font-size: 11px; line-height: ${BUTTON_HEIGHT - 2}px; text-align: center; white-space: nowrap; cursor: pointer;`;

function createButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = BUTTON_STYLE;
    button.addEventListener("mouseenter", () => (button.style.background = "#454545"));
    button.addEventListener("mouseleave", () => (button.style.background = "#353535"));
    button.addEventListener("click", onClick);
    return button;
}

// Save as new / Save / Rename sit in one flex row (each sized to its own
// label, then sharing any leftover width evenly, so "Save as new" isn't
// cramped); Delete sits on its own row underneath, full width. All in a
// single DOM widget so the gap between the row and Delete is real CSS
// spacing under our control, not something LiteGraph has to cooperate with.
function addButtonPanel(node, handlers) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "width: 100%; box-sizing: border-box;";

    const row = document.createElement("div");
    row.style.cssText = `display: flex; gap: ${BUTTON_ROW_GAP}px; width: 100%; box-sizing: border-box;`;

    for (const [label, handler] of [
        ["Save as new", handlers.saveNew],
        ["Save", handlers.save],
        ["Rename", handlers.rename],
    ]) {
        const button = createButton(label, handler);
        button.style.flex = "1 1 auto";
        row.appendChild(button);
    }

    const deleteButton = createButton("Delete", handlers.delete);
    deleteButton.style.width = "100%";
    deleteButton.style.marginTop = `${BUTTON_STACK_GAP}px`;

    wrapper.append(row, deleteButton);

    const totalHeight = BUTTON_HEIGHT * 2 + BUTTON_STACK_GAP;
    addFixedHeightDOMWidget(node, "prompt_deck_button_panel", wrapper, totalHeight);
}

function addPresetWidgets(node) {
    const onApply = (value) => applyPreset(node, value);

    const picker = buildPicker(node, onApply);
    const presetSelector = picker.element;
    const refreshPicker = picker.refresh;

    // Gap between the dropdown and the button row - tune this number
    // directly if it still looks too tight/loose.
    addSpacer(node, 14);

    getTextWidget(node).inputEl?.addEventListener("input", () => {
        updateDirtyMarker(node, presetSelector);
    });

    addButtonPanel(node, {
        saveNew: () => savePreset(node, presetSelector, refreshPicker),
        save: () => updatePresetValue(node, presetSelector, refreshPicker),
        rename: () => renamePreset(node, presetSelector, refreshPicker),
        delete: () => deletePreset(node, presetSelector, refreshPicker),
    });

    node._promptDeckSelector = presetSelector;
    node._promptDeckRefresh = refreshPicker;

    loadPresetsForNode(node);

    const size = node.computeSize();
    node.setSize([Math.max(size[0], 300), Math.max(size[1], 220)]);
}

app.registerExtension({
    name: "custom.PromptDeck",
    settings: [
        {
            id: TYPES_SETTING_ID,
            name: "Custom preset types",
            category: [SETTINGS_CATEGORY_ROOT, "General", "Custom preset types"],
            type: "text",
            defaultValue: DEFAULT_TYPES_SETTING,
            tooltip: "Comma-separated list of preset types offered in the Save/Rename dialog.",
        },
        {
            id: DATE_SETTING_ID,
            name: "Add date before name",
            category: [SETTINGS_CATEGORY_ROOT, "General", "Add date before name"],
            type: "boolean",
            defaultValue: true,
            tooltip: "Prefix each preset's label with its save date.",
        },
        {
            id: LABELS_SETTING_ID,
            name: "Use labels",
            category: [SETTINGS_CATEGORY_ROOT, "General", "Use labels"],
            type: "boolean",
            defaultValue: true,
            tooltip: "Show the type dropdown/custom field in Save and Rename dialogs, and the type in preset labels.",
        },
    ],
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            addPresetWidgets(this);
        };

        const onExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            onExtraMenuOptions?.apply(this, arguments);
            const node = this;

            const presetSelector = node._promptDeckSelector;
            const currentLabel = presetSelector ? cleanLabel(presetSelector.value) : "";
            const currentPreset = currentLabel ? findPreset(node, currentLabel) : null;

            if (currentPreset) {
                options.push({
                    content: `PromptDeck: Export ${currentPreset.name}`,
                    callback: () => exportSinglePreset(node, currentPreset),
                });
            }

            options.push(
                { content: "PromptDeck: Export all", callback: () => exportAllPresets(node) },
                { content: "PromptDeck: Import presets", callback: () => importPresets(node, node._promptDeckRefresh) }
            );
        };
    },
});
