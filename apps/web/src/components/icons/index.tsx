/**
 * Icon system (R7-0b). Every icon is a Lucide SVG — no emoji, no Unicode symbols.
 *
 * The legacy `*Icon` names below are kept so existing imports keep working; they are thin
 * wrappers over Lucide with the platform defaults (size 20, stroke 1.75, aria-hidden).
 * New code may import from 'lucide-react' directly, but must use <Icon>-compatible sizes
 * (16 / 18 / 20 / 24) and the directional components in ./directional for arrows.
 */

import React from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  AlertCircle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  Flame,
  GraduationCap,
  ListChecks,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Pin,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  Video,
  Wallet,
  XCircle,
} from 'lucide-react';

export interface IconProps extends Omit<LucideProps, 'ref'> {
  size?: number;
}

export const ICON_STROKE = 1.75;

/** Wrap a Lucide icon with platform defaults. */
export function withDefaults(Icon: LucideIcon, displayName: string) {
  const Wrapped = ({ size = 20, strokeWidth = ICON_STROKE, ...props }: IconProps) => (
    <Icon size={size} strokeWidth={strokeWidth} aria-hidden={props['aria-label'] ? undefined : true} {...props} />
  );
  Wrapped.displayName = displayName;
  return Wrapped;
}

export const BookOpenIcon = withDefaults(BookOpen, 'BookOpenIcon');
export const GraduationCapIcon = withDefaults(GraduationCap, 'GraduationCapIcon');
export const VideoIcon = withDefaults(Video, 'VideoIcon');
export const CalendarIcon = withDefaults(Calendar, 'CalendarIcon');
export const CheckCircleIcon = withDefaults(CheckCircle2, 'CheckCircleIcon');
export const ClockIcon = withDefaults(Clock, 'ClockIcon');
export const AwardIcon = withDefaults(Award, 'AwardIcon');
export const ShieldIcon = withDefaults(Shield, 'ShieldIcon');
export const UserIcon = withDefaults(User, 'UserIcon');
export const UsersIcon = withDefaults(Users, 'UsersIcon');
export const BarChartIcon = withDefaults(BarChart3, 'BarChartIcon');
export const FileTextIcon = withDefaults(FileText, 'FileTextIcon');
export const QrCodeIcon = withDefaults(QrCode, 'QrCodeIcon');
export const SparklesIcon = withDefaults(Sparkles, 'SparklesIcon');
export const BellIcon = withDefaults(Bell, 'BellIcon');
export const LogOutIcon = withDefaults(LogOut, 'LogOutIcon');
export const DownloadIcon = withDefaults(Download, 'DownloadIcon');
export const RefreshCwIcon = withDefaults(RefreshCw, 'RefreshCwIcon');
export const PlayIcon = withDefaults(Play, 'PlayIcon');
export const AlertCircleIcon = withDefaults(AlertCircle, 'AlertCircleIcon');
export const SearchIcon = withDefaults(Search, 'SearchIcon');
export const XCircleIcon = withDefaults(XCircle, 'XCircleIcon');
export const SmartphoneIcon = withDefaults(Smartphone, 'SmartphoneIcon');
export const FireIcon = withDefaults(Flame, 'FireIcon');
export const StarIcon = withDefaults(Star, 'StarIcon');
export const CheckIcon = withDefaults(Check, 'CheckIcon');
export const BuildingIcon = withDefaults(Building2, 'BuildingIcon');
export const WalletIcon = withDefaults(Wallet, 'WalletIcon');
export const TaskIcon = withDefaults(ListChecks, 'TaskIcon');
export const MessageIcon = withDefaults(MessageSquare, 'MessageIcon');
export const SettingsIcon = withDefaults(Settings, 'SettingsIcon');
export const EditIcon = withDefaults(Pencil, 'EditIcon');
export const TrashIcon = withDefaults(Trash2, 'TrashIcon');
export const PinIcon = withDefaults(Pin, 'PinIcon');
export const LockIcon = withDefaults(Lock, 'LockIcon');
export const PlusIcon = withDefaults(Plus, 'PlusIcon');
export const CreditCardIcon = withDefaults(CreditCard, 'CreditCardIcon');
export const UploadIcon = withDefaults(Upload, 'UploadIcon');
export const SunIcon = withDefaults(Sun, 'SunIcon');
export const MoonIcon = withDefaults(Moon, 'MoonIcon');
export const MonitorIcon = withDefaults(Monitor, 'MonitorIcon');
export const MenuIcon = withDefaults(Menu, 'MenuIcon');
export const MoreHorizontalIcon = withDefaults(MoreHorizontal, 'MoreHorizontalIcon');

/**
 * @deprecated Physical arrow — ambiguous in RTL. Use IconNext / IconBack from './directional'.
 * Kept only for existing imports; renders the RTL "back" arrow (points right).
 */
export { IconBack as ArrowRightIcon } from './directional';

export * from './directional';
