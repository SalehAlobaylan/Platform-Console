import type { MediaJourney } from '@/lib/api/cms/media-journey';
import type { JourneyLocale } from './journey-guide';

export function policyOrigin(origin: string | undefined, locale: JourneyLocale) {
    const labels: Record<string, [string, string]> = { tenant: ['Tenant', 'المستأجر'], tenant_default: ['Tenant default', 'افتراضي المستأجر'], source: ['Source override', 'تجاوز المصدر'], source_override: ['Source override', 'تجاوز المصدر'], episode: ['Episode override', 'تجاوز الحلقة'], code_default: ['Code default', 'افتراضي النظام'] };
    return labels[origin ?? '']?.[locale === 'ar' ? 1 : 0] ?? origin ?? (locale === 'ar' ? 'غير متاح' : 'Unavailable');
}

export function episodePolicyRows(data: MediaJourney, locale: JourneyLocale) {
    const ar = locale === 'ar';
    const text = (en: string, arabic: string) => ar ? arabic : en;
    const unknown = text('Unavailable', 'غير متاح');
    const flag = (value?: boolean) => value == null ? unknown : value ? text('Enabled', 'مفعّل') : text('Disabled', 'معطّل');
    const policy = data.effective_policy;
    // CMS currently supplies an aggregate policy origin, not field-level provenance.
    const resolved = text('Resolved policy', 'السياسة المحسومة');
    return [
        { key: 'download', label: text('Media acquisition', 'تنزيل الوسائط'), value: data.acquisition_mode === 'automatic' ? text('Automatic', 'تلقائي') : data.acquisition_mode === 'manual' ? text('Manual', 'يدوي') : unknown, origin: policyOrigin(data.acquisition_policy_source, locale) },
        { key: 'transcript', label: text('Automatic generated STT', 'التفريغ المولّد التلقائي'), value: flag(data.auto_stt_enabled), origin: text('Effective STT setting', 'إعداد التفريغ الفعلي') },
        { key: 'captions', label: text('Provider captions', 'ترجمة المصدر'), value: text('Imported when available after acquisition', 'تُستورد عند توفرها بعد التنزيل'), origin: text('Pipeline rule', 'قاعدة المعالجة') },
        { key: 'chaptering', label: text('Chaptering', 'تخطيط الفصول'), value: flag(policy?.chaptering_enabled), origin: resolved },
        { key: 'publication', label: text('High-confidence auto-publication', 'النشر التلقائي عند ثقة عالية'), value: flag(policy?.auto_publish_high_confidence), origin: resolved },
        { key: 'video', label: text('Preserve video', 'الحفاظ على الفيديو'), value: flag(policy?.preserve_video), origin: resolved },
        { key: 'sponsor', label: text('Remove sponsor segments', 'إزالة المقاطع الإعلانية'), value: flag(policy?.remove_sponsor_segments), origin: resolved },
        { key: 'confidence', label: text('Confidence threshold', 'حد الثقة'), value: policy?.high_confidence_threshold == null ? unknown : String(policy.high_confidence_threshold), origin: resolved },
        { key: 'chapters', label: text('Maximum chapters', 'الحد الأقصى للفصول'), value: policy?.max_chapters_per_parent == null ? unknown : String(policy.max_chapters_per_parent), origin: resolved },
    ];
}
