#!/usr/bin/env python3
"""
Erzeugt docs/portal/setup-worklist.md aus den Metadaten in
force-app/main/default/objects/.

Die bestehende Datei beschreibt, WAS die Felder sind. Diese beschreibt, was im
Setup-Formular einzutragen ist — in der Reihenfolge, in der Setup es abfragt.

Generiert, nicht gepflegt: jede Zeile stammt aus dem XML, es gibt keine
zweite Wahrheit, die auseinanderlaufen kann.

Bewusst nicht enthalten: die Beschreibung wird unveraendert aus dem XML
uebernommen, auch wenn die Sprachgemisch (Labels deutsch, Beschreibungen
gemischt) dadurch sichtbar wird. Das ist der Stand im Repository.
"""
import glob
import os
import xml.etree.ElementTree as ET

NS = {'m': 'http://soap.sforce.com/2006/04/metadata'}
ROOT = 'force-app/main/default/objects'
OUT = 'docs/portal/setup-worklist.md'

# Anzeigename fuer den Feldtyp, wie ihn das Setup-Formular nennt.
TYPE_LABEL = {
    'Text': 'Text',
    'LongTextArea': 'Text Area (Long)',
    'TextArea': 'Text Area (Medium)',
    'Number': 'Number',
    'Date': 'Date',
    'DateTime': 'Date/Time',
    'Time': 'Time',
    'Email': 'Email',
    'Url': 'URL',
    'Checkbox': 'Checkbox',
    'Picklist': 'Picklist',
    'Lookup': 'Lookup',
    'MasterDetail': 'Master-Detail Relationship',
}

# Standardobjekte: existieren in jeder Org, koennen nicht angelegt werden.
# Sie stehen trotzdem in der Liste, weil ihre Custom-Felder von Hand
# entstehen muessen — bei Contact ist Freigeschaltet__c genau das.
PREEXISTING = {'Account', 'Contact'}

# Lookup-Aufloesung "Related To" steht in Setup unter diesem Feld.
DELETE_LABEL = {'Restrict': 'Restrict', 'SetNull': 'Set null', 'Cascade': 'Cascade'}


def txt(root, tag):
    el = root.find(f'm:{tag}', NS)
    return (el.text or '').strip() if el is not None else ''


def checkbox(flag):
    return 'x' if flag == 'true' else ''


def rows(*pairs):
    out = ['| Setup form field | Enter |', '| --- | --- |']
    for label, value in pairs:
        out.append(f'| {label} | {value} |')
    return out


def field_rows(root, name):
    """Zeilen fuer das Feld-Formular, abhaengig vom Typ."""
    t = txt(root, 'type')
    label = TYPE_LABEL.get(t, t)
    length = txt(root, 'length')
    required = checkbox(txt(root, 'required'))
    unique = checkbox(txt(root, 'unique'))
    extid = checkbox(txt(root, 'externalId'))
    history = checkbox(txt(root, 'trackHistory'))
    desc = txt(root, 'description')

    pairs = [('Type', label), ('Field Label', txt(root, 'label'))]

    if t in ('Text', 'LongTextArea', 'TextArea', 'Url'):
        pairs.append(('Length', length))
    if t == 'Number':
        pairs.append(('Length (total digits)', txt(root, 'precision')))
        pairs.append(('Decimal Places', txt(root, 'scale')))
    if t == 'LongTextArea':
        pairs.append(('Lines to display', txt(root, 'visibleLines')))

    pairs += [
        ('Required', f'[{required}]' if required else 'unchecked'),
        ('Unique', f'[{unique}]' if unique else 'unchecked'),
        ('External ID', f'[{extid}]' if extid else 'unchecked'),
    ]

    if t == 'Lookup':
        pairs.insert(2, ('Related To', txt(root, 'referenceTo')))
        pairs.append(('Relationship Name', txt(root, 'relationshipName')))
        dc = txt(root, 'deleteConstraint')
        if dc:
            pairs.append(('What happens when the related record is deleted', DELETE_LABEL.get(dc, dc)))

    if t == 'Picklist':
        pairs.append(('Restrict picklist to the values defined in the value set', 'checked'))

    pairs.append(('Description', desc))

    if history:
        pairs.append(('Track Field History (Object-level, not per field)', 'see object step'))

    out = rows(*pairs)

    if t == 'Picklist':
        out.append('')
        out.append('Values — enter **Value** and **Display Value** separately:')
        out.append('')
        out.append('| Value (API name) | Display Value | Default |')
        out.append('| --- | --- | --- |')
        vsd = root.find('m:valueSet/m:valueSetDefinition', NS)
        for v in vsd.findall('m:value', NS):
            fn = txt(v, 'fullName')
            lb = txt(v, 'label')
            dflt = 'yes' if txt(v, 'default') == 'true' else ''
            # Nur abweichende Paare hervorheben, sonst additiv.
            mark = '' if fn == lb else '  <- different!'
            out.append(f'| `{fn}` | {lb}{mark} | {dflt} |')

    return '\n'.join(out)


