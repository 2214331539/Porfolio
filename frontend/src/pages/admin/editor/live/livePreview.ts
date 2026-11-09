import { syntaxTree } from '@codemirror/language';
import { Facet, StateEffect, StateField, type EditorState, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import katex from 'katex';
import { renderMarkdown } from '../../../../shared/markdown';

/**
 * Typora-style live preview. The document stays plain Markdown; decorations hide the syntax
 * and render elements, except where the selection is, so the source shows up while editing it.
 */

export const setFocused = StateEffect.define<boolean>();
export const focusedField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => tr.effects.reduce((current, effect) => effect.is(setFocused) ? effect.value : current, value),
});
export const focusTracker = EditorView.domEventHandlers({
  focus: (_event, view) => { if (!view.state.field(focusedField)) view.dispatch({ effects: setFocused.of(true) }); },
  blur: (_event, view) => { window.setTimeout(() => { if (!view.hasFocus && view.state.field(focusedField, false)) view.dispatch({ effects: setFocused.of(false) }); }, 0); },
});

/** Turns stored image paths (e.g. `/uploads/…`) into URLs the browser can load. */
export const assetResolver = Facet.define<(url: string) => string, (url: string) => string>({ combine: (values) => values[0] ?? ((url) => url) });

class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) { super(); }
  eq(other: ImageWidget) { return other.src === this.src && other.alt === this.alt; }
  toDOM(view: EditorView) {
    const wrap = document.createElement('span');
    wrap.className = 'cm-lp-image';
    const image = document.createElement('img');
    image.src = this.src;
    image.alt = this.alt;
    image.onload = () => view.requestMeasure();
    image.onerror = () => { wrap.classList.add('broken'); wrap.textContent = `图片无法加载：${this.alt || this.src}`; view.requestMeasure(); };
    wrap.append(image);
    return wrap;
  }
  ignoreEvent() { return false; }
}

class BulletWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const span = document.createElement('span'); span.className = 'cm-lp-bullet'; span.textContent = '•'; return span; }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean, readonly pos: number) { super(); }
  eq(other: CheckboxWidget) { return other.checked === this.checked && other.pos === this.pos; }
  toDOM(view: EditorView) {
    const box = document.createElement('span');
    box.className = `cm-lp-check ${this.checked ? 'checked' : ''}`;
    box.setAttribute('role', 'checkbox');
    box.setAttribute('aria-checked', String(this.checked));
    box.addEventListener('mousedown', (event) => {
      event.preventDefault();
      view.dispatch({ changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? ' ' : 'x' } });
    });
    return box;
  }
  ignoreEvent() { return true; }
}

class RuleWidget extends WidgetType {
  eq() { return true; }
  toDOM() { const span = document.createElement('span'); span.className = 'cm-lp-hr'; return span; }
}

class FenceWidget extends WidgetType {
  constructor(readonly language: string) { super(); }
  eq(other: FenceWidget) { return other.language === this.language; }
  toDOM() { const span = document.createElement('span'); span.className = 'cm-lp-fence-label'; span.textContent = this.language; return span; }
  ignoreEvent() { return false; }
}

class MathWidget extends WidgetType {
  constructor(readonly tex: string, readonly display: boolean) { super(); }
  eq(other: MathWidget) { return other.tex === this.tex && other.display === this.display; }
  toDOM() {
    const element = document.createElement(this.display ? 'div' : 'span');
    element.className = this.display ? 'cm-lp-math-block' : 'cm-lp-math';
    element.innerHTML = katex.renderToString(this.tex, { throwOnError: false, displayMode: this.display });
    return element;
  }
  ignoreEvent() { return false; }
}

class TableWidget extends WidgetType {
  constructor(readonly source: string) { super(); }
  eq(other: TableWidget) { return other.source === this.source; }
  toDOM() {
    const element = document.createElement('div');
    element.className = 'cm-lp-table prose';
    element.innerHTML = renderMarkdown(this.source);
    return element;
  }
  ignoreEvent() { return false; }
}

