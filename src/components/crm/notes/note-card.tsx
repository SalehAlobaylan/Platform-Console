import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { Note } from '@/types/crm';

interface NoteCardProps {
    note: Note;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
}

export function NoteCard({ note, onDelete, isDeleting }: NoteCardProps) {
    return (
        <Card>
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                            {note.author?.name || 'Unknown'}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                        </span>
                    </div>
                    {onDelete && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => onDelete(note.id)}
                            disabled={isDeleting}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
            </CardContent>
        </Card>
    );
}
