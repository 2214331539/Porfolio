import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { StateField } from '@codemirror/state';
import { showTooltip, type EditorView, type Tooltip } from '@codemirror/view';
import { insertBlock, insertLink, setHeading, toggleQuote, toggleWrap } from './commands';
import { focusedField } from './livePreview';

type SlashItem = { label: string; hint: string; keywords: string; block?: string; cursor?: number; prefix?: string; run?: 'image' };

const SLASH_ITEMS: SlashItem[] = [
  { label: '大标题', hint: '##', keywords: 'h2 heading biaoti 标题', prefix: '## ' },
  { label: '小标题', hint: '###', keywords: 'h3 heading biaoti 标题', prefix: '### ' },
  { label: '无序列表', hint: '-', keywords: 'ul list liebiao 列表', prefix: '- ' },
  { label: '有序列表', hint: '1.', keywords: 'ol list liebiao 列表', prefix: '1. ' },
  { label: '待办', hint: '- [ ]', keywords: 'todo task daiban', prefix: '- [ ] ' },
  { label: '引用', hint: '>', keywords: 'quote yinyong', prefix: '> ' },
  { label: '代码块', hint: '```', keywords: 'code daima', block: '```\n\n```', cursor: 3 },
  { label: '表格', hint: '| |', keywords: 'table biaoge', block: '| 列 1 | 列 2 |\n| --- | --- |\n|  |  |', cursor: 2 },
  { label: '公式', hint: '$$', keywords: 'math latex gongshi', block: '$$\n\n$$', cursor: 3 },
  { label: '分割线', hint: '---', keywords: 'hr divider fengexian', block: '---' },
  { label: '图片', hint: '上传', keywords: 'image img tupian', run: 'image' },
];

/** Typing "/" at the start of a line offers block snippets, Notion-style. */
export function slashCommands(onPickImage: () => void) {
  return (context: CompletionContext): CompletionResult | null => {
    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    const match = /^\s*\/([^\s/]*)$/.exec(before);
    if (!match) return null;
    const query = match[1].toLowerCase();
    const items = SLASH_ITEMS.filter((item) => !query || item.label.includes(query) || item.keywords.includes(query));
    if (!items.length) return null;
    const from = line.from + before.indexOf('/');
    const options: Completion[] = items.map((item) => ({
      label: item.label,
      detail: item.hint,
      apply: (view: EditorView, _completion: Completion, start: number, end: number) => {
        if (item.run === 'image') { view.dispatch({ changes: { from: start, to: end } }); onPickImage(); return; }
        if (item.prefix) { view.dispatch({ changes: { from: start, to: end, insert: item.prefix }, selection: { anchor: start + item.prefix.length } }); return; }
        insertBlock(view, start, end, item.block ?? '', item.cursor);
      },
    }));
    return { from, to: context.pos, options, filter: false };
  };
}

const BUBBLE_ACTIONS: Array<{ label: string; title: string; className?: string; run: (view: EditorView) => boolean }> = [
  { label: 'B', title: '加粗 Ctrl+B', className: 'bold', run: (view) => toggleWrap(view, '**') },
  { label: 'I', title: '斜体 Ctrl+I', className: 'italic', run: (view) => toggleWrap(view, '*') },
  { label: 'S', title: '删除线', className: 'strike', run: (view) => toggleWrap(view, '~~') },
  { label: '代码', title: '行内代码 Ctrl+E', run: (view) => toggleWrap(view, '`') },
  { label: '链接', title: '链接 Ctrl+K', run: insertLink },
  { label: '标题', title: '大标题 Ctrl+2', run: setHeading(2) },
  { label: '引用', title: '引用', run: toggleQuote },
];

function bubbleDom(view: EditorView) {
  const dom = document.createElement('div');
  dom.className = 'cm-bubble';
  for (const action of BUBBLE_ACTIONS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = action.label;
    button.title = action.title;
    if (action.className) button.classList.add(action.className);
    button.addEventListener('mousedown', (event) => { event.preventDefault(); action.run(view); });
    dom.append(button);
  }
  return dom;
}

/** A small formatting toolbar above any non-empty selection. */
export const selectionBubble = StateField.define<Tooltip | null>({
  create: () => null,
  update(tooltip, tr) {
    if (!tr.docChanged && !tr.selection && tr.state.field(focusedField) === tr.startState.field(focusedField)) return tooltip;
    const range = tr.state.selection.main;
    if (range.empty || tr.state.selection.ranges.length > 1 || !tr.state.field(focusedField)) return null;
    if (tooltip && tooltip.pos === range.from) return tooltip;
    return { pos: range.from, end: range.to, above: true, arrow: false, create: (view) => ({ dom: bubbleDom(view) }) };
  },
  provide: (field) => showTooltip.from(field),
});
