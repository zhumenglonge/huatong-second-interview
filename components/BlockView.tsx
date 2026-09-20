'use client';

import { useState, type ReactNode } from 'react';
import { Check, CheckCircle2, ChevronRight, Clipboard, Download, ExternalLink, FileText, ListChecks, LoaderCircle, Paperclip, Send, ShieldCheck, TerminalSquare, XCircle } from 'lucide-react';
import type { Block } from '@/lib/types';
import { useTaskStore } from '@/lib/store';

function fmtSize(n: number): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function inlineMarkdown(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    if (match.index > cursor) nodes.push(source.slice(cursor, match.index));
    if (match[2] && match[3]) nodes.push(<a key={match.index} href={match[3]} target="_blank" rel="noreferrer noopener">{match[2]}</a>);
    else if (match[4]) nodes.push(<strong key={match.index}>{match[4]}</strong>);
    else if (match[5]) nodes.push(<code key={match.index}>{match[5]}</code>);
    cursor = token.lastIndex;
  }
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return nodes;
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const content: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      if (i < lines.length) i += 1;
      content.push(<pre className="md-code-block" key={`code-${i}`}>{language ? <span className="md-code-language">{language}</span> : null}<code>{code.join('\n')}</code></pre>);
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const Tag = `h${heading[1].length + 2}` as 'h3' | 'h4' | 'h5';
      content.push(<Tag key={`heading-${i}`}>{inlineMarkdown(heading[2])}</Tag>);
      i += 1;
      continue;
    }
    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s+/.test(lines[i]) : /^[-*+]\s+/.test(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\d+\.\s+/ : /^[-*+]\s+/, ''));
        i += 1;
      }
      const List = ordered ? 'ol' : 'ul';
      content.push(<List key={`list-${i}`}>{items.map((item, index) => <li key={index}>{inlineMarkdown(item)}</li>)}</List>);
      continue;
    }
    if (!line.trim()) { i += 1; continue; }
    const paragraph = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s+|^```|^[-*+]\s+|^\d+\.\s+/.test(lines[i])) paragraph.push(lines[i++]);
    content.push(<p key={`paragraph-${i}`}>{inlineMarkdown(paragraph.join('\n'))}</p>);
  }
  return <div className="markdown-body">{content}</div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <button className="message-copy" type="button" onClick={copy} aria-label="复制回复">{copied ? <Check size={14} /> : <Clipboard size={14} />}{copied ? '已复制' : '复制'}</button>;
}

function ClarificationCard({ block }: { block: Block }) {
  const currentId = useTaskStore((state) => state.currentId);
  const activeProjectId = useTaskStore((state) => state.activeProjectId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const question = String(block.meta?.question ?? block.text ?? '请补充以下信息');
  const options = Array.isArray(block.meta?.options) ? block.meta.options.map(String) : [];
  const answered = block.meta?.answered === true;
  const answer = String(block.meta?.answer ?? '');
  const [selected, setSelected] = useState('');
  const [custom, setCustom] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const answerValue = custom.trim() || selected;

  async function submit() {
    if (!currentId || !answerValue || submitting || answered) return;
    setSubmitting(true);
    setError('');
    try {
      const query = activeProjectId ? `?projectId=${encodeURIComponent(activeProjectId)}` : '';
      const response = await fetch(`/api/tasks/${currentId}/messages${query}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: answerValue }),
      });
      if (!response.ok) throw new Error('提交失败，请重试');
      await selectTask(currentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (answered) {
    return (
      <section className="clarification-card answered">
        <header><span className="clarification-mark answered-mark"><Check size={13} /></span><div><strong>已确认</strong><p>{question}</p></div></header>
        {answer && <div className="clarification-answer"><span>你的回答</span><p>{answer}</p></div>}
      </section>
    );
  }

  return (
    <section className="clarification-card">
      <header><span className="clarification-mark">?</span><div><strong>需要你的确认</strong><p>{question}</p></div></header>
      {options.length > 0 && <div className="clarification-options">{options.map((option) => (
        <button key={option} type="button" className={selected === option && !custom ? 'selected' : ''} onClick={() => { setSelected(option); setCustom(''); }}>
          <span className="clarification-radio" />{option}
        </button>
      ))}</div>}
      <label className="clarification-custom"><span>其他</span><input value={custom} onChange={(event) => { setCustom(event.target.value); if (event.target.value) setSelected(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} placeholder="输入自定义回答…" /></label>
      {error && <p className="clarification-error">{error}</p>}
      <footer><button type="button" className="clarification-submit" disabled={!currentId || !answerValue || submitting} onClick={() => void submit()}>{submitting ? <LoaderCircle className="spin" size={14} /> : <Send size={14} />}{submitting ? '提交中…' : '提交回答'}</button></footer>
    </section>
  );
}

function PlanCard({ block }: { block: Block }) {
  const currentId = useTaskStore((state) => state.currentId);
  const selectTask = useTaskStore((state) => state.selectTask);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const approved = block.meta?.approved === true;
  const items = Array.isArray(block.meta?.items) ? block.meta.items.map(String) : (block.text ?? '').split('\n').filter(Boolean);

  async function approve() {
    if (!currentId || approved || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/tasks/${currentId}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error('批准失败，请重试');
      await selectTask(currentId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '批准失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`plan-card${approved ? ' approved' : ''}`}>
      <header><ListChecks size={17} /><strong>{block.name || '执行计划'}</strong>{approved && <span className="plan-approved"><Check size={13} />已批准</span>}</header>
      {items.length ? <ol>{items.map((item, index) => <li key={index}>{inlineMarkdown(item.replace(/^[-*\d.)\s]+/, ''))}</li>)}</ol> : <p className="muted">计划正在生成…</p>}
      {error && <p className="plan-error">{error}</p>}
      {!approved && items.length > 0 && <footer><span>批准后 Agent 将按此计划开始执行</span><button type="button" disabled={!currentId || submitting} onClick={() => void approve()}>{submitting ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />}{submitting ? '批准中…' : '批准计划'}</button></footer>}
    </section>
  );
}

export function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case 'user':
      return (
        <div className="bubble-user">
          <div>{block.text}</div>
          {Array.isArray(block.meta?.attachments) && block.meta.attachments.length > 0 && (
            <div className="user-attachments">
              {block.meta.attachments.map(String).map((name) => (
                <span key={name}><Paperclip size={12} />{name}</span>
              ))}
            </div>
          )}
        </div>
      );

    case 'agent_text':
      return <div className="agent-message"><div className="agent-text"><MarkdownText text={block.text ?? ''} /></div>{block.text ? <CopyButton text={block.text} /> : null}</div>;

    case 'step':
      return (
        <div className="step-row">
          <span className={`dot ${block.status ?? 'pending'}`} />
          <span>{block.name}</span>
        </div>
      );

    case 'trace': {
      const out = block.meta?.output as string | undefined;
      return (
        <details className="trace">
          <summary><ChevronRight className="trace-chevron" size={14} /><TerminalSquare size={15} /><span>{block.name || 'Tool call'}</span>{out ? block.meta?.failed ? <XCircle className="trace-failed" size={14} /> : <CheckCircle2 className="trace-success" size={14} /> : null}</summary>
          <div className="trace-content">{block.text ? <pre>{block.text}</pre> : null}{out ? <pre>{out}</pre> : null}</div>
        </details>
      );
    }

    case 'plan': {
      return <PlanCard block={block} />;
    }

    case 'clarification':
      return <ClarificationCard block={block} />;

    case 'artifact':
      const artifactId = String(block.meta?.artifactId ?? '');
      const taskId = String(block.meta?.taskId ?? '');
      const artifactUrl = artifactId && taskId ? `/api/tasks/${taskId}/artifacts/${artifactId}` : '';
      return (
        <div className="artifact-row">
          <span className="artifact-icon"><FileText size={16} /></span>
          <span>{block.name}</span>
          <span className="muted">{fmtSize(Number(block.meta?.size ?? 0))}</span>
          {artifactUrl && <a className="artifact-action" href={artifactUrl} target="_blank" rel="noreferrer" title="预览"><ExternalLink size={14} /></a>}
          {artifactUrl && <a className="artifact-action" href={`${artifactUrl}?download=1`} title="下载"><Download size={14} /></a>}
        </div>
      );

    case 'error':
      return <div className="error-box">{block.text}</div>;

    default:
      return null;
  }
}
