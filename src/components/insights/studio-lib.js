// AG Studio's self-contained UMD build (Studio with AG Grid and AG Charts Enterprise inside), not its ESM entry.
// The ESM entry imports ag-grid-community, which the Claims page also imports: sharing that one module made the
// bundler keep every grid export for /console too (+137 KB gzipped). Through the UMD, Studio's grid is its own copy,
// loaded only on /console/insights. The package's exports map hides dist/, hence the relative path.
// Types: studio-lib.d.ts, which TypeScript resolves before this file.
import lib from "../../../node_modules/ag-studio/dist/umd/ag-studio.min.js";

export default lib;
