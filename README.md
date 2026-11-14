# SupoClip Browser Clipper

A static, no-install browser adaptation of SupoClip's automatic clip-selection workflow. Upload a video or use a direct CORS-enabled video URL. Speech recognition and clip selection run locally in the browser; the video is not uploaded to this project.

## Use it

Open the GitHub Pages site in a current desktop version of Chrome or Edge with WebGPU enabled. Choose a video, set how many moments to find, then select **Find clips**. SupoClip extracts speech locally, transcribes it with Whisper, and uses a small local Qwen model to select and rank self-contained moments. Preview the picks and render any of them as a vertical WebM clip with a hook title and transcript captions.

The browser automatically fetches the runtime and model files the first time they are needed, then caches them for reuse. No app, extension, model, or command-line tool needs to be installed manually. The model files are large, so the first analysis takes longer and needs an internet connection. Video and transcript processing stay in the current tab. Export downloads the finished WebM clip.

Direct video URLs must be HTTPS, direct media files, and served with CORS access. YouTube links are not processed: the embedded player does not expose video bytes, and YouTube policies restrict downloading or storing audiovisual content without prior written approval.

## How the browser version maps to SupoClip

The original project runs a Python API and workers. This static version adapts its transcript-grounded selection and comparative ranking ideas from `backend/src/ai.py`, and its transcript selection principles from `backend/src/workflows/prompts.py`. The browser uses Transformers.js Whisper and WebLLM Qwen to run comparable stages on-device. It does not use SupoClip's Python worker, database, Redis, external AI providers, B-roll services, or YuNet face tracker. It renders center-cropped clips with browser canvas and MediaRecorder.

The upstream project is [FujiwaraChoki/SupoClip](https://github.com/FujiwaraChoki/supoclip), licensed under AGPL-3.0-or-later. This adaptation is also under AGPL-3.0-or-later; see [LICENSE](LICENSE). SupoClip is not affiliated with or endorsed by the upstream maintainers.

## GitHub Pages

The repository root on `main` is published by GitHub Pages. No build step or server is required.

## Third-party runtime and models

- [Transformers.js](https://github.com/huggingface/transformers.js) and [Xenova Whisper tiny](https://huggingface.co/Xenova/whisper-tiny) for local speech recognition.
- [WebLLM](https://github.com/mlc-ai/web-llm) and [Qwen3 0.6B](https://huggingface.co/mlc-ai/Qwen3-0.6B-q4f16_1-MLC) for local clip ranking.
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) to extract audio in the browser.

Model licenses and runtime licenses belong to their respective maintainers. The app does not send the source video to these services; the browser fetches only public runtime and model files.
