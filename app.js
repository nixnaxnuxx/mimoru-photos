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


/* =========================================================
   ELEMENTS
========================================================= */

const camera =
  document.getElementById("camera");

const canvas =
  document.getElementById("captureCanvas");

const cameraPlaceholder =
  document.getElementById("cameraPlaceholder");


const startBtn =
  document.getElementById("startCameraBtn");

const switchBtn =
  document.getElementById("switchCameraBtn");

const captureBtn =
  document.getElementById("captureBtn");


const previewSection =
  document.getElementById("previewSection");

const previewImage =
  document.getElementById("previewImage");

const retakeBtn =
  document.getElementById("retakeBtn");

const uploadBtn =
  document.getElementById("uploadBtn");

const consentCheck =
  document.getElementById("consentCheck");


const uploadStatus =
  document.getElementById("uploadStatus");

const galleryStatus =
  document.getElementById("galleryStatus");

const galleryGrid =
  document.getElementById("galleryGrid");

const loadMoreBtn =
  document.getElementById("loadMoreBtn");

const refreshGalleryBtn =
  document.getElementById("refreshGalleryBtn");


const cameraPanel =
  document.getElementById("cameraPanel");

const galleryPanel =
  document.getElementById("galleryPanel");


const tabs =
  [...document.querySelectorAll(".tab")];


/* =========================================================
   STATUS
========================================================= */

function setStatus(
  element,
  message,
  type = ""
) {

  if (!element) return;

  element.textContent =
    message;

  element.className =
    "status";

  if (type) {
    element.classList.add(type);
  }

}


/* =========================================================
   SUPABASE
========================================================= */

async function loadSupabase() {

  if (supabaseLoaded) {
    return supabase;
  }

  supabaseLoaded =
    true;


  const configured =

    config.supabaseUrl &&

    config.supabaseAnonKey &&

    !config.supabaseUrl.includes(
      "YOUR_"
    ) &&

    !config.supabaseAnonKey.includes(
      "YOUR_"
    );


  if (!configured) {

    console.error(
      "Supabase config missing."
    );

    return null;
  }


  try {

    const module =
      await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm"
      );


    supabase =
      module.createClient(

        config.supabaseUrl,

        config.supabaseAnonKey

      );


    console.log(
      "Supabase connected."
    );


    return supabase;

  } catch (error) {

    console.error(
      "Supabase loading failed:",
      error
    );


    return null;
  }

}


/* =========================================================
   CAMERA
========================================================= */

function stopCamera() {

  if (!state.stream) {
    return;
  }


  state.stream
    .getTracks()
    .forEach(
      track => track.stop()
    );


  state.stream =
    null;


  camera.srcObject =
    null;

}


/* =========================================================
   MIRROR PREVIEW
========================================================= */

function updateCameraOrientation() {

  if (
    state.facingMode === "user"
  ) {

    camera.classList.add(
      "selfie"
    );

  } else {

    camera.classList.remove(
      "selfie"
    );

  }

}


/* =========================================================
   START CAMERA
========================================================= */

