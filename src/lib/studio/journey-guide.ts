export type JourneyLocale = 'en' | 'ar';
export const journeyStepSummary: Record<string, [string, string]> = {
    discovery: ['Save episode metadata', 'حفظ معلومات الحلقة'],
    download: ['Acquire the source media', 'تنزيل وسائط المصدر'],
    preparation: ['Prepare and verify playback media', 'تجهيز وسائط التشغيل والتحقق منها'],
    transcript: ['Import captions or generate a transcript', 'استيراد ترجمة المصدر أو توليد النص'],
    planning: ['Choose meaningful chapter boundaries', 'اختيار حدود فصول ذات معنى'],
    cutting: ['Create and verify chapter media', 'إنشاء وسائط الفصول والتحقق منها'],
    review: ['Editorial review and approvals', 'المراجعة والاعتماد التحريري'],
    readiness: ['Check all publication requirements', 'فحص جميع متطلبات النشر'],
    published: ['CMS-approved Pods publication', 'النشر في بودز بعد اعتماد CMS'],
};
export const journeyLane = (key: string, fallback: string, locale: JourneyLocale) => locale === 'en' ? fallback : ({
    ready: 'جاهز', awaiting_download: 'بانتظار التنزيل', media: 'تجهيز الوسائط', transcript: 'بانتظار النص', planning: 'التخطيط والتقطيع', embedding: 'التضمينات والجاهزية', review: 'المراجعة', published: 'منشور', disabled: 'معطل', failed: 'فشل أو تسوية',
} as Record<string, string>)[key] ?? fallback;
type Help = { title: string; happens: string; waits: string; action: string; next: string };
export const journeyGuide: Record<string, Record<JourneyLocale, Help>> = {
    discovery: {
        en: { title: 'Discovery', happens: 'Source runs save metadata previews, not media files.', waits: 'A source may be disabled or waiting for its next run.', action: 'Inspect the source or choose an episode to download.', next: 'Automatic acquisition admits the episode; manual acquisition waits for Download & process.' },
        ar: { title: 'الاكتشاف', happens: 'يحفظ تشغيل المصدر معلومات المعاينة وليس ملفات الوسائط.', waits: 'قد يكون المصدر معطلاً أو ينتظر تشغيله التالي.', action: 'افحص المصدر أو اختر حلقة لتنزيلها.', next: 'يبدأ التنزيل تلقائياً أو ينتظر إجراء تنزيل ومعالجة حسب الإعداد.' },
    },
    download: {
        en: { title: 'Download', happens: 'An admitted episode downloads its source media.', waits: 'Manual admission, shared capacity, a provider delay, or an operational pause can hold it.', action: 'Use Download & process only when offered. The confirmation does not authorize generated STT.', next: 'The downloaded media is prepared and verified.' },
        ar: { title: 'التنزيل', happens: 'تُنزل ملفات الحلقة بعد السماح بمعالجتها.', waits: 'قد تنتظر الموافقة أو سعة المعالجة أو المصدر أو إيقافاً تشغيلياً.', action: 'استخدم تنزيل ومعالجة عند إتاحته؛ لا يعني ذلك السماح بتفريغ صوتي مولّد.', next: 'يُجهز الملف ويُتحقق منه.' },
    },
    preparation: {
        en: { title: 'Media preparation', happens: 'Probe, storage upload, playback/analysis renditions, thumbnails, and CMS verification prepare the source.', waits: 'Long operations can take time. A heartbeat proves contact, not measurable progress.', action: 'Check the last confirmed checkpoint. Do not retry unresolved uploads.', next: 'Available provider captions are imported; otherwise transcript policy applies.' },
        ar: { title: 'تجهيز الوسائط', happens: 'فحص الملف ورفعه وإعداد نسخ التشغيل والتحليل والصور ثم التحقق.', waits: 'قد تستغرق العمليات وقتاً؛ اتصال العامل لا يثبت تقدم المعالجة.', action: 'راجع آخر تقدم مؤكد ولا تكرر الرفع قبل تسوية نتيجته.', next: 'تُستورد ترجمة المصدر المتاحة أو تُطبق سياسة التفريغ.' },
    },
    transcript: {
        en: { title: 'Transcript', happens: 'Usable provider captions are imported automatically. Generated STT is a separate potentially paid operation.', waits: 'Waiting for media is not an approval request. Caption retrieval failure is not proof captions are unavailable.', action: 'Generate transcript permits STT; Approve transcript for use reviews existing text. Neither bypasses media admission.', next: 'Long episodes can be planned. Eligible short media may publish without a transcript.' },
        ar: { title: 'النص', happens: 'تُستورد ترجمة المصدر الصالحة تلقائياً. التفريغ المولّد عملية مستقلة قد تكون مدفوعة.', waits: 'انتظار الوسائط ليس طلب موافقة. فشل جلب الترجمة لا يعني عدم وجودها.', action: 'إنشاء النص يسمح بالتفريغ؛ اعتماد النص للاستخدام يراجع نصاً موجوداً. لا يتجاوز أيهما موافقة التنزيل.', next: 'تُخطط فصول الحلقات الطويلة؛ قد تُنشر الحلقة القصيرة المؤهلة دون نص.' },
    },
    planning: {
        en: { title: 'Chapter planning', happens: 'Provider chapters are preferred when usable; contextual transcript planning is the fallback. Automatic runs do not wait for plan approval.', waits: 'The transcript or a valid plan may be missing.', action: 'Save draft changes no running work. Apply plan and process explicitly binds a validated revision to a future run; active effects must settle first.', next: 'The worker cuts the exact frozen plan. Editing a draft does not change existing media.' },
        ar: { title: 'تخطيط الفصول', happens: 'تُفضل فصول المصدر الصالحة ثم التخطيط السياقي للنص. لا ينتظر التشغيل التلقائي اعتماد الخطة.', waits: 'قد ينقص النص أو مخطط صالح.', action: 'حفظ المسودة لا يغيّر العمل الجاري. تطبيق الخطة ومعالجتها يربط إصداراً معتمداً بتشغيل لاحق بعد انتهاء العمل النشط.', next: 'يُقص المخطط المثبت بالضبط؛ تعديل المسودة لا يغيّر الملفات الموجودة.' },
    },
    cutting: {
        en: { title: 'Cutting and verification', happens: 'Chapter media is cut, uploaded, and verified under the frozen generation.', waits: 'A chapter can be queued, executing, or reconciling an uncertain effect.', action: 'Inspect chapter progress. A safe retry preserves verified work; a changed plan may require new processing.', next: 'Chapters enter editorial review and publication-readiness checks.' },
        ar: { title: 'القص والتحقق', happens: 'تُقص ملفات الفصول وتُرفع ويُتحقق منها ضمن الإصدار المثبت.', waits: 'قد ينتظر الفصل التنفيذ أو تسوية نتيجة غير مؤكدة.', action: 'افحص تقدم الفصول. يحافظ التكرار الآمن على العمل المتحقق؛ قد تتطلب الخطة المعدلة معالجة جديدة.', next: 'تبدأ المراجعة وفحوص الجاهزية للنشر.' },
    },
    review: {
        en: { title: 'Editorial review', happens: 'Review checks the chapter content and legal playback duration (4:30–40:00).', waits: 'One or more chapters may require an editorial decision.', action: 'Preview the chapter, then approve or reject it. Approval does not claim that publication has completed.', next: 'All required chapter and family checks must pass.' },
        ar: { title: 'المراجعة التحريرية', happens: 'تُراجع جودة الفصل ومدة التشغيل المسموحة من ٤:٣٠ إلى ٤٠:٠٠.', waits: 'قد تحتاج بعض الفصول إلى قرار تحريري.', action: 'عاين الفصل ثم اعتمده أو ارفضه؛ الاعتماد لا يعني اكتمال النشر.', next: 'يجب اكتمال فحوص الفصل والحلقة.' },
    },
    readiness: {
        en: { title: 'Publication readiness', happens: 'CMS checks required embeddings, verified artifacts, editorial decisions, and complete-generation readiness.', waits: 'A ready chapter may be waiting for sibling requirements; this is not necessarily a failure.', action: 'Inspect the remaining chapter requirements. Do not bypass publication guards.', next: 'CMS activates the complete generation. Existing published media stays available while its replacement is prepared.' },
        ar: { title: 'جاهزية النشر', happens: 'يفحص CMS التضمينات المطلوبة والملفات المتحققة وقرارات المراجعة وجاهزية الإصدار كاملاً.', waits: 'قد ينتظر فصل جاهز بقية فصول الحلقة؛ ليس هذا بالضرورة فشلاً.', action: 'راجع المتطلبات المتبقية دون تجاوز ضوابط النشر.', next: 'يُفعّل الإصدار المكتمل وتبقى الملفات المنشورة متاحة أثناء إعداد البديل.' },
    },
    published: {
        en: { title: 'Published', happens: 'CMS-approved feed units are available for Pods playback. Episode and chapter counts are different units.', waits: 'A replacement can still be in progress while the previous generation remains published.', action: 'Preview published playback. Start replacement only deliberately; it may incur processing costs.', next: 'Publication remains subject to existing circulation and storage policies.' },
        ar: { title: 'منشور', happens: 'وحدات التشغيل المعتمدة متاحة في بودز. عدد الحلقات يختلف عن عدد الفصول.', waits: 'قد يجري إعداد بديل بينما يبقى الإصدار السابق منشوراً.', action: 'عاين التشغيل المنشور ولا تطلب استبداله إلا عن قصد؛ قد تترتب تكاليف معالجة.', next: 'تستمر سياسات التداول والتخزين الحالية.' },
    },
};

