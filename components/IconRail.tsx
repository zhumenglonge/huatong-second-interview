'use client';

import React from 'react';
import { Blocks, CircleHelp, FolderOpen, User } from 'lucide-react';

interface IconRailProps {
  activeItem?: string;
  onNewChat?: () => void;
}

const NAV_ITEMS = [
  { id: 'project', label: '项目', icon: FolderOpen },
  { id: 'hub', label: '中心', icon: Blocks },
] as const;

const BOTTOM_ITEMS = [{ id: 'help', label: '帮助', icon: CircleHelp }] as const;

export function IconRail({ activeItem = 'project', onNewChat }: IconRailProps) {
  return (
    <div className="icon-rail">
      <button
        className="rail-logo"
        aria-label="新建空白问答会话"
        title="新建空白问答会话"
        type="button"
        onClick={onNewChat}
      >
        B
      </button>

      <nav className="rail-nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-item ${activeItem === item.id ? 'active' : ''}`}
            title={item.label}
            type="button"
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="rail-bottom">
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-item ${activeItem === item.id ? 'active' : ''}`}
            title={item.label}
            type="button"
          >
            <item.icon />
            <span>{item.label}</span>
          </button>
        ))}
        <button className="rail-avatar" title="账号" type="button">
          <User size={16} />
        </button>
      </div>
    </div>
  );
}
