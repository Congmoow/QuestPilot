import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { preprocessLatex } from '../utils/latex';

type MarkdownComponentProps = {
  children?: ReactNode;
  href?: string;
  inline?: boolean;
};

const markdownComponents = {
  p: ({ children }: MarkdownComponentProps) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: MarkdownComponentProps) => <ul className="mb-2 list-disc pl-4">{children}</ul>,
  ol: ({ children }: MarkdownComponentProps) => (
    <ol className="mb-2 list-decimal pl-4">{children}</ol>
  ),
  li: ({ children }: MarkdownComponentProps) => <li className="mb-1">{children}</li>,
  code: ({ inline, children }: MarkdownComponentProps) =>
    inline ? (
      <code className="rounded bg-gray-100 px-1 py-0.5 text-sm dark:bg-gray-600">{children}</code>
    ) : (
      <code className="block overflow-x-auto rounded-xl bg-gray-100 p-3 text-sm dark:bg-gray-600">
        {children}
      </code>
    ),
  pre: ({ children }: MarkdownComponentProps) => (
    <pre className="mb-2 overflow-x-auto rounded-xl bg-gray-100 p-3 dark:bg-gray-600">
      {children}
    </pre>
  ),
  table: ({ children }: MarkdownComponentProps) => (
    <table className="my-2 w-full border-collapse border border-gray-200 text-sm dark:border-gray-500">
      {children}
    </table>
  ),
  th: ({ children }: MarkdownComponentProps) => (
    <th className="border border-gray-200 bg-gray-100 px-2 py-1 dark:border-gray-500 dark:bg-gray-600">
      {children}
    </th>
  ),
  td: ({ children }: MarkdownComponentProps) => (
    <td className="border border-gray-200 px-2 py-1 dark:border-gray-500">{children}</td>
  ),
  h1: ({ children }: MarkdownComponentProps) => (
    <h1 className="mb-2 text-xl font-bold">{children}</h1>
  ),
  h2: ({ children }: MarkdownComponentProps) => (
    <h2 className="mb-2 text-lg font-bold">{children}</h2>
  ),
  h3: ({ children }: MarkdownComponentProps) => (
    <h3 className="mb-1 text-base font-bold">{children}</h3>
  ),
  blockquote: ({ children }: MarkdownComponentProps) => (
    <blockquote className="my-2 border-l-4 border-blue-200 pl-3 italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-500" />,
  a: ({ href, children }: MarkdownComponentProps) => (
    <a
      href={href}
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

type MessageRendererProps = {
  content: string;
};

const MessageRenderer = ({ content }: MessageRendererProps) => (
  <div className="prose prose-sm max-w-none dark:prose-invert">
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={markdownComponents}
    >
      {preprocessLatex(content.trim())}
    </ReactMarkdown>
  </div>
);

export default MessageRenderer;
