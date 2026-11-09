import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

/** Wrap each selection in `mark` (or unwrap it when it is already wrapped). */
export function toggleWrap(view: EditorView, mark: string, placeholder = '') {
  const { state } = view;
  view.dispatch(state.changeByRange((range) => {
    const before = state.sliceDoc(range.from - mark.length, range.from);
    const after = state.sliceDoc(range.to, range.to + mark.length);
    if (before === mark && after === mark) {
      return {
        changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }],
        range: EditorSelection.range(range.from - mark.length, range.to - mark.length),
      };
    }
    const selected = state.sliceDoc(range.from, range.to);
    if (selected.length > mark.length * 2 && selected.startsWith(mark) && selected.endsWith(mark)) {
      const inner = selected.slice(mark.length, -mark.length);
      return { changes: { from: range.from, to: range.to, insert: inner }, range: EditorSelection.range(range.from, range.from + inner.length) };
    }
    const text = selected || placeholder;
    return {
      changes: { from: range.from, to: range.to, insert: `${mark}${text}${mark}` },
      range: EditorSelection.range(range.from + mark.length, range.from + mark.length + text.length),
    };
  }), { userEvent: 'input.format' });
  view.focus();
  return true;
}

function selectedLineNumbers(view: EditorView) {
  const { state } = view;
  const numbers = new Set<number>();
  for (const range of state.selection.ranges) {
    const last = state.doc.lineAt(range.to).number;
    for (let number = state.doc.lineAt(range.from).number; number <= last; number++) numbers.add(number);
  }
  return [...numbers];
}

/** Toggle a block prefix (heading, quote, list) on every selected line. */
export function toggleLinePrefix(view: EditorView, prefix: (index: number) => string, active: RegExp, strip: RegExp) {
  const { state } = view;
  const numbers = selectedLineNumbers(view);
  const allActive = numbers.every((number) => active.test(state.doc.line(number).text));
  const changes = numbers.map((number, index) => {
    const line = state.doc.line(number);
    const existing = strip.exec(line.text)?.[0].length ?? 0;
    return { from: line.from, to: line.from + existing, insert: allActive ? '' : prefix(index) };
  });
  view.dispatch({ changes, userEvent: 'input.format' });
  view.focus();
  return true;
}

const HEADING = /^#{1,6}\s+/;
export const setHeading = (level: number) => (view: EditorView) => toggleLinePrefix(view, () => `${'#'.repeat(level)} `, new RegExp(`^#{${level}}\\s`), HEADING);
export const toggleQuote = (view: EditorView) => toggleLinePrefix(view, () => '> ', /^>\s?/, /^>\s?/);
export const toggleBullet = (view: EditorView) => toggleLinePrefix(view, () => '- ', /^\s*[-*+]\s+(?!\[)/, /^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/);
export const toggleOrdered = (view: EditorView) => toggleLinePrefix(view, (index) => `${index + 1}. `, /^\s*\d+\.\s+/, /^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/);
export const toggleTask = (view: EditorView) => toggleLinePrefix(view, () => '- [ ] ', /^\s*[-*+]\s+\[[ xX]\]\s+/, /^\s*([-*+]\s+(\[[ xX]\]\s+)?|\d+\.\s+)/);

export function insertLink(view: EditorView) {
  const range = view.state.selection.main;
  const text = view.state.sliceDoc(range.from, range.to) || '链接文字';
  const insert = `[${text}](https://)`;
  const urlStart = range.from + text.length + 3;
  view.dispatch({ changes: { from: range.from, to: range.to, insert }, selection: EditorSelection.range(urlStart, urlStart + 8), userEvent: 'input.format' });
  view.focus();
  return true;
}

/** Replace `from..to` with a block of text that sits on its own lines; `cursor` is an offset inside `block`. */
export function insertBlock(view: EditorView, from: number, to: number, block: string, cursor = block.length) {
  const { state } = view;
  const line = state.doc.lineAt(from);
  const before = state.sliceDoc(line.from, from).trim() ? '\n' : '';
  const nextLine = to < state.doc.length ? state.doc.lineAt(to + 1) : null;
  const after = to === state.doc.lineAt(to).to && nextLine && nextLine.text.trim() ? '\n' : '';
  const insert = `${before}${block}${after}`;
  view.dispatch({ changes: { from, to, insert }, selection: EditorSelection.cursor(from + before.length + cursor), userEvent: 'input' });
  view.focus();
  return true;
}

/**
 * Enter on an empty list item or quote line leaves the block with a blank line in between,
 * so the next paragraph is not swallowed into the list (Markdown lazy continuation).
 */
export function exitEmptyBlock(view: EditorView) {
  const { state } = view;
  const range = state.selection.main;
  if (!range.empty) return false;
  const line = state.doc.lineAt(range.head);
  if (range.head !== line.to || !/^(?:[-*+]|\d+[.)])(?: \[[ xX]\])?\s*$|^>\s*$/.test(line.text)) return false;
  view.dispatch({ changes: { from: line.from, to: line.to, insert: '\n' }, selection: EditorSelection.cursor(line.from + 1), userEvent: 'input' });
  return true;
}
