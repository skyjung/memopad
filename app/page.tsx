"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, BookOpen, Check, ChevronDown, FileText, Folder, FolderPlus, Menu, MoreHorizontal, PanelRightClose, PanelRightOpen, Pencil, Plus, Search, ShieldCheck, Trash2, Type, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Source = { id: string; title: string; url: string; excerpt: string };
type Note = { id: string; folder: string; title: string; subtitle: string; body: string; updatedAt: number; createdAt: number; keystrokes: number; revisions: number; sources: Source[]; archived?: boolean };
const now = Date.now();
const seedNotes: Note[] = [
  { id: "manifesto", folder: "Essays", title: "A small defense of making", subtitle: "", body: "A blank page is not empty. It contains the possibility of a thought becoming language, slowly and imperfectly.\n\nWriting is more than the arrangement of finished sentences. It is hesitation, deletion, return—the private movement by which an idea becomes one's own.\n\nThis page was made without generated language. The sources beside it informed the work, but did not write it.", updatedAt: now, createdAt: now - 432000000, keystrokes: 684, revisions: 17, sources: [
    { id: "source-1", title: "The Craft of Thought", url: "https://example.com/craft", excerpt: "Writing is not the transcription of thought, but one of the places in which thought occurs." },
    { id: "source-2", title: "Notebook clipping", url: "", excerpt: "What is lost when the finished object is separated from the record of its making?" },
  ] },
  { id: "notes-on-looking", folder: "Essays", title: "Notes on looking", subtitle: "", body: "Looking takes time. Recognition is faster, but it is not the same thing.", updatedAt: now - 3120000, createdAt: now - 1036800000, keystrokes: 94, revisions: 4, sources: [] },
  { id: "fragments", folder: "Fragments", title: "On memory", subtitle: "", body: "Memory edits in silence.", updatedAt: now - 100800000, createdAt: now - 1728000000, keystrokes: 31, revisions: 2, sources: [] },
];
const STORAGE_KEY = "memopad-prototype-v1";
const FONT_KEY = "memopad-font-pref";
const words = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;
function relativeTime(timestamp: number) { const m = Math.floor((Date.now() - timestamp) / 60000); if (m < 1) return "now"; if (m < 60) return `${m}m`; const h = Math.floor(m / 60); return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`; }

type ExportFormat = "html" | "txt" | "md";
type FontPref = "serif" | "sans";

export default function Home() {
  const [notes, setNotes] = useState<Note[]>(seedNotes);
  const [selectedId, setSelectedId] = useState("manifesto");
  const [tab, setTab] = useState<"writing" | "sources">("writing");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const loaded = useRef(false);
  const [mounted, setMounted] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) try {
      const data = JSON.parse(saved) as { notes: Note[]; selectedId: string };
      if (data.notes?.length) {
        const migrated = data.notes.map((n: Record<string, unknown>) => ({ subtitle: "", ...n } as Note));
        setNotes(migrated);
        setSelectedId(migrated.some(n => n.id === data.selectedId) ? data.selectedId : migrated[0].id);
      }
    } catch {}
    const savedFont = localStorage.getItem(FONT_KEY);
    if (savedFont === "serif" || savedFont === "sans") setFontPref(savedFont);
    loaded.current = true;
    setMounted(true);
  }, []);
  useEffect(() => { if (loaded.current) { localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes, selectedId })); setJustSaved(true); if (saveTimerRef.current) clearTimeout(saveTimerRef.current); saveTimerRef.current = setTimeout(() => setJustSaved(false), 1500); } }, [notes, selectedId]);
  useEffect(() => { if (loaded.current) localStorage.setItem(FONT_KEY, fontPref); }, [fontPref]);

  const activeNotes = useMemo(() => notes.filter(n => !n.archived), [notes]);
  const archivedNotes = useMemo(() => notes.filter(n => n.archived), [notes]);
  const displayedNotes = showArchive ? archivedNotes : activeNotes;

  const selected = notes.find(n => n.id === selectedId) ?? notes[0];
  const folders = useMemo(() => Array.from(new Set(displayedNotes.map(n => n.folder))), [displayedNotes]);
  const filtered = useMemo(() => displayedNotes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase())), [displayedNotes, query]);
  const patchNote = (patch: Partial<Note>) => setNotes(current => current.map(n => n.id === selected.id ? { ...n, ...patch } : n));
  const updateText = (field: "title" | "subtitle" | "body", value: string) => { const prev = selected[field] || ""; const added = Math.max(0, value.length - prev.length); patchNote({ [field]: value, updatedAt: Date.now(), keystrokes: selected.keystrokes + added, revisions: selected.revisions + 1 }); };
  const blockPaste = (event: React.ClipboardEvent) => { event.preventDefault(); setPasteNotice(true); window.setTimeout(() => setPasteNotice(false), 3200); };
  const createNote = (folder = selected.folder || "Essays") => { const id = crypto.randomUUID(); const note: Note = { id, folder, title: "Untitled", subtitle: "", body: "", createdAt: Date.now(), updatedAt: Date.now(), keystrokes: 0, revisions: 0, sources: [] }; setNotes(current => [note, ...current]); setSelectedId(id); setTab("writing"); setSidebarOpen(false); if (showArchive) setShowArchive(false); };
  const createFolder = () => { setNewFolderName(""); setNewFolderDialog(true); };
  const confirmCreateFolder = () => { if (newFolderName.trim()) { createNote(newFolderName.trim()); } setNewFolderDialog(false); };
  const addSource = () => { if (!sourceDraft.excerpt.trim() && !sourceDraft.url.trim()) return; patchNote({ sources: [...selected.sources, { ...sourceDraft, id: crypto.randomUUID(), title: sourceDraft.title || "Untitled source" }], updatedAt: Date.now() }); setSourceDraft({ title: "", url: "", excerpt: "" }); setSourceOpen(false); };
  const toggleArchive = (noteId: string) => {
    setNotes(current => current.map(n => n.id === noteId ? { ...n, archived: !n.archived, updatedAt: Date.now() } : n));
    if (noteId === selectedId) {
      const remaining = notes.filter(n => n.id !== noteId && (showArchive ? n.archived : !n.archived));
      if (remaining.length) setSelectedId(remaining[0].id);
    }
  };
  const deleteNote = (noteId: string) => {
    setDeleteTarget(noteId);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    setNotes(current => {
      const after = current.filter(n => n.id !== deleteTarget);
      if (deleteTarget === selectedId && after.length) setSelectedId(after[0].id);
      return after;
    });
    setDeleteTarget(null);
  };

  const renameFolder = (oldName: string) => {
    setRenameDialog({ folder: oldName, name: oldName });
    setFolderMenu(null);
  };
  const confirmRenameFolder = () => {
    if (renameDialog && renameDialog.name.trim() && renameDialog.name.trim() !== renameDialog.folder) {
      setNotes(current => current.map(n => n.folder === renameDialog.folder ? { ...n, folder: renameDialog.name.trim() } : n));
    }
    setRenameDialog(null);
  };
  const deleteFolder = (folderName: string) => {
    const count = notes.filter(n => n.folder === folderName).length;
    setDeleteTarget(`folder:${folderName}:${count}`);
    setFolderMenu(null);
  };
  const confirmDeleteFolder = (folderName: string) => {
    setNotes(current => {
      const after = current.filter(n => n.folder !== folderName);
      if (after.length && !after.some(n => n.id === selectedId)) setSelectedId(after[0].id);
      return after;
    });
    setDeleteTarget(null);
  };

  const autoResizeTitle = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; };
  useEffect(() => { if (titleRef.current) autoResizeTitle(titleRef.current); }, [selected.id, selected.title]);

  useEffect(() => {
    if (!folderMenu) return;
    const close = () => setFolderMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [folderMenu]);

  const fontFamily = fontPref === "serif"
    ? "var(--font-literata), Georgia, serif"
    : "'SF Pro Display', 'SF Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  const exportDocument = () => {
    const escape = (value: string) => value.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
    const subtitleLine = selected.subtitle ? `\n${selected.subtitle}` : "";
    const dateStr = new Date(selected.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

    let blob: Blob;
    let extension: string;

    if (exportFormat === "txt") {
      const text = `${selected.title}${subtitleLine}\n${"=".repeat(selected.title.length)}\n${dateStr}\n\n${selected.body}\n\n---\nWritten in memopad · ${words(selected.body)} words · ${selected.revisions} recorded revisions · ${selected.sources.length} sources stored separately\nExported ${new Date().toLocaleDateString()}`;
      blob = new Blob([text], { type: "text/plain" });
      extension = "txt";
    } else if (exportFormat === "md") {
      const sourcesSection = selected.sources.length
        ? `\n\n## Sources\n\n${selected.sources.map((s, i) => `${i + 1}. **${s.title}**${s.url ? ` — [${s.url.replace(/^https?:\/\//, "")}](${s.url})` : ""}\n   > ${s.excerpt}`).join("\n\n")}`
        : "";
      const md = `# ${selected.title}${selected.subtitle ? `\n\n*${selected.subtitle}*` : ""}\n\n${dateStr}\n\n${selected.body}${sourcesSection}\n\n---\n\n*Written in memopad* · ${words(selected.body)} words · ${selected.revisions} recorded revisions · ${selected.sources.length} sources stored separately · Exported ${new Date().toLocaleDateString()}`;
      blob = new Blob([md], { type: "text/markdown" });
      extension = "md";
    } else {
      const paragraphs = selected.body.split(/\n\n+/).map(p => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");
      const subtitleHtml = selected.subtitle ? `<p class="subtitle">${escape(selected.subtitle)}</p>` : "";
      const dateHtml = `<p class="date">${escape(dateStr)}</p>`;
      const exportFont = fontPref === "serif" ? "Georgia,serif" : "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escape(selected.title)}</title><style>body{max-width:700px;margin:70px auto;padding:0 28px;color:#20201e;font:18px/1.85 ${exportFont}}h1{font-size:46px;line-height:1.1;letter-spacing:-.04em;margin-bottom:8px}.subtitle{color:#666;font-size:22px;font-style:italic;margin:0 0 4px}.date{color:#999;font-size:14px;margin:0 0 32px}.mark{display:flex;align-items:center;gap:12px;margin-top:60px;padding-top:22px;border-top:1px solid #ddd;font:13px/1.4 Arial,sans-serif}.m{display:grid;place-items:center;width:30px;height:30px;border-radius:7px;color:white;background:#BD1B2A;font:bold 18px Georgia}.mark small{display:block;color:#777}.record{margin-top:18px;color:#666;font:12px/1.6 Arial,sans-serif}</style></head><body><h1>${escape(selected.title)}</h1>${subtitleHtml}${dateHtml}${paragraphs}<div class="mark"><span class="m">m</span><div><strong>Written in memopad</strong><small>Composed locally without built-in AI assistance</small></div></div><div class="record">${words(selected.body)} words · ${selected.revisions} recorded revisions · ${selected.sources.length} sources stored separately · Exported ${new Date().toLocaleDateString()}</div></body></html>`;
      blob = new Blob([html], { type: "text/html" });
      extension = "html";
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `${selected.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "memopad-note"}.${extension}`; link.click();
    URL.revokeObjectURL(url); setPublished(true);
  };

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({ name: "create_blank_note", title: "Create blank note", description: "Create and open a blank verified writing note in memopad.", inputSchema: { type: "object", properties: { folder: { type: "string" } }, additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute(input: unknown) { const folder = typeof input === "object" && input && "folder" in input && typeof (input as {folder?: unknown}).folder === "string" ? (input as {folder: string}).folder : "Essays"; createNote(folder); return { created: true, folder }; } }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, []);

  if (!mounted) return null;

  return <main className="app-shell">
    <aside className={`library-panel ${sidebarOpen ? "mobile-open" : ""}`}>
      <div className="brand-row"><div className="wordmark"><span className="logo-mark">m</span>memopad</div><button className="icon-button mobile-only" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X /></button></div>
      <button className="new-note" onClick={() => createNote()}><Plus /> New note <span>⌘N</span></button>
      <label className="search-box"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" aria-label="Search notes" /></label>

      {showArchive && <div className="archive-banner"><Archive /> <span>Archive</span> <button onClick={() => setShowArchive(false)}><X /></button></div>}

      <nav className="folder-nav" aria-label="Notebooks">{folders.map(folder => <section key={folder}>
        <div className="folder-heading"><span><ChevronDown /> {folder}</span><div className="folder-actions"><span className="folder-count">{displayedNotes.filter(n => n.folder === folder).length}</span><div className="folder-menu-wrapper"><button className="folder-ellipsis" onClick={e => { e.stopPropagation(); setFolderMenu(folderMenu === folder ? null : folder); }} aria-label="Folder options"><MoreHorizontal /></button>{folderMenu === folder && <div className="folder-dropdown"><button onClick={() => renameFolder(folder)}><Pencil /> Rename</button><button className="danger" onClick={() => deleteFolder(folder)}><Trash2 /> Delete</button></div>}</div></div></div>
        <div className="note-list">{filtered.filter(n => n.folder === folder).map(note => <button key={note.id} className={`note-row ${selected.id === note.id ? "selected" : ""}`} onClick={() => { setSelectedId(note.id); setSidebarOpen(false); }}>
          <span>{note.title || "Untitled"}</span>
          <div className="note-row-actions">
            <small>{relativeTime(note.updatedAt)}</small>
            <button className="note-action-button" onClick={e => { e.stopPropagation(); toggleArchive(note.id); }} aria-label={note.archived ? "Unarchive" : "Archive"} title={note.archived ? "Restore from archive" : "Archive"}>{note.archived ? <ArchiveRestore /> : <Archive />}</button>
            <button className="note-action-button delete" onClick={e => { e.stopPropagation(); deleteNote(note.id); }} aria-label="Delete note" title="Delete"><Trash2 /></button>
          </div>
        </button>)}</div>
      </section>)}</nav>
      <div className="library-footer">
        <button onClick={createFolder}><FolderPlus /> New folder</button>
        <button onClick={() => setShowArchive(!showArchive)}>
          <Archive /> {showArchive ? "Back to notes" : "Archive"}
          {!showArchive && archivedNotes.length > 0 && <span className="archive-count">{archivedNotes.length}</span>}
        </button>
      </div>
    </aside>

    <section className={`workspace ${sourcesPanelOpen && tab === "writing" ? "with-sources-panel" : ""}`}>
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button mobile-only" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu /></button>
        </div>
        <div className="topbar-actions">
          <span className={`saved-indicator ${justSaved ? "just-saved" : ""}`}><Check /> Saved</span>
          {tab === "writing" && selected.sources.length > 0 && <button className="topbar-text-button" onClick={() => setSourcesPanelOpen(!sourcesPanelOpen)}><BookOpen /> Sources</button>}
          {tab === "sources" && <button className="topbar-text-button" onClick={() => setTab("writing")}><FileText /> Writing</button>}
          <button className={`font-toggle ${fontPref === "sans" ? "active" : ""}`} onClick={() => setFontPref(fontPref === "serif" ? "sans" : "serif")} aria-label={`Switch to ${fontPref === "serif" ? "sans-serif" : "serif"} font`} title={fontPref === "serif" ? "Switch to sans-serif" : "Switch to serif"}><Type /></button>
          <button className="export-button" onClick={() => { setPublished(false); setExportFormat("html"); setPublishOpen(true); }}>Export</button>
        </div>
      </header>

      {tab === "writing" ? <div className={`writing-view ${sourcesPanelOpen ? "with-panel" : ""}`}>
        <div className="writing-area" style={{ fontFamily }}>
          <div className="date-display">{new Date(selected.updatedAt).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</div>
          <textarea ref={titleRef} className="title-input" value={selected.title} onPaste={blockPaste} onChange={e => { updateText("title", e.target.value); autoResizeTitle(e.target); }} onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }} placeholder="Untitled" aria-label="Document title" rows={1} />
          <input className="subtitle-input" value={selected.subtitle} onPaste={blockPaste} onChange={e => updateText("subtitle", e.target.value)} placeholder="Subtitle" aria-label="Subtitle" />
          <textarea className="body-input" value={selected.body} onPaste={blockPaste} onDrop={e => { e.preventDefault(); setPasteNotice(true); }} onChange={e => updateText("body", e.target.value)} placeholder="Begin writing…" spellCheck aria-label="Manuscript" />
          <footer className="writing-footer"><span>{words(selected.body)} words</span><span>{selected.revisions} revisions</span></footer>
        </div>

        {sourcesPanelOpen && <aside className="sources-sidebar">
          <div className="sources-sidebar-header">
            <h2><BookOpen /> Sources</h2>
            <button className="icon-button" onClick={() => setSourcesPanelOpen(false)} aria-label="Close sources panel"><X /></button>
          </div>
          <div className="sources-sidebar-list">
            {selected.sources.length ? selected.sources.map((source, i) => <article className="sidebar-source-card" key={source.id}>
              <div className="source-number">{String(i + 1).padStart(2, "0")}</div>
              <div className="source-copy">
                <h3>{source.title}</h3>
                {source.url && <a href={source.url} target="_blank" rel="noreferrer">{source.url.replace(/^https?:\/\//, "")}</a>}
                <blockquote>&ldquo;{source.excerpt}&rdquo;</blockquote>
              </div>
            </article>) : <div className="empty-sidebar-sources"><BookOpen /><p>No sources yet</p></div>}
          </div>
          <div className="sources-sidebar-footer">
            <Button variant="outline" size="sm" onClick={() => { setSourcesPanelOpen(false); setTab("sources"); }}>Manage sources</Button>
          </div>
        </aside>}
      </div> : <div className="sources-view">
        <div className="sources-header"><div><p className="eyebrow">Reference desk</p><h1>Sources</h1><p>Paste clippings, quotations, and links here. They can be consulted, but never inserted into your writing.</p></div><Button onClick={() => setSourceOpen(true)}><Plus /> Add source</Button></div>
        {selected.sources.length ? <div className="source-grid">{selected.sources.map((source, i) => <article className="source-card" key={source.id}><div className="source-number">{String(i + 1).padStart(2, "0")}</div><div className="source-copy"><h2>{source.title}</h2>{source.url && <a href={source.url} target="_blank" rel="noreferrer">{source.url.replace(/^https?:\/\//, "")}</a>}<blockquote>&ldquo;{source.excerpt}&rdquo;</blockquote></div><button onClick={() => patchNote({ sources: selected.sources.filter(s => s.id !== source.id) })} className="delete-source" aria-label={`Delete ${source.title}`}><Trash2 /></button></article>)}</div> : <div className="empty-sources"><BookOpen /><h2>No sources yet</h2><p>Keep research beside your writing, without letting it enter the manuscript.</p><Button variant="outline" onClick={() => setSourceOpen(true)}>Add your first source</Button></div>}
      </div>}
      {pasteNotice && <div className="paste-toast" role="status"><ShieldCheck /><div><strong>Paste stays in Sources.</strong><span>Write this passage in your own words, or save it as a clipping.</span></div><button onClick={() => { setTab("sources"); setPasteNotice(false); }}>Open Sources</button></div>}
    </section>

    <Dialog open={sourceOpen} onOpenChange={setSourceOpen}><DialogContent className="source-dialog"><DialogHeader><DialogTitle>Add a source</DialogTitle><DialogDescription>Clippings live beside the manuscript and cannot be pasted into it.</DialogDescription></DialogHeader><label>Title<input value={sourceDraft.title} onChange={e => setSourceDraft({ ...sourceDraft, title: e.target.value })} placeholder="Article, book, or note" /></label><label>Link <span>optional</span><input value={sourceDraft.url} onChange={e => setSourceDraft({ ...sourceDraft, url: e.target.value })} placeholder="https://" /></label><label>Clipping or quotation<textarea value={sourceDraft.excerpt} onChange={e => setSourceDraft({ ...sourceDraft, excerpt: e.target.value })} placeholder="Paste source material here…" autoFocus /></label><DialogFooter><Button variant="ghost" onClick={() => setSourceOpen(false)}>Cancel</Button><Button onClick={addSource}>Save source</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={publishOpen} onOpenChange={setPublishOpen}><DialogContent className="publish-dialog">{!published ? <><DialogHeader><div className="seal"><ShieldCheck /></div><DialogTitle>Export with provenance</DialogTitle><DialogDescription>Download a self-contained document with the &ldquo;Written in memopad&rdquo; mark. Nothing is uploaded.</DialogDescription></DialogHeader><div className="verification-preview"><div><span>Document</span><strong>{selected.title || "Untitled"}</strong></div><div><span>Composed</span><strong>{words(selected.body)} words</strong></div><div><span>Process</span><strong>{selected.revisions} recorded revisions</strong></div><div><span>Sources</span><strong>{selected.sources.length} saved separately</strong></div><div><span>External text</span><strong className="verified-value"><Check /> None inserted</strong></div></div>
      <div className="format-picker">
        <span className="format-label">Format</span>
        <div className="format-options">
          {(["html", "txt", "md"] as ExportFormat[]).map(fmt => (
            <button key={fmt} className={`format-option ${exportFormat === fmt ? "active" : ""}`} onClick={() => setExportFormat(fmt)}>
              <span className="format-name">{fmt === "html" ? "HTML" : fmt === "txt" ? "Plain Text" : "Markdown"}</span>
              <span className="format-ext">.{fmt}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="publish-note">memopad records activity inside the local editor. It cannot certify what a writer consulted outside the app.</p><DialogFooter><Button variant="ghost" onClick={() => setPublishOpen(false)}>Cancel</Button><Button className="publish-button" onClick={exportDocument}>Download .{exportFormat}</Button></DialogFooter></> : <div className="published-state"><div className="seal success"><Check /></div><p className="eyebrow">Downloaded</p><DialogTitle>{selected.title || "Untitled"}</DialogTitle><DialogDescription>Your writing and its local process summary were exported as .{exportFormat}.</DialogDescription><div className="published-mark"><span className="mini-mark">m</span><div><strong>Written in memopad</strong><small>Composed locally</small></div><ShieldCheck /></div><Button className="publish-button" onClick={() => setPublishOpen(false)}>Done</Button></div>}</DialogContent></Dialog>

    <Dialog open={deleteTarget !== null} onOpenChange={open => { if (!open) setDeleteTarget(null); }}><DialogContent className="delete-dialog"><DialogHeader><div className="seal destructive"><Trash2 /></div><DialogTitle>{deleteTarget?.startsWith("folder:") ? "Delete folder" : "Delete note"}</DialogTitle><DialogDescription>{deleteTarget?.startsWith("folder:")
      ? `This will permanently delete the folder "${deleteTarget.split(":")[1]}" and all ${deleteTarget.split(":")[2]} note(s) inside it.`
      : `This will permanently delete "${notes.find(n => n.id === deleteTarget)?.title || "Untitled"}". This cannot be undone.`
    }</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button className="delete-confirm-button" onClick={() => { if (deleteTarget?.startsWith("folder:")) confirmDeleteFolder(deleteTarget.split(":")[1]); else confirmDelete(); }}><Trash2 /> Delete</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={renameDialog !== null} onOpenChange={open => { if (!open) setRenameDialog(null); }}><DialogContent className="folder-dialog"><DialogHeader><DialogTitle>Rename folder</DialogTitle><DialogDescription>Enter a new name for this folder.</DialogDescription></DialogHeader><label className="folder-dialog-label">Name<input className="folder-dialog-input" value={renameDialog?.name ?? ""} onChange={e => renameDialog && setRenameDialog({ ...renameDialog, name: e.target.value })} onKeyDown={e => { if (e.key === "Enter") confirmRenameFolder(); }} autoFocus /></label><DialogFooter><Button variant="ghost" onClick={() => setRenameDialog(null)}>Cancel</Button><Button onClick={confirmRenameFolder}>Rename</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={newFolderDialog} onOpenChange={setNewFolderDialog}><DialogContent className="folder-dialog"><DialogHeader><DialogTitle>New folder</DialogTitle><DialogDescription>Create a new folder with a blank note inside.</DialogDescription></DialogHeader><label className="folder-dialog-label">Folder name<input className="folder-dialog-input" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") confirmCreateFolder(); }} autoFocus placeholder="e.g. Research, Drafts" /></label><DialogFooter><Button variant="ghost" onClick={() => setNewFolderDialog(false)}>Cancel</Button><Button onClick={confirmCreateFolder}>Create</Button></DialogFooter></DialogContent></Dialog>
  </main>;
}
