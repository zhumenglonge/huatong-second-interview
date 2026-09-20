import { describe, expect, it } from 'vitest';
import { formatDateTime, timeAgo, uiMessages } from './i18n';

const zhKeys = Object.keys(uiMessages.zh).sort();
const enKeys = Object.keys(uiMessages.en).sort();

describe('界面文案字典', () => {
  it('中英文键集合完全一致，避免切换后出现缺项混用', () => {
    expect(zhKeys).toEqual(enKeys);
  });

  it('不存在重复键（历史 stop 重复问题已修复）', () => {
    const rawZh = Object.keys(uiMessages.zh);
    expect(new Set(rawZh).size).toBe(rawZh.length);
  });

  it('所有值均为非空字符串', () => {
    for (const locale of ['zh', 'en'] as const) {
      for (const value of Object.values(uiMessages[locale])) {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      }
    }
  });

  it('语言/主题控件具备动作语义文案', () => {
    expect(uiMessages.zh.switchToEn).toBeTruthy();
    expect(uiMessages.zh.switchToZh).toBeTruthy();
    expect(uiMessages.zh.themeLight).toBeTruthy();
    expect(uiMessages.zh.themeDark).toBeTruthy();
  });
});

describe('时间格式化', () => {
  it('相对时间按语言输出', () => {
    const now = Date.now();
    expect(timeAgo(now, 'zh', uiMessages.zh)).toBe('刚刚');
    expect(timeAgo(now, 'en', uiMessages.en)).toBe('just now');
    const fiveMinAgo = now - 5 * 60_000;
    expect(timeAgo(fiveMinAgo, 'zh', uiMessages.zh)).toBe('5 分钟前');
    expect(timeAgo(fiveMinAgo, 'en', uiMessages.en)).toBe('5m ago');
  });

  it('绝对时间使用对应区域', () => {
    const ts = new Date('2026-09-20T10:30:00').getTime();
    expect(formatDateTime(ts, 'zh')).not.toBe(formatDateTime(ts, 'en'));
  });
});
