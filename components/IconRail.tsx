'use client';

import { Blocks, CircleHelp, FolderOpen, User } from 'lucide-react';

interface IconRailProps {
  activeItem?: string;
}

const NAV_ITEMS = [
  { id: 'project', label: '项目', icon: FolderOpen },
  { id: 'hub', label: '中心', icon: Blocks },
] as const;

const BOTTOM_ITEMS = [{ id: 'help', label: '帮助', icon: CircleHelp }] as const;

export function IconRail({ activeItem = 'project' }: IconRailProps) {
  return (
    <div className="icon-rail">
      <div className="rail-logo" aria-label="Biomni Lab">
        B
      </div>

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
