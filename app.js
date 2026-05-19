const STORAGE_KEY = "signal-habit-lab-v1";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = loadState();

const elements = {
  todayLabel: $("#todayLabel"),
  weekScore: $("#weekScore"),
  scoreBars: $("#scoreBars"),
  habitList: $("#habitList"),
  dailyNudge: $("#dailyNudge"),
  energyPicker: $("#energyPicker"),
  frictionSlider: $("#frictionSlider"),
  environmentPicker: $("#environmentPicker"),
  signalGrid: $("#signalGrid"),
  conditionList: $("#conditionList"),
  loggedCount: $("#loggedCount"),
  timeline: $("#timeline"),
  experimentList: $("#experimentList"),
  habitDialog: $("#habitDialog"),
  habitForm: $("#habitForm"),
  exportDialog: $("#exportDialog"),
  exportText: $("#exportText"),
};

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  return seedState();
}

function seedState() {
  const habits = [
    {
      id: crypto.randomUUID(),
      name: "Strength reset",
      minimum: "Two controlled push-ups",
      cue: "After coffee",
      friction: "Workout clothes hidden away",
      color: "#2166f3",
    },
    {
      id: crypto.randomUUID(),
      name: "Deep reading",
      minimum: "Read one page",
      cue: "Phone goes on charge",
      friction: "Book not visible",
      color: "#07845f",
    },
    {
      id: crypto.randomUUID(),
      name: "Inbox shutdown",
      minimum: "Archive five messages",
      cue: "Before closing laptop",
      friction: "No stopping point",
      color: "#df614f",
    },
  ];

  const contexts = [
    ["steady", "home", 2],
    ["low", "home", 4],
    ["steady", "office", 3],
    ["high", "outside", 1],
    ["low", "travel", 5],
    ["steady", "home", 2],
    ["high", "office", 2],
    ["steady", "home", 3],
    ["low", "office", 4],
    ["high", "home", 1],
    ["steady", "outside", 2],
    ["low", "home", 3],
  ];

  const logs = [];
  const today = startOfDay(new Date());
  habits.forEach((habit, habitIndex) => {
    contexts.forEach(([energy, environment, friction], dayIndex) => {
      const date = addDays(today, dayIndex - 12);
      const score = (energy === "high" ? 2 : energy === "steady" ? 1 : -1) - friction + habitIndex;
      let status = "blocked";
      if (score >= 0) status = "full";
      if (score === -1) status = "tiny";
      if ((dayIndex + habitIndex) % 7 === 0) status = "tiny";
      logs.push({
        id: crypto.randomUUID(),
        habitId: habit.id,
        date: toDateKey(date),
        status,
        energy,
        environment,
        friction,
        note: status === "blocked" ? "Friction won. Needs a smaller door." : "",
      });
    });
  });

  return {
    habits,
    logs,
    experiments: [
      {
        id: crypto.randomUUID(),
        habitId: habits[0].id,
        title: "Put the tiny version in the path",
        detail: "Leave workout clothes beside the kettle and count two push-ups as a kept promise.",
        days: 5,
        active: true,
      },
      {
        id: crypto.randomUUID(),
        habitId: habits[1].id,
        title: "Swap reminder for visible evidence",
        detail: "Keep the book open on the pillow, then mark whether visibility changed the result.",
        days: 4,
        active: true,
      },
    ],
    context: {
      energy: "steady",
      environment: "home",
      friction: 2,
    },
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(date.getDate() + amount);
  return next;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

function getTodayLog(habitId) {
  const today = toDateKey(new Date());
  return state.logs.find((log) => log.habitId === habitId && log.date === today);
}

function upsertLog(habitId, status, note = "") {
  const today = toDateKey(new Date());
  const existing = getTodayLog(habitId);
  if (existing) {
    Object.assign(existing, {
      status,
      note,
      energy: state.context.energy,
      environment: state.context.environment,
      friction: Number(state.context.friction),
    });
  } else {
    state.logs.push({
      id: crypto.randomUUID(),
      habitId,
      date: today,
      status,
      energy: state.context.energy,
      environment: state.context.environment,
      friction: Number(state.context.friction),
      note,
    });
  }
  saveState();
  render();
}

function render() {
  elements.todayLabel.textContent = formatDateLabel(new Date());
  renderWeeklyScore();
  renderHabits();
  renderNudge();
  renderSignals();
  renderConditions();
  renderTimeline();
  renderExperiments();
  syncContextControls();
}

function renderWeeklyScore() {
  const dates = Array.from({ length: 7 }, (_, index) => toDateKey(addDays(new Date(), index - 6)));
  const dailyScores = dates.map((date) => {
    const logs = state.logs.filter((log) => log.date === date);
    if (!logs.length) return 0;
    const kept = logs.filter((log) => log.status === "full" || log.status === "tiny").length;
    return Math.round((kept / state.habits.length) * 100);
  });
  const average = dailyScores.length
    ? Math.round(dailyScores.reduce((sum, score) => sum + score, 0) / dailyScores.length)
    : 0;
  elements.weekScore.textContent = `${average}%`;
  elements.scoreBars.innerHTML = dailyScores
    .map((score) => `<span style="height:${Math.max(score, 8)}%" title="${score}%"></span>`)
    .join("");
}

function renderHabits() {
  elements.habitList.innerHTML = state.habits.map((habit) => renderHabitCard(habit)).join("");
}

function renderHabitCard(habit) {
  const log = getTodayLog(habit.id);
  const reliability = getHabitReliability(habit.id, 14);
  const rescueRate = getHabitTinyRate(habit.id, 14);
  const status = log?.status ?? "";
  return `
    <article class="habit-card ${status ? "done" : ""}">
      <div>
        <div class="habit-title">
          <span class="habit-dot" style="background:${habit.color}; box-shadow:0 0 0 .35rem ${habit.color}22"></span>
          <h3>${escapeHtml(habit.name)}</h3>
        </div>
        <dl class="habit-meta">
          <div><dt>Minimum</dt><dd>${escapeHtml(habit.minimum)}</dd></div>
          <div><dt>Cue</dt><dd>${escapeHtml(habit.cue)}</dd></div>
          <div><dt>Remove</dt><dd>${escapeHtml(habit.friction)}</dd></div>
        </dl>
        <div class="habit-stats">
          <div class="stat-tile"><strong>${reliability}%</strong><span>kept in 14 days</span></div>
          <div class="stat-tile"><strong>${rescueRate}%</strong><span>saved by tiny mode</span></div>
        </div>
      </div>
      <div>
        <div class="status-row" role="group" aria-label="${escapeHtml(habit.name)} result">
          ${renderStatusButton(habit.id, "full", "Full", status)}
          ${renderStatusButton(habit.id, "tiny", "Tiny", status)}
          ${renderStatusButton(habit.id, "blocked", "Blocked", status)}
        </div>
        <label class="note-label">
          Quick evidence note
          <input data-note="${habit.id}" value="${escapeAttribute(log?.note ?? "")}" placeholder="What made this easier or harder?" />
        </label>
      </div>
    </article>
  `;
}

function renderStatusButton(habitId, status, label, activeStatus) {
  return `
    <button class="status-button ${activeStatus === status ? "is-selected" : ""}" data-habit="${habitId}" data-status="${status}">
      ${label}
    </button>
  `;
}

function getHabitReliability(habitId, days) {
  const logs = getHabitLogs(habitId, days);
  if (!logs.length) return 0;
  const kept = logs.filter((log) => log.status === "full" || log.status === "tiny").length;
  return Math.round((kept / days) * 100);
}

function getHabitTinyRate(habitId, days) {
  const logs = getHabitLogs(habitId, days);
  if (!logs.length) return 0;
  const tiny = logs.filter((log) => log.status === "tiny").length;
  return Math.round((tiny / days) * 100);
}

function getHabitLogs(habitId, days) {
  const start = toDateKey(addDays(new Date(), -(days - 1)));
  return state.logs.filter((log) => log.habitId === habitId && log.date >= start);
}

function renderNudge() {
  const best = findBestCondition();
  const blocked = state.logs.filter((log) => log.status === "blocked").slice(-1)[0];
  if (!state.logs.length) {
    elements.dailyNudge.textContent = "Log one habit today and Signal will start finding patterns.";
    return;
  }
  if (best) {
    elements.dailyNudge.textContent = `Your strongest signal is ${best.label}: ${best.rate}% of matching logs were kept. Try arranging one habit around that condition today.`;
    return;
  }
  elements.dailyNudge.textContent = blocked
    ? `Last block had ${blocked.friction}/5 friction. Shrink the next attempt until it feels almost too easy.`
    : "Tiny completions count here because they preserve the behavior loop.";
}

function renderSignals() {
  const total = state.logs.length;
  const kept = state.logs.filter((log) => log.status === "full" || log.status === "tiny").length;
  const tiny = state.logs.filter((log) => log.status === "tiny").length;
  const blocked = state.logs.filter((log) => log.status === "blocked").length;
  const averageFriction = total
    ? (state.logs.reduce((sum, log) => sum + Number(log.friction), 0) / total).toFixed(1)
    : "0.0";
  elements.loggedCount.textContent = `${total} logs`;
  elements.signalGrid.innerHTML = [
    ["Baseline kept", `${total ? Math.round((kept / total) * 100) : 0}%`, "Full or tiny versions completed."],
    ["Tiny saves", `${total ? Math.round((tiny / total) * 100) : 0}%`, "Days rescued without pretending they were perfect."],
    ["Friction load", averageFriction, "Average reported difficulty from 1 to 5."],
    ["Blocks", `${blocked}`, "Moments that become design clues."],
    ["Active habits", `${state.habits.length}`, "Designed with cues, minimums, and friction."],
    ["Experiments", `${state.experiments.filter((experiment) => experiment.active).length}`, "Small environmental changes currently being tested."],
  ]
    .map(
      ([label, value, copy]) => `
        <article class="signal-card">
          <p class="eyebrow">${label}</p>
          <strong>${value}</strong>
          <p>${copy}</p>
        </article>
      `,
    )
    .join("");
}

function renderConditions() {
  const conditions = getConditionRates();
  if (!conditions.length) {
    elements.conditionList.innerHTML = `<div class="condition-item"><p>No patterns yet. Log a few days to build your signal map.</p></div>`;
    return;
  }
  elements.conditionList.innerHTML = conditions
    .slice(0, 5)
    .map(
      (condition) => `
        <article class="condition-item">
          <div>
            <strong>${condition.label}</strong>
            <p>${condition.kept} of ${condition.total} attempts kept</p>
          </div>
          <div class="condition-meter" aria-label="${condition.rate}% kept">
            <span style="--meter-width:${condition.rate}%"></span>
          </div>
        </article>
      `,
    )
    .join("");
}

function getConditionRates() {
  const groups = new Map();
  state.logs.forEach((log) => {
    [
      [`Energy: ${log.energy}`, log.energy],
      [`Place: ${log.environment}`, log.environment],
      [`Friction ${log.friction}/5`, String(log.friction)],
    ].forEach(([label, key]) => {
      if (!groups.has(label)) groups.set(label, { label, key, total: 0, kept: 0 });
      const group = groups.get(label);
      group.total += 1;
      if (log.status === "full" || log.status === "tiny") group.kept += 1;
    });
  });
  return Array.from(groups.values())
    .filter((group) => group.total >= 3)
    .map((group) => ({
      ...group,
      rate: Math.round((group.kept / group.total) * 100),
    }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total);
}

function findBestCondition() {
  return getConditionRates()[0];
}

function renderTimeline() {
  const dates = Array.from({ length: 14 }, (_, index) => addDays(new Date(), index - 13));
  const header = [`<div class="timeline-cell timeline-name">Habit</div>`]
    .concat(
      dates.map(
        (date) => `<div class="timeline-cell">${new Intl.DateTimeFormat("en", { day: "2-digit", month: "short" }).format(date)}</div>`,
      ),
    )
    .join("");
  const rows = state.habits
    .map((habit) => {
      const cells = dates
        .map((date) => {
          const key = toDateKey(date);
          const log = state.logs.find((item) => item.habitId === habit.id && item.date === key);
          const status = log?.status ?? "";
          return `<div class="timeline-cell"><span class="signal-dot ${status}" title="${status || "No log"}"></span></div>`;
        })
        .join("");
      return `<div class="timeline-cell timeline-name">${escapeHtml(habit.name)}</div>${cells}`;
    })
    .join("");
  elements.timeline.innerHTML = `<div class="timeline-table">${header}${rows}</div>`;
}

function renderExperiments() {
  if (!state.experiments.length) {
    elements.experimentList.innerHTML = `<article class="experiment-card"><p>No experiments yet. Create one from your highest-friction habit.</p></article>`;
    return;
  }
  elements.experimentList.innerHTML = state.experiments
    .map((experiment) => {
      const habit = state.habits.find((item) => item.id === experiment.habitId);
      return `
        <article class="experiment-card">
          <div class="experiment-top">
            <div>
              <p class="eyebrow">${habit ? escapeHtml(habit.name) : "Habit"}</p>
              <strong>${escapeHtml(experiment.title)}</strong>
            </div>
            <span class="soft-pill">${experiment.days} days</span>
          </div>
          <p>${escapeHtml(experiment.detail)}</p>
          <div class="experiment-actions">
            <button class="ghost-button" data-complete-experiment="${experiment.id}">${experiment.active ? "Mark Learned" : "Restart"}</button>
            <button class="ghost-button" data-delete-experiment="${experiment.id}">Remove</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function syncContextControls() {
  $$("#energyPicker button").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.energy === state.context.energy);
  });
  $$("#environmentPicker .chip").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.env === state.context.environment);
  });
  elements.frictionSlider.value = state.context.friction;
}

function createSmartExperiment() {
  const blockedLogs = state.logs
    .filter((log) => log.status === "blocked")
    .sort((a, b) => b.date.localeCompare(a.date));
  const sourceLog = blockedLogs[0] ?? state.logs[state.logs.length - 1];
  const habit = state.habits.find((item) => item.id === sourceLog?.habitId) ?? state.habits[0];
  if (!habit) return;
  state.experiments.unshift({
    id: crypto.randomUUID(),
    habitId: habit.id,
    title: `Lower friction for ${habit.name}`,
    detail: `Before the cue, make "${habit.minimum}" visible and ready. The test passes if friction drops below ${Math.max(1, state.context.friction - 1)}/5 twice this week.`,
    days: 7,
    active: true,
  });
  saveState();
  render();
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  Object.assign(state, seedState());
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

$$(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    $$(".tab-button").forEach((item) => item.classList.remove("is-active"));
    $$(".view").forEach((view) => view.classList.remove("is-active"));
    button.classList.add("is-active");
    $(`#${button.dataset.view}View`).classList.add("is-active");
  });
});

elements.habitList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-habit][data-status]");
  if (!button) return;
  const note = $(`[data-note="${button.dataset.habit}"]`)?.value ?? "";
  upsertLog(button.dataset.habit, button.dataset.status, note);
});

