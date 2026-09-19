import { describe, expect, it } from 'vitest';
import { applyEventToBlocks } from './reducer';
import type { Block } from './types';

/**
 * The reducer is the single source of truth shared by the server (snapshot
 * rebuild) and the client (live apply). These tests lock the guarantees that
 * make "refresh recovery" render identically to "live streaming":
 * idempotent adds, ordered delta accumulation, and artifact de-duplication.
 */
describe('applyEventToBlocks', () => {
  it('block.add appends a new block', () => {
    const blocks: Block[] = [];
    applyEventToBlocks(blocks, 'block.add', {
      block: { id: 'b1', kind: 'agent_text', text: 'hi' },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ id: 'b1', kind: 'agent_text', text: 'hi' });
  });

  it('block.add is idempotent for a repeated id (replay safety)', () => {
    const blocks: Block[] = [];
    const payload = { block: { id: 'b1', kind: 'agent_text', text: 'hi' } };
    applyEventToBlocks(blocks, 'block.add', payload);
    applyEventToBlocks(blocks, 'block.add', payload);
    expect(blocks).toHaveLength(1);
  });

  it('block.add does not mutate the source block object (defensive copy)', () => {
    const blocks: Block[] = [];
    const src: Block = { id: 'b1', kind: 'agent_text', text: 'hi' };
    applyEventToBlocks(blocks, 'block.add', { block: src });
    applyEventToBlocks(blocks, 'block.delta', { id: 'b1', delta: '!' });
    expect(src.text).toBe('hi'); // original untouched
    expect(blocks[0].text).toBe('hi!');
  });

  it('block.delta accumulates text in order', () => {
    const blocks: Block[] = [{ id: 'b1', kind: 'agent_text', text: '' }];
    applyEventToBlocks(blocks, 'block.delta', { id: 'b1', delta: 'a' });
    applyEventToBlocks(blocks, 'block.delta', { id: 'b1', delta: 'b' });
    applyEventToBlocks(blocks, 'block.delta', { id: 'b1', delta: 'c' });
    expect(blocks[0].text).toBe('abc');
  });

  it('block.delta on a missing block is a no-op', () => {
    const blocks: Block[] = [];
    expect(() =>
      applyEventToBlocks(blocks, 'block.delta', { id: 'nope', delta: 'x' }),
    ).not.toThrow();
    expect(blocks).toHaveLength(0);
  });

  it('block.delta seeds text when block had none', () => {
    const blocks: Block[] = [{ id: 'b1', kind: 'agent_text' }];
    applyEventToBlocks(blocks, 'block.delta', { id: 'b1', delta: 'seed' });
    expect(blocks[0].text).toBe('seed');
  });

  it('block.status updates status', () => {
    const blocks: Block[] = [{ id: 's1', kind: 'step', name: 'Bash', status: 'running' }];
    applyEventToBlocks(blocks, 'block.status', { id: 's1', status: 'success' });
    expect(blocks[0].status).toBe('success');
  });

  it('block.patch shallow-merges fields', () => {
    const blocks: Block[] = [{ id: 't1', kind: 'trace', meta: { output: 'old' } }];
    applyEventToBlocks(blocks, 'block.patch', { id: 't1', patch: { meta: { output: 'new' } } });
    expect(blocks[0].meta).toEqual({ output: 'new' });
  });

  it('artifact.add creates a namespaced artifact block and de-dupes', () => {
    const blocks: Block[] = [];
    const artifact = { id: 'a1', name: 'report.md', size: 42, kind: 'file' };
    applyEventToBlocks(blocks, 'artifact.add', { artifact });
    applyEventToBlocks(blocks, 'artifact.add', { artifact });
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: 'artifact-a1',
      kind: 'artifact',
      name: 'report.md',
      meta: { size: 42, kind: 'file' },
    });
  });

  it('unknown event type is ignored', () => {
    const blocks: Block[] = [{ id: 'b1', kind: 'agent_text', text: 'keep' }];
    applyEventToBlocks(blocks, 'task.status', { status: 'running' });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('keep');
  });
});
