import type {
  FeedIntegrityAction,
  FeedIntegrityEpisode,
  FeedIntegrityObservation,
} from '@/types/platform/feed-integrity';

export type IntegrityLocale = 'en' | 'ar';
export const translate = (locale: IntegrityLocale, en: string, ar: string) =>
  locale === 'ar' ? ar : en;

const titles: Record<string, [string, string]> = {
  inv_pods_status_contract: [
    'Archived items match feed eligibility',
    'عناصر مؤرشفة تطابق شروط الخلاصة',
  ],
  inv_pods_bounds: [
    'Media duration is outside feed limits',
    'مدة الوسائط خارج حدود الخلاصة',
  ],
  inv_pods_parent_leak: [
    'Long episodes are visible without chapters',
    'حلقات طويلة ظاهرة دون تقسيم',
  ],
  inv_pods_playback_missing: [
    'Playback metadata is missing',
    'بيانات التشغيل مفقودة',
  ],
  inv_pods_thumb_missing: ['Artwork is missing', 'صورة الغلاف مفقودة'],
  inv_pods_bucket_mismatch: [
    'Duration category does not match the item',
    'فئة المدة لا تطابق العنصر',
  ],
  inv_pods_renditions_malformed: [
    'Playback renditions are invalid',
    'نسخ التشغيل غير صالحة',
  ],
  inv_news_related_dangling: [
    'Related stories reference missing records',
    'قصص مرتبطة تشير إلى سجلات مفقودة',
  ],
  inv_news_empty_story: [
    'Stories have no ready articles',
    'قصص دون مقالات جاهزة',
  ],
  inv_news_unlabeled_stale: ['Story labels are overdue', 'تأخر تصنيف القصص'],
  inv_news_cache_rebuild_debt: [
    'News snapshots need rebuilding',
    'لقطات الأخبار تحتاج إلى تحديث',
  ],
  inv_news_generation_membership_drift: [
    'Eligible stories are missing from the serving generation',
    'قصص مؤهلة مفقودة من جيل العرض',
  ],
  edge_pods_http: [
    'Pods response could not be verified',
    'تعذر التحقق من استجابة بودز',
  ],
  edge_news_http: [
    'News response could not be verified',
    'تعذر التحقق من استجابة الأخبار',
  ],
  edge_pods_latency: [
    'Pods responses exceeded the time budget',
    'تجاوزت استجابات بودز الوقت المستهدف',
  ],
  edge_news_latency: [
    'News responses exceeded the time budget',
    'تجاوزت استجابات الأخبار الوقت المستهدف',
  ],
  edge_pods_empty: [
    'Pods response is empty despite available media',
    'استجابة بودز فارغة رغم توفر الوسائط',
  ],
  edge_news_empty: [
    'News response is empty despite available stories',
    'استجابة الأخبار فارغة رغم توفر القصص',
  ],
  edge_pods_required_metadata: [
    'Served items have missing metadata',
    'عناصر معروضة تفتقد بيانات أساسية',
  ],
  edge_pods_bounds_served: [
    'Served items have invalid durations',
    'عناصر معروضة بمدد غير صالحة',
  ],
  edge_pods_playback_fields: [
    'Served playback metadata is invalid',
    'بيانات تشغيل معروضة غير صالحة',
  ],
  edge_pods_status_served: [
    'Archived items are being served',
    'تُعرض عناصر مؤرشفة',
  ],
  edge_pods_dup: ['Pods pages repeat an item', 'تكرر صفحات بودز عنصرًا'],
  edge_pods_family_dup: [
    'Pods repeats media from the same family',
    'تكرر بودز وسائط من المجموعة نفسها',
  ],
  edge_news_dup: ['News pages repeat a story', 'تكرر صفحات الأخبار قصة'],
  edge_news_thin: [
    'Stories have limited related coverage',
    'قصص ذات تغطية مرتبطة محدودة',
  ],
  edge_news_source_monopoly: [
    'One source dominates the News page',
    'مصدر واحد يهيمن على صفحة الأخبار',
  ],
  edge_news_shape: [
    'News slide structure is invalid',
    'بنية شريحة الأخبار غير صالحة',
  ],
  edge_news_cache_stale: [
    'Served News snapshots are too old',
    'لقطات أخبار معروضة تجاوزت حد التقادم',
  ],
  edge_pods_fill: [
    'Pods pages use less than the available supply',
    'صفحات بودز تعرض أقل من المحتوى المتاح',
  ],
  edge_pods_cursor: [
    'Pods pagination does not progress',
    'تصفح صفحات بودز لا يتقدم',
  ],
  edge_news_cursor: [
    'News pagination does not progress',
    'تصفح صفحات الأخبار لا يتقدم',
  ],
  edge_pods_duration_match: [
    'Items miss the requested duration range',
    'عناصر خارج نطاق المدة المطلوبة',
  ],
  probe_url_dead: [
    'Primary playback files are unavailable',
    'ملفات التشغيل الأساسية غير متاحة',
  ],
  probe_fallback: [
    'Fallback playback files are unavailable',
    'ملفات التشغيل البديلة غير متاحة',
  ],
  probe_hls_manifest: [
    'Streaming manifests are invalid',
    'ملفات وصف البث غير صالحة',
  ],
  probe_thumbnail: [
    'Artwork URLs are unavailable',
    'روابط صور الغلاف غير متاحة',
  ],
  probe_content_type: [
    'Media type does not match the response',
    'نوع الوسائط لا يطابق الاستجابة',
  ],
  checker_unhealthy: [
    'Some integrity checks could not finish',
    'تعذر إكمال بعض فحوصات السلامة',
  ],
};

