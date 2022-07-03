import * as esbuild from "esbuild-wasm"
import esbuildWasmUrl from "esbuild-wasm/esbuild.wasm?url"
import Path from "path"

let isEsbuildWasmInitialized = false

export const tsToJs = async (tree: Record<string, string>) => {
  if (!isEsbuildWasmInitialized) {
    await esbuild.initialize({ wasmURL: esbuildWasmUrl })
    isEsbuildWasmInitialized = true
  }

  const out = await esbuild.build({
    entryPoints: ["index.ts"],
    plugins: [ESBuildFakeFS(tree)],
    logOverride: { "commonjs-variable-in-esm": "silent" },
    bundle: true,
    write: false,
  })
  return out.outputFiles[0].text
}

// mostly from: https://github.com/evanw/esbuild/issues/1952
const ESBuildFakeFS = (tree: Record<string, string>) => {
  const map = new Map(Object.entries(tree))

  return {
    name: "ESBuildFakeFS",
    setup: (build: esbuild.PluginBuild) => {
      build.onResolve({ filter: /.*/, }, (args: esbuild.OnResolveArgs) => {
        if (args.kind === "entry-point")
          return { path: `/${args.path}` }
        if (args.kind === "import-statement") {
          const dirname = Path.dirname(args.importer)
          const path = Path.join(dirname, args.path)
          return { path }
        }
        throw Error("not resolvable")
      })
      build.onLoad({ filter: /.*/ }, (args: esbuild.OnLoadArgs) => {
        const path = map.has(args.path) ? args.path : `${args.path}.ts`
        if (!map.has(path))
          throw Error("not loadable")
        const ext = Path.extname(path)
        const contents = map.get(path)!
        const loader = ({ ".ts": "ts", ".tsx": "tsx", ".js": "js", ".jsx": "jsx" }[ext]) as esbuild.Loader || "default"
        return { contents, loader }
      })

    }
  }
}
