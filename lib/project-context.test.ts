import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let dataDir: string;
let db: typeof import('./db');

beforeAll(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'biomni-project-test-'));
  process.env.DATA_DIR = dataDir;
  db = await import('./db');
});

afterAll(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('project context persistence', () => {
  it('seeds the default project and isolates tasks by project', () => {
    const [quick] = db.listProjects();
    expect(quick.isDefault).toBe(true);

    const other = db.createProject('分析项目');
    db.createTask('quick-task', '快速任务', 'q', quick.id);
    db.createTask('other-task', '其他任务', 'o', other.id);

    expect(db.listTasks(quick.id).map((task) => task.id)).toEqual(['quick-task']);
    expect(db.listTasks(other.id).map((task) => task.id)).toEqual(['other-task']);
    expect(db.getTaskForProject('other-task', quick.id)).toBeUndefined();
  });

  it('renames projects and protects default or non-empty deletion', () => {
    const [quick] = db.listProjects();
    const other = db.createProject('待删除');
    expect(db.renameProject(other.id, '已重命名')?.name).toBe('已重命名');
    expect(db.deleteProject(other.id)).toBe('deleted');
    expect(db.deleteProject(quick.id)).toBe('default');

    const nonEmpty = db.createProject('非空项目');
    db.createTask('non-empty-task', '任务', 'input', nonEmpty.id);
    expect(db.deleteProject(nonEmpty.id)).toBe('not_empty');
  });
});
