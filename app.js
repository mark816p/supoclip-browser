const byId = (id) => document.getElementById(id);

const el = {
  videoFile: byId("videoFile"), dropZone: byId("dropZone"), fileName: byId("fileName"), fileMeta: byId("fileMeta"),
  emptyState: byId("emptyState"), videoStage: byId("videoStage"), stageWrap: byId("stageWrap"), sourceVideo: byId("sourceVideo"),
  captionPreview: byId("captionPreview"), playButton: byId("playButton"), stageTime: byId("stageTime"), transport: byId("transport"),
  seekRange: byId("seekRange"), transportTime: byId("transportTime"), timeline: byId("timeline"), startRange: byId("startRange"),
  endRange: byId("endRange"), startLabel: byId("startLabel"), endLabel: byId("endLabel"), clipDuration: byId("clipDuration"),
  rangeFill: byId("rangeFill"), captionText: byId("captionText"), captionCount: byId("captionCount"), captionStyle: byId("captionStyle"),
  frameMode: byId("frameMode"), exportButton: byId("exportButton"), exportCanvas: byId("exportCanvas"), exportProgress: byId("exportProgress"),
  progressLabel: byId("progressLabel"), progressValue: byId("progressValue"), progressBar: byId("progressBar"), panelMessage: byId("panelMessage"),
  projectStatus: byId("projectStatus"), resetButton: byId("resetButton"), fileTab: byId("fileTab"), urlTab: byId("urlTab"),
  filePane: byId("filePane"), urlPane: byId("urlPane"), youtubeUrl: byId("youtubeUrl"), previewUrl: byId("previewUrl"),
  notice: byId("notice"), jumpStart: byId("jumpStart"),
};

let sourceUrl = "";
let isExporting = false;
let exportFrame = 0;
let noticeTimer = 0;
let lastDraw = 0;
let seeking = false;
let youtubeFrame = null;

function formatTime(seconds, tenths = false) {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (tenths) return `${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
  return `${mins}:${String(Math.floor(secs)).padStart(2, "0")}`;
}

function announce(message) {
  window.clearTimeout(noticeTimer);
  el.notice.textContent = message;
  el.notice.hidden = false;
  noticeTimer = window.setTimeout(() => { el.notice.hidden = true; }, 4300);
}

function setStatus(message, ready = false, rendering = false) {
  el.projectStatus.lastChild.textContent = message;
  el.projectStatus.classList.toggle("is-ready", ready);
  el.projectStatus.classList.toggle("is-rendering", rendering);
}

function setMessage(message) {
  el.panelMessage.textContent = message;
}

function selectedStart() {
  return Number(el.startRange.value);
}

function selectedEnd() {
  return Number(el.endRange.value);
}

function updateRange() {
  const duration = el.sourceVideo.duration || 0;
  const start = selectedStart();
  const end = selectedEnd();
  const clipLength = Math.max(0, end - start);
  el.startLabel.textContent = formatTime(start, true);
  el.endLabel.textContent = formatTime(end, true);
  el.clipDuration.textContent = `${clipLength.toFixed(1)} sec`;
  el.rangeFill.style.left = `${duration ? start / duration * 100 : 0}%`;
  el.rangeFill.style.width = `${duration ? clipLength / duration * 100 : 0}%`;
  if (!isExporting && el.sourceVideo.readyState > 0 && (el.sourceVideo.currentTime < start || el.sourceVideo.currentTime > end)) {
    el.sourceVideo.currentTime = start;
  }
  updateControls();
}

function updateControls() {
  const hasVideo = Number.isFinite(el.sourceVideo.duration) && el.sourceVideo.duration > 0;
  const canRecord = hasVideo && window.MediaRecorder && el.exportCanvas.captureStream && el.sourceVideo.captureStream;
  el.exportButton.disabled = !canRecord || selectedEnd() - selectedStart() < 0.5 || isExporting;
  el.playButton.disabled = !hasVideo || isExporting;
  el.resetButton.disabled = !hasVideo && !youtubeFrame;
}

function updateCaption() {
  const caption = el.captionText.value.trim();
  el.captionPreview.textContent = caption;
  el.captionPreview.classList.toggle("is-highlight", el.captionStyle.value === "highlight" && Boolean(caption));
  el.captionCount.textContent = `${el.captionText.value.length} / 80`;
}

function syncPreviewTime() {
  if (!seeking && el.sourceVideo.readyState > 0 && !youtubeFrame) {
    const current = el.sourceVideo.currentTime;
    const duration = el.sourceVideo.duration || 1;
    el.seekRange.value = String(current);
    el.stageTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
    el.transportTime.textContent = formatTime(current);
    el.playButton.classList.toggle("is-playing", !el.sourceVideo.paused);
    el.playButton.setAttribute("aria-label", el.sourceVideo.paused ? "Play preview" : "Pause preview");
  }
  exportFrame = window.requestAnimationFrame(syncPreviewTime);
}

function setFile(file) {
  if (!file || !file.type.startsWith("video/")) {
    announce("Choose a video file to start editing.");
    return;
  }
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  if (youtubeFrame) {
    youtubeFrame.remove();
    youtubeFrame = null;
  }
  sourceUrl = URL.createObjectURL(file);
  el.sourceVideo.src = sourceUrl;
  el.sourceVideo.load();
  el.sourceVideo.hidden = false;
  el.videoStage.hidden = false;
  el.captionPreview.hidden = false;
  el.playButton.hidden = false;
  el.stageTime.hidden = false;
  el.emptyState.hidden = true;
  el.dropZone.classList.remove("is-dragging");
  el.fileName.textContent = file.name;
  el.fileMeta.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · local file`;
  el.fileTab.classList.add("is-active");
  el.urlTab.classList.remove("is-active");
  el.fileTab.setAttribute("aria-pressed", "true");
  el.urlTab.setAttribute("aria-pressed", "false");
  el.filePane.hidden = false;
  el.urlPane.hidden = true;
  el.captionText.disabled = false;
  el.frameMode.disabled = false;
  el.captionStyle.disabled = false;
  el.transport.hidden = false;
  el.timeline.hidden = false;
  setStatus("Loading video", false);
  setMessage("Video stays in this tab and is rendered at real time.");
}

