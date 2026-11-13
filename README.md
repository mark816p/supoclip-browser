# SupoClip Browser Studio

A small, independent browser editor for cutting a video into a vertical WebM clip. It runs from GitHub Pages with no app install, account, subscription, or video upload to this project.

## Use it

Open the deployed page in a recent desktop version of Chrome, Edge, or Firefox. Choose a video file or paste a direct HTTPS MP4/WebM link. Remote video hosts must allow cross-origin playback. Set the in and out points, add an optional caption, choose the vertical framing, then select **Export**. The browser renders the clip at real time and downloads a WebM file.

Local files stay in the current browser tab. Direct links stream from their host into the browser. Closing or refreshing the page clears the project. Export keeps the source audio when the browser exposes an audio track.

## What it does not do

This is not the full SupoClip AI pipeline. GitHub Pages cannot start SupoClip's Python API and video worker. The editor trims and reframes clips; it does not find moments, transcribe speech, or track faces. YouTube links play in an embedded preview only. YouTube's developer policies prohibit clients from storing copies of its audiovisual content without prior written approval, so this editor does not export YouTube playback.

For full SupoClip, use its [self-hosting guide](https://www.supoclip.com/blog/self-host-supoclip-docker). The documented setup uses Docker Compose with the web app, API, worker, PostgreSQL, and Redis. It can use local Whisper and Ollama to avoid paid AI APIs, but those models and services still need to be installed and run on your computer.

## GitHub Pages

GitHub Pages publishes the repository root on `main`. Set **Pages → Build and deployment → Source → Deploy from a branch → `main` → `/(root)`**. GitHub republishes the page when the branch changes.

## Technology

- Plain HTML, CSS, and JavaScript
- File and CORS-enabled URL playback with the browser's native video decoder
- 9:16 canvas rendering with `MediaRecorder`
- No third-party JavaScript, analytics, or font requests

The browser streams media bytes to play direct links; it does not save the source video as a file. WebM recording depends on browser codec support. Very large files can use substantial memory. Rendering takes at least as long as the selected clip. Export downloads the finished clip.

## License and name

This browser editor is an independent project and is not affiliated with or endorsed by the SupoClip maintainers. SupoClip and its source are maintained at [FujiwaraChoki/supoclip](https://github.com/FujiwaraChoki/supoclip). This project's original code is available under the MIT License.
