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

export function getAssetStorageAdapter(): AssetStorageAdapter {
  throw new Error("ASSET_STORAGE_NOT_CONFIGURED");
}