function onMetadata() {
  const duration = el.sourceVideo.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    announce("This video has no readable duration. Try MP4 or WebM.");
    return;
  }
  el.startRange.max = String(duration);
  el.endRange.max = String(duration);
  el.seekRange.max = String(duration);
  el.startRange.value = "0";
  el.endRange.value = String(duration);
  el.sourceVideo.currentTime = 0;
  el.stageTime.textContent = `0:00 / ${formatTime(duration)}`;
  el.seekRange.value = "0";
  el.transportTime.textContent = "0:00";
  el.videoStage.style.aspectRatio = "9 / 16";
  el.videoStage.style.maxHeight = "100%";
  el.videoStage.style.maxWidth = "100%";
  el.videoStage.style.width = "auto";
  el.videoStage.style.height = "100%";
  el.sourceVideo.style.objectFit = el.frameMode.value === "cover" ? "cover" : "contain";
  el.exportButton.disabled = false;
  setStatus("Ready to edit", true);
  setMessage("Preview and export stay on this device. Exports play at real time.");
  updateRange();
  updateControls();
}

function parseYoutubeId(value) {
  try {
    const url = new URL(value.trim());
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtube-nocookie.com"].includes(url.hostname)) return "";
    if (url.hostname.endsWith("youtu.be")) return url.pathname.split("/").filter(Boolean)[0] || "";
    return url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || "";
  } catch {
    return "";
  }
}

