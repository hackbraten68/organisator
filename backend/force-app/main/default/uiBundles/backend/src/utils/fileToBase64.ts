/**
 * File -> Base64 helpers for the UI API `Base64` scalar.
 *
 * The GraphQL `VersionData` field is a Base64 scalar, not a binary payload.
 * Passing a Blob hands the scalar an object it cannot serialise, so the
 * conversion has to happen here rather than at the transport layer.
 */

/**
 * Reads a file as a bare Base64 string (no data-URL prefix).
 *
 * FileReader.readAsDataURL is used rather than FileReader.readAsBinaryData
 * plus btoa because a 10 MB file would otherwise be assembled as a 10 million
 * character string before encoding.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error(`Datei ${file.name} konnte nicht gelesen werden.`));
        return;
      }
      // Strip "data:<mime>;base64," so only the payload is sent.
      const commaIndex = result.indexOf(',');
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.readAsDataURL(file);
  });
}
