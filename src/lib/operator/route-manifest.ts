import type { OperatorIntent, OperatorVisibleContext } from '@/types/platform/operator';
import { OPERATOR_CONTRACT_VERSION } from '@/types/platform/operator';

export interface OperatorRouteDescriptor {
  domain: string;
  view: string;
  pattern: RegExp;
  canonical_path: string;
  available_intents: OperatorIntent[];
}

export interface OperatorContextContribution {
  filters?: OperatorVisibleContext['filters'];
  subjects?: OperatorVisibleContext['subjects'];
  selection?: OperatorVisibleContext['selection'];
  draft?: OperatorVisibleContext['draft'];
}

const readIntents: OperatorIntent[] = ['explain', 'investigate', 'recommend', 'compare'];
const mutableIntents: OperatorIntent[] = [...readIntents, 'resolve'];

// Keep this registry as the Console's only route-to-domain authority. The CMS
// re-resolves the canonical domain and never trusts this value as evidence.
export const operatorRouteManifest: OperatorRouteDescriptor[] = [
  { domain: 'global_ops', view: 'overview', pattern: /^\/$/, canonical_path: '/', available_intents: mutableIntents },
  { domain: 'global_ops', view: 'platform_redirect', pattern: /^\/platform$/, canonical_path: '/platform/operations', available_intents: mutableIntents },
  { domain: 'global_ops', view: 'operations', pattern: /^\/platform\/operations$/, canonical_path: '/platform/operations', available_intents: mutableIntents },
  { domain: 'system_health', view: 'cockpit', pattern: /^\/platform\/system-health$/, canonical_path: '/platform/system-health', available_intents: mutableIntents },
  { domain: 'system_health', view: 'database_migrations', pattern: /^\/platform\/database-migrations$/, canonical_path: '/platform/database-migrations', available_intents: readIntents },
  { domain: 'feed_integrity', view: 'cockpit', pattern: /^\/platform\/feed-integrity$/, canonical_path: '/platform/feed-integrity', available_intents: mutableIntents },
  { domain: 'feed_recovery', view: 'cockpit', pattern: /^\/platform\/recovery$/, canonical_path: '/platform/recovery', available_intents: mutableIntents },
  { domain: 'feed_recovery', view: 'cockpit', pattern: /^\/platform\/feed-recovery$/, canonical_path: '/platform/feed-recovery', available_intents: mutableIntents },
  { domain: 'retention', view: 'cockpit', pattern: /^\/platform\/retention$/, canonical_path: '/platform/retention', available_intents: mutableIntents },
  { domain: 'real_experience', view: 'cockpit', pattern: /^\/platform\/real-experience$/, canonical_path: '/platform/real-experience', available_intents: mutableIntents },
  { domain: 'ai_economics', view: 'cockpit', pattern: /^\/platform\/economics$/, canonical_path: '/platform/economics', available_intents: mutableIntents },
  { domain: 'sources', view: 'new', pattern: /^\/platform\/sources\/new$/, canonical_path: '/platform/sources/new', available_intents: readIntents },
  { domain: 'sources', view: 'detail', pattern: /^\/platform\/sources\/[^/]+$/, canonical_path: '/platform/sources/[id]', available_intents: mutableIntents },
  { domain: 'sources', view: 'list', pattern: /^\/platform\/sources$/, canonical_path: '/platform/sources', available_intents: mutableIntents },
  { domain: 'content', view: 'detail', pattern: /^\/platform\/content\/[^/]+$/, canonical_path: '/platform/content/[id]', available_intents: mutableIntents },
  { domain: 'content', view: 'list', pattern: /^\/platform\/content$/, canonical_path: '/platform/content', available_intents: mutableIntents },
  { domain: 'news', view: 'list', pattern: /^\/platform\/news$/, canonical_path: '/platform/news', available_intents: mutableIntents },
  { domain: 'news_finding', view: 'cockpit', pattern: /^\/platform\/news\/finding$/, canonical_path: '/platform/news/finding', available_intents: mutableIntents },
  { domain: 'news_circulation', view: 'cockpit', pattern: /^\/platform\/news\/circulation$/, canonical_path: '/platform/news/circulation', available_intents: mutableIntents },
  { domain: 'media_sources', view: 'new', pattern: /^\/platform\/media\/sources\/new$/, canonical_path: '/platform/media/sources/new', available_intents: readIntents },
  { domain: 'media_sources', view: 'list', pattern: /^\/platform\/media\/sources$/, canonical_path: '/platform/media/sources', available_intents: mutableIntents },
  { domain: 'media_sources', view: 'finding_alias', pattern: /^\/platform\/media\/finding$/, canonical_path: '/platform/media/sources', available_intents: mutableIntents },
  { domain: 'atomization', view: 'studio_detail', pattern: /^\/platform\/media-studio\/[^/]+$/, canonical_path: '/platform/media/atomization', available_intents: mutableIntents },
  { domain: 'atomization', view: 'studio_alias', pattern: /^\/platform\/media-studio$/, canonical_path: '/platform/media/atomization', available_intents: mutableIntents },
  { domain: 'atomization', view: 'cockpit', pattern: /^\/platform\/media\/atomization$/, canonical_path: '/platform/media/atomization', available_intents: mutableIntents },
  { domain: 'media_circulation', view: 'cockpit', pattern: /^\/platform\/media\/circulation$/, canonical_path: '/platform/media/circulation', available_intents: mutableIntents },
  { domain: 'redundancy', view: 'cockpit', pattern: /^\/platform\/media\/redundancy$/, canonical_path: '/platform/media/redundancy', available_intents: mutableIntents },
  { domain: 'media_library', view: 'detail', pattern: /^\/platform\/media\/[^/]+$/, canonical_path: '/platform/media/[id]', available_intents: mutableIntents },
  { domain: 'media_library', view: 'list', pattern: /^\/platform\/media$/, canonical_path: '/platform/media', available_intents: mutableIntents },
  { domain: 'storage_quality', view: 'storage', pattern: /^\/platform\/storage$/, canonical_path: '/platform/storage', available_intents: mutableIntents },
  { domain: 'storage_quality', view: 'quality_alias', pattern: /^\/platform\/quality$/, canonical_path: '/platform/storage', available_intents: mutableIntents },
  { domain: 'pipeline', view: 'cockpit', pattern: /^\/platform\/pipeline$/, canonical_path: '/platform/pipeline', available_intents: mutableIntents },
  { domain: 'enrichment', view: 'cockpit', pattern: /^\/platform\/enrichment$/, canonical_path: '/platform/enrichment', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'analytics', pattern: /^\/platform\/intelligence\/analytics$/, canonical_path: '/platform/intelligence/analytics', available_intents: mutableIntents },
  { domain: 'embeddings', view: 'cockpit', pattern: /^\/platform\/intelligence\/embeddings$/, canonical_path: '/platform/intelligence/embeddings', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'flags', pattern: /^\/platform\/intelligence\/flags$/, canonical_path: '/platform/intelligence/flags', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'media_value', pattern: /^\/platform\/intelligence\/media-value$/, canonical_path: '/platform/intelligence', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'preview', pattern: /^\/platform\/intelligence\/preview$/, canonical_path: '/platform/intelligence/preview', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'ranking', pattern: /^\/platform\/intelligence\/ranking$/, canonical_path: '/platform/intelligence', available_intents: mutableIntents },
  { domain: 'intelligence', view: 'cockpit', pattern: /^\/platform\/intelligence$/, canonical_path: '/platform/intelligence', available_intents: mutableIntents },
  { domain: 'topics_preferences', view: 'cockpit', pattern: /^\/platform\/topics$/, canonical_path: '/platform/topics', available_intents: mutableIntents },
  { domain: 'moderation', view: 'cockpit', pattern: /^\/platform\/moderation$/, canonical_path: '/platform/moderation', available_intents: mutableIntents },
  { domain: 'auth_center', view: 'redirect', pattern: /^\/admin$/, canonical_path: '/admin/users', available_intents: readIntents },
  { domain: 'auth_center', view: 'users', pattern: /^\/admin\/users$/, canonical_path: '/admin/users', available_intents: readIntents },
  { domain: 'operator', view: 'workspace', pattern: /^\/platform\/operator$/, canonical_path: '/platform/operator', available_intents: mutableIntents },
];

