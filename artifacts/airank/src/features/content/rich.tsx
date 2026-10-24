import { useEffect, useRef } from 'react';
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';
import { marked } from 'marked';
import { Bold, Code, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Quote, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { findRawHtml, sanitizeHtml, useTx } from './ui';

/** html:false so raw HTML is never silently re-emitted; lossy cases are detected by round-trip instead. */
const extensions = () => [
  StarterKit,
  Link.configure({ openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
  Image,
  Table.configure({ resizable: false }), TableRow, TableHeader, TableCell,
  Markdown.configure({ html: false, tightLists: true, bulletListMarker: '-', linkify: false, breaks: false }),
];
const norm = (md: string) => sanitizeHtml(marked.parse(md, { gfm: true, async: false }) as string).replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
const mdOf = (e: Editor): string => (e.storage as any).markdown.getMarkdown();

/** Loss-aware gate: rich mode is only offered when Markdown -> rich -> Markdown keeps the rendered meaning. */
export function richRoundTrip(markdown: string): { ok: boolean; reason: 'html' | 'changed' | null; output: string } {
  if (findRawHtml(markdown).length) return { ok: false, reason: 'html', output: markdown };
  const el = document.createElement('div');
  const ed = new Editor({ element: el, extensions: extensions(), content: markdown });
  try {
    const out = mdOf(ed);
    if (findRawHtml(out).length) return { ok: false, reason: 'html', output: out };
    return { ok: norm(out) === norm(markdown), reason: norm(out) === norm(markdown) ? null : 'changed', output: out };
  } catch { return { ok: false, reason: 'changed', output: markdown }; }
  finally { ed.destroy(); }
}

export function RichEditor({ value, onChange, onLossy, readOnly, label }: { value: string; onChange: (md: string) => void; onLossy: () => void; readOnly: boolean; label: string }) {
  const tx = useTx();
  const emitted = useRef(value);
  const cb = useRef({ onChange, onLossy }); cb.current = { onChange, onLossy };
  const editor = useEditor({
    extensions: extensions(), content: value, editable: !readOnly,
    editorProps: { attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true', class: 'ar-md min-h-[480px] p-4 text-[15px] leading-7 text-ink focus:outline-none [&_a]:text-link [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-canvas [&_h1]:text-[26px] [&_h1]:font-semibold [&_h2]:mt-5 [&_h2]:text-[20px] [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-[17px] [&_h3]:font-semibold [&_img]:max-w-full [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-line [&_td]:p-2 [&_th]:border [&_th]:border-line [&_th]:bg-canvas [&_th]:p-2 [&_ul]:list-disc' } },
    onUpdate: ({ editor: e }) => {
      const md = mdOf(e);
      if (findRawHtml(md).length > findRawHtml(emitted.current).length) { cb.current.onLossy(); e.commands.setContent(emitted.current, false); return; }
      emitted.current = md; cb.current.onChange(md);
    },
  });
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => { if (editor && value !== emitted.current) { emitted.current = value; editor.commands.setContent(value, false); } }, [editor, value]);
  if (!editor) return null;
  const c = () => editor.chain().focus();
  const link = () => { const u = window.prompt(tx('Link address (https://)', 'Linkin osoite (https://)'), 'https://'); if (u === null) return; if (!u || u === 'https://') c().unsetLink().run(); else if (/^https:\/\//i.test(u)) c().setLink({ href: u }).run(); };
  const img = () => { const u = window.prompt(tx('Image address (https://)', 'Kuvan osoite (https://)'), 'https://'); if (u && /^https:\/\//i.test(u)) c().setImage({ src: u, alt: window.prompt(tx('Image description', 'Kuvan kuvaus')) ?? '' }).run(); };
  const tools: [string, React.JSX.Element, () => void, boolean][] = [
    [tx('Heading 2', 'Otsikko 2'), <Heading2 key="a" />, () => c().toggleHeading({ level: 2 }).run(), editor.isActive('heading', { level: 2 })],
    [tx('Heading 3', 'Otsikko 3'), <Heading3 key="b" />, () => c().toggleHeading({ level: 3 }).run(), editor.isActive('heading', { level: 3 })],
    [tx('Bold', 'Lihavointi'), <Bold key="c" />, () => c().toggleBold().run(), editor.isActive('bold')],
    [tx('Italic', 'Kursiivi'), <Italic key="d" />, () => c().toggleItalic().run(), editor.isActive('italic')],
    [tx('Code', 'Koodi'), <Code key="e" />, () => c().toggleCode().run(), editor.isActive('code')],
    [tx('Link', 'Linkki'), <Link2 key="f" />, link, editor.isActive('link')],
    [tx('Image', 'Kuva'), <ImageIcon key="g" />, img, false],
    [tx('Bullet list', 'Luettelo'), <List key="h" />, () => c().toggleBulletList().run(), editor.isActive('bulletList')],
    [tx('Numbered list', 'Numeroitu luettelo'), <ListOrdered key="i" />, () => c().toggleOrderedList().run(), editor.isActive('orderedList')],
    [tx('Quote', 'Lainaus'), <Quote key="j" />, () => c().toggleBlockquote().run(), editor.isActive('blockquote')],
    [tx('Insert table', 'Lisää taulukko'), <Table2 key="k" />, () => c().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), false],
  ];
  const inTable = editor.isActive('table');
  return (
    <div>
      {!readOnly && <div role="toolbar" aria-label={tx('Formatting', 'Muotoilu')} className="flex flex-wrap gap-1 border-b border-line p-1.5">
        {tools.map(([l, ic, fn, on]) => <Button key={l} type="button" size="icon" variant={on ? 'secondary' : 'ghost'} aria-pressed={on} aria-label={l} title={l} onClick={fn} className="size-9 [&_svg]:size-4">{ic}</Button>)}
        {inTable && <>
          <Button type="button" size="sm" variant="ghost" onClick={() => c().addRowAfter().run()}>{tx('+ Row', '+ Rivi')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => c().addColumnAfter().run()}>{tx('+ Column', '+ Sarake')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => c().deleteRow().run()}>{tx('− Row', '− Rivi')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => c().deleteColumn().run()}>{tx('− Column', '− Sarake')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => c().deleteTable().run()}>{tx('Delete table', 'Poista taulukko')}</Button>
        </>}
      </div>}
      <EditorContent editor={editor} />
    </div>
  );
}