def create_object_block(obj, oroot, rn_type, rn_format):
    """Step 1 und Step 2: Objekt und Tab anlegen. Nur fuer neue Custom Objects."""
    out = ['### Step 1 — Create the object']
    out.append('')
    out.append('`Setup → Object Manager → Create → Custom Object`')
    out.append('')
    pairs = [
        ('Label', txt(oroot, 'label')),
        ('Plural Label', txt(oroot, 'pluralLabel')),
        ('Record Name', rn_type or 'Text'),
    ]
    if rn_type == 'AutoNumber':
        pairs.append(('Display Format', rn_format))
        pairs.append(('Starting Number', '1'))
    pairs += [
        ('Description', txt(oroot, 'description')),
        ('Allow Reports', 'checked' if txt(oroot, 'enableReports') == 'true' else 'unchecked'),
        ('Allow Activities', 'checked' if txt(oroot, 'enableActivities') == 'true' else 'unchecked'),
        ('Track Field History', 'checked' if txt(oroot, 'enableHistory') == 'true' else 'unchecked'),
        ('Allow Search', 'checked' if txt(oroot, 'enableSearch') == 'true' else 'unchecked'),
        ('Allow in Chatter Groups', 'checked' if txt(oroot, 'allowInChatterGroups') == 'true' else 'unchecked'),
    ]
    out += rows(*pairs)
    out.append('')
    out.append('> The API name is generated from the Label. After saving, Object Manager must '
               f'show the API name `{obj}`. If it differs, the object cannot be renamed — '
               'delete it and redo.')
    out.append('>')
    out.append(f'> **Verify:** the repository sets `externalSharingModel` to '
               f'`{txt(oroot, "externalSharingModel") or "not set"}` on this object. It is not '
               'offered in the new-object form in current releases, so treat it as something '
               'to confirm afterwards, not something to click now. For the portal this matters: '
               'a non-private value would let external users see the object through a sharing '
               'rule without one. Check in Object Manager after creating every object '
               'in this list that is not a standard object.')
    out.append('')

    out.append('### Step 2 — Create the tab')
    out.append('')
    out.append('`Setup → App Launcher → New → Object`')
    out.append('')
    out += rows(
        ('Category', 'any existing category — the repo defines none'),
        ('Tab', txt(oroot, 'label')),
        ('Tab Style', 'any'),
        ('Object', f'{txt(oroot, "label")} (`{obj}`)'),
    )
    out.append('')
    out.append('> Without a tab the object is invisible in Setup and you cannot reach the '
               'field screen. Do this before Step 3.')
    out.append('>')
    out.append('> The repository has no tab metadata of its own, so the category is not '
               'fixed by it. Whatever category you pick, keep it the same for all ten '
               'objects so the tabs end up together.')
    out.append('')
    return out


