import { findBestMoments, formatClock } from "./auto-clip.js";

const byId = (id) => document.getElementById(id);
const el = {
  file: byId("videoFile"), fileTab: byId("fileTab"), urlTab: byId("urlTab"), filePane: byId("filePane"), urlPane: byId("urlPane"),
  url: byId("videoUrl"), loadUrl: byId("loadUrl"), drop: byId("dropZone"), fileName: byId("fileName"), fileMeta: byId("fileMeta"),
  fileNameLabel: byId("fileNameLabel"), fileMetaLabel: byId("fileMetaLabel"), sourceMeta: byId("sourceMeta"), empty: byId("emptyState"),
  stage: byId("videoStage"), video: byId("sourceVideo"), play: byId("playButton"), time: byId("stageTime"),
  count: byId("clipCount"), length: byId("clipLength"), find: byId("findClips"), reset: byId("resetButton"),
  status: byId("projectStatus"), message: byId("panelMessage"), progress: byId("exportProgress"), progressLabel: byId("progressLabel"),
  progressValue: byId("progressValue"), progressBar: byId("progressBar"), notice: byId("notice"),
  results: byId("results"), resultsCount: byId("resultsCount"), clipList: byId("clipList"), canvas: byId("exportCanvas"),
};

let sourceFile = null;
let sourceUrl = "";
let clips = [];
let transcript = [];
let activePreview = null;
let exporting = false;
let exportTimer = 0;
let noticeTimer = 0;

function setStatus(text, ready = false, busy = false) {
  el.status.lastChild.textContent = text;
  el.status.classList.toggle("is-ready", ready);
  el.status.classList.toggle("is-rendering", busy);
}

function message(text) { el.message.textContent = text; }

function announce(text) {
  clearTimeout(noticeTimer);
  el.notice.textContent = text;
  el.notice.hidden = false;
  noticeTimer = setTimeout(() => { el.notice.hidden = true; }, 5200);
}

function showSource(file) {
  if (!file || !file.type.startsWith("video/")) {
    announce("Choose a video file in MP4, MOV, or WebM format.");
    return;
  }
  if (file.size > 500 * 1024 * 1024) {
    announce("This browser clipper supports video files up to 500 MB.");
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceFile = file;
  sourceUrl = URL.createObjectURL(file);
  clips = [];
  transcript = [];
  activePreview = null;
  el.video.pause();
  el.video.src = sourceUrl;
  el.video.load();
  el.video.hidden = false;
  el.stage.hidden = false;
  el.empty.hidden = true;
  el.sourceMeta.hidden = false;
  el.fileName.textContent = file.name;
  el.fileMeta.textContent = `${formatBytes(file.size)} · ${file.type || "video"}`;
  el.fileNameLabel.textContent = file.name;
  el.fileMetaLabel.textContent = `${formatBytes(file.size)} · ready to analyze`;
  el.find.disabled = true;
  el.reset.disabled = false;
  el.results.hidden = true;
  setStatus("Loading video", false);
  message("Your video stays in this tab. The clip selection runs locally.");
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function loadUrl() {
  el.fileTab.classList.remove("is-active");
  el.urlTab.classList.add("is-active");
  el.fileTab.setAttribute("aria-pressed", "false");
  el.urlTab.setAttribute("aria-pressed", "true");
  el.filePane.hidden = true;
  el.urlPane.hidden = false;
  el.url.focus();
}

function loadFileTab() {
  el.fileTab.classList.add("is-active");
  el.urlTab.classList.remove("is-active");
  el.fileTab.setAttribute("aria-pressed", "true");
  el.urlTab.setAttribute("aria-pressed", "false");
  el.filePane.hidden = false;
  el.urlPane.hidden = true;
}

async function loadDirectUrl() {
  let url;
  try { url = new URL(el.url.value.trim()); } catch { announce("Paste a direct HTTPS video URL."); el.url.focus(); return; }
  if (url.protocol !== "https:") { announce("Use a secure HTTPS video URL."); return; }
  if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname)) {
    announce("YouTube videos can’t be analyzed or exported here. Use a file or a CORS-enabled direct video URL.");
    return;
  }
  setStatus("Loading video link", false, true);
  el.loadUrl.disabled = true;
  message("Fetching the direct video to this tab. The source is not sent to SupoClip.");
  try {
    const response = await fetch(url.href, { mode: "cors", credentials: "omit" });
    if (!response.ok) throw new Error(`The video host returned ${response.status}.`);
    const size = Number(response.headers.get("content-length") || 0);
    if (size > 500 * 1024 * 1024) throw new Error("This browser clipper supports videos up to 500 MB.");
    const blob = await response.blob();
    if (blob.size > 500 * 1024 * 1024) throw new Error("This browser clipper supports videos up to 500 MB.");
    let type = blob.type;
    if (!type.startsWith("video/")) {
      const ext = url.pathname.split(".").pop()?.toLowerCase();
      type = ext === "webm" ? "video/webm" : "video/mp4";
    }
    const name = decodeURIComponent(url.pathname.split("/").pop() || "video.mp4").split("?")[0];
    const file = new File([blob], name, { type });
    loadFileTab();
    showSource(file);
    el.fileMetaLabel.textContent = `${url.hostname} · ready to analyze`;
  } catch (error) {
    setStatus("Video link unavailable", false);
    message("The host must allow CORS and direct video access.");
    announce(error.message || "This video host did not allow browser access.");
  } finally { el.loadUrl.disabled = false; }
}

