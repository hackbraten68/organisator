import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import ContactDetailCard from './ContactDetailCard';
import type { Contact } from '@/types/contact';
import type { ParticipantLink } from '@/api/contact/contactService';

const navigate = vi.fn();
vi.mock('react-router', async () => {
  const actual =
    await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

const aylin: Contact = {
  id: '003a',
  firstName: 'Aylin',
  lastName: 'Yilmaz',
  name: 'Aylin Yilmaz',
  email: 'aylin@example.com',
  phone: '+49 30 123456',
  accountName: 'Codingschule Academy',
};

const link: ParticipantLink = {
  id: 'a059-1',
  name: 'Aylin Yilmaz',
  status: 'Onboarding',
};

const renderCard = (
  props: Partial<React.ComponentProps<typeof ContactDetailCard>> = {}
) => {
  const onCreateParticipant = props.onCreateParticipant ?? vi.fn();
  render(
    <MemoryRouter>
      <ContactDetailCard
        contact={aylin}
        onCreateParticipant={onCreateParticipant}
        {...props}
      />
    </MemoryRouter>
  );
  return { onCreateParticipant };
};

describe('ContactDetailCard', () => {
  beforeEach(() => navigate.mockClear());

  it('shows the master data read-only', () => {
    renderCard();

    expect(screen.getByText('Aylin Yilmaz')).toBeInTheDocument();
    expect(screen.getByText('aylin@example.com')).toBeInTheDocument();
    expect(screen.getByText('+49 30 123456')).toBeInTheDocument();
    expect(screen.getByText('Codingschule Academy')).toBeInTheDocument();
  });

  it('offers no editing affordance for the master data', () => {
    renderCard();
    expect(
      screen.queryByRole('button', { name: 'Bearbeiten' })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('offers creation when no participant exists', async () => {
    const { onCreateParticipant } = renderCard();

    expect(screen.getByText('Noch kein Teilnehmer')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Als Teilnehmer anlegen' })
    );
    expect(onCreateParticipant).toHaveBeenCalledOnce();
  });

  it('links to the participant and explains that a second one is impossible', async () => {
    renderCard({ link });

    expect(screen.getByText('Onboarding')).toBeInTheDocument();
    expect(
      screen.getByText(/Ein zweiter Teilnehmer ist nicht möglich/)
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /Teilnehmer öffnen/ })
    );
    expect(navigate).toHaveBeenCalledWith('/participants/a059-1');
  });
});
