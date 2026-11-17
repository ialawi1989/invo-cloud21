// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { usdzToGlb } from './usdz-to-glb';

/** A one-triangle .usdz (a zip holding model.usda). */
const TRIANGLE_USDZ = 'UEsDBBQAAAAAAFRWcV2Phujk+wAAAPsAAAAKAAAAbW9kZWwudXNkYSN1c2RhIDEuMAooCiAgICBkZWZhdWx0UHJpbSA9ICJSb290IgogICAgdXBBeGlzID0gIlkiCikKCmRlZiBYZm9ybSAiUm9vdCIKewogICAgZGVmIE1lc2ggIlRyaSIKICAgIHsKICAgICAgICBpbnRbXSBmYWNlVmVydGV4Q291bnRzID0gWzNdCiAgICAgICAgaW50W10gZmFjZVZlcnRleEluZGljZXMgPSBbMCwgMSwgMl0KICAgICAgICBwb2ludDNmW10gcG9pbnRzID0gWygwLCAwLCAwKSwgKDEsIDAsIDApLCAoMCwgMSwgMCldCiAgICB9Cn0KUEsBAhQAFAAAAAAAVFZxXY+G6OT7AAAA+wAAAAoAAAAAAAAAAAAAAIABAAAAAG1vZGVsLnVzZGFQSwUGAAAAAAEAAQA4AAAAIwEAAAAA';

describe('usdzToGlb', () => {
  it('converts a USDZ into a binary glTF (GLB)', async () => {
    const bytes = Uint8Array.from(Buffer.from(TRIANGLE_USDZ, 'base64'));
    const glb = await usdzToGlb(new Blob([bytes]));
    expect(glb.type).toBe('model/gltf-binary');
    expect(new TextDecoder().decode(new Uint8Array(await glb.arrayBuffer(), 0, 4))).toBe('glTF');
  });

  it('rejects data that is not a USDZ', async () => {
    await expect(usdzToGlb(new Blob([new Uint8Array([1, 2, 3, 4])]))).rejects.toBeTruthy();
  });
});
