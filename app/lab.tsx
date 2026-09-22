"use client";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  FlaskConical,
  BarChart3,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  Play,
  Square,
  Download,
  Upload,
  Check,
  ChevronRight,
  X,
  CheckCheck,
  History,
  Info,
  KeyRound,
  FileText,
  Trash2,
  Eye,
} from "lucide-react";
import {
  categories,
  methods,
  itemSchema,
  validateState,
  toCsv,
  meanScore,
  score,
  shuffled,
  type Item,
  type Result,
  type Method,
  type Review,
  type LabState,
} from "@/lib/domain";
import { seedItems } from "@/lib/seed";
type View =
  | "experiment"
  | "dataset"
  | "review"
  | "results"
  | "guide"
  | "settings";
const storageKey = "utga-lab-v1";
const nav = [
  { id: "experiment", label: "Туршилт", icon: FlaskConical },
  { id: "dataset", label: "Хэллэгийн сан", icon: BookOpen },
  { id: "review", label: "Хүний үнэлгээ", icon: CheckCheck },
  { id: "results", label: "Үр дүн", icon: BarChart3 },
] as const;
const initial: LabState = { version: 1, items: seedItems, results: [] };
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function date(value: string) {
  return new Date(value).toLocaleString("mn-MN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty">
      <FlaskConical size={34} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export default function Lab() {
  const [view, setView] = useState<View>("experiment");
  const [state, setState] = useState<LabState>(initial);
  const stateRef = useRef(initial);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState("Бүгд");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([
    "MN-001",
    "MN-007",
    "MN-013",
  ]);
  const [chosenMethods, setChosenMethods] = useState<Method[]>([
    "plain",
    "context",
    "examples",
  ]);
  const [model, setModel] = useState("gpt-4.1-mini");
  const [repeats, setRepeats] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [currentBatch, setCurrentBatch] = useState("");
  const controller = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);
  const [apiKey, setApiKey] = useState("");
  const [password, setPassword] = useState("");
  const [shared, setShared] = useState(false);
  const [serverModels, setServerModels] = useState<string[]>([]);
  const [keyConsent, setKeyConsent] = useState(false);
  const [connection, setConnection] = useState<"own" | "shared">("own");
  const [editing, setEditing] = useState<Item | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [detail, setDetail] = useState<Result | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [blind, setBlind] = useState(true);
  const [reviewId, setReviewId] = useState("");
  const [reviewForm, setReviewForm] = useState({
    meaning: -1,
    context: -1,
    clarity: -1,
    errorType: "Алдаа ажиглагдаагүй",
    note: "",
  });
  const [resultFilter, setResultFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = validateState(JSON.parse(raw));
        stateRef.current = parsed;
        setState(parsed);
        setSelected(parsed.items.slice(0, 3).map((i) => i.id));
      }
    } catch {
      setStorageError(
        "Хадгалсан өгөгдлийг уншиж чадсангүй. Эх файлыг хадгалж аваад шалгана уу. Автоматаар дарж бичихгүй.",
      );
    }
    setReady(true);
    fetch("/api/run")
      .then((r) => r.json())
      .then((d) => {
        setShared(d.sharedConfigured);
        setServerModels(d.models || []);
        if (d.sharedConfigured) setConnection("shared");
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (busy) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  function save(next: LabState) {
    try {
      if (storageError) throw new Error();
      localStorage.setItem(storageKey, JSON.stringify(next));
      stateRef.current = next;
      setState(next);
      return true;
    } catch {
      setStorageError(
        "Хөтчийн хадгалалт ажиллахгүй эсвэл дүүрсэн байна. JSON нөөц татаж аваад хадгалалтыг шалгана уу.",
      );
      stateRef.current = next;
      setState(next);
      return false;
    }
  }
  const filtered = state.items.filter(
    (i) =>
      (category === "Бүгд" || i.category === category) &&
      `${i.text} ${i.context}`.toLowerCase().includes(query.toLowerCase()),
  );
  const pending = state.results.filter((r) => !r.review);
  const reviewed = state.results.filter((r) => r.review);
  const reviewResult =
    state.results.find((r) => r.id === reviewId) || pending[0];
  const selectedItems = state.items.filter((i) => selected.includes(i.id));
  const tasks = selectedItems.length * chosenMethods.length * repeats;
  const latest = state.results
    .filter((r) => !currentBatch || r.batchId === currentBatch)
    .slice(-6)
    .reverse();
  const batches = Array.from(
    new Set(state.results.map((r) => r.batchId)),
  ).reverse();
  const filteredResults = state.results.filter(
    (r) =>
      (resultFilter === "all" || r.method === resultFilter) &&
      (batchFilter === "all" || r.batchId === batchFilter),
  );
  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }
  async function run() {
    setNotice("");
    if (!tasks || tasks > 90) {
      setNotice("1–90 хүсэлттэй туршилт сонгоно уу.");
      return;
    }
    if (
      (connection === "own" && (!apiKey.trim() || !keyConsent)) ||
      (connection === "shared" && (!shared || !password))
    ) {
      setNotice("AI холболтоо эхлээд тохируулна уу.");
      setView("settings");
      return;
    }
    if (storageError) {
      setNotice("Эхлээд өгөгдөл хадгалах асуудлыг шийднэ үү.");
      return;
    }
    const batchId = crypto.randomUUID();
    setCurrentBatch(batchId);
    setBusy(true);
    stopRequested.current = false;
    setProgress({ done: 0, total: tasks });
    const queue = shuffled(
      selectedItems.flatMap((item) =>
        chosenMethods.flatMap((method) =>
          Array.from({ length: repeats }, (_, n) => ({
            item,
            method,
            repeat: n + 1,
          })),
        ),
      ),
    );
    let completed = 0;
    try {
      for (const task of queue) {
        if (stopRequested.current) break;
        controller.current = new AbortController();
        const res = await fetch("/api/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(connection === "own"
              ? { "x-openai-key": apiKey.trim() }
              : { "x-research-password": password }),
          },
          body: JSON.stringify({
            text: task.item.text,
            context: task.item.context,
            method: task.method,
            model: model.trim(),
          }),
          signal: controller.current.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Хүсэлт амжилтгүй.");
        const result: Result = {
          ...data,
          id: crypto.randomUUID(),
          batchId,
          item: { ...task.item },
          method: task.method,
          requestedModel: model.trim(),
          repeat: task.repeat,
        };
        const persisted = save({
          ...stateRef.current,
          results: [...stateRef.current.results, result],
        });
        completed++;
        setProgress({ done: completed, total: queue.length });
        if (!persisted)
          throw new Error("Үр дүнг хадгалж чадсангүй. JSON нөөц татна уу.");
      }
      setNotice(
        stopRequested.current
          ? `Туршилтыг зогсоолоо. ${completed} хариу хадгалсан.`
          : `${completed} хариу хадгаллаа. Одоо хүний үнэлгээ хийнэ үү.`,
      );
    } catch (e) {
      setNotice(
        stopRequested.current
          ? `Зогсоолоо. ${completed} хариу хадгалсан. Дуусаагүй хүсэлтэд үйлчилгээний төлбөр гарсан байж болно.`
          : e instanceof Error
            ? e.message
            : "Алдаа гарлаа.",
      );
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }
  function stop() {
    stopRequested.current = true;
    controller.current?.abort();
  }
  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = itemSchema.safeParse({
      ...data,
      id: editing?.id || `CUSTOM-${crypto.randomUUID().slice(0, 8)}`,
    });
    if (!parsed.success) {
      setNotice("Бүх талбарыг бүрэн бөглөнө үү.");
      return;
    }
    const item = parsed.data;
    save({
      ...stateRef.current,
      items: editing
        ? stateRef.current.items.map((i) => (i.id === item.id ? item : i))
        : [...stateRef.current.items, item],
    });
    setShowEditor(false);
    setEditing(null);
    setNotice("Хэллэгийг хадгаллаа. Өмнөх туршилтын хуулбар өөрчлөгдөхгүй.");
  }
  function saveReview() {
    if (!reviewResult) return;
    if (
      !reviewer.trim() ||
      Object.values({
        meaning: reviewForm.meaning,
        context: reviewForm.context,
        clarity: reviewForm.clarity,
      }).some((n) => n < 0)
    ) {
      setNotice(
        "Үнэлэгчийн код болон гурван шалгуурын оноог бүрэн оруулна уу.",
      );
      return;
    }
    const review: Review = {
      ...reviewForm,
      reviewer: reviewer.trim(),
      at: new Date().toISOString(),
    };
    save({
      ...stateRef.current,
      results: stateRef.current.results.map((r) =>
        r.id === reviewResult.id ? { ...r, review } : r,
      ),
    });
    setReviewId("");
    setReviewForm({
      meaning: -1,
      context: -1,
      clarity: -1,
      errorType: "Алдаа ажиглагдаагүй",
      note: "",
    });
    setNotice("Үнэлгээ хадгаллаа.");
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20000000)
        throw new Error("Файлын хэмжээ 20 MB-аас бага байна.");
      const raw = JSON.parse(await file.text());
      if (Array.isArray(raw)) {
        const items = raw.map((i) => itemSchema.parse(i));
        if (items.length > 2000)
          throw new Error("2000 хүртэл хэллэг импортлоно.");
        const existing = new Set(stateRef.current.items.map((i) => i.id));
        if (
          items.some((i) => existing.has(i.id)) ||
          new Set(items.map((i) => i.id)).size !== items.length
        )
          throw new Error("ID давхцаж байна. Шинэ ID өгнө үү.");
        save({
          ...stateRef.current,
          items: [...stateRef.current.items, ...items],
        });
        setNotice(`${items.length} хэллэг нэмлээ.`);
      } else {
        const restored = validateState(raw);
        const itemMap = new Map(stateRef.current.items.map((i) => [i.id, i]));
        const resultMap = new Map(
          stateRef.current.results.map((r) => [r.id, r]),
        );
        restored.items.forEach((i) => {
          if (!itemMap.has(i.id)) itemMap.set(i.id, i);
        });
        restored.results.forEach((r) => {
          if (!resultMap.has(r.id)) resultMap.set(r.id, r);
        });
        save({
          ...stateRef.current,
          items: [...itemMap.values()],
          results: [...resultMap.values()],
        });
        setNotice(
          "Нөөцөөс шинэ бичлэгүүдийг нэгтгэлээ. Одоо байгаа ID-тай бичлэгүүдийг хэвээр үлдээлээ.",
        );
      }
    } catch (e) {
      setNotice(
        e instanceof Error && e.message.length < 180
          ? e.message
          : "JSON файлын бүтэц буруу байна. Зааврын загварыг шалгана уу.",
      );
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  const mean = meanScore(state.results);
  const connectionReady =
    connection === "own" ? !!apiKey.trim() && keyConsent : shared && !!password;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Утга нүүр">
          <span className="brandmark">у</span>
          <span>
            утга<span className="brand-dot">.</span>
            <small>AI СУДАЛГААНЫ ЛАБОРАТОРИ</small>
          </span>
        </a>
        <div className="workspace-label">СУДАЛГААНЫ ОРЧИН</div>
        <nav aria-label="Үндсэн цэс">
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(n.id);
                setNotice("");
              }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.id === "review" && pending.length > 0 ? (
                <b>{pending.length}</b>
              ) : view === n.id ? (
                <ChevronRight size={16} />
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-label">СУДАЛГААНЫ АСУУЛТ</span>
          <p>
            AI үгийг таньдаг.
            <br />
            <strong>Утгыг нь ойлгодог уу?</strong>
          </p>
          <span className="note-line" />
          <small>Монгол хэл · Соёл · Хиймэл оюун</small>
        </div>
        <div className="sidebar-bottom">
          <button
            className={view === "guide" ? "nav-item active" : "nav-item"}
            onClick={() => setView("guide")}
          >
            <FileText size={18} />
            Арга зүй, заавар
          </button>
          <button
            className={view === "settings" ? "nav-item active" : "nav-item"}
            onClick={() => setView("settings")}
          >
            <Settings2 size={18} />
            Тохиргоо
          </button>
          <div className="researcher">
            <span>С</span>
            <div>
              Судлаачийн орчин<small>Энэ хөтөчид хадгална</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Монгол хэл ба AI <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.id === view)?.label ||
                (view === "guide" ? "Арга зүй" : "Тохиргоо")}
            </strong>
          </div>
          <button className="connection" onClick={() => setView("settings")}>
            <span className={connectionReady ? "dot connected" : "dot"} />
            {connectionReady ? "AI холболт бэлэн" : "AI холбох"}
            <ArrowUpRight size={14} />
          </button>
        </header>
        <main>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => importFile(e.target.files?.[0])}
          />
          {!ready ? (
            <div className="notice">Хадгалсан өгөгдлийг ачаалж байна…</div>
          ) : null}
          {notice ? (
            <div className="notice" role="status">
              <Info size={18} />
              <span>{notice}</span>
              <button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}>
                <X size={17} />
              </button>
            </div>
          ) : null}
          {storageError ? (
            <div className="notice error" role="alert">
              <span>{storageError}</span>
              <button
                onClick={() =>
                  download(
                    "utga-recovery.json",
                    JSON.stringify(stateRef.current, null, 2),
                    "application/json",
                  )
                }
              >
                Нөөц татах
              </button>
            </div>
          ) : null}
          {view === "experiment" && (
            <>
              <div className="page-heading">
                <div className="eyebrow">МОНГОЛ ХЭЛНИЙ ДАЛД УТГЫН СУДАЛГАА</div>
                <div className="heading-row">
                  <div>
                    <h1>
                      Үгийн цаадах утгыг шинжье<span>.</span>
                    </h1>
                    <p>Ижил хэллэг. Өөр асуулт. AI-ийн ойлголтын ялгаа.</p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setView("guide")}
                  >
                    <BookOpen size={16} />
                    Арга зүй
                  </button>
                </div>
              </div>
              <div className="stats">
                <Stat
                  title="ХЭЛЛЭГИЙН САН"
                  value={String(state.items.length)}
                  subtitle="4 төрлийн хэрэглээ"
                  icon={<BookOpen size={19} />}
                />
                <Stat
                  title="AI ХАРИУЛТ"
                  value={String(state.results.length)}
                  subtitle={`${batches.length} туршилт хадгалсан`}
                  icon={<FlaskConical size={19} />}
                />
                <Stat
                  title="ХҮНИЙ ҮНЭЛГЭЭ"
                  value={String(reviewed.length)}
                  subtitle={`${pending.length} хариу хүлээгдэж байна`}
                  icon={<CheckCheck size={19} />}
                />
                <Stat
                  title="ДУНДАЖ ОНОО"
                  value={mean === null ? "—" : mean.toFixed(2)}
                  subtitle={
                    mean === null
                      ? "Үнэлгээ хийсний дараа гарна"
                      : "Хүний үнэлгээ · нийт 6 оноо"
                  }
                  icon={<BarChart3 size={19} />}
                />
              </div>
              <div className="experiment-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <span className="step">01</span>
                      <h2>Хэллэгээ сонгох</h2>
                    </div>
                    <Badge>{selectedItems.length} сонгосон</Badge>
                  </div>
                  <div className="panel-body">
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label="Хэллэг хайх"
                        placeholder="Хэллэг, нөхцөлөөс хайх…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="chips">
                      {["Бүгд", ...categories].map((c) => (
                        <button
                          key={c}
                          onClick={() => setCategory(c)}
                          className={category === c ? "chip selected" : "chip"}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <div className="selection-tools">
                      <span>{filtered.length} хэллэг</span>
                      <button
                        disabled={busy}
                        onClick={() =>
                          setSelected([
                            ...new Set([
                              ...selected,
                              ...filtered.map((i) => i.id),
                            ]),
                          ])
                        }
                      >
                        Бүгдийг сонгох
                      </button>
                      <button disabled={busy} onClick={() => setSelected([])}>
                        Цэвэрлэх
                      </button>
                    </div>
                    <div className="phrase-list">
                      {filtered.length === 0 ? (
                        <p className="muted">Хайлтад тохирох хэллэг алга.</p>
                      ) : (
                        filtered.map((item) => (
                          <label
                            key={item.id}
                            className={`phrase-card ${selected.includes(item.id) ? "checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={selected.includes(item.id)}
                              disabled={busy}
                              onChange={() => toggle(item.id)}
                            />
                            <span>
                              <span className="phrase-meta">
                                <Badge
                                  tone={
                                    item.category === "Ёгтлол"
                                      ? "purple"
                                      : item.category === "Хэлц үг"
                                        ? "blue"
                                        : "neutral"
                                  }
                                >
                                  {item.category}
                                </Badge>
                                <small>{item.id}</small>
                              </span>
                              <strong>“{item.text}”</strong>
                              <span className="phrase-context">
                                {item.context}
                              </span>
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                    <div className="footnote">
                      <Info size={15} />
                      <span>
                        Жишээ сангийн тайлбарыг судалгаанд ашиглахаасаа өмнө
                        шинжээчээр баталгаажуулна.
                      </span>
                    </div>
                  </div>
                </section>
                <section className="panel setup-panel">
                  <div className="panel-header">
                    <div>
                      <span className="step">02</span>
                      <h2>Туршилтын тохиргоо</h2>
                    </div>
                  </div>
                  <div className="panel-body">
                    <label className="field-label" htmlFor="model">
                      AI загвар
                    </label>
                    <input
                      id="model"
                      list="models"
                      className="input"
                      value={model}
                      disabled={busy}
                      onChange={(e) => setModel(e.target.value)}
                      maxLength={100}
                    />
                    <datalist id="models">
                      {[
                        ...new Set([
                          "gpt-4.1-mini",
                          "gpt-4.1",
                          ...serverModels,
                        ]),
                      ].map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <p className="help">
                      OpenAI загварын ID. Загварын эрх таны API бүртгэлээс
                      хамаарна.
                    </p>
                    <div className="field-label space-top">
                      Асуултын хувилбар
                    </div>
                    <div className="method-list">
                      {(Object.keys(methods) as Method[]).map((m, i) => (
                        <label
                          className={`method ${chosenMethods.includes(m) ? "chosen" : ""}`}
                          key={m}
                        >
                          <input
                            type="checkbox"
                            disabled={busy}
                            checked={chosenMethods.includes(m)}
                            onChange={() =>
                              setChosenMethods((prev) =>
                                prev.includes(m)
                                  ? prev.filter((v) => v !== m)
                                  : [...prev, m],
                              )
                            }
                          />
                          <span>
                            <strong>
                              {methods[m]}
                              <small>0{i + 1}</small>
                            </strong>
                            <span>
                              {m === "plain"
                                ? "Зөвхөн хэллэгийг өгнө"
                                : m === "context"
                                  ? "Хэрэглэсэн нөхцөлийг нэмнэ"
                                  : "Нөхцөл + тусдаа 2 жишээ өгнө"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="repeat-row">
                      <label className="field-label" htmlFor="repeat">
                        Давталтын тоо
                      </label>
                      <select
                        id="repeat"
                        value={repeats}
                        disabled={busy}
                        onChange={(e) => setRepeats(Number(e.target.value))}
                      >
                        <option value={1}>1 удаа</option>
                        <option value={2}>2 удаа</option>
                        <option value={3}>3 удаа</option>
                      </select>
                    </div>
                    <div className="run-summary">
                      <div>
                        <span>Нийт AI хүсэлт</span>
                        <strong>{tasks}</strong>
                      </div>
                      <small>
                        {selectedItems.length} хэллэг × {chosenMethods.length}{" "}
                        арга × {repeats} давталт
                      </small>
                    </div>
                    {busy ? (
                      <>
                        <progress max={progress.total} value={progress.done} />
                        <p className="help">
                          {progress.done} / {progress.total} хариу хадгалсан
                        </p>
                        <button className="button stop" onClick={stop}>
                          <Square size={16} />
                          Туршилт зогсоох
                        </button>
                      </>
                    ) : (
                      <button
                        className="button primary run"
                        disabled={
                          !ready || !tasks || tasks > 90 || !!storageError
                        }
                        onClick={run}
                      >
                        <Play size={17} fill="currentColor" />
                        Туршилт эхлүүлэх
                        <ArrowRight size={17} />
                      </button>
                    )}
                    <p className="help center">
                      Бодит API хүсэлт илгээнэ. Үйлчилгээний төлбөр таны OpenAI
                      бүртгэлд тооцогдоно.
                    </p>
                  </div>
                </section>
              </div>
              <section className="panel recent">
                <div className="panel-header">
                  <div>
                    <History size={18} />
                    <h2>Сүүлийн хариултууд</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("results")}
                  >
                    Бүгдийг харах
                    <ArrowRight size={15} />
                  </button>
                </div>
                {latest.length ? (
                  <div className="recent-list">
                    {latest.map((r) => (
                      <button
                        className="recent-item"
                        key={r.id}
                        onClick={() => setDetail(r)}
                      >
                        <span>
                          <strong>{r.item.text}</strong>
                          <small>
                            {methods[r.method]} · {r.model}
                          </small>
                        </span>
                        <Badge tone={r.review ? "green" : "neutral"}>
                          {r.review ? `${score(r.review)} / 6` : "Үнэлээгүй"}
                        </Badge>
                        <ChevronRight size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <Empty title="Эхний туршилт тань энд харагдана">
                    Хэллэг болон аргаа сонгоод туршилтаа эхлүүлээрэй.
                  </Empty>
                )}
              </section>
            </>
          )}
          {view === "dataset" && (
            <>
              <PageTitle
                eyebrow="ӨГӨГДЛИЙН САН"
                title="Үг бүр өөрийн түүхтэй."
                description="Хэллэг, хэрэглэсэн нөхцөл, хүлээгдэж буй утгыг нэг дор."
              />
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Сангаас хайх"
                    placeholder="Хэллэг хайх…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Ангилал"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["Бүгд", ...categories].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => importRef.current?.click()}
                >
                  <Upload size={16} />
                  Импорт
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      "utga-dataset.json",
                      JSON.stringify(state.items, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={16} />
                  JSON
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => {
                    setEditing(null);
                    setShowEditor(true);
                  }}
                >
                  <Plus size={17} />
                  Хэллэг нэмэх
                </button>
              </div>
              <div className="notice subtle">
                <Info size={18} />
                <span>
                  Эхлэх 24 жишээ нь баталгаажсан benchmark биш. Эх сурвалж,
                  тайлбарыг нягтлаад өөрийн өгөгдлөөр өргөжүүлээрэй.
                </span>
              </div>
              <div className="dataset-grid">
                {filtered.map((item) => (
                  <article className="panel dataset-card" key={item.id}>
                    <div className="phrase-meta">
                      <Badge>{item.category}</Badge>
                      <small>{item.id}</small>
                    </div>
                    <h2>“{item.text}”</h2>
                    <p>{item.context}</p>
                    <details>
                      <summary>Хүлээгдэж буй утга</summary>
                      <p>{item.expected}</p>
                      <small>{item.source}</small>
                    </details>
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setEditing(item);
                        setShowEditor(true);
                      }}
                    >
                      Засварлах
                      <ArrowUpRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
              {filtered.length === 0 && (
                <Empty title="Хэллэг олдсонгүй">
                  Хайлт эсвэл ангиллаа өөрчилнө үү.
                </Empty>
              )}
            </>
          )}
          {view === "review" && (
            <>
              <PageTitle
                eyebrow="ХҮНИЙ ҮНЭЛГЭЭ"
                title="Ойлголтыг хүн үнэлнэ."
                description="Хариултыг гурван шалгуураар, тус бүр 0–2 оноогоор үнэлнэ."
              />
              <div className="toolbar">
                <label className="inline-label">
                  Үнэлэгчийн код
                  <input
                    className="input"
                    placeholder="Жишээ: R01"
                    aria-label="Үнэлэгчийн код"
                    value={reviewer}
                    maxLength={80}
                    onChange={(e) => setReviewer(e.target.value)}
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={blind}
                    onChange={(e) => setBlind(e.target.checked)}
                  />
                  Загвар, аргыг нуух
                </label>
                <Badge>{pending.length} хүлээгдэж байна</Badge>
              </div>
              {reviewResult ? (
                <div className="review-grid">
                  <section className="panel review-answer">
                    <div className="panel-header">
                      <h2>Үнэлэх хариулт</h2>
                      <Badge>{reviewResult.item.category}</Badge>
                    </div>
                    <div className="panel-body">
                      <h2 className="quote">“{reviewResult.item.text}”</h2>
                      <p>{reviewResult.item.context}</p>
                      <div className="reference">
                        <span className="small-label">ЛАВЛАХ ТАЙЛБАР</span>
                        <p>{reviewResult.item.expected}</p>
                        <small>{reviewResult.item.source}</small>
                      </div>
                      <div className="ai-answer">
                        <span className="small-label">AI ХАРИУЛТ</span>
                        <h3>{reviewResult.answer}</h3>
                        <p>{reviewResult.explanation}</p>
                      </div>
                      {!blind && (
                        <p className="help">
                          {reviewResult.model} · {methods[reviewResult.method]}{" "}
                          · {reviewResult.repeat}-р давталт
                        </p>
                      )}
                    </div>
                  </section>
                  <section className="panel rubric">
                    <div className="panel-header">
                      <h2>Үнэлгээний хуудас</h2>
                      <span className="muted">/ 6</span>
                    </div>
                    <div className="panel-body">
                      {(
                        [
                          {
                            key: "meaning",
                            label: "Утгын зөв байдал",
                            help: "Гол санааг зөв тайлбарласан уу?",
                          },
                          {
                            key: "context",
                            label: "Нөхцөл, соёлын нийцэл",
                            help: "Тухайн нөхцөлд тохирсон утгыг гаргасан уу?",
                          },
                          {
                            key: "clarity",
                            label: "Тайлбарын ойлгомж",
                            help: "Тайлбар нь тодорхой, зөрчилгүй юу?",
                          },
                        ] as const
                      ).map((c) => (
                        <fieldset className="score-field" key={c.key}>
                          <legend>{c.label}</legend>
                          <p>{c.help}</p>
                          <div>
                            {[0, 1, 2].map((n) => (
                              <label
                                className={
                                  reviewForm[c.key] === n
                                    ? "score-option active"
                                    : "score-option"
                                }
                                key={n}
                              >
                                <input
                                  type="radio"
                                  name={c.key}
                                  value={n}
                                  checked={reviewForm[c.key] === n}
                                  onChange={() =>
                                    setReviewForm({ ...reviewForm, [c.key]: n })
                                  }
                                />
                                <b>{n}</b>
                                <span>
                                  {["Хангаагүй", "Хэсэгчлэн", "Бүрэн"][n]}
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                      ))}
                      <label className="field-label" htmlFor="errorType">
                        Алдааны төрөл
                      </label>
                      <select
                        id="errorType"
                        value={reviewForm.errorType}
                        onChange={(e) =>
                          setReviewForm({
                            ...reviewForm,
                            errorType: e.target.value,
                          })
                        }
                      >
                        {[
                          "Алдаа ажиглагдаагүй",
                          "Шууд утгаар ойлгосон",
                          "Нөхцөлийг буруу ойлгосон",
                          "Соёлын тайлбар зөрсөн",
                          "Баримт зохиосон",
                          "Утга тодорхойгүй",
                          "Бусад",
                        ].map((e) => (
                          <option key={e}>{e}</option>
                        ))}
                      </select>
                      <label
                        className="field-label space-top"
                        htmlFor="reviewNote"
                      >
                        Тэмдэглэл
                      </label>
                      <textarea
                        id="reviewNote"
                        rows={3}
                        maxLength={2000}
                        placeholder="Онооны үндэслэл…"
                        value={reviewForm.note}
                        onChange={(e) =>
                          setReviewForm({ ...reviewForm, note: e.target.value })
                        }
                      />
                      <button
                        className="button primary run"
                        onClick={saveReview}
                      >
                        <Check size={17} />
                        Хадгалаад дараагийнх
                      </button>
                    </div>
                  </section>
                </div>
              ) : (
                <Empty
                  title={
                    state.results.length
                      ? "Бүх хариултыг үнэллээ"
                      : "Үнэлэх хариулт хараахан алга"
                  }
                >
                  {state.results.length
                    ? "Үр дүн хэсгээс харьцуулалтаа харна уу."
                    : "Эхлээд AI туршилт ажиллуулна уу."}
                </Empty>
              )}
            </>
          )}
          {view === "results" && (
            <>
              <PageTitle
                eyebrow="СУДАЛГААНЫ ҮР ДҮН"
                title="Ялгааг өгөгдлөөс харъя."
                description="Бодит AI хариулт, хүний оноо, хугацаа болон токены хэрэглээ."
              />
              <div className="toolbar">
                <select
                  aria-label="Туршилт шүүх"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                >
                  <option value="all">Бүх туршилт</option>
                  {batches.map((b, i) => (
                    <option key={b} value={b}>
                      Туршилт {batches.length - i} · {b.slice(0, 8)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Аргаар шүүх"
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value)}
                >
                  <option value="all">Бүх арга</option>
                  {Object.entries(methods).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <button
                  className="button secondary"
                  disabled={!filteredResults.length}
                  onClick={() =>
                    download(
                      "utga-results.csv",
                      toCsv(filteredResults),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Download size={16} />
                  CSV татах
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    download(
                      "utga-backup.json",
                      JSON.stringify(state, null, 2),
                      "application/json",
                    )
                  }
                >
                  <Download size={16} />
                  JSON нөөц
                </button>
              </div>
              {state.results.length ? (
                <>
                  <section className="panel comparison">
                    <div className="panel-header">
                      <h2>Асуултын аргын харьцуулалт</h2>
                      <Badge>Хүний оноо / 6</Badge>
                    </div>
                    <div className="panel-body">
                      {Object.entries(methods).map(([key, label]) => {
                        const rs = filteredResults.filter(
                          (r) => r.method === key,
                        );
                        const n = rs.filter((r) => r.review).length;
                        const avg = meanScore(rs);
                        return (
                          <div className="comparison-row" key={key}>
                            <div>
                              <strong>{label}</strong>
                              <small>
                                {n} үнэлсэн / {rs.length} хариулт
                              </small>
                            </div>
                            <div className="bar-track">
                              <span
                                style={{
                                  width: `${avg === null ? 0 : (avg / 6) * 100}%`,
                                }}
                              />
                            </div>
                            <b>{avg === null ? "—" : avg.toFixed(2)}</b>
                          </div>
                        );
                      })}
                      <p className="help">
                        Энэ нь тайлбарлах статистик. Өөр загвар, хэллэг, давталт
                        холилдсон бол шууд дүгнэлт хийхгүй; ижил туршилтыг шүүж,
                        ижил өгөгдөлтэй аргуудыг харьцуулна.
                      </p>
                    </div>
                  </section>
                  <section className="panel table-panel">
                    <div className="panel-header">
                      <h2>Хариултын бүртгэл</h2>
                      <Badge>{filteredResults.length} бичлэг</Badge>
                    </div>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Хэллэг</th>
                            <th>Арга / загвар</th>
                            <th>Хүний оноо</th>
                            <th>Хугацаа</th>
                            <th>Огноо</th>
                            <th>Дэлгэрэнгүй</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...filteredResults].reverse().map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>{r.item.text}</strong>
                                <small>
                                  {r.item.category} · давталт {r.repeat}
                                </small>
                              </td>
                              <td>
                                {methods[r.method]}
                                <small>{r.model}</small>
                              </td>
                              <td>
                                {r.review ? (
                                  <Badge tone="green">
                                    {score(r.review)} / 6
                                  </Badge>
                                ) : (
                                  <Badge>Үнэлээгүй</Badge>
                                )}
                              </td>
                              <td>{(r.latencyMs / 1000).toFixed(1)} сек</td>
                              <td>{date(r.createdAt)}</td>
                              <td>
                                <button
                                  aria-label={`${r.item.text} дэлгэрэнгүй`}
                                  className="icon-button"
                                  onClick={() => setDetail(r)}
                                >
                                  <Eye size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              ) : (
                <Empty title="Хэмжилт хараахан хийгдээгүй">
                  Туршилтаа ажиллуулаад хариултад хүний үнэлгээ өгснөөр
                  харьцуулалт гарна.
                </Empty>
              )}
            </>
          )}
          {view === "guide" && (
            <>
              <PageTitle
                eyebrow="СУДАЛГААНЫ АРГА ЗҮЙ"
                title="Сайн асуултаас сайн судалгаа."
                description="Монгол ахуй, далд утгатай хэллэгийг AI ойлгох чадварын үнэлгээ."
              />
              <div className="guide-grid">
                <section className="panel prose">
                  <h2>Судалгааны дараалал</h2>
                  <ol>
                    <li>
                      <strong>Өгөгдлөө баталгаажуулах.</strong> Дөрвөн ангилалд
                      тэнцвэртэй хэллэг сонгож, нөхцөл болон лавлах тайлбарыг
                      хоёр монгол хэлний мэргэжилтнээр нягтлуул.
                    </li>
                    <li>
                      <strong>Таамаглалаа тодорхойлох.</strong> «Нөхцөл нэмэхэд
                      ёгтлолын утгыг тайлбарлах хүний оноо өсөх үү?» гэх мэт
                      хэмжигдэх асуулт сонго.
                    </li>
                    <li>
                      <strong>Ижил нөхцөлд турших.</strong> Ижил загвар, хэллэг,
                      давталтаар гурван аргыг ажиллуул. Хүсэлтийн дарааллыг
                      санамсаргүй хольдог.
                    </li>
                    <li>
                      <strong>Хүний үнэлгээ хийх.</strong> Загвар, аргын нэрийг
                      нууж, шалгуур бүрд 0–2 оноо өг. Лавлах тайлбар нь эхний
                      хувилбар байж болохыг тооц.
                    </li>
                    <li>
                      <strong>Харьцуулж тайлагнах.</strong> CSV-ээс хэллэгээр
                      хослуулсан шинжилгээ хий. Давталтуудыг бие даасан хэллэг
                      мэт тооцохгүй. Ангилал тус бүрийн алдааг тайлбарла.
                    </li>
                  </ol>
                </section>
                <section className="panel prose">
                  <h2>Шударга туршилтын нөхцөл</h2>
                  <p>
                    Лавлах хариулт, ангилал, эх сурвалжийг AI руу илгээдэггүй.
                    Жишээтэй аргад сангаас тусдаа хоёр жишээ хэрэглэнэ. Тэр хоёр
                    хэллэгийг тестийн санд бүү нэм.
                  </p>
                  <p>
                    Шууд асуултад нөхцөл өгөхгүй тул олон утгатай хэллэгийн
                    оноог тусад нь тайлбарла. Үнэлгээ нь таны өгсөн нөхцөлийн
                    утгад нийцлийг хэмжинэ.
                  </p>
                  <p>
                    Одоогийн хувилбар нэг хариултад нэг идэвхтэй хүний үнэлгээ
                    хадгална. Олон үнэлэгчийн судалгаанд тус тусдаа нөөц файл
                    ашиглаж, хариултын ID-аар нэгтгэнэ.
                  </p>
                  <p>
                    Энэ нь OpenAI загвар болон асуултын аргуудыг харьцуулах
                    хэрэгсэл. Бусад үйлчилгээний загварын API одоогоор
                    холбогдоогүй.
                  </p>
                  <a
                    href="https://aclanthology.org/2026.findings-acl.1449/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Холбогдох ажил: MonCulture-Eval ↗
                  </a>
                </section>
                <section className="panel prose">
                  <h2>Өгөгдөл ба нууцлал</h2>
                  <p>
                    Хэллэг, AI хариу, үнэлгээ энэ төхөөрөмжийн энэ хөтөчид
                    хадгалагдана. Төхөөрөмж хооронд автоматаар синк хийхгүй.
                    JSON нөөцөө тогтмол татаж авна.
                  </p>
                  <p>
                    AI хүсэлтэд хэллэг ба сонгосон нөхцөл OpenAI руу дамжина.
                    API түлхүүр хөтчийн байнгын хадгалалтад орохгүй; хуудсыг
                    шинэчлэхэд арилна.
                  </p>
                  <p>
                    Хариу бүрд бодит загварын нэр, prompt, хугацаа, токены тоо,
                    огноо, response ID хадгална. Зохиомол үр дүн үүсгэдэггүй.
                  </p>
                </section>
                <section className="panel prose">
                  <h2>JSON импортын загвар</h2>
                  <p>
                    Хэллэг нэмэхэд дараах бүтэцтэй массив ашиглана. Нөөц файлыг
                    импортлоход зөвхөн шинэ ID-тай бичлэгүүд нэмэгдэнэ.
                  </p>
                  <pre>
                    {JSON.stringify(
                      [
                        {
                          id: "CUSTOM-001",
                          text: "Таны хэллэг",
                          category: "Хэлц үг",
                          context: "Хэрэглэсэн бодит нөхцөл",
                          expected: "Шинжээчийн лавлах тайлбар",
                          source: "Эх сурвалж, хуудас эсвэл цуглуулсан огноо",
                        },
                      ],
                      null,
                      2,
                    )}
                  </pre>
                  <button
                    className="button secondary"
                    onClick={() =>
                      download(
                        "utga-import-template.json",
                        JSON.stringify(
                          [
                            {
                              id: "CUSTOM-001",
                              text: "Таны хэллэг",
                              category: "Хэлц үг",
                              context: "Хэрэглэсэн бодит нөхцөл",
                              expected: "Шинжээчийн лавлах тайлбар",
                              source: "Эх сурвалж",
                            },
                          ],
                          null,
                          2,
                        ),
                        "application/json",
                      )
                    }
                  >
                    <Download size={16} />
                    Загвар татах
                  </button>
                </section>
              </div>
            </>
          )}
          {view === "settings" && (
            <>
              <PageTitle
                eyebrow="ТОХИРГОО"
                title="Судалгааны орчноо бэлдэе."
                description="AI холболтоо тохируулж, өгөгдлийн нөөцөө удирдана."
              />
              <div className="settings-grid">
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <KeyRound size={19} />
                      <h2>AI холболт</h2>
                    </div>
                    <Badge tone={connectionReady ? "green" : "neutral"}>
                      {connectionReady ? "Бэлэн" : "Тохируулаагүй"}
                    </Badge>
                  </div>
                  <div className="panel-body">
                    <label className="field-label" htmlFor="connection">
                      Холболтын төрөл
                    </label>
                    <select
                      id="connection"
                      value={connection}
                      disabled={busy}
                      onChange={(e) =>
                        setConnection(e.target.value as "own" | "shared")
                      }
                    >
                      <option value="own">Өөрийн OpenAI API түлхүүр</option>
                      <option value="shared" disabled={!shared}>
                        Судалгааны хамтын холболт
                        {!shared ? " · тохируулаагүй" : ""}
                      </option>
                    </select>
                    {connection === "own" ? (
                      <>
                        <label
                          className="field-label space-top"
                          htmlFor="apiKey"
                        >
                          OpenAI API түлхүүр
                        </label>
                        <input
                          id="apiKey"
                          className="input"
                          type="password"
                          autoComplete="off"
                          placeholder="sk-…"
                          value={apiKey}
                          disabled={busy}
                          onChange={(e) => setApiKey(e.target.value)}
                          maxLength={512}
                        />
                        <p className="help">
                          Зөвхөн энэ нээлттэй хуудсанд санана. Шинэчлэхэд
                          арилна.
                        </p>
                        <label className="check-label consent">
                          <input
                            type="checkbox"
                            checked={keyConsent}
                            disabled={busy}
                            onChange={(e) => setKeyConsent(e.target.checked)}
                          />
                          <span>
                            Хэллэг, нөхцөл болон API түлхүүрийг энэ сайтын
                            серверээр дамжуулан OpenAI-д илгээж, API төлбөр
                            өөрийн бүртгэлд тооцогдохыг ойлгосон.
                          </span>
                        </label>
                      </>
                    ) : (
                      <>
                        <label
                          className="field-label space-top"
                          htmlFor="password"
                        >
                          Судалгааны нууц үг
                        </label>
                        <input
                          id="password"
                          className="input"
                          type="password"
                          autoComplete="off"
                          value={password}
                          disabled={busy}
                          onChange={(e) => setPassword(e.target.value)}
                          maxLength={200}
                        />
                        <p className="help">
                          Серверийн холболт хамгаалагдсан. Нууц үгийг судалгааны
                          эзэмшигчээс авна.
                        </p>
                      </>
                    )}
                    <div className="button-row">
                      <button
                        className="button primary"
                        disabled={!connectionReady}
                        onClick={() => {
                          setView("experiment");
                          setNotice(
                            "Холболтын мэдээллийг энэ хуудсанд саналаа. Эхний хүсэлтээр API эрхийг шалгана.",
                          );
                        }}
                      >
                        <Check size={16} />
                        Туршилтад очих
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy}
                        onClick={() => {
                          setApiKey("");
                          setPassword("");
                          setKeyConsent(false);
                          setNotice("Холболтын мэдээллийг арилгалаа.");
                        }}
                      >
                        Салгах
                      </button>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h2>Өгөгдлийн хадгалалт</h2>
                  </div>
                  <div className="panel-body">
                    <Badge>Энэ хөтөчид</Badge>
                    <p className="settings-copy">
                      {state.items.length} хэллэг, {state.results.length}{" "}
                      хариулт хадгалагдаж байна. Хөтчийн өгөгдөл устгавал
                      арилна. JSON нөөц нь бүх хариулт, үнэлгээг багтаана.
                    </p>
                    <div className="button-row">
                      <button
                        className="button secondary"
                        onClick={() =>
                          download(
                            "utga-backup.json",
                            JSON.stringify(state, null, 2),
                            "application/json",
                          )
                        }
                      >
                        <Download size={16} />
                        Нөөц татах
                      </button>
                      <button
                        className="button secondary"
                        disabled={busy || !!storageError}
                        onClick={() => importRef.current?.click()}
                      >
                        <Upload size={16} />
                        Нөөц нэгтгэх
                      </button>
                    </div>
                    <div className="divider" />
                    <p className="help">
                      Бүх өгөгдлийг цэвэрлэхэд эхлэх 24 хэллэг үлдэнэ. JSON
                      нөөцтэй бол буцааж импортлох боломжтой.
                    </p>
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={16} />
                      Орчныг цэвэрлэх
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          <footer>
            <span>
              утга.{" "}
              <span className="muted">Монгол хэл ба хиймэл оюуны судалгаа</span>
            </span>
            <span>Судалгааны хувилбар 1.0</span>
          </footer>
        </main>
      </div>
      {showEditor && (
        <Modal
          title={editing ? "Хэллэг засварлах" : "Шинэ хэллэг"}
          onClose={() => setShowEditor(false)}
        >
          <form onSubmit={addItem} className="editor-form">
            <label>
              Хэллэг
              <textarea
                name="text"
                required
                minLength={3}
                maxLength={1000}
                defaultValue={editing?.text}
                rows={2}
              />
            </label>
            <label>
              Ангилал
              <select
                name="category"
                defaultValue={editing?.category || "Хэлц үг"}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Хэрэглэсэн нөхцөл
              <textarea
                name="context"
                required
                minLength={3}
                maxLength={2000}
                defaultValue={editing?.context}
                rows={3}
              />
            </label>
            <label>
              Хүлээгдэж буй утга
              <textarea
                name="expected"
                required
                minLength={3}
                maxLength={2000}
                defaultValue={editing?.expected}
                rows={3}
              />
            </label>
            <label>
              Эх сурвалж
              <input
                className="input"
                name="source"
                required
                minLength={2}
                maxLength={500}
                defaultValue={editing?.source}
              />
            </label>
            <button className="button primary" type="submit">
              <Check size={17} />
              Хадгалах
            </button>
          </form>
        </Modal>
      )}
      {detail && (
        <Modal title="Хариултын дэлгэрэнгүй" onClose={() => setDetail(null)}>
          <Badge>{detail.item.category}</Badge>
          <h2 className="quote">“{detail.item.text}”</h2>
          <p>{detail.item.context}</p>
          <div className="ai-answer">
            <h3>{detail.answer}</h3>
            <p>{detail.explanation}</p>
          </div>
          <p className="help">
            {detail.model} · {methods[detail.method]} ·{" "}
            {(detail.latencyMs / 1000).toFixed(1)} сек · {detail.inputTokens}{" "}
            оролт / {detail.outputTokens} гаралтын токен
          </p>
          <details>
            <summary>Илгээсэн prompt</summary>
            <pre>{detail.prompt}</pre>
          </details>
          <div className="reference">
            <strong>Лавлах утга</strong>
            <p>{detail.item.expected}</p>
          </div>
          {detail.review && (
            <div className="reference">
              <strong>
                Хүний оноо: {score(detail.review)} / 6 ·{" "}
                {detail.review.reviewer}
              </strong>
              <p>{detail.review.errorType}</p>
              <p>{detail.review.note}</p>
            </div>
          )}
          <button
            className="button secondary"
            onClick={() => {
              setReviewId(detail.id);
              if (detail.review) {
                setReviewer(detail.review.reviewer);
                setReviewForm({ ...detail.review });
              } else {
                setReviewForm({
                  meaning: -1,
                  context: -1,
                  clarity: -1,
                  errorType: "Алдаа ажиглагдаагүй",
                  note: "",
                });
              }
              setDetail(null);
              setView("review");
            }}
          >
            <CheckCheck size={16} />
            {detail.review ? "Үнэлгээг шинэчлэх" : "Хүний үнэлгээ өгөх"}
          </button>
        </Modal>
      )}
      {confirmDelete && (
        <Modal
          title="Өгөгдлөө цэвэрлэх үү?"
          onClose={() => setConfirmDelete(false)}
        >
          <p>
            Энэ хөтөчид хадгалсан {state.results.length} хариулт, үнэлгээ болон
            нэмсэн хэллэгүүд арилна. Эхлээд JSON нөөцөө татаж аваарай.
          </p>
          <div className="button-row">
            <button
              className="button secondary"
              onClick={() =>
                download(
                  "utga-backup.json",
                  JSON.stringify(state, null, 2),
                  "application/json",
                )
              }
            >
              <Download size={16} />
              Нөөц татах
            </button>
            <button
              className="button danger"
              onClick={() => {
                try {
                  localStorage.setItem(storageKey, JSON.stringify(initial));
                  stateRef.current = initial;
                  setState(initial);
                  setStorageError("");
                  setSelected(["MN-001", "MN-007", "MN-013"]);
                  setCurrentBatch("");
                  setConfirmDelete(false);
                  setNotice("Орчныг цэвэрлэлээ.");
                } catch {
                  setNotice("Хадгалалтад хандаж чадсангүй.");
                }
              }}
            >
              Тийм, цэвэрлэх
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Stat({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="stat">
      <div>
        <span>{title}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <small>{subtitle}</small>
    </section>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="panel-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Хаах" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      <div className="panel-body">{children}</div>
    </dialog>
  );
}
