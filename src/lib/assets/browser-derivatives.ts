"use client";

type AssetLike = {
  id: string;
  name: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  durationMs?: number | null;
};

type DerivativeKind = "THUMBNAIL" | "POSTER" | "WAVEFORM";

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("DERIVATIVE_ENCODE_FAILED")), type, quality);
  });
}

async function sourceUrl(assetId: string) {
  const response = await fetch(`/api/assets/${assetId}/download-url`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok || !body.data?.downloadUrl) throw new Error(body.error || "SOURCE_DOWNLOAD_URL_FAILED");
  return body.data.downloadUrl as string;
}

async function prepare(assetId: string, kind: DerivativeKind, mimeType: string, byteSize: number) {
  const response = await fetch(`/api/assets/${assetId}/derivatives/prepare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, mimeType, byteSize }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "DERIVATIVE_PREPARE_FAILED");
  return body.data as { derivative: { id: string }; uploadUrl: string };
}

async function uploadAndComplete(assetId: string, prepared: { derivative: { id: string }; uploadUrl: string }, blob: Blob, metadata: Record<string, unknown>) {
  const upload = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "content-type": blob.type },
    body: blob,
  });
  if (!upload.ok) throw new Error(`DERIVATIVE_UPLOAD_FAILED_${upload.status}`);

  const complete = await fetch(`/api/assets/${assetId}/derivatives/${prepared.derivative.id}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ metadata }),
  });
  const body = await complete.json();
  if (!complete.ok) throw new Error(body.error || "DERIVATIVE_COMPLETE_FAILED");
  return body.data;
}

async function imageThumbnail(assetId: string, url: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();

  const max = 640;
  const scale = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
  return { blob: await canvasBlob(canvas, "image/webp", 0.82), width, height };
}

async function videoPoster(assetId: string, url: string) {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("VIDEO_DECODE_FAILED"));
  });
  const max = 960;
  const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(video.videoHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  video.currentTime = Math.min(0.5, Math.max(0, video.duration || 0));
  await new Promise<void>(resolve => { video.onseeked = () => resolve(); });
  canvas.getContext("2d")!.drawImage(video, 0, 0, width, height);
  return { blob: await canvasBlob(canvas, "image/webp", 0.82), width, height, durationMs: Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : null };
}

async function audioWaveform(assetId: string, url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const buffer = await response.arrayBuffer();
  const context = new AudioContext();
  const audio = await context.decodeAudioData(buffer);
  const width = 1200;
  const height = 240;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const data = audio.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / width));
  ctx.clearRect(0, 0, width, height);
  for (let x = 0; x < width; x++) {
    const start = x * step;
    const end = Math.min(data.length, start + step);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, Math.abs(data[i]));
    const y = Math.round((1 - peak) * height / 2);
    const bar = Math.max(1, Math.round(peak * height));
    ctx.fillRect(x, y, 1, bar);
  }
  await context.close();
  return { blob: await canvasBlob(canvas, "image/webp", 0.8), width, height, durationMs: Math.round(audio.duration * 1000) };
}

export async function generateAssetDerivative(asset: AssetLike, kind: DerivativeKind) {
  const url = await sourceUrl(asset.id);

  if (kind === "THUMBNAIL" && asset.mimeType?.startsWith("image/")) {
    const result = await imageThumbnail(asset.id, url);
    const prepared = await prepare(asset.id, kind, "image/webp", result.blob.size);
    return uploadAndComplete(asset.id, prepared, result.blob, { width: result.width, height: result.height, sourceMimeType: asset.mimeType });
  }

  if (kind === "POSTER" && asset.mimeType?.startsWith("video/")) {
    const result = await videoPoster(asset.id, url);
    const prepared = await prepare(asset.id, kind, "image/webp", result.blob.size);
    return uploadAndComplete(asset.id, prepared, result.blob, { width: result.width, height: result.height, durationMs: result.durationMs, sourceMimeType: asset.mimeType });
  }

  if (kind === "WAVEFORM" && asset.mimeType?.startsWith("audio/")) {
    const result = await audioWaveform(asset.id, url);
    const prepared = await prepare(asset.id, kind, "image/webp", result.blob.size);
    return uploadAndComplete(asset.id, prepared, result.blob, { width: result.width, height: result.height, durationMs: result.durationMs, sourceMimeType: asset.mimeType });
  }

  throw new Error("UNSUPPORTED_DERIVATIVE_SOURCE");
}
