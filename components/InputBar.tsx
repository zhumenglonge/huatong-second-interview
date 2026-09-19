'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AtSign, Check, ChevronDown, CircleHelp, Database, FileUp, Paperclip,
  Plus, Send, Sparkles, Square, Wrench, X,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import type { ModelProfile } from '@/lib/types';

const MODELS: Array<{ id: ModelProfile; label: string; description: string }> = [
  { id: 'Auto', label: 'Auto', description: 'Qoder automatically selects the best model' },
  { id: 'Qwen3.8-Max', label: 'Qwen3.8-Max', description: 'Qwen · maximum capability' },
  { id: 'Qwen3.8-Flash', label: 'Qwen3.8-Flash', description: 'Qwen · fast response' },
  { id: 'Qwen3.7-Max', label: 'Qwen3.7-Max', description: 'Qwen · high capability' },
  { id: 'Qwen3.7-Plus', label: 'Qwen3.7-Plus', description: 'Qwen · balanced' },
  { id: 'Qwen3.7-Flash', label: 'Qwen3.7-Flash', description: 'Qwen · low latency' },
  { id: 'DeepSeek-V4-Pro', label: 'DeepSeek-V4-Pro', description: 'DeepSeek · advanced reasoning' },
  { id: 'DeepSeek-Flash', label: 'DeepSeek-Flash', description: 'DeepSeek · fast response' },
  { id: 'GLM-5.3', label: 'GLM-5.3', description: 'GLM · general purpose' },
  { id: 'GLM-5.3-Flash', label: 'GLM-5.3-Flash', description: 'GLM · fast response' },
  { id: 'GLM-5.2', label: 'GLM-5.2', description: 'GLM · stable' },
  { id: 'Kimi-K3', label: 'Kimi-K3', description: 'Kimi · latest generation' },
  { id: 'Kimi-K2.8-Preview', label: 'Kimi-K2.8-Preview', description: 'Kimi · preview model' },
  { id: 'MiniMax-M2.7', label: 'MiniMax-M2.7', description: 'MiniMax · general purpose' },
];

const SKILLS = [
  { id: 'literature', label: 'Literature review', description: 'Search and synthesize biomedical literature', icon: Sparkles },
  { id: 'pubmed', label: 'PubMed', description: 'Find papers and extract cited evidence', icon: Database },
  { id: 'geo', label: 'GEO / SRA', description: 'Discover and analyze public omics datasets', icon: Database },
  { id: 'differential_expression', label: 'Differential expression', description: 'DE analysis, QC, volcano plots and heatmaps', icon: Wrench },
  { id: 'single_cell', label: 'Single-cell RNA-seq', description: 'QC, clustering, annotation and markers', icon: Wrench },
  { id: 'protein_design', label: 'Protein design', description: 'Sequence, structure and rational design workflows', icon: Sparkles },
] as const;