export function resolveOperatorRoute(pathname: string): OperatorRouteDescriptor | undefined {
  return operatorRouteManifest.find((route) => route.pattern.test(pathname));
}

export function createRouteVisibleContext(pathname: string, contribution: OperatorContextContribution = {}): OperatorVisibleContext | undefined {
  const route = resolveOperatorRoute(pathname);
  if (!route) return undefined;
  const pathDerived = operatorPathContextContribution(route, pathname);
  return {
    schema_version: OPERATOR_CONTRACT_VERSION,
    domain: route.domain,
    view: route.view,
    filters: contribution.filters ?? pathDerived.filters ?? {},
    subjects: contribution.subjects ?? pathDerived.subjects ?? [],
    ...(contribution.selection ?? pathDerived.selection ? { selection: contribution.selection ?? pathDerived.selection } : {}),
    ...(contribution.draft ?? pathDerived.draft ? { draft: contribution.draft ?? pathDerived.draft } : {}),
    available_intents: route.available_intents,
  };
}

// The provider derives only a stable ID already present in the route. It never
// reads page rows, labels, filters, or cached data. Pages may add a more
// precise typed contribution for tabs and explicit selections.
function operatorPathContextContribution(route: OperatorRouteDescriptor, pathname: string): OperatorContextContribution {
  if (!route.view.includes('detail')) return {};
  const id = pathname.split('/').filter(Boolean).at(-1)?.trim();
  if (!id) return {};
  return { subjects: [{ type: `${route.domain}_record`, id }] };
}

// Console pages use this helper for navigation only. CMS revalidates the
// resulting context and re-reads authoritative facts; query parameters never
// become evidence, tool arguments, or a bypass around the registered route.
export function createOperatorLaunchHref(context: OperatorVisibleContext, intent: OperatorIntent = 'explain'): string {
  const params = new URLSearchParams({
    domain: context.domain,
    view: context.view,
    intent,
  });
  const firstSubject = context.subjects[0];
  if (firstSubject) {
    params.set('subject_type', firstSubject.type);
    params.set('subject_id', firstSubject.id);
  }
  if (context.selection?.mode === 'explicit' && context.selection.count === 1 && context.selection.ids?.[0]) {
    params.set('selection_id', context.selection.ids[0]);
  }
  return `/platform/operator?${params.toString()}`;
}
