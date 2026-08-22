const config = window.MIMORU_CONFIG || {};

let supabase = null;
let supabaseLoaded = false;

const state = {
  stream: null,
  facingMode: "user",
  blob: null,
  page: 0,
  hasMore: true,
  uploading: false
};

const camera = document.getElementById("camera");
const canvas = document.getElementById("captureCanvas");
const cameraPlaceholder = document.getElementById("cameraPlaceholder");

const startBtn = document.getElementById("startCameraBtn");
const switchBtn = document.getElementById("switchCameraBtn");
const captureBtn = document.getElementById("captureBtn");

const previewSection = document.getElementById("previewSection");
const previewImage = document.getElementById("previewImage");
const retakeBtn = document.getElementById("retakeBtn");
const uploadBtn = document.getElementById("uploadBtn");
const consentCheck = document.getElementById("consentCheck");

const uploadStatus = document.getElementById("uploadStatus");
const galleryStatus = document.getElementById("galleryStatus");
const galleryGrid = document.getElementById("galleryGrid");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const refreshGalleryBtn = document.getElementById("refreshGalleryBtn");

const cameraPanel = document.getElementById("cameraPanel");
const galleryPanel = document.getElementById("galleryPanel");
const tabs = [...document.querySelectorAll(".tab")];

function setStatus(el, text, kind = "") {
  if (!el) return;
  el.textContent = text;
  el.className = "status";
  if (kind) el.classList.add(kind);
}

async function loadSupabase() {
  if (supabaseLoaded) return supabase;
  supabaseLoaded = true;

  const configured =
    config.supabaseUrl &&
    config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_") &&
    !config.supabaseAnonKey.includes("YOUR_");

  if (!configured) return null;

  try {
    const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    supabase = mod.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return supabase;
  } catch (err) {
    console.error("Supabase load failed:", err);
    return null;
  }
}

function stopCamera() {
  if (!state.stream) return;
  state.stream.getTracks().forEach(track => track.stop());
  state.stream = null;
  camera.srcObject = null;
}

function updateCameraOrientation() {
  if (state.facingMode === "user") {
    camera.classList.add("selfie");
  } else {
    camera.classList.remove("selfie");
  }
}

async function startCamera() {
  setStatus(uploadStatus, "Starting camera...");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus(uploadStatus, "Camera access is not supported in this browser.", "error");
    return;
  }

  startBtn.disabled = true;
  captureBtn.disabled = true;
  switchBtn.disabled = true;
  stopCamera();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: state.facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    state.stream = stream;
    camera.srcObject = stream;
    camera.muted = true;
    camera.setAttribute("playsinline", "");
    camera.setAttribute("autoplay", "");
    camera.setAttribute("muted", "");
    updateCameraOrientation();

    await new Promise(resolve => {
      if (camera.readyState >= 2 && camera.videoWidth > 0) {
        resolve();
      } else {
        const ready = () => {
          camera.removeEventListener("loadedmetadata", ready);
          resolve();
        };
        camera.addEventListener("loadedmetadata", ready);
      }
    });

    try {
      await camera.play();
    } catch (playErr) {
      console.warn("camera.play() warning:", playErr);
    }

    cameraPlaceholder.hidden = true;
    cameraPlaceholder.style.display = "none";
    camera.style.display = "block";
    camera.style.visibility = "visible";
    camera.style.opacity = "1";

    captureBtn.disabled = false;
    switchBtn.disabled = false;
    startBtn.textContent = "Restart Camera";
    setStatus(uploadStatus, "Camera ready! Selfie photos will be mirrored and framed.", "success");
  } catch (error) {
    console.error("Camera error:", error);
    cameraPlaceholder.hidden = false;
    cameraPlaceholder.style.display = "grid";

    let message = "Unable to start camera.";
    if (error.name === "NotAllowedError") {
      message = "Camera permission was denied. Allow camera access in your browser settings and reload.";
    } else if (error.name === "NotFoundError") {
      message = "No camera was found on this device.";
    } else if (error.name === "NotReadableError") {
      message = "The camera may already be used by another app or tab.";
    } else if (error.name === "SecurityError") {
      message = "Camera requires HTTPS. Open the GitHub Pages website.";
    }

    setStatus(uploadStatus, message, "error");
    alert(message + "\n\nError: " + (error.name || "Unknown"));
  } finally {
    startBtn.disabled = false;
    if (!state.stream) startBtn.textContent = "Start Camera";
  }
}

