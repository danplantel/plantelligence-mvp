import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { LegalPlaceholderContext } from "@/lib/legal/legal-config";
import { prepareLegalMarkdown } from "@/lib/legal/legal-text";

interface LegalDocumentProps {
  /** The policy Markdown (generated from a root-level `.md` source). */
  markdown: string;
  /** Values substituted into the document's `[PLACEHOLDER]` fields. */
  context?: LegalPlaceholderContext;
  className?: string;
}

interface ParagraphLine {
  text: string;
  /** The source line ended with two spaces — render a hard `<br />`. */
  hardBreak: boolean;
}

type Block =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "p"; lines: ParagraphLine[] }
  | { kind: "ul"; items: string[] };

/**
 * A deliberately small Markdown reader for the legal documents.
 *
 * The policies use a narrow slice of Markdown — headings, paragraphs, unordered
 * lists and bold emphasis — so pulling in a full parser (and its sanitisation
 * rules) would add weight without buying anything. Unsupported syntax renders
 * as plain text rather than being silently dropped.
 */
function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: ParagraphLine[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "p", lines: paragraph });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "ul", items: list });
      list = [];
    }
  };

  for (const raw of markdown.split("\n")) {
    if (/^\s*$/.test(raw)) {
      flushParagraph();
      flushList();
      continue;
    }

    if (raw.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h2", text: raw.slice(3).trim() });
      continue;
    }

    if (raw.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "h1", text: raw.slice(2).trim() });
      continue;
    }

    if (raw.startsWith("- ")) {
      flushParagraph();
      list.push(raw.slice(2).trim());
      continue;
    }

    flushList();
    paragraph.push({
      text: raw.replace(/[ \t]+$/, "").trim(),
      hardBreak: / {2}$/.test(raw),
    });
  }

  flushParagraph();
  flushList();
  return blocks;
}

/** Split a line on `**bold**` spans, leaving everything else as plain text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-gray-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part ? <Fragment key={key}>{part}</Fragment> : null;
  });
}

function renderParagraph(lines: ParagraphLine[], key: string) {
  return (
    <p key={key} className="mb-4 last:mb-0">
      {lines.map((line, index) => (
        <Fragment key={`${key}-${index}`}>
          {index > 0 ? (lines[index - 1].hardBreak ? <br /> : " ") : null}
          {renderInline(line.text, `${key}-${index}`)}
        </Fragment>
      ))}
    </p>
  );
}

export function LegalDocument({
  markdown,
  context,
  className,
}: LegalDocumentProps) {
  const blocks = parseBlocks(prepareLegalMarkdown(markdown, context));

  return (
    <article
      className={cn("text-sm leading-relaxed text-gray-700", className)}
    >
      {blocks.map((block, index) => {
        const key = `legal-block-${index}`;

        if (block.kind === "h1") {
          return (
            <h1
              key={key}
              className="mb-6 font-dm-serif text-3xl font-bold text-gray-900 sm:text-4xl"
            >
              {block.text}
            </h1>
          );
        }

        if (block.kind === "h2") {
          return (
            <h2
              key={key}
              className="mt-8 mb-3 font-dm-serif text-xl font-semibold text-gray-900"
            >
              {block.text}
            </h2>
          );
        }

        if (block.kind === "ul") {
          return (
            <ul key={key} className="mb-4 list-disc space-y-2 pl-6">
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${itemIndex}`}>
                  {renderInline(item, `${key}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return renderParagraph(block.lines, key);
      })}
    </article>
  );
}
