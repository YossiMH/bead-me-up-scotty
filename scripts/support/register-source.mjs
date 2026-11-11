import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Resolve and transpile the real application modules. No CLI, filesystem, or
// application modules are replaced; server-only uses Node's react-server condition.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/') || (specifier.startsWith('.') && context.parentURL?.startsWith('file:'))) {
      const candidate = specifier.startsWith('@/')
        ? path.join(root, specifier.slice(2))
        : fileURLToPath(new URL(specifier, context.parentURL));
      for (const filename of [candidate, `${candidate}.ts`, `${candidate}.tsx`]) {
        if (fs.existsSync(filename) && fs.statSync(filename).isFile()) {
          return nextResolve(pathToFileURL(filename).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) {
      const filename = fileURLToPath(url);
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
          fileName: filename,
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
