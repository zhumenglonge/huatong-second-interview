'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Blocks, Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IconRail } from '@/components/IconRail';
import type { SkillRecord } from '@/lib/skills';

export default function SkillsPage() {
  const router = useRouter();
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<SkillRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/skills', { cache: 'no-store' });
      const body = (await response.json()) as { skills?: SkillRecord[]; error?: string };
      if (!response.ok) throw new Error(body.error || 'Failed to load skills');
      setSkills(body.skills ?? []);
      setSelected((current) => current ? (body.skills ?? []).find((item) => item.id === current.id) ?? null : null);
    } catch (err) { setError((err as Error).message); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const categories = useMemo(() => ['All', ...Array.from(new Set(skills.map((skill) => skill.category)))], [skills]);
  const visible = skills.filter((skill) => {
    const matchesQuery = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === 'All' || skill.category === category);
  });

  const toggle = async (skill: SkillRecord) => {
    const response = await fetch('/api/skills', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: skill.id, enabled: !skill.enabled }) });
    const body = (await response.json()) as { skill?: SkillRecord; error?: string };
    if (!response.ok || !body.skill) { setError(body.error || 'Unable to update skill'); return; }
    setSkills((items) => items.map((item) => item.id === skill.id ? body.skill! : item));
    setSelected((current) => current?.id === skill.id ? body.skill! : current);
  };

  return <div className="skill-shell">
    <IconRail activeItem="hub" onProjectClick={() => router.push('/')} onHubClick={() => router.push('/skills')} />
    <main className="skill-main">
      <header className="skill-header">
        <div><button className="skill-back" onClick={() => router.push('/')}><ArrowLeft size={15} /> 返回工作区</button><div className="skill-kicker"><Blocks size={14} /> SKILL HUB</div><h1>技能中心</h1><p>管理项目本地技能，并将启用的技能应用到后续 Agent 任务。</p></div>
        <button className="skill-refresh" onClick={() => void load()}><SlidersHorizontal size={15} /> 刷新注册表</button>
      </header>
      <section className="skill-toolbar"><label className="skill-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索技能名称、描述或 ID" /></label><div className="skill-filters">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div></section>
      {error && <div className="skill-error">{error}</div>}
      {loading ? <div className="skill-empty">正在读取本地 skills/ 注册表…</div> : visible.length === 0 ? <div className="skill-empty">没有匹配的技能</div> : <div className="skill-grid">{visible.map((skill) => <article className={`skill-card ${skill.valid ? '' : 'invalid'}`} key={skill.id} onClick={() => setSelected(skill)}><div className="skill-card-icon"><Blocks size={20} /></div><div className="skill-card-copy"><div className="skill-card-title"><h2>{skill.name}</h2><span className="skill-source">{skill.source}</span></div><p>{skill.description}</p><div className="skill-card-meta"><span>{skill.category}</span><span className={skill.valid ? 'valid' : 'invalid-label'}>{skill.valid ? 'Validated' : 'Invalid'}</span></div></div><button className={`skill-toggle ${skill.enabled ? 'on' : ''}`} disabled={!skill.valid} onClick={(event) => { event.stopPropagation(); void toggle(skill); }} aria-label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}><span /></button></article>)}</div>}
    </main>
    {selected && <aside className="skill-detail"><button className="skill-detail-close" onClick={() => setSelected(null)}><X size={17} /></button><div className="skill-detail-icon"><Blocks size={25} /></div><span className="skill-detail-category">{selected.category}</span><h2>{selected.name}</h2><p>{selected.description}</p><div className="skill-detail-state">{selected.enabled ? <><Check size={15} /> 已启用</> : '未启用'}</div>{selected.error && <div className="skill-error">{selected.error}</div>}<h3>技能指令</h3><pre>{selected.instructions || '没有可读取的技能指令。'}</pre>{selected.valid && <button className="skill-primary" onClick={() => void toggle(selected)}>{selected.enabled ? '停用技能' : '启用技能'}</button>}</aside>}
  </div>;
}
