// Cytoscape extension registration tek noktada. VaultGraph (full graph view)
// ve RightPanel/LocalGraphMini'nin ikisi de cytoscape-fcose kullanıyor.
// `cytoscape` paketi Webpack tarafından shared module — ikinci `use(fcose)`
// çağrısı "plugin already registered" hatası fırlatıyor ve sayfayı boş bırakıyor.
//
// ensureFcose() module-level flag ile idempotent: kaç kere çağrılırsa çağrılsın
// register sadece bir kez yapılır.

import cytoscape from "cytoscape";
import fcose from "cytoscape-fcose";

let registered = false;

export function ensureFcose(): void {
  if (registered) return;
  try {
    cytoscape.use(fcose);
    registered = true;
  } catch {
    // already registered (HMR, paralel chunk init); flag'i yine setle ki
    // sonraki çağrılarda re-try yapmayalım.
    registered = true;
  }
}
