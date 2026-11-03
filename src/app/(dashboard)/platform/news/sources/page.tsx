'use client';

import { useState } from 'react';
import { NewsSourcesManager } from '@/components/platform/sources/manage/news-sources-manager';

export default function NewsSourcesPage() {
    const [, setBusy] = useState(false);
    return <NewsSourcesManager standalone onBusyChange={setBusy} returnTo="/platform/news/sources" />;
}
