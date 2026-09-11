"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Asset = {
  id: string;
  name: string;
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "CHARACTER" | "LOCATION" | "LOGO" | "REFERENCE" | "OTHER";
  storageKey: string;
  mimeType: string | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type Filter = "ALL" | Asset["kind"];

const FILTERS: Filter[] = ["ALL", "IMAGE", "VIDEO", "AUDIO", "CHARACTER", "LOCATION", "LOGO", "REFERENCE", "OTHER"];

function formatBytes(value: number | null) {
  if (value == null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function kindLabel(kind: Asset["kind"]) {
  return kind.charAt(0) + kind.slice(1).toLowerCase();
}

export function AssetLibrary() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assets", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load assets");
      const records = payload.data as Asset[];
      setAssets(records);

      const nextUrls: Record<string, string> = {};
      await Promise.all(records.slice(0, 60).map(async asset => {
        if (!asset.mimeType?.startsWith("image/") && !asset.mimeType?.startsWith("video/")) return;
        const result = await fetch(`/api/assets/${asset.id}/download-url`, { cache: "no-store" });
        if (!result.ok) return;
        const body = await result.json();
        if (body.data?.downloadUrl) nextUrls[asset.id] = body.data.downloadUrl;
      }));
      setUrls(nextUrls);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAssets(); }, [loadAssets]);

  const visibleAssets = useMemo(() => {
    if (filter === "ALL") return assets;
    return assets.filter(asset => asset.kind === filter);
  }, [assets, filter]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const kind = file.type.startsWith("image/") ? "IMAGE" : file.type.startsWith("video/") ? "VIDEO" : file.type.startsWith("audio/") ? "AUDIO" : "OTHER";
      const prepare = await fetch("/api/assets/prepare-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name, kind, mimeType: file.type || "application/octet-stream", byteSize: file.size }),
      });
      const prepared = await prepare.json();
      if (!prepare.ok) throw new Error(prepared.error || "Upload preparation failed");

      const upload = await fetch(prepared.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!upload.ok) throw new Error(`Storage upload failed (${upload.status})`);

      const complete = await fetch(`/api/assets/${prepared.data.asset.id}/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ metadata: { originalFileName: file.name } }),
      });
      const completed = await complete.json();
      if (!complete.ok) throw new Error(completed.error || "Upload finalization failed");

      await loadAssets();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(asset: Asset) {
    if (!window.confirm(`Delete “${asset.name}”?`)) return;
    try {
      const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Delete failed");
      setAssets(current => current.filter(item => item.id !== asset.id));
      setUrls(current => { const next = { ...current }; delete next[asset.id]; return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Delete failed");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#09090b", color: "#f4f4f5", padding: "42px 52px" }}>
      <div style={{ maxWidth: 1500, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
          <div>
            <div style={{ color: "#71717a", fontSize: 12, fontWeight: 800, letterSpacing: ".12em" }}>ASSET ENGINE</div>
            <h1 style={{ fontSize: 42, letterSpacing: "-.045em", margin: "10px 0 8px" }}>Asset Library</h1>
            <p style={{ color: "#a1a1aa", margin: 0, maxWidth: 700 }}>One authenticated library for references, footage, audio, characters, locations, logos, and generated media.</p>
          </div>
          <div>
            <input ref={inputRef} type="file" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void handleUpload(file); }} />
            <button disabled={uploading} onClick={() => inputRef.current?.click()} style={{ border: 0, borderRadius: 11, padding: "12px 18px", background: uploading ? "#27272a" : "#f4f4f5", color: uploading ? "#71717a" : "#09090b", fontWeight: 800, cursor: uploading ? "wait" : "pointer" }}>
              {uploading ? "Uploading…" : "+ Upload asset"}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 34, paddingBottom: 18, borderBottom: "1px solid #27272a" }}>
          {FILTERS.map(item => <button key={item} onClick={() => setFilter(item)} style={{ border: "1px solid #27272a", borderRadius: 999, padding: "7px 12px", background: filter === item ? "#f4f4f5" : "#111113", color: filter === item ? "#09090b" : "#a1a1aa", fontSize: 12, fontWeight: 700 }}>{item === "ALL" ? "All assets" : kindLabel(item)}</button>)}
        </div>

        {error && <div style={{ marginTop: 18, border: "1px solid #4c1d1d", background: "#1c1010", color: "#fca5a5", borderRadius: 10, padding: 12 }}>{error}</div>}

        {loading ? <div style={{ padding: "80px 0", color: "#71717a" }}>Loading asset catalog…</div> : visibleAssets.length === 0 ? (
          <div style={{ marginTop: 22, border: "1px dashed #3f3f46", borderRadius: 16, padding: "80px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Your library is empty</div>
            <div style={{ color: "#71717a", marginTop: 8 }}>Upload a reference or media file to start building the production library.</div>
          </div>
        ) : (
          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
            {visibleAssets.map(asset => {
              const preview = urls[asset.id];
              return <article key={asset.id} style={{ overflow: "hidden", border: "1px solid #27272a", borderRadius: 14, background: "#111113" }}>
                <div style={{ aspectRatio: "16 / 10", background: "#18181b", display: "grid", placeItems: "center", overflow: "hidden" }}>
                  {preview && asset.mimeType?.startsWith("image/") ? <img src={preview} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : preview && asset.mimeType?.startsWith("video/") ? <video src={preview} muted controls preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "#52525b", fontSize: 12 }}>{kindLabel(asset.kind).toUpperCase()}</span>}
                </div>
                <div style={{ padding: 15 }}>
                  <div style={{ fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</div>
                  <div style={{ color: "#71717a", fontSize: 12, marginTop: 6 }}>{kindLabel(asset.kind)} · {formatBytes(asset.byteSize)}</div>
                  <button onClick={() => void handleDelete(asset)} style={{ marginTop: 14, border: 0, background: "transparent", color: "#a1a1aa", padding: 0, fontSize: 12, cursor: "pointer" }}>Delete asset</button>
                </div>
              </article>;
            })}
          </div>
        )}
      </div>
    </main>
  );
}
