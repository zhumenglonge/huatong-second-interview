import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Server-side orchestration for the interactive `qoderclicn login` OAuth flow,
 * triggered from the UI's auth-required card (see components/BlockView.tsx).
 *
 * IMPORTANT — this only works when the Next.js server runs on the SAME machine
 * as the user's browser (i.e. local `npm run dev`). The spawned CLI writes the
 * credential to the *server's* ~/.qoder-cn and opens the *server's* browser, so
 * a remote/部署 deployment would authenticate the wrong machine. Deployed
 * installs must use QODERCN_PERSONAL_ACCESS_TOKEN in .env instead.
 *
 * The child process is deliberately NOT awaited: it stays alive in the server
 * process, streams its stdout/stderr (which contains the authorization URL),
 * and exits 0 once the user completes OAuth in the browser. State is stashed on
 * globalThis so Next dev's hot-reload of this module does not lose the running
 * session.
 */

export type LoginStatus = 'idle' | 'pending' | 'success' | 'failed';

export interface LoginState {
  status: LoginStatus;
  /** Authorization URL parsed from CLI output, for the fallback link. */
  url?: string;
  exitCode?: number | null;
  error?: string;
  startedAt?: number;
}

interface LoginSession {
  state: LoginState;
  child?: ChildProcessByStdio<null, Readable, Readable>;
  buffer: string;
  /** Set when the user cancels, so the child's SIGTERM `exit` is not misread as a failure. */
  cancelRequested?: boolean;
}

const globalForAuth = globalThis as unknown as { __qoderLoginSession?: LoginSession };

function session(): LoginSession {
  if (!globalForAuth.__qoderLoginSession) {
    globalForAuth.__qoderLoginSession = { state: { status: 'idle' }, buffer: '' };
  }
  return globalForAuth.__qoderLoginSession;
}

function setState(patch: Partial<LoginState>) {
  const s = session();
  s.state = { ...s.state, ...patch };
}

/** Absolute path to the bundled CN CLI the SDK ships, or null if not installed. */
function bundledCli(): string | null {
  const candidate = path.join(
    process.cwd(),
    'node_modules/@qodercn-ai/qodercn-agent-sdk/dist/_bundled/qoderclicn',
  );
  return fs.existsSync(candidate) ? candidate : null;
}

/** First http(s) URL found in a chunk of CLI output (the OAuth authorization link). */
function extractUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s'"`<>]+/);
  return m ? m[0] : undefined;
}

export function getLoginState(): LoginState {
  return { ...session().state };
}

/**
 * Kick off `qoderclicn login`. Idempotent while a login is already pending.
 * Returns the current snapshot immediately (status is 'pending'; the URL fills
 * in asynchronously as the CLI prints it — the client polls getLoginState()).
 */
export function startLogin(): LoginState {
  const s = session();
  if (s.state.status === 'pending' && s.child) return getLoginState();

  const cli = bundledCli();
  if (!cli) {
    setState({ status: 'failed', error: '未找到内置 qoderclicn,请先执行 npm run setup:cli' });
    return getLoginState();
  }

  // Fresh run: reset buffer/state, keep any previously captured URL cleared.
  s.buffer = '';
  s.cancelRequested = false;
  setState({ status: 'pending', url: undefined, exitCode: undefined, error: undefined, startedAt: Date.now() });

  let child: ChildProcessByStdio<null, Readable, Readable>;
  try {
    // stdio: ignore stdin (non-TTY), pipe stdout+stderr so we can parse the URL.
    child = spawn(cli, ['login'], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    setState({ status: 'failed', error: `启动登录进程失败: ${(e as Error).message}` });
    return getLoginState();
  }
  s.child = child;

  const onData = (chunk: Buffer) => {
    s.buffer += chunk.toString();
    if (!session().state.url) {
      const url = extractUrl(s.buffer);
      if (url) setState({ url }); // surfaced as a clickable link on the auth card
    }
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);

  child.on('error', (err) => {
    if (s.cancelRequested) return;
    setState({ status: 'failed', error: `登录进程错误: ${err.message}` });
    s.child = undefined;
  });

  child.on('exit', (code) => {
    // A user-initiated cancel kills the child (SIGTERM -> code 143): that is not
    // a login failure, so settle back to a clean idle state.
    if (s.cancelRequested) {
      setState({ status: 'idle', url: undefined, exitCode: undefined, error: undefined, startedAt: undefined });
      s.cancelRequested = false;
      s.child = undefined;
      return;
    }
    // Exit 0 => the OAuth callback completed and the credential was written.
    setState({ status: code === 0 ? 'success' : 'failed', exitCode: code, error: code === 0 ? undefined : `登录进程异常退出(退出码 ${code})` });
    s.child = undefined;
  });

  return getLoginState();
}

/** Abort a pending login (e.g. user closes the card). No-op unless pending. */
export function cancelLogin(): LoginState {
  const s = session();
  if (s.child) {
    s.cancelRequested = true;
    try {
      s.child.kill();
    } catch {
      // ignore
    }
    s.child = undefined;
  }
  setState({ status: 'idle', url: undefined, exitCode: undefined, error: undefined, startedAt: undefined });
  return getLoginState();
}
