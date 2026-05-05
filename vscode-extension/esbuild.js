// VS Code extension bundle — tek dosya, ws gibi runtime bağımlılıklarını içine alır.
// vscode modülü extension host tarafından sağlanır → external.

const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

const config = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: true,
  minify: !watch,
  logLevel: "info",
};

(async () => {
  if (watch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log("[watch] esbuild watching...");
  } else {
    await esbuild.build(config);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