const FENCE_LINE = /^\s*(`{3,}|~{3,})\s*$/;
const INLINE_MATH = /(?<![\\$])\$(?![\s$])([^$\n]+?)(?<!\s)\$(?!\$)/g;

function buildDecorations(state: EditorState): DecorationSet {
  const focused = state.field(focusedField);
  const resolve = state.facet(assetResolver);
  const ranges = state.selection.ranges;
  const doc = state.doc;
  const touches = (from: number, to: number) => focused && ranges.some((range) => range.from <= to && range.to >= from);
  const linesTouch = (from: number, to: number) => touches(doc.lineAt(from).from, doc.lineAt(to).to);
  const out: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => { if (to > from) out.push(Decoration.replace({}).range(from, to)); };
  const mark = (className: string, from: number, to: number) => { if (to > from) out.push(Decoration.mark({ class: className }).range(from, to)); };
  const lineClass = (className: string, pos: number) => out.push(Decoration.line({ class: className }).range(doc.lineAt(pos).from));
  const eachLine = (from: number, to: number, fn: (line: { from: number; to: number; number: number; text: string }) => void) => {
    for (let number = doc.lineAt(from).number, last = doc.lineAt(to).number; number <= last; number++) fn(doc.line(number));
  };
  const tree = syntaxTree(state);

  // Code never contains math or other inline syntax, so collect it first.
  const code: Array<[number, number]> = [];
  tree.iterate({ enter: (node) => { if (['FencedCode', 'CodeBlock', 'InlineCode', 'HTMLBlock'].includes(node.name)) { code.push([node.from, node.to]); return false; } return undefined; } });
  const inCode = (from: number, to = from) => code.some(([a, b]) => from < b && to > a);

  // Math: $$ blocks and inline $…$, rendered with KaTeX when the cursor is elsewhere.
  const replaced: Array<[number, number]> = [];
  for (let number = 1; number <= doc.lines; number++) {
    const line = doc.line(number);
    if (inCode(line.from, line.to)) continue;
    const trimmed = line.text.trim();
    if (trimmed === '$$') {
      let end = number + 1;
      while (end <= doc.lines && doc.line(end).text.trim() !== '$$') end++;
      if (end > doc.lines) continue;
      const last = doc.line(end);
      const tex = doc.sliceString(line.to + 1, Math.max(line.to + 1, last.from - 1));
      if (linesTouch(line.from, last.to)) eachLine(line.from, last.to, (item) => lineClass('cm-lp-math-src', item.from));
      else { out.push(Decoration.replace({ widget: new MathWidget(tex, true), block: true }).range(line.from, last.to)); replaced.push([line.from, last.to]); }
      number = end;
      continue;
    }
    const single = /^\$\$(.+)\$\$$/.exec(trimmed);
    if (single) {
      if (linesTouch(line.from, line.to)) lineClass('cm-lp-math-src', line.from);
      else { out.push(Decoration.replace({ widget: new MathWidget(single[1], true), block: true }).range(line.from, line.to)); replaced.push([line.from, line.to]); }
      continue;
    }
    for (const match of line.text.matchAll(INLINE_MATH)) {
      const from = line.from + (match.index ?? 0);
      const to = from + match[0].length;
      if (inCode(from, to)) continue;
      if (touches(from, to)) mark('cm-lp-math-src', from, to);
      else { out.push(Decoration.replace({ widget: new MathWidget(match[1], false) }).range(from, to)); replaced.push([from, to]); }
    }
  }
  const insideReplaced = (from: number, to: number) => replaced.some(([a, b]) => from >= a && to <= b);

  tree.iterate({
    enter: (ref) => {
      const { name, from, to } = ref;
      if (name !== 'Document' && name !== 'Paragraph' && insideReplaced(from, to)) return false;
      const parent = ref.node.parent;
      switch (name) {
        case 'ATXHeading1': case 'ATXHeading2': case 'ATXHeading3': case 'ATXHeading4': case 'ATXHeading5': case 'ATXHeading6':
          lineClass(`cm-lp-h cm-lp-h${name.slice(-1)}`, from);
          return undefined;
        case 'SetextHeading1': case 'SetextHeading2':
          eachLine(from, to, (line) => lineClass(`cm-lp-h cm-lp-h${name.slice(-1)}`, line.from));
          return undefined;
        case 'HeaderMark': {
          if (!parent?.name.startsWith('ATXHeading') || linesTouch(parent.from, parent.to)) { mark('cm-lp-mark', from, to); return undefined; }
          const atStart = from === doc.lineAt(from).from;
          if (atStart) hide(from, state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to);
          else hide(state.sliceDoc(from - 1, from) === ' ' ? from - 1 : from, to);
          return undefined;
        }
        case 'Emphasis': mark('cm-lp-em', from, to); return undefined;
        case 'StrongEmphasis': mark('cm-lp-strong', from, to); return undefined;
        case 'Strikethrough': mark('cm-lp-strike', from, to); return undefined;
        case 'InlineCode': mark('cm-lp-code', from, to); return undefined;
        case 'EmphasisMark': case 'StrikethroughMark':
          if (parent && touches(parent.from, parent.to)) mark('cm-lp-mark', from, to); else hide(from, to);
          return undefined;
        case 'CodeMark':
          if (parent?.name === 'InlineCode') { if (touches(parent.from, parent.to)) mark('cm-lp-mark', from, to); else hide(from, to); }
          else mark('cm-lp-mark', from, to);
          return undefined;
        case 'CodeInfo': mark('cm-lp-code-info', from, to); return undefined;
        case 'Link': {
          const marks = ref.node.getChildren('LinkMark');
          if (touches(from, to) || marks.length < 2) return undefined;
          hide(marks[0].from, marks[0].to);
          mark('cm-lp-link', marks[0].to, marks[1].from);
          hide(marks[1].from, to);
          return false;
        }
        case 'Image': {
          const url = ref.node.getChild('URL');
          const marks = ref.node.getChildren('LinkMark');
          if (!url) return undefined;
          const widget = new ImageWidget(resolve(state.sliceDoc(url.from, url.to)), marks.length >= 2 ? state.sliceDoc(marks[0].to, marks[1].from) : '');
          if (touches(from, to)) { mark('cm-lp-image-src', from, to); out.push(Decoration.widget({ widget, side: 1 }).range(to)); }
          else out.push(Decoration.replace({ widget }).range(from, to));
          return false;
        }
        case 'URL':
          mark(parent?.name === 'Link' || parent?.name === 'Image' ? 'cm-lp-url' : 'cm-lp-link', from, to);
          return undefined;
        case 'LinkMark': mark('cm-lp-mark', from, to); return undefined;
        case 'Blockquote':
          eachLine(from, to, (line) => lineClass('cm-lp-quote', line.from));
          return undefined;
        case 'QuoteMark':
          if (linesTouch(from, to)) mark('cm-lp-mark', from, to);
          else hide(from, state.sliceDoc(to, to + 1) === ' ' ? to + 1 : to);
          return undefined;
        case 'ListMark': {
          const task = parent?.getChild('Task');
          const active = linesTouch(from, to);
          if (parent?.parent?.name !== 'BulletList') { mark('cm-lp-ordered', from, to); return undefined; }
          if (active) mark('cm-lp-mark', from, to);
          else if (task) hide(from, task.from);
          else out.push(Decoration.replace({ widget: new BulletWidget() }).range(from, to));
          return undefined;
        }
        case 'TaskMarker': {
          const checked = /x/i.test(state.sliceDoc(from, to));
          out.push(Decoration.replace({ widget: new CheckboxWidget(checked, from) }).range(from, to));
          if (checked) mark('cm-lp-done', to, doc.lineAt(to).to);
          return undefined;
        }
        case 'HorizontalRule':
          if (linesTouch(from, to)) mark('cm-lp-mark', from, to);
          else out.push(Decoration.replace({ widget: new RuleWidget() }).range(from, to));
          return undefined;
        case 'FencedCode': {
          const active = linesTouch(from, to);
          const first = doc.lineAt(from);
          const last = doc.lineAt(to);
          const closed = last.number > first.number && FENCE_LINE.test(last.text);
          eachLine(from, to, (line) => {
            const classes = ['cm-lp-codeblock'];
            if (line.number === first.number) classes.push('cm-lp-codeblock-first');
            if (line.number === last.number) classes.push('cm-lp-codeblock-last');
            if (!active && (line.number === first.number || (closed && line.number === last.number))) classes.push('cm-lp-fence');
            lineClass(classes.join(' '), line.from);
          });
          if (active) return undefined;
          const info = ref.node.getChild('CodeInfo');
          out.push(Decoration.replace({ widget: new FenceWidget(info ? state.sliceDoc(info.from, info.to) : '') }).range(first.from, first.to));
          if (closed) hide(last.from, last.to);
          return false;
        }
        case 'CodeBlock':
          eachLine(from, to, (line) => lineClass('cm-lp-codeblock cm-lp-indented', line.from));
          return false;
        case 'Table': {
          const first = doc.lineAt(from);
          const last = doc.lineAt(to);
          if (linesTouch(from, to)) { eachLine(from, to, (line) => lineClass('cm-lp-table-src', line.from)); return false; }
          out.push(Decoration.replace({ widget: new TableWidget(state.sliceDoc(first.from, last.to)), block: true }).range(first.from, last.to));
          return false;
        }
        default:
          return undefined;
      }
    },
  });
  return Decoration.set(out, true);
}

const livePreviewField = StateField.define<DecorationSet>({
  create: buildDecorations,
  update(decorations, tr) {
    const focusChanged = tr.effects.some((effect) => effect.is(setFocused));
    if (tr.docChanged || tr.selection || focusChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)) return buildDecorations(tr.state);
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export function livePreview(): Extension {
  return livePreviewField;
}
