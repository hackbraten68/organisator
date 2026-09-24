import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Participant = {
  id: string;
  name: string;
  status: string;
  email: string;
  github: string;
  discord: string;
  programId: string;
  programName: string;
  coachId: string;
  coachName: string;
};

const participants: Participant[] = [
  {
    id: "1",
    name: "Max Mustermann",
    status: "Onboarding",
    email: "max@example.com",
    github: "maxmustermann",
    discord: "max#1234",
    programId: "p1",
    programName: "IT Pro",
    coachId: "c1",
    coachName: "Sam Dillenburg",
  },
  {
    id: "2",
    name: "Lisa Müller",
    status: "Active",
    email: "lisa@example.com",
    github: "lisam",
    discord: "lisa#4321",
    programId: "p2",
    programName: "Cloud Engineer",
    coachId: "c2",
    coachName: "Sandra Krüger",
  },
];

const programs = [
  {
    id: "p1",
    name: "IT Pro",
  },
  {
    id: "p2",
    name: "Cloud Engineer",
  },
  {
    id: "p3",
    name: "DevOps Engineer",
  },
];

const coaches = [
  {
    id: "c1",
    name: "Sam Dillenburg",
  },
  {
    id: "c2",
    name: "Sandra Krüger",
  },
  {
    id: "c3",
    name: "Ghaith Saidani",
  },
  {
    id: "c4",
    name: "Frank Blum",
  },
];

export default function ParticipantPage() {
  const [selectedId, setSelectedId] = useState(participants[0].id);

  const selectedParticipant = useMemo(
    () => participants.find((p) => p.id === selectedId) ?? participants[0],
    [selectedId]
  );

  const [participant, setParticipant] =
    useState<Participant>(selectedParticipant);

  function handleParticipantChange(id: string) {
    const selected = participants.find((p) => p.id === id);

    if (!selected) {
      return;
    }

    setSelectedId(id);
    setParticipant(selected);
  }

  function updateField<K extends keyof Participant>(
    field: K,
    value: Participant[K]
  ) {
    setParticipant((current) => ({
      ...current,
      [field]: value,
    }));
  }

  const isDirty =
    JSON.stringify(participant) !== JSON.stringify(selectedParticipant);

  function handleProgramChange(id: string) {
    const program = programs.find((p) => p.id === id);

    if (!program) {
      return;
    }

    setParticipant((current) => ({
      ...current,
      programId: program.id,
      programName: program.name,
    }));
  }

  function handleCoachChange(id: string) {
    const coach = coaches.find((c) => c.id === id);

    if (!coach) {
      return;
    }

    setParticipant((current) => ({
      ...current,
      coachId: coach.id,
      coachName: coach.name,
    }));
  }

  function handleReset() {
    setParticipant(selectedParticipant);
  }

  function handleSave() {
    console.log("Saving participant", participant);

    // Hier später Salesforce Mutation aufrufen
    alert("Participant saved");
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Teilnehmerliste */}

        <Card>
          <CardHeader>
            <CardTitle>Participants</CardTitle>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Program</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {participants.map((p) => (
                  <TableRow
                    key={p.id}
                    className={`cursor-pointer ${
                      p.id === selectedId ? "bg-accent" : ""
                    }`}
                    onClick={() => handleParticipantChange(p.id)}
                  >
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.status}</TableCell>
                    <TableCell>{p.programName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detailformular */}

        <Card>
          <CardHeader>
            <CardTitle>Participant Details</CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>

                <Input
                  value={participant.name}
                  onChange={(e) =>
                    updateField("name", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>

                <Select
                  value={participant.status}
                  onValueChange={(value) =>
                    updateField("status", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="Onboarding">
                      Onboarding
                    </SelectItem>

                    <SelectItem value="Active">
                      Active
                    </SelectItem>

                    <SelectItem value="Paused">
                      Paused
                    </SelectItem>

                    <SelectItem value="Completed">
                      Completed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>

                <Input
                  type="email"
                  value={participant.email}
                  onChange={(e) =>
                    updateField("email", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>GitHub</Label>

                <Input
                  value={participant.github}
                  onChange={(e) =>
                    updateField("github", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Discord</Label>

                <Input
                  value={participant.discord}
                  onChange={(e) =>
                    updateField("discord", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Program</Label>

                <Select
                  value={participant.programId}
                  onValueChange={handleProgramChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem
                        key={program.id}
                        value={program.id}
                      >
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Coach</Label>

                <Select
                  value={participant.coachId}
                  onValueChange={handleCoachChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {coaches.map((coach) => (
                      <SelectItem
                        key={coach.id}
                        value={coach.id}
                      >
                        {coach.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!isDirty}
              >
                Reset
              </Button>

              <Button
                onClick={handleSave}
                disabled={!isDirty}
              >
                Save Participant
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