function previewYoutube() {
  const id = parseYoutubeId(el.youtubeUrl.value);
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    announce("Paste a valid YouTube video link.");
    el.youtubeUrl.focus();
    return;
  }
  if (sourceUrl) {
    URL.revokeObjectURL(sourceUrl);
    sourceUrl = "";
  }
  el.sourceVideo.pause();
  el.sourceVideo.removeAttribute("src");
  el.sourceVideo.load();
  el.sourceVideo.hidden = true;
  el.emptyState.hidden = true;
  el.videoStage.hidden = false;
  el.transport.hidden = true;
  el.timeline.hidden = true;
  youtubeFrame?.remove();
  youtubeFrame = document.createElement("iframe");
  youtubeFrame.className = "youtube-preview";
  youtubeFrame.title = "YouTube video preview";
  youtubeFrame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  youtubeFrame.referrerPolicy = "strict-origin-when-cross-origin";
  youtubeFrame.allowFullscreen = true;
  youtubeFrame.src = `https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0`;
  el.videoStage.prepend(youtubeFrame);
  el.captionPreview.hidden = true;
  el.playButton.hidden = true;
  el.stageTime.hidden = true;
  el.exportButton.disabled = true;
  el.resetButton.disabled = false;
  el.fileName.textContent = "YouTube preview";
  el.fileMeta.textContent = "Browser preview only";
  el.fileTab.classList.remove("is-active");
  el.urlTab.classList.add("is-active");
  el.fileTab.setAttribute("aria-pressed", "false");
  el.urlTab.setAttribute("aria-pressed", "true");
  el.filePane.hidden = true;
  el.urlPane.hidden = false;
  el.captionText.disabled = true;
  el.frameMode.disabled = true;
  el.captionStyle.disabled = true;
  setStatus("Preview only", false);
  setMessage("YouTube blocks browser export. Choose a video file to edit, or run SupoClip with its self-hosted backend.");
  el.urlPane.scrollIntoView({ block: "nearest" });
}

