import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Plus,
  Search,
  Sun,
  Moon,
  Calendar as CalIcon,
  Clock,
  X,
  Check,
  Pencil,
  Trash2,
  Tag as TagIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Bell,
  BellOff,
  List as ListIcon,
  Columns,
  Table as TableIcon,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react'

// ===========================================================================
// Constants
// ===========================================================================
const TASKS_KEY = 'tasks:v1'
const PREFS_KEY = 'prefs:v1'

const PRIORITIES = ['high', 'medium', 'low']
const PRIORITY_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' }
const STATUSES = ['todo', 'inprogress', 'completed']
const STATUS_LABEL = { todo: 'To Do', inprogress: 'In Progress', completed: 'Completed' }

const TAG_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#84cc16', '#f43f5e',
]

const ACCENT = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'

// ===========================================================================
// Small helpers
// ===========================================================================
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

const pad = (n) => String(n).padStart(2, '0')

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A task's due *date* has arrived if it is today or in the past.
function dueArrived(task) {
  if (!task.dueDate) return false
  return task.dueDate <= todayStr()
}

// Full due timestamp (date + optional time) as a Date, or null.
function dueDateTime(task) {
  if (!task.dueDate) return null
  const [y, m, d] = task.dueDate.split('-').map(Number)
  const [hh, mm] = (task.dueTime || '23:59').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0)
}

function isOverdue(task) {
  if (task.status === 'completed') return false
  const dt = dueDateTime(task)
  if (!dt) return false
  return dt.getTime() < Date.now()
}

function formatDue(task) {
  if (!task.dueDate) return ''
  const [y, m, d] = task.dueDate.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const opts = { month: 'short', day: 'numeric' }
  if (y !== new Date().getFullYear()) opts.year = 'numeric'
  let s = dt.toLocaleDateString(undefined, opts)
  if (task.dueTime) s += ` ${task.dueTime}`
  return s
}

function hashIndex(str, mod) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h) % mod
}

// ===========================================================================
// Storage hook: load, save, realtime-subscribe, echo suppression.
// ===========================================================================
function useSyncedState() {
  const [tasks, setTasks] = useState([])
  const [prefs, setPrefs] = useState({
    dark: true,
    view: 'list',
    tagColors: {},
    notify: false,
  })
  const [loaded, setLoaded] = useState(false)

  // Last string we wrote per key — used to ignore our own realtime echoes.
  const lastSaved = useRef({})
  const ready = useRef(false)

  // Initial load + subscription.
  useEffect(() => {
    const storage = window.storage
    if (!storage) {
      // Should not happen (App sets it before mount) but fail soft.
      setLoaded(true)
      return
    }
    let alive = true

    ;(async () => {
      const [t, p] = await Promise.all([
        storage.get(TASKS_KEY),
        storage.get(PREFS_KEY),
      ])
      if (!alive) return
      if (t) {
        lastSaved.current[TASKS_KEY] = t
        try {
          setTasks(JSON.parse(t))
        } catch {}
      }
      if (p) {
        lastSaved.current[PREFS_KEY] = p
        try {
          setPrefs((cur) => ({ ...cur, ...JSON.parse(p) }))
        } catch {}
      }
      setLoaded(true)
      // Allow saves only after the first state settles.
      requestAnimationFrame(() => {
        ready.current = true
      })
    })()

    const unsub = storage.subscribe(({ key, value }) => {
      if (value == null) return
      if (value === lastSaved.current[key]) return // our own echo
      lastSaved.current[key] = value
      try {
        if (key === TASKS_KEY) setTasks(JSON.parse(value))
        else if (key === PREFS_KEY)
          setPrefs((cur) => ({ ...cur, ...JSON.parse(value) }))
      } catch {}
    })

    return () => {
      alive = false
      if (unsub) unsub()
    }
  }, [])

  // Persist tasks.
  useEffect(() => {
    if (!ready.current) return
    const s = JSON.stringify(tasks)
    if (s === lastSaved.current[TASKS_KEY]) return
    lastSaved.current[TASKS_KEY] = s
    window.storage?.set(TASKS_KEY, s)
  }, [tasks])

  // Persist prefs.
  useEffect(() => {
    if (!ready.current) return
    const s = JSON.stringify(prefs)
    if (s === lastSaved.current[PREFS_KEY]) return
    lastSaved.current[PREFS_KEY] = s
    window.storage?.set(PREFS_KEY, s)
  }, [prefs])

  return { tasks, setTasks, prefs, setPrefs, loaded }
}

// ===========================================================================
// Theme
// ===========================================================================
function themeVars(dark) {
  return dark
    ? {
        '--bg': '#0b0b12',
        '--bg2': 'radial-gradient(1200px 700px at 85% -10%, rgba(139,92,246,0.16), transparent), radial-gradient(900px 600px at 0% 0%, rgba(99,102,241,0.12), transparent), #0b0b12',
        '--panel': 'rgba(255,255,255,0.04)',
        '--panel2': 'rgba(255,255,255,0.06)',
        '--text': '#e7e7ef',
        '--muted': 'rgba(231,231,239,0.55)',
        '--border': 'rgba(255,255,255,0.10)',
        '--border2': 'rgba(255,255,255,0.16)',
        '--shadow': '0 14px 40px rgba(0,0,0,0.45)',
        '--chip': 'rgba(255,255,255,0.07)',
      }
    : {
        '--bg': '#f4f4fb',
        '--bg2': 'radial-gradient(1200px 700px at 85% -10%, rgba(139,92,246,0.12), transparent), radial-gradient(900px 600px at 0% 0%, rgba(99,102,241,0.10), transparent), #f4f4fb',
        '--panel': '#ffffff',
        '--panel2': '#ffffff',
        '--text': '#1d1d29',
        '--muted': 'rgba(29,29,41,0.55)',
        '--border': 'rgba(0,0,0,0.09)',
        '--border2': 'rgba(0,0,0,0.16)',
        '--shadow': '0 14px 40px rgba(30,30,60,0.10)',
        '--chip': 'rgba(99,102,241,0.08)',
      }
}

