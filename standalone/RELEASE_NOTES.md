# H3 Prompt Writer Standalone v0.1.5

Standalone Windows version. ComfyUI is not required.

## Download

Download **H3-Prompt-Writer-Standalone-Windows-v0.1.5.zip** from the release assets below.

Do not download **Source code (zip)** or **Source code (tar.gz)** for normal use.
Do not install this package into ComfyUI `custom_nodes`.

## What's new

- **Sequence mode:** turn one brief into a series of timed clips with consistent action and references. Each clip gets its own complete prompt and can be edited separately.
- **Compact mode** for Sequence.
- Improved draft saving, model switching, generation reliability and video playback. Text-only Music 3 is now supported.

Planning helps continuity but does not guarantee natural pacing or exact reference likeness. Some models still omit required H3 fields or stretch short actions. Review prompts before generating video.

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
- Video Creative Briefs up to 8,000 characters

External llama.cpp keeps its own reasoning and chat-template settings. Writer separates returned reasoning from the final H3 prompt without overriding the server.

No ComfyUI installation is required. Models, API keys, llama.cpp binaries, and CUDA
libraries are not bundled.

## Requirements

- Windows 10 or 11, x64
- Python 3.10 or newer, or `uv`
- At least one configured provider

Based on H3 Prompt Writer extension `0.4.6`.
