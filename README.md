# darkhorsecode

Built on the [opencode](https://opencode.ai) engine: every agent runs on a local opencode server.

## Sign-in (OAuth)

DarkHorseCode doesn't implement OAuth itself. ChatGPT (Plus / Pro) sign-in runs opencode's own
login (`opencode providers login -p openai`). opencode's data dir (`XDG_DATA_HOME`) is pointed at the app's
own `%APPDATA%\darkhorsecode`, so the token lives in `%APPDATA%\darkhorsecode\opencode\auth.json`, not the shared
`~/.local/share/opencode`.

The Windows uninstaller deletes `%APPDATA%\darkhorsecode` (`nsis.deleteAppDataOnUninstall`), which removes the API key,
MCP tokens and ChatGPT sign-in. Updating over an existing install keeps them.

Claude has no sign-in: Anthropic rejects a Claude Pro/Max login token when a third-party app uses it
(`401 "API key is invalid"`), so Claude needs an API key from console.anthropic.com.

The code for this is in `src/main/agent/auth.js`.