export const journeyReasons: Record<string, [string, string]> = {
    frozen_plan_must_settle: ['The current request owns a frozen plan. Resume or settle it before explicitly applying a replacement.', 'يمتلك الطلب الحالي خطة مثبتة. استأنفه أو أكمل تسويته قبل تطبيق بديل صريح.'],
    generation_completion_failed: ['The cuts are verified, but generation completion failed. Inspect recovery; do not recut verified media blindly.', 'المقاطع متحققة لكن إنهاء الإصدار فشل. افحص الاسترداد ولا تعِد قص الوسائط المتحققة دون تشخيص.'],
    effects_active: ['Existing effects are active. Drafts can be saved, but application must wait for them to finish.', 'العمل الحالي نشط. يمكنك حفظ مسودة، لكن تطبيقها ينتظر انتهاء العمل.'],
    policy_disabled: ['Chaptering is disabled by the effective episode policy.', 'تقطيع الفصول معطل حسب سياسة الحلقة الفعلية.'],
    draft_inputs_unavailable: ['A long episode with an available timestamped transcript is required. Refresh when the input is ready.', 'يلزم وجود حلقة طويلة ونص بتوقيتات متاح. حدّث الصفحة عند جاهزية المدخلات.'],
    draft_worker_required: ['A worker that supports applied chapter plans must be online.', 'يلزم اتصال عامل يدعم تطبيق خطط الفصول.'],
    draft_already_applied: ['This revision has already been applied. Follow its existing request.', 'طُبق هذا الإصدار بالفعل. تابع طلبه الحالي.'],
    draft_inputs_changed: ['The episode, transcript, or policy changed. Review and save a new draft to revalidate it.', 'تغيرت الحلقة أو النص أو السياسة. راجع المسودة واحفظ إصداراً جديداً للتحقق منها.'],
    draft_invalid: ['Correct the draft validation errors before applying it.', 'صحح أخطاء التحقق من المسودة قبل تطبيقها.'],
    awaiting_execution: ['Admitted and waiting to execute; no queue position is available.', 'تم قبول الطلب وهو بانتظار التنفيذ؛ ترتيب الانتظار غير متاح.'],
    permission_required: ['Your account does not have permission for this action.', 'لا يملك حسابك صلاحية هذا الإجراء.'],
    prerequisites_required: ['The current prerequisites do not allow this action.', 'لا تسمح المتطلبات الحالية بهذا الإجراء.'],
    evidence_unavailable: ['Detailed evidence is not available yet.', 'تفاصيل الحالة غير متاحة بعد.'],
    predecessor_required: ['Waiting for the preceding requirement, not an approval.', 'بانتظار المتطلب السابق وليس الموافقة.'],
    download_approval: ['Download permission is required.', 'يلزم السماح بالتنزيل.'],
    preparation_approval: ['Media preparation waits for download permission.', 'ينتظر تجهيز الوسائط السماح بالتنزيل.'],
    transcript_approval: ['Generated transcription requires permission.', 'يلزم السماح بالتفريغ المولّد.'],
    shared_capacity: ['Waiting for shared processing capacity.', 'بانتظار سعة المعالجة المشتركة.'],
    operational_pause: ['Execution is paused by the operator.', 'أوقف المشغّل التنفيذ مؤقتاً.'],
    scheduled_retry: ['Waiting for the scheduled retry.', 'بانتظار موعد إعادة المحاولة.'],
    effects_unresolved: ['Checking an uncertain effect before further work.', 'تجري تسوية نتيجة غير مؤكدة قبل المتابعة.'],
    editorial_review_required: ['An editorial decision is required.', 'يلزم قرار المراجعة التحريرية.'],
    embedding_or_family_required: ['Waiting for required embeddings or sibling readiness.', 'بانتظار التضمينات المطلوبة أو جاهزية بقية الفصول.'],
    direct_media: ['This step is not required for direct short media.', 'لا تلزم هذه الخطوة للوسائط القصيرة المباشرة.'],
};
export const journeyReason = (code: string, locale: JourneyLocale) => journeyReasons[code]?.[locale === 'ar' ? 1 : 0] ?? `${locale === 'ar' ? 'حالة غير موصوفة بعد؛ الرمز التقني' : 'This condition has no explanation yet; technical code'}: ${code}`;

