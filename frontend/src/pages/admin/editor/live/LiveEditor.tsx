import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { Compartment, EditorSelection, EditorState, Prec, Transaction } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExtension } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { exitEmptyBlock, insertLink, setHeading, toggleWrap } from './commands';
import { assetResolver, focusTracker, focusedField, livePreview } from './livePreview';
import { selectionBubble, slashCommands } from './menus';

export type LiveEditorHandle = { focus: () => void; pickImage: () => void };

type LiveEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onUpload: (file: File) => Promise<string>;
  onUploadError: (message: string) => void;
  resolveAsset: (url: string) => string;
  sourceMode: boolean;
  onToggleSource: () => void;
  placeholder?: string;
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const highlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.link, tags.url], color: 'var(--accent)' },
  { tag: tags.processingInstruction, color: 'var(--text-3)' },
  { tag: tags.quote, color: 'var(--text-2)' },
  { tag: tags.monospace, fontFamily: 'var(--font-mono)' },
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: 'var(--code-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--text-3)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName), tags.definition(tags.function(tags.variableName))], color: 'var(--code-function)' },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--code-type)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--code-property)' },
  { tag: [tags.tagName, tags.meta], color: 'var(--code-tag)' },
]);

/** Insert an image on its own line at `pos`, upload it, then swap the placeholder for the real link. */
async function uploadImages(view: EditorView, files: File[], pos: number, upload: LiveEditorProps['onUpload'], onError: LiveEditorProps['onUploadError']) {
  const images = files.filter((file) => IMAGE_TYPES.has(file.type));
  if (images.length < files.length) onError('仅支持插入 JPG、PNG 或 WebP 图片');
  let at = pos;
  for (const file of images) {
    const token = `![上传中 ${Math.random().toString(36).slice(2, 7)}…]()`;
    const line = view.state.doc.lineAt(at);
    const lead = at > line.from ? '\n' : '';
    const insert = `${lead}${token}\n`;
    view.dispatch({ changes: { from: at, insert }, selection: EditorSelection.cursor(at + insert.length), userEvent: 'input.paste' });
    at += insert.length;
    try {
      const url = await upload(file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '') || '图片';
      const index = view.state.doc.toString().indexOf(token);
      if (index >= 0) view.dispatch({ changes: { from: index, to: index + token.length, insert: `![${alt}](${url})` } });
    } catch (error) {
      const index = view.state.doc.toString().indexOf(token);
      if (index >= 0) view.dispatch({ changes: { from: index, to: Math.min(view.state.doc.length, index + token.length + 1) } });
      onError(error instanceof Error ? error.message : '图片上传失败');
    }
  }
}

export const LiveEditor = forwardRef<LiveEditorHandle, LiveEditorProps>(function LiveEditor(props, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const previewSlot = useRef(new Compartment());
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const pickImage = () => fileRef.current?.click();
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: [
          history(),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': '正文', spellcheck: 'false' }),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          Prec.highest(keymap.of([{ key: 'Enter', run: exitEmptyBlock }])),
          syntaxHighlighting(highlight),
          focusedField,
          focusTracker,
          assetResolver.of((url) => latest.current.resolveAsset(url)),
          previewSlot.current.of(latest.current.sourceMode ? [] : livePreview()),
          selectionBubble,
          autocompletion({ override: [slashCommands(pickImage)], icons: false, activateOnTyping: true }),
          placeholderExtension(latest.current.placeholder ?? ''),
          keymap.of([
            { key: 'Mod-b', run: (v) => toggleWrap(v, '**', '加粗') },
            { key: 'Mod-i', run: (v) => toggleWrap(v, '*', '斜体') },
            { key: 'Mod-e', run: (v) => toggleWrap(v, '`', 'code') },
            { key: 'Mod-k', run: insertLink },
            { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~', '删除') },
            { key: 'Mod-1', run: setHeading(1) },
            { key: 'Mod-2', run: setHeading(2) },
            { key: 'Mod-3', run: setHeading(3) },
            { key: 'Mod-/', run: () => { latest.current.onToggleSource(); return true; } },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !update.transactions.every((tr) => tr.annotation(Transaction.remote))) latest.current.onChange(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            paste: (event, editor) => {
              const files = Array.from(event.clipboardData?.files ?? []);
              if (files.length) {
                event.preventDefault();
                void uploadImages(editor, files, editor.state.selection.main.head, latest.current.onUpload, latest.current.onUploadError);
                return true;
              }
              const text = event.clipboardData?.getData('text/plain').trim() ?? '';
              const range = editor.state.selection.main;
              if (!range.empty && /^https?:\/\/\S+$/.test(text)) {
                event.preventDefault();
                editor.dispatch({ changes: { from: range.from, to: range.to, insert: `[${editor.state.sliceDoc(range.from, range.to)}](${text})` }, userEvent: 'input.paste' });
                return true;
              }
              return false;
            },
            drop: (event, editor) => {
              const files = Array.from(event.dataTransfer?.files ?? []);
              if (!files.length) return false;
              event.preventDefault();
              const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY }) ?? editor.state.selection.main.head;
              void uploadImages(editor, files, pos, latest.current.onUpload, latest.current.onUploadError);
              return true;
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, []);

  // Content replaced from outside (loading a post, restoring a backup) does not go into undo history.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== props.value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: props.value }, annotations: [Transaction.addToHistory.of(false), Transaction.remote.of(true)] });
    }
  }, [props.value]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: previewSlot.current.reconfigure(props.sourceMode ? [] : livePreview()) });
  }, [props.sourceMode]);

  useImperativeHandle(ref, () => ({
    focus: () => { const view = viewRef.current; if (view) { view.focus(); } },
    pickImage: () => fileRef.current?.click(),
  }));

  return (
    <div className={`live-editor ${props.sourceMode ? 'source-mode' : ''}`}>
      <div ref={hostRef} />
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? []);
          event.currentTarget.value = '';
          const view = viewRef.current;
          if (view && files.length) void uploadImages(view, files, view.state.selection.main.head, latest.current.onUpload, latest.current.onUploadError);
        }}
      />
    </div>
  );
});
