import { createFileRoute } from '@tanstack/react-router';
import Page from '@/app/(dashboard)/platform/intelligence/embeddings/page';

export const Route = createFileRoute('/_dashboard/platform_/intelligence_/embeddings')({ component: Page });