/**
 * Operator-facing next steps for durable workflow conditions.
 *
 * The CMS reason code explains why a request cannot advance; this companion
 * map explains the safe operator response. Keeping both in one shared module
 * prevents the workflow, episode diagnostics, and action explanations from
 * drifting into contradictory instructions.
 */
export const journeyReasonActions: Record<string, [string, string]> = {
    frozen_plan_must_settle: ['Open the episode journey and resume or settle the current request before applying a replacement plan.', 'افتح رحلة الحلقة واستأنف الطلب الحالي أو سوِّ نتيجته قبل تطبيق خطة بديلة.'],
    generation_completion_failed: ['Open the episode and inspect recovery. Retry only when CMS exposes a safe recovery action; do not recut verified media blindly.', 'افتح الحلقة وافحص الاسترداد. أعد المحاولة فقط عندما يعرض CMS إجراء استرداد آمناً، ولا تعِد قص الوسائط المتحققة عشوائياً.'],
    effects_active: ['Wait for active work to finish. You may save a draft, but do not apply a new plan while effects are running.', 'انتظر انتهاء العمل النشط. يمكنك حفظ مسودة، لكن لا تطبق خطة جديدة أثناء تشغيل الآثار.'],
    policy_disabled: ['Review the effective episode/source policy and enable chaptering if intended. Episodes at or under 40 minutes still remain direct media.', 'راجع سياسة الحلقة أو المصدر وفعّل التقطيع إن كان مطلوباً. الحلقات التي لا تتجاوز ٤٠ دقيقة تبقى وسائط مباشرة.'],
    draft_inputs_unavailable: ['Complete media preparation and obtain a timestamped transcript, then refresh the episode before applying a plan.', 'أكمل تجهيز الوسائط واحصل على نص ذي توقيتات، ثم حدّث الحلقة قبل تطبيق الخطة.'],
    draft_worker_required: ['Check Media/Aggregation worker health, then refresh. Do not create duplicate plan requests while the worker is offline.', 'تحقق من صحة عاملي Media وAggregation ثم حدّث الصفحة. لا تنشئ طلبات خطة مكررة أثناء توقف العامل.'],
    draft_already_applied: ['Open the existing request from the episode journey and follow its current state instead of applying this revision again.', 'افتح الطلب الموجود من رحلة الحلقة وتابع حالته بدلاً من تطبيق هذا الإصدار مرة أخرى.'],
    draft_inputs_changed: ['Review the changed episode inputs and save a new draft so CMS can validate it against the current generation.', 'راجع مدخلات الحلقة التي تغيرت واحفظ مسودة جديدة ليتحقق CMS منها مقابل الإصدار الحالي.'],
    draft_invalid: ['Correct the validation messages in the draft, save it again, and only then apply the plan.', 'صحح رسائل التحقق في المسودة، ثم احفظها من جديد ولا تطبق الخطة قبل ذلك.'],
    awaiting_execution: ['Leave the admitted request in place and refresh for a confirmed transition; no queue position is available and duplicate requests are unsafe.', 'اترك الطلب المقبول وانتظر انتقالاً مؤكداً ثم حدّث الصفحة؛ لا يوجد ترتيب انتظار متاح والطلبات المكررة غير آمنة.'],
    permission_required: ['Use an account with media-management permission or ask an administrator to grant it.', 'استخدم حساباً يملك صلاحية إدارة الوسائط أو اطلب من المشرف منحها.'],
    prerequisites_required: ['Open the episode journey and resolve the prerequisite shown there before retrying this action.', 'افتح رحلة الحلقة وعالج المتطلب الظاهر فيها قبل إعادة هذا الإجراء.'],
    evidence_unavailable: ['Refresh the diagnostics. If evidence remains unavailable, open System Health and check CMS before taking recovery actions.', 'حدّث التشخيص. إذا بقيت الأدلة غير متاحة، افتح صحة النظام وتحقق من CMS قبل تنفيذ الاسترداد.'],
    predecessor_required: ['Open the preceding step listed in the journey and complete or wait for it. This is a dependency, not an approval request.', 'افتح المتطلب السابق الظاهر في الرحلة وأكمله أو انتظر اكتماله. هذه تبعية وليست طلب موافقة.'],
    download_approval: ['Use Download & process for this episode. That admits source media only; it does not authorize generated transcription.', 'استخدم تنزيل ومعالجة لهذه الحلقة. هذا يسمح بتنزيل الوسائط فقط ولا يسمح بالتفريغ المولّد.'],
    preparation_approval: ['Admit the episode with Download & process first; media preparation starts only after the download request is accepted.', 'اسمح بالحلقة عبر تنزيل ومعالجة أولاً؛ يبدأ تجهيز الوسائط بعد قبول طلب التنزيل.'],
    transcript_approval: ['After media is ready, choose Generate transcript for generated STT. Approve transcript for use only when text already exists.', 'بعد جاهزية الوسائط اختر توليد النص للتفريغ المولّد. استخدم اعتماد النص للاستخدام عندما يكون النص موجوداً بالفعل.'],
    shared_capacity: ['Leave this episode waiting and open the slot holder when one is shown. Do not submit another request just to move it ahead.', 'اترك الحلقة في الانتظار وافتح الحلقة الحاجزة إن ظهرت. لا ترسل طلباً جديداً لمحاولة تقديمها.'],
    operational_pause: ['Review the tenant policy and Autopilot controls, then resume execution only if the pause was intentional.', 'راجع سياسة المستأجر وضوابط التشغيل التلقائي، ثم استأنف التنفيذ إذا كان الإيقاف مقصوداً.'],
    scheduled_retry: ['Wait for the scheduled retry and refresh the journey. Do not create a duplicate request while the retry is pending.', 'انتظر موعد إعادة المحاولة المجدولة وحدّث الرحلة. لا تنشئ طلباً مكرراً أثناء الانتظار.'],
    effects_unresolved: ['Open recovery/evidence and wait for the uncertain effect to reconcile before retrying; do not redownload or recut blindly.', 'افتح الاسترداد والأدلة وانتظر تسوية الأثر غير المؤكد قبل الإعادة؛ لا تعِد التنزيل أو القص دون تشخيص.'],
    editorial_review_required: ['Open Review, preview the chapter, and approve or reject the editorial decision before publication checks can finish.', 'افتح المراجعة وعاين الفصل ثم اعتمده أو ارفضه قبل اكتمال فحوص النشر.'],
    embedding_or_family_required: ['Open chapter requirements and wait for embeddings or sibling readiness; a ready child may still wait for the complete generation.', 'افتح متطلبات الفصل وانتظر التضمينات أو جاهزية الفصول الشقيقة؛ قد ينتظر الفصل الجاهز اكتمال الإصدار.'],
    direct_media: ['No action is needed for this step. Direct short media does not require atomization.', 'لا يلزم إجراء لهذه الخطوة؛ الوسائط القصيرة المباشرة لا تحتاج إلى تقطيع.'],
};

