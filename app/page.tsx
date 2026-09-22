"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Bold, BookOpen, Check, ChevronDown, FileText, FolderPlus, Italic, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Strikethrough, Trash2, Type, Underline, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Source = { id: string; title: string; url: string; excerpt: string };
type Note = { id: string; folder: string; title: string; body: string; updatedAt: number; createdAt: number; keystrokes: number; revisions: number; sources: Source[]; archived?: boolean };
const now = Date.now();
const seedNotes: Note[] = [
  { id: "manifesto", folder: "Essays", title: "A small defense of making", body: "A blank page is not empty. It contains the possibility of a thought becoming language, slowly and imperfectly.\n\nWriting is more than the arrangement of finished sentences. It is hesitation, deletion, return—the private movement by which an idea becomes one's own.\n\nThis page was made without generated language. The sources beside it informed the work, but did not write it.", updatedAt: now, createdAt: now - 432000000, keystrokes: 684, revisions: 17, sources: [
    { id: "source-1", title: "The Craft of Thought", url: "https://example.com/craft", excerpt: "Writing is not the transcription of thought, but one of the places in which thought occurs." },
    { id: "source-2", title: "Notebook clipping", url: "", excerpt: "What is lost when the finished object is separated from the record of its making?" },
  ] },
  { id: "notes-on-looking", folder: "Essays", title: "Notes on looking", body: "Looking takes time. Recognition is faster, but it is not the same thing.", updatedAt: now - 3120000, createdAt: now - 1036800000, keystrokes: 94, revisions: 4, sources: [] },
  { id: "fragments", folder: "Fragments", title: "On memory", body: "Memory edits in silence.", updatedAt: now - 100800000, createdAt: now - 1728000000, keystrokes: 31, revisions: 2, sources: [] },
];
const STORAGE_KEY = "memopad-prototype-v1";
const FONT_KEY = "memopad-font-pref";
const words = (s: string) => s.trim() ? s.trim().split(/\s+/).length : 0;
function relativeTime(ts: number) { const m = Math.floor((Date.now() - ts) / 60000); if (m < 1) return "now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`; }
function fullDate(ts: number) { return new Date(ts).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }); }
function shortDate(ts: number) { return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

type ExportFormat = "html" | "txt" | "md";
type FontPref = "serif" | "sans";
type View = "list" | "editor";

export default function Home() {
  const [notes, setNotes] = useState<Note[]>(seedNotes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [pasteNotice, setPasteNotice] = useState(false);
  const [query, setQuery] = useState("");
  const [sourceDraft, setSourceDraft] = useState({ title: "", url: "", excerpt: "" });
  const [sourcesPanelOpen, setSourcesPanelOpen] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("html");
  const [fontPref, setFontPref] = useState<FontPref>("serif");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [folderMenu, setFolderMenu] = useState<string | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ folder: string; name: string } | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const loaded = useRef(false);
  const [mounted, setMounted] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Persistence ---
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try {
      const data = JSON.parse(saved) as { notes: Note[]; selectedId: string };
      if (data.notes?.length) { setNotes(data.notes.map((n: Record<string, unknown>) => ({ ...n } as Note))); }
    } catch {}
    const sf = localStorage.getItem(FONT_KEY);
    if (sf === "serif" || sf === "sans") setFontPref(sf);
    loaded.current = true; setMounted(true);
  }, []);
  useEffect(() => { if (loaded.current) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, selectedId })); setJustSaved(true); if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTimerRef.current = setTimeout(() => setJustSaved(false), 1500); } }, [notes, selectedId]);
  useEffect(() => { if (loaded.current) localStorage.setItem(FONT_KEY, fontPref); }, [fontPref]);

  // --- Derived ---
  const activeNotes = useMemo(() => notes.filter(n => !n.archived), [notes]);
  const archivedNotes = useMemo(() => notes.filter(n => n.archived), [notes]);
  const displayedNotes = showArchive ? archivedNotes : activeNotes;
  const folders = useMemo(() => Array.from(new Set(displayedNotes.map(n => n.folder))).sort(), [displayedNotes]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? displayedNotes.filter(n => `${n.title} ${n.body} ${n.folder}`.toLowerCase().includes(q)) : displayedNotes;
  }, [displayedNotes, query]);

  const selected = notes.find(n => n.id === selectedId) ?? null;

  // --- Actions ---
  const patchNote = (patch: Partial<Note>) => { if (!selectedId) return; setNotes(cur => cur.map(n => n.id === selectedId ? { ...n, ...patch } : n)); };
  const updateText = (field: "title" | "body", value: string) => { if (!selected) return; const prev = selected[field] || ""; const added = Math.max(0, value.length - prev.length); patchNote({ [field]: value, updatedAt: Date.now(), keystrokes: selected.keystrokes + added, revisions: selected.revisions + 1 }); };
  const blockPaste = (e: React.ClipboardEvent) => { e.preventDefault(); setPasteNotice(true); setTimeout(() => setPasteNotice(false), 3200); };
  const openNote = (id: string) => { setSelectedId(id); setView("editor"); setSourcesPanelOpen(false); };
  const createNote = (folder = "Essays") => { const id = crypto.randomUUID(); const note: Note = { id, folder, title: "Untitled", body: "", createdAt: Date.now(), updatedAt: Date.now(), keystrokes: 0, revisions: 0, sources: [] }; setNotes(cur => [note, ...cur]); openNote(id); if (showArchive) setShowArchive(false); };
  const createFolder = () => { setNewFolderName(""); setNewFolderDialog(true); };
  const confirmCreateFolder = () => { if (newFolderName.trim()) createNote(newFolderName.trim()); setNewFolderDialog(false); };
  const addSource = () => { if (!sourceDraft.excerpt.trim() && !sourceDraft.url.trim()) return; patchNote({ sources: [...(selected?.sources ?? []), { ...sourceDraft, id: crypto.randomUUID(), title: sourceDraft.title || "Untitled source" }], updatedAt: Date.now() }); setSourceDraft({ title: "", url: "", excerpt: "" }); setSourceOpen(false); };
  const toggleArchive = (noteId: string) => { setNotes(cur => cur.map(n => n.id === noteId ? { ...n, archived: !n.archived, updatedAt: Date.now() } : n)); };
  const deleteNote = (noteId: string) => setDeleteTarget(noteId);
  const confirmDelete = () => { if (!deleteTarget) return; setNotes(cur => cur.filter(n => n.id !== deleteTarget)); if (deleteTarget === selectedId) { setView("list"); setSelectedId(null); } setDeleteTarget(null); };
  const renameFolder = (old: string) => { setRenameDialog({ folder: old, name: old }); setFolderMenu(null); };
  const confirmRenameFolder = () => { if (renameDialog && renameDialog.name.trim() && renameDialog.name.trim() !== renameDialog.folder) setNotes(cur => cur.map(n => n.folder === renameDialog.folder ? { ...n, folder: renameDialog.name.trim() } : n)); setRenameDialog(null); };
  const deleteFolder = (name: string) => { setDeleteTarget(`folder:${name}:${notes.filter(n => n.folder === name).length}`); setFolderMenu(null); };
  const confirmDeleteFolder = (name: string) => { setNotes(cur => cur.filter(n => n.folder !== name)); if (selected && selected.folder === name) { setView("list"); setSelectedId(null); } setDeleteTarget(null); };

  // --- Editor helpers ---
  const autoResizeTitle = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  useEffect(() => { if (titleRef.current && view === "editor") autoResizeTitle(titleRef.current); }, [selectedId, selected?.title, view]);
  const applyFormat = (cmd: string) => { document.execCommand(cmd, false); };
  const handleBodyInput = () => { if (!bodyRef.current || !selected) return; const text = bodyRef.current.innerText; const added = Math.max(0, text.length - (selected.body || "").length); patchNote({ body: text, updatedAt: Date.now(), keystrokes: selected.keystrokes + added, revisions: selected.revisions + 1 }); };
  useEffect(() => { if (bodyRef.current && selected && bodyRef.current.innerText !== selected.body) bodyRef.current.innerText = selected.body; }, [selectedId]);

  useEffect(() => { if (!folderMenu) return; const close = () => setFolderMenu(null); window.addEventListener("click", close); return () => window.removeEventListener("click", close); }, [folderMenu]);

  const fontFamily = fontPref === "serif" ? "var(--font-literata), Georgia, serif" : "'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  // --- Export ---
  const exportDocument = () => {
    if (!selected) return;
    const escape = (v: string) => v.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
    const dateStr = shortDate(selected.updatedAt);
    let blob: Blob; let ext: string;
    if (exportFormat === "txt") {
      blob = new Blob([`${selected.title}\n${"=".repeat(selected.title.length)}\n${dateStr}\n\n${selected.body}\n\n---\nWritten in memopad · ${words(selected.body)} words · ${selected.revisions} revisions · ${selected.sources.length} sources\nExported ${shortDate(Date.now())}`], { type: "text/plain" }); ext = "txt";
    } else if (exportFormat === "md") {
      const src = selected.sources.length ? `\n\n## Sources\n\n${selected.sources.map((s, i) => `${i + 1}. **${s.title}**${s.url ? ` — [${s.url.replace(/^https?:\/\//, "")}](${s.url})` : ""}\n   > ${s.excerpt}`).join("\n\n")}` : "";
      blob = new Blob([`# ${selected.title}\n\n${dateStr}\n\n${selected.body}${src}\n\n---\n\n*Written in memopad* · ${words(selected.body)} words · ${selected.revisions} revisions · Exported ${shortDate(Date.now())}`], { type: "text/markdown" }); ext = "md";
    } else {
      const ps = selected.body.split(/\n\n+/).map(p => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");
      const ef = fontPref === "serif" ? "Georgia,serif" : "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
      blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(selected.title)}</title><style>body{max-width:700px;margin:70px auto;padding:0 28px;color:#20201e;font:18px/1.85 ${ef}}h1{font-size:42px;line-height:1.1;letter-spacing:-.04em}.date{color:#999;font-size:14px;margin:0 0 32px}.mark{display:flex;align-items:center;gap:12px;margin-top:60px;padding-top:22px;border-top:1px solid #ddd;font:13px/1.4 sans-serif}.m{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;color:white;background:#BD1B2A;font:bold 18px Georgia}.mark small{display:block;color:#777}.record{margin-top:18px;color:#666;font:12px/1.6 sans-serif}</style></head><body><h1>${escape(selected.title)}</h1><p class="date">${escape(dateStr)}</p>${ps}<div class="mark"><span class="m">m</span><div><strong>Written in memopad</strong><small>Composed locally</small></div></div><div class="record">${words(selected.body)} words · ${selected.revisions} revisions · ${selected.sources.length} sources · Exported ${shortDate(Date.now())}</div></body></html>`], { type: "text/html" }); ext = "html";
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${selected.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "memopad"}.${ext}`; a.click(); URL.revokeObjectURL(a.href); setPublished(true);
  };

  // --- MCP tool ---
  useEffect(() => {
    const ctx = (document as Document & { modelContext?: { registerTool: (t: unknown, o?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!ctx?.registerTool) return;
    const ac = new AbortController();
    void Promise.resolve(ctx.registerTool({ name: "create_blank_note", title: "Create blank note", description: "Create and open a blank verified writing note.", inputSchema: { type: "object", properties: { folder: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const f = typeof input === "object" && input && "folder" in input && typeof (input as {folder?: unknown}).folder === "string" ? (input as {folder: string}).folder : "Essays"; createNote(f); return { created: true, folder: f }; } }, { signal: ac.signal })).catch(() => {});
    return () => ac.abort();
  }, []);

  if (!mounted) return null;

  // ==================== LIST VIEW ====================
  if (view === "list") return <main className="list-shell">
    <header className="list-header">
      <div className="list-header-left"><span className="wordmark">memopad.</span></div>
      <div className="list-header-right">
        <button className="header-button" onClick={() => setShowArchive(!showArchive)}><Archive /> {showArchive ? "Notes" : "Archive"}{!showArchive && archivedNotes.length > 0 && <span className="count-badge">{archivedNotes.length}</span>}</button>
        <button className="header-button accent" onClick={() => createNote(folders[0] || "Essays")}><Plus /> New note</button>
      </div>
    </header>

    <div className="list-search"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes…" aria-label="Search notes" /></div>

    {showArchive && <div className="archive-banner"><Archive /> <span>Viewing archived notes</span> <button onClick={() => setShowArchive(false)}><X /></button></div>}

    <div className="list-content">
      {folders.map(folder => <section key={folder} className="folder-section">
        <div className="folder-heading">
          <span><ChevronDown /> {folder}</span>
          <div className="folder-actions">
            <span className="folder-count">{filtered.filter(n => n.folder === folder).length}</span>
            <div className="folder-menu-wrapper">
              <button className="folder-ellipsis" onClick={e => { e.stopPropagation(); setFolderMenu(folderMenu === folder ? null : folder); }} aria-label="Folder options"><MoreHorizontal /></button>
              {folderMenu === folder && <div className="folder-dropdown">
                <button onClick={() => renameFolder(folder)}><Pencil /> Rename</button>
                <button onClick={() => { createNote(folder); setFolderMenu(null); }}><Plus /> New note</button>
                <button className="danger" onClick={() => deleteFolder(folder)}><Trash2 /> Delete</button>
              </div>}
            </div>
          </div>
        </div>
        <div className="note-table">
          <div className="note-table-header"><span>Title</span><span>Words</span><span>Modified</span><span></span></div>
          {filtered.filter(n => n.folder === folder).map(note => <div key={note.id} className="note-table-row" onClick={() => openNote(note.id)}>
            <span className="note-title-cell">{note.title || "Untitled"}</span>
            <span className="note-meta-cell">{words(note.body)}</span>
            <span className="note-meta-cell">{shortDate(note.updatedAt)}</span>
            <span className="note-actions-cell" onClick={e => e.stopPropagation()}>
              <button className="row-action" onClick={() => toggleArchive(note.id)} title={note.archived ? "Restore" : "Archive"}>{note.archived ? <ArchiveRestore /> : <Archive />}</button>
              <button className="row-action danger" onClick={() => deleteNote(note.id)} title="Delete"><Trash2 /></button>
            </span>
          </div>)}
        </div>
      </section>)}

      {filtered.length === 0 && <div className="empty-list">{query ? <><Search /><p>No notes matching &ldquo;{query}&rdquo;</p></> : <><FileText /><p>No notes yet</p><button className="header-button accent" onClick={() => createNote()}>Create your first note</button></>}</div>}
    </div>

    <footer className="list-footer">
      <button onClick={createFolder}><FolderPlus /> New folder</button>
    </footer>

    {/* Dialogs */}
    <Dialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null); }}><DialogContent className="delete-dialog"><DialogHeader><div className="seal destructive"><Trash2 /></div><DialogTitle>{deleteTarget?.startsWith("folder:") ? "Delete folder" : "Delete note"}</DialogTitle><DialogDescription>{deleteTarget?.startsWith("folder:") ? `Permanently delete "${deleteTarget.split(":")[1]}" and all ${deleteTarget.split(":")[2]} note(s)?` : `Permanently delete "${notes.find(n => n.id === deleteTarget)?.title || "Untitled"}"?`}</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="delete-confirm-button" onClick={() => { if (deleteTarget?.startsWith("folder:")) confirmDeleteFolder(deleteTarget.split(":")[1]); else confirmDelete(); }}><Trash2 /> Delete</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={renameDialog !== null} onOpenChange={o => { if (!o) setRenameDialog(null); }}><DialogContent className="folder-dialog"><DialogHeader><DialogTitle>Rename folder</DialogTitle></DialogHeader><label className="folder-dialog-label">Name<input className="folder-dialog-input" value={renameDialog?.name ?? ""} onChange={e => renameDialog && setRenameDialog({ ...renameDialog, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") confirmRenameFolder(); }} autoFocus /></label><DialogFooter><Button variant="ghost" onClick={() => setRenameDialog(null)}>Cancel</Button><Button onClick={confirmRenameFolder}>Rename</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}><DialogContent className="folder-dialog"><DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader><label className="folder-dialog-label">Folder name<input className="folder-dialog-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmCreateFolder(); }} autoFocus placeholder="e.g. Research, Drafts" /></label><DialogFooter><Button variant="ghost" onClick={() => setNewFolderDialog(false)}>Cancel</Button><Button onClick={confirmCreateFolder}>Create</Button></DialogFooter></DialogContent></Dialog>
  </main>;

  // ==================== EDITOR VIEW ====================
  if (!selected) { setView("list"); return null; }

  return <main className="editor-shell">
    <header className="editor-topbar">
      <div className="editor-topbar-left">
        <button className="back-button" onClick={() => setView("list")}><ArrowLeft /> <span>All notes</span></button>
      </div>
      <div className="editor-topbar-right">
        <span className={`saved-indicator ${justSaved ? "just-saved" : ""}`}><Check /> Saved</span>
        <button className="topbar-text-button" onClick={() => setSourcesPanelOpen(!sourcesPanelOpen)}><BookOpen /> Sources{(selected.sources.length > 0) && <span className="count-badge">{selected.sources.length}</span>}</button>
        <button className={`font-toggle ${fontPref === "sans" ? "active" : ""}`} onClick={() => setFontPref(fontPref === "serif" ? "sans" : "serif")} title={fontPref === "serif" ? "Sans-serif" : "Serif"}><Type /></button>
        <button className="export-button" onClick={() => { setPublished(false); setExportFormat("html"); setPublishOpen(true); }}>Export</button>
      </div>
    </header>

    <div className={`editor-body ${sourcesPanelOpen ? "with-sources" : ""}`}>
      <div className="writing-area" style={{ fontFamily }}>
        <div className="date-display">{fullDate(selected.updatedAt)}</div>
        <textarea ref={titleRef} className="title-input" value={selected.title} onPaste={blockPaste} onChange={e => { updateText("title", e.target.value); autoResizeTitle(e.target); }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} placeholder="Untitled" rows={1} />
        <div className="format-toolbar">
          <button onMouseDown={e => { e.preventDefault(); applyFormat("bold"); }} title="Bold"><Bold /></button>
          <button onMouseDown={e => { e.preventDefault(); applyFormat("italic"); }} title="Italic"><Italic /></button>
          <button onMouseDown={e => { e.preventDefault(); applyFormat("underline"); }} title="Underline"><Underline /></button>
          <button onMouseDown={e => { e.preventDefault(); applyFormat("strikethrough"); }} title="Strikethrough"><Strikethrough /></button>
        </div>
        <div ref={bodyRef} className="body-input" contentEditable suppressContentEditableWarning onInput={handleBodyInput} onPaste={blockPaste} onDrop={e => { e.preventDefault(); setPasteNotice(true); }} spellCheck data-placeholder="Begin writing…" />
        <footer className="writing-footer"><span>{words(selected.body)} words</span><span>{selected.revisions} revisions</span></footer>
      </div>

      {sourcesPanelOpen && <aside className="sources-sidebar">
        <div className="sources-sidebar-header"><h2><BookOpen /> Sources</h2><button className="icon-button" onClick={() => setSourcesPanelOpen(false)}><X /></button></div>
        <div className="sources-sidebar-list">
          {selected.sources.length ? selected.sources.map((s, i) => <article className="sidebar-source-card" key={s.id}>
            <div className="source-number">{String(i + 1).padStart(2, "0")}</div>
            <div className="source-copy">
              <h3>{s.title}</h3>
              {s.url && <a href={s.url} target="_blank" rel="noreferrer">{s.url.replace(/^https?:\/\//, "")}</a>}
              <blockquote>&ldquo;{s.excerpt}&rdquo;</blockquote>
            </div>
            <button className="delete-source" onClick={() => patchNote({ sources: selected.sources.filter(x => x.id !== s.id) })}><Trash2 /></button>
          </article>) : <div className="empty-sidebar-sources"><BookOpen /><p>No sources yet</p></div>}
        </div>
        <div className="sources-sidebar-footer"><Button variant="outline" size="sm" onClick={() => setSourceOpen(true)} style={{ width: "100%" }}><Plus /> Add source</Button></div>
      </aside>}
    </div>

    {pasteNotice && <div className="paste-toast" role="status"><ShieldCheck /><div><strong>Paste stays in Sources.</strong><span>Use your own words, or save it as a clipping.</span></div><button onClick={() => { setSourcesPanelOpen(true); setPasteNotice(false); }}>Open Sources</button></div>}

    {/* Dialogs */}
    <Dialog open={sourceOpen} onOpenChange={setSourceOpen}><DialogContent className="source-dialog"><DialogHeader><DialogTitle>Add a source</DialogTitle><DialogDescription>Clippings live beside the manuscript and cannot be pasted into it.</DialogDescription></DialogHeader><label>Title<input value={sourceDraft.title} onChange={e => setSourceDraft({ ...sourceDraft, title: e.target.value })} placeholder="Article, book, or note" /></label><label>Link <span>optional</span><input value={sourceDraft.url} onChange={e => setSourceDraft({ ...sourceDraft, url: e.target.value })} placeholder="https://" /></label><label>Clipping or quotation<textarea value={sourceDraft.excerpt} onChange={e => setSourceDraft({ ...sourceDraft, excerpt: e.target.value })} placeholder="Paste source material here…" autoFocus /></label><DialogFooter><Button variant="ghost" onClick={() => setSourceOpen(false)}>Cancel</Button><Button onClick={addSource}>Save source</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="publish-dialog">{!published ? <><DialogHeader><div className="seal"><ShieldCheck /></div><DialogTitle>Export with provenance</DialogTitle><DialogDescription>Download with the &ldquo;Written in memopad&rdquo; mark.</DialogDescription></DialogHeader><div className="verification-preview"><div><span>Document</span><strong>{selected.title || "Untitled"}</strong></div><div><span>Words</span><strong>{words(selected.body)}</strong></div><div><span>Revisions</span><strong>{selected.revisions}</strong></div><div><span>Sources</span><strong>{selected.sources.length}</strong></div></div>
      <div className="format-picker"><span className="format-label">Format</span><div className="format-options">{(["html", "txt", "md"] as ExportFormat[]).map(f => <button key={f} className={`format-option ${exportFormat === f ? "active" : ""}`} onClick={() => setExportFormat(f)}><span className="format-name">{f === "html" ? "HTML" : f === "txt" ? "Plain Text" : "Markdown"}</span><span className="format-ext">.{f}</span></button>)}</div></div>
      <DialogFooter><Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button><Button className="publish-button" onClick={exportDocument}>Download .{exportFormat}</Button></DialogFooter></> : <div className="published-state"><div className="seal success"><Check /></div><DialogTitle>{selected.title || "Untitled"}</DialogTitle><DialogDescription>Exported as .{exportFormat}</DialogDescription><Button className="publish-button" onClick={() => setPublishOpen(false)}>Done</Button></div>}</DialogContent></Dialog>
  </main>;
}
