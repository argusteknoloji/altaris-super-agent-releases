// Minimal type declaration for cytoscape-fcose — upstream ships JS only.
// We only call cytoscape.use(fcose); the layout options are passed as a
// loose object literal at the call site, so a default any-export is enough.
declare module "cytoscape-fcose" {
  const fcose: cytoscape.Ext;
  export default fcose;
}
