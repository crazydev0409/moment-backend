import fs from 'fs';
import path from 'path';

// Azure App Service (including Web App for Containers) mounts /home as
// persistent storage shared across restarts/redeploys/scale-out instances —
// writing anywhere else in the container is wiped on every deploy. Try that
// first and only fall back to a local ./uploads folder (for local dev, where
// /home either doesn't exist or isn't writable by this process).
function resolveUploadsRoot(): string {
  const azureDir = path.join('/home', 'uploads');
  try {
    fs.mkdirSync(azureDir, { recursive: true });
    fs.accessSync(azureDir, fs.constants.W_OK);
    return azureDir;
  } catch {
    const localDir = path.join(process.cwd(), 'uploads');
    fs.mkdirSync(localDir, { recursive: true });
    return localDir;
  }
}

export const UPLOADS_ROOT = resolveUploadsRoot();

export function avatarUploadDir(): string {
  const dir = path.join(UPLOADS_ROOT, 'avatars');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
