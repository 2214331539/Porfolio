import DOMPurify from 'dompurify';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';

const markdown = new Marked(
  {
    gfm: true,
    breaks: true,
  },
  markedKatex({
    throwOnError: false,
    nonStandard: true,
  }),
);

export function renderMarkdown(source: string) {
  const html = markdown.parse(source, { async: false });
  return DOMPurify.sanitize(html);
}
