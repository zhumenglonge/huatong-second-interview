import fs from 'node:fs';
import path from 'node:path';
import { getSkillEnablement, setSkillEnablement } from './db';

export const SKILLS_ROOT = path.resolve(process.cwd(), 'skills');
export const MAX_SKILL_BYTES = 64 * 1024;

export interface SkillRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  enabled: boolean;
  valid: boolean;
  error?: string;
  instructions: string;
}

function parseSkillFile(id: string, filePath: string): SkillRecord {
  const fallback = { id, name: id, description: '', category: 'Other', source: 'Local', enabled: false };
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_SKILL_BYTES) return { ...fallback, valid: false, error: `skill.md exceeds ${MAX_SKILL_BYTES} bytes`, instructions: '' };
    const raw = fs.readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!match) return { ...fallback, valid: false, error: 'missing YAML front matter', instructions: '' };
    const fields: Record<string, string> = {};
    for (const line of match[1].split(/\r?\n/)) {
      const colon = line.indexOf(':');
      if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
    }
    const name = fields.name || '';
    const description = fields.description || '';
    const instructions = match[2].trim();
    const errors = [
      fields.id && fields.id !== id ? 'front matter id does not match directory name' : '',
      name ? '' : 'missing name',
      description ? '' : 'missing description',
      instructions ? '' : 'missing instruction body',
    ].filter(Boolean);
    return {
      id,
      name: name || id,
      description,
      category: fields.category || 'Other',
      source: fields.source || 'Local',
      enabled: fields.enabled === 'true',
      valid: errors.length === 0,
      ...(errors.length ? { error: errors.join('; ') } : {}),
      instructions,
    };
  } catch (error) {
    return { ...fallback, valid: false, error: `cannot read skill: ${(error as Error).message}`, instructions: '' };
  }
}

export function listSkills(): SkillRecord[] {
  if (!fs.existsSync(SKILLS_ROOT)) return [];
  const records: SkillRecord[] = [];
  for (const entry of fs.readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9-]*$/.test(entry.name)) continue;
    const record = parseSkillFile(entry.name, path.join(SKILLS_ROOT, entry.name, 'skill.md'));
    const override = getSkillEnablement(entry.name);
    record.enabled = record.valid && (override ?? record.enabled);
    records.push(record);
  }
  return records.sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(id: string): SkillRecord | undefined {
  return listSkills().find((skill) => skill.id === id);
}

export function updateSkillEnabled(id: string, enabled: boolean): SkillRecord | undefined {
  const skill = getSkill(id);
  if (!skill || !skill.valid) return skill;
  setSkillEnablement(id, enabled);
  return { ...skill, enabled };
}

export function loadEnabledSkills(ids: string[] = []) {
  const requested = new Set(ids);
  return listSkills().filter((skill) => skill.valid && skill.enabled && (!ids.length || requested.has(skill.id)));
}
