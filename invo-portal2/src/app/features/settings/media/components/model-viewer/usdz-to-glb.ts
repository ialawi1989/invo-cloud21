/**
 * Turns a USDZ file (Apple's AR format) into a GLB so the in-page 3D viewer can draw it. Display only: nothing is saved or uploaded.
 *
 * Done in the browser with three.js's `USDLoader` (the current loader; `USDZLoader` is deprecated) and `GLTFExporter`, both loaded
 * on demand so they only cost a download when a USDZ is actually opened. The loader reads the common cases (meshes, UV-mapped
 * textures, UsdPreviewSurface materials) but not everything USD can hold (skinning, some compressed or exotic files), so the
 * caller must be ready for it to throw and fall back to Apple's AR Quick Look.
 */
export async function usdzToGlb(usdz: Blob): Promise<Blob> {
  const [{ USDLoader }, { GLTFExporter }] = await Promise.all([
    import('three/examples/jsm/loaders/USDLoader.js'),
    import('three/examples/jsm/exporters/GLTFExporter.js'),
  ]);
  const scene = await new USDLoader().parse(await usdz.arrayBuffer());
  // The loader answers an unreadable file with an empty scene instead of an error; an empty model would just show a blank viewer.
  let meshes = 0;
  scene.traverse(o => { if ((o as { isMesh?: boolean }).isMesh) meshes++; });
  if (meshes === 0) throw new Error('The USDZ file has no geometry this converter can read');
  const glb = (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
  return new Blob([glb], { type: 'model/gltf-binary' });
}
