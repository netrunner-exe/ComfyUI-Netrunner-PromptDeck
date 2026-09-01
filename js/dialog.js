const OVERLAY_STYLE =
    "position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 10000;";
const PANEL_STYLE =
    "background: #1e1e1e; color: #eee; border: 1px solid #444; border-radius: 8px; padding: 16px; min-width: 320px; max-width: 480px; max-height: 80vh; overflow-y: auto; font-family: sans-serif; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);";
const HEADING_STYLE = "margin: 0 0 12px 0; font-size: 14px;";
const LABEL_STYLE = "display: block; margin-top: 8px; font-size: 12px; opacity: 0.8;";
const INPUT_STYLE =
    "width: 100%; box-sizing: border-box; padding: 6px 8px; margin-top: 4px; background: #2a2a2a; color: #eee; border: 1px solid #555; border-radius: 4px; font-family: inherit;";
const ACTIONS_STYLE = "display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px;";
const SECONDARY_BUTTON_STYLE =
    "padding: 6px 12px; border-radius: 4px; border: 1px solid #555; background: #2a2a2a; color: #eee; cursor: pointer;";
const PRIMARY_BUTTON_STYLE = "padding: 6px 12px; border-radius: 4px; border: none; background: #4a7dff; color: #fff; cursor: pointer;";
const MESSAGE_STYLE = "font-size: 13px; line-height: 1.4; white-space: pre-line;";
const CUSTOM_VALUE = "__custom__";

function createOverlay() {
    const overlay = document.createElement("div");
    overlay.style.cssText = OVERLAY_STYLE;
    const panel = document.createElement("div");
    panel.style.cssText = PANEL_STYLE;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return { overlay, panel };
}

function addHeading(panel, title) {
    const heading = document.createElement("h3");
    heading.textContent = title;
    heading.style.cssText = HEADING_STYLE;
    panel.appendChild(heading);
}

function addTextField(panel, field) {
    const label = document.createElement("label");
    label.textContent = field.label;
    label.style.cssText = LABEL_STYLE;
    panel.appendChild(label);

    const input = document.createElement("input");
    input.type = "text";
    input.value = field.defaultValue ?? "";
    input.style.cssText = INPUT_STYLE;
    panel.appendChild(input);

    return { element: input, getValue: () => input.value };
}

// Renders either a plain "Custom label" text input (when no known types are
// configured) or a dropdown of known types plus a "Custom label" option next
// to a text input that only activates once "Custom label" is selected.
function addTypeField(panel, field) {
    const label = document.createElement("label");
    label.textContent = field.label;
    label.style.cssText = LABEL_STYLE;
    panel.appendChild(label);

    const knownTypes = field.options || [];

    if (knownTypes.length === 0) {
        const custom = document.createElement("input");
        custom.type = "text";
        custom.placeholder = "Custom label";
        custom.style.cssText = INPUT_STYLE;
        custom.value = field.defaultCustom ?? "";
        panel.appendChild(custom);
        return { element: custom, getValue: () => custom.value.trim() };
    }

    const row = document.createElement("div");
    row.style.cssText = "display: flex; gap: 6px; margin-top: 4px;";

    const select = document.createElement("select");
    select.style.cssText = `${INPUT_STYLE} margin-top: 0; flex: 0 0 auto; width: 42%;`;

    knownTypes.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
    });

    const customOption = document.createElement("option");
    customOption.value = CUSTOM_VALUE;
    customOption.textContent = "Custom label";
    select.appendChild(customOption);

    const custom = document.createElement("input");
    custom.type = "text";
    custom.placeholder = "Custom label";
    custom.style.cssText = `${INPUT_STYLE} margin-top: 0; flex: 1 1 auto;`;

    select.value = field.isCustom ? CUSTOM_VALUE : field.defaultOption || knownTypes[0];
    custom.value = field.defaultCustom ?? "";
    custom.disabled = select.value !== CUSTOM_VALUE;

    select.addEventListener("change", () => {
        custom.disabled = select.value !== CUSTOM_VALUE;
        if (!custom.disabled) custom.focus();
    });

    row.appendChild(select);
    row.appendChild(custom);
    panel.appendChild(row);

    return {
        element: select,
        getValue: () => (select.value === CUSTOM_VALUE ? custom.value.trim() : select.value),
    };
}

