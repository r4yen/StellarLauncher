import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

const messages = JSON.parse(readFileSync(new URL("../src/uiMessages.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../src/uiTranslation.ts", import.meta.url), "utf8").replace('import messages from "./uiMessages.json";', `const messages = ${JSON.stringify(messages)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { translateUi, errorSummary } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("German and English preserve names and paths in interpolated labels", () => {
  const name = "My {world} [1.21] $pack";
  assert.equal(translateUi("{name} icon", "de", { name }), `Bild von ${name}`);
  assert.equal(translateUi("{name} icon", "en", { name }), `${name} icon`);
  assert.equal(translateUi("D:\\Games\\My English World", "de"), "D:\\Games\\My English World");
});
test("status templates translate nested Java messages and escape punctuation", () => {
  assert.equal(translateUi("Java 21: Downloading Eclipse Temurin JDK", "de"), "Java 21: Eclipse-Temurin-JDK wird heruntergeladen");
  assert.equal(translateUi("Importing Pack [1.21]...", "de"), "Pack [1.21] wird importiert…");
  assert.equal(translateUi("Importing PackXYZ", "de"), "Importing PackXYZ");
  assert.equal(translateUi("Downloading update 1.0.5...", "de"), "Update 1.0.5 wird heruntergeladen…");
});
test("errors expose localized summaries without replacing technical content", () => {
  assert.equal(errorSummary("Offline player name must be at least 3 characters.", "de"), messages["Offline player name must be at least 3 characters."]);
  assert.equal(errorSummary("request failed: DNS NXDOMAIN", "de"), "Prüfe deine Verbindung und versuche es erneut.");
  assert.equal(errorSummary("request failed: DNS NXDOMAIN", "en"), "Check your connection and try again.");
});
test("every translation retains its interpolation parameters", () => {
  const parameters = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [en, de] of Object.entries(messages)) {
    assert.ok(de.trim(), en);
    assert.deepEqual(parameters(de), parameters(en), en);
  }
});
test("all literal ui calls have a German catalog entry", () => {
  const missing = [];
  for (const folder of ["components", "pages"]) for (const file of readdirSync(new URL(`../src/${folder}/`, import.meta.url))) {
    if (!file.endsWith(".tsx")) continue;
    const text = readFileSync(new URL(`../src/${folder}/${file}`, import.meta.url), "utf8");
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = node => {
      if (ts.isCallExpression(node) && node.expression.getText(ast) === "ui" && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && messages[node.arguments[0].text] === undefined) missing.push(`${file}: ${node.arguments[0].text}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  assert.deepEqual(missing, []);
});
