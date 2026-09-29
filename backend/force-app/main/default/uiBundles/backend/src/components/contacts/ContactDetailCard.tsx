import { useNavigate } from 'react-router';
import { ArrowUpRight, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/layout';
import type { Contact } from '@/types/contact';
import type { ParticipantLink } from '@/api/contact/contactService';

interface ContactDetailCardProps {
  contact: Contact;
  link?: ParticipantLink;
  onCreateParticipant: () => void;
  loading?: boolean;
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="text-body font-medium break-words">{value || '—'}</dd>
    </div>
  );
}

/**
 * Contact detail: master data (read-only) and the participant role.
 *
 * The master data block has no edit affordance on purpose. Name, email and
 * phone belong to the Contact and are maintained in the CRM; a second editor
 * here would be a second source of truth (ADR-001, ADR-009).
 */
export default function ContactDetailCard({
  contact,
  link,
  onCreateParticipant,
  loading = false,
}: ContactDetailCardProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <Skeleton className="h-8 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-h2">Stammdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-6 md:grid-cols-2">
            <Field label="Name" value={contact.name} />
            <Field label="E-Mail" value={contact.email} />
            <Field label="Telefon" value={contact.phone} />
            <Field label="Account" value={contact.accountName} />
          </dl>
          <p className="mt-6 text-caption text-muted-foreground">
            Stammdaten werden im CRM gepflegt und sind hier bewusst nur lesbar.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-h2">Teilnehmerstatus</CardTitle>
            {link && (
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/participants/${link.id}`)}
                >
                  Teilnehmer öffnen
                  <ArrowUpRight className="size-4" />
                </Button>
              </CardAction>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {link ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-body font-medium">{link.name}</span>
                {link.status && <Badge variant="outline">{link.status}</Badge>}
              </div>
              <p className="text-caption text-muted-foreground">
                Dieser Contact ist bereits einem Teilnehmer zugeordnet. Ein
                zweiter Teilnehmer ist nicht möglich.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                icon={<UserPlus className="size-10" />}
                title="Noch kein Teilnehmer"
                description="Dieser Contact ist noch keiner Rolle in der Academy zugeordnet."
              />
              <Button onClick={onCreateParticipant}>
                <UserPlus className="size-4" />
                Als Teilnehmer anlegen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