async function startCamera() {

  setStatus(
    uploadStatus,
    "Starting camera..."
  );


  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    setStatus(
      uploadStatus,
      "Camera access is not supported in this browser.",
      "error"
    );

    return;

  }


  startBtn.disabled =
    true;

  captureBtn.disabled =
    true;

  switchBtn.disabled =
    true;


  stopCamera();


  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({

        audio:
          false,

        video: {

          facingMode: {
            ideal:
              state.facingMode
          },

          width: {
            ideal:
              1920
          },

          height: {
            ideal:
              1080
          }

        }

      });


    state.stream =
      stream;


    camera.srcObject =
      stream;


    camera.muted =
      true;


    camera.setAttribute(
      "playsinline",
      ""
    );


    camera.setAttribute(
      "autoplay",
      ""
    );


    camera.setAttribute(
      "muted",
      ""
    );


    updateCameraOrientation();


    await new Promise(
      resolve => {

        if (
          camera.readyState >= 2 &&
          camera.videoWidth > 0
        ) {

          resolve();

        } else {

          const ready =
            () => {

              camera.removeEventListener(
                "loadedmetadata",
                ready
              );

              resolve();

            };


          camera.addEventListener(
            "loadedmetadata",
            ready
          );

        }

      }
    );


    try {

      await camera.play();

    } catch (
      playError
    ) {

      console.warn(
        "camera.play warning:",
        playError
      );

    }


    cameraPlaceholder.hidden =
      true;


    cameraPlaceholder.style.display =
      "none";


    captureBtn.disabled =
      false;


    switchBtn.disabled =
      false;


    startBtn.textContent =
      "Restart Camera";


    setStatus(
      uploadStatus,
      "Camera ready!",
      "success"
    );


  } catch (error) {

    console.error(
      "Camera error:",
      error
    );


    cameraPlaceholder.hidden =
      false;


    cameraPlaceholder.style.display =
      "grid";


    let message =
      "Unable to start camera.";


    if (
      error.name ===
      "NotAllowedError"
    ) {

      message =
        "Camera permission was denied. Allow camera access and reload.";

    }


    else if (
      error.name ===
      "NotFoundError"
    ) {

      message =
        "No camera was found.";

    }


    else if (
      error.name ===
      "NotReadableError"
    ) {

      message =
        "Camera is being used by another app or tab.";

    }


    else if (
      error.name ===
      "SecurityError"
    ) {

      message =
        "Camera requires HTTPS.";

    }


    setStatus(
      uploadStatus,
      message,
      "error"
    );


  } finally {

    startBtn.disabled =
      false;


    if (
      !state.stream
    ) {

      startBtn.textContent =
        "Start Camera";

    }

  }

}


/* =========================================================
   SWITCH CAMERA
========================================================= */

async function switchCamera() {

  state.facingMode =

    state.facingMode ===
    "user"

      ? "environment"

      : "user";


  await startCamera();

}


/* =========================================================
   ROUNDED RECTANGLE HELPER
========================================================= */

function roundRectPath(
  ctx,
  x,
  y,
  width,
  height,
  radius
) {

  const r =
    Math.min(
      radius,
      width / 2,
      height / 2
    );


  ctx.beginPath();

  ctx.moveTo(
    x + r,
    y
  );


  ctx.arcTo(
    x + width,
    y,
    x + width,
    y + height,
    r
  );


  ctx.arcTo(
    x + width,
    y + height,
    x,
    y + height,
    r
  );


  ctx.arcTo(
    x,
    y + height,
    x,
    y,
    r
  );


  ctx.arcTo(
    x,
    y,
    x + width,
    y,
    r
  );


  ctx.closePath();

}


/* =========================================================
   PHOTO TEMPLATE
========================================================= */