// ===========================================================================
// Main component
// ===========================================================================
export default function TaskManager() {
  const { tasks, setTasks, prefs, setPrefs, loaded } = useSyncedState()

  const [statusFilter, setStatusFilter] = useState('all') // all|today|upcoming|inprogress|completed
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [tagFilter, setTagFilter] = useState(null)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null) // task being edited in modal
  const notifiedRef = useRef(new Set())

  const dark = prefs.dark
  const view = prefs.view
  const tagColors = prefs.tagColors || {}

  // --- task mutations -----------------------------------------------------
  const addTask = useCallback((draft) => {
    setTasks((prev) => [
      { id: uid(), createdAt: Date.now(), status: 'todo', ...draft },
      ...prev,
    ])
  }, [setTasks])

  const updateTask = useCallback((id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [setTasks])

  const deleteTask = useCallback((id) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [setTasks])

  // Move a task for the board: change status and insert before `beforeId`
  // (or to the end of the column when null).
  const moveTask = useCallback((dragId, targetStatus, beforeId) => {
    setTasks((prev) => {
      const moving = prev.find((t) => t.id === dragId)
      if (!moving) return prev
      const without = prev.filter((t) => t.id !== dragId)
      const updated = { ...moving, status: targetStatus }
      if (!beforeId) {
        // Append after the last task of the target column.
        let lastIdx = -1
        without.forEach((t, i) => {
          if (t.status === targetStatus) lastIdx = i
        })
        without.splice(lastIdx + 1, 0, updated)
        return without
      }
      const idx = without.findIndex((t) => t.id === beforeId)
      if (idx === -1) without.push(updated)
      else without.splice(idx, 0, updated)
      return without
    })
  }, [setTasks])

  // --- prefs helpers ------------------------------------------------------
  const setPref = (patch) => setPrefs((p) => ({ ...p, ...patch }))
  const setTagColor = (tag, color) =>
    setPrefs((p) => ({ ...p, tagColors: { ...p.tagColors, [tag]: color } }))

  const colorForTag = useCallback(
    (tag) => tagColors[tag] || TAG_PALETTE[hashIndex(tag, TAG_PALETTE.length)],
    [tagColors]
  )

  // --- derived: all tags --------------------------------------------------
  const allTags = useMemo(() => {
    const s = new Set()
    tasks.forEach((t) => (t.tags || []).forEach((tg) => s.add(tg)))
    return [...s].sort()
  }, [tasks])

  const categories = useMemo(() => {
    const s = new Set()
    tasks.forEach((t) => t.category && s.add(t.category))
    return [...s].sort()
  }, [tasks])

  // --- filtering ----------------------------------------------------------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      // status pill
      if (statusFilter === 'today') {
        if (!t.dueDate || t.dueDate !== todayStr()) return false
      } else if (statusFilter === 'upcoming') {
        if (!t.dueDate || t.dueDate <= todayStr()) return false
        if (t.status === 'completed') return false
      } else if (statusFilter === 'inprogress') {
        if (t.status !== 'inprogress') return false
      } else if (statusFilter === 'completed') {
        if (t.status !== 'completed') return false
      }
      if (categoryFilter && t.category !== categoryFilter) return false
      if (tagFilter && !(t.tags || []).includes(tagFilter)) return false
      if (q) {
        const hay = [
          t.title,
          t.category,
          t.risk,
          ...(t.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tasks, statusFilter, categoryFilter, tagFilter, search])

  // --- completion stats ---------------------------------------------------
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter((t) => t.status === 'completed').length
    const byCat = {}
    tasks.forEach((t) => {
      const c = t.category || 'Uncategorized'
      byCat[c] = byCat[c] || { total: 0, done: 0 }
      byCat[c].total++
      if (t.status === 'completed') byCat[c].done++
    })
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0, byCat }
  }, [tasks])

  // --- notifications ------------------------------------------------------
  useEffect(() => {
    if (!prefs.notify) return
    if (typeof Notification === 'undefined') return
    const tick = () => {
      if (Notification.permission !== 'granted') return
      const now = Date.now()
      tasks.forEach((t) => {
        if (t.status === 'completed') return
        const dt = dueDateTime(t)
        if (!dt) return
        if (dt.getTime() <= now && !notifiedRef.current.has(t.id)) {
          notifiedRef.current.add(t.id)
          try {
            new Notification('Task due: ' + t.title, {
              body: t.category ? `Category: ${t.category}` : 'Due now',
            })
          } catch {}
        }
      })
    }
    tick()
    const h = setInterval(tick, 30000)
    return () => clearInterval(h)
  }, [prefs.notify, tasks])

  async function toggleNotify() {
    if (!prefs.notify && typeof Notification !== 'undefined') {
      if (Notification.permission === 'default') {
        await Notification.requestPermission()
      }
    }
    setPref({ notify: !prefs.notify })
  }

  // --- active filter bar --------------------------------------------------
  const hasActiveFilter = categoryFilter || tagFilter || search

  if (!loaded) {
    return (
      <div
        style={{
          ...themeVars(dark),
          minHeight: '100vh',
          background: 'var(--bg2)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Loading your tasks…
      </div>
    )
  }

  return (
    <div
      className="ptm-root"
      style={{
        ...themeVars(dark),
        minHeight: '100vh',
        background: 'var(--bg2)',
        color: 'var(--text)',
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      <StyleBlock />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <ProgressRing pct={stats.pct} />
            <div>
              <h1 style={{ margin: 0, fontSize: 24, letterSpacing: -0.5 }}>
                My Tasks
              </h1>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {stats.done} of {stats.total} done · {stats.pct}% complete
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconToggle
              on={prefs.notify}
              onClick={toggleNotify}
              title="Browser notifications when a task is due"
              onIcon={<Bell size={16} />}
              offIcon={<BellOff size={16} />}
            />
            <IconToggle
              on={dark}
              onClick={() => setPref({ dark: !dark })}
              title="Toggle theme"
              onIcon={<Moon size={16} />}
              offIcon={<Sun size={16} />}
            />
          </div>
        </header>

        {/* Per-category progress */}
        {Object.keys(stats.byCat).length > 0 && (
          <CategoryBars byCat={stats.byCat} onPick={setCategoryFilter} />
        )}

        {/* Add box */}
        <AddBox
          onAdd={addTask}
          allTags={allTags}
          categories={categories}
          colorForTag={colorForTag}
          setTagColor={setTagColor}
          dark={dark}
        />

        {/* Filter pills + search + view switch */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
            margin: '18px 0 12px',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              ['all', 'All'],
              ['today', 'Today'],
              ['upcoming', 'Upcoming'],
              ['inprogress', 'In Progress'],
              ['completed', 'Completed'],
            ].map(([k, label]) => (
              <button
                key={k}
                className="ptm-pill"
                data-active={statusFilter === k}
                onClick={() => setStatusFilter(k)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div className="ptm-search">
            <Search size={15} style={{ color: 'var(--muted)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
            />
            {search && (
              <button className="ptm-iconbtn" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <ViewSwitch view={view} onChange={(v) => setPref({ view: v })} />
        </div>

        {/* Active filter bar */}
        {hasActiveFilter && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 12,
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--muted)' }}>Filters:</span>
            {categoryFilter && (
              <FilterChip label={`Category: ${categoryFilter}`} onClear={() => setCategoryFilter(null)} />
            )}
            {tagFilter && (
              <FilterChip
                label={`#${tagFilter}`}
                color={colorForTag(tagFilter)}
                onClear={() => setTagFilter(null)}
              />
            )}
            {search && <FilterChip label={`"${search}"`} onClear={() => setSearch('')} />}
            <button
              className="ptm-textbtn"
              onClick={() => {
                setCategoryFilter(null)
                setTagFilter(null)
                setSearch('')
              }}
            >
              Clear all
            </button>
          </div>
        )}

        {/* Views */}
        {filtered.length === 0 ? (
          <EmptyState />
        ) : view === 'list' ? (
          <ListView
            tasks={filtered}
            allTasksLen={tasks.length}
            colorForTag={colorForTag}
            setTagColor={setTagColor}
            allTags={allTags}
            categories={categories}
            onUpdate={updateTask}
            onDelete={deleteTask}
            onPickCategory={setCategoryFilter}
            onPickTag={setTagFilter}
          />
        ) : view === 'board' ? (
          <BoardView
            tasks={filtered}
            colorForTag={colorForTag}
            onMove={moveTask}
            onEdit={setEditing}
            onPickCategory={setCategoryFilter}
            onPickTag={setTagFilter}
          />
        ) : (
          <TableView
            tasks={filtered}
            colorForTag={colorForTag}
            onUpdate={updateTask}
            onEdit={setEditing}
            onPickCategory={setCategoryFilter}
            onPickTag={setTagFilter}
          />
        )}
      </div>

      {/* Edit modal (board / table) */}
      {editing && (
        <Modal onClose={() => setEditing(null)}>
          <TaskForm
            initial={editing}
            mode="edit"
            allTags={allTags}
            categories={categories}
            colorForTag={colorForTag}
            setTagColor={setTagColor}
            onCancel={() => setEditing(null)}
            onSubmit={(patch) => {
              updateTask(editing.id, patch)
              setEditing(null)
            }}
            onDelete={() => {
              deleteTask(editing.id)
              setEditing(null)
            }}
          />
        </Modal>
      )}
    </div>
  )
}

// ===========================================================================
// Header bits
// ===========================================================================
function ProgressRing({ pct }) {
  const r = 20
  const c = 2 * Math.PI * r
  const off = c - (pct / 100) * c
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <linearGradient id="ptm-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="url(#ptm-ring)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x="26"
        y="30"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fill="var(--text)"
      >
        {pct}%
      </text>
    </svg>
  )
}

function IconToggle({ on, onClick, title, onIcon, offIcon }) {
  return (
    <button
      className="ptm-iconbtn ptm-toggle"
      data-on={on}
      onClick={onClick}
      title={title}
      style={{ width: 38, height: 38 }}
    >
      {on ? onIcon : offIcon}
    </button>
  )
}

function CategoryBars({ byCat, onPick }) {
  const entries = Object.entries(byCat).sort((a, b) => b[1].total - a[1].total)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
        gap: 10,
        marginBottom: 18,
      }}
    >
      {entries.map(([cat, { total, done }]) => {
        const pct = total ? Math.round((done / total) * 100) : 0
        return (
          <button
            key={cat}
            className="ptm-catbar"
            onClick={() => onPick(cat === 'Uncategorized' ? null : cat)}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                marginBottom: 6,
              }}
            >
              <span style={{ fontWeight: 600 }}>{cat}</span>
              <span style={{ color: 'var(--muted)' }}>
                {done}/{total}
              </span>
            </div>
            <div className="ptm-track">
              <div className="ptm-fill" style={{ width: `${pct}%` }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ViewSwitch({ view, onChange }) {
  const opts = [
    ['list', <ListIcon size={15} key="l" />, 'List'],
    ['board', <Columns size={15} key="b" />, 'Board'],
    ['table', <TableIcon size={15} key="t" />, 'Table'],
  ]
  return (
    <div className="ptm-segment">
      {opts.map(([k, icon, label]) => (
        <button
          key={k}
          data-active={view === k}
          onClick={() => onChange(k)}
          title={label}
        >
          {icon}
          <span className="ptm-seg-label">{label}</span>
        </button>
      ))}
    </div>
  )
}

function FilterChip({ label, color, onClear }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderRadius: 999,
        background: 'var(--chip)',
        border: '1px solid var(--border)',
      }}
    >
      {color && (
        <span
          style={{ width: 8, height: 8, borderRadius: 999, background: color }}
        />
      )}
      {label}
      <button className="ptm-iconbtn" onClick={onClear} style={{ width: 18, height: 18 }}>
        <X size={12} />
      </button>
    </span>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: 'var(--muted)',
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 8 }}>🗒️</div>
      <div>No tasks here. Add one above to get started.</div>
    </div>
  )
}

// ===========================================================================
// Add box (always-visible title + Add; details expand on hover/focus)
// ===========================================================================
function AddBox({ onAdd, allTags, categories, colorForTag, setTagColor }) {
  const empty = {
    title: '',
    category: '',
    priority: 'medium',
    dueDate: '',
    dueTime: '',
    tags: [],
    risk: '',
  }
  const [draft, setDraft] = useState(empty)
  const titleRef = useRef(null)

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  function commit() {
    const title = draft.title.trim()
    if (!title) {
      titleRef.current?.focus()
      return
    }
    onAdd({ ...draft, title })
    setDraft(empty)
    // Refocus title for rapid add; box stays expanded because focus stays in.
    requestAnimationFrame(() => titleRef.current?.focus())
  }

  return (
    <div className="ptm-addbox">
      <div className="ptm-addrow">
        <input
          ref={titleRef}
          className="ptm-addtitle"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder="Add a task…"
        />
        <button className="ptm-addbtn" onClick={commit}>
          <Plus size={16} /> Add
        </button>
      </div>

      <div className="ptm-details">
        <div className="ptm-details-inner">
          <Field label="Category">
            <input
              className="ptm-input"
              list="ptm-cats"
              value={draft.category}
              onChange={(e) => set({ category: e.target.value })}
              placeholder="e.g. Work"
            />
            <datalist id="ptm-cats">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>

          <Field label="Priority">
            <PrioritySelect
              value={draft.priority}
              onChange={(p) => set({ priority: p })}
            />
          </Field>

          <Field label="Due">
            <DatePicker
              date={draft.dueDate}
              time={draft.dueTime}
              onChange={(date, time) => set({ dueDate: date, dueTime: time })}
            />
          </Field>

          <Field label="Tags" wide>
            <TagInput
              value={draft.tags}
              onChange={(tags) => set({ tags })}
              allTags={allTags}
              colorForTag={colorForTag}
              setTagColor={setTagColor}
            />
          </Field>

          <Field label="Risk if not completed" wide>
            <input
              className="ptm-input"
              value={draft.risk}
              onChange={(e) => set({ risk: e.target.value })}
              placeholder="What happens if this slips?"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto' }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          color: 'var(--muted)',
          marginBottom: 5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function PrioritySelect({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {PRIORITIES.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className="ptm-prio"
          data-active={value === p}
          style={{ '--pc': PRIORITY_COLOR[p] }}
        >
          <span className="ptm-dot" style={{ background: PRIORITY_COLOR[p] }} />
          {p}
        </button>
      ))}
    </div>
  )
}

// ===========================================================================
// Custom date + time picker
// ===========================================================================
function DatePicker({ date, time, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [view, setView] = useState(() => {
    if (date) {
      const [y, m] = date.split('-').map(Number)
      return { y, m: m - 1 }
    }
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const first = new Date(view.y, view.m, 1)
  const startDow = first.getDay()
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selected = date
  const today = todayStr()
  const [hh, mm] = (time || '').split(':')

  const pick = (d) => {
    const ds = `${view.y}-${pad(view.m + 1)}-${pad(d)}`
    onChange(ds, time || '')
  }
  const setTime = (h, m) => {
    onChange(date || today, `${pad(h)}:${pad(m)}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="ptm-input ptm-datebtn"
        onClick={() => setOpen((o) => !o)}
      >
        <CalIcon size={14} style={{ color: 'var(--muted)' }} />
        <span style={{ color: date ? 'var(--text)' : 'var(--muted)' }}>
          {date ? formatDue({ dueDate: date, dueTime: time }) : 'Pick a date'}
        </span>
        {date && (
          <X
            size={13}
            className="ptm-clear"
            onClick={(e) => {
              e.stopPropagation()
              onChange('', '')
            }}
          />
        )}
      </button>

      {open && (
        <div className="ptm-cal">
          <div className="ptm-cal-head">
            <button
              type="button"
              className="ptm-iconbtn"
              onClick={() => setView((v) => shiftMonth(v, -1))}
            >
              <ChevronLeft size={16} />
            </button>
            <strong>
              {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </strong>
            <button
              type="button"
              className="ptm-iconbtn"
              onClick={() => setView((v) => shiftMonth(v, 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="ptm-cal-grid ptm-cal-dow">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="ptm-cal-grid">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />
              const ds = `${view.y}-${pad(view.m + 1)}-${pad(d)}`
              return (
                <button
                  type="button"
                  key={i}
                  className="ptm-day"
                  data-selected={selected === ds}
                  data-today={today === ds}
                  onClick={() => pick(d)}
                >
                  {d}
                </button>
              )
            })}
          </div>

          <div className="ptm-cal-time">
            <Clock size={14} style={{ color: 'var(--muted)' }} />
            <select
              className="ptm-input ptm-timesel"
              value={hh || ''}
              onChange={(e) => setTime(Number(e.target.value), Number(mm || 0))}
            >
              <option value="">--</option>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={pad(h)}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <span>:</span>
            <select
              className="ptm-input ptm-timesel"
              value={mm || ''}
              onChange={(e) => setTime(Number(hh || 0), Number(e.target.value))}
            >
              <option value="">--</option>
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <option key={m} value={pad(m)}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <div style={{ flex: 1 }} />
            <button type="button" className="ptm-textbtn" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function shiftMonth(v, delta) {
  let m = v.m + delta
  let y = v.y
  if (m < 0) {
    m = 11
    y--
  } else if (m > 11) {
    m = 0
    y++
  }
  return { y, m }
}

// ===========================================================================
// Tag token input with search + create + recolor
// ===========================================================================
function TagInput({ value, onChange, allTags, colorForTag, setTagColor }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [swatchFor, setSwatchFor] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false)
        setSwatchFor(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const suggestions = allTags
    .filter((t) => !value.includes(t) && t.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)
  const canCreate =
    q.trim() &&
    !allTags.some((t) => t.toLowerCase() === q.trim().toLowerCase()) &&
    !value.some((t) => t.toLowerCase() === q.trim().toLowerCase())

  const add = (tag) => {
    const t = tag.trim()
    if (!t) return
    if (!value.includes(t)) onChange([...value, t])
    setQ('')
  }
  const remove = (tag) => onChange(value.filter((t) => t !== tag))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="ptm-taginput" onClick={() => setOpen(true)}>
        {value.map((tag) => (
          <span
            key={tag}
            className="ptm-tagchip"
            style={{ '--tc': colorForTag(tag) }}
          >
            <button
              type="button"
              className="ptm-tagdot"
              title="Recolor"
              style={{ background: colorForTag(tag) }}
              onClick={(e) => {
                e.stopPropagation()
                setSwatchFor(swatchFor === tag ? null : tag)
              }}
            />
            {tag}
            <button type="button" className="ptm-tagx" onClick={() => remove(tag)}>
              <X size={11} />
            </button>
            {swatchFor === tag && (
              <SwatchPicker
                current={colorForTag(tag)}
                onPick={(c) => {
                  setTagColor(tag, c)
                  setSwatchFor(null)
                }}
              />
            )}
          </span>
        ))}
        <input
          className="ptm-taginput-field"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (suggestions.length) add(suggestions[0])
              else if (canCreate) add(q)
            } else if (e.key === 'Backspace' && !q && value.length) {
              remove(value[value.length - 1])
            }
          }}
          placeholder={value.length ? '' : 'Add tags…'}
        />
      </div>

      {open && (suggestions.length > 0 || canCreate) && (
        <div className="ptm-tagmenu">
          {suggestions.map((t) => (
            <button
              type="button"
              key={t}
              className="ptm-tagopt"
              onClick={() => add(t)}
            >
              <span
                className="ptm-dot"
                style={{ background: colorForTag(t) }}
              />
              {t}
            </button>
          ))}
          {canCreate && (
            <button type="button" className="ptm-tagopt" onClick={() => add(q)}>
              <Plus size={13} /> Create “{q.trim()}”
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function SwatchPicker({ current, onPick }) {
  return (
    <div className="ptm-swatches" onClick={(e) => e.stopPropagation()}>
      {TAG_PALETTE.map((c) => (
        <button
          type="button"
          key={c}
          className="ptm-swatch"
          data-active={c === current}
          style={{ background: c }}
          onClick={() => onPick(c)}
        />
      ))}
    </div>
  )
}

// ===========================================================================
// Reusable task form (inline edit + modal)
// ===========================================================================
function TaskForm({
  initial,
  mode,
  allTags,
  categories,
  colorForTag,
  setTagColor,
  onSubmit,
  onCancel,
  onDelete,
}) {
  const [d, setD] = useState({
    title: initial.title || '',
    category: initial.category || '',
    priority: initial.priority || 'medium',
    status: initial.status || 'todo',
    dueDate: initial.dueDate || '',
    dueTime: initial.dueTime || '',
    tags: initial.tags || [],
    risk: initial.risk || '',
  })
  const set = (patch) => setD((x) => ({ ...x, ...patch }))

  const submit = () => {
    if (!d.title.trim()) return
    onSubmit({ ...d, title: d.title.trim() })
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {mode === 'edit' && <h3 style={{ margin: 0 }}>Edit task</h3>}
      <input
        className="ptm-input"
        value={d.title}
        onChange={(e) => set({ title: e.target.value })}
        placeholder="Title"
        style={{ fontSize: 15, fontWeight: 600 }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}
      >
        <Field label="Category">
          <input
            className="ptm-input"
            list="ptm-cats-edit"
            value={d.category}
            onChange={(e) => set({ category: e.target.value })}
          />
          <datalist id="ptm-cats-edit">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Status">
          <select
            className="ptm-input"
            value={d.status}
            onChange={(e) => set({ status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <PrioritySelect value={d.priority} onChange={(p) => set({ priority: p })} />
        </Field>
        <Field label="Due">
          <DatePicker
            date={d.dueDate}
            time={d.dueTime}
            onChange={(date, time) => set({ dueDate: date, dueTime: time })}
          />
        </Field>
      </div>
      <Field label="Tags" wide>
        <TagInput
          value={d.tags}
          onChange={(tags) => set({ tags })}
          allTags={allTags}
          colorForTag={colorForTag}
          setTagColor={setTagColor}
        />
      </Field>
      {/* Risk only meaningful once due; show field but hint */}
      <Field label="Risk if not completed" wide>
        <input
          className="ptm-input"
          value={d.risk}
          onChange={(e) => set({ risk: e.target.value })}
          placeholder="What happens if this slips?"
        />
      </Field>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onDelete && (
          <button className="ptm-btn ptm-danger" onClick={onDelete} style={{ marginRight: 'auto' }}>
            <Trash2 size={15} /> Delete
          </button>
        )}
        <button className="ptm-btn" onClick={onCancel}>
          Cancel
        </button>
        <button className="ptm-btn ptm-primary" onClick={submit}>
          <Check size={15} /> Save
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// List view (cards sorted by due date, inline edit)
// ===========================================================================
function sortByDue(tasks) {
  return [...tasks].sort((a, b) => {
    const ad = a.dueDate ? dueDateTime(a).getTime() : Infinity
    const bd = b.dueDate ? dueDateTime(b).getTime() : Infinity
    if (ad !== bd) return ad - bd
    return (b.createdAt || 0) - (a.createdAt || 0)
  })
}

function ListView({
  tasks,
  colorForTag,
  setTagColor,
  allTags,
  categories,
  onUpdate,
  onDelete,
  onPickCategory,
  onPickTag,
}) {
  const sorted = sortByDue(tasks)
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {sorted.map((t) => (
        <TaskCard
          key={t.id}
          task={t}
          colorForTag={colorForTag}
          setTagColor={setTagColor}
          allTags={allTags}
          categories={categories}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onPickCategory={onPickCategory}
          onPickTag={onPickTag}
        />
      ))}
    </div>
  )
}

function TaskCard({
  task,
  colorForTag,
  setTagColor,
  allTags,
  categories,
  onUpdate,
  onDelete,
  onPickCategory,
  onPickTag,
}) {
  const [editing, setEditing] = useState(false)
  const overdue = isOverdue(task)
  const arrived = dueArrived(task)
  const done = task.status === 'completed'

  if (editing) {
    return (
      <div className="ptm-card" style={{ padding: 16 }}>
        <TaskForm
          initial={task}
          mode="edit"
          allTags={allTags}
          categories={categories}
          colorForTag={colorForTag}
          setTagColor={setTagColor}
          onCancel={() => setEditing(false)}
          onSubmit={(patch) => {
            onUpdate(task.id, patch)
            setEditing(false)
          }}
          onDelete={() => onDelete(task.id)}
        />
      </div>
    )
  }

  return (
    <div
      className="ptm-card"
      data-overdue={arrived && !done}
      style={{ padding: 16 }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <button
          className="ptm-check"
          data-done={done}
          onClick={() =>
            onUpdate(task.id, { status: done ? 'todo' : 'completed' })
          }
          title={done ? 'Mark as to-do' : 'Mark complete'}
        >
          {done && <Check size={14} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontWeight: 600,
                fontSize: 15,
                textDecoration: done ? 'line-through' : 'none',
                opacity: done ? 0.55 : 1,
              }}
            >
              {task.title}
            </span>
            <span
              className="ptm-dot"
              style={{ background: PRIORITY_COLOR[task.priority] }}
              title={`${task.priority} priority`}
            />
            <StatusBadge status={task.status} />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginTop: 8,
              fontSize: 12.5,
            }}
          >
            {task.category && (
              <button className="ptm-meta" onClick={() => onPickCategory(task.category)}>
                {task.category}
              </button>
            )}
            {task.dueDate && (
              <span
                className="ptm-meta"
                data-red={arrived && !done}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <CalIcon size={12} />
                {formatDue(task)}
                {overdue && ' · overdue'}
              </span>
            )}
            {(task.tags || []).map((tg) => (
              <button
                key={tg}
                className="ptm-tagchip ptm-tagchip-sm"
                style={{ '--tc': colorForTag(tg) }}
                onClick={() => onPickTag(tg)}
              >
                <span className="ptm-tagdot" style={{ background: colorForTag(tg) }} />
                {tg}
              </button>
            ))}
          </div>

          {arrived && !done && task.risk && (
            <div className="ptm-risk">
              <AlertTriangle size={13} />
              {task.risk}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button className="ptm-iconbtn" onClick={() => setEditing(true)} title="Edit">
            <Pencil size={15} />
          </button>
          <button
            className="ptm-iconbtn"
            onClick={() => onDelete(task.id)}
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const bg = {
    todo: 'var(--chip)',
    inprogress: 'rgba(99,102,241,0.18)',
    completed: 'rgba(34,197,94,0.18)',
  }[status]
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 999,
        background: bg,
        color: 'var(--text)',
        opacity: 0.85,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

// ===========================================================================
// Board view (Kanban with drag/drop)
// ===========================================================================
function BoardView({ tasks, colorForTag, onMove, onEdit, onPickCategory, onPickTag }) {
  const [dragId, setDragId] = useState(null)
  const [overCol, setOverCol] = useState(null)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 14,
        alignItems: 'start',
      }}
      className="ptm-board"
    >
      {STATUSES.map((status) => {
        const col = tasks.filter((t) => t.status === status)
        return (
          <div
            key={status}
            className="ptm-col"
            data-over={overCol === status}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(status)
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId) onMove(dragId, status, null)
              setDragId(null)
              setOverCol(null)
            }}
          >
            <div className="ptm-col-head">
              <span>{STATUS_LABEL[status]}</span>
              <span className="ptm-count">{col.length}</span>
            </div>
            <div style={{ display: 'grid', gap: 10, minHeight: 20 }}>
              {col.map((t) => {
                const overdue = isOverdue(t)
                const arrived = dueArrived(t)
                const done = t.status === 'completed'
                return (
                  <div
                    key={t.id}
                    className="ptm-bcard"
                    draggable
                    data-overdue={arrived && !done}
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => {
                      setDragId(null)
                      setOverCol(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (dragId && dragId !== t.id) onMove(dragId, status, t.id)
                      setDragId(null)
                      setOverCol(null)
                    }}
                    onClick={() => onEdit(t)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <GripVertical size={14} style={{ color: 'var(--muted)', cursor: 'grab' }} />
                      <span
                        className="ptm-dot"
                        style={{ background: PRIORITY_COLOR[t.priority] }}
                      />
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          textDecoration: done ? 'line-through' : 'none',
                          opacity: done ? 0.6 : 1,
                        }}
                      >
                        {t.title}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        flexWrap: 'wrap',
                        marginTop: 8,
                        fontSize: 12,
                      }}
                    >
                      {t.category && (
                        <button
                          className="ptm-meta"
                          onClick={(e) => {
                            e.stopPropagation()
                            onPickCategory(t.category)
                          }}
                        >
                          {t.category}
                        </button>
                      )}
                      {t.dueDate && (
                        <span className="ptm-meta" data-red={arrived && !done}>
                          {formatDue(t)}
                          {overdue && ' · overdue'}
                        </span>
                      )}
                    </div>
                    {(t.tags || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {t.tags.map((tg) => (
                          <button
                            key={tg}
                            className="ptm-tagchip ptm-tagchip-sm"
                            style={{ '--tc': colorForTag(tg) }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onPickTag(tg)
                            }}
                          >
                            <span className="ptm-tagdot" style={{ background: colorForTag(tg) }} />
                            {tg}
                          </button>
                        ))}
                      </div>
                    )}
                    {arrived && !done && t.risk && (
                      <div className="ptm-risk">
                        <AlertTriangle size={12} />
                        {t.risk}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===========================================================================
// Table view (inline dropdowns + sortable headers)
// ===========================================================================
function TableView({ tasks, colorForTag, onUpdate, onEdit, onPickCategory, onPickTag }) {
  const [sort, setSort] = useState({ key: 'due', dir: 1 })

  const rows = useMemo(() => {
    const arr = [...tasks]
    const dir = sort.dir
    arr.sort((a, b) => {
      let av, bv
      switch (sort.key) {
        case 'status':
          av = STATUSES.indexOf(a.status)
          bv = STATUSES.indexOf(b.status)
          break
        case 'priority':
          av = PRIORITIES.indexOf(a.priority)
          bv = PRIORITIES.indexOf(b.priority)
          break
        case 'category':
          av = (a.category || '').toLowerCase()
          bv = (b.category || '').toLowerCase()
          break
        case 'due':
        default:
          av = a.dueDate ? dueDateTime(a).getTime() : Infinity
          bv = b.dueDate ? dueDateTime(b).getTime() : Infinity
      }
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return arr
  }, [tasks, sort])

  const Header = ({ k, children, style }) => (
    <th style={style}>
      <button className="ptm-th" onClick={() => toggle(k)}>
        {children}
        <ArrowUpDown
          size={12}
          style={{ opacity: sort.key === k ? 1 : 0.3 }}
        />
      </button>
    </th>
  )
  const toggle = (k) =>
    setSort((s) => (s.key === k ? { key: k, dir: -s.dir } : { key: k, dir: 1 }))

  return (
    <div className="ptm-card" style={{ padding: 0, overflowX: 'auto' }}>
      <table className="ptm-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Title</th>
            <Header k="status">Status</Header>
            <Header k="priority">Priority</Header>
            <Header k="category" style={{ textAlign: 'left' }}>Category</Header>
            <Header k="due" style={{ textAlign: 'left' }}>Due</Header>
            <th>Tags</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const arrived = dueArrived(t)
            const done = t.status === 'completed'
            const overdue = isOverdue(t)
            return (
              <tr key={t.id}>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.6 : 1,
                    }}
                  >
                    {t.title}
                  </span>
                  {arrived && !done && t.risk && (
                    <div
                      className="ptm-risk"
                      style={{ marginTop: 4, fontSize: 11.5 }}
                    >
                      <AlertTriangle size={11} />
                      {t.risk}
                    </div>
                  )}
                </td>
                <td>
                  <select
                    className="ptm-mini"
                    value={t.status}
                    onChange={(e) => onUpdate(t.id, { status: e.target.value })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    className="ptm-mini"
                    value={t.priority}
                    onChange={(e) => onUpdate(t.id, { priority: e.target.value })}
                    style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 600 }}
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {t.category ? (
                    <button className="ptm-meta" onClick={() => onPickCategory(t.category)}>
                      {t.category}
                    </button>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td>
                  {t.dueDate ? (
                    <span data-red={arrived && !done} className={arrived && !done ? 'ptm-meta' : ''}>
                      {formatDue(t)}
                      {overdue && ' · overdue'}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(t.tags || []).map((tg) => (
                      <button
                        key={tg}
                        className="ptm-tagchip ptm-tagchip-sm"
                        style={{ '--tc': colorForTag(tg) }}
                        onClick={() => onPickTag(tg)}
                      >
                        <span className="ptm-tagdot" style={{ background: colorForTag(tg) }} />
                        {tg}
                      </button>
                    ))}
                  </div>
                </td>
                <td>
                  <button className="ptm-iconbtn" onClick={() => onEdit(t)} title="Edit">
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ===========================================================================
// Modal
// ===========================================================================
function Modal({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="ptm-overlay" onMouseDown={onClose}>
      <div
        className="ptm-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="ptm-iconbtn ptm-modal-x" onClick={onClose}>
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}

// ===========================================================================
// Injected styles (hover/focus behaviours inline styles can't express)
// ===========================================================================
function StyleBlock() {
  return (
    <style>{`
.ptm-root *::-webkit-scrollbar { height: 8px; width: 8px; }
.ptm-root *::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 8px; }

/* Generic button helpers */
.ptm-iconbtn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 9px; cursor: pointer;
  background: transparent; border: 1px solid transparent; color: var(--text);
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.ptm-iconbtn:hover { background: var(--chip); border-color: var(--border); }
.ptm-iconbtn:active { transform: scale(0.92); }
.ptm-toggle[data-on="true"] { background: var(--chip); border-color: var(--border2); }

.ptm-textbtn {
  background: none; border: none; color: #8b5cf6; cursor: pointer;
  font-size: 13px; padding: 2px 4px; font-weight: 600;
}
.ptm-textbtn:hover { text-decoration: underline; }

.ptm-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px;
  border-radius: 10px; border: 1px solid var(--border2); background: var(--panel);
  color: var(--text); cursor: pointer; font-size: 13px; font-weight: 600;
  transition: transform 0.1s, filter 0.15s;
}
.ptm-btn:hover { filter: brightness(1.06); }
.ptm-btn:active { transform: scale(0.97); }
.ptm-primary { background: ${ACCENT}; border: none; color: #fff; }
.ptm-danger { color: #ef4444; border-color: rgba(239,68,68,0.4); background: transparent; }

.ptm-input {
  width: 100%; padding: 9px 11px; border-radius: 10px;
  border: 1px solid var(--border); background: var(--panel);
  color: var(--text); font-size: 13.5px; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ptm-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }

/* Cards */
.ptm-card {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 16px; box-shadow: var(--shadow);
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.ptm-card:hover { border-color: var(--border2); }
.ptm-card[data-overdue="true"] {
  border-color: rgba(239,68,68,0.5);
  box-shadow: 0 0 0 1px rgba(239,68,68,0.25), var(--shadow);
}

/* Add box */
.ptm-addbox {
  background: var(--panel); border: 1px solid var(--border);
  border-radius: 16px; box-shadow: var(--shadow); padding: 14px;
  transition: border-color 0.2s;
}
.ptm-addbox:hover, .ptm-addbox:focus-within { border-color: var(--border2); }
.ptm-addrow { display: flex; gap: 10px; }
.ptm-addtitle {
  flex: 1; padding: 11px 14px; border-radius: 11px; font-size: 15px;
  border: 1px solid var(--border); background: var(--bg);
  color: var(--text); outline: none;
}
.ptm-addtitle:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
.ptm-addbtn {
  display: inline-flex; align-items: center; gap: 6px; padding: 0 18px;
  border-radius: 11px; border: none; background: ${ACCENT}; color: #fff;
  font-weight: 600; font-size: 14px; cursor: pointer; transition: transform 0.1s, filter 0.15s;
}
.ptm-addbtn:hover { filter: brightness(1.07); }
.ptm-addbtn:active { transform: scale(0.97); }

.ptm-details {
  max-height: 0; overflow: hidden; opacity: 0;
  transition: max-height 0.3s ease, opacity 0.3s ease, margin-top 0.3s ease;
}
.ptm-addbox:hover .ptm-details, .ptm-addbox:focus-within .ptm-details {
  max-height: 520px; opacity: 1; margin-top: 14px;
}
.ptm-details-inner {
  display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
  padding-top: 14px; border-top: 1px solid var(--border);
}

/* Priority picker */
.ptm-prio {
  display: inline-flex; align-items: center; gap: 5px; padding: 7px 10px;
  border-radius: 9px; border: 1px solid var(--border); background: var(--panel);
  color: var(--muted); cursor: pointer; font-size: 12.5px; text-transform: capitalize;
  transition: all 0.15s;
}
.ptm-prio[data-active="true"] {
  color: var(--text); border-color: var(--pc);
  box-shadow: inset 0 0 0 1px var(--pc);
}
.ptm-dot { width: 8px; height: 8px; border-radius: 999px; display: inline-block; flex: none; }

/* Pills + segment + search */
.ptm-pill {
  padding: 7px 13px; border-radius: 999px; border: 1px solid var(--border);
  background: var(--panel); color: var(--muted); cursor: pointer; font-size: 13px;
  transition: all 0.15s;
}
.ptm-pill:hover { color: var(--text); }
.ptm-pill[data-active="true"] {
  background: ${ACCENT}; color: #fff; border-color: transparent; font-weight: 600;
}
.ptm-search {
  display: flex; align-items: center; gap: 8px; padding: 7px 11px;
  border-radius: 11px; border: 1px solid var(--border); background: var(--panel);
  min-width: 180px;
}
.ptm-search input { border: none; background: transparent; outline: none; color: var(--text); font-size: 13.5px; width: 130px; }
.ptm-segment { display: inline-flex; padding: 3px; border-radius: 11px; background: var(--panel); border: 1px solid var(--border); gap: 2px; }
.ptm-segment button {
  display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px;
  border-radius: 8px; border: none; background: transparent; color: var(--muted);
  cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.ptm-segment button[data-active="true"] { background: ${ACCENT}; color: #fff; }
.ptm-seg-label { font-weight: 600; }

/* Category bars */
.ptm-catbar {
  text-align: left; padding: 11px 13px; border-radius: 13px;
  border: 1px solid var(--border); background: var(--panel); cursor: pointer;
  color: var(--text); transition: border-color 0.15s, transform 0.1s;
}
.ptm-catbar:hover { border-color: var(--border2); transform: translateY(-1px); }
.ptm-track { height: 7px; border-radius: 999px; background: var(--border); overflow: hidden; }
.ptm-fill { height: 100%; border-radius: 999px; background: ${ACCENT}; transition: width 0.5s ease; }

/* Meta chips */
.ptm-meta {
  border: 1px solid var(--border); background: var(--chip); color: var(--text);
  padding: 3px 8px; border-radius: 999px; cursor: pointer; font-size: 12px;
  transition: border-color 0.15s;
}
.ptm-meta:hover { border-color: var(--border2); }
.ptm-meta[data-red="true"], [data-red="true"] { color: #ef4444; border-color: rgba(239,68,68,0.4); font-weight: 600; }

/* Tag chips */
.ptm-tagchip {
  display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px 3px 6px;
  border-radius: 999px; font-size: 12px; cursor: pointer; position: relative;
  background: color-mix(in srgb, var(--tc) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--tc) 35%, transparent); color: var(--text);
}
.ptm-tagchip-sm { padding: 2px 8px 2px 6px; }
.ptm-tagdot { width: 9px; height: 9px; border-radius: 999px; border: none; cursor: pointer; padding: 0; flex: none; }
.ptm-tagx { background: none; border: none; color: var(--muted); cursor: pointer; display: inline-flex; padding: 0; }
.ptm-tagx:hover { color: var(--text); }

/* Tag input */
.ptm-taginput {
  display: flex; flex-wrap: wrap; gap: 6px; align-items: center;
  padding: 7px 9px; border-radius: 10px; border: 1px solid var(--border);
  background: var(--panel); cursor: text; min-height: 38px;
}
.ptm-taginput:focus-within { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
.ptm-taginput-field { flex: 1; min-width: 80px; border: none; background: transparent; outline: none; color: var(--text); font-size: 13px; }
.ptm-tagmenu {
  position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--panel); border: 1px solid var(--border2); border-radius: 11px;
  box-shadow: var(--shadow); padding: 5px; display: grid; gap: 2px; max-height: 220px; overflow: auto;
}
.ptm-tagopt {
  display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 8px;
  border: none; background: transparent; color: var(--text); cursor: pointer; font-size: 13px; text-align: left;
}
.ptm-tagopt:hover { background: var(--chip); }

/* Swatches */
.ptm-swatches {
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0;
  display: grid; grid-template-columns: repeat(5, 18px); gap: 6px; padding: 8px;
  background: var(--panel); border: 1px solid var(--border2); border-radius: 10px; box-shadow: var(--shadow);
}
.ptm-swatch { width: 18px; height: 18px; border-radius: 999px; border: 2px solid transparent; cursor: pointer; padding: 0; }
.ptm-swatch[data-active="true"] { border-color: var(--text); }

/* Checkbox */
.ptm-check {
  width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--border2);
  background: transparent; cursor: pointer; display: inline-flex; align-items: center;
  justify-content: center; color: #fff; flex: none; margin-top: 1px; transition: all 0.15s;
}
.ptm-check[data-done="true"] { background: ${ACCENT}; border-color: transparent; }

/* Risk */
.ptm-risk {
  display: flex; align-items: center; gap: 6px; margin-top: 9px; padding: 7px 10px;
  border-radius: 9px; font-size: 12.5px; color: #ef4444;
  background: rgba(239,68,68,0.10); border: 1px solid rgba(239,68,68,0.25);
}

/* Calendar */
.ptm-datebtn { display: flex; align-items: center; gap: 7px; cursor: pointer; text-align: left; }
.ptm-clear { margin-left: auto; color: var(--muted); }
.ptm-clear:hover { color: var(--text); }
.ptm-cal {
  position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; width: 240px;
  background: var(--panel); border: 1px solid var(--border2); border-radius: 14px;
  box-shadow: var(--shadow); padding: 12px;
}
.ptm-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.ptm-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.ptm-cal-dow { color: var(--muted); font-size: 11px; text-align: center; margin-bottom: 4px; }
.ptm-cal-dow div { padding: 2px 0; }
.ptm-day {
  aspect-ratio: 1; border: none; background: transparent; color: var(--text);
  border-radius: 8px; cursor: pointer; font-size: 12.5px; transition: background 0.12s;
}
.ptm-day:hover { background: var(--chip); }
.ptm-day[data-today="true"] { box-shadow: inset 0 0 0 1px var(--border2); }
.ptm-day[data-selected="true"] { background: ${ACCENT}; color: #fff; }
.ptm-cal-time { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
.ptm-timesel { width: auto; padding: 5px 6px; }

/* Board */
.ptm-col {
  background: var(--panel); border: 1px solid var(--border); border-radius: 16px;
  padding: 12px; transition: border-color 0.15s, background 0.15s;
}
.ptm-col[data-over="true"] { border-color: #8b5cf6; background: var(--panel2); }
.ptm-col-head { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 13px; margin-bottom: 12px; padding: 0 2px; }
.ptm-count { font-size: 12px; color: var(--muted); background: var(--chip); border-radius: 999px; padding: 1px 8px; }
.ptm-bcard {
  background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 11px;
  cursor: pointer; transition: transform 0.1s, box-shadow 0.15s, border-color 0.15s;
}
.ptm-bcard:hover { border-color: var(--border2); box-shadow: var(--shadow); }
.ptm-bcard:active { transform: scale(0.99); }
.ptm-bcard[data-overdue="true"] { border-color: rgba(239,68,68,0.5); }

/* Table */
.ptm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ptm-table th { text-align: center; padding: 12px 12px; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); white-space: nowrap; }
.ptm-table td { padding: 11px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
.ptm-table tr:last-child td { border-bottom: none; }
.ptm-table tbody tr:hover { background: var(--chip); }
.ptm-th { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: inherit; cursor: pointer; font: inherit; font-weight: 600; }
.ptm-mini { padding: 5px 7px; border-radius: 8px; border: 1px solid var(--border); background: var(--panel); color: var(--text); font-size: 12.5px; cursor: pointer; outline: none; text-transform: capitalize; }

/* Modal */
.ptm-overlay {
  position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-start; justify-content: center; padding: 40px 16px; overflow: auto;
  backdrop-filter: blur(3px);
}
.ptm-modal {
  position: relative; width: 100%; max-width: 540px; background: var(--panel);
  border: 1px solid var(--border2); border-radius: 18px; box-shadow: var(--shadow);
  padding: 22px; color: var(--text); animation: ptm-pop 0.18s ease;
}
.ptm-modal-x { position: absolute; top: 12px; right: 12px; }
@keyframes ptm-pop { from { transform: translateY(8px) scale(0.98); opacity: 0; } to { transform: none; opacity: 1; } }

@media (max-width: 720px) {
  .ptm-details-inner { grid-template-columns: 1fr 1fr; }
  .ptm-board { grid-template-columns: 1fr; }
  .ptm-seg-label { display: none; }
}
`}</style>
  )
}
