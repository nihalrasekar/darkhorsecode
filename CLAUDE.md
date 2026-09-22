# Coding rules

- Never duplicate code. Search codebase first (Glob to find files, Grep to find content, Read to inspect); reuse existing helpers/utils/components.
- Before implementing a feature, check if a native/built-in library (stdlib, platform API, already-installed dependency) provides it. Use it instead of hand-writing. Keeps code short.
- Always follow YAGNI: build only what is needed now. No speculative abstractions, config, or features.