function drawTemplate(
  ctx,
  width,
  height
) {

  const pad =
    Math.max(
      18,
      Math.round(
        Math.min(
          width,
          height
        ) * 0.024
      )
    );


  const accent =
    "#ff3f77";


  const whitePanel =
    "rgba(255,255,255,0.90)";


  const darkText =
    "#16161f";


  const small =
    Math.max(
      16,
      Math.round(
        width * 0.022
      )
    );


  /*
    Outer pink frame
  */

  ctx.save();


  ctx.lineWidth =
    Math.max(
      6,
      Math.round(
        Math.min(
          width,
          height
        ) * 0.008
      )
    );


  ctx.strokeStyle =
    accent;


  roundRectPath(
    ctx,

    pad,

    pad,

    width -
      pad * 2,

    height -
      pad * 2,

    Math.max(
      22,
      pad
    )
  );


  ctx.stroke();


  ctx.restore();


  /*
    Top left title pill
  */

  const pillW =
    Math.min(
      width * 0.58,

      width -
        pad * 4
    );


  const pillH =
    Math.max(
      54,

      Math.round(
        height * 0.09
      )
    );


  const pillX =
    pad * 2.2;


  const pillY =
    pad * 2.2;


  ctx.save();


  ctx.fillStyle =
    whitePanel;


  roundRectPath(
    ctx,

    pillX,

    pillY,

    pillW,

    pillH,

    pillH / 2
  );


  ctx.fill();


  ctx.strokeStyle =
    accent;


  ctx.lineWidth =
    3;


  ctx.stroke();


  ctx.fillStyle =
    darkText;


  const titleFontSize =
    Math.max(
      20,

      Math.round(
        width * 0.035
      )
    );


  ctx.font =
    `700 ${titleFontSize}px Inter, "Noto Sans JP", Arial, sans-serif`;


  ctx.textBaseline =
    "middle";


  ctx.fillText(

    "I MET MIMORU (ミモル)!",

    pillX +
      pillH * 0.38,

    pillY +
      pillH / 2

  );


  ctx.restore();


  /*
    Top right event badge
  */

  const badgeW =
    Math.min(
      width * 0.34,
      340
    );


  const badgeH =
    Math.max(
      52,
      Math.round(
        height * 0.08
      )
    );


  const badgeX =
    width -
    pad * 2.2 -
    badgeW;


  const badgeY =
    pillY;


  ctx.save();


  ctx.fillStyle =
    accent;


  roundRectPath(
    ctx,

    badgeX,

    badgeY,

    badgeW,

    badgeH,

    18
  );


  ctx.fill();


  ctx.fillStyle =
    "#ffffff";


  ctx.font =
    `800 ${small + 3}px Inter, Arial, sans-serif`;


  ctx.textAlign =
    "center";


  ctx.textBaseline =
    "middle";


  ctx.fillText(

    "IEEE RO-MAN 2026",

    badgeX +
      badgeW / 2,

    badgeY +
      badgeH * 0.40

  );


  ctx.font =
    `700 ${small}px Inter, Arial, sans-serif`;


  ctx.fillText(

    "Kitakyushu, Japan",

    badgeX +
      badgeW / 2,

    badgeY +
      badgeH * 0.72

  );


  ctx.restore();

}


/* =========================================================
   CAPTURE PHOTO
========================================================= */

function capturePhoto() {

  if (
    !state.stream
  ) {

    setStatus(
      uploadStatus,
      "Start the camera first.",
      "error"
    );

    return;

  }


  if (
    !camera.videoWidth ||
    !camera.videoHeight
  ) {

    setStatus(
      uploadStatus,
      "Camera is still loading.",
      "error"
    );

    return;

  }


  const maxDimension =
    1800;


  const scale =
    Math.min(

      1,

      maxDimension /

      Math.max(

        camera.videoWidth,

        camera.videoHeight

      )

    );


  const width =
    Math.round(
      camera.videoWidth *
      scale
    );


  const height =
    Math.round(
      camera.videoHeight *
      scale
    );


  canvas.width =
    width;


  canvas.height =
    height;


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.save();


  /*
    Mirror selfie camera
  */

  if (
    state.facingMode ===
    "user"
  ) {

    ctx.translate(
      width,
      0
    );


    ctx.scale(
      -1,
      1
    );

  }


  ctx.drawImage(

    camera,

    0,
    0,

    width,
    height

  );


  ctx.restore();


  /*
    Apply Mimoru template
  */

  drawTemplate(
    ctx,
    width,
    height
  );


  canvas.toBlob(

    blob => {

      if (!blob) {

        setStatus(
          uploadStatus,
          "Could not capture photo.",
          "error"
        );

        return;

      }


      state.blob =
        blob;


      const oldUrl =
        previewImage.dataset.objectUrl;


      if (
        oldUrl
      ) {

        URL.revokeObjectURL(
          oldUrl
        );

      }


      const newUrl =
        URL.createObjectURL(
          blob
        );


      previewImage.src =
        newUrl;


      previewImage.dataset.objectUrl =
        newUrl;


      previewSection.hidden =
        false;


      previewSection.style.display =
        "block";


      setStatus(
        uploadStatus,
        "Photo captured!",
        "success"
      );


      previewSection.scrollIntoView({

        behavior:
          "smooth",

        block:
          "start"

      });

    },

    "image/jpeg",

    0.92

  );

}


/* =========================================================
   RETAKE
========================================================= */

