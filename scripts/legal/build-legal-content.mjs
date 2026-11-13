// Regenerates the typed legal content modules from the Markdown sources that
// live at the repository root. The Markdown files stay the single source of
// truth for the policy copy; this script only inlines them so the App Router can
// render them without a bundler plugin or a runtime filesystem read.
//
// Usage: node scripts/legal/build-legal-content.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const outDir = resolve(root, "lib", "legal", "content");

const documents = [
  {
    source: "Benefits_Hub_Privacy_Policy.md",
    exportName: "benefitsHubPrivacyPolicy",
    header: "Benefits Hub Privacy Policy",
  },
  {
    source: "Benefits_Hub_Terms_of_Service.md",
    exportName: "benefitsHubTermsOfService",
    header: "Benefits Hub Terms of Service",
  },
];

/** Escape a Markdown document for a JavaScript template literal. */
function toTemplateLiteral(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

mkdirSync(outDir, { recursive: true });

for (const doc of documents) {
  const markdown = readFileSync(resolve(root, doc.source), "utf8").replace(
    /\r\n/g,
    "\n",
  );
  const file = `// AUTO-GENERATED from ${doc.source} by scripts/legal/build-legal-content.mjs.
// Do not edit by hand. Edit the source Markdown and re-run the script.
//
// ${doc.header}

export const ${doc.exportName} = \`${toTemplateLiteral(markdown)}\`;
`;

  const outputName = doc.source
    .replace(/\.md$/i, "")
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/^benefits-hub-/, "");
  const outputPath = resolve(outDir, `${outputName}.ts`);
  writeFileSync(outputPath, file, "utf8");
  console.log(`Wrote ${outputPath}`);
}
