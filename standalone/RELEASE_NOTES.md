# H3 Prompt Writer Standalone v0.1.4

Standalone Windows version. ComfyUI is not required.

## Download

Download **H3-Prompt-Writer-Standalone-Windows-v0.1.4.zip** from the release assets below.

Do not download **Source code (zip)** or **Source code (tar.gz)** for normal use.
Do not install this package into ComfyUI `custom_nodes`.

## What's new

- **Media Composer:** arrange Pictures and video sheets, add captions, and save a collage as a new Picture. Copy and PNG download are also available.
- **Media Editor:** crop Pictures, crop and trim videos, and preview analysis frames before saving to Media. Original files stay unchanged.
- **Light theme and Interface Size:** switch themes and choose a comfortable text and control size from the header.
- **External llama.cpp routers:** select and unload models on compatible servers.

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

Based on H3 Prompt Writer extension `0.4.5`.
