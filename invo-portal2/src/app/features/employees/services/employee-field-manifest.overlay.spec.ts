import { describe, expect, it } from 'vitest';

import { FieldManifest } from '../models/field-manifest.types';
import { overlayClientBehaviour } from './employee-field-manifest.service';

/**
 * The served manifest is what the renderer reads. Flags that only the browser
 * acts on — `exclusiveInGroup`, `afterField` — therefore did nothing until the
 * backend process was restarted, which failed SILENTLY: no error, no console
 * line, just a rule that was not there. It happened twice in one hour and both
 * times read as a broken feature rather than a stale process.
 */
const local: FieldManifest = {
  version: 'local',
  groups: [
    {
      key: 'profile',
      labelKey: 'P',
      fields: [
        {
          key: 'emergencyContacts', type: 'group[]', labelKey: 'EC',
          fields: [{ key: 'isPrimary', type: 'boolean', labelKey: 'PR', exclusiveInGroup: true }],
        },
      ],
    },
    {
      key: 'employment',
      labelKey: 'E',
      fields: [
        { key: 'contractStartDate', type: 'date', labelKey: 'CS' },
        { key: 'contractEndDate', type: 'date', labelKey: 'CE', afterField: 'contractStartDate' },
      ],
    },
  ],
} as any;

/** The same manifest as an older server sends it: same fields, no flags. */
function servedWithoutFlags(): FieldManifest {
  const copy = JSON.parse(JSON.stringify(local));
  delete copy.groups[0].fields[0].fields[0].exclusiveInGroup;
  delete copy.groups[1].fields[1].afterField;
  copy.version = 'server';
  return copy;
}

const field = (m: FieldManifest, g: number, i: number) => (m.groups[g].fields[i] as any);

describe('overlayClientBehaviour', () => {
  it('fills a flag the server omits, INSIDE a nested row', () => {
    const out = overlayClientBehaviour(servedWithoutFlags(), local);
    expect(field(out, 0, 0).fields[0].exclusiveInGroup).toBe(true);
  });

  it('fills a flag the server omits at group level', () => {
    const out = overlayClientBehaviour(servedWithoutFlags(), local);
    expect(field(out, 1, 1).afterField).toBe('contractStartDate');
  });

  it('lets the SERVER win when it names the flag', () => {
    // The overlay must not take the behaviour away from the backend: naming
    // the flag `false` is how a behaviour gets turned off without a deploy.
    const served = servedWithoutFlags();
    served.groups[0].fields[0].fields![0].exclusiveInGroup = false;

    const out = overlayClientBehaviour(served, local);
    expect(field(out, 0, 0).fields[0].exclusiveInGroup).toBe(false);
  });

  it('adds NO field the server did not send', () => {
    // An overlay, never a merge of two field lists. A field the server dropped
    // stays dropped, or the portal would resurrect fields the backend retired.
    const served = servedWithoutFlags();
    served.groups[1].fields.splice(1, 1);

    const out = overlayClientBehaviour(served, local);
    expect(out.groups[1].fields.map((f) => f.key)).toEqual(['contractStartDate']);
  });

  it('leaves everything else exactly as served', () => {
    // The server stays canonical for what a field IS. Only the named
    // behaviour keys are touched.
    const served = servedWithoutFlags();
    served.groups[1].fields[0].labelKey = 'SERVER_LABEL';

    const out = overlayClientBehaviour(served, local);
    expect(field(out, 1, 0).labelKey).toBe('SERVER_LABEL');
    expect(out.version).toBe('server');
  });

  it('does not mutate the response object it was handed', () => {
    // The renderer keeps whatever it is given; writing flags onto a shared
    // reference would be a change nothing announced.
    const served = servedWithoutFlags();
    overlayClientBehaviour(served, local);
    expect(served.groups[1].fields[1] as any).not.toHaveProperty('afterField');
  });
});
