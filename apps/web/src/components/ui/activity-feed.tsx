'use client';

import React from 'react';
import { Avatar } from './avatar';

export interface ActivityFeedItem {
  id: string;
  actorName: string;
  actorAvatar?: string | null;
  actionText: string;
  targetText?: string;
  timeAgo: string;
  badge?: React.ReactNode;
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[];
  emptyMessage?: string;
  className?: string;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  emptyMessage = 'لا يوجد نشاط مسجل حديثاً',
  className = '',
}) => {
  if (items.length === 0) {
    return <p className="text-xs text-fg-muted text-center py-4">{emptyMessage}</p>;
  }

  return (
    <div className={`divide-y divide-border text-start ${className}`}>
      {items.map((item) => (
        <div key={item.id} className="py-3 flex items-start gap-3">
          <Avatar src={item.actorAvatar} name={item.actorName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-fg leading-relaxed">
              <strong className="font-semibold">{item.actorName}</strong> {item.actionText}{' '}
              {item.targetText && <span className="font-medium text-primary">{item.targetText}</span>}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-fg-subtle">{item.timeAgo}</span>
              {item.badge}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