function updateVideoState() {
  const hasVideo = Number.isFinite(el.video.duration) && el.video.duration > 0;
  el.find.disabled = !sourceFile || !hasVideo || exporting;
  el.play.disabled = !hasVideo || exporting;
  el.reset.disabled = !sourceFile || exporting;
  if (hasVideo) {
    el.find.setAttribute("aria-label", `Find clips in ${formatClock(el.video.duration)} video`);
    el.time.textContent = `0:00 / ${formatClock(el.video.duration)}`;
    setStatus("Ready to find clips", true);
  }
}

function progress(label, value) {
  el.progress.hidden = false;
  el.progressLabel.textContent = label;
  el.progressBar.value = Math.max(0, Math.min(100, value));
  el.progressValue.textContent = `${Math.round(value)}%`;
}

async function findClips() {
  if (!sourceFile || exporting) return;
  clips = [];
  transcript = [];
  activePreview = null;
  el.results.hidden = true;
  el.find.disabled = true;
  el.reset.disabled = true;
  el.file.disabled = true;
  el.loadUrl.disabled = true;
  setStatus("Analyzing on this device", false, true);
  message("No video is uploaded. First use loads AI models automatically; the browser caches them for next time.");
  progress("Preparing local analysis", 1);
  try {
    clips = await findBestMoments(sourceFile, {
      count: Number(el.count.value),
      length: el.length.value,
      duration: el.video.duration,
      progress,
    });
    renderResults(clips);
    el.results.hidden = false;
    el.results.scrollIntoView({ behavior: "smooth", block: "start" });
    setStatus(`${clips.length} clips found`, true);
    message("SupoClip ranked these moments from the transcript. Download any clip to render it here.");
    el.progressLabel.textContent = "Analysis complete";
    el.progressBar.value = 100;
    el.progressValue.textContent = "100%";
  } catch (error) {
    setStatus("Analysis stopped", false);
    message(error.message || "The local analysis could not finish. Try again in Chrome or Edge.");
    announce(error.message || "The local analysis could not finish.");
    el.progress.hidden = true;
  } finally {
    el.file.disabled = false;
    el.loadUrl.disabled = false;
    el.reset.disabled = !sourceFile;
    updateVideoState();
  }
}

