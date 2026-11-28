// WILVO: leest een STEP-bestand in een worker (occt-import-js) met de B-rep-vlakken per lichaam (brep_faces), voor de
// uitslag in Werkvoorbereiding. Fijnere driehoeken dan step-worker.js (0,01 mm), zodat gaten en bogen netjes passen.
// Staat als los bestand naast occt-import-js: een worker uit een Blob erft de strenge CSP van de pagina.
importScripts("occt-import-js.js");
onmessage = async ({ data }) => {
  try {
    const occt = await occtimportjs({ locateFile: name => new URL(name, self.location.href).href });
    const params = { linearUnit: "millimeter", linearDeflectionType: "absolute_value", linearDeflection: 0.01, angularDeflection: 0.1 };
    const r = occt.ReadStepFile(new Uint8Array(data.bytes), params);
    if (!r.success) { postMessage({ ok: false }); return; }
    const meshes = r.meshes.map(m => ({
      name: m.name || "",
      color: m.color || null,
      position: Float32Array.from(m.attributes.position.array),
      index: Uint32Array.from(m.index.array),
      faces: (m.brep_faces || []).map(f => ({ first: f.first, last: f.last, color: f.color || null }))
    }));
    const transfer = [];
    meshes.forEach(m => transfer.push(m.position.buffer, m.index.buffer));
    postMessage({ ok: true, root: r.root, meshes }, transfer);
  } catch (error) { postMessage({ ok: false, error: String(error && error.message || error) }); }
};
