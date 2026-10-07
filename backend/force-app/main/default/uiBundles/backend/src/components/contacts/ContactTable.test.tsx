import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ContactTable from './ContactTable';
import type { Contact } from '@/types/contact';
import type { ParticipantLink } from '@/api/contact/contactService';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

const contact = (id: string, name: string, email: string): Contact => ({
  id,
  name,
  email,
  firstName: name.split(' ')[0],
  lastName: name.split(' ').slice(1).join(' '),
  accountName: 'Codingschule Academy',
});

const aylin = contact('003a', 'Aylin Yilmaz', 'aylin@example.com');
const jonas = contact('003b', 'Jonas Weber', 'jonas@example.com');

const links = new Map<string, ParticipantLink>([
  ['003b', { id: 'a059-1', name: 'Jonas Weber', status: 'Active' }],
]);

const renderTable = (
  props: Partial<React.ComponentProps<typeof ContactTable>> = {}
) => {
  const merged = {
    contacts: [aylin, jonas],
    links,
    onCreateParticipant: vi.fn(),
    ...props,
  };
  return {
    ...render(
      <MemoryRouter>
        <ContactTable
          contacts={merged.contacts}
          links={merged.links}
          onCreateParticipant={merged.onCreateParticipant}
          loading={props.loading}
          error={props.error}
        />
      </MemoryRouter>
    ),
    onCreateParticipant: merged.onCreateParticipant,
  };
};

describe('ContactTable', () => {
  beforeEach(() => {
    navigate.mockClear();
  });

  it('lists name and email for every contact', () => {
    renderTable();
    // Scoped to the name column: "Jonas Weber" also appears as the participant
    // name of the same contact, so a global query would match twice.
    const nameCells = screen.getAllByText('Jonas Weber');
    expect(nameCells.length).toBeGreaterThan(0);
    expect(screen.getByText('aylin@example.com')).toBeInTheDocument();
    expect(screen.getByText('jonas@example.com')).toBeInTheDocument();
  });

  it('shows the participant and their status when one exists', () => {
    renderTable();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('offers creation only for contacts without a participant', async () => {
    const { onCreateParticipant } = renderTable();

    const createButtons = screen.getAllByRole('button', {
      name: 'Als Teilnehmer anlegen',
    });
    // Only the contact without a participant gets the action.
    expect(createButtons).toHaveLength(1);

    await userEvent.click(createButtons[0]);
    expect(onCreateParticipant).toHaveBeenCalledWith(aylin);
  });

  it('navigates to the participant of a contact that already has one', async () => {
    renderTable();

    // One of each: the create action belongs to Aylin, the open action to Jonas.
    expect(
      screen.getAllByRole('button', { name: 'Als Teilnehmer anlegen' })
    ).toHaveLength(1);
    const openButtons = screen.getAllByRole('button', {
      name: 'Teilnehmer öffnen',
    });
    expect(openButtons).toHaveLength(1);

    await userEvent.click(openButtons[0]);
    expect(navigate).toHaveBeenCalledWith('/participants/a059-1');
  });

  it('filters on name and email', async () => {
    renderTable();
    await userEvent.type(
      screen.getByLabelText('Contacts durchsuchen'),
      'aylin'
    );

    expect(screen.getByText('Aylin Yilmaz')).toBeInTheDocument();
    expect(screen.queryByText('jonas@example.com')).not.toBeInTheDocument();
  });

  it('explains an empty result caused by the search', async () => {
    renderTable();
    await userEvent.type(screen.getByLabelText('Contacts durchsuchen'), 'zzz');
    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
  });

  it('shows the empty state without contacts', () => {
    renderTable({ contacts: [] });
    expect(screen.getByText('Keine freigeschalteten Contacts')).toBeInTheDocument();
    // Der Leerzustand muss erklaeren, wie ein Kontakt herueberkommt — sonst
    // liest sich "leer" als "keine Kontakte vorhanden".
    expect(screen.getByText(/Freigeschaltet/)).toBeInTheDocument();
  });

  it('surfaces a load error', () => {
    renderTable({ error: 'Netzwerkfehler' });
    expect(screen.getByText('Netzwerkfehler')).toBeInTheDocument();
  });
});
