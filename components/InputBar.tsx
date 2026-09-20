'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AtSign, Check, ChevronDown, CircleHelp, FileUp, LoaderCircle, Paperclip,
  Plus, Send, Sparkles, Square, X,
} from 'lucide-react';
import { useTaskStore } from '@/lib/store';
import { useLocale } from '@/lib/i18n';
import type { ModelProfile, UploadRef } from '@/lib/types';

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

type SkillOption = { id: string; label: string; description: string; icon: typeof Sparkles };

export function InputBar() {
  const [text, setText] = useState('');
  const [model, setModel] = useState<ModelProfile>('Auto');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [skillOpen, setSkillOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [registrySkills, setRegistrySkills] = useState<SkillOption[]>([]);
  const [attachments, setAttachments] = useState<UploadRef[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const status = useTaskStore((state) => state.status);
  const currentId = useTaskStore((state) => state.currentId);
  const sendTask = useTaskStore((state) => state.send);
  const cancel = useTaskStore((state) => state.cancel);
  const retry = useTaskStore((state) => state.retry);
  const { t } = useLocale();
  // Planning is an active agent run too: keep the composer editable for
  // drafting, but prevent a second submit and expose the cancel action.
  const running = status === 'running' || status === 'queued' || status === 'planning';
  const failed = status === 'failed';
  const loadingLabel = status === 'queued'
    ? t.loadingQueued
    : status === 'planning'
      ? t.loadingPlanning
      : t.loadingRunning;
  const activeModel = MODELS.find((item) => item.id === model) ?? MODELS[0];
  useEffect(() => {
    void fetch('/api/skills').then((response) => response.json()).then((body: { skills?: Array<{ id: string; name: string; description: string }> }) => {
      setRegistrySkills((body.skills ?? []).map((skill) => ({ id: skill.id, label: skill.name, description: skill.description, icon: Sparkles })));
    }).catch(() => undefined);
  }, []);

  const filteredSkills = registrySkills.filter((skill) =>
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
    if (!value || running || uploading) return;
    setComposerError(null);
    const sent = await sendTask(value, { model, skills: selectedSkills, auto }, attachments);
    if (sent) {
      setText('');
      setAttachments([]);
    } else {
      setComposerError(t.sendError);
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setComposerError(null);
    const form = new FormData();
    const paths = files.map((file) =>
      String((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name),
    );
    files.forEach((file) => form.append('files', file));
    form.append('paths', JSON.stringify(paths));
    try {
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const body = (await response.json()) as { uploads?: UploadRef[]; error?: string };
      if (!response.ok) throw new Error(body.error || t.uploadError);
      setAttachments((current) => [...current, ...(body.uploads ?? [])]);
    } catch (error) {
      setComposerError((error as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const toggleSkill = (id: string) => setSelectedSkills((current) =>
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
  );
  const openSkills = () => { setSkillOpen(true); setAddOpen(false); setModelOpen(false); };

  return (
    <div className="composer-wrap" ref={composerRef}>
      {running && (
        <div className="composer-status" role="status" aria-live="polite">
          <span className="composer-status-icon" aria-hidden="true"><LoaderCircle size={14} /></span>
          <span>{loadingLabel}</span>
          <span className="composer-status-dots" aria-hidden="true"><i /> <i /> <i /></span>
        </div>
      )}
      <div className="composer-tip"><Sparkles size={13} /> {t.composerTip}</div>
      <div
        className={`composer ${running ? 'is-running' : ''}`}
        onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add('is-dragging'); }}
        onDragLeave={(event) => event.currentTarget.classList.remove('is-dragging')}
        onDrop={(event) => {
          event.preventDefault();
          event.currentTarget.classList.remove('is-dragging');
          void uploadFiles(Array.from(event.dataTransfer.files));
        }}
      >
        {(selectedSkills.length > 0 || attachments.length > 0 || uploading) && (
          <div className="composer-chips">
            {selectedSkills.map((id) => {
              const skill = registrySkills.find((item) => item.id === id);
              return skill ? (
                <span className="composer-chip" key={id}>
                  <AtSign size={12} />{skill.label}
                  <button type="button" onClick={() => toggleSkill(id)} aria-label={`${t.remove} ${skill.label}`}><X size={12} /></button>
                </span>
              ) : null;
            })}
            {attachments.map((attachment) => (
              <span className="composer-chip attachment-chip" key={attachment.token} title={attachment.name}>
                <Paperclip size={12} />
                <span>{attachment.name}</span>
                <small>{attachment.size < 1024 ? `${attachment.size} B` : `${(attachment.size / 1024).toFixed(1)} KB`}</small>
                <button type="button" onClick={() => setAttachments((items) => items.filter((item) => item.token !== attachment.token))} aria-label={`${t.remove} ${attachment.name}`}><X size={12} /></button>
              </span>
            ))}
            {uploading && <span className="composer-chip upload-chip"><span className="upload-spinner" />{t.uploading}</span>}
          </div>
        )}

        <textarea
          value={text}
          placeholder={t.askAnything}
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
              <button type="button" className="composer-icon-btn" aria-label={t.add} onClick={() => {
                setAddOpen((value) => !value); setModelOpen(false); setSkillOpen(false);
              }}><Plus size={18} /></button>
              {addOpen && (
                <div className="composer-popover add-popover">
                  <button type="button" onClick={openSkills}><AtSign size={16} /><span><b>{t.skillsTools}</b><small>{t.mentionCapability}</small></span></button>
                  <button type="button" onClick={() => { setAddOpen(false); fileInputRef.current?.click(); }}><FileUp size={16} /><span><b>{t.uploadFiles}</b><small>{t.attachTask}</small></span></button>
                  <button type="button" onClick={() => { setAddOpen(false); folderInputRef.current?.click(); }}><Paperclip size={16} /><span><b>{t.attachFolder}</b><small>{t.uploadFolder}</small></span></button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} className="composer-file-input" type="file" multiple onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))} />
            <input
              ref={folderInputRef}
              className="composer-file-input"
              type="file"
              multiple
              {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
              onChange={(event) => void uploadFiles(Array.from(event.target.files ?? []))}
            />
            <label className="auto-control">
              <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} />
              <span className="auto-switch" /><span>{t.auto}</span>
            </label>
            <span className="composer-help" title={t.autoHelp}><CircleHelp size={14} /></span>
          </div>

          <div className="composer-actions">
            {failed && currentId && <button className="composer-secondary" type="button" onClick={() => void retry()}>{t.retry}</button>}
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
            <button className="composer-send" type="button" onClick={() => running ? void cancel() : void submit()} disabled={!running && (!text.trim() || uploading)} aria-label={running ? t.stop : t.send}>
              {running ? <Square size={15} fill="currentColor" /> : <Send size={17} />}
            </button>
          </div>
        </div>

        {skillOpen && (
          <div className="composer-popover skill-popover">
            <div className="skill-search"><AtSign size={15} /><input autoFocus value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder={t.searchSkills} /></div>
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
        {composerError && <div className="composer-error">{composerError}</div>}
      </div>
    </div>
  );
}