elements.habitList.addEventListener("change", (event) => {
  const input = event.target.closest("[data-note]");
  if (!input) return;
  const log = getTodayLog(input.dataset.note);
  if (!log) return;
  log.note = input.value;
  saveState();
});

elements.energyPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-energy]");
  if (!button) return;
  state.context.energy = button.dataset.energy;
  saveState();
  render();
});

elements.environmentPicker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-env]");
  if (!button) return;
  state.context.environment = button.dataset.env;
  saveState();
  render();
});

elements.frictionSlider.addEventListener("input", (event) => {
  state.context.friction = Number(event.target.value);
  saveState();
});

$("#openAddHabit").addEventListener("click", () => {
  elements.habitDialog.showModal();
});

$$("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    $(`#${button.dataset.closeDialog}`)?.close();
  });
});

elements.habitForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.habitForm);
  state.habits.push({
    id: crypto.randomUUID(),
    name: formData.get("name").trim(),
    minimum: formData.get("minimum").trim(),
    cue: formData.get("cue").trim(),
    friction: formData.get("friction").trim(),
    color: ["#2166f3", "#07845f", "#df614f", "#7458e8", "#f4b942"][state.habits.length % 5],
  });
  elements.habitForm.reset();
  elements.habitDialog.close();
  saveState();
  render();
});

$("#resetDemo").addEventListener("click", resetDemo);

$("#exportData").addEventListener("click", () => {
  elements.exportText.value = JSON.stringify(state, null, 2);
  elements.exportDialog.showModal();
});

$("#createExperiment").addEventListener("click", createSmartExperiment);

elements.experimentList.addEventListener("click", (event) => {
  const complete = event.target.closest("[data-complete-experiment]");
  const remove = event.target.closest("[data-delete-experiment]");
  if (complete) {
    const experiment = state.experiments.find((item) => item.id === complete.dataset.completeExperiment);
    experiment.active = !experiment.active;
  }
  if (remove) {
    state.experiments = state.experiments.filter((item) => item.id !== remove.dataset.deleteExperiment);
  }
  saveState();
  render();
});

render();
