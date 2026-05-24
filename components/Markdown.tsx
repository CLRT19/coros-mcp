"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

/**
 * Tight, chat-friendly Markdown rendering for coach replies. Styled via a
 * component map (no Tailwind typography plugin) so it matches the dark theme.
 * react-markdown sanitizes by default — no raw HTML is rendered.
 */
const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="marker:text-slate-500">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-50">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-coros underline underline-offset-2">
      {children}
    </a>
  ),
  h1: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-50 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-50 first:mt-0">{children}</h3>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-50 first:mt-0">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-ink-500 pl-3 text-slate-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-ink-600" />,
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-ink-900/70 p-3 text-[12px] leading-relaxed">{children}</pre>
  ),
  code: ({ className, children }) => {
    const isBlock = (className || "").includes("language-");
    return isBlock ? (
      <code className="font-mono text-slate-100">{children}</code>
    ) : (
      <code className="rounded bg-ink-900/60 px-1 py-0.5 font-mono text-[12px] text-slate-100">{children}</code>
    );
  },
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-ink-600 px-2 py-1 text-left font-semibold text-slate-200">{children}</th>
  ),
  td: ({ children }) => <td className="border border-ink-600 px-2 py-1 text-slate-300">{children}</td>,
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
