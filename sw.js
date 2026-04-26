const STORAGE_KEY = "discipline_v3";
const NOTIF_KEY = "discipline_notif";

// ── Date helpers (duplicated from app, SW has no access to main JS) ──
function todayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekDays() {
  const now = new Date();
  const daysFromMon = (now.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - daysFromMon + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
}

function dayIndex(dateStr) {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7;
}

function getSchedule(data, taskId) {
  return (data.schedules || {})[taskId] || [];
}

function getLog(data, date) {
  const base = {};
  (data.tasks || []).forEach(t => { base[t.id] = false; });
  return { ...base, ...(data.logs[date] || {}) };
}

function tasksForDate(data, dateStr) {
  const di = dayIndex(dateStr);
  return (data.tasks || []).filter(t => getSchedule(data, t.id).includes(di));
}

function computeCompliance(data) {
  const today = todayStr();
  const weekDays = getWeekDays();
  const todayIdx = weekDays.indexOf(today);
  let required = 0, done = 0;
  (data.tasks || []).forEach(task => {
    const schedule = getSchedule(data, task.id);
    weekDays.forEach((d, i) => {
      if (i > todayIdx) return;
      if (!schedule.includes(dayIndex(d))) return;
      required++;
      if (getLog(data, d)[task.id]) done++;
    });
  });
  return required === 0 ? 100 : Math.round((done / required) * 100);
}

function bestPossibleScore(data) {
  const today = todayStr();
  const weekDays = getWeekDays();
  const todayIdx = weekDays.indexOf(today);
  let required = 0, done = 0;
  (data.tasks || []).forEach(task => {
    const schedule = getSchedule(data, task.id);
    weekDays.forEach((d, i) => {
      if (!schedule.includes(dayIndex(d))) return;
      required++;
      if (i < todayIdx) { if (getLog(data, d)[task.id]) done++; }
      else done++;
    });
  });
  return required === 0 ? 100 : Math.round((done / required) * 100);
}

const MOTIVATIONAL = [
  "You said you would.",
  "Don't break the chain.",
  "One day at a time.",
  "Small wins add up.",
  "No excuses today.",
  "Do the work.",
  "Stay the course.",
  "It counts.",
  "Show up.",
  "Make it happen.",
];

function buildNotificationMessage(data) {
  const today = todayStr();
  const todayTasks = tasksForDate(data, today);
  const log = getLog(data, today);
  const remaining = todayTasks.filter(t => !log[t.id]);
  const current = computeCompliance(data);
  const best = bestPossibleScore(data);
  const motiv = MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)];

  if (remaining.length === 0) {
    return {
      title: "Discipline ✓",
      body: current === 100
        ? `Perfect so far this week. ${motiv}`
        : `All done today — ${current}% this week. ${motiv}`,
    };
  }

  const n = remaining.length;
  const reachLine = best > current
    ? ` Do them and you can reach ${best}% this week.`
    : "";

  return {
    title: "Discipline — check in",
    body: `${n} task${n > 1 ? "s" : ""} left today.${reachLine} ${motiv}`,
  };
}

// ── Install & activate ─────────────────────────────────────────────
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// ── Notification click ─────────────────────────────────────────────
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(clients => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow("/");
    })
  );
});

// ── Message from app: schedule or fire notification ────────────────
self.addEventListener("message", e => {
  if (e.data?.type === "CHECK_NOTIFY") {
    handleCheck(e.data.data);
  }
});

function handleCheck(appData) {
  if (!appData) return;
  const notif = buildNotificationMessage(appData);
  self.registration.showNotification(notif.title, {
    body: notif.body,
    icon: "/icon.png",
    badge: "/icon.png",
    tag: "discipline-daily",
    renotify: false,
  });
}