def object_block(obj, oroot, fields):
    namefield = oroot.find('m:nameField', NS)
    rn_type = txt(namefield, 'type') if namefield is not None else ''
    rn_format = txt(namefield, 'displayFormat') if namefield is not None else ''

    out = [f'## {obj}', '']
    label = txt(oroot, 'label') or obj
    preexisting = obj in PREEXISTING
    out.append(f'**Fields:** {len(fields)}' + ('' if preexisting else f' &nbsp;&nbsp; **Record Name:** {rn_type or "Text"}'))
    out.append('')

    if preexisting:
        out.append(f'{obj} is a standard object and already exists. Only its custom '
                   'fields are created here — Steps 1 and 2 do not apply.')
        out.append('')
    else:
        out += create_object_block(obj, oroot, rn_type, rn_format)

    out.append(f'### Step 3 — Fields ({len(fields)})')
    out.append('')
    for i, (api, froot) in enumerate(fields, 1):
        out.append(f'#### {i}. `{api}`')
        out.append('')
        out.append(f'`Object Manager → {label} → Fields & Relationships → New`')
        out.append('')
        out.append(field_rows(froot, api))
        out.append('')
        if txt(froot, 'deleteConstraint') == 'Restrict':
            out.append('> **Set "Restrict delete" now.** It cannot be changed to a weaker '
                       'setting later — only tightened.')
            out.append('')
    return '\n'.join(out)


def collect_fields(objdir):
    """Die __c-Felder eines Objektordners, ohne Lookups zuerst."""
    fields = []
    for f in sorted(glob.glob(f'{objdir}fields/*.field-meta.xml')):
        api = os.path.basename(f).replace('.field-meta.xml', '')
        if not api.endswith('__c'):
            continue
        fields.append((api, ET.parse(f).getroot()))
    # Nicht-Lookups zuerst: sie lassen sich anlegen, bevor die Zielfelder
    # existieren. Innerhalb der Gruppen alphabetisch fuer Nachvollziehbarkeit.
    fields.sort(key=lambda kv: (1 if txt(kv[1], 'referenceTo') else 0, kv[0]))
    return fields


def collect():
    objects = []
    for d in sorted(glob.glob(f'{ROOT}/*/')):
        obj = os.path.basename(d.rstrip('/'))
        if obj in PREEXISTING:
            # Kein object-meta.xml noetig: das Objekt existiert, nur die Felder
            # sind neu. Leere Wurzel, damit txt() nichts findet.
            oroot = ET.Element('CustomObject')
            fields = collect_fields(d)
            if fields:
                objects.append((obj, oroot, fields))
            continue
        opath = f'{d}{obj}.object-meta.xml'
        if not os.path.exists(opath):
            continue
        oroot = ET.parse(opath).getroot()
        fields = collect_fields(d)
        # Nicht-Lookups zuerst: sie lassen sich anlegen, bevor die Zielfelder
        # existieren. Innerhalb der Gruppen alphabetisch fuer Nachvollziehbarkeit.
        fields.sort(key=lambda kv: (1 if txt(kv[1], 'referenceTo') else 0, kv[0]))
        objects.append((obj, oroot, fields))
    return objects


def dependency_order(objects):
    """Wurzelobjekte zuerst; danach topologisch nach Lookup-Abhaengigkeit."""
    deps = {}
    for obj, _, fields in objects:
        refs = {txt(f, 'referenceTo') for _, f in fields if txt(f, 'referenceTo')}
        deps[obj] = {r for r in refs if r in {o for o, _, _ in objects}}

    order, remaining = [], dict(deps)
    while remaining:
        ready = [o for o, d in remaining.items() if not (d & set(remaining))]
        if not ready:
            order += sorted(remaining)
            break
        for o in sorted(ready):
            order.append(o)
        for o in ready:
            del remaining[o]
    return order


