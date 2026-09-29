import { useState, useCallback } from 'react';
import { fileToBase64 } from '@/utils/fileToBase64';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  uploadAbsenceDocument,
  getAbsenceDocuments,
} from '@/api/absence/absenceService';
import type { AbsenceDocument } from '@/types/absence';
import { toast } from 'sonner';

interface AbsenceDocumentsProps {
  absenceId: string;
  currentUserId: string;
}

export function AbsenceDocuments({
  absenceId,
  currentUserId,
}: AbsenceDocumentsProps) {
  const [documents, setDocuments] = useState<AbsenceDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await getAbsenceDocuments(absenceId);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents', err);
      toast.error('Dokumente konnten nicht geladen werden');
    }
  }, [absenceId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        'Dateityp nicht erlaubt. Erlaubt: PDF, JPG, PNG, GIF, DOC, DOCX'
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Datei zu groß. Maximum 10 MB.');
      return;
    }

    setUploading(true);
    try {
      // VersionData is a Base64 scalar, not a binary payload.
      const versionData = await fileToBase64(file);

      await uploadAbsenceDocument(
        absenceId,
        {
          title: file.name,
          pathOnClient: file.name,
          versionData,
        },
        currentUserId
      );

      toast.success(`${file.name} hochgeladen`);
      fetchDocuments();
    } catch (err) {
      console.error('Upload failed', err);
      toast.error('Upload fehlgeschlagen');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (doc: AbsenceDocument) => {
    try {
      const response = await fetch(
        `/services/data/v67.0/sobjects/ContentVersion/${doc.contentDocumentId}/VersionData`,
        {
          headers: {
            Authorization: `Bearer ${(window as any).SFDC_ACCESS_TOKEN || ''}`,
          },
        }
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        toast.error('Download fehlgeschlagen');
      }
    } catch (err) {
      console.error('Download failed', err);
      toast.error('Download fehlgeschlagen');
    }
  };

  const handleDelete = async (doc: AbsenceDocument) => {
    if (!confirm(`${doc.fileName} wirklich löschen?`)) return;

    try {
      const response = await fetch(
        `/services/data/v67.0/sobjects/ContentDocument/${doc.contentDocumentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${(window as any).SFDC_ACCESS_TOKEN || ''}`,
          },
        }
      );
      if (response.ok || response.status === 204) {
        toast.success('Dokument gelöscht');
        fetchDocuments();
      } else {
        toast.error('Löschen fehlgeschlagen');
      }
    } catch (err) {
      console.error('Delete failed', err);
      toast.error('Löschen fehlgeschlagen');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType === 'PDF') return <FileText className="size-4 text-red-500" />;
    if (fileType.startsWith('image/'))
      return <span className="text-green-500">🖼️</span>;
    if (fileType.includes('word') || fileType.includes('document'))
      return <span className="text-blue-500">📄</span>;
    return <FileText className="size-4 text-gray-500" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Dokumente ({documents.length})
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
              onChange={handleFileSelect}
              className="sr-only"
              disabled={uploading}
              id="file-upload"
            />
            <Button variant="outline" size="sm" disabled={uploading}>
              <Upload className="size-4 mr-1.5" />
              Hochladen
            </Button>
          </label>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
            dragActive ? 'border-primary bg-primary/5' : 'border-border'
          }`}
          role="region"
          aria-label="Datei-Upload-Bereich"
        >
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
            onChange={handleFileSelect}
            className="sr-only"
            disabled={uploading}
            id="file-upload-hidden"
          />

          {documents.length === 0 && !uploading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="size-12 mx-auto mb-3 opacity-50" />
              <p>Keine Dokumente hochgeladen</p>
              <p className="text-sm mt-1">
                Datei hierher ziehen oder klicken zum Auswählen
              </p>
              <p className="text-xs mt-2">
                Erlaubt: PDF, JPG, PNG, GIF, DOC, DOCX (max. 10 MB)
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 bg-card border rounded-lg"
                >
                  <div className="flex-shrink-0 text-2xl" aria-hidden="true">
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.fileSize)} • {doc.fileType}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(doc)}
                      disabled={uploading}
                      aria-label={`Download ${doc.fileName}`}
                    >
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(doc)}
                      disabled={uploading}
                      aria-label={`Löschen ${doc.fileName}`}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              {uploading && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Datei wird hochgeladen...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
