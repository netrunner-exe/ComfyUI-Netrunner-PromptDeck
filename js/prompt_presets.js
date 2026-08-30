import { app } from "../../scripts/app.js";

const NODE_TYPE = "ComfyUI-Netrunner-PromptDeck";
const PROPERTY_KEY = "prompt_presets";
const NO_SELECTION = "";

function todayISO() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function promptPresetType() {
    const input = window.prompt(
        "Preset type — REF2V, FL2V, a custom label, or leave blank for none:",
        ""
    );
    if (input === null) return undefined;

    const trimmed = input.trim();
    if (!trimmed) return "";

    const upper = trimmed.toUpperCase();
    if (upper === "REF2V" || upper === "FL2V") return upper;
    return trimmed;
}

function getPresets(node) {
    if (!Array.isArray(node.properties[PROPERTY_KEY])) {
        node.properties[PROPERTY_KEY] = [];
    }
    return node.properties[PROPERTY_KEY];
}

function findPreset(node, name) {
    return getPresets(node).find((preset) => preset.name === name);
}

function presetNames(node) {
    return getPresets(node).map((preset) => preset.name);
}

function getTextWidget(node) {
    return node.widgets.find((widget) => widget.name === "text");
}

function savePreset(node, presetSelector) {
    const textWidget = getTextWidget(node);
    const type = promptPresetType();
    if (type === undefined) return;

    const baseName = window.prompt("Preset name:", "");
    if (!baseName) return;

    const label = type ? `${type}: ${baseName}` : baseName;
    const name = `${todayISO()} ${label}`;
    const presets = getPresets(node);
    const existing = findPreset(node, name);

    if (existing) {
        const overwrite = window.confirm(`Preset "${name}" already exists. Overwrite?`);
        if (!overwrite) return;
        existing.value = textWidget.value;
    } else {
        presets.push({ name, value: textWidget.value });
    }

    presetSelector.value = name;
    node.graph.setDirtyCanvas(true, true);
}

function deletePreset(node, presetSelector) {
    const name = presetSelector.value;
    if (!name) {
        window.alert("Select a preset to delete first.");
        return;
    }

    if (!window.confirm(`Delete preset "${name}"?`)) return;

    node.properties[PROPERTY_KEY] = getPresets(node).filter((preset) => preset.name !== name);
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

    const deleteButton = node.addWidget("button", "Delete preset", null, () => {
        deletePreset(node, presetSelector);
    });
    deleteButton.serialize = false;

    node.setSize(node.computeSize());
}

app.registerExtension({
    name: "custom.NetrunnerPromptDeck",
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);
            addPresetWidgets(this);
        };
    },
});
