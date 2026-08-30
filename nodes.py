class NetrunnerPromptDeck:
    # Preset storage/UI is handled entirely on the frontend (see js/prompt_presets.js).
    # Backend only sees the resulting "text" string.
    CATEGORY = "utils/text"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("string",)
    FUNCTION = "execute"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": ""}),
            }
        }

    def execute(self, text):
        return (text,)


NODE_CLASS_MAPPINGS = {
    "ComfyUI-Netrunner-PromptDeck": NetrunnerPromptDeck,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUI-Netrunner-PromptDeck": "ComfyUI-Netrunner-PromptDeck",
}
