# Bhouncer

Bounces stale editors and idle language servers to free up memory.

## Features

- **Editor Pruning**: Automatically closes editors that haven't been accessed recently
- **Language Server Management**: Enables/disables language servers based on open file types
- **PID Tracking**: Tracks and kills specific language server processes when no longer needed

## Why?

VSCode/VSCodium language servers spawn per-workspace and stay running forever, even when no relevant files are open. With multiple windows, memory usage compounds quickly:

- terraform-ls: ~230MB per window
- eslint: ~500MB per window
- tsserver: ~500MB+ per window

Bhouncer automatically:
1. Prunes editors idle for > M minutes
2. Keeps only the last N most recently used editors
3. Disables language servers when no files of that type are open
4. Kills the actual process to reclaim memory immediately

## Settings

### Editor Pruning

| Setting | Default | Description |
|---------|---------|-------------|
| `bhouncer.editors.maxOpen` | 10 | Maximum number of editors to keep open |
| `bhouncer.editors.idleTimeoutMinutes` | 10 | Close editors idle for longer than this |
| `bhouncer.editors.excludePatterns` | [] | Glob patterns for files to never auto-close |
| `bhouncer.editors.excludePinned` | true | Never auto-close pinned tabs |
| `bhouncer.editors.excludeDirty` | true | Never auto-close tabs with unsaved changes |

### Language Servers

| Setting | Default | Description |
|---------|---------|-------------|
| `bhouncer.servers` | (terraform) | Array of language servers to manage |
| `bhouncer.enabled` | true | Enable/disable bhouncer entirely |

### Output

| Setting | Default | Description |
|---------|---------|-------------|
| `bhouncer.output.enabled` | true | Enable/disable output panel logging |

### Server Configuration

Each entry in `bhouncer.servers` needs:

```json
{
  "extensions": [".tf", ".tfvars"],
  "settingKey": "terraform.languageServer.enable",
  "processPattern": "terraform-ls"
}
```

- `extensions`: File extensions that trigger this server
- `settingKey`: The VSCode setting that enables/disables the server
- `processPattern`: Pattern to match the process name (used with `pgrep -f`)

### Example: Adding More Servers

```json
{
  "bhouncer.servers": [
    {
      "extensions": [".tf", ".tfvars"],
      "settingKey": "terraform.languageServer.enable",
      "processPattern": "terraform-ls"
    },
    {
      "extensions": [".yaml", ".yml"],
      "settingKey": "yaml.enable",
      "processPattern": "yaml-language-server"
    }
  ]
}
```

## Commands

- `Bhouncer: Prune Editors Now` - Manually trigger editor pruning
- `Bhouncer: Show Status` - Show current status (tracked PIDs, editor count)

## Output Panel

Bhouncer logs its actions to VSCode's Output panel. To view:

1. Open the Output panel (View → Output or Ctrl+Shift+U)
2. Select "bhouncer" from the dropdown

The output shows when:
- Language servers are enabled/disabled
- PIDs are tracked/killed
- Editors are pruned

Example output:
```
[2024-01-15T10:30:00.000Z] [INFO] activating...
[2024-01-15T10:30:00.050Z] [INFO] enabled terraform.languageServer.enable, tracking pid 12345
[2024-01-15T10:30:05.000Z] [INFO] closing 3 stale editor(s)
```

## How It Works

### Editor Pruning

1. Tracks last access time for each editor
2. On tab changes (and every minute), checks for editors to prune
3. Closes editors that are either:
   - Over the `maxOpen` limit, OR
   - Idle for longer than `idleTimeoutMinutes`

### Language Server Management

1. Listens for tab open/close events
2. When a file type is opened: enables the language server, tracks the spawned PID
3. When the last file of that type is closed: disables the setting AND kills the tracked PID
4. PID tracking uses before/after diff to identify exactly which process we spawned

## Installation

### From Source

```bash
cd vscode-extension-bhouncer
npm install
npm run compile
```

#### Debug Mode

**Option 1: F5 in VSCode**

Press F5 in VSCode to launch the extension in debug mode (requires `.vscode/launch.json`).

**Option 2: Command Line**

```bash
# install the extension locally for testing
code --extensionDevelopmentPath="$(pwd)"

# or for VSCodium
codium --extensionDevelopmentPath="$(pwd)"
```

This launches a new VSCode/VSCodium window with the extension loaded from source.

### Package as VSIX

```bash
npm run package
```

This creates a `bhouncer-x.x.x.vsix` file.

### Install the VSIX

**Option 1: Command Line**

```bash
# VSCode
code --install-extension bhouncer-0.1.0.vsix

# VSCodium
codium --install-extension bhouncer-0.1.0.vsix
```

**Option 2: UI**

1. Open VSCode/VSCodium
2. Go to Extensions (Ctrl+Shift+X)
3. Click the `...` menu (top right of Extensions panel)
4. Select "Install from VSIX..."
5. Browse to and select the `.vsix` file

## License

MIT


## todo

support

            {
              "extensions": [
                ".js",
                ".jsx",
                ".ts",
                ".tsx",
                ".mjs",
                ".cjs"
              ],
              "settingKey": "typescript.tsserver.enable",
              "processPattern": "tsserver"
            },
