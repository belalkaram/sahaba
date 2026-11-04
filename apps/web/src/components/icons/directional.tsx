/**
 * Semantic directional icons (plan §6.2).
 *
 * Icons are authored for RTL — the app's native direction — and mirror automatically inside
 * an LTR region via the `icon-dir` utility (CSS :dir(ltr)). Never flip non-directional icons
 * (search, settings, delete, play, download/upload, check).
 *
 *   IconNext / IconForward : "next", "continue", "view all", drill-in   → points left in RTL
 *   IconBack / IconPrev    : "back", "previous", return to list          → points right in RTL
 *   IconChevronNext/Prev   : pagination, breadcrumbs, steppers, submenus
 *   IconExpand             : open/close menus & accordions (rotate 180° when open; not mirrored)
 *   IconExternal           : external link
 */

import React from 'react';
import { ArrowLeft, ArrowRight, ArrowUpLeft, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { IconProps } from './index';

const STROKE = 1.75;

function directional(Icon: LucideIcon, displayName: string, mirror = true) {
  const C = ({ size = 18, strokeWidth = STROKE, className = '', ...props }: IconProps) => (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={`${mirror ? 'icon-dir' : ''} ${className}`.trim()}
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
    />
  );
  C.displayName = displayName;
  return C;
}

export const IconNext = directional(ArrowLeft, 'IconNext');
export const IconForward = IconNext;
export const IconBack = directional(ArrowRight, 'IconBack');
export const IconPrev = IconBack;
export const IconChevronNext = directional(ChevronLeft, 'IconChevronNext');
export const IconChevronPrev = directional(ChevronRight, 'IconChevronPrev');
export const IconSubmenu = IconChevronNext;
export const IconExternal = directional(ArrowUpLeft, 'IconExternal');
export const IconExpand = directional(ChevronDown, 'IconExpand', false);
