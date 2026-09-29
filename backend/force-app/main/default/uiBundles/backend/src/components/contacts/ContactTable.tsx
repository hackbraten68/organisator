import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertCircle, Search, UserPlus, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/layout';
import type { Contact } from '@/types/contact';
import type { ParticipantLink } from '@/api/contact/contactService';

interface ContactTableProps {
  contacts: Contact[];
  links: Map<string, ParticipantLink>;
  onCreateParticipant: (contact: Contact) => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * The contact list. One row per person, with the action that applies to their
 * current state: a contact without a participant can become one, a contact
 * with one links straight to it.
 */
export default function ContactTable({
  contacts,
  links,
  onCreateParticipant,
  loading = false,
  error = null,
}: ContactTableProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts;
    return contacts.filter(contact =>
      [contact.name, contact.email, contact.accountName]
        .filter((value): value is string => Boolean(value))
        .some(value => value.toLowerCase().includes(needle))
    );
  }, [contacts, query]);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertTitle>Fehler beim Laden</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-h2">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <CardTitle className="text-h2">Contacts</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {contacts.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Suchen..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-10"
            aria-label="Contacts durchsuchen"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="size-12" />}
              title={query ? 'Keine Treffer' : 'Keine Contacts vorhanden'}
              description={
                query
                  ? `Keine Contacts gefunden für "${query}"`
                  : 'Es wurden noch keine Contacts angelegt.'
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Teilnehmer</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(contact => {
                const link = links.get(contact.id);
                return (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      {contact.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      {link ? (
                        <div className="flex items-center gap-2">
                          <span className="truncate">{link.name}</span>
                          {link.status && (
                            <Badge variant="outline" className="text-xs">
                              {link.status}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {link ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/participants/${link.id}`)}
                        >
                          Teilnehmer öffnen
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => onCreateParticipant(contact)}
                        >
                          <UserPlus className="size-4" />
                          Als Teilnehmer anlegen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