const names: Record<string, [string, string]> = {
  inv_pods_status_contract: [
    'Archived item eligibility',
    'أهلية العناصر المؤرشفة',
  ],
  inv_pods_bounds: ['Media duration limits', 'حدود مدة الوسائط'],
  inv_pods_parent_leak: ['Long episode visibility', 'ظهور الحلقات الطويلة'],
  inv_pods_playback_missing: ['Playback metadata', 'بيانات التشغيل'],
  inv_pods_thumb_missing: ['Artwork metadata', 'بيانات صور الغلاف'],
  inv_pods_bucket_mismatch: ['Duration categories', 'فئات المدة'],
  inv_pods_renditions_malformed: ['Playback renditions', 'نسخ التشغيل'],
  inv_news_related_dangling: [
    'Related story references',
    'مراجع القصص المرتبطة',
  ],
  inv_news_empty_story: [
    'Ready articles in stories',
    'المقالات الجاهزة في القصص',
  ],
  inv_news_unlabeled_stale: ['Story labeling readiness', 'جاهزية تصنيف القصص'],
  inv_news_cache_rebuild_debt: [
    'News snapshot readiness',
    'جاهزية لقطات الأخبار',
  ],
  inv_news_generation_membership_drift: [
    'Serving generation membership',
    'عضوية جيل العرض',
  ],
  edge_pods_http: ['Pods response availability', 'توفر استجابة بودز'],
  edge_news_http: ['News response availability', 'توفر استجابة الأخبار'],
  edge_pods_latency: ['Pods response time', 'وقت استجابة بودز'],
  edge_news_latency: ['News response time', 'وقت استجابة الأخبار'],
  edge_pods_empty: ['Pods response supply', 'محتوى استجابة بودز'],
  edge_news_empty: ['News response supply', 'محتوى استجابة الأخبار'],
  edge_pods_required_metadata: [
    'Served item metadata',
    'بيانات العناصر المعروضة',
  ],
  edge_pods_bounds_served: ['Served media durations', 'مدد الوسائط المعروضة'],
  edge_pods_playback_fields: [
    'Served playback metadata',
    'بيانات التشغيل المعروضة',
  ],
  edge_pods_status_served: [
    'Served item eligibility',
    'أهلية العناصر المعروضة',
  ],
  edge_pods_dup: ['Pods item uniqueness', 'عدم تكرار عناصر بودز'],
  edge_pods_family_dup: [
    'Pods media family uniqueness',
    'عدم تكرار مجموعات وسائط بودز',
  ],
  edge_news_dup: ['News story uniqueness', 'عدم تكرار قصص الأخبار'],
  edge_news_thin: ['Related story coverage', 'تغطية القصص المرتبطة'],
  edge_news_source_monopoly: ['News source variety', 'تنوع مصادر الأخبار'],
  edge_news_shape: ['News slide structure', 'بنية شرائح الأخبار'],
  edge_news_cache_stale: [
    'Served snapshot freshness',
    'حداثة اللقطات المعروضة',
  ],
  edge_pods_fill: ['Pods page fill', 'امتلاء صفحات بودز'],
  edge_pods_cursor: ['Pods pagination', 'تصفح صفحات بودز'],
  edge_news_cursor: ['News pagination', 'تصفح صفحات الأخبار'],
  edge_pods_duration_match: [
    'Requested duration matching',
    'مطابقة المدة المطلوبة',
  ],
  probe_url_dead: [
    'Primary playback URL availability',
    'توفر روابط التشغيل الأساسية',
  ],
  probe_fallback: [
    'Fallback playback URL availability',
    'توفر روابط التشغيل البديلة',
  ],
  probe_hls_manifest: ['Streaming manifests', 'ملفات وصف البث'],
  probe_thumbnail: ['Artwork URL availability', 'توفر روابط صور الغلاف'],
  probe_content_type: ['Media response type', 'نوع استجابة الوسائط'],
  checker_unhealthy: ['Checker coverage', 'تغطية الفاحص'],
  edge_pods_page_success: ['Pods page response', 'استجابة صفحة بودز'],
  edge_news_page_success: ['News page response', 'استجابة صفحة الأخبار'],
  probe_url_success: ['Media URL response', 'استجابة رابط الوسائط'],
};

