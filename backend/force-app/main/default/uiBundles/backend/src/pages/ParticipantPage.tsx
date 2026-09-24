import { useState } from "react";
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

type Participant = {
  id: string;
  name: string;
  status: string;
  email: string;
  github: string;
  discord: string;
  program: string;
  coach: string;
};

const participants: Participant[] = [
  {
    id: "1",
    name: "Max Mustermann",
    status: "Onboarding",
    email: "max@example.com",
    github: "maxmustermann",
    discord: "max#1234",
    program: "IT Pro",
    coach: "Sam Dillenburg",
  },
];

const programs = [
  "IT Pro",
  "Cloud Engineer",
  "DevOps Engineer",
];

const coaches = [
  "Sam Dillenburg",
  "Sandra Krüger",
  "Ghaith Saidani",
  "Frank Blum",
];

export default function ParticipantPage() {
  const [selectedId, setSelectedId] = useState(participants[0].id);
  const [participant, setParticipant] = useState<Participant>(
    participants[0]
  );

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

  function handleSave() {
    console.log("Saving participant", participant);
    alert("Participant saved (mock implementation)");
  }

  return (
    <div className="container mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Participant Management</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Participant</Label>

            <Select
              value={selectedId}
              onValueChange={handleParticipantChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select participant" />
              </SelectTrigger>

              <SelectContent>
                {participants.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
                value={participant.program}
                onValueChange={(value) =>
                  updateField("program", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem
                      key={program}
                      value={program}
          >
                      {program}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Coach</Label>

              <Select
                value={participant.coach}
                onValueChange={(value) =>
                  updateField("coach", value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  {coaches.map((coach) => (
                    <SelectItem
                      key={coach}
                      value={coach}
                    >
                      {coach}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>
              Save Participant
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
