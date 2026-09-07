# H3 Prompt Writer Standalone for Windows

Use H3 Prompt Writer without ComfyUI.

Current Standalone version: **0.1.4**

[Download H3 Prompt Writer Standalone v0.1.4](../../../releases/download/standalone-v0.1.4/H3-Prompt-Writer-Standalone-Windows-v0.1.4.zip)

## This is the Standalone version

You do not need ComfyUI. Do not install this ZIP into ComfyUI `custom_nodes`.

Looking for the ComfyUI extension? See
[H3 Prompt Writer for ComfyUI](../README.md).

- ✓ Ollama
- ✓ API providers
- ✓ External llama.cpp
- ✓ Existing local GGUF models
- ✓ Vision GGUF projectors

No ComfyUI installation is required. Models, API keys, and `llama.cpp` binaries are
not bundled.

## Start

1. Extract the ZIP to a writable folder.
2. Double-click `start.bat`.
3. Open **Settings**, choose a provider, and select a model.

On first launch, Standalone creates a private `.venv` beside the application and
installs three small Python packages. Nothing is installed globally. Windows needs
Python 3.10 or newer, or `uv`, unless a future release includes portable Python.

The ZIP contains `data/settings.example.json`, not a live `settings.json`. Existing
runtime and model locations are therefore not replaced when a newer ZIP is extracted
over the same folder.

The Writer opens directly in a full-window browser view. Close the browser tab or
window normally.

### Linux

Standalone also runs on Linux using the same Python backend and browser-based interface.

When running Standalone from a repository checkout, use the included Linux launcher:

```bash
chmod +x start-linux.sh
./start-linux.sh
```

For Local GGUF, point it to your Linux `llama-server` executable:

```bash
H3_LLAMA_SERVER="/path/to/llama-server" ./start-linux.sh
```

You can also provide model paths on first launch:

```bash
H3_MODEL_ROOT="/path/to/models" \
H3_MODEL="/path/to/model.gguf" \
H3_PROJECTOR="/path/to/mmproj.gguf" \
./start-linux.sh
```

Python 3.10 or newer is required. The Linux launcher has been tested on WSL2.

## What's new in v0.1.4

- **Media Composer:** combine Pictures and video contact sheets into a collage. Arrange media, add captions, then copy, download, or add the result as a new Picture.
- **Media Editor:** crop Pictures, crop and trim videos, and preview the frames used for analysis. Save changes to Media or download a copy. Reset restores the original.
- **Light theme and Interface Size:** use the header buttons to switch themes and choose 100%, 110%, 120%, or 125%. Your choice is saved.
- **External llama.cpp routers:** select and unload models on compatible servers.

Open a media card to edit it. In Reference mode, use **Actions → Compose** to create
a collage from existing Pictures and video sheets. Editing does not overwrite your
original files.

The floating Media panel, Add to workflow, and Auto VRAM management are ComfyUI
features and are not included in Standalone. Model unload controls remain available
for supported providers.

## Providers

### Ollama

Choose an installed Ollama model. Existing local and remote-host behavior is provided
by H3 Prompt Writer.

### API providers

Connect a supported provider in Settings. API keys stay in backend memory for the
current Writer session and are not saved by Standalone.

### External llama.cpp

Connect to a `llama-server` that you already started. Compatible routers let you
select and unload models from Writer. Context and KV cache remain server-managed.

### Local GGUF

Standalone can start and stop a user-supplied `llama-server` executable for existing GGUF
models:

1. Download the appropriate Windows archive from the official
   [llama.cpp releases](https://github.com/ggml-org/llama.cpp/releases).
2. Open **Settings → Local GGUF** and choose `llama-server.exe`.
3. Use **Add models…** to choose one model GGUF or scan a folder.
4. Select a model from the combined model list.
5. Review the matched vision projector, or choose one manually.

Use **Locations · N** to see remembered model folders, forget one, or forget all.
Forgetting a location never deletes files. Use the runtime card's **Manage** menu to
change or forget the `llama-server` executable.

Model and projector roles are read from GGUF metadata, not filenames. Unknown files
remain selectable as **Unverified**. If several projectors match, Standalone asks you
to choose; the actual `llama-server` load is the final compatibility check.

Standalone does not guess or download CUDA, CPU, or Vulkan builds. It starts at most
one managed server on `127.0.0.1`, reuses it while the configuration is unchanged,
and keeps native runtime failures outside the Writer process. `llama-cpp-python` is
not used for Local GGUF.

## Notes

- The local Writer host binds only to `127.0.0.1`.
- Browser requests use the local host; provider calls are made by the Python backend.
- Local runtime paths and model locations are stored only in the extracted copy's
  `data/` folder.
- Qwen3.8 receives `reasoning_effort=low` and a 24K automatic context only when its
  embedded chat template explicitly supports that control.
- Local GGUF provides managed Context, KV cache, Generation budget, and supported
  reasoning effort controls. External llama.cpp remains server-managed.

## Development

The standalone layer is intentionally small. In this repository it imports the shared
`backend/`, `web/`, guides, and model metadata directly. A portable build vendors a
clean snapshot of those shared files. Standalone-specific behavior stays in adapter
files so normal core commits are immediately available to both hosts.

Host capabilities are declared in `h3_standalone/static/app.js`. Keep ComfyUI-only
actions behind these shared guards, and use Writer's theme and size tokens for
Standalone controls. CI tests both hosts. The build copies tracked source files only.

Optional development settings live in `data/settings.json`:

```json
{
  "upstream_repo": "C:\\path\\to\\prompt-writer",
  "model_roots": ["D:\\Models"],
  "port": 8765,
  "open_browser": true
}
```

Command-line overrides are also available:

```text
start.bat --upstream C:\path\to\prompt-writer --model-root D:\Models --port 9000 --no-browser
```

From the repository root, build the portable package with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build_standalone.ps1
```

The result is `dist\H3-Prompt-Writer-Standalone-Windows-v0.1.4.zip`. It records the
repository commit in `upstream\UPSTREAM_SNAPSHOT.txt` and excludes local settings,
logs, models, `llama-server`, CUDA libraries, and test artifacts.
