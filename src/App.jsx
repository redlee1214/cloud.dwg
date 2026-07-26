import React, { useState, useEffect, useRef, useCallback } from "react";
import { storage, localIdentity } from "./storage";
import { Check, Plus, Trash2, Baby, Home as HomeIcon, Sparkles, ShoppingCart, Pencil, Zap, Package, Wrench, PartyPopper, ListChecks, Sofa, ShoppingBag, Backpack } from "lucide-react";

const PEOPLE = {
  DJ: { label: "DJ", color: "#4C6B87" },
  JS: { label: "JS", color: "#C97B84" },
};

const CATEGORIES = {
  ALL: { label: "전체", color: "#2E3532" },
  CHILDCARE: { label: "육아", color: "#D9A441", icon: Baby },
  HOUSEHOLD: { label: "집안일", color: "#75886B", icon: HomeIcon },
  REPAIR: { label: "집수리", color: "#A65B4B", icon: Wrench },
  ETC: { label: "기타", color: "#8C8577", icon: Sparkles },
};

const SHOP_CATEGORIES = {
  ALL: { label: "전체", color: "#2E3532" },
  DAILY: { label: "생필품", color: "#75886B", icon: Package },
  APPLIANCE: { label: "가전제품", color: "#4C6B87", icon: Zap },
  INTERIOR: { label: "인테리어", color: "#A6785C", icon: Sofa },
  SON: { label: "도운", color: "#D9A441", icon: Baby },
  ETC: { label: "기타", color: "#8C8577", icon: Sparkles },
};

const EVENT_COLOR = "#7C6FA0";

// 죽전(부모님 댁) 임시 탭 - 나중에 필요 없어지면 이 블록과 관련 UI만 지우면 됨
const JUKJEON_CATEGORIES = {
  ALL: { label: "전체", color: "#2E3532" },
  BUY: { label: "구매", color: "#4C6B87", icon: ShoppingBag },
  BRING: { label: "챙길 것", color: "#A6785C", icon: Backpack },
};

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function parseYMD(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatEventDate(dateStr, endDateStr) {
  if (!dateStr) return null;
  const start = parseYMD(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startLabel = `${start.getMonth() + 1}월 ${start.getDate()}일 (${WEEKDAYS_KO[start.getDay()]})`;

  const hasRange = endDateStr && endDateStr !== dateStr;
  if (!hasRange) {
    const diffDays = Math.round((start - today) / 86400000);
    let dday;
    if (diffDays === 0) dday = "D-DAY";
    else if (diffDays > 0) dday = `D-${diffDays}`;
    else dday = `D+${Math.abs(diffDays)}`;
    return { label: startLabel, dday, isPast: diffDays < 0, isOngoing: false };
  }

  const end = parseYMD(endDateStr);
  const endLabel = `${end.getMonth() + 1}월 ${end.getDate()}일 (${WEEKDAYS_KO[end.getDay()]})`;
  const label = `${startLabel} ~ ${endLabel}`;

  const diffToStart = Math.round((start - today) / 86400000);
  const diffToEnd = Math.round((end - today) / 86400000);

  let dday, isOngoing = false, isPast = false;
  if (diffToStart > 0) {
    dday = `D-${diffToStart}`;
  } else if (diffToEnd >= 0) {
    dday = "진행중";
    isOngoing = true;
  } else {
    dday = `D+${Math.abs(diffToEnd)}`;
    isPast = true;
  }

  return { label, dday, isPast, isOngoing };
}

const FONT_LINK_ID = "our-home-fonts";

// 저장/불러오기가 가끔 실패할 때를 대비해 잠깐 기다렸다가 다시 시도
async function withRetry(fn, retries = 3, delayMs = 500) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < retries) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap";
    document.head.appendChild(link);

    const pretendard = document.createElement("link");
    pretendard.rel = "stylesheet";
    pretendard.href =
      "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css";
    document.head.appendChild(pretendard);
  }, []);
}

