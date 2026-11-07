// The UMD build's API is the package's own (same version, same source), so its types are the ESM entry's.
declare const lib: typeof import("ag-studio");
export default lib;
export type StudioLib = typeof import("ag-studio");
