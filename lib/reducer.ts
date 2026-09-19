import type { Block } from './types';

/**
 * Pure reducer: fold one persisted/streamed event into the conversation block
 * list. Shared by the server (snapshot rebuild) and the client (live apply),
 * guaranteeing "refresh recovery" renders identically to "live streaming".
 * No node:* imports here so it is safe to bundle for the browser.
 */
export function applyEventToBlocks(blocks: Block[], type: string, payload: unknown) {
  const p = payload as Record<string, any>;
  switch (type) {
    case 'block.add':
      if (!blocks.some((b) => b.id === p.block.id)) blocks.push({ ...p.block });
      break;
    case 'block.delta': {
      const b = blocks.find((x) => x.id === p.id);
      if (b) b.text = (b.text ?? '') + (p.delta ?? '');
      break;
    }
    case 'block.status': {
      const b = blocks.find((x) => x.id === p.id);
      if (b) b.status = p.status;
      break;
    }
    case 'block.patch': {
      const b = blocks.find((x) => x.id === p.id);
      if (b) Object.assign(b, p.patch);
      break;
    }
    case 'artifact.add':
      if (!blocks.some((b) => b.id === `artifact-${p.artifact.id}`)) {
        blocks.push({
          id: `artifact-${p.artifact.id}`,
          kind: 'artifact',
          name: p.artifact.name,
          meta: { size: p.artifact.size, kind: p.artifact.kind },
        });
      }
      break;
    default:
      break;
  }
}