function StampCheck({ color, active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" style={{ display: "block" }}>
      <circle
        cx="11"
        cy="11"
        r="9.5"
        fill={active ? color : "transparent"}
        stroke={active ? color : "#C9C4B8"}
        strokeWidth="1.6"
      />
      {active && (
        <path
          d="M6.5 11.2L9.5 14.2L15.5 7.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

export default function App() {
  useFonts();
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("todo"); // 'todo' | 'shopping'

  const [items, setItems] = useState([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [text, setText] = useState("");
  const [addCat, setAddCat] = useState("CHILDCARE");
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [todoDraft, setTodoDraft] = useState("");

  const [shopItems, setShopItems] = useState([]);
  const [activeShopCat, setActiveShopCat] = useState("ALL");
  const [shopText, setShopText] = useState("");
  const [addShopCat, setAddShopCat] = useState("DAILY");
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingShopNameId, setEditingShopNameId] = useState(null);
  const [shopNameDraft, setShopNameDraft] = useState("");
  const [shopCatDraft, setShopCatDraft] = useState("DAILY");
  const [noteDraft, setNoteDraft] = useState("");

  const [eventItems, setEventItems] = useState([]);
  const [eventText, setEventText] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [showEventEndDate, setShowEventEndDate] = useState(false);

  // 죽전 임시 탭 상태
  const [jukjeonItems, setJukjeonItems] = useState([]);
  const [activeJukjeonCat, setActiveJukjeonCat] = useState("ALL");
  const [jukjeonText, setJukjeonText] = useState("");
  const [addJukjeonCat, setAddJukjeonCat] = useState("BUY");
  const [editingJukjeonId, setEditingJukjeonId] = useState(null);
  const [jukjeonDraft, setJukjeonDraft] = useState("");
  const jukjeonInputRef = useRef(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventDraftText, setEventDraftText] = useState("");
  const [eventDraftDate, setEventDraftDate] = useState("");
  const [eventDraftEndDate, setEventDraftEndDate] = useState("");
  const eventInputRef = useRef(null);

  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const shopInputRef = useRef(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const localMe = localIdentity.get();
      if (localMe) setMe(localMe);
    } catch (e) {}
    try {
      const res = await withRetry(() => storage.get("checklist-items")).catch(() => null);
      if (res && res.value) setItems(JSON.parse(res.value));
    } catch (e) {}
    try {
      const res2 = await withRetry(() => storage.get("shopping-items")).catch(() => null);
      if (res2 && res2.value) setShopItems(JSON.parse(res2.value));
    } catch (e) {}
    try {
      const res3 = await withRetry(() => storage.get("event-items")).catch(() => null);
      if (res3 && res3.value) setEventItems(JSON.parse(res3.value));
    } catch (e) {}
    try {
      const res4 = await withRetry(() => storage.get("jukjeon-items")).catch(() => null);
      if (res4 && res4.value) setJukjeonItems(JSON.parse(res4.value));
    } catch (e) {}
    setLoading(false);
  }, []);

  // 상대방이 체크/추가한 내용을 반영하기 위해 조용히 최신 데이터만 다시 불러옴
  // (로딩 스피너나 identity는 건드리지 않음)
  const syncShared = useCallback(async () => {
    try {
      const res = await withRetry(() => storage.get("checklist-items"), 1, 400).catch(() => null);
      if (res && res.value) setItems(JSON.parse(res.value));
    } catch (e) {}
    try {
      const res2 = await withRetry(() => storage.get("shopping-items"), 1, 400).catch(() => null);
      if (res2 && res2.value) setShopItems(JSON.parse(res2.value));
    } catch (e) {}
    try {
      const res3 = await withRetry(() => storage.get("event-items"), 1, 400).catch(() => null);
      if (res3 && res3.value) setEventItems(JSON.parse(res3.value));
    } catch (e) {}
    try {
      const res4 = await withRetry(() => storage.get("jukjeon-items"), 1, 400).catch(() => null);
      if (res4 && res4.value) setJukjeonItems(JSON.parse(res4.value));
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!me) return;
    const intervalId = setInterval(syncShared, 4000);
    const onVisible = () => {
      if (document.visibilityState === "visible") syncShared();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [me, syncShared]);

  const persist = useCallback(async (next) => {
    setItems(next);
    try {
      const result = await withRetry(() => storage.set("checklist-items", JSON.stringify(next)));
      if (!result) setError("저장에 실패했어요. 다시 시도해주세요.");
      else setError("");
    } catch (e) {
      setError("저장이 안 됐어요. 재시도했지만 실패했어요 — 다시 눌러봐 주세요.");
    }
  }, []);

  const persistShop = useCallback(async (next) => {
    setShopItems(next);
    try {
      const result = await withRetry(() => storage.set("shopping-items", JSON.stringify(next)));
      if (!result) setError("저장에 실패했어요. 다시 시도해주세요.");
      else setError("");
    } catch (e) {
      setError("저장이 안 됐어요. 재시도했지만 실패했어요 — 다시 눌러봐 주세요.");
    }
  }, []);

  const chooseIdentity = async (key) => {
    setMe(key);
    try {
      localIdentity.set(key);
    } catch (e) {}
  };

  const addItem = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        category: addCat,
        done: false,
        doneBy: null,
        createdBy: me,
        createdAt: Date.now(),
      },
      ...items,
    ];
    persist(next);
    setText("");
    inputRef.current?.focus();
  };

  const toggleItem = (id) => {
    const next = items.map((it) =>
      it.id === id
        ? { ...it, done: !it.done, doneBy: !it.done ? me : null, doneAt: !it.done ? Date.now() : null }
        : it
    );
    persist(next);
  };

  const deleteItem = (id) => persist(items.filter((it) => it.id !== id));

  const startEditTodo = (it) => {
    setEditingTodoId(it.id);
    setTodoDraft(it.text);
  };

  const saveEditTodo = (id) => {
    const trimmed = todoDraft.trim();
    if (trimmed) {
      persist(items.map((it) => (it.id === id ? { ...it, text: trimmed } : it)));
    }
    setEditingTodoId(null);
  };

  const addShopItem = () => {
    const trimmed = shopText.trim();
    if (!trimmed) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: trimmed,
        note: "",
        category: addShopCat,
        bought: false,
        boughtBy: null,
        createdBy: me,
        createdAt: Date.now(),
      },
      ...shopItems,
    ];
    persistShop(next);
    setShopText("");
    shopInputRef.current?.focus();
  };

  const toggleShopItem = (id) => {
    const next = shopItems.map((it) =>
      it.id === id
        ? { ...it, bought: !it.bought, boughtBy: !it.bought ? me : null, boughtAt: !it.bought ? Date.now() : null }
        : it
    );
    persistShop(next);
  };

  const deleteShopItem = (id) => persistShop(shopItems.filter((it) => it.id !== id));

  const startEditNote = (it) => {
    setEditingNoteId(it.id);
    setNoteDraft(it.note || "");
  };

  const saveNote = (id) => {
    const next = shopItems.map((it) => (it.id === id ? { ...it, note: noteDraft.trim() } : it));
    persistShop(next);
    setEditingNoteId(null);
  };

  const startEditShopName = (it) => {
    setEditingShopNameId(it.id);
    setShopNameDraft(it.name);
    setShopCatDraft(it.category);
  };

  const saveEditShopName = (id) => {
    const trimmed = shopNameDraft.trim();
    if (trimmed) {
      persistShop(
        shopItems.map((it) => (it.id === id ? { ...it, name: trimmed, category: shopCatDraft } : it))
      );
    }
    setEditingShopNameId(null);
  };

  const persistEvent = useCallback(async (next) => {
    setEventItems(next);
    try {
      const result = await withRetry(() => storage.set("event-items", JSON.stringify(next)));
      if (!result) setError("저장에 실패했어요. 다시 시도해주세요.");
      else setError("");
    } catch (e) {
      setError("저장이 안 됐어요. 재시도했지만 실패했어요 — 다시 눌러봐 주세요.");
    }
  }, []);

  const addEvent = () => {
    const trimmed = eventText.trim();
    if (!trimmed) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        date: eventDate || null,
        endDate: eventEndDate || null,
        done: false,
        doneBy: null,
        createdBy: me,
        createdAt: Date.now(),
      },
      ...eventItems,
    ];
    persistEvent(next);
    setEventText("");
    setEventDate("");
    setEventEndDate("");
    setShowEventEndDate(false);
    eventInputRef.current?.focus();
  };

  const toggleEvent = (id) => {
    const next = eventItems.map((it) =>
      it.id === id
        ? { ...it, done: !it.done, doneBy: !it.done ? me : null, doneAt: !it.done ? Date.now() : null }
        : it
    );
    persistEvent(next);
  };

  const deleteEvent = (id) => persistEvent(eventItems.filter((it) => it.id !== id));

  const startEditEvent = (it) => {
    setEditingEventId(it.id);
    setEventDraftText(it.text);
    setEventDraftDate(it.date || "");
    setEventDraftEndDate(it.endDate || "");
  };

  const saveEditEvent = (id) => {
    const trimmed = eventDraftText.trim();
    if (trimmed) {
      persistEvent(
        eventItems.map((it) =>
          it.id === id
            ? { ...it, text: trimmed, date: eventDraftDate || null, endDate: eventDraftEndDate || null }
            : it
        )
      );
    }
    setEditingEventId(null);
  };

  // 죽전 임시 탭 함수들
  const persistJukjeon = useCallback(async (next) => {
    setJukjeonItems(next);
    try {
      const result = await withRetry(() => storage.set("jukjeon-items", JSON.stringify(next)));
      if (!result) setError("저장에 실패했어요. 다시 시도해주세요.");
      else setError("");
    } catch (e) {
      setError("저장이 안 됐어요. 재시도했지만 실패했어요 — 다시 눌러봐 주세요.");
    }
  }, []);

  const addJukjeon = () => {
    const trimmed = jukjeonText.trim();
    if (!trimmed) return;
    const next = [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: trimmed,
        category: addJukjeonCat,
        done: false,
        doneBy: null,
        createdBy: me,
        createdAt: Date.now(),
      },
      ...jukjeonItems,
    ];
    persistJukjeon(next);
    setJukjeonText("");
    jukjeonInputRef.current?.focus();
  };

  const toggleJukjeon = (id) => {
    const next = jukjeonItems.map((it) =>
      it.id === id
        ? { ...it, done: !it.done, doneBy: !it.done ? me : null, doneAt: !it.done ? Date.now() : null }
        : it
    );
    persistJukjeon(next);
  };

  const deleteJukjeon = (id) => persistJukjeon(jukjeonItems.filter((it) => it.id !== id));

  const startEditJukjeon = (it) => {
    setEditingJukjeonId(it.id);
    setJukjeonDraft(it.text);
  };

  const saveEditJukjeon = (id) => {
    const trimmed = jukjeonDraft.trim();
    if (trimmed) {
      persistJukjeon(jukjeonItems.map((it) => (it.id === id ? { ...it, text: trimmed } : it)));
    }
    setEditingJukjeonId(null);
  };

  if (!me && !loading) {
    return (
      <div style={styles.wrap}>
        <div style={styles.gate}>
          <div style={styles.gateLogo}>우리 집</div>
          <div style={styles.gateSub}>둘만 보는 체크리스트</div>
          <div style={{ marginTop: 28, fontSize: 15, color: "#5B5648" }}>누구세요?</div>
          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            {Object.entries(PEOPLE).map(([key, p]) => (
              <button
                key={key}
                onClick={() => chooseIdentity(key)}
                style={{ ...styles.gateBtn, borderColor: p.color, color: p.color }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={styles.gateNote}>이 기기에서는 다시 묻지 않아요.</div>
        </div>
      </div>
    );
  }

  const visible = items
    .filter((it) => activeCat === "ALL" || it.category === activeCat)
    .sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1));

  const visibleShop = shopItems
    .filter((it) => activeShopCat === "ALL" || it.category === activeShopCat)
    .sort((a, b) => (a.bought === b.bought ? b.createdAt - a.createdAt : a.bought ? 1 : -1));

  const todayDoneCount = items.filter(
    (it) => it.done && it.doneAt && new Date(it.doneAt).toDateString() === new Date().toDateString()
  ).length;

  const toBuyCount = shopItems.filter((it) => !it.bought).length;
  const eventLeftCount = eventItems.filter((it) => !it.done).length;
  const jukjeonLeftCount = jukjeonItems.filter((it) => !it.done).length;

  return (
    <div style={styles.wrap}>
      <div style={styles.app}>
        <header style={styles.header}>
          <div>
            <div style={styles.title}>우리 집</div>
            <div style={styles.subtitle}>
              {view === "todo" && (
                <>
                  오늘 <b style={{ color: "#D9A441" }}>{todayDoneCount}</b>개 완료
                </>
              )}
              {view === "shopping" && (
                <>
                  살 것 <b style={{ color: "#4C6B87" }}>{toBuyCount}</b>개 남음
                </>
              )}
              {view === "event" && (
                <>
                  행사 <b style={{ color: EVENT_COLOR }}>{eventLeftCount}</b>개 남음
                </>
              )}
              {view === "jukjeon" && (
                <>
                  죽전 <b style={{ color: "#4C6B87" }}>{jukjeonLeftCount}</b>개 남음
                </>
              )}
            </div>
          </div>
          <div style={styles.whoRow}>
            {Object.entries(PEOPLE).map(([key, p]) => (
              <button
                key={key}
                onClick={() => chooseIdentity(key)}
                style={{
                  ...styles.whoPill,
                  background: me === key ? p.color : "transparent",
                  color: me === key ? "#fff" : p.color,
                  borderColor: p.color,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        <div style={styles.viewSwitch}>
          <button
            onClick={() => setView("todo")}
            style={{
              ...styles.viewBtn,
              background: view === "todo" ? "#2E3532" : "transparent",
              color: view === "todo" ? "#fff" : "#8C8577",
            }}
          >
            <ListChecks size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            할 일
          </button>
          <button
            onClick={() => setView("shopping")}
            style={{
              ...styles.viewBtn,
              background: view === "shopping" ? "#2E3532" : "transparent",
              color: view === "shopping" ? "#fff" : "#8C8577",
            }}
          >
            <ShoppingCart size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            살 것
          </button>
          <button
            onClick={() => setView("event")}
            style={{
              ...styles.viewBtn,
              background: view === "event" ? "#2E3532" : "transparent",
              color: view === "event" ? "#fff" : "#8C8577",
            }}
          >
            <PartyPopper size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            행사
          </button>
          <button
            onClick={() => setView("jukjeon")}
            style={{
              ...styles.viewBtn,
              background: view === "jukjeon" ? "#2E3532" : "transparent",
              color: view === "jukjeon" ? "#fff" : "#8C8577",
            }}
          >
            <ShoppingBag size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
            죽전
          </button>
        </div>


        {view === "todo" && (
          <>
            <div style={styles.tabs}>
              {Object.entries(CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setActiveCat(key)}
                  style={{
                    ...styles.tab,
                    borderBottom: activeCat === key ? `2.5px solid ${c.color}` : "2.5px solid transparent",
                    color: activeCat === key ? c.color : "#8C8577",
                    fontWeight: activeCat === key ? 700 : 500,
                  }}
                >
                  {c.icon ? <c.icon size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
                  {c.label}
                </button>
              ))}
            </div>

            <main style={styles.list}>
              {loading ? (
                <div style={styles.empty}>불러오는 중…</div>
              ) : visible.length === 0 ? (
                <div style={styles.empty}>
                  아직 항목이 없어요.
                  <br />
                  아래에서 하나 추가해보세요.
                </div>
              ) : (
                visible.map((it) => {
                  const cat = CATEGORIES[it.category] || CATEGORIES.ETC;
                  const doneByPerson = it.doneBy ? PEOPLE[it.doneBy] : null;
                  return (
                    <div
                      key={it.id}
                      style={{
                        ...styles.item,
                        borderLeft: `3px solid ${cat.color}`,
                        opacity: it.done ? 0.55 : 1,
                      }}
                    >
                      <button onClick={() => toggleItem(it.id)} style={styles.checkBtn} aria-label="완료 표시">
                        <StampCheck color={cat.color} active={it.done} />
                      </button>
                      {cat.icon && (
                        <div style={{ ...styles.catBadge, background: `${cat.color}1F`, color: cat.color }}>
                          <cat.icon size={13} />
                        </div>
                      )}
                      <div style={styles.itemText}>
                        {editingTodoId === it.id ? (
                          <input
                            autoFocus
                            value={todoDraft}
                            onChange={(e) => setTodoDraft(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && saveEditTodo(it.id)}
                            onBlur={() => saveEditTodo(it.id)}
                            style={styles.editInput}
                          />
                        ) : (
                          <div
                            onClick={() => startEditTodo(it)}
                            style={{
                              textDecoration: it.done ? "line-through" : "none",
                              color: it.done ? "#9C9686" : "#2E3532",
                              cursor: "pointer",
                            }}
                          >
                            {it.text}
                          </div>
                        )}
                        {it.done && doneByPerson && (
                          <div style={{ fontSize: 11.5, marginTop: 2, color: doneByPerson.color }}>
                            {doneByPerson.label}가 완료함
                          </div>
                        )}
                      </div>
                      <button onClick={() => deleteItem(it.id)} style={styles.delBtn} aria-label="삭제">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })
              )}
            </main>

            {error && (
              <div style={styles.errorBar}>
                {error}
                <button onClick={loadAll} style={styles.retryBtn}>
                  새로고침
                </button>
              </div>
            )}

            <footer style={styles.addBar}>
              <select
                value={addCat}
                onChange={(e) => setAddCat(e.target.value)}
                style={{ ...styles.select, color: CATEGORIES[addCat].color }}
              >
                {Object.entries(CATEGORIES)
                  .filter(([k]) => k !== "ALL")
                  .map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem()}
                placeholder="할 일을 적어주세요"
                style={styles.input}
              />
              <button onClick={addItem} style={styles.addBtn} aria-label="추가">
                <Plus size={18} color="#fff" />
              </button>
            </footer>
          </>
        )}

        {view === "shopping" && (
          <>
            <div style={styles.tabs}>
              {Object.entries(SHOP_CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setActiveShopCat(key)}
                  style={{
                    ...styles.tab,
                    borderBottom: activeShopCat === key ? `2.5px solid ${c.color}` : "2.5px solid transparent",
                    color: activeShopCat === key ? c.color : "#8C8577",
                    fontWeight: activeShopCat === key ? 700 : 500,
                  }}
                >
                  {c.icon ? <c.icon size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
                  {c.label}
                </button>
              ))}
            </div>

            <main style={styles.list}>
              {loading ? (
                <div style={styles.empty}>불러오는 중…</div>
              ) : visibleShop.length === 0 ? (
                <div style={styles.empty}>
                  살 물건이 없어요.
                  <br />
                  아래에서 하나 추가해보세요.
                </div>
              ) : (
                visibleShop.map((it) => {
                  const cat = SHOP_CATEGORIES[it.category] || SHOP_CATEGORIES.ETC;
                  const byPerson = it.boughtBy ? PEOPLE[it.boughtBy] : null;
                  const isEditing = editingNoteId === it.id;
                  const isEditingName = editingShopNameId === it.id;
                  return (
                    <div
                      key={it.id}
                      style={{
                        ...styles.item,
                        alignItems: "flex-start",
                        borderLeft: `3px solid ${cat.color}`,
                        opacity: it.bought ? 0.55 : 1,
                      }}
                    >
                      <button
                        onClick={() => toggleShopItem(it.id)}
                        style={{ ...styles.checkBtn, marginTop: 1 }}
                        aria-label="구매 완료 표시"
                      >
                        <StampCheck color={cat.color} active={it.bought} />
                      </button>
                      {cat.icon && (
                        <div style={{ ...styles.catBadge, marginTop: 1, background: `${cat.color}1F`, color: cat.color }}>
                          <cat.icon size={13} />
                        </div>
                      )}
                      <div style={styles.itemText}>
                        {isEditingName ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <input
                              autoFocus
                              value={shopNameDraft}
                              onChange={(e) => setShopNameDraft(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEditShopName(it.id)}
                              style={styles.editInput}
                            />
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <select
                                value={shopCatDraft}
                                onChange={(e) => setShopCatDraft(e.target.value)}
                                style={{ ...styles.select, color: SHOP_CATEGORIES[shopCatDraft].color }}
                              >
                                {Object.entries(SHOP_CATEGORIES)
                                  .filter(([k]) => k !== "ALL")
                                  .map(([key, c]) => (
                                    <option key={key} value={key}>
                                      {c.label}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => saveEditShopName(it.id)}
                                style={{ ...styles.addBtn, padding: "6px 14px", width: "auto" }}
                              >
                                <Check size={14} color="#fff" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditShopName(it)}
                            style={{
                              textDecoration: it.bought ? "line-through" : "none",
                              color: it.bought ? "#9C9686" : "#2E3532",
                              cursor: "pointer",
                            }}
                          >
                            {it.name}
                          </div>
                        )}

                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                            <input
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveNote(it.id)}
                              onBlur={() => saveNote(it.id)}
                              placeholder="어떤 제품인지, 링크 등"
                              style={styles.noteInput}
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditNote(it)}
                            style={{
                              fontSize: 12.5,
                              marginTop: 3,
                              color: it.note ? "#5B5648" : "#B5AF9E",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Pencil size={10} />
                            {it.note || "메모 추가 (제품/링크 등)"}
                          </div>
                        )}

                        {it.bought && byPerson && (
                          <div style={{ fontSize: 11.5, marginTop: 4, color: byPerson.color }}>
                            {byPerson.label}가 구매함
                          </div>
                        )}
                      </div>
                      <button onClick={() => deleteShopItem(it.id)} style={styles.delBtn} aria-label="삭제">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })
              )}
            </main>

            {error && (
              <div style={styles.errorBar}>
                {error}
                <button onClick={loadAll} style={styles.retryBtn}>
                  새로고침
                </button>
              </div>
            )}

            <footer style={styles.addBar}>
              <select
                value={addShopCat}
                onChange={(e) => setAddShopCat(e.target.value)}
                style={{ ...styles.select, color: SHOP_CATEGORIES[addShopCat].color }}
              >
                {Object.entries(SHOP_CATEGORIES)
                  .filter(([k]) => k !== "ALL")
                  .map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <input
                ref={shopInputRef}
                value={shopText}
                onChange={(e) => setShopText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addShopItem()}
                placeholder="살 물건을 적어주세요"
                style={styles.input}
              />
              <button onClick={addShopItem} style={styles.addBtn} aria-label="추가">
                <Plus size={18} color="#fff" />
              </button>
            </footer>
          </>
        )}

        {view === "event" && (
          <>
            <main style={styles.list}>
              {loading ? (
                <div style={styles.empty}>불러오는 중…</div>
              ) : eventItems.length === 0 ? (
                <div style={styles.empty}>
                  아직 등록된 행사가 없어요.
                  <br />
                  돌잔치, 명절, 생일처럼 준비할 행사를 적어보세요.
                </div>
              ) : (
                [...eventItems]
                  .sort((a, b) => {
                    if (a.done !== b.done) return a.done ? 1 : -1;
                    if (a.done) return (b.doneAt || b.createdAt) - (a.doneAt || a.createdAt);
                    if (a.date && b.date) return a.date.localeCompare(b.date);
                    if (a.date) return -1;
                    if (b.date) return 1;
                    return b.createdAt - a.createdAt;
                  })
                  .map((it) => {
                    const byPerson = it.doneBy ? PEOPLE[it.doneBy] : null;
                    const d = formatEventDate(it.date, it.endDate);
                    const isEditingEvent = editingEventId === it.id;
                    return (
                      <div
                        key={it.id}
                        style={{
                          ...styles.item,
                          borderLeft: `3px solid ${EVENT_COLOR}`,
                          opacity: it.done ? 0.55 : 1,
                        }}
                      >
                        <button onClick={() => toggleEvent(it.id)} style={styles.checkBtn} aria-label="완료 표시">
                          <StampCheck color={EVENT_COLOR} active={it.done} />
                        </button>
                        <div style={{ ...styles.catBadge, background: `${EVENT_COLOR}1F`, color: EVENT_COLOR }}>
                          <PartyPopper size={13} />
                        </div>
                        <div style={styles.itemText}>
                          {isEditingEvent ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <input
                                autoFocus
                                value={eventDraftText}
                                onChange={(e) => setEventDraftText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveEditEvent(it.id)}
                                style={styles.editInput}
                              />
                              <div>
                                <div style={styles.dateFieldLabel}>시작일</div>
                                <input
                                  type="date"
                                  value={eventDraftDate}
                                  onChange={(e) => setEventDraftDate(e.target.value)}
                                  style={{ ...styles.editInput, color: eventDraftDate ? "#2E3532" : "#B5AF9E" }}
                                />
                              </div>
                              <div>
                                <div style={styles.dateFieldLabel}>종료일 (선택, 며칠간 이어지는 행사면)</div>
                                <input
                                  type="date"
                                  value={eventDraftEndDate}
                                  onChange={(e) => setEventDraftEndDate(e.target.value)}
                                  style={{ ...styles.editInput, color: eventDraftEndDate ? "#2E3532" : "#B5AF9E" }}
                                />
                              </div>
                              <button
                                onClick={() => saveEditEvent(it.id)}
                                style={{ ...styles.addBtn, alignSelf: "flex-start", padding: "6px 14px", width: "auto" }}
                              >
                                <Check size={14} color="#fff" />
                              </button>
                            </div>
                          ) : (
                            <div
                              onClick={() => startEditEvent(it)}
                              style={{
                                textDecoration: it.done ? "line-through" : "none",
                                color: it.done ? "#9C9686" : "#2E3532",
                                cursor: "pointer",
                              }}
                            >
                              {it.text}
                            </div>
                          )}
                          {!isEditingEvent && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                              {d && (
                                <>
                                  <span style={{ fontSize: 12, color: "#8C8577" }}>{d.label}</span>
                                  {!it.done && (
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: d.isPast ? "#B5AF9E" : EVENT_COLOR,
                                        background: d.isPast ? "#EDEAE1" : `${EVENT_COLOR}1F`,
                                        padding: "1px 6px",
                                        borderRadius: 999,
                                      }}
                                    >
                                      {d.dday}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          {it.done && byPerson && (
                            <div style={{ fontSize: 11.5, marginTop: 2, color: byPerson.color }}>
                              {byPerson.label}가 완료함
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteEvent(it.id)} style={styles.delBtn} aria-label="삭제">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })
              )}
            </main>

            {error && (
              <div style={styles.errorBar}>
                {error}
                <button onClick={loadAll} style={styles.retryBtn}>
                  새로고침
                </button>
              </div>
            )}

            <footer style={{ ...styles.addBar, flexDirection: "column", gap: 8, alignItems: "stretch" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  style={{ ...styles.input, color: eventDate ? "#2E3532" : "#B5AF9E" }}
                />
                {showEventEndDate && (
                  <input
                    type="date"
                    value={eventEndDate}
                    onChange={(e) => setEventEndDate(e.target.value)}
                    style={{ ...styles.input, color: eventEndDate ? "#2E3532" : "#B5AF9E" }}
                  />
                )}
              </div>
              {!showEventEndDate && eventDate && (
                <button
                  onClick={() => setShowEventEndDate(true)}
                  style={styles.linkBtn}
                >
                  + 기간으로 등록 (종료일 추가)
                </button>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  ref={eventInputRef}
                  value={eventText}
                  onChange={(e) => setEventText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addEvent()}
                  placeholder="행사를 적어주세요 (예: 아들 돌잔치)"
                  style={styles.input}
                />
                <button onClick={addEvent} style={styles.addBtn} aria-label="추가">
                  <Plus size={18} color="#fff" />
                </button>
              </div>
            </footer>
          </>
        )}

        {view === "jukjeon" && (
          <>
            <div style={styles.tabs}>
              {Object.entries(JUKJEON_CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  onClick={() => setActiveJukjeonCat(key)}
                  style={{
                    ...styles.tab,
                    borderBottom: activeJukjeonCat === key ? `2.5px solid ${c.color}` : "2.5px solid transparent",
                    color: activeJukjeonCat === key ? c.color : "#8C8577",
                    fontWeight: activeJukjeonCat === key ? 700 : 500,
                  }}
                >
                  {c.icon ? <c.icon size={14} style={{ marginRight: 4, verticalAlign: -2 }} /> : null}
                  {c.label}
                </button>
              ))}
            </div>

            <main style={styles.list}>
              {loading ? (
                <div style={styles.empty}>불러오는 중…</div>
              ) : jukjeonItems.filter((it) => activeJukjeonCat === "ALL" || it.category === activeJukjeonCat)
                  .length === 0 ? (
                <div style={styles.empty}>
                  아직 항목이 없어요.
                  <br />
                  아래에서 하나 추가해보세요.
                </div>
              ) : (
                [...jukjeonItems]
                  .filter((it) => activeJukjeonCat === "ALL" || it.category === activeJukjeonCat)
                  .sort((a, b) => (a.done === b.done ? b.createdAt - a.createdAt : a.done ? 1 : -1))
                  .map((it) => {
                    const cat = JUKJEON_CATEGORIES[it.category] || JUKJEON_CATEGORIES.BUY;
                    const doneByPerson = it.doneBy ? PEOPLE[it.doneBy] : null;
                    const isEditingThis = editingJukjeonId === it.id;
                    return (
                      <div
                        key={it.id}
                        style={{
                          ...styles.item,
                          borderLeft: `3px solid ${cat.color}`,
                          opacity: it.done ? 0.55 : 1,
                        }}
                      >
                        <button onClick={() => toggleJukjeon(it.id)} style={styles.checkBtn} aria-label="완료 표시">
                          <StampCheck color={cat.color} active={it.done} />
                        </button>
                        {cat.icon && (
                          <div style={{ ...styles.catBadge, background: `${cat.color}1F`, color: cat.color }}>
                            <cat.icon size={13} />
                          </div>
                        )}
                        <div style={styles.itemText}>
                          {isEditingThis ? (
                            <input
                              autoFocus
                              value={jukjeonDraft}
                              onChange={(e) => setJukjeonDraft(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveEditJukjeon(it.id)}
                              onBlur={() => saveEditJukjeon(it.id)}
                              style={styles.editInput}
                            />
                          ) : (
                            <div
                              onClick={() => startEditJukjeon(it)}
                              style={{
                                textDecoration: it.done ? "line-through" : "none",
                                color: it.done ? "#9C9686" : "#2E3532",
                                cursor: "pointer",
                              }}
                            >
                              {it.text}
                            </div>
                          )}
                          {it.done && doneByPerson && (
                            <div style={{ fontSize: 11.5, marginTop: 2, color: doneByPerson.color }}>
                              {doneByPerson.label}가 완료함
                            </div>
                          )}
                        </div>
                        <button onClick={() => deleteJukjeon(it.id)} style={styles.delBtn} aria-label="삭제">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    );
                  })
              )}
            </main>

            {error && (
              <div style={styles.errorBar}>
                {error}
                <button onClick={loadAll} style={styles.retryBtn}>
                  새로고침
                </button>
              </div>
            )}

            <footer style={styles.addBar}>
              <select
                value={addJukjeonCat}
                onChange={(e) => setAddJukjeonCat(e.target.value)}
                style={{ ...styles.select, color: JUKJEON_CATEGORIES[addJukjeonCat].color }}
              >
                {Object.entries(JUKJEON_CATEGORIES)
                  .filter(([k]) => k !== "ALL")
                  .map(([key, c]) => (
                    <option key={key} value={key}>
                      {c.label}
                    </option>
                  ))}
              </select>
              <input
                ref={jukjeonInputRef}
                value={jukjeonText}
                onChange={(e) => setJukjeonText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addJukjeon()}
                placeholder="죽전에 챙길 것/살 것을 적어주세요"
                style={styles.input}
              />
              <button onClick={addJukjeon} style={styles.addBtn} aria-label="추가">
                <Plus size={18} color="#fff" />
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    minHeight: "100vh",
    background: "#F5F2EA",
    display: "flex",
    justifyContent: "center",
    fontFamily: "'Pretendard', -apple-system, sans-serif",
  },
  app: {
    width: "100%",
    maxWidth: 480,
    minHeight: "100vh",
    background: "#F5F2EA",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "22px 18px 10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 26,
    fontWeight: 600,
    color: "#2E3532",
    letterSpacing: "-0.02em",
  },
  subtitle: { fontSize: 12.5, color: "#8C8577", marginTop: 2 },
  whoRow: { display: "flex", gap: 6, marginTop: 2 },
  whoPill: {
    fontSize: 12,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1.4px solid",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 600,
  },
  viewSwitch: {
    display: "flex",
    gap: 6,
    padding: "0 14px 10px",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  viewBtn: {
    border: "none",
    borderRadius: 8,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  tabs: {
    display: "flex",
    gap: 4,
    padding: "0 14px",
    borderBottom: "1px solid #E4DFD2",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
  },
  tab: {
    background: "transparent",
    border: "none",
    padding: "10px 8px",
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  list: { flex: 1, padding: "14px 14px 100px", overflowY: "auto" },
  empty: {
    textAlign: "center",
    color: "#A39D8C",
    fontSize: 13.5,
    marginTop: 60,
    lineHeight: 1.6,
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#FFFFFF",
    borderRadius: 10,
    padding: "12px 12px",
    marginBottom: 8,
    boxShadow: "0 1px 2px rgba(46,53,50,0.05)",
  },
  checkBtn: { background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 },
  catBadge: {
    width: 24,
    height: 24,
    borderRadius: 7,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemText: { flex: 1, fontSize: 14.5, lineHeight: 1.4 },
  linkBtn: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: EVENT_COLOR,
    fontSize: 12.5,
    fontWeight: 600,
    padding: "2px 2px",
    cursor: "pointer",
  },
  dateFieldLabel: { fontSize: 11, color: "#8C8577", marginBottom: 3 },
  editInput: {
    width: "100%",
    fontSize: 16,
    fontFamily: "inherit",
    border: "1.4px solid #2E3532",
    borderRadius: 6,
    padding: "5px 8px",
    outline: "none",
    background: "#fff",
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    border: "1.2px solid #E4DFD2",
    borderRadius: 6,
    padding: "5px 8px",
    outline: "none",
    fontFamily: "inherit",
  },
  delBtn: {
    background: "none",
    border: "none",
    color: "#C9C4B8",
    cursor: "pointer",
    padding: 4,
    flexShrink: 0,
  },
  errorBar: {
    position: "fixed",
    bottom: 76,
    left: "50%",
    transform: "translateX(-50%)",
    background: "#C97B84",
    color: "#fff",
    fontSize: 12.5,
    padding: "6px 10px 6px 14px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    gap: 8,
    maxWidth: "90%",
    textAlign: "center",
  },
  retryBtn: {
    flexShrink: 0,
    background: "rgba(255,255,255,0.25)",
    border: "none",
    color: "#fff",
    fontSize: 11.5,
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: 6,
    cursor: "pointer",
  },
  addBar: {
    position: "fixed",
    bottom: 0,
    width: "100%",
    maxWidth: 480,
    display: "flex",
    gap: 8,
    padding: "10px 14px calc(10px + env(safe-area-inset-bottom))",
    background: "#F5F2EA",
    borderTop: "1px solid #E4DFD2",
  },
  select: {
    border: "1.4px solid #E4DFD2",
    borderRadius: 8,
    fontSize: 16,
    padding: "0 6px",
    background: "#fff",
    fontWeight: 600,
    flexShrink: 0,
    maxWidth: 92,
  },
  input: {
    flex: 1,
    minWidth: 0,
    border: "1.4px solid #E4DFD2",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontFamily: "inherit",
    background: "#fff",
    outline: "none",
  },
  addBtn: {
    background: "#2E3532",
    border: "none",
    borderRadius: 8,
    width: 40,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  gate: {
    margin: "auto",
    textAlign: "center",
    padding: 24,
  },
  gateLogo: {
    fontFamily: "'Fraunces', serif",
    fontSize: 34,
    fontWeight: 600,
    color: "#2E3532",
  },
  gateSub: { fontSize: 13, color: "#8C8577", marginTop: 4 },
  gateBtn: {
    padding: "10px 22px",
    borderRadius: 999,
    border: "1.6px solid",
    background: "#fff",
    fontSize: 14.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  gateNote: { fontSize: 11.5, color: "#A39D8C", marginTop: 16 },
};
