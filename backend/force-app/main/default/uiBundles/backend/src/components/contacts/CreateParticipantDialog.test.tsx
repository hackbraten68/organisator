import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateParticipantDialog from './CreateParticipantDialog';
import type { Contact } from '@/types/contact';
import type { Program, ProgramCoachSummary } from '@/types/program';

const contact: Contact = {
  id: '003a',
  firstName: 'Aylin',
  lastName: 'Yilmaz',
  name: 'Aylin Yilmaz',
  email: 'aylin@example.com',
};

const programs: Program[] = [
  { id: 'p1', name: 'IT Pro', status: 'Active' } as Program,
  { id: 'p2', name: 'IT Pro Advanced', status: 'Active' } as Program,
];

const coaches: ProgramCoachSummary[] = [
  { id: 'c1', name: 'Sandra Krüger' },
  { id: 'c2', name: 'Frank Blum' },
];

const renderDialog = (
  props: Partial<React.ComponentProps<typeof CreateParticipantDialog>> = {}
) => {
  const onSubmit = props.onSubmit ?? vi.fn(async () => undefined);
  render(
    <CreateParticipantDialog
      contact={contact}
      programs={programs}
      coaches={coaches}
      onClose={props.onClose ?? vi.fn()}
      onSubmit={onSubmit}
      error={props.error}
    />
  );
  return { onSubmit };
};

describe('CreateParticipantDialog', () => {
  it("never asks for the person's own data", () => {
    renderDialog();

    // Name, email and contact are the contact's business, not the form's.
    expect(
      screen.getByText(/Name und E-Mail kommen aus dem Contact/)
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('E-Mail')).not.toBeInTheDocument();
  });

  it('offers program, coach and the two dates', () => {
    renderDialog();

    expect(screen.getByLabelText('Programm')).toBeInTheDocument();
    expect(screen.getByLabelText('Coach')).toBeInTheDocument();
    expect(screen.getByLabelText('Startdatum')).toBeInTheDocument();
    expect(screen.getByLabelText('Enddatum')).toBeInTheDocument();
  });

  it('submits an empty role when nothing was chosen', async () => {
    const { onSubmit } = renderDialog();

    await userEvent.click(
      screen.getByRole('button', { name: 'Teilnehmer anlegen' })
    );

    expect(onSubmit).toHaveBeenCalledWith({
      programId: null,
      coachId: null,
      startDate: null,
      expectedEndDate: null,
    });
  });

  it('submits the chosen dates', async () => {
    const { onSubmit } = renderDialog();

    await userEvent.type(screen.getByLabelText('Startdatum'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Enddatum'), '2027-04-01');
    await userEvent.click(
      screen.getByRole('button', { name: 'Teilnehmer anlegen' })
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-10-01',
        expectedEndDate: '2027-04-01',
      })
    );
  });

  it('shows the duplicate error from the server inline', () => {
    renderDialog({
      error: 'Dieser Contact ist bereits einem Teilnehmer zugeordnet.',
    });

    expect(
      screen.getByText(
        'Dieser Contact ist bereits einem Teilnehmer zugeordnet.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Anlegen fehlgeschlagen')).toBeInTheDocument();
  });

  it('closes without submitting', async () => {
    const onClose = vi.fn();
    renderDialog({ onClose });

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