function renderResults(items) {
  el.clipList.replaceChildren();
  el.resultsCount.textContent = `${items.length} selected · highest score first`;
  items.forEach((clip) => {
    const card = document.createElement("article");
    card.className = "clip-card";
    const rank = document.createElement("span");
    rank.className = "clip-rank";
    rank.textContent = String(clip.index).padStart(2, "0");
    const body = document.createElement("div");
    body.className = "clip-body";
    const title = document.createElement("h3");
    title.textContent = clip.title;
    const meta = document.createElement("div");
    meta.className = "clip-meta";
    meta.textContent = `${formatClock(clip.start)}–${formatClock(clip.end)} · ${Math.round(clip.end - clip.start)} sec`;
    const reason = document.createElement("p");
    reason.textContent = clip.reason;
    const excerpt = document.createElement("blockquote");
    excerpt.textContent = `“${clip.text}”`;
    const score = document.createElement("span");
    score.className = "clip-score";
    score.textContent = `${clip.score} / 100`;
    const actions = document.createElement("div");
    actions.className = "clip-actions";
    const preview = document.createElement("button");
    preview.className = "button button-quiet";
    preview.type = "button";
    preview.textContent = "Preview moment";
    preview.addEventListener("click", () => previewClip(clip));
    const download = document.createElement("button");
    download.className = "button button-primary";
    download.type = "button";
    download.textContent = "Render clip ↓";
    download.addEventListener("click", () => renderClip(clip, download));
    actions.append(preview, download);
    body.append(title, meta, reason, excerpt, actions);
    card.append(rank, body, score);
    el.clipList.append(card);
  });
}

async function previewClip(clip) {
  activePreview = clip;
  el.video.pause();
  el.video.currentTime = clip.start;
  await el.video.play().catch(() => {});
  el.stage.scrollIntoView({ behavior: "smooth", block: "center" });
}

