// WILVO: leest een STEP-bestand in een worker (occt-import-js) en stuurt de vormen terug.
// Staat als los bestand naast occt-import-js: een worker uit een Blob erft de strenge CSP van de pagina,
// en die blokkeert de eval die de WebAssembly-lijmcode nodig heeft.
importScripts("occt-import-js.js");
onmessage = async ({ data }) => {
  try {
    const occt = await occtimportjs({ locateFile: name => new URL(name, self.location.href).href });
    const r = occt.ReadStepFile(new Uint8Array(data.bytes), null);
    if (!r.success) { postMessage({ ok: false }); return; }
    const meshes = r.meshes.map(m => ({
      name: m.name || "",
      color: m.color || null,
      position: Float32Array.from(m.attributes.position.array),
      normal: m.attributes.normal ? Float32Array.from(m.attributes.normal.array) : null,
      index: Uint32Array.from(m.index.array)
    }));
    const transfer = [];
    meshes.forEach(m => { transfer.push(m.position.buffer, m.index.buffer); if (m.normal) transfer.push(m.normal.buffer); });
    postMessage({ ok: true, root: r.root, meshes }, transfer);
  } catch (error) { postMessage({ ok: false, error: String(error && error.message || error) }); }
};