function drawFrame() {
  const video = el.sourceVideo;
  const canvas = el.exportCanvas;
  const ctx = canvas.getContext("2d", { alpha: false });
  const cw = canvas.width;
  const ch = canvas.height;
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!ctx || !vw || !vh) return;

  ctx.fillStyle = "#101216";
  ctx.fillRect(0, 0, cw, ch);
  if (el.frameMode.value === "cover") {
    const targetRatio = cw / ch;
    const sourceRatio = vw / vh;
    let sx = 0;
    let sy = 0;
    let sw = vw;
    let sh = vh;
    if (sourceRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
  } else {
    const scale = Math.min(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    ctx.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }
  drawCaption(ctx, cw, ch, el.captionText.value.trim(), el.captionStyle.value);
}

function drawCaption(ctx, width, height, text, style) {
  if (!text) return;
  const fontSize = 47;
  const maxWidth = width * 0.82;
  ctx.font = `700 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const lineHeight = 56;
  const paddingX = 18;
  const paddingY = 11;
  const widest = Math.min(maxWidth, Math.max(...lines.map((item) => ctx.measureText(item).width)));
  const boxWidth = widest + paddingX * 2;
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const x = (width - boxWidth) / 2;
  const y = height * 0.76 - boxHeight / 2;
  roundRect(ctx, x, y, boxWidth, boxHeight, 5);
  ctx.fillStyle = style === "highlight" ? "#1f2de6" : "rgb(9 10 12 / 76%)";
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  lines.forEach((item, index) => ctx.fillText(item, width / 2, y + paddingY + lineHeight * index + lineHeight / 2, maxWidth));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function finishExport(chunks, recorder, canvasStream, sourceStream) {
  if (isExporting) {
    isExporting = false;
    window.clearInterval(lastDraw);
    el.sourceVideo.pause();
    el.sourceVideo.currentTime = selectedStart();
    canvasStream?.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
  const blob = new Blob(chunks, { type: "video/webm" });
  if (!blob.size) {
    el.exportProgress.hidden = true;
    setStatus("Export stopped", true);
    setMessage("No video data was recorded. Try another browser or video file.");
    updateControls();
    return;
  }
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = `supoclip-${new Date().toISOString().slice(0, 10)}.webm`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  el.progressBar.value = 100;
  el.progressValue.textContent = "100%";
  el.progressLabel.textContent = "Clip downloaded";
  el.exportButton.disabled = false;
  setStatus("Export complete", true);
  setMessage("Your WebM clip was downloaded. Original video remains unchanged.");
  window.setTimeout(() => {
    el.exportProgress.hidden = true;
    el.progressLabel.textContent = "Rendering clip…";
  }, 2800);
  updateControls();
}

async function exportClip() {
  const video = el.sourceVideo;
  const duration = selectedEnd() - selectedStart();
  if (isExporting || !video.videoWidth || duration < 0.5) return;
  const types = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  const mimeType = types.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    announce("This browser cannot export WebM. Use a recent version of Chrome, Edge, or Firefox.");
    return;
  }
  const canvasStream = el.exportCanvas.captureStream(24);
  const sourceStream = video.captureStream();
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...sourceStream.getAudioTracks()]);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks = [];
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = () => {
    isExporting = false;
    window.clearInterval(lastDraw);
    video.pause();
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream.getTracks().forEach((track) => track.stop());
    setStatus("Export failed", false);
    setMessage("The browser could not record this video. Try a smaller file or a recent desktop browser.");
    el.exportProgress.hidden = true;
    el.exportButton.disabled = false;
    updateControls();
  };
  recorder.onstop = () => finishExport(chunks, null, null, null);

  isExporting = true;
  el.exportProgress.hidden = false;
  el.progressBar.value = 0;
  el.progressValue.textContent = "0%";
  el.exportButton.disabled = true;
  setStatus("Rendering clip", false, true);
  setMessage("Keep this tab open until the clip downloads.");
  video.pause();
  try {
    video.currentTime = selectedStart();
    await new Promise((resolve, reject) => {
      if (Math.abs(video.currentTime - selectedStart()) < 0.02 && video.readyState >= 2) resolve();
      else {
        video.addEventListener("seeked", resolve, { once: true });
        video.addEventListener("error", reject, { once: true });
      }
    });
    drawFrame();
    recorder.start(200);
    await video.play();
    lastDraw = window.setInterval(() => {
      drawFrame();
      const elapsed = Math.max(0, video.currentTime - selectedStart());
      const progress = Math.min(100, elapsed / duration * 100);
      el.progressBar.value = progress;
      el.progressValue.textContent = `${Math.floor(progress)}%`;
      if (video.currentTime >= selectedEnd() - 0.025) {
        video.pause();
        if (recorder.state !== "inactive") recorder.stop();
        isExporting = false;
        window.clearInterval(lastDraw);
        canvasStream.getTracks().forEach((track) => track.stop());
        sourceStream.getTracks().forEach((track) => track.stop());
        video.currentTime = selectedStart();
      }
    }, 1000 / 24);
  } catch {
    isExporting = false;
    canvasStream.getTracks().forEach((track) => track.stop());
    sourceStream.getTracks().forEach((track) => track.stop());
    if (recorder.state !== "inactive") recorder.stop();
    el.exportProgress.hidden = true;
    setStatus("Export failed", false);
    setMessage("Playback could not start. Press Play once, then export again.");
    updateControls();
  }
}

function resetProject() {
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  sourceUrl = "";
  youtubeFrame?.remove();
  youtubeFrame = null;
  el.sourceVideo.pause();
  el.sourceVideo.removeAttribute("src");
  el.sourceVideo.load();
  el.sourceVideo.hidden = false;
  el.emptyState.hidden = false;
  el.videoStage.hidden = true;
  el.captionPreview.hidden = false;
  el.playButton.hidden = false;
  el.stageTime.hidden = false;
  el.transport.hidden = true;
  el.timeline.hidden = true;
  el.exportProgress.hidden = true;
  el.fileName.textContent = "Drop a file or browse";
  el.fileMeta.textContent = "MP4, MOV, WebM";
  el.videoFile.value = "";
  el.youtubeUrl.value = "";
  el.captionText.value = "";
  el.captionText.disabled = false;
  el.frameMode.value = "cover";
  el.frameMode.disabled = false;
  el.captionStyle.value = "clean";
  el.captionStyle.disabled = false;
  el.startRange.value = "0";
  el.endRange.value = "1";
  el.captionPreview.classList.remove("is-highlight");
  el.videoStage.style.removeProperty("aspect-ratio");
  el.videoStage.style.removeProperty("max-height");
  el.videoStage.style.removeProperty("max-width");
  el.videoStage.style.removeProperty("width");
  el.videoStage.style.removeProperty("height");
  el.exportButton.disabled = true;
  el.resetButton.disabled = true;
  el.fileTab.classList.add("is-active");
  el.urlTab.classList.remove("is-active");
  el.fileTab.setAttribute("aria-pressed", "true");
  el.urlTab.setAttribute("aria-pressed", "false");
  el.filePane.hidden = false;
  el.urlPane.hidden = true;
  el.captionCount.textContent = "0 / 80";
  setStatus("Waiting for video", false);
  setMessage("No account. No subscription. No upload.");
  updateControls();
}

el.videoFile.addEventListener("change", () => setFile(el.videoFile.files?.[0]));
el.sourceVideo.addEventListener("loadedmetadata", onMetadata);
el.sourceVideo.addEventListener("error", () => {
  setStatus("Video could not open", false);
  setMessage("Try a video encoded as H.264 MP4 or WebM in Chrome, Edge, or Firefox.");
  announce("This browser cannot decode the video. Try H.264 MP4 or WebM.");
});
el.startRange.addEventListener("input", () => {
  const maxStart = Math.max(0, selectedEnd() - 0.5);
  if (selectedStart() > maxStart) el.startRange.value = String(maxStart);
  updateRange();
});
el.endRange.addEventListener("input", () => {
  const minEnd = Math.min(el.sourceVideo.duration || 0, selectedStart() + 0.5);
  if (selectedEnd() < minEnd) el.endRange.value = String(minEnd);
  updateRange();
});
el.seekRange.addEventListener("input", () => {
  seeking = true;
  el.sourceVideo.currentTime = Number(el.seekRange.value);
  el.transportTime.textContent = formatTime(el.sourceVideo.currentTime);
  el.stageTime.textContent = `${formatTime(el.sourceVideo.currentTime)} / ${formatTime(el.sourceVideo.duration)}`;
  seeking = false;
});
el.playButton.addEventListener("click", async () => {
  if (el.sourceVideo.paused) {
    if (el.sourceVideo.currentTime < selectedStart() || el.sourceVideo.currentTime >= selectedEnd()) el.sourceVideo.currentTime = selectedStart();
    try { await el.sourceVideo.play(); } catch { announce("Press Play again to start this preview."); }
  } else {
    el.sourceVideo.pause();
  }
});
el.sourceVideo.addEventListener("timeupdate", () => {
  if (!isExporting && el.sourceVideo.currentTime >= selectedEnd() && !el.sourceVideo.paused) {
    el.sourceVideo.pause();
    el.sourceVideo.currentTime = selectedStart();
  }
});
el.jumpStart.addEventListener("click", () => { el.sourceVideo.currentTime = selectedStart(); });
el.captionText.addEventListener("input", updateCaption);
el.captionStyle.addEventListener("change", updateCaption);
el.frameMode.addEventListener("change", () => { el.sourceVideo.style.objectFit = el.frameMode.value === "cover" ? "cover" : "contain"; });
el.exportButton.addEventListener("click", exportClip);
el.resetButton.addEventListener("click", resetProject);
el.previewUrl.addEventListener("click", previewYoutube);
el.youtubeUrl.addEventListener("keydown", (event) => { if (event.key === "Enter") previewYoutube(); });
el.fileTab.addEventListener("click", () => {
  el.fileTab.classList.add("is-active");
  el.urlTab.classList.remove("is-active");
  el.fileTab.setAttribute("aria-pressed", "true");
  el.urlTab.setAttribute("aria-pressed", "false");
  el.filePane.hidden = false;
  el.urlPane.hidden = true;
});
el.urlTab.addEventListener("click", () => {
  el.urlTab.classList.add("is-active");
  el.fileTab.classList.remove("is-active");
  el.urlTab.setAttribute("aria-pressed", "true");
  el.fileTab.setAttribute("aria-pressed", "false");
  el.urlPane.hidden = false;
  el.filePane.hidden = true;
  el.youtubeUrl.focus();
});
el.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    el.videoFile.click();
  }
});
for (const eventName of ["dragenter", "dragover"]) {
  el.dropZone.addEventListener(eventName, (event) => { event.preventDefault(); el.dropZone.classList.add("is-dragging"); });
}
for (const eventName of ["dragleave", "drop"]) {
  el.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    el.dropZone.classList.remove("is-dragging");
    if (eventName === "drop") setFile(event.dataTransfer.files?.[0]);
  });
}
el.stageWrap.addEventListener("dragover", (event) => event.preventDefault());
el.stageWrap.addEventListener("drop", (event) => {
  event.preventDefault();
  setFile(event.dataTransfer.files?.[0]);
});

window.addEventListener("beforeunload", (event) => {
  if (isExporting) {
    event.preventDefault();
    event.returnValue = "";
  }
});

el.captionText.value = "";
updateCaption();
exportFrame = window.requestAnimationFrame(syncPreviewTime);
