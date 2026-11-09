import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prototypeRoot = path.join(repositoryRoot, 'prototipos');

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

function localReferences(filePath, contents) {
  const references = [];
  const patterns = [
    /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of contents.matchAll(pattern)) {
      const reference = match[1].trim();
      if (!reference || /^(?:#|data:|https?:|mailto:|tel:|\/\/)/i.test(reference)) continue;
      references.push({ filePath, reference });
    }
  }
  return references;
}

test('todos os protótipos estão dentro de prototipos/', () => {
  assert.ok(existsSync(prototypeRoot), 'a pasta prototipos/ deve existir');
  const files = filesUnder(prototypeRoot);
  for (const requiredFile of ['index.html', 'login.html', 'home.html', 'recarga.html', 'pedidos.html', 'novo-pedido.html', 'cardapio.html']) {
    assert.ok(files.includes(path.join(prototypeRoot, requiredFile)), `${requiredFile} deve estar em prototipos/`);
  }
  assert.ok(files.includes(path.join(prototypeRoot, 'img', 'logo-alimenta-campus.png')), 'a pasta img/ deve acompanhar os protótipos');
});

test('referências locais dos protótipos continuam resolvendo', () => {
  const files = filesUnder(prototypeRoot);
  const sourceFiles = files.filter((filePath) => /\.(?:html|css)$/i.test(filePath));
  const missing = [];

  for (const filePath of sourceFiles) {
    const contents = readFileSync(filePath, 'utf8');
    for (const { reference } of localReferences(filePath, contents)) {
      const decodedReference = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
      const targetPath = path.resolve(path.dirname(filePath), decodedReference);
      if (!targetPath.startsWith(`${prototypeRoot}${path.sep}`) || !existsSync(targetPath)) {
        missing.push(`${path.relative(prototypeRoot, filePath)} -> ${reference}`);
      }
    }
  }

  assert.deepEqual(missing, [], `referências locais ausentes:\n${missing.join('\n')}`);
});
