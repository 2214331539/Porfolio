import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import markedKatex from 'marked-katex-extension';
import 'katex/dist/katex.min.css';
import { apiUrl } from './api/http-client';

const markdown = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
  }),
  { gfm: true, breaks: true },
  markedKatex({ throwOnError: false, nonStandard: true }),
);

export type TocItem = { id: string; text: string; level: 2 | 3 };

export function renderMarkdown(source: string) {
  return DOMPurify.sanitize(markdown.parse(source, { async: false }));
}

const headingSlug = (text: string) => text.trim().toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, '');

/** Rendered article HTML with anchored h2/h3 headings, a table of contents and safe external links. */
export function renderArticle(source: string): { html: string; toc: TocItem[] } {
  const container = new DOMParser().parseFromString(`<div>${renderMarkdown(source)}</div>`, 'text/html').body.firstElementChild as HTMLElement;
  const toc: TocItem[] = [];
  const used = new Map<string, number>();
  container.querySelectorAll<HTMLHeadingElement>('h2, h3').forEach((heading) => {
    const text = heading.textContent?.trim() ?? '';
    const base = headingSlug(text) || 'section';
    const seen = used.get(base) ?? 0;
    used.set(base, seen + 1);
    heading.id = seen ? `${base}-${seen + 1}` : base;
    toc.push({ id: heading.id, text, level: heading.tagName === 'H2' ? 2 : 3 });
  });
  container.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
  const uploadsOrigin = new URL(apiUrl('/'), window.location.origin).origin;
  container.querySelectorAll('img').forEach((image) => {
    image.loading = 'lazy';
    const src = image.getAttribute('src') ?? '';
    if (src.startsWith('/uploads/')) image.src = `${uploadsOrigin}${src}`;
  });
  container.querySelectorAll('table').forEach((table) => {
    const wrapper = table.ownerDocument.createElement('div');
    wrapper.className = 'table-scroll';
    table.replaceWith(wrapper);
    wrapper.append(table);
  });
  return { html: container.innerHTML, toc };
}
