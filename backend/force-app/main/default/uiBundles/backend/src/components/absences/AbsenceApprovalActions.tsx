import { useState } from "react";
import { CheckCircle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { approveAbsence, rejectAbsence, cancelAbsence } from "@/api/absence/absenceService";
import { toast } from "sonner";

interface AbsenceApprovalActionsProps {
  absenceId: string;
  status: "Submitted" | "Approved" | "Rejected" | "Cancelled";
  onStatusChange: (newStatus: string) => void;
  currentUserId: string;
  isLoading?: boolean;
}

export function AbsenceApprovalActions({
  absenceId,
  status,
  onStatusChange,
  currentUserId,
  isLoading = false,
}: AbsenceApprovalActionsProps) {
  const [rejectComment, setRejectComment] = useState("");
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | "cancel" | null>(null);

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      await approveAbsence(absenceId, currentUserId);
      toast.success("Abwesenheit genehmigt");
      onStatusChange("Approved");
    } catch (err) {
      console.error("Approve failed", err);
      toast.error("Genehmigung fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      toast.error("Bitte einen Ablehnungsgrund angeben");
      return;
    }
    setActionLoading("reject");
    try {
      await rejectAbsence(absenceId, rejectComment.trim());
      toast.success("Abwesenheit abgelehnt");
      onStatusChange("Rejected");
      setRejectComment("");
    } catch (err) {
      console.error("Reject failed", err);
      toast.error("Ablehnung fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading("cancel");
    try {
      await cancelAbsence(absenceId);
      toast.success("Abwesenheit storniert");
      onStatusChange("Cancelled");
    } catch (err) {
      console.error("Cancel failed", err);
      toast.error("Stornierung fehlgeschlagen");
    } finally {
      setActionLoading(null);
    }
  };

  const isPending = status === "Submitted";
  const isApproved = status === "Approved";
  const isRejected = status === "Rejected";
  const isCancelled = status === "Cancelled";

  if (isCancelled) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <XCircle className="size-5 text-destructive" />
            <span>Diese Abwesenheit wurde storniert</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="size-5" />
          Aktionen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isPending && (
          <div className="space-y-3">
            <Button
              onClick={handleApprove}
              disabled={isLoading || actionLoading !== null}
              className="w-full"
            >
              {actionLoading === "approve" ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Genehmige...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Genehmigen
                </>
              )}
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  onClick={() => {}}
                  disabled={isLoading || actionLoading !== null}
                  className="w-full"
                >
                  {actionLoading === "reject" ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Lehne ab...
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4 mr-2" />
                      Ablehnen
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Abwesenheit ablehnen</AlertDialogTitle>
                  <AlertDialogDescription>
                    Bitte geben Sie einen Grund für die Ablehnung an. Der Teilnehmer wird benachrichtigt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-2 py-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="rejectComment">Ablehnungsgrund *</Label>
                    <Textarea
                      id="rejectComment"
                      value={rejectComment}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRejectComment(e.target.value)}
                      placeholder="Begründung für die Ablehnung..."
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setRejectComment("")}>
                    Abbrechen
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReject}
                    disabled={actionLoading !== null || !rejectComment.trim()}
                  >
                    {actionLoading === "reject" ? "Lehne ab..." : "Ablehnen"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {(isPending || isApproved) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {}}
                disabled={isLoading || actionLoading !== null}
                className="w-full"
              >
                {actionLoading === "cancel" ? (
                  <>
                    <Loader2 className="size-4 animate-spin mr-2" />
                    Storniere...
                  </>
                ) : (
                  <>
                    <XCircle className="size-4 mr-2" />
                    Stornieren
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abwesenheit stornieren</AlertDialogTitle>
                <AlertDialogDescription>
                  Dies hebt die Abwesenheit auf. Der Vorgang kann nicht rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancel} disabled={actionLoading !== null}>
                  {actionLoading === "cancel" ? "Storniere..." : "Stornieren"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isRejected && (
          <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">
              <XCircle className="size-4 inline mr-1.5" />
              Abgelehnt
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Kann nicht mehr genehmigt werden. Bei Bedarf neue Abwesenheit anlegen.
            </p>
          </div>
        )}

        {isApproved && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">
              <CheckCircle className="size-4 inline mr-1.5" />
              Genehmigt
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Stornierung möglich, falls sich die Situation ändert.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}