import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getTaskForProject, listArtifacts, SANDBOX_ROOT, DEFAULT_PROJECT_ID } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string; artifactId: string }> }) {
  const { id, artifactId } = await params;
  const projectId = new URL(req.url).searchParams.get('projectId') || DEFAULT_PROJECT_ID;
  if (!getTaskForProject(id, projectId)) return NextResponse.json({ error: 'task not found' }, { status: 404 });
  const artifact = listArtifacts(id).find((item) => item.id === artifactId);
  if (!artifact) return NextResponse.json({ error: 'artifact not found' }, { status: 404 });

  const sandbox = path.resolve(SANDBOX_ROOT, id);
  const filePath = path.resolve(artifact.path);
  if (!filePath.startsWith(`${sandbox}${path.sep}`) || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'artifact unavailable' }, { status: 404 });
  }

  const disposition = new URL(req.url).searchParams.get('download') === '1' ? 'attachment' : 'inline';
  const extension = path.extname(filePath).slice(1).toLowerCase();
  const safeName = path.basename(artifact.name).replace(/["\r\n]/g, '_');
  return new Response(fs.readFileSync(filePath), {
    headers: {
      'Content-Type': MIME[extension] || 'application/octet-stream',
      'Content-Length': String(fs.statSync(filePath).size),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
