/** Vite's `?raw` import, used so the tests read the stylesheet that actually ships. */
declare module "*.css?raw" {
  const contents: string;
  export default contents;
}