function retakePhoto() {

  state.blob =
    null;


  const oldUrl =
    previewImage.dataset.objectUrl;


  if (
    oldUrl
  ) {

    URL.revokeObjectURL(
      oldUrl
    );

  }


  previewImage.src =
    "";


  previewImage.dataset.objectUrl =
    "";


  previewSection.hidden =
    true;


  previewSection.style.display =
    "none";


  setStatus(
    uploadStatus,
    ""
  );

}


/* =========================================================
   UPLOAD PHOTO
========================================================= */

async function uploadPhoto() {

  if (
    !state.blob
  ) {

    setStatus(
      uploadStatus,
      "Take a photo first.",
      "error"
    );

    return;

  }


  if (
    !consentCheck.checked
  ) {

    setStatus(
      uploadStatus,
      "Please confirm the gallery consent box.",
      "error"
    );

    return;

  }


  const client =
    await loadSupabase();


  if (
    !client
  ) {

    setStatus(
      uploadStatus,
      "Gallery connection failed. Check config.js.",
      "error"
    );

    return;

  }


  if (
    state.uploading
  ) {

    return;

  }


  state.uploading =
    true;


  uploadBtn.disabled =
    true;


  setStatus(
    uploadStatus,
    "Uploading photo..."
  );


  try {

    const randomId =
      crypto.randomUUID();


    const today =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    const filePath =

      `${today}/${Date.now()}-${randomId}.jpg`;


    console.log(
      "Uploading to:",
      filePath
    );


    /*
      STORAGE UPLOAD
    */

    const {
      error: uploadError
    } =

      await client.storage

        .from(
          config.bucketName
        )

        .upload(

          filePath,

          state.blob,

          {

            contentType:
              "image/jpeg",

            cacheControl:
              "3600",

            upsert:
              false

          }

        );


    if (
      uploadError
    ) {

      console.error(
        "Storage upload error:",
        uploadError
      );


      throw new Error(
        "Storage upload failed: " +
        uploadError.message
      );

    }


    /*
      Build public URL
    */

    const {
      data: urlData
    } =

      client.storage

        .from(
          config.bucketName
        )

        .getPublicUrl(
          filePath
        );


    console.log(
      "Public URL:",
      urlData.publicUrl
    );


    /*
      Insert database row
    */

    const {
      error: databaseError
    } =

      await client

        .from(
          "photos"
        )

        .insert({

          storage_path:
            filePath,

          public_url:
            urlData.publicUrl

        });


    if (
      databaseError
    ) {

      console.error(
        "Database insert error:",
        databaseError
      );


      throw new Error(
        "Database insert failed: " +
        databaseError.message
      );

    }


    setStatus(
      uploadStatus,
      "Photo saved successfully!",
      "success"
    );


    consentCheck.checked =
      false;


    setTimeout(

      () => {

        showTab(
          "gallery"
        );


        refreshGallery();

      },

      700

    );


  } catch (
    error
  ) {

    console.error(
      "Upload error:",
      error
    );


    setStatus(

      uploadStatus,

      "Upload failed: " +
      (
        error.message ||
        "Unknown error"
      ),

      "error"

    );


  } finally {

    state.uploading =
      false;


    uploadBtn.disabled =
      false;

  }

}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatTime(
  dateString
) {

  return new Intl.DateTimeFormat(

    undefined,

    {

      month:
        "short",

      day:
        "numeric",

      hour:
        "numeric",

      minute:
        "2-digit"

    }

  ).format(

    new Date(
      dateString
    )

  );

}


/* =========================================================
   RENDER GALLERY PHOTO
========================================================= */

function renderPhoto(
  photo,
  client
) {

  const item =
    document.createElement(
      "article"
    );


  item.className =
    "gallery-item";


  const image =
    document.createElement(
      "img"
    );


  image.loading =
    "lazy";


  image.decoding =
    "async";


  image.alt =
    "Photo with Mimoru";


  /*
    IMPORTANT:
    Rebuild the URL using storage_path.
  */

  const {
    data: publicData
  } =

    client.storage

      .from(
        config.bucketName
      )

      .getPublicUrl(
        photo.storage_path
      );


  image.src =
    publicData.publicUrl;


  image.onerror =
    () => {

      console.error(
        "Could not display image:",
        publicData.publicUrl
      );

    };


  const time =
    document.createElement(
      "time"
    );


  time.dateTime =
    photo.created_at;


  time.textContent =
    formatTime(
      photo.created_at
    );


  item.append(
    image,
    time
  );


  galleryGrid.appendChild(
    item
  );

}


