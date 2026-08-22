import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const config = window.MIMORU_CONFIG || {};

const configured =
  config.supabaseUrl &&
  config.supabaseAnonKey &&
  !config.supabaseUrl.includes("YOUR_") &&
  !config.supabaseAnonKey.includes("YOUR_");

const supabase = configured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey)
  : null;

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
  el.textContent = text;
  el.className = `status ${kind}`.trim();
}

function stopCamera() {
  if (!state.stream) return;

  state.stream.getTracks().forEach((track) => {
    track.stop();
  });

  state.stream = null;
  camera.srcObject = null;
}

async function waitForVideoReady() {
  return new Promise((resolve) => {
    if (camera.readyState >= 2) {
      resolve();
      return;
    }

    const handler = () => {
      camera.removeEventListener("loadeddata", handler);
      resolve();
    };

    camera.addEventListener("loadeddata", handler);
  });
}

async function startCamera() {
  setStatus(uploadStatus, "");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus(
      uploadStatus,
      "Camera access is not supported in this browser.",
      "error"
    );
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = "Starting...";

  captureBtn.disabled = true;
  switchBtn.disabled = true;

  stopCamera();

  try {
    const constraints = {
      audio: false,
      video: {
        facingMode: {
          ideal: state.facingMode
        },
        width: {
          ideal: 1920
        },
        height: {
          ideal: 1080
        }
      }
    };

    state.stream = await navigator.mediaDevices.getUserMedia(constraints);

    camera.srcObject = state.stream;

    // Important for iPhone/Safari and some mobile browsers
    camera.setAttribute("playsinline", "");
    camera.setAttribute("autoplay", "");
    camera.setAttribute("muted", "");
    camera.muted = true;

    await waitForVideoReady();

    try {
      await camera.play();
    } catch (playError) {
      console.warn("camera.play() warning:", playError);
    }

    cameraPlaceholder.hidden = true;

    captureBtn.disabled = false;
    switchBtn.disabled = false;

    startBtn.textContent = "Restart Camera";

    setStatus(uploadStatus, "Camera ready.", "success");
  } catch (err) {
    console.error("Camera error:", err);

    cameraPlaceholder.hidden = false;

    let message = "Could not start the camera.";

    if (err.name === "NotAllowedError") {
      message =
        "Camera permission was blocked. Allow camera access in your browser settings and reload the page.";
    } else if (err.name === "NotFoundError") {
      message = "No camera was found on this device.";
    } else if (err.name === "NotReadableError") {
      message =
        "The camera is already being used by another app or browser tab.";
    } else if (err.name === "OverconstrainedError") {
      message =
        "The requested camera settings are not supported by this device.";
    } else if (err.name === "SecurityError") {
      message =
        "Camera access requires HTTPS. Open the GitHub Pages HTTPS link.";
    }

    setStatus(uploadStatus, message, "error");
  } finally {
    startBtn.disabled = false;

    if (!state.stream) {
      startBtn.textContent = "Start Camera";
    }
  }
}

async function switchCamera() {
  if (state.facingMode === "user") {
    state.facingMode = "environment";
  } else {
    state.facingMode = "user";
  }

  await startCamera();
}

