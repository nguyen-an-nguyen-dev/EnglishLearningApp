import { PassThrough, Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import cloudinary from 'cloudinary';
import { env } from '../config/env';

export interface AvatarAsset {
  secure_url: string;
  public_id: string;
}

export interface CloudinaryConfig {
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  cloudinaryConfigured: boolean;
}

export interface CloudinaryClient {
  config(options: { cloud_name: string; api_key: string; api_secret: string; secure: true }): unknown;
  uploader: {
    upload_stream(
      options: Record<string, unknown>,
      callback: (error: Error | undefined, result?: AvatarAsset) => void,
    ): PassThrough;
    destroy(publicId: string, options: { invalidate: true }): Promise<unknown>;
  };
}

export class CloudinaryNotConfiguredError extends Error {
  constructor() {
    super('Cloudinary avatar uploads are not configured.');
    this.name = 'CloudinaryNotConfiguredError';
  }
}

export function avatarUploadOptions(userId: number): Record<string, unknown> {
  return {
    folder: 'engorace/avatars',
    public_id: `user-${userId}-${randomUUID()}`,
    overwrite: false,
    invalidate: true,
    resource_type: 'image',
    // `format: 'auto'` is rejected by Cloudinary ("Invalid extension in
    // transformation: auto") and made every avatar upload fail. The uploaded
    // file keeps its own (validated) extension instead.
    quality: 'auto',
    transformation: [{ width: 512, height: 512, crop: 'thumb', gravity: 'face' }],
  };
}

export function createCloudinaryAvatarStore(client: CloudinaryClient, config: CloudinaryConfig) {
  const configure = () => {
    if (!config.cloudinaryConfigured) throw new CloudinaryNotConfiguredError();
    client.config({
      cloud_name: config.cloudinaryCloudName,
      api_key: config.cloudinaryApiKey,
      api_secret: config.cloudinaryApiSecret,
      secure: true,
    });
  };

  return {
    isConfigured: () => config.cloudinaryConfigured,
    async upload(buffer: Buffer, userId: number): Promise<AvatarAsset> {
      configure();
      return new Promise((resolve, reject) => {
        const stream = client.uploader.upload_stream(avatarUploadOptions(userId), (error, result) => {
          if (error) reject(error);
          else if (result?.secure_url && result.public_id) resolve(result);
          else reject(new Error('Cloudinary returned an incomplete avatar result.'));
        });
        Readable.from([buffer]).pipe(stream);
      });
    },
    async remove(publicId: string): Promise<void> {
      if (!config.cloudinaryConfigured) return;
      configure();
      await client.uploader.destroy(publicId, { invalidate: true });
    },
  };
}

const sdk = cloudinary.v2 as unknown as CloudinaryClient;

export const cloudinaryAvatarStore = createCloudinaryAvatarStore(sdk, {
  cloudinaryCloudName: env.cloudinaryCloudName,
  cloudinaryApiKey: env.cloudinaryApiKey,
  cloudinaryApiSecret: env.cloudinaryApiSecret,
  cloudinaryConfigured: env.cloudinaryConfigured,
});
