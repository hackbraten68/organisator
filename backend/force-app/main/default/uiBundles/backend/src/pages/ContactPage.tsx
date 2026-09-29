import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AlertCircle, Contact as ContactIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/layout';
import { PageContainer, PageHeader } from '@/components/ui/layout';
import { useAsyncData } from '@/hooks/useAsyncData';
import { toast } from '@/components/ui/sonner';
import ContactTable from '@/components/contacts/ContactTable';
import ContactDetailCard from '@/components/contacts/ContactDetailCard';
import CreateParticipantDialog, {
  type CreateParticipantDraft,
} from '@/components/contacts/CreateParticipantDialog';
import {
  getContact,
  listContacts,
  listParticipantLinks,
  type ParticipantLink,
} from '@/api/contact/contactService';
import { createParticipant } from '@/api/participant/participantService';
import { listPrograms } from '@/api/program/programService';
import { listCoaches } from '@/api/coach/coachService';
import { DuplicateParticipantForContactError } from '@/api/participant/duplicateParticipantError';
import type { Contact } from '@/types/contact';

/**
 * Contacts area: the person, and the role they may or may not hold in the
 * academy (ADR-001).
 *
 * A contact is created in the CRM, not here. This page only answers two
 * questions per person: who are they, and are they already a participant?
 */
export default function ContactPage() {
  const navigate = useNavigate();
  const { contactId } = useParams();

  const [reload, setReload] = useState(0);
  const [dialogContact, setDialogContact] = useState<Contact | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const list = useAsyncData(async () => {
    const [contacts, links] = await Promise.all([
      listContacts(),
      listParticipantLinks(),
    ]);
    return { contacts, links };
  }, [reload]);

  const detail = useAsyncData(
    async () => (contactId ? getContact(contactId) : null),
    [contactId, reload]
  );

  const options = useAsyncData(async () => {
    const [programs, coaches] = await Promise.all([
      listPrograms(),
      listCoaches(),
    ]);
    return { programs, coaches };
  }, [reload]);

  const links: Map<string, ParticipantLink> = list.data?.links ?? new Map();
  const openDialog = (contact: Contact) => {
    setDialogError(null);
    setDialogContact(contact);
  };

  const handleCreate = async (draft: CreateParticipantDraft) => {
    if (!dialogContact) return;
    try {
      const created = await createParticipant({
        contactId: dialogContact.id,
        ...draft,
      });
      setDialogContact(null);
      setDialogError(null);
      setReload(n => n + 1);
      toast.success('Teilnehmer angelegt', {
        description: created?.name ?? dialogContact.name,
      });
      if (created) navigate(`/participants/${created.id}`);
    } catch (err) {
      if (err instanceof DuplicateParticipantForContactError) {
        setDialogError(err.message);
        return;
      }
      setDialogError(
        err instanceof Error
          ? err.message
          : 'Teilnehmer konnte nicht angelegt werden.'
      );
    }
  };

  if (contactId) {
    return (
      <PageContainer>
        <PageHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Contacts</span>
            <span>/</span>
            <span className="font-medium text-foreground">
              {detail.data?.name ?? ''}
            </span>
          </div>
        </PageHeader>
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/contacts')}
          >
            Zurück zur Liste
          </Button>
        </div>
        {detail.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="size-4" />
            <AlertTitle>Fehler beim Laden</AlertTitle>
            <AlertDescription>{detail.error}</AlertDescription>
          </Alert>
        )}
        {detail.data && (
          <ContactDetailCard
            contact={detail.data}
            link={links.get(detail.data.id)}
            loading={detail.loading}
            onCreateParticipant={() => openDialog(detail.data as Contact)}
          />
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader>
        <div className="space-y-1">
          <h1 className="text-h1">Contacts</h1>
          <p className="text-caption text-muted-foreground">
            Personen und ihre Rolle in der Academy
          </p>
        </div>
      </PageHeader>
      {list.data &&
      list.data.contacts.length === 0 &&
      !list.loading &&
      !list.error ? (
        <EmptyState
          icon={<ContactIcon className="size-12" />}
          title="Keine Contacts vorhanden"
          description="Contacts werden im CRM angelegt und hierher übernommen."
        />
      ) : (
        <ContactTable
          contacts={list.data?.contacts ?? []}
          links={links}
          loading={list.loading}
          error={list.error}
          onCreateParticipant={openDialog}
        />
      )}

      <CreateParticipantDialog
        contact={dialogContact}
        programs={options.data?.programs ?? []}
        coaches={options.data?.coaches ?? []}
        error={dialogError}
        onClose={() => {
          setDialogContact(null);
          setDialogError(null);
        }}
        onSubmit={handleCreate}
      />
    </PageContainer>
  );
}
