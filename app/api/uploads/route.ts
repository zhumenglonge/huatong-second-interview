import { NextResponse } from 'next/server';
import { stageUpload } from '@/lib/uploads';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const form = await req.formData();
  const files = form.getAll('files').filter((value): value is File => value instanceof File);
  const paths = JSON.parse(String(form.get('paths') || '[]')) as string[];
  if (files.length === 0) return NextResponse.json({ error: 'files required' }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: 'maximum 20 files per upload' }, { status: 400 });

  try {
    const uploads = await Promise.all(files.map((file, index) => stageUpload(file, paths[index])));
    return NextResponse.json({ uploads }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
