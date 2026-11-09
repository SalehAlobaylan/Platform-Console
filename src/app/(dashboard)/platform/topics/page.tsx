'use client';

import { useRouter, useSearchParams } from '@/lib/navigation';
import { FolderTree, Gauge, Layers, Lightbulb, SlidersHorizontal } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommandBar } from '@/components/platform/topics/command-bar';
import { CatalogTab } from '@/components/platform/topics/catalog-tab';
import { ProposalsTab } from '@/components/platform/topics/proposals-tab';
import { CategoriesTab } from '@/components/platform/topics/categories-tab';
import { SettingsTab } from '@/components/platform/topics/settings-tab';
import { AutopilotTab } from '@/components/platform/topics/autopilot/autopilot-tab';

const TABS = ['catalog', 'proposals', 'categories', 'settings', 'autopilot'] as const;
type Tab = (typeof TABS)[number];

export default function TopicsPage() {
    const router = useRouter();
    const params = useSearchParams();
    const raw = params.get('tab');
    const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'catalog';

    const setTab = (next: string) => {
        const sp = new URLSearchParams(params.toString());
        sp.set('tab', next);
        router.replace(`?${sp.toString()}`, { scroll: false });
    };

    return (
        <div className="space-y-6 p-4 sm:p-6">
            <CommandBar />

            <Tabs value={tab} onValueChange={setTab} className="space-y-4">
                <TabsList className="flex h-auto flex-wrap justify-start">
                    <TabsTrigger value="catalog" className="gap-1.5">
                        <Layers className="h-3.5 w-3.5" /> Catalog
                    </TabsTrigger>
                    <TabsTrigger value="proposals" className="gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5" /> Proposals
                    </TabsTrigger>
                    <TabsTrigger value="categories" className="gap-1.5">
                        <FolderTree className="h-3.5 w-3.5" /> Categories
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Personalization
                    </TabsTrigger>
                    <TabsTrigger value="autopilot" className="gap-1.5">
                        <Gauge className="h-3.5 w-3.5" /> Autopilot
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="catalog">
                    <CatalogTab />
                </TabsContent>
                <TabsContent value="proposals">
                    <ProposalsTab />
                </TabsContent>
                <TabsContent value="categories">
                    <CategoriesTab />
                </TabsContent>
                <TabsContent value="settings">
                    <SettingsTab />
                </TabsContent>
                <TabsContent value="autopilot">
                    <AutopilotTab
                        onGoToSettings={() => setTab('settings')}
                        onGoToProposals={() => setTab('proposals')}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
