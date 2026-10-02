import {
  LayoutDashboard,
  Rss,
  FileText,
  Newspaper,
  Radar,
  Video,
  Radio,
  Clapperboard,
  Activity,
  Brain,
  Tags,
  Sparkles,
  Shield,
  HardDrive,
  HeartPulse,
  ScanSearch,
  Recycle,
  Gauge,
  Boxes,
  CircleDollarSign,
  ShieldAlert,
  Flag,
  ArchiveRestore,
  Database,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

export const navigation: NavigationSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Overview', href: '/', icon: LayoutDashboard },
      { name: 'Operations', href: '/platform/operations', icon: ShieldAlert },
      {
        name: 'System Health',
        href: '/platform/system-health',
        icon: HeartPulse,
      },
      {
        name: 'Database Migrations',
        href: '/platform/database-migrations',
        icon: Database,
      },
      {
        name: 'Feed Integrity',
        href: '/platform/feed-integrity',
        icon: ScanSearch,
      },
      {
        name: 'Retention',
        href: '/platform/retention',
        icon: ArchiveRestore,
      },
      {
        name: 'Recovery',
        href: '/platform/recovery',
        icon: Recycle,
      },
      {
        name: 'Real Experience',
        href: '/platform/real-experience',
        icon: Gauge,
      },
      {
        name: 'AI Economics',
        href: '/platform/economics',
        icon: CircleDollarSign,
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      { name: 'Sources', href: '/platform/sources', icon: Rss },
      { name: 'Content', href: '/platform/content', icon: FileText },
      { name: 'News', href: '/platform/news', icon: Newspaper },
      { name: 'Feeds Finding', href: '/platform/news/finding', icon: Radar },
      { name: 'Media Library', href: '/platform/media', icon: Video },
      { name: 'Media Sources', href: '/platform/media/sources', icon: Radio },
      {
        name: 'Media Studio',
        href: '/platform/media/atomization',
        icon: Clapperboard,
      },
      {
        name: 'Media Circulation',
        href: '/platform/media/circulation',
        icon: Recycle,
      },
      { name: 'Storage', href: '/platform/storage', icon: HardDrive },
      { name: 'Pipeline', href: '/platform/pipeline', icon: Activity },
      { name: 'Intelligence', href: '/platform/intelligence', icon: Brain },
      {
        name: 'Embeddings',
        href: '/platform/intelligence/embeddings',
        icon: Boxes,
      },
      { name: 'Topics', href: '/platform/topics', icon: Tags },
      { name: 'Enrichment', href: '/platform/enrichment', icon: Sparkles },
      { name: 'Moderation', href: '/platform/moderation', icon: Flag },
    ],
  },
  {
    title: 'Admin',
    items: [{ name: 'Auth Center', href: '/admin/users', icon: Shield }],
  },
];

// Route constants for type-safe navigation
export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/',
  PLATFORM: {
    SOURCES: '/platform/sources',
    CONTENT: '/platform/content',
    NEWS: '/platform/news',
    NEWS_FINDING: '/platform/news/finding',
    MEDIA: '/platform/media',
    MEDIA_SOURCES: '/platform/media/sources',
    MEDIA_FINDING: '/platform/media/sources?tab=finding',
    MEDIA_ATOMIZATION: '/platform/media/atomization',
    MEDIA_STUDIO: '/platform/media/atomization',
    MEDIA_CIRCULATION: '/platform/media/circulation',
    STORAGE: '/platform/storage',
    PIPELINE: '/platform/pipeline',
    INTELLIGENCE: '/platform/intelligence',
    TOPICS: '/platform/topics',
    ENRICHMENT: '/platform/enrichment',
    MODERATION: '/platform/moderation',
    SYSTEM_HEALTH: '/platform/system-health',
    OPERATIONS: '/platform/operations',
    FEED_INTEGRITY: '/platform/feed-integrity',
    RETENTION: '/platform/retention',
    FEED_RECOVERY: '/platform/feed-recovery',
    RECOVERY: '/platform/recovery',
    REAL_EXPERIENCE: '/platform/real-experience',
    ECONOMICS: '/platform/economics',
    DATABASE_MIGRATIONS: '/platform/database-migrations',
  },
  ADMIN: {
    USERS: '/admin/users',
  },
} as const;