export function checkName(key: string, locale: IntegrityLocale) {
  return (
    names[key]?.[locale === 'ar' ? 1 : 0] ||
    translate(locale, 'Integrity check', 'فحص السلامة')
  );
}

export function checkTitle(
  key: string,
  locale: IntegrityLocale,
  fallback?: string
) {
  const copy = titles[key];
  return copy
    ? copy[locale === 'ar' ? 1 : 0]
    : fallback || translate(locale, 'Integrity check', 'فحص السلامة');
}
export function feedName(feed: string, locale: IntegrityLocale) {
  return feed === 'pods'
    ? translate(locale, 'Pods', 'بودز')
    : feed === 'news'
      ? translate(locale, 'News', 'الأخبار')
      : translate(locale, 'Checker', 'الفاحص');
}
export function variantLabel(value: string, locale: IntegrityLocale): string {
  if (value.startsWith('feed:')) {
    const [, feed, ...variant] = value.split(':');
    return `${feedName(feed, locale)} · ${variantLabel(variant.join(':'), locale)}`;
  }
  if (value === 'default')
    return translate(locale, 'Default feed', 'الخلاصة الافتراضية');
  if (value.startsWith('duration:'))
    return `${value.slice(9).replace('m', '')} ${translate(locale, 'min', 'دقيقة')}`;
  const v = value.replace('window:', '');
  return (
    (
      {
        today: translate(locale, 'Today', 'اليوم'),
        week: translate(locale, 'This week', 'هذا الأسبوع'),
        month: translate(locale, 'This month', 'هذا الشهر'),
      } as Record<string, string>
    )[v] || value
  );
}
export function stateLabel(value: string, locale: IntegrityLocale) {
  const labels: Record<string, [string, string]> = {
    summary: ['Aggregate result', 'نتيجة مجمعة'],
    open: ['Open', 'مفتوح'],
    recovering: ['Recovering', 'قيد التعافي'],
    pass: ['Passed', 'اجتاز الفحص'],
    ok: ['Passed', 'اجتاز الفحص'],
    violation: ['Problem found', 'مشكلة مرصودة'],
    check_error: ['Could not verify', 'تعذر التحقق'],
    not_ready: ['Not ready', 'غير جاهز'],
    completed: ['Finished', 'مكتمل'],
    partial: ['Incomplete coverage', 'تغطية غير مكتملة'],
    failed: ['Check failed', 'فشل الفحص'],
    running: ['Checking', 'جارٍ الفحص'],
    approval_required: ['Needs approval', 'يتطلب موافقة'],
    skipped: ['Action blocked', 'الإجراء محظور'],
    tool_failed: ['Attempt failed', 'فشلت المحاولة'],
    verified: ['Recovery verified', 'تم التحقق من التعافي'],
    effect_unknown: ['Effect needs review', 'الأثر يحتاج إلى مراجعة'],
    rejected: ['Rejected', 'مرفوض'],
    proposed: ['Recommendation recorded', 'سُجلت التوصية'],
    would_execute: ['Recommendation recorded', 'سُجلت التوصية'],
    ready: ['Ready to attempt', 'جاهز للمحاولة'],
    claimed: ['Attempt starting', 'تبدأ المحاولة'],
    tool_succeeded: ['Awaiting verification', 'بانتظار التحقق'],
    verifying: ['Verifying recovery', 'جارٍ التحقق من التعافي'],
    verification_passed: ['Recovery verified', 'تم التحقق من التعافي'],
    expired: ['Review expired', 'انتهت صلاحية المراجعة'],
    resolved: ['Resolved', 'تم الحل'],
    closed_by_human: ['Closed by operator', 'أغلقها المشغّل'],
    observe: ['Recommendation recorded', 'سُجلت التوصية'],
    executed: ['Awaiting verification', 'بانتظار التحقق'],
    approved: ['Approved', 'معتمد'],
    verification_failed: ['Recovery not verified', 'لم يُثبت التعافي'],
    inconclusive: ['Unknown', 'غير مؤكد'],
    healthy: ['Passed', 'اجتاز الفحص'],
    broken: ['Problems found', 'مشكلات مرصودة'],
    not_checked: ['Not checked', 'لم يُفحص'],
    'skipped:not_applicable': ['Not applicable', 'غير منطبق'],
    'skipped:suppressed': ['Suppressed', 'مكتوم'],
    'skipped:page_unavailable': ['Response unavailable', 'الاستجابة غير متاحة'],
  };
  const copy = labels[value];
  if (copy) return copy[locale === 'ar' ? 1 : 0];
  return value.startsWith('skipped:')
    ? translate(locale, 'Not checked', 'لم يُفحص')
    : translate(locale, 'Recorded state', 'حالة مسجلة');
}
export function tone(value?: string) {
  if (
    [
      'pass',
      'ok',
      'healthy',
      'verified',
      'verification_passed',
      'completed',
    ].includes(value || '')
  )
    return 'success' as const;
  if (
    ['critical', 'broken', 'failed', 'tool_failed', 'effect_unknown'].includes(
      value || ''
    )
  )
    return 'destructive' as const;
  if (
    [
      'major',
      'minor',
      'violation',
      'open',
      'partial',
      'approval_required',
      'not_ready',
    ].includes(value || '')
  )
    return 'warning' as const;
  return 'secondary' as const;
}
export function incomplete(o: FeedIntegrityObservation) {
  return (
    !!o.stale ||
    o.outcome === 'check_error' ||
    (o.outcome.startsWith('skipped:') && o.outcome !== 'skipped:not_applicable')
  );
}
export function problem(o: FeedIntegrityObservation) {
  return (
    !o.stale &&
    (o.affected_count > 0 ||
      o.outcome === 'violation' ||
      o.outcome === 'not_ready')
  );
}
export function observationScope(
  ep: FeedIntegrityEpisode,
  observations: FeedIntegrityObservation[]
) {
  const o = observations.find(
    (o) =>
      !o.stale &&
      o.check_key === ep.check_key &&
      o.feed === ep.feed &&
      o.variant === ep.variant &&
      o.targets?.some((target) => target.scope === ep.scope)
  );
  return o?.targets?.find((target) => target.scope === ep.scope)?.outcome;
}
export function hasVerifiedScope(
  ep: FeedIntegrityEpisode,
  observations: FeedIntegrityObservation[]
) {
  const outcome = observationScope(ep, observations);
  return outcome === 'pass' || outcome === 'violation';
}
export function severityLabel(severity: string, locale: IntegrityLocale) {
  return (
    (
      {
        critical: translate(locale, 'Critical', 'حرج'),
        major: translate(locale, 'High priority', 'أولوية مرتفعة'),
        minor: translate(locale, 'Lower priority', 'أولوية أقل'),
        info: translate(locale, 'Informational', 'للمعلومية'),
      } as Record<string, string>
    )[severity] || translate(locale, 'Review', 'مراجعة')
  );
}
export const severityRank = (severity: string) =>
  ({ critical: 0, major: 1, minor: 2, info: 3 })[severity] ?? 4;
