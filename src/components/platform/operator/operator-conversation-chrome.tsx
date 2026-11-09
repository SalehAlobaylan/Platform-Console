'use client';

import {
  ChevronRight,
  Languages,
  ListChecks,
  MoreHorizontal,
  PanelLeftClose,
  ArrowLeft,
  PanelLeft,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { operatorWorkspaceScopes } from '@/lib/operator/route-manifest';
import type { OperatorVisibleContext } from '@/types/platform/operator';
import { cn } from '@/lib/utils';
import { operatorDetailsCopy } from './operator-details-copy';
import { WorkspaceHeader } from '@/components/layout/workspace-header';
import {
  operatorCopy,
  operatorDomainLabel,
  type OperatorLocale,
} from './operator-copy';

export type OperatorSidebarSection =
  | 'history'
  | 'context'
  | 'evidence'
  | 'tasks'
  | 'governance'
  | 'actions';

export function OperatorConversationHeader({
  locale,
  title,
  sidebarOpen,
  refreshing,
  busy,
  onSidebar,
  onActivity,
  onStatus,
  onLocale,
  onRefresh,
  onNew,
  tabs,
  onReopen,
  canReopen,
  canNew = true,
}: {
  locale: OperatorLocale;
  title: string;
  sidebarOpen: boolean;
  refreshing: boolean;
  busy: boolean;
  onSidebar: () => void;
  onActivity: () => void;
  onStatus: () => void;
  onLocale: () => void;
  onRefresh: () => void;
  onNew: () => void;
  tabs: (mobileActions: ReactNode) => ReactNode;
  onReopen?: () => void;
  canReopen?: boolean;
  canNew?: boolean;
}) {
  const t = operatorCopy(locale);
  const tools = (
    <>
      <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
        {t.chatMenu}
      </DropdownMenuLabel>
      <DropdownMenuItem onSelect={onActivity}>
        <ListChecks className="me-2 size-4" />
        {t.activity}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onStatus}>
        <Settings2 className="me-2 size-4" />
        {t.workspaceControls}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={onLocale}>
        <Languages className="me-2 size-4" />
        {locale === 'ar' ? 'English' : 'العربية'}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onRefresh} disabled={refreshing || busy}>
        <RefreshCw className="me-2 size-4" />
        {t.refresh}
      </DropdownMenuItem>
      {canReopen ? (
        <DropdownMenuItem onSelect={onReopen}>{t.reopenTab}</DropdownMenuItem>
      ) : null}
    </>
  );
  return (
    <WorkspaceHeader
      workspace="operator"
      locale={locale}
      actions={
        <DropdownMenu dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-10 shrink-0 gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
              aria-label={t.chatMenu}
              title={t.chatMenu}
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
              {t.moreOptions}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            {tools}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <Button
        id="operator-sidebar-trigger"
        variant="ghost"
        size="sm"
        className="hidden h-10 shrink-0 gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground md:inline-flex"
        aria-label={t.openSidebar}
        title={t.openSidebar}
        aria-expanded={sidebarOpen}
        onClick={onSidebar}
      >
        <PanelLeft aria-hidden="true" className="size-4" />
        <span>{t.cases}</span>
      </Button>
      <h1 className="sr-only" dir="auto">
        {title}
      </h1>
      {tabs(
        <>
          <DropdownMenuItem onSelect={onSidebar}>
            <PanelLeft className="me-2 size-4" />
            {t.openSidebar}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {tools}
        </>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
        aria-label={t.newCase}
        disabled={!canNew}
        title={!canNew ? t.tabsLimit : t.newCase}
        onClick={onNew}
      >
        <Plus className="size-4" />
      </Button>
    </WorkspaceHeader>
  );
}

export function OperatorScopeSelect({
  locale,
  context,
  disabled,
  onScope,
}: {
  locale: OperatorLocale;
  context: OperatorVisibleContext;
  disabled?: boolean;
  onScope: (domain: string) => void;
}) {
  const t = operatorCopy(locale);
  return (
    <Select
      value={context.domain}
      onValueChange={onScope}
      disabled={disabled}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
    >
      <SelectTrigger
        className="h-9 min-w-0 max-w-48 gap-1 border-0 bg-transparent px-2 text-xs shadow-none sm:w-auto [&>span]:truncate"
        aria-label={t.scope}
      >
        <SelectValue>{operatorDomainLabel(context.domain, locale)}</SelectValue>
      </SelectTrigger>
      <SelectContent side="top" className="max-h-80">
        {operatorWorkspaceScopes.map((scope) => (
          <SelectItem key={scope.domain} value={scope.domain}>
            {operatorDomainLabel(scope.domain, locale)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OperatorConversationSidebar({
  locale,
  section,
  title,
  detailKey,
  onSection,
  onClose,
  children,
}: {
  locale: OperatorLocale;
  section: OperatorSidebarSection;
  title?: string;
  detailKey?: string;
  onSection: (section: OperatorSidebarSection) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const t = operatorCopy(locale),
    d = operatorDetailsCopy(locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [section, detailKey]);
  const label =
    section === 'history'
      ? d.library
      : section === 'context'
        ? t.context
        : section === 'evidence'
          ? d.sources
          : section === 'tasks'
            ? d.activity
            : section === 'actions'
              ? d.next
              : d.status;
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        {section !== 'history' ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={d.back}
            title={d.back}
            onClick={() => onSection('history')}
          >
            <ArrowLeft className="size-4 rtl:rotate-180" />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{label}</h2>
          {section !== 'history' && title ? (
            <p
              className="mt-0.5 truncate text-[11px] text-muted-foreground"
              dir="auto"
            >
              {title}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          aria-label={t.closeSidebar}
          onClick={onClose}
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain"
        role="region"
        aria-label={
          section === 'history'
            ? t.cases
            : section === 'context'
              ? t.context
              : section === 'evidence'
                ? t.evidence
                : section === 'tasks'
                  ? t.activity
                  : section === 'actions'
                    ? t.allActions
                    : d.status
        }
      >
        {children}
      </div>
    </div>
  );
}
