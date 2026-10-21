import '@testing-library/jest-dom/vitest';

// jsdom lacks pointer-capture APIs that Radix Select relies on.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

/**
 * Top-Layer-Pseudo-Klassen in jsdom.
 *
 * jsdom 25 wertet Selektoren ueber nwsapi aus. Die Pseudo-Klassen `:modal`,
 * `:fullscreen` und `:popover-open` kennt jsdom nicht; nwsapi bildet sie ueber
 * `isModal`/`isFullscreen` ab und ruft dabei selbst wieder `matches()` auf —
 * der Aufruf landet erneut in der Selektor-Engine. Ergebnis: eine
 * unbegrenzte Rekursion. Gemessen: ein 100-ms-Sleep nach dem Oeffnen eines
 * Radix-Dropdowns dauerte 10,6 s, davon 10,9 s reine CPU-Zeit, ohne dass
 * ein Fehler auftrat — der Test lief in den Timeout.
 *
 * Ausgeloest wird das von floating-ui: beim Positionieren des Menueinhalts
 * fragt `isTopLayer()` den Top-Layer-Status ueber
 * `element.matches(':popover-open')` bzw. `element.matches(':modal')` ab.
 *
 * Der Patch ist bewusst eng gefasst: nur diese drei Selektoren liefern
 * `false` — in der Testumgebung ist kein Element im Top Layer. Jeder andere
 * Selektor laeuft weiterhin durch die Originalimplementierung von jsdom, damit
 * das echte Matching-Verhalten unveraendert bleibt. Die Ersetzung ist
 * idempotent: ein Marker verhindert mehrfaches Wrappen beim erneuten Laden
 * des Setups.
 */
const TOP_LAYER_PSEUDO_SELECTORS = new Set([':modal', ':fullscreen', ':popover-open']);

type MatchesFn = (selector: string) => boolean;
type PatchedMatches = MatchesFn & { __topLayerPatched?: boolean };

if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as { matches: PatchedMatches };
  if (!proto.matches.__topLayerPatched) {
    const original = proto.matches;
    const patched: PatchedMatches = function (this: Element, selector: string): boolean {
      if (typeof selector === 'string' && TOP_LAYER_PSEUDO_SELECTORS.has(selector.trim())) {
        return false;
      }
      return original.call(this, selector);
    };
    patched.__topLayerPatched = true;
    proto.matches = patched;
  }
}
