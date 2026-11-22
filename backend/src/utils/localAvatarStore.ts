import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AvatarAsset } from './cloudinary';

/**
 * Cloudinary is optional. On a local install (no CLOUDINARY_* env vars) the
 * avatar button must still work, so the image is written under `public/avatars`
 * and served by the `/media` static mount in `app.ts`. Vite proxies `/media` to
 * the backend, so the same URL works in development and in production.
 */
export function createLocalAvatarStore(directory: string) {
  const extension = (buffer: Buffer): string => {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png)) return 'png';
    return 'webp';
  };

  return {
    isConfigured: () => true,
    async upload(buffer: Buffer, userId: number): Promise<AvatarAsset> {
      const publicId = `user-${userId}-${randomUUID()}.${extension(buffer)}`;
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, publicId), buffer);
      return { secure_url: `/media/avatars/${publicId}`, public_id: publicId };
    },
    async remove(publicId: string): Promise<void> {
      // Only the simple file names this store creates may be deleted.
      if (!/^[\w.-]+$/.test(publicId)) return;
      await unlink(resolve(directory, publicId)).catch(() => undefined);
    },
  };
}

export const localAvatarStore = createLocalAvatarStore(resolve(process.cwd(), 'public', 'avatars'));
