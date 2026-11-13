# SupoClip Browser Studio

A small, independent browser editor for cutting a local video file into a vertical WebM clip. It runs as a static GitHub Pages site. No account, subscription, server, or upload is needed for file editing.

## Use it

Open the deployed page in a recent desktop version of Chrome, Edge, or Firefox. Choose a video file, set the in and out points, add an optional caption, choose the vertical framing, then select **Export**. The browser renders the clip at real time and downloads a WebM file.

The source file stays in the current browser tab. Closing or refreshing the page clears the project. Export keeps the source audio when the browser exposes an audio track.

## What it does not do

This is not the full SupoClip AI pipeline. GitHub Pages cannot start SupoClip's Python API and video worker. The editor does not find moments automatically, transcribe speech, track faces, or export a YouTube preview. YouTube links play in an embedded preview only; choose a local file to edit and export.

For full SupoClip, use its [self-hosting guide](https://www.supoclip.com/blog/self-host-supoclip-docker). The documented setup uses Docker Compose with the web app, API, worker, PostgreSQL, and Redis. It can use local Whisper and Ollama to avoid paid AI APIs, but those models and services still need to be installed and run on your computer.

## GitHub Pages

The included Actions workflow deploys this static folder to GitHub Pages on pushes to `main`. In repository settings, set **Pages → Build and deployment → Source → GitHub Actions** if it is not already selected.

## Technology

- Plain HTML, CSS, and JavaScript
- File preview with the browser's native video decoder
- 9:16 canvas rendering with `MediaRecorder`
- No third-party JavaScript, analytics, or font requests

WebM recording depends on browser codec support. Very large files can use substantial memory. Rendering takes at least as long as the selected clip.

## License and name

This browser editor is an independent project and is not affiliated with or endorsed by the SupoClip maintainers. SupoClip and its source are maintained at [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip). This project's original code is available under the MIT License.