async function switchCamera() {
  state.facingMode = state.facingMode === "user" ? "environment" : "user";
  await startCamera();
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawTemplate(ctx, width, height) {
  const pad = Math.max(18, Math.round(Math.min(width, height) * 0.024));
  const accent = "#ff3f77";
  const softAccent = "rgba(255, 63, 119, 0.18)";
  const whitePanel = "rgba(255,255,255,0.88)";
  const darkText = "#16161f";
  const small = Math.max(16, Math.round(width * 0.022));
  const medium = Math.max(18, Math.round(width * 0.030));
  const large = Math.max(26, Math.round(width * 0.052));

  // outer double frame
  ctx.save();
  ctx.lineWidth = Math.max(6, Math.round(Math.min(width, height) * 0.008));
  ctx.strokeStyle = accent;
  roundRectPath(ctx, pad, pad, width - pad * 2, height - pad * 2, Math.max(22, pad));
  ctx.stroke();

  ctx.lineWidth = Math.max(2, Math.round(Math.min(width, height) * 0.003));
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  roundRectPath(ctx, pad * 1.75, pad * 1.75, width - pad * 3.5, height - pad * 3.5, Math.max(18, pad));
  ctx.stroke();
  ctx.restore();

  // top title pill
  const pillW = Math.min(width * 0.62, width - pad * 4);
  const pillH = Math.max(54, Math.round(height * 0.09));
  const pillX = pad * 2.2;
  const pillY = pad * 2.2;
  ctx.save();
  ctx.fillStyle = whitePanel;
  roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = darkText;
  ctx.font = `700 ${large}px Inter, Arial, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText("I MET", pillX + pillH * 0.40, pillY + pillH / 2);

  const metWidth = ctx.measureText("I MET ").width;
  ctx.fillStyle = accent;
  ctx.fillText("MIMORU!", pillX + pillH * 0.40 + metWidth, pillY + pillH / 2);
  ctx.restore();

  // top right badge
  const badgeW = Math.min(width * 0.28, 280);
  const badgeH = Math.max(34, Math.round(height * 0.055));
  const badgeX = width - pad * 2.2 - badgeW;
  const badgeY = pillY + 6;
  ctx.save();
  ctx.fillStyle = softAccent;
  roundRectPath(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = `700 ${small}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("IEEE RO-MAN 2026", badgeX + badgeW / 2, badgeY + badgeH / 2);
  ctx.restore();

  // bottom footer card
  const footerH = Math.max(110, Math.round(height * 0.165));
  const footerW = width - pad * 4.2;
  const footerX = pad * 2.1;
  const footerY = height - footerH - pad * 2.1;
  ctx.save();
  ctx.fillStyle = whitePanel;
  roundRectPath(ctx, footerX, footerY, footerW, footerH, Math.max(20, pad));
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = darkText;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${medium}px Inter, Arial, sans-serif`;
  ctx.fillText("Meet Mimoru Photo Booth", footerX + pad * 1.25, footerY + footerH * 0.40);

  ctx.fillStyle = accent;
  ctx.font = `700 ${small}px Inter, Arial, sans-serif`;
  ctx.fillText("#MeetMimoru   #RobotDesignCompetition   #IEEERoman2026", footerX + pad * 1.25, footerY + footerH * 0.72);
  ctx.restore();

  // cute corner decorations
  ctx.save();
  ctx.fillStyle = accent;
  const dotR = Math.max(4, Math.round(Math.min(width, height) * 0.0055));
  const startX = width - pad * 3.2;
  const startY = height - footerH - pad * 4.3;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      ctx.beginPath();
      ctx.arc(startX - col * dotR * 3.2, startY - row * dotR * 3.2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function capturePhoto() {
  if (!state.stream) {
    setStatus(uploadStatus, "Start the camera first.", "error");
    return;
  }

  if (!camera.videoWidth || !camera.videoHeight) {
    setStatus(uploadStatus, "Camera is still loading. Wait a moment.", "error");
    return;
  }

  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(camera.videoWidth, camera.videoHeight));
  const width = Math.round(camera.videoWidth * scale);
  const height = Math.round(camera.videoHeight * scale);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.save();

  // Mirror front-facing camera so saved photo matches what the visitor sees.
  if (state.facingMode === "user") {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(camera, 0, 0, width, height);
  ctx.restore();

  drawTemplate(ctx, width, height);

  canvas.toBlob(blob => {
    if (!blob) {
      setStatus(uploadStatus, "Could not capture photo.", "error");
      return;
    }

    state.blob = blob;
    const existing = previewImage.dataset.objectUrl;
    if (existing) URL.revokeObjectURL(existing);
    const url = URL.createObjectURL(blob);
    previewImage.src = url;
    previewImage.dataset.objectUrl = url;
    previewSection.hidden = false;
    previewSection.style.display = "block";
    setStatus(uploadStatus, "Photo captured with mirrored selfie view and Mimoru frame!", "success");
    previewSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }, "image/jpeg", 0.92);
}

function retakePhoto() {
  state.blob = null;
  const existing = previewImage.dataset.objectUrl;
  if (existing) URL.revokeObjectURL(existing);
  previewImage.src = "";
  previewImage.dataset.objectUrl = "";
  previewSection.hidden = true;
  previewSection.style.display = "none";
  setStatus(uploadStatus, "");
}

async function uploadPhoto() {
  if (!state.blob) {
    setStatus(uploadStatus, "Take a photo first.", "error");
    return;
  }

  if (!consentCheck.checked) {
    setStatus(uploadStatus, "Please confirm the gallery consent box.", "error");
    return;
  }

  const client = await loadSupabase();
  if (!client) {
    setStatus(uploadStatus, "Gallery is not connected yet. Configure Supabase in config.js.", "error");
    return;
  }

  if (state.uploading) return;
  state.uploading = true;
  uploadBtn.disabled = true;
  setStatus(uploadStatus, "Saving photo...");

  try {
    const randomId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    const filePath = `${today}/${Date.now()}-${randomId}.jpg`;

    const { error: uploadError } = await client.storage
      .from(config.bucketName)
      .upload(filePath, state.blob, {
        contentType: "image/jpeg",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = client.storage
      .from(config.bucketName)
      .getPublicUrl(filePath);

    const { error: dbError } = await client
      .from("photos")
      .insert({
        storage_path: filePath,
        public_url: urlData.publicUrl
      });

    if (dbError) throw dbError;

    setStatus(uploadStatus, "Photo saved! Opening the gallery...", "success");
    consentCheck.checked = false;

    setTimeout(() => {
      showTab("gallery");
      refreshGallery();
    }, 700);
  } catch (err) {
    console.error("Upload error:", err);
    setStatus(uploadStatus, `Upload failed: ${err.message || "Please try again."}`, "error");
  } finally {
    state.uploading = false;
    uploadBtn.disabled = false;
  }
}

function formatTime(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(dateString));
}

function renderPhoto(photo) {
  const item = document.createElement("article");
  item.className = "gallery-item";

  const image = document.createElement("img");
  image.loading = "lazy";
  image.decoding = "async";
  image.src = photo.public_url;
  image.alt = "Photo with Mimoru";

  const time = document.createElement("time");
  time.dateTime = photo.created_at;
  time.textContent = formatTime(photo.created_at);

  item.append(image, time);
  galleryGrid.appendChild(item);
}

async function loadGallery(reset = false) {
  const client = await loadSupabase();

  if (!client) {
    setStatus(galleryStatus, "Gallery is not connected yet.", "error");
    return;
  }

  if (reset) {
    state.page = 0;
    state.hasMore = true;
    galleryGrid.innerHTML = "";
  }

  const pageSize = Number(config.pageSize || 30);
  const start = state.page * pageSize;
  const end = start + pageSize - 1;

  setStatus(galleryStatus, "Loading photos...");

  const { data, error } = await client
    .from("photos")
    .select("id, public_url, created_at")
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    console.error(error);
    setStatus(galleryStatus, "Could not load gallery.", "error");
    return;
  }

  data.forEach(renderPhoto);
  state.page += 1;
  state.hasMore = data.length === pageSize;
  loadMoreBtn.hidden = !state.hasMore;

  const count = galleryGrid.children.length;
  setStatus(galleryStatus, count ? `${count} photo${count === 1 ? "" : "s"} loaded` : "No photos yet — be the first!");
}

function refreshGallery() {
  return loadGallery(true);
}

function showTab(name) {
  const isCamera = name === "camera";
  cameraPanel.hidden = !isCamera;
  galleryPanel.hidden = isCamera;

  tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.tab === name);
  });

  if (!isCamera && galleryGrid.children.length === 0) {
    refreshGallery();
  }
}

if (startBtn) startBtn.addEventListener("click", startCamera);
if (switchBtn) switchBtn.addEventListener("click", switchCamera);
if (captureBtn) captureBtn.addEventListener("click", capturePhoto);
if (retakeBtn) retakeBtn.addEventListener("click", retakePhoto);
if (uploadBtn) uploadBtn.addEventListener("click", uploadPhoto);
if (loadMoreBtn) loadMoreBtn.addEventListener("click", () => loadGallery(false));
if (refreshGalleryBtn) refreshGalleryBtn.addEventListener("click", refreshGallery);

tabs.forEach(tab => {
  tab.addEventListener("click", () => showTab(tab.dataset.tab));
});

window.addEventListener("beforeunload", stopCamera);
updateCameraOrientation();
console.log("Mimoru app loaded successfully.");
