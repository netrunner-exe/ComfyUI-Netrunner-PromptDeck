import { app } from "../../scripts/app.js";

const NODE_TYPE = "PromptDeck";
const PROPERTY_KEY = "prompt_presets";
const NO_SELECTION = "";
const KNOWN_TYPES = ["REF2V", "FL2V", "KREA2"];

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function normalizeType(input) {
    const trimmed = input.trim();
    if (!trimmed) return "";

    const upper = trimmed.toUpperCase();
    return KNOWN_TYPES.includes(upper) ? upper : trimmed;
}

function promptPresetType(defaultValue = "") {
    const input = window.prompt(
        `Preset type — ${KNOWN_TYPES.join(", ")}, a custom label, or leave blank for none:`,
        defaultValue
    );
    if (input === null) return undefined;
    return normalizeType(input);
}

function presetLabel(preset) {
    const typePart = preset.type ? `${preset.type}: ` : "";
    return `${preset.date} ${typePart}${preset.name}`;
}

function getPresets(node) {
    if (!Array.isArray(node.properties[PROPERTY_KEY])) {
        node.properties[PROPERTY_KEY] = [];
    }
    return node.properties[PROPERTY_KEY];
}

function findPreset(node, name) {
    return getPresets(node).find((preset) => presetLabel(preset) === name);
}

function presetNames(node) {
    return getPresets(node).map(presetLabel);
}

function getTextWidget(node) {
    return node.widgets.find((widget) => widget.name === "text");
}

function savePreset(node, presetSelector) {
    const textWidget = getTextWidget(node);
    const type = promptPresetType();
    if (type === undefined) return;

    const name = window.prompt("Preset name:", "");
    if (!name) return;

    const preset = { date: todayISO(), type, name, value: textWidget.value };
    const label = presetLabel(preset);
    const existing = findPreset(node, label);

    if (existing) {
        if (!window.confirm(`Preset "${label}" already exists. Overwrite its value?`)) return;
        existing.value = preset.value;
    } else {
        getPresets(node).push(preset);
    }

    presetSelector.value = label;
    node.graph.setDirtyCanvas(true, true);
}

function updatePresetValue(node, presetSelector) {
    const label = presetSelector.value;
    if (!label) {
        window.alert("Select a preset to update first.");
        return;
    }

    const preset = findPreset(node, label);
    if (!preset) return;

    if (!window.confirm(`Overwrite the stored text of "${label}" with the current prompt? Date and name stay the same.`)) return;

    preset.value = getTextWidget(node).value;
    node.graph.setDirtyCanvas(true, true);
}

function renamePreset(node, presetSelector) {
    const label = presetSelector.value;
    if (!label) {
        window.alert("Select a preset to rename first.");
        return;
    }

    const preset = findPreset(node, label);
    if (!preset) return;

    const type = promptPresetType(preset.type);
    if (type === undefined) return;

    const name = window.prompt("Preset name:", preset.name);
    if (!name) return;

    const newLabel = presetLabel({ ...preset, type, name });
    if (newLabel !== label && findPreset(node, newLabel)) {
        window.alert(`Preset "${newLabel}" already exists.`);
        return;
    }

    preset.type = type;
    preset.name = name;
    presetSelector.value = newLabel;
    node.graph.setDirtyCanvas(true, true);
}

function deletePreset(node, presetSelector) {
    const label = presetSelector.value;
    if (!label) {
        window.alert("Select a preset to delete first.");
        return;
    }

    if (!window.confirm(`Delete preset "${label}"?`)) return;

    node.properties[PROPERTY_KEY] = getPresets(node).filter((preset) => presetLabel(preset) !== label);
    presetSelector.value = NO_SELECTION;
    node.graph.setDirtyCanvas(true, true);
}

function applyPreset(node, name) {
    if (!name) return;
    const preset = findPreset(node, name);
    if (!preset) return;

    getTextWidget(node).value = preset.value;
    node.graph.setDirtyCanvas(true, true);
}

function addPresetWidgets(node) {
    getPresets(node);

    const presetSelector = node.addWidget(
        "combo",
        "Preset",
        NO_SELECTION,
        (value) => applyPreset(node, value),
        { values: () => [NO_SELECTION, ...presetNames(node)] }
    );
    presetSelector.serialize = false;

    const saveButton = node.addWidget("button", "Save preset", null, () => {
        savePreset(node, presetSelector);
    });
    saveButton.serialize = false;

    const updateButton = node.addWidget("button", "Update preset value", null, () => {
        updatePresetValue(node, presetSelector);
    });
    updateButton.serialize = false;

    const renameButton = node.addWidget("button", "Rename preset", null, () => {
        renamePreset(node, presetSelector);
    });
    renameButton.serialize = false;

    const deleteButton = node.addWidget("button", "Delete preset", null, () => {
        deletePreset(node, presetSelector);
    });
    deleteButton.serialize = false;

    node.setSize(node.computeSize());
}

app.registerExtension({
    name: "custom.PromptDeck",
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            addPresetWidgets(this);
        };
    },
});
