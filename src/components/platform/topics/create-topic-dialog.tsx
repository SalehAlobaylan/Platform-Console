'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateCatalogTopic } from '@/hooks/use-topics';
import { CategorySelect } from './category-select';

export function CreateTopicDialog({ trigger }: { trigger: React.ReactElement }) {
    const create = useCreateCatalogTopic();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ slug: '', label_en: '', label_ar: '', category_slug: '', featured: true });

    const submit = () => {
        create.mutate(
            { ...form, active: true },
            {
                onSuccess: () => {
                    setOpen(false);
                    setForm({ slug: '', label_en: '', label_ar: '', category_slug: '', featured: true });
                },
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={trigger} />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create topic</DialogTitle>
                    <DialogDescription>
                        Manually add a canonical topic. Its centroid is embedded and the corpus is remapped in the background.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Slug</Label>
                        <Input value={form.slug} placeholder="auto from label if blank" onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">English label</Label>
                            <Input value={form.label_en} onChange={(e) => setForm({ ...form, label_en: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Arabic label</Label>
                            <Input dir="rtl" value={form.label_ar} onChange={(e) => setForm({ ...form, label_ar: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Category</Label>
                        <CategorySelect value={form.category_slug} onChange={(v) => setForm({ ...form, category_slug: v })} />
                    </div>
                    <label className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        Featured in picker
                        <Switch checked={form.featured} onCheckedChange={(v) => setForm({ ...form, featured: v })} />
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={create.isPending || (!form.label_en.trim() && !form.slug.trim())}>
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
