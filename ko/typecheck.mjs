import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { transformSource } from './transform.mjs';

const catalog = JSON.parse(fs.readFileSync('ko/catalog.json', 'utf8'));
const policy = JSON.parse(fs.readFileSync('ko/policy.json', 'utf8'));
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
const host = ts.createCompilerHost(parsed.options);
const originalRead = host.readFile.bind(host);
let transformed = 0;
host.readFile = filename => {
  const code = originalRead(filename);
  const relative = path.relative(process.cwd(), filename).replaceAll('\\', '/');
  if (code !== undefined && relative.startsWith('src/') && /\.tsx?$/.test(relative)) {
    transformed++;
    return transformSource(code, relative, catalog, policy).code;
  }
  return code;
};
host.resolveModuleNames = (names, containingFile) => names.map(name => name === '/ko/runtime.mjs'
  ? { resolvedFileName: path.resolve('ko/runtime.d.mts'), extension: ts.Extension.Dmts }
  : ts.resolveModuleName(name, containingFile, parsed.options, host).resolvedModule);
const program = ts.createProgram(parsed.fileNames, parsed.options, host);
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
if (diagnostics.length) console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: filename => filename,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n',
}));
console.log(`Korean transformed typecheck: ${transformed} files; ${diagnostics.length} diagnostics.`);
process.exitCode = diagnostics.length ? 1 : 0;
