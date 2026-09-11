import { del, issueSignedToken, presignUrl } from "@vercel/blob";

const UPLOAD_URL_TTL_MS = 15 * 60 * 1000;
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;

export type AssetStorageUpload = {
  assetId: string;
  storageKey: string;
  contentType: string;
  byteSize?: number;
};

export type AssetStorageAdapter = {
  createUploadUrl(input: AssetStorageUpload): Promise<{ uploadUrl: string; expiresAt: string }>;
  createDownloadUrl(input: { storageKey: string }): Promise<{ downloadUrl: string; expiresAt: string }>;
  deleteObject(input: { storageKey: string }): Promise<void>;
};

async function createSignedUrl(input: {
  pathname: string;
  operation: "put" | "get";
  validForMs: number;
}) {
  const validUntil = Date.now() + input.validForMs;
  const token = await issueSignedToken({
    pathname: input.pathname,
    operations: [input.operation],
    validUntil,
  });

  const { presignedUrl } = await presignUrl(token, {
    pathname: input.pathname,
    operation: input.operation,
    validUntil,
  });

  return { presignedUrl, expiresAt: new Date(validUntil).toISOString() };
}

const vercelBlobStorageAdapter: AssetStorageAdapter = {
  async createUploadUrl(input) {
    const result = await createSignedUrl({
      pathname: input.storageKey,
      operation: "put",
      validForMs: UPLOAD_URL_TTL_MS,
    });

    return {
      uploadUrl: result.presignedUrl,
      expiresAt: result.expiresAt,
    };
  },

  async createDownloadUrl(input) {
    const result = await createSignedUrl({
      pathname: input.storageKey,
      operation: "get",
      validForMs: DOWNLOAD_URL_TTL_MS,
    });

    return {
      downloadUrl: result.presignedUrl,
      expiresAt: result.expiresAt,
    };
  },

  async deleteObject(input) {
    await del(input.storageKey, { token: process.env.BLOB_READ_WRITE_TOKEN });
  },
};

export function getAssetStorageAdapter(): AssetStorageAdapter {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL) {
    throw new Error("ASSET_STORAGE_NOT_CONFIGURED");
  }

  return vercelBlobStorageAdapter;
}