HEADER = """# Setup Worklist — Academy data model in `hubSandbox`

**Stand:** 2026-09-30
**Zweck:** anleitung zum Anlegen aller Objekte und Felder von Hand in Salesforce Setup.

## Warum von Hand

Ein Deploy erzeugt die Felder nicht im Runtime-Schema. In `hubSandbox` gemessen
(Kontrollversuch E4, `Program__c`):

```text
sf project deploy start     Succeeded, 4 Komponenten "Created"
sf data query               ERROR: No such column 'Description__c'
Tooling API FieldDefinition Description__c, DurationWeeks__c, Status__c (vorhanden)
sf sobject describe         9 Felder, davon 0 mit __c
```

Drei APIs melden die Felder, SOQL und `sobject describe` kennen sie nicht. Es gibt
keinen Weg daran vorbei.

## Reihenfolge

Lookups erzwingen eine Reihenfolge: ein Lookup-Feld laesst sich erst anlegen, wenn
sein Zielfeld existiert. Die __WURZEL__ Wurzelobjekte sind unabhaengig.

| # | Objekt | Felder | Lookup-Voraussetzung |
| - | ------ | -----: | ------------------- |
"""

FOOTER = """
## Nach der Anlage

```bash
cd backend
npm run schema:check
```

Exit 0 heisst: alle __FELDER__ Felder sind im Runtime-Schema und per SOQL abfragbar. **Achtung:**
`schema-check` prueft nur die *Existenz* der Felder, nicht ihre Attribute. `required`,
`unique`, Picklist-Werte, Laengen und Descriptions sind damit nicht abgedeckt.

Der eigentliche Nachweis ist der Abgleich mit dem Repository:

```bash
sf project retrieve start \\
  --metadata CustomObject:Program__c --metadata CustomObject:Participant__c \\
  --target-org hubSandbox
git diff
```

Leerer Diff heisst: Setup und Repository beschreiben dieselbe Sache.

## Haeufige Fehlerquellen

| Fehler | Folge |
| ------ | ----- |
| Picklist-Value als Anzeigewert statt API-Name eingetragen | API-Id wird zu `Vor_Ort` statt `OnSite`; Apex und GraphQL brechen zur Laufzeit |
| Relationship Name weggelassen | Setup vergibt einen anderen; davon haengt die Related-Liste ab |
| API-Name nach dem Speichern nicht geprueft | falscher Name laesst sich nicht mehr korrigieren, nur loeschen |
| "Restrict delete" erst nachtraeglich gesetzt | gar nicht mehr moeglich, nur noch verschaerfen |
| Tab nicht angelegt | Objekt in Setup nicht erreichbar, Felder nicht anlegbar |
| Feld nach dem Anlegen umbenannt | nicht moeglich, Type und API-Name sind fix |
"""


def main():
    objects = collect()
    order = dependency_order(objects)
    by_name = {o: (o, r, f) for o, r, f in objects}
    total = sum(len(f) for _, _, f in objects)
    n_roots = sum(
        1
        for o, r, f in objects
        if not {txt(fr, 'referenceTo') for _, fr in f} & set(by_name)
    )

    parts = [HEADER.replace('__WURZEL__', str(n_roots))]
    for i, obj in enumerate(order, 1):
        o, r, f = by_name[obj]
        refs = sorted({txt(fr, 'referenceTo') for _, fr in f if txt(fr, 'referenceTo')})
        refs = [x for x in refs if x in by_name]
        parts.append(
            f'| {i} | `{obj}` | {len(f)} | '
            + (', '.join(f'`{x}`' for x in refs) if refs else '— (Wurzelobjekt)')
            + ' |\n'
        )
    parts.append('\n---\n\n')

    for obj in order:
        o, r, f = by_name[obj]
        parts.append(object_block(obj, r, f))
        parts.append('\n---\n\n')

    parts.append(FOOTER.replace('__FELDER__', str(total)))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write(''.join(parts))

    print(f'  geschrieben: {OUT}')
    print(f'  {len(objects)} Objekte, {total} Felder')


if __name__ == '__main__':
    main()