export function InputBar() {
  const [text, setText] = useState('');
  const [model, setModel] = useState<ModelProfile>('Auto');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const composerRef = useRef<HTMLDivElement>(null);

  const status = useTaskStore((state) => state.status);
  const currentId = useTaskStore((state) => state.currentId);
  const sendTask = useTaskStore((state) => state.send);
  const cancel = useTaskStore((state) => state.cancel);
  const retry = useTaskStore((state) => state.retry);
  const running = status === 'running' || status === 'queued';
  const failed = status === 'failed';
  const activeModel = MODELS.find((item) => item.id === model) ?? MODELS[0];
  const filteredSkills = SKILLS.filter((skill) =>
    `${skill.label} ${skill.description}`.toLowerCase().includes(skillQuery.toLowerCase()),
  );

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (!composerRef.current?.contains(event.target as Node)) {
        setModelOpen(false); setAddOpen(false); setSkillOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenus);
    return () => document.removeEventListener('mousedown', closeMenus);
  }, []);

  const submit = async () => {
    const value = text.trim();
    if (!value || running) return;
    setText('');
    await sendTask(value, { model, skills: selectedSkills, auto });
  };

  const toggleSkill = (id: string) => setSelectedSkills((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
  );
  const openSkills = () => { setSkillOpen(true); setAddOpen(false); setModelOpen(false); };

  return (
    <div className="composer-wrap" ref={composerRef}>
      <div className="composer-tip"><Sparkles size={13} /> Type @ in the chat to mention databases, files, tools, or skill</div>
      <div className={`composer ${running ? 'is-running' : ''}`}>
        {selectedSkills.length > 0 && (
          <div className="composer-chips">
            {selectedSkills.map((id) => {
              const skill = SKILLS.find((item) => item.id === id);
              return skill ? (
                <span className="composer-chip" key={id}>
                  <AtSign size={12} />{skill.label}
                  <button type="button" onClick={() => toggleSkill(id)} aria-label={`Remove ${skill.label}`}><X size={12} /></button>
                </span>
              ) : null;
            })}
          </div>
        )}

        <textarea
          value={text}
          placeholder="问我任何问题..."
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            if (/(^|\s)@$/.test(value)) openSkills();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !running) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={2}
        />

        <div className="composer-toolbar">
          <div className="composer-tools">
            <div className="composer-menu-anchor">
              <button type="button" className="composer-icon-btn" aria-label="Add to your message" onClick={() => {
                setAddOpen((value) => !value); setModelOpen(false); setSkillOpen(false);
              }}><Plus size={18} /></button>
              {addOpen && (
                <div className="composer-popover add-popover">
                  <button type="button" onClick={openSkills}><AtSign size={16} /><span><b>Skills and tools</b><small>Mention a specialist capability</small></span></button>
                  <button type="button" disabled><FileUp size={16} /><span><b>Upload files</b><small>Coming with cloud drive support</small></span></button>
                  <button type="button" disabled><Paperclip size={16} /><span><b>Attach folder</b><small>Coming soon</small></span></button>
                </div>
              )}
            </div>
            <label className="auto-control">
              <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
              <span className="auto-switch" /><span>自动</span>
            </label>
            <span className="composer-help" title="自动回答澄清问题并批准计划审核。"><CircleHelp size={14} /></span>
          </div>

          <div className="composer-actions">
            {failed && currentId && <button className="composer-secondary" type="button" onClick={() => void retry()}>重试</button>}
            <div className="composer-menu-anchor model-anchor">
              <button type="button" className="model-selector" aria-haspopup="menu" aria-expanded={modelOpen} onClick={() => {
                setModelOpen((value) => !value); setAddOpen(false); setSkillOpen(false);
              }}>{activeModel.label}<ChevronDown size={14} /></button>
              {modelOpen && (
                <div className="composer-popover model-popover" role="menu">
                  {MODELS.map((option) => (
                    <button type="button" key={option.id} className={option.id === model ? 'selected' : ''} onClick={() => { setModel(option.id); setModelOpen(false); }}>
                      <span className="model-check">{option.id === model && <Check size={15} />}</span>
                      <span><b>{option.label}</b><small>{option.description}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="composer-send" type="button" onClick={() => running ? void cancel() : void submit()} disabled={!running && !text.trim()} aria-label={running ? '停止' : 'Send'}>
              {running ? <Square size={15} fill="currentColor" /> : <Send size={17} />}
            </button>
          </div>
        </div>

        {skillOpen && (
          <div className="composer-popover skill-popover">
            <div className="skill-search"><AtSign size={15} /><input autoFocus value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Search skills and tools" /></div>
            <div className="skill-list">
              {filteredSkills.map((skill) => (
                <button type="button" key={skill.id} className={selectedSkills.includes(skill.id) ? 'selected' : ''} onClick={() => toggleSkill(skill.id)}>
                  <span className="skill-icon"><skill.icon size={16} /></span>
                  <span><b>{skill.label}</b><small>{skill.description}</small></span>
                  {selectedSkills.includes(skill.id) && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
