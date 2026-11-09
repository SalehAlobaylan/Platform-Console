'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from '@/lib/navigation';
import {
  OPERATOR_PATH,
  rememberConsoleLocation,
  useWorkspaceSession,
} from '@/lib/stores/workspace-session';

export function WorkspaceNavigation() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const operator = pathname === OPERATOR_PATH;
  const previousRoute = useRef<
    { pathname: string; search: string } | undefined
  >(undefined);
  useEffect(() => {
    const sameConsolePage =
      previousRoute.current?.pathname === pathname &&
      previousRoute.current.search !== search &&
      !operator;
    previousRoute.current = { pathname, search };
    const owner = useWorkspaceSession.getState().owner;
    const href = pathname + (search ? `?${search}` : '') + window.location.hash;
    useWorkspaceSession.getState().visit(href);
    if (operator) return;
    const el = document.getElementById('console-scroll-region');
    if (!el) return;
    const saved = useWorkspaceSession.getState().consoleScroll[href] ?? 0;
    // Native pages own scrolling when their filters or section URL changes.
    // Restore our snapshot when entering the page or returning from Operator.
    let position = sameConsolePage ? el.scrollTop : saved,
      restoring = !sameConsolePage;
    const restore = () => {
      if (!restoring) return;
      el.scrollTop = saved;
      if (el.scrollTop >= saved - 1) restoring = false;
    };
    const read = () => {
      if (!restoring) position = el.scrollTop;
    };
    const interact = () => {
      restoring = false;
      position = el.scrollTop;
    };
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(restore);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    const frame = requestAnimationFrame(restore);
    el.addEventListener('scroll', read);
    el.addEventListener('wheel', interact, { passive: true });
    el.addEventListener('pointerdown', interact);
    el.addEventListener('keydown', interact);
    const save = () => {
      if (useWorkspaceSession.getState().owner === owner)
        useWorkspaceSession.getState().saveConsoleScroll(href, position);
    };
    window.addEventListener('pagehide', save);
    return () => {
      save();
      cancelAnimationFrame(frame);
      observer?.disconnect();
      el.removeEventListener('scroll', read);
      el.removeEventListener('wheel', interact);
      el.removeEventListener('pointerdown', interact);
      el.removeEventListener('keydown', interact);
      window.removeEventListener('pagehide', save);
    };
  }, [pathname, search, operator]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== 'j' ||
        event.altKey ||
        event.shiftKey
      )
        return;
      event.preventDefault();
      if (!operator) rememberConsoleLocation();
      const state = useWorkspaceSession.getState();
      useWorkspaceSession.setState({
        focusAfterSwitch: operator ? 'console' : 'operator',
      });
      router.push(operator ? state.consoleHref : state.operatorHref, {
        scroll: false,
      });
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [operator, router]);
  return null;
}
