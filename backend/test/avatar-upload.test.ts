import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
  createCloudinaryAvatarStore,
  type AvatarAsset,
  type CloudinaryClient,
} from '../src/utils/cloudinary';
import { createLocalAvatarStore } from '../src/utils/localAvatarStore';
import { validateAvatarBuffer } from '../src/modules/auth/auth.service';
import { HttpError } from '../src/middleware/error-handler';

function pngFixture(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

test('avatar uploads validate image signatures and the 5 MB limit', () => {
  assert.doesNotThrow(() => validateAvatarBuffer(pngFixture()));
  assert.throws(() => validateAvatarBuffer(Buffer.from('not an image')), (error: unknown) =>
    error instanceof HttpError && error.errors.includes('AVATAR_INVALID_TYPE'));
  assert.throws(() => validateAvatarBuffer(Buffer.alloc(5 * 1024 * 1024 + 1)), (error: unknown) =>
    error instanceof HttpError && error.statusCode === 413 && error.errors.includes('AVATAR_TOO_LARGE'));
});

test('Cloudinary receives a face-cropped avatar stream and old assets can be deleted', async () => {
  let uploadOptions: Record<string, unknown> | undefined;
  let received: Buffer[] = [];
  let destroyed: string | undefined;
  const asset: AvatarAsset = { secure_url: 'https://res.cloudinary.com/demo/avatar.webp', public_id: 'engorace/avatars/user-42-random' };
  const client: CloudinaryClient = {
    config: () => undefined,
    uploader: {
      upload_stream: (options, callback) => {
        uploadOptions = options;
        const stream = new PassThrough();
        stream.on('data', (chunk: Buffer) => received.push(Buffer.from(chunk)));
        stream.on('finish', () => callback(undefined, asset));
        return stream;
      },
      destroy: async (publicId) => { destroyed = publicId; return { result: 'ok' }; },
    },
  };
  const store = createCloudinaryAvatarStore(client, {
    cloudinaryCloudName: 'demo', cloudinaryApiKey: 'test-key', cloudinaryApiSecret: 'test-secret', cloudinaryConfigured: true,
  });

  const uploaded = await store.upload(pngFixture(), 42);
  assert.equal(uploaded.secure_url, asset.secure_url);
  assert.equal(Buffer.concat(received).toString('hex'), pngFixture().toString('hex'));
  assert.match(String(uploadOptions?.public_id), /^user-42-[\da-f-]{36}$/);
  assert.deepEqual(uploadOptions?.transformation, [{ width: 512, height: 512, crop: 'thumb', gravity: 'face' }]);
  // `format: 'auto'` is rejected by Cloudinary; the upload keeps the file's
  // own extension (JPEG/PNG/WebP are all validated before reaching the store).
  assert.equal(uploadOptions?.format, undefined);
  assert.equal(uploadOptions?.quality, 'auto');
  assert.equal(uploadOptions?.overwrite, false);

  await store.remove('engorace/avatars/old-user-42');
  assert.equal(destroyed, 'engorace/avatars/old-user-42');
});

test('the local store keeps avatars working without Cloudinary and serves them from /media', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'engorace-avatars-'));
  try {
    const store = createLocalAvatarStore(directory);
    assert.equal(store.isConfigured(), true);
    const fixture = pngFixture();
    const uploaded = await store.upload(fixture, 42);
    assert.match(uploaded.secure_url, /^\/media\/avatars\/user-42-[\da-f-]+\.png$/);
    assert.deepEqual(await readFile(join(directory, uploaded.public_id)), fixture);

    await store.remove(uploaded.public_id);
    await assert.rejects(readFile(join(directory, uploaded.public_id)));

    // A Cloudinary-style public id must never escape the avatar directory.
    await assert.doesNotReject(store.remove('engorace/avatars/user-42'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('unconfigured Cloudinary does not attempt an upload', async () => {
  let configured = false;
  const client: CloudinaryClient = {
    config: () => { configured = true; },
    uploader: {
      upload_stream: () => new PassThrough(),
      destroy: async () => ({ result: 'ok' }),
    },
  };
  const store = createCloudinaryAvatarStore(client, {
    cloudinaryCloudName: '', cloudinaryApiKey: '', cloudinaryApiSecret: '', cloudinaryConfigured: false,
  });
  await assert.rejects(store.upload(pngFixture(), 7), /not configured/i);
  assert.equal(configured, false);
});
