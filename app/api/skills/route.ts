import { NextResponse } from 'next/server';
import { getSkill, listSkills, updateSkillEnabled } from '@/lib/skills';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (id) {
    const skill = getSkill(id);
    return skill ? NextResponse.json({ skill }) : NextResponse.json({ error: 'skill not found' }, { status: 404 });
  }
  return NextResponse.json({ skills: listSkills() });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => null)) as { id?: string; enabled?: boolean } | null;
  const id = String(body?.id ?? '');
  if (!id || typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'id and enabled are required' }, { status: 400 });
  const skill = getSkill(id);
  if (!skill) return NextResponse.json({ error: 'skill not found' }, { status: 404 });
  if (!skill.valid) return NextResponse.json({ error: skill.error || 'skill is invalid' }, { status: 422 });
  return NextResponse.json({ skill: updateSkillEnabled(id, body.enabled) });
}
