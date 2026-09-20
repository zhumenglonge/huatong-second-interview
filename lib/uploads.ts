import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { SANDBOX_ROOT } from './db';
import type { UploadRef } from './types';

const DATA_DIR = path.resolve(process.cwd(), process.env.DATA_DIR || '.data');
const UPLOAD_ROOT = path.join(DATA_DIR, 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function safeRelativeName(value: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '');
  const parts = normalized.split('/').filter((part) => part && part !== '.' && part !== '..');
  return parts.join('/').slice(0, 500) || 'attachment';
}

export async function stageUpload(file: File, relativeName?: string): Promise<UploadRef> {
  if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} exceeds the 50 MB limit`);
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  const token = randomUUID();
  const dir = path.join(UPLOAD_ROOT, token);
  fs.mkdirSync(dir, { recursive: true });
  const name = safeRelativeName(relativeName || file.name);
  fs.writeFileSync(path.join(dir, 'data'), Buffer.from(await file.arrayBuffer()));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ name, size: file.size }));
  return { token, name, size: file.size };
}

export function consumeUploads(taskId: string, refs: UploadRef[]): string[] {
  const sandbox = path.join(SANDBOX_ROOT, taskId);
  fs.mkdirSync(sandbox, { recursive: true });
  const names: string[] = [];

  for (const ref of refs.slice(0, 20)) {
    const token = path.basename(String(ref.token));
    const dir = path.join(UPLOAD_ROOT, token);
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')) as { name: string };
      const name = safeRelativeName(meta.name);
      const target = path.resolve(sandbox, name);
      if (!target.startsWith(`${path.resolve(sandbox)}${path.sep}`)) continue;
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(dir, 'data'), target);
      names.push(name);
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Ignore expired or malformed staging tokens.
    }
  }
  return names;
}

export function promptWithAttachments(input: string, names: string[]): string {
  if (names.length === 0) return input;
  return `${input}\n\nAttached files are available in the current working directory:\n${names
    .map((name) => `- ${name}`)
    .join('\n')}`;
}
