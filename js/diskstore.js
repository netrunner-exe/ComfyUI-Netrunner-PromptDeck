import { api } from "../../scripts/api.js";

// Global, per-ComfyUI-user preset file. Resolves to
// user/default/prompt_deck/global_presets.json on disk (per-user root via /userdata).
const DISK_FILE = "prompt_deck/global_presets.json";

export async function loadDiskPresets() {
    const response = await api.fetchApi(`/userdata/${encodeURIComponent(DISK_FILE)}`);
    if (response.status === 404) return [];
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

export async function saveDiskPresets(presets) {
    const response = await api.fetchApi(`/userdata/${encodeURIComponent(DISK_FILE)}?overwrite=true`, {
        method: "POST",
        body: JSON.stringify(presets),
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
}
