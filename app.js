import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";
const c=window.MIMORU_CONFIG||{};const ok=c.supabaseUrl&&c.supabaseAnonKey&&!c.supabaseUrl.includes("YOUR_")&&!c.supabaseAnonKey.includes("YOUR_");const supabase=ok?createClient(c.supabaseUrl,c.supabaseAnonKey):null;
const s={stream:null,facing:"user",blob:null,page:0,more:true,busy:false};
const $=id=>document.getElementById(id);const camera=$("camera"),canvas=$("canvas"),placeholder=$("placeholder"),startBtn=$("startBtn"),switchBtn=$("switchBtn"),captureBtn=$("captureBtn"),preview=$("preview"),previewImg=$("previewImg"),retakeBtn=$("retakeBtn"),uploadBtn=$("uploadBtn"),consent=$("consent"),uploadStatus=$("uploadStatus"),galleryStatus=$("galleryStatus"),gallery=$("gallery"),moreBtn=$("moreBtn"),refreshBtn=$("refreshBtn"),cameraPanel=$("cameraPanel"),galleryPanel=$("galleryPanel"),tabs=[...document.querySelectorAll(".tab")];
function status(el,t,k=""){el.textContent=t;el.className=("status "+k).trim()}function stop(){if(s.stream)s.stream.getTracks().forEach(t=>t.stop());s.stream=null}
async function start(){stop();try{s.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:s.facing},width:{ideal:1920},height:{ideal:1080}},audio:false});    camera.srcObject = state.stream;

    await camera.play();

    cameraPlaceholder.hidden = true;
    captureBtn.disabled = false;
    switchBtn.disabled = false;
    startBtn.textContent = "Restart Camera";

  } catch (err) {
    console.error("Camera error:", err);
    alert("Camera error: " + err.name + " - " + err.message);
  }
}status(uploadStatus,"")}catch(e){placeholder.hidden=false;status(uploadStatus,"Could not open the camera. Check permission and HTTPS.","error")}}
async function sw(){s.facing=s.facing==="user"?"environment":"user";await start()}
function capture(){if(!s.stream)return;let w=camera.videoWidth||1280,h=camera.videoHeight||720;const scale=Math.min(1,1800/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);canvas.width=w;canvas.height=h;const x=canvas.getContext("2d");if(s.facing==="user"){x.translate(w,0);x.scale(-1,1)}x.drawImage(camera,0,0,w,h);canvas.toBlob(b=>{if(!b)return;s.blob=b;previewImg.src=URL.createObjectURL(b);preview.hidden=false;preview.scrollIntoView({behavior:"smooth",block:"start"})},"image/jpeg",.88)}
function retake(){s.blob=null;preview.hidden=true;previewImg.removeAttribute("src");status(uploadStatus,"")}
async function upload(){if(s.busy)return;if(!ok)return status(uploadStatus,"Supabase is not configured yet. See README.md.","error");if(!s.blob)return status(uploadStatus,"Take a photo first.","error");if(!consent.checked)return status(uploadStatus,"Please tick the gallery consent box first.","error");s.busy=true;uploadBtn.disabled=true;status(uploadStatus,"Saving photo…");try{const path=`${new Date().toISOString().slice(0,10)}/${Date.now()}-${crypto.randomUUID()}.jpg`;let r=await supabase.storage.from(c.bucketName).upload(path,s.blob,{contentType:"image/jpeg",cacheControl:"3600",upsert:false});if(r.error)throw r.error;const pub=supabase.storage.from(c.bucketName).getPublicUrl(path).data.publicUrl;r=await supabase.from("photos").insert({storage_path:path,public_url:pub});if(r.error)throw r.error;status(uploadStatus,"Saved! Your photo is now in the Mimoru gallery.","success");consent.checked=false;setTimeout(()=>{show("gallery");load(true)},600)}catch(e){console.error(e);status(uploadStatus,"Upload failed: "+(e.message||"Please try again."),"error")}finally{s.busy=false;uploadBtn.disabled=false}}
function fmt(t){return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(t))}function add(p){const a=document.createElement("article");a.className="item";const i=document.createElement("img");i.loading="lazy";i.src=p.public_url;i.alt="Visitor photo with Mimoru";const tm=document.createElement("time");tm.dateTime=p.created_at;tm.textContent=fmt(p.created_at);a.append(i,tm);gallery.append(a)}
async function load(reset=false){if(!ok)return status(galleryStatus,"Gallery backend is not configured yet. See README.md.","error");if(reset){s.page=0;s.more=true;gallery.innerHTML=""}if(!s.more)return;status(galleryStatus,"Loading photos…");moreBtn.hidden=true;const n=Number(c.pageSize||30),from=s.page*n,to=from+n-1;const r=await supabase.from("photos").select("id,public_url,created_at").order("created_at",{ascending:false}).range(from,to);if(r.error)return status(galleryStatus,"Could not load gallery.","error");r.data.forEach(add);s.page++;s.more=r.data.length===n;status(galleryStatus,gallery.children.length?`${gallery.children.length} photos loaded`:"No photos yet — be the first!");moreBtn.hidden=!s.more}
function show(name){const cam=name==="camera";cameraPanel.hidden=!cam;galleryPanel.hidden=cam;tabs.forEach(t=>t.classList.toggle("active",t.dataset.tab===name));if(!cam&&!gallery.children.length)load(true)}
tabs.forEach(t=>t.addEventListener("click",()=>show(t.dataset.tab)));startBtn.addEventListener("click",start);switchBtn.addEventListener("click",sw);captureBtn.addEventListener("click",capture);retakeBtn.addEventListener("click",retake);uploadBtn.addEventListener("click",upload);moreBtn.addEventListener("click",()=>load(false));refreshBtn.addEventListener("click",()=>load(true));window.addEventListener("beforeunload",stop);
