export async function downloadJSON(filename, data) {
    const content = JSON.stringify(data, null, 2);

    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
            });
            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
            // Fall through to the plain download-link approach below.
        }
    }

    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

export function pickJSONFile() {
    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.style.display = "none";

        input.addEventListener("change", () => {
            const file = input.files?.[0];
            input.remove();

            if (!file) {
                resolve(null);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
        });

        document.body.appendChild(input);
        input.click();
    });
}