function capturePhoto() {
  if (!state.stream) {
    setStatus(uploadStatus, "Start the camera first.", "error");
    return;
  }

  if (!camera.videoWidth || !camera.videoHeight) {
    setStatus(
      uploadStatus,
      "Camera is not ready yet. Please wait a moment.",
      "error"
    );
    return;
  }

  const sourceWidth = camera.videoWidth;
  const sourceHeight = camera.videoHeight;

  const maxEdge = 1800;

  let width = sourceWidth;
  let height = sourceHeight;

  const scale = Math.min(
    1,
    maxEdge / Math.max(sourceWidth, sourceHeight)
  );

  width = Math.round(sourceWidth * scale);
  height = Math.round(sourceHeight * scale);

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  ctx.save();

  if (state.facingMode === "user") {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(camera, 0, 0, width, height);

  ctx.restore();

  canvas.toBlob(
    (blob) => {
      if (!blob) {
        setStatus(
          uploadStatus,
          "Could not create the photo. Please try again.",
          "error"
        );
        return;
      }

      state.blob = blob;

      const imageUrl = URL.createObjectURL(blob);

      previewImage.src = imageUrl;

      previewSection.hidden = false;

      setStatus(uploadStatus, "");

      previewSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    },
    "image/jpeg",
    0.88
  );
}

function retake() {
  state.blob = null;

  if (previewImage.src) {
    URL.revokeObjectURL(previewImage.src);
  }

  previewImage.removeAttribute("src");

  previewSection.hidden = true;

  setStatus(uploadStatus, "");
}

async function uploadPhoto() {
  if (state.uploading) return;

  if (!configured || !supabase) {
    setStatus(
      uploadStatus,
      "Supabase is not configured yet.",
      "error"
    );
    return;
  }

  if (!state.blob) {
    setStatus(uploadStatus, "Take a photo first.", "error");
    return;
  }

  if (!consentCheck.checked) {
    setStatus(
      uploadStatus,
      "Please confirm that the photo can appear in the public gallery.",
      "error"
    );
    return;
  }

  state.uploading = true;

  uploadBtn.disabled = true;

  setStatus(uploadStatus, "Saving photo...");

  try {
    const id = crypto.randomUUID();

    const datePath = new Date()
      .toISOString()
      .slice(0, 10);

    const filePath =
      `${datePath}/${Date.now()}-${id}.jpg`;

    const { error: uploadError } =
      await supabase.storage
        .from(config.bucketName)
        .upload(filePath, state.blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false
        });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } =
      supabase.storage
        .from(config.bucketName)
        .getPublicUrl(filePath);

    const publicUrl =
      publicData.publicUrl;

    const { error: dbError } =
      await supabase
        .from("photos")
        .insert({
          storage_path: filePath,
          public_url: publicUrl
        });

    if (dbError) {
      throw dbError;
    }

    setStatus(
      uploadStatus,
      "Saved! Your photo is now in the Mimoru gallery.",
      "success"
    );

    consentCheck.checked = false;

    setTimeout(() => {
      showTab("gallery");
      refreshGallery();
    }, 800);
  } catch (err) {
    console.error("Upload error:", err);

    setStatus(
      uploadStatus,
      `Upload failed: ${err.message || "Please try again."}`,
      "error"
    );
  } finally {
    state.uploading = false;
    uploadBtn.disabled = false;
  }
}

function formatTime(iso) {
  const date = new Date(iso);

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  ).format(date);
}

function renderPhoto(photo) {
  const item = document.createElement("article");

  item.className = "gallery-item";

  const img = document.createElement("img");

  img.loading = "lazy";
  img.decoding = "async";

  img.src = photo.public_url;

  img.alt = "Visitor photo with Mimoru";

  const time = document.createElement("time");

  time.dateTime = photo.created_at;

  time.textContent =
    formatTime(photo.created_at);

  item.append(img, time);

  galleryGrid.appendChild(item);
}

async function loadGallery(reset = false) {
  if (!configured || !supabase) {
    setStatus(
      galleryStatus,
      "Gallery backend is not configured yet.",
      "error"
    );
    return;
  }

  if (reset) {
    state.page = 0;
    state.hasMore = true;
    galleryGrid.innerHTML = "";
  }

  if (!state.hasMore) return;

  setStatus(
    galleryStatus,
    "Loading photos..."
  );

  loadMoreBtn.hidden = true;

  const pageSize =
    Number(config.pageSize || 30);

  const from =
    state.page * pageSize;

  const to =
    from + pageSize - 1;

  const { data, error } =
    await supabase
      .from("photos")
      .select(
        "id, public_url, created_at"
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      )
      .range(from, to);

  if (error) {
    console.error(error);

    setStatus(
      galleryStatus,
      "Could not load the gallery.",
      "error"
    );

    return;
  }

  data.forEach(renderPhoto);

  state.page += 1;

  state.hasMore =
    data.length === pageSize;

  const count =
    galleryGrid.children.length;

  if (count === 0) {
    setStatus(
      galleryStatus,
      "No photos yet — be the first!"
    );
  } else {
    setStatus(
      galleryStatus,
      `${count} photo${count === 1 ? "" : "s"} loaded`
    );
  }

  loadMoreBtn.hidden =
    !state.hasMore;
}

async function refreshGallery() {
  await loadGallery(true);
}

function showTab(name) {
  const showCamera =
    name === "camera";

  cameraPanel.hidden =
    !showCamera;

  galleryPanel.hidden =
    showCamera;

  tabs.forEach((tab) => {
    tab.classList.toggle(
      "is-active",
      tab.dataset.tab === name
    );
  });

  if (
    !showCamera &&
    galleryGrid.children.length === 0
  ) {
    refreshGallery();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener(
    "click",
    () => {
      showTab(tab.dataset.tab);
    }
  );
});

startBtn.addEventListener(
  "click",
  startCamera
);

switchBtn.addEventListener(
  "click",
  switchCamera
);

captureBtn.addEventListener(
  "click",
  capturePhoto
);

retakeBtn.addEventListener(
  "click",
  retake
);

uploadBtn.addEventListener(
  "click",
  uploadPhoto
);

loadMoreBtn.addEventListener(
  "click",
  () => {
    loadGallery(false);
  }
);

refreshGalleryBtn.addEventListener(
  "click",
  refreshGallery
);

window.addEventListener(
  "beforeunload",
  stopCamera
);