/* =========================================================
   LOAD GALLERY
========================================================= */

async function loadGallery(
  reset = false
) {

  const client =
    await loadSupabase();


  if (
    !client
  ) {

    setStatus(
      galleryStatus,
      "Gallery connection failed.",
      "error"
    );

    return;

  }


  if (
    reset
  ) {

    state.page =
      0;


    state.hasMore =
      true;


    galleryGrid.innerHTML =
      "";

  }


  if (
    !state.hasMore
  ) {

    return;

  }


  const pageSize =
    Number(
      config.pageSize ||
      30
    );


  const start =
    state.page *
    pageSize;


  const end =
    start +
    pageSize -
    1;


  setStatus(
    galleryStatus,
    "Loading photos..."
  );


  /*
    IMPORTANT CHANGE:
    Read storage_path instead of public_url.
  */

  const {
    data,
    error
  } =

    await client

      .from(
        "photos"
      )

      .select(
        "id, storage_path, created_at"
      )

      .order(
        "created_at",
        {
          ascending:
            false
        }
      )

      .range(
        start,
        end
      );


  if (
    error
  ) {

    console.error(
      "Gallery query error:",
      error
    );


    setStatus(

      galleryStatus,

      "Could not load gallery: " +
      error.message,

      "error"

    );


    return;

  }


  console.log(
    "Gallery rows:",
    data
  );


  data.forEach(

    photo => {

      renderPhoto(
        photo,
        client
      );

    }

  );


  state.page +=
    1;


  state.hasMore =
    data.length ===
    pageSize;


  loadMoreBtn.hidden =
    !state.hasMore;


  const count =
    galleryGrid.children.length;


  if (
    count === 0
  ) {

    setStatus(
      galleryStatus,
      "No photos yet."
    );

  } else {

    setStatus(

      galleryStatus,

      `${count} photo${count === 1 ? "" : "s"} loaded`

    );

  }

}


/* =========================================================
   REFRESH
========================================================= */

function refreshGallery() {

  return loadGallery(
    true
  );

}


/* =========================================================
   TABS
========================================================= */

function showTab(
  name
) {

  const isCamera =
    name ===
    "camera";


  cameraPanel.hidden =
    !isCamera;


  galleryPanel.hidden =
    isCamera;


  tabs.forEach(

    tab => {

      tab.classList.toggle(

        "is-active",

        tab.dataset.tab ===
        name

      );

    }

  );


  if (
    !isCamera
  ) {

    refreshGallery();

  }

}


/* =========================================================
   EVENTS
========================================================= */

if (
  startBtn
) {

  startBtn.addEventListener(
    "click",
    startCamera
  );

}


if (
  switchBtn
) {

  switchBtn.addEventListener(
    "click",
    switchCamera
  );

}


if (
  captureBtn
) {

  captureBtn.addEventListener(
    "click",
    capturePhoto
  );

}


if (
  retakeBtn
) {

  retakeBtn.addEventListener(
    "click",
    retakePhoto
  );

}


if (
  uploadBtn
) {

  uploadBtn.addEventListener(
    "click",
    uploadPhoto
  );

}


if (
  loadMoreBtn
) {

  loadMoreBtn.addEventListener(

    "click",

    () => {

      loadGallery(
        false
      );

    }

  );

}


if (
  refreshGalleryBtn
) {

  refreshGalleryBtn.addEventListener(
    "click",
    refreshGallery
  );

}


tabs.forEach(

  tab => {

    tab.addEventListener(

      "click",

      () => {

        showTab(
          tab.dataset.tab
        );

      }

    );

  }

);


window.addEventListener(
  "beforeunload",
  stopCamera
);


updateCameraOrientation();


console.log(
  "Mimoru app loaded successfully."
);