export const journeyNextAction = (code: string, locale: JourneyLocale, step?: string) => {
    const action = journeyReasonActions[code]?.[locale === 'ar' ? 1 : 0];
    if (action) return action;
    const stepAction = step ? journeyGuide[step]?.[locale]?.action : undefined;
    return stepAction ?? (locale === 'ar' ? 'افتح رحلة الحلقة واتبع الإجراء المتاح، أو حدّث الأدلة قبل اتخاذ إجراء.' : 'Open the episode journey and follow the available action, or refresh evidence before acting.');
};
export const journeyState = (state: string, locale: JourneyLocale) => locale === 'ar' ? ({ pending: 'لم يبدأ', queued: 'في الانتظار', blocked: 'محجوب بتبعية', claimed: 'استحوذ عليه عامل', running: 'قيد التنفيذ', verifying: 'يجري التحقق', waiting: 'بانتظار متطلب', completed: 'مكتمل', failed: 'فشل', reconciling: 'تجري التسوية', not_required: 'غير مطلوب', cancelled: 'ملغى' } as Record<string,string>)[state] ?? state : state.replaceAll('_',' ');
export const journeyActionLabels: Record<string, [string,string]> = {
    download: ['Download & process','تنزيل ومعالجة'],
    approve_transcript: ['Generate transcript','توليد النص'],
    approve_transcript_for_use: ['Approve transcript for use','اعتماد النص للاستخدام'],
    retry_atomization: ['Retry planning and cutting','إعادة محاولة التخطيط والتقطيع'],
    review: ['Review chapter','مراجعة الفصل'],
    inspect: ['Inspect journey and recovery','فحص الرحلة والاسترداد'],
};
