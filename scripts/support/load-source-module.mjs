import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Load real TypeScript modules with explicit unit-boundary replacements. Each
 * loader owns its module cache and environment, so CLI selection cannot leak
 * between tests. Callers replace subprocess and configuration boundaries.
 */
export function sourceLoader({ replacements = {}, env = {} } = {}) {
  const modules = new Map();
  const testProcess = Object.create(process);
  testProcess.env = { ...process.env, ...env };

  function load(filename) {
    const absolute = path.resolve(repositoryRoot, filename);
    if (Object.hasOwn(replacements, absolute)) return replacements[absolute];
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const loadedModule = { exports: {} };
    modules.set(absolute, loadedModule);
    const source = fs.readFileSync(absolute, 'utf8');
    const compiled = ts.transpileModule(source, {
      fileName: absolute,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const localRequire = (specifier) => {
      if (Object.hasOwn(replacements, specifier)) return replacements[specifier];
      if (specifier === 'server-only') return {};
      if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        const candidate = specifier.startsWith('@/')
          ? path.join(repositoryRoot, specifier.slice(2))
          : path.resolve(path.dirname(absolute), specifier);
        const resolved = [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.json`]
          .find((entry) => fs.existsSync(entry) && fs.statSync(entry).isFile());
        if (!resolved) throw new Error(`Source module does not exist: ${candidate}`);
        if (resolved.endsWith('.json')) return JSON.parse(fs.readFileSync(resolved, 'utf8'));
        return load(resolved);
      }
      return require(specifier);
    };
    const evaluate = vm.runInThisContext(
      `(function(require,module,exports,process,__filename,__dirname){${compiled}\n})`,
      { filename: absolute },
    );
    evaluate(localRequire, loadedModule, loadedModule.exports, testProcess, absolute, path.dirname(absolute));
    return loadedModule.exports;
  }

  return { load, repositoryRoot };
}