export function groupObservations(observations: FeedIntegrityObservation[]) {
  const groups = new Map<string, FeedIntegrityObservation[]>();
  observations.forEach((o) => {
    const key = `${o.feed}|${o.check_key}`;
    groups.set(key, [...(groups.get(key) || []), o]);
  });
  return [...groups.values()].sort(
    (a, b) =>
      Number(b.some(problem)) - Number(a.some(problem)) ||
      severityRank(a[0].severity) - severityRank(b[0].severity) ||
      a[0].check_key.localeCompare(b[0].check_key)
  );
}
export function safeOwnerLink(link?: string) {
  return link?.startsWith('/platform/') &&
    !link.includes('\\') &&
    !link.includes('..')
    ? link
    : undefined;
}
export function ownerLabel(owner: string | undefined, locale: IntegrityLocale) {
  const names: Record<string, [string, string]> = {
    cms: ['Content Management', 'إدارة المحتوى'],
    storage: ['Storage', 'التخزين'],
    news: ['News management', 'إدارة الأخبار'],
    content: ['Content monitoring', 'مراقبة المحتوى'],
    'media-studio': ['Media Studio', 'استوديو الوسائط'],
    'media-circulation': ['Media Circulation', 'تداول الوسائط'],
    'news-circulation': ['News Circulation', 'تداول الأخبار'],
    enrichment: ['Enrichment', 'الإثراء'],
    'system-health': ['System Health', 'صحة النظام'],
  };
  const value = names[owner?.toLowerCase() || ''];
  return value
    ? value[locale === 'ar' ? 1 : 0]
    : translate(locale, 'responsible system', 'النظام المسؤول');
}
export function evidenceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function reasonLabel(reason: unknown, locale: IntegrityLocale) {
  if (typeof reason !== 'string')
    return translate(locale, 'See recorded evidence', 'راجع الأدلة المسجلة');
  if (/^http_\d{3}$/.test(reason))
    return `HTTP ${reason.slice(5)}${reason === 'http_404' ? translate(locale, ' · File not found', ' · الملف غير موجود') : reason === 'http_410' ? translate(locale, ' · File removed', ' · أُزيل الملف') : ''}`;
  const values: Record<string, [string, string]> = {
    response_timeout: ['Feed response timed out', 'انتهت مهلة استجابة الخلاصة'],
    page_unavailable: [
      'Feed response was unavailable',
      'استجابة الخلاصة غير متاحة',
    ],
    'page unavailable': [
      'Feed response was unavailable',
      'استجابة الخلاصة غير متاحة',
    ],
    autopilot_disabled: [
      'Repair recommendations are disabled',
      'توصيات الإصلاح معطلة',
    ],
    media_content_type: [
      'Response has the wrong media type',
      'نوع الوسائط في الاستجابة غير صحيح',
    ],
    effect_unknown: [
      'The attempt may have taken effect; review is required',
      'قد تكون المحاولة أحدثت أثرًا؛ المراجعة مطلوبة',
    ],
  };
  const value = values[reason];
  return value
    ? value[locale === 'ar' ? 1 : 0]
    : translate(locale, 'See recorded evidence', 'راجع الأدلة المسجلة');
}
export function actionNeedsReview(action: FeedIntegrityAction) {
  return (
    action.action_class === 'news_snapshot.refresh_window' &&
    (action.outcome === 'approval_required' ||
      (action.outcome === 'tool_failed' &&
        action.error_class === 'effect_unknown'))
  );
}
export function actionTitle(
  action: FeedIntegrityAction,
  locale: IntegrityLocale
) {
  return action.action_class === 'news_snapshot.refresh_window'
    ? translate(locale, 'Refresh News snapshot', 'تحديث لقطة الأخبار')
    : `${translate(locale, 'Investigate in', 'التحقق في')} ${ownerLabel(action.owner_system, locale)}`;
}
