'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomerStatusBadge } from '@/components/crm/customers/customer-status-badge';
import { ContactForm } from '@/components/crm/customers/contact-form';
import { NoteForm, NoteCard } from '@/components/crm/notes';
import { ActivityForm, ActivityTypeIcon } from '@/components/crm/activities';
import { TagChip } from '@/components/crm/tags';
import {
    useCustomer,
    useCustomerContacts,
    useCreateCustomerContact,
    useSetContactPrimary,
    useDeleteContact,
    useCustomerTags,
    useAssignCustomerTags,
    useRemoveCustomerTag,
} from '@/hooks/use-customers';
import { useCustomerNotes, useCreateNote, useDeleteNote } from '@/hooks/use-notes';
import { useActivities, useCreateActivity, useDeleteActivity, useCompleteActivity } from '@/hooks/use-activities';
import type { Contact, Tag, CreateContactRequest, CreateNoteRequest, Note } from '@/types/crm';
import { getActivityStatus } from '@/types/crm';

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const customerId = params.id as string;

    const [activeTab, setActiveTab] = useState('overview');
    const [showContactForm, setShowContactForm] = useState(false);
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [showActivityForm, setShowActivityForm] = useState(false);

    const { data: customer, isLoading: customerLoading } = useCustomer(customerId);
    const { data: contacts, isLoading: contactsLoading } = useCustomerContacts(customerId);
    const { data: tags, isLoading: tagsLoading } = useCustomerTags(customerId);
    const { data: notesData, isLoading: notesLoading } = useCustomerNotes(customerId, { limit: 50 });
    const { data: activitiesData } = useActivities({ customer_id: customerId, limit: 20 });

    const createContactMutation = useCreateCustomerContact();
    const setPrimaryMutation = useSetContactPrimary();
    const deleteContactMutation = useDeleteContact();
    const assignTagsMutation = useAssignCustomerTags();
    const removeTagMutation = useRemoveCustomerTag();
    const createNoteMutation = useCreateNote();
    const deleteNoteMutation = useDeleteNote();
    const createActivityMutation = useCreateActivity();
    const deleteActivityMutation = useDeleteActivity();
    const completeActivityMutation = useCompleteActivity();

    const handleContactSubmit = (data: Omit<CreateContactRequest, 'customer_id'>) => {
        createContactMutation.mutate(
            { customerId, data },
            { onSuccess: () => setShowContactForm(false) }
        );
    };

    const handleNoteSubmit = (data: CreateNoteRequest) => {
        createNoteMutation.mutate(data, {
            onSuccess: () => {
                setShowNoteForm(false);
            },
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    {customerLoading ? (
                        <Skeleton className="h-8 w-64" />
                    ) : customer ? (
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                            <p className="text-muted-foreground flex items-center gap-4 mt-1">
                                {customer.email && (
                                    <span className="flex items-center gap-1">
                                        <Mail className="h-4 w-4" />
                                        {customer.email}
                                    </span>
                                )}
                                {customer.phone && (
                                    <span className="flex items-center gap-1">
                                        <Phone className="h-4 w-4" />
                                        {customer.phone}
                                    </span>
                                )}
                                {customer.company && (
                                    <span className="flex items-center gap-1">
                                        <Building2 className="h-4 w-4" />
                                        {customer.company}
                                    </span>
                                )}
                            </p>
                        </div>
                    ) : null}
                </div>
                {customer && (
                    <div className="flex items-center gap-2">
                        <CustomerStatusBadge status={customer.status} />
                        <Button variant="outline" size="sm">
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="contacts">Contacts</TabsTrigger>
                    <TabsTrigger value="activities">Activities</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>

                {/* Overview Tab */}
                <TabsContent value="overview" className="space-y-6">
                    {customerLoading ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card><Skeleton className="h-40" /></Card>
                            <Card><Skeleton className="h-40" /></Card>
                        </div>
                    ) : customer ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Customer Information</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div>
                                        <span className="text-sm text-muted-foreground">Status</span>
                                        <div className="mt-1"><CustomerStatusBadge status={customer.status} /></div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Email</span>
                                        <div className="mt-1">{customer.email || '-'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Phone</span>
                                        <div className="mt-1">{customer.phone || '-'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Company</span>
                                        <div className="mt-1">{customer.company || '-'}</div>
                                    </div>
                                    <div>
                                        <span className="text-sm text-muted-foreground">Follow-up Date</span>
                                        <div className="mt-1">
                                            {customer.follow_up_at
                                                ? format(new Date(customer.follow_up_at), 'PPP')
                                                : '-'}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle>Tags</CardTitle>
                                        <Button variant="outline" size="sm">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Tag
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {tagsLoading ? (
                                        <Skeleton className="h-16 w-full" />
                                    ) : tags && tags.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <TagChip
                                                    key={tag.id}
                                                    tag={tag}
                                                    onRemove={() => removeTagMutation.mutate({
                                                        customerId,
                                                        tagId: tag.id,
                                                    })}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No tags assigned</p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Primary Contact</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {contactsLoading ? (
                                        <Skeleton className="h-20 w-full" />
                                    ) : customer.primary_contact ? (
                                        <div className="space-y-1">
                                            <div className="font-medium">{customer.primary_contact.name}</div>
                                            {customer.primary_contact.email && (
                                                <div className="text-sm text-muted-foreground">
                                                    <Mail className="h-3 w-3 inline mr-1" />
                                                    {customer.primary_contact.email}
                                                </div>
                                            )}
                                            {customer.primary_contact.phone && (
                                                <div className="text-sm text-muted-foreground">
                                                    <Phone className="h-3 w-3 inline mr-1" />
                                                    {customer.primary_contact.phone}
                                                </div>
                                            )}
                                            {customer.primary_contact.title && (
                                                <div className="text-sm text-muted-foreground">
                                                    {customer.primary_contact.title}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No primary contact set</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    ) : null}
                </TabsContent>

                {/* Contacts Tab */}
                <TabsContent value="contacts" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Contacts</h2>
                        <Button onClick={() => setShowContactForm(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Contact
                        </Button>
                    </div>

                    {contactsLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-20 w-full" />
                            <Skeleton className="h-20 w-full" />
                        </div>
                    ) : contacts && contacts.length > 0 ? (
                        <div className="space-y-3">
                            {contacts.map((contact: Contact) => (
                                <Card key={contact.id}>
                                    <CardContent className="pt-6">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{contact.name}</span>
                                                    {contact.is_primary && (
                                                        <Badge variant="secondary">Primary</Badge>
                                                    )}
                                                </div>
                                                {contact.email && (
                                                    <div className="text-sm text-muted-foreground">
                                                        <Mail className="h-3 w-3 inline mr-1" />
                                                        {contact.email}
                                                    </div>
                                                )}
                                                {contact.phone && (
                                                    <div className="text-sm text-muted-foreground">
                                                        <Phone className="h-3 w-3 inline mr-1" />
                                                        {contact.phone}
                                                    </div>
                                                )}
                                                {contact.title && (
                                                    <div className="text-sm text-muted-foreground">{contact.title}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!contact.is_primary && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setPrimaryMutation.mutate(contact.id)}
                                                        disabled={setPrimaryMutation.isPending}
                                                    >
                                                        Set Primary
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => deleteContactMutation.mutate(contact.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No contacts found. Add a contact to get started.
                            </CardContent>
                        </Card>
                    )}

                    <ContactForm
                        open={showContactForm}
                        onClose={() => setShowContactForm(false)}
                        onSubmit={handleContactSubmit}
                        isSubmitting={createContactMutation.isPending}
                    />
                </TabsContent>

                {/* Activities Tab */}
                <TabsContent value="activities" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Activities</h2>
                        <Button onClick={() => setShowActivityForm(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Activity
                        </Button>
                    </div>

                    {activitiesData?.data && activitiesData.data.length > 0 ? (
                        <div className="space-y-3">
                            {activitiesData.data.map((activity) => {
                                const status = getActivityStatus(activity);
                                return (
                                    <Card key={activity.id}>
                                        <CardContent className="pt-6">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-1">
                                                        <ActivityTypeIcon type={activity.type} className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <div className="font-medium">{activity.subject}</div>
                                                        {activity.description && (
                                                            <div className="text-sm text-muted-foreground">{activity.description}</div>
                                                        )}
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span>
                                                                Due: {activity.due_at
                                                                    ? format(new Date(activity.due_at), 'PPp')
                                                                    : 'No due date'}
                                                            </span>
                                                            {activity.completed_at && (
                                                                <Badge variant="success">Completed</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!activity.completed_at && activity.type === 'task' && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => completeActivityMutation.mutate(activity.id)}
                                                        >
                                                            Complete
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteActivityMutation.mutate(activity.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No activities found. Create an activity to track interactions.
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold">Notes</h2>
                        <Button onClick={() => setShowNoteForm(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Note
                        </Button>
                    </div>

                    {notesLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-32 w-full" />
                            <Skeleton className="h-32 w-full" />
                        </div>
                    ) : notesData?.data && notesData.data.length > 0 ? (
                        <div className="space-y-3">
                            {notesData.data.map((note: Note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onDelete={() => deleteNoteMutation.mutate(note.id)}
                                    isDeleting={deleteNoteMutation.isPending}
                                />
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-muted-foreground">
                                No notes found. Add a note to document information.
                            </CardContent>
                        </Card>
                    )}

                    <NoteForm
                        open={showNoteForm}
                        onClose={() => setShowNoteForm(false)}
                        onSubmit={handleNoteSubmit}
                        customerId={customerId}
                        isSubmitting={createNoteMutation.isPending}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
