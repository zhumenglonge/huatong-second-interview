'use client';

import React from 'react';
import { Blocks, CircleHelp, FolderOpen, User } from 'lucide-react';
import { useLocale } from '@/lib/i18n';

interface IconRailProps {
  activeItem?: string;
  onNewChat?: () => void;
  onProjectClick?: () => void;
  onHubClick?: () => void;
}

export function IconRail({ activeItem = 'project', onNewChat, onProjectClick, onHubClick }: IconRailProps) {
  const { t } = useLocale();
  const NAV_ITEMS = [
    { id: 'project', label: t.project, icon: FolderOpen },
    { id: 'hub', label: t.hub, icon: Blocks },
  ] as const;

  const BOTTOM_ITEMS = [{ id: 'help', label: t.help, icon: CircleHelp }] as const;

  return (
    <div className="icon-rail">
      <button
        className="rail-logo"
        aria-label={t.newChat}
        title={t.newChat}
        type="button"
        onClick={onNewChat}
      >
        B
      </button>

      <nav className="rail-nav" aria-label={t.mainNav}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`rail-item ${activeItem === item.id ? 'active' : ''}`}
            title={item.label}
            type="button"
            onClick={item.id === 'project' ? onProjectClick : item.id === 'hub' ? onHubClick : undefined}
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
        <button className="rail-avatar" title={t.account} type="button">
          <User size={16} />
        </button>
      </div>
    </div>
  );
}