export function showFormDialog({ title, fields, confirmLabel = "OK", cancelLabel = "Cancel" }) {
    return new Promise((resolve) => {
        const { overlay, panel } = createOverlay();
        addHeading(panel, title);

        const getters = {};
        let firstElement = null;

        fields.forEach((field) => {
            const built = field.kind === "type" ? addTypeField(panel, field) : addTextField(panel, field);
            getters[field.id] = built.getValue;
            if (!firstElement) firstElement = built.element;
        });

        const actions = document.createElement("div");
        actions.style.cssText = ACTIONS_STYLE;

        const cancelButton = document.createElement("button");
        cancelButton.textContent = cancelLabel;
        cancelButton.style.cssText = SECONDARY_BUTTON_STYLE;

        const confirmButton = document.createElement("button");
        confirmButton.textContent = confirmLabel;
        confirmButton.style.cssText = PRIMARY_BUTTON_STYLE;

        const finish = (result) => {
            overlay.remove();
            resolve(result);
        };

        cancelButton.onclick = () => finish(null);
        confirmButton.onclick = () => {
            const values = {};
            for (const id in getters) values[id] = getters[id]();
            finish(values);
        };
        overlay.onclick = (event) => {
            if (event.target === overlay) finish(null);
        };
        panel.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && event.target.tagName !== "SELECT") confirmButton.click();
            if (event.key === "Escape") cancelButton.click();
        });

        actions.appendChild(cancelButton);
        actions.appendChild(confirmButton);
        panel.appendChild(actions);

        firstElement?.focus();
    });
}

export function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const { overlay, panel } = createOverlay();

        const text = document.createElement("div");
        text.textContent = message;
        text.style.cssText = MESSAGE_STYLE;
        panel.appendChild(text);

        const actions = document.createElement("div");
        actions.style.cssText = ACTIONS_STYLE;

        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.style.cssText = SECONDARY_BUTTON_STYLE;

        const confirmButton = document.createElement("button");
        confirmButton.textContent = "OK";
        confirmButton.style.cssText = PRIMARY_BUTTON_STYLE;

        const finish = (result) => {
            overlay.remove();
            resolve(result);
        };

        cancelButton.onclick = () => finish(false);
        confirmButton.onclick = () => finish(true);
        overlay.onclick = (event) => {
            if (event.target === overlay) finish(false);
        };
        panel.addEventListener("keydown", (event) => {
            if (event.key === "Enter") finish(true);
            if (event.key === "Escape") finish(false);
        });

        actions.appendChild(cancelButton);
        actions.appendChild(confirmButton);
        panel.appendChild(actions);
        confirmButton.focus();
    });
}

export function showAlertDialog(message) {
    return new Promise((resolve) => {
        const { overlay, panel } = createOverlay();

        const text = document.createElement("div");
        text.textContent = message;
        text.style.cssText = MESSAGE_STYLE;
        panel.appendChild(text);

        const actions = document.createElement("div");
        actions.style.cssText = ACTIONS_STYLE;

        const okButton = document.createElement("button");
        okButton.textContent = "OK";
        okButton.style.cssText = PRIMARY_BUTTON_STYLE;

        const finish = () => {
            overlay.remove();
            resolve();
        };

        okButton.onclick = finish;
        overlay.onclick = (event) => {
            if (event.target === overlay) finish();
        };
        panel.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === "Escape") finish();
        });

        actions.appendChild(okButton);
        panel.appendChild(actions);
        okButton.focus();
    });
}
