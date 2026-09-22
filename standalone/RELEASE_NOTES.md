# H3 Prompt Writer Standalone v0.1.8

Standalone Windows version. ComfyUI is not required.

## Download

Download **H3-Prompt-Writer-Standalone-Windows-v0.1.8.zip** from the release assets below.

Do not download **Source code (zip)** or **Source code (tar.gz)** for normal use.
Do not install this package into ComfyUI `custom_nodes`.

## What's new

- Save and load text drafts for Single and Sequence from Actions.
- Extract and download audio from a selected video interval.
- Set a manual generation budget for Ollama.
- Keep Single Reference labels in sync after deleting or reordering media.
- Write longer Creative Briefs without a character limit or scroll jumps.
- Enable desktop notifications when generation finishes.

ComfyUI-only controls, including Auto VRAM management and Add to workflow, are not
shown in Standalone.

## Features

- Ollama
- API providers
- External llama.cpp
- Existing local GGUF models through a user-selected `llama-server.exe`
- Vision GGUF projectors with metadata-based matching
- Combined and removable model locations
- Local GGUF Context, KV cache, Generation budget, and supported reasoning effort controls
- Single and Sequence Creative Briefs without a character limit; model context limits still apply

External llama.cpp keeps its own reasoning and chat-template settings. Writer separates returned reasoning from the final H3 prompt without overriding the server.

No ComfyUI installation is required. Models, API keys, llama.cpp binaries, and CUDA
libraries are not bundled.

## Requirements

- Windows 10 or 11, x64
- Python 3.10 or newer, or `uv`
- At least one configured provider

Based on H3 Prompt Writer extension `0.4.6`.