function drawOverlayBox(ctx, text, x, y, maxWidth, fontSize, place = "bottom") {
  if (!text) return;
  ctx.font = `700 ${fontSize}px Segoe UI, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  const lineHeight = fontSize * 1.16;
  const padX = fontSize * 0.35;
  const padY = fontSize * 0.24;
  const widest = Math.min(maxWidth, Math.max(...lines.map((item) => ctx.measureText(item).width)));
  const boxWidth = widest + padX * 2;
  const boxHeight = lines.length * lineHeight + padY * 2;
  const top = place === "top" ? y : y - boxHeight;
  ctx.fillStyle = "rgb(9 10 12 / 76%)";
  ctx.beginPath();
  ctx.roundRect(x - boxWidth / 2, top, boxWidth, boxHeight, 8);
  ctx.fill();
  ctx.fillStyle = "#fff";
  lines.forEach((item, index) => ctx.fillText(item, x, top + padY + lineHeight * index + lineHeight / 2, maxWidth));
}

function drawClipFrame(clip) {
  const video = el.video;
  const canvas = el.canvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!ctx || !vw || !vh) return;
  const targetRatio = cw / ch;
  const sourceRatio = vw / vh;
  let sx = 0, sy = 0, sw = vw, sh = vh;
  if (sourceRatio > targetRatio) { sw = vh * targetRatio; sx = (vw - sw) / 2; }
  else { sh = vw / targetRatio; sy = (vh - sh) / 2; }
  ctx.fillStyle = "#101216";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
  drawOverlayBox(ctx, clip.title, cw / 2, ch * 0.07, cw * 0.8, 39, "top");
  const caption = clip.captions.find((item) => video.currentTime >= item.start && video.currentTime <= item.end)?.text;
  drawOverlayBox(ctx, caption || "", cw / 2, ch * 0.9, cw * 0.82, 38, "bottom");
}

function renderClip(clip, button) {
  if (exporting) return;
  const video = el.video;
  if (!video.captureStream || !el.canvas.captureStream || !window.MediaRecorder) {
    announce("This browser cannot render clips. Use recent Chrome or Edge.");
    return;
  }
  const mimeType = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { announce("WebM export is not available in this browser."); return; }
  exporting = true;
  updateVideoState();
  el.file.disabled = true;
  el.loadUrl.disabled = true;
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Rendering…";
  setStatus("Rendering clip", false, true);
  message("Rendering this clip in the browser. Keep this tab open.");
  const canvasStream = el.canvas.captureStream(24);
  const sourceStream = video.captureStream();
  const audioTracks = sourceStream.getAudioTracks();
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(exportTimer);
    video.pause();
    if (recorder.state !== "inactive") recorder.stop();
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream.getTracks().forEach((track) => track.stop());
  };
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = stop;
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    exporting = false;
    el.file.disabled = false;
    el.loadUrl.disabled = false;
    button.disabled = false;
    button.textContent = originalLabel;
    setStatus("Clip ready", true);
    if (blob.size) {
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `supoclip-${clip.index}-${formatClock(clip.start).replaceAll(":", "-")}.webm`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
      message("Your selected clip was rendered and downloaded. The original video stayed in this tab.");
    } else {
      message("The browser returned an empty clip. Try previewing the video first, then render again.");
    }
    updateVideoState();
  };
  video.pause();
  const onSeek = async () => {
    video.removeEventListener("seeked", onSeek);
    if (stopped) return;
    try {
      drawClipFrame(clip);
      recorder.start(250);
      await video.play();
      exportTimer = window.setInterval(() => {
        drawClipFrame(clip);
        if (video.currentTime >= clip.end - 0.04) stop();
      }, 1000 / 24);
    } catch {
      stop();
      announce("Playback could not start. Press Preview moment once, then render again.");
    }
  };
  video.addEventListener("seeked", onSeek, { once: true });
  video.currentTime = clip.start;
  if (Math.abs(video.currentTime - clip.start) < 0.02 && video.readyState >= 2) onSeek();
}

function clearProject() {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = "";
  sourceFile = null;
  clips = [];
  transcript = [];
  activePreview = null;
  el.video.pause();
  el.video.removeAttribute("src");
  el.video.load();
  el.video.hidden = false;
  el.stage.hidden = true;
  el.empty.hidden = false;
  el.sourceMeta.hidden = true;
  el.file.value = "";
  el.url.value = "";
  el.find.disabled = true;
  el.reset.disabled = true;
  el.results.hidden = true;
  el.clipList.replaceChildren();
  el.progress.hidden = true;
  loadFileTab();
  setStatus("Waiting for video", false);
  message("Nothing uploads. Your selected video is analyzed on this device.");
}

el.file.addEventListener("change", () => showSource(el.file.files?.[0]));
el.loadUrl.addEventListener("click", loadDirectUrl);
el.url.addEventListener("keydown", (event) => { if (event.key === "Enter") loadDirectUrl(); });
el.fileTab.addEventListener("click", loadFileTab);
el.urlTab.addEventListener("click", loadUrl);
el.find.addEventListener("click", findClips);
el.reset.addEventListener("click", clearProject);
el.video.addEventListener("loadedmetadata", updateVideoState);
el.video.addEventListener("timeupdate", () => {
  const duration = el.video.duration || 0;
  el.time.textContent = `${formatClock(el.video.currentTime)} / ${formatClock(duration)}`;
  if (activePreview && el.video.currentTime >= activePreview.end) {
    el.video.pause();
    activePreview = null;
  }
});
el.video.addEventListener("error", () => {
  if (sourceFile) announce("This browser could not decode the video. Try H.264 MP4 or WebM.");
});
el.play.addEventListener("click", async () => {
  if (el.video.paused) await el.video.play().catch(() => announce("Press Play again to start the preview."));
  else el.video.pause();
});
el.video.addEventListener("play", () => {
  el.play.classList.add("is-playing");
  el.play.setAttribute("aria-label", "Pause video");
});
el.video.addEventListener("pause", () => {
  el.play.classList.remove("is-playing");
  el.play.setAttribute("aria-label", "Play video");
});
el.drop.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); el.file.click(); }
});
for (const type of ["dragenter", "dragover"]) el.drop.addEventListener(type, (event) => { event.preventDefault(); el.drop.classList.add("is-dragging"); });
for (const type of ["dragleave", "drop"]) el.drop.addEventListener(type, (event) => {
  event.preventDefault();
  el.drop.classList.remove("is-dragging");
  if (type === "drop") showSource(event.dataTransfer.files?.[0]);
});
el.stage.addEventListener("dragover", (event) => event.preventDefault());
el.stage.addEventListener("drop", (event) => { event.preventDefault(); showSource(event.dataTransfer.files?.[0]); });
window.addEventListener("beforeunload", (event) => {
  if (exporting) { event.preventDefault(); event.returnValue = ""; }
});
