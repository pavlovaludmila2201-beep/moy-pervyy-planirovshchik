const calendarRoot = document.querySelector("#calendarRoot");
const calendarScroll = document.querySelector("#calendarScroll");
const periodTitle = document.querySelector("#periodTitle");
const viewEyebrow = document.querySelector("#viewEyebrow");
const footerCaption = document.querySelector("#footerCaption");
const todayButton = document.querySelector("#goToday");
const previousButton = document.querySelector("#previousPeriod");
const nextButton = document.querySelector("#nextPeriod");
const addTaskButton = document.querySelector("#addTask");
const taskDialog = document.querySelector("#taskDialog");
const deleteConfirmDialog = document.querySelector("#deleteConfirmDialog");
const backupConfirmDialog = document.querySelector("#backupConfirmDialog");
const backupFile = document.querySelector("#backupFile");
const taskForm = document.querySelector("#taskForm");
const taskTitle = document.querySelector("#taskTitle");
const taskDate = document.querySelector("#taskDate");
const taskStart = document.querySelector("#taskStart");
const taskEnd = document.querySelector("#taskEnd");
const taskPriority = document.querySelector("#taskPriority");
const taskStatus = document.querySelector("#taskStatus");
const taskNote = document.querySelector("#taskNote");
const taskFormError = document.querySelector("#taskFormError");
const taskDialogTitle = document.querySelector("#taskDialogTitle");
const viewButtons = [...document.querySelectorAll("[data-view]")];
const taskFilters = document.querySelector("#taskFilters");

const STORAGE_KEY = "task-planner.tasks.v1";
const BACKUP_SCHEMA = "planner-tasks-backup";
const BACKUP_VERSION = 1;
const HOUR_HEIGHT = 60;
const PLANNING_START_MINUTES = 8 * 60;
const PLANNING_END_MINUTES = 21 * 60;
const PLANNING_HOURS = (PLANNING_END_MINUTES - PLANNING_START_MINUTES) / 60;
const viewNames = { day: "День", week: "Неделя", month: "Месяц" };
const weekdayShort = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"];
const weekdayLong = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];
const monthNames = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const monthNamesNominative = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const priorities = ["low", "normal", "high", "urgent"];
const statuses = ["planned", "in-progress", "completed", "postponed", "rescheduled"];
const priorityLabels = { low: "низкий приоритет", normal: "обычный приоритет", high: "высокий приоритет", urgent: "срочный приоритет" };
const statusLabels = { planned: "запланировано", "in-progress": "в процессе", completed: "выполнено", postponed: "отложено", rescheduled: "перенесено" };

const state = {
  view: "week",
  date: startOfDay(new Date()),
  tasks: loadTasks(),
  editingTaskId: null,
  deletingTaskId: null,
  pendingImportTasks: null,
  filters: { priorities: new Set(), statuses: new Set() },
};

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date) {
  const day = (date.getDay() + 6) % 7;
  return addDays(startOfDay(date), -day);
}

function sameDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function dateToKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatRangeTitle() {
  if (state.view === "day") {
    return `${state.date.getDate()} ${monthNames[state.date.getMonth()]} ${state.date.getFullYear()}`;
  }

  if (state.view === "month") {
    return `${monthNamesNominative[state.date.getMonth()]} ${state.date.getFullYear()}`;
  }

  const first = startOfWeek(state.date);
  const last = addDays(first, 6);
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} ${monthNames[last.getMonth()]} ${last.getFullYear()}`;
  }
  return `${first.getDate()} ${monthNames[first.getMonth()]} – ${last.getDate()} ${monthNames[last.getMonth()]} ${last.getFullYear()}`;
}

function updateHeader() {
  periodTitle.textContent = formatRangeTitle();
  viewEyebrow.textContent = state.view === "week" ? "ВАШ ПЛАН НА НЕДЕЛЮ" : `ВАШ ПЛАН · ${viewNames[state.view].toUpperCase()}`;
  footerCaption.textContent = state.view === "week"
    ? "Ваша неделя — в одном спокойном ритме"
    : `План на ${state.view === "day" ? "день" : "месяц"} — в одном спокойном ритме`;

  viewButtons.forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
}

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidStoredTask);
  } catch {
    return [];
  }
}

function isValidStoredTask(task) {
  return task
    && typeof task.id === "string"
    && typeof task.title === "string"
    && typeof task.date === "string"
    && typeof task.startTime === "string"
    && typeof task.endTime === "string"
    && typeof task.note === "string"
    && priorities.includes(task.priority)
    && statuses.includes(task.status);
}

function persistTasks(nextTasks) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextTasks));
    state.tasks = nextTasks;
    return true;
  } catch {
    showFormError("Не удалось сохранить задачу. Проверьте, разрешено ли хранение данных в этом браузере.");
    return false;
  }
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function buildTimeOptions() {
  const startFragment = document.createDocumentFragment();
  const endFragment = document.createDocumentFragment();

  for (let minutes = PLANNING_START_MINUTES; minutes < PLANNING_END_MINUTES; minutes += 15) {
    const option = makeElement("option", "", minutesToTime(minutes));
    option.value = minutesToTime(minutes);
    startFragment.append(option);
  }
  for (let minutes = PLANNING_START_MINUTES + 15; minutes <= PLANNING_END_MINUTES; minutes += 15) {
    const option = makeElement("option", "", minutesToTime(minutes));
    option.value = minutesToTime(minutes);
    endFragment.append(option);
  }
  taskStart.replaceChildren(startFragment);
  taskEnd.replaceChildren(endFragment);
}

function defaultStartTime() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const rounded = Math.ceil(currentMinutes / 15) * 15;
  return minutesToTime(Math.max(PLANNING_START_MINUTES, Math.min(rounded, PLANNING_END_MINUTES - 15)));
}

function defaultEndTime(startTime) {
  const end = Math.min(timeToMinutes(startTime) + 60, PLANNING_END_MINUTES);
  return minutesToTime(end);
}

function getTasksForDate(dateKey) {
  return state.tasks
    .filter((task) => task.date === dateKey && matchesTaskFilters(task))
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
}

function matchesTaskFilters(task) {
  const { priorities: selectedPriorities, statuses: selectedStatuses } = state.filters;
  const priorityMatches = selectedPriorities.size === 0 || selectedPriorities.has(task.priority);
  const statusMatches = selectedStatuses.size === 0 || selectedStatuses.has(task.status);
  return priorityMatches && statusMatches;
}

function updateFilterButtons() {
  taskFilters.querySelectorAll("[data-filter-type]").forEach((button) => {
    const filterValues = button.dataset.filterType === "priority"
      ? state.filters.priorities
      : state.filters.statuses;
    const selected = button.dataset.filterValue === "all"
      ? filterValues.size === 0
      : filterValues.has(button.dataset.filterValue);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderSchedule() {
  const days = state.view === "day"
    ? [state.date]
    : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(state.date), index));
  const root = makeElement("div", "schedule");
  root.style.setProperty("--day-count", days.length);

  const header = makeElement("div", "schedule-header");
  header.append(makeElement("div", "schedule-corner"));
  days.forEach((date) => {
    const weekdayIndex = (date.getDay() + 6) % 7;
    const heading = makeElement("div", "day-heading");
    heading.dataset.clickable = state.view === "week" ? "true" : "false";
    heading.classList.toggle("is-today", sameDate(date, new Date()));
    heading.classList.toggle("is-selected", sameDate(date, state.date));
    heading.setAttribute("aria-label", `${weekdayLong[weekdayIndex]}, ${date.getDate()} ${monthNames[date.getMonth()]}`);
    if (state.view === "week") {
      heading.tabIndex = 0;
      heading.setAttribute("role", "button");
      heading.addEventListener("click", () => selectDay(date));
      heading.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectDay(date);
        }
      });
    }
    heading.append(
      makeElement("span", "weekday", weekdayShort[weekdayIndex]),
      makeElement("span", "day-number", String(date.getDate())),
    );
    header.append(heading);
  });
  root.append(header);

  const body = makeElement("div", "schedule-body");
  body.style.setProperty("--day-count", days.length);
  const timeAxis = makeElement("div", "time-axis");
  for (let hour = PLANNING_START_MINUTES / 60; hour < PLANNING_END_MINUTES / 60; hour += 1) {
    const label = makeElement("div", `time-label${hour === PLANNING_START_MINUTES / 60 ? " is-range-start" : ""}${hour === 0 ? " is-midnight" : ""}`, `${String(hour).padStart(2, "0")}:00`);
    if (hour === 0) label.setAttribute("aria-label", "Полночь");
    timeAxis.append(label);
  }
  const endBoundary = makeElement("div", "time-label time-end-label", minutesToTime(PLANNING_END_MINUTES));
  timeAxis.append(endBoundary);
  body.append(timeAxis);

  days.forEach((date) => {
    const key = dateToKey(date);
    const track = makeElement("div", `day-track${sameDate(date, new Date()) ? " is-today" : ""}`);
    track.dataset.date = key;
    track.setAttribute("aria-label", `${date.getDate()} ${monthNames[date.getMonth()]}`);
    track.addEventListener("click", (event) => {
      if (event.target.closest(".task-card")) return;
      const bounds = track.getBoundingClientRect();
      const minutesFromStart = Math.max(0, Math.min(PLANNING_HOURS * HOUR_HEIGHT - 15, event.clientY - bounds.top));
      const startMinutes = PLANNING_START_MINUTES + Math.floor(minutesFromStart / 15) * 15;
      openTaskDialog({ date: key, startTime: minutesToTime(startMinutes) });
    });
    track.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes("text/task-id")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      track.classList.add("is-drop-target");
    });
    track.addEventListener("dragleave", (event) => {
      if (!track.contains(event.relatedTarget)) track.classList.remove("is-drop-target");
    });
    track.addEventListener("drop", (event) => {
      event.preventDefault();
      track.classList.remove("is-drop-target");
      const taskId = event.dataTransfer?.getData("text/task-id");
      if (taskId) moveTaskToCalendarSlot(taskId, key, event.clientY, track);
    });

    getTasksForDate(key).forEach((task) => track.append(renderTaskCard(task)));
    body.append(track);
  });

  root.append(body);
  calendarRoot.replaceChildren(root);
  calendarScroll.scrollTop = 0;
}

function renderTaskCard(task) {
  const card = makeElement("button", `task-card priority-${task.priority} status-${task.status}`);
  card.type = "button";
  card.draggable = true;
  card.dataset.taskId = task.id;
  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);
  const duration = end - start;
  card.style.top = `${start - PLANNING_START_MINUTES}px`;
  card.style.height = `${duration}px`;
  if (duration < 38) card.classList.add("is-compact");
  if (duration < 23) card.classList.add("is-very-compact");
  card.title = `${task.startTime}–${task.endTime} · ${task.title}${task.note ? ` · ${task.note}` : ""}`;
  card.setAttribute("aria-label", `${task.startTime}–${task.endTime}, ${task.title}, ${statusLabels[task.status]}, ${priorityLabels[task.priority]}`);
  card.append(
    makeElement("span", "task-time", `${task.startTime}–${task.endTime}`),
    makeElement("span", "task-title", task.title),
  );
  if (task.note) card.append(makeElement("span", "task-note-indicator", ""));
  card.addEventListener("click", (event) => {
    event.stopPropagation();
    openTaskDialog({ task });
  });
  card.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/task-id", task.id);
    event.dataTransfer.effectAllowed = "move";
    card.classList.add("is-dragging");
  });
  card.addEventListener("dragend", () => {
    card.classList.remove("is-dragging");
    document.querySelectorAll(".day-track.is-drop-target").forEach((track) => track.classList.remove("is-drop-target"));
  });
  return card;
}

function renderMonth() {
  const root = makeElement("div", "month-view");
  const weekdays = makeElement("div", "month-weekdays");
  weekdayShort.forEach((weekday) => weekdays.append(makeElement("div", "month-weekday", weekday)));
  root.append(weekdays);

  const grid = makeElement("div", "month-grid");
  const firstOfMonth = new Date(state.date.getFullYear(), state.date.getMonth(), 1);
  const start = startOfWeek(firstOfMonth);
  const daysInMonth = new Date(state.date.getFullYear(), state.date.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((((firstOfMonth.getDay() + 6) % 7) + daysInMonth) / 7) * 7;

  for (let index = 0; index < cellCount; index += 1) {
    const date = addDays(start, index);
    const key = dateToKey(date);
    const cell = makeElement("button", "month-day");
    cell.type = "button";
    cell.classList.toggle("is-outside", date.getMonth() !== state.date.getMonth());
    cell.classList.toggle("is-today", sameDate(date, new Date()));
    cell.classList.toggle("is-selected", sameDate(date, state.date));
    cell.setAttribute("aria-label", `Открыть ${date.getDate()} ${monthNames[date.getMonth()]}`);
    cell.append(makeElement("span", "month-day-number", String(date.getDate())));
    const tasks = getTasksForDate(key);
    if (tasks.length) {
      const list = makeElement("span", "month-task-list");
      tasks.slice(0, 2).forEach((task) => {
        list.append(makeElement("span", `month-task-item priority-${task.priority}`, `${task.startTime} ${task.title}`));
      });
      if (tasks.length > 2) list.append(makeElement("span", "month-task-more", `+ ещё ${tasks.length - 2}`));
      cell.append(list);
      cell.setAttribute("aria-label", `${date.getDate()} ${monthNames[date.getMonth()]}, задач: ${tasks.length}. Открыть день`);
    }
    cell.addEventListener("click", () => selectDay(date));
    grid.append(cell);
  }

  root.append(grid);
  calendarRoot.replaceChildren(root);
}

function renderMobileAgenda() {
  const root = makeElement("section", "mobile-agenda");
  root.setAttribute("aria-label", state.view === "week" ? "Задачи недели" : "Задачи дня");
  if (state.view === "week") {
    const strip = makeElement("div", "mobile-day-strip");
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", "Выбрать день недели");
    Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(state.date), index)).forEach((date) => {
      const day = makeElement("button", "mobile-day-button");
      day.type = "button";
      const weekdayIndex = (date.getDay() + 6) % 7;
      day.classList.toggle("is-selected", sameDate(date, state.date));
      day.classList.toggle("is-today", sameDate(date, new Date()));
      day.setAttribute("aria-pressed", String(sameDate(date, state.date)));
      day.setAttribute("aria-label", `${weekdayLong[weekdayIndex]}, ${date.getDate()} ${monthNames[date.getMonth()]}`);
      day.append(makeElement("span", "mobile-day-weekday", weekdayShort[weekdayIndex]), makeElement("span", "mobile-day-number", String(date.getDate())));
      day.addEventListener("click", () => {
        state.date = startOfDay(date);
        render();
      });
      strip.append(day);
    });
    root.append(strip);
  } else {
    const dayHeading = makeElement("h2", "mobile-agenda-heading", `${weekdayLong[(state.date.getDay() + 6) % 7]}, ${state.date.getDate()} ${monthNames[state.date.getMonth()]}`);
    root.append(dayHeading);
  }

  const taskList = makeElement("div", "mobile-task-list");
  const tasks = getTasksForDate(dateToKey(state.date));
  if (!tasks.length) {
    taskList.append(makeElement("p", "mobile-empty-state", "На этот день задач пока нет."));
  } else {
    tasks.forEach((task) => {
      const card = makeElement("article", `mobile-task-card priority-${task.priority} status-${task.status}`);
      const details = makeElement("div", "mobile-task-details");
      details.append(
        makeElement("p", "mobile-task-time", `${task.startTime}–${task.endTime}`),
        makeElement("h3", "mobile-task-title", task.title),
        makeElement("p", "mobile-task-meta", `${statusLabels[task.status]} · ${priorityLabels[task.priority]}`),
      );
      if (task.note) details.append(makeElement("p", "mobile-task-note", task.note));
      const deleteButton = makeElement("button", "mobile-delete-button", "Удалить");
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", `Удалить задачу «${task.title}»`);
      deleteButton.addEventListener("click", () => requestTaskDeletion(task.id));
      card.append(details, deleteButton);
      taskList.append(card);
    });
  }
  root.append(taskList);
  calendarRoot.replaceChildren(root);
  calendarScroll.scrollTop = 0;
}

function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function selectDay(date) {
  state.date = startOfDay(date);
  state.view = "day";
  render();
}

function moveWeek(direction) {
  state.date = addDays(startOfWeek(state.date), direction * 7);
  state.view = "week";
  render();
}

function populateDateAndTime({ date = dateToKey(state.date), startTime = defaultStartTime(), endTime } = {}) {
  taskDate.value = date;
  taskStart.value = startTime;
  taskEnd.value = endTime || defaultEndTime(startTime);
}

function openTaskDialog({ task = null, date, startTime } = {}) {
  state.editingTaskId = task?.id ?? null;
  taskDialogTitle.textContent = task ? "Изменить задачу" : "Новая задача";
  document.querySelector("#deleteTask").hidden = !task;
  taskTitle.value = task?.title ?? "";
  taskPriority.value = task?.priority ?? "normal";
  taskStatus.value = task?.status ?? "planned";
  taskNote.value = task?.note ?? "";
  taskFormError.hidden = true;
  taskFormError.textContent = "";
  populateDateAndTime({ date: task?.date ?? date ?? dateToKey(state.date), startTime: task?.startTime ?? startTime ?? defaultStartTime(), endTime: task?.endTime });
  taskDialog.showModal();
  taskTitle.focus();
}

function showFormError(message) {
  taskFormError.textContent = message;
  taskFormError.hidden = false;
}

function closeTaskDialog() {
  taskDialog.close();
}

function validateTask(task, excludedTaskId = state.editingTaskId) {
  if (!task.title) return "Введите название задачи.";
  if (!task.date || Number.isNaN(dateFromKey(task.date).getTime())) return "Выберите дату задачи.";
  const start = timeToMinutes(task.startTime);
  const end = timeToMinutes(task.endTime);
  if (start % 15 !== 0 || end % 15 !== 0) return "Время должно выбираться с шагом 15 минут.";
  if (start < PLANNING_START_MINUTES || start >= PLANNING_END_MINUTES || end > PLANNING_END_MINUTES || end <= start) {
    return "Задачи можно планировать только с 08:00 до 21:00.";
  }

  const conflicts = state.tasks.some((existing) => {
    if (existing.id === excludedTaskId || existing.date !== task.date) return false;
    return start < timeToMinutes(existing.endTime) && end > timeToMinutes(existing.startTime);
  });
  if (conflicts) return "Это время пересекается с другой задачей. Выберите свободный интервал.";
  return "";
}

function showCalendarMessage(message) {
  const existing = document.querySelector(".calendar-message");
  existing?.remove();
  const notice = makeElement("p", "calendar-message", message);
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  calendarRoot.prepend(notice);
  window.setTimeout(() => notice.remove(), 3500);
}

function moveTaskToCalendarSlot(taskId, date, clientY, track) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return;

  const duration = timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
  const offset = Math.max(0, Math.min(PLANNING_HOURS * HOUR_HEIGHT, clientY - track.getBoundingClientRect().top));
  const snappedOffset = Math.round(offset / 15) * 15;
  const latestStart = PLANNING_END_MINUTES - duration;
  const start = Math.min(PLANNING_START_MINUTES + snappedOffset, latestStart);
  const nextTask = {
    ...task,
    date,
    startTime: minutesToTime(start),
    endTime: minutesToTime(start + duration),
    updatedAt: new Date().toISOString(),
  };

  if (nextTask.date === task.date && nextTask.startTime === task.startTime) return;
  const error = validateTask(nextTask, task.id);
  if (error) {
    showCalendarMessage(error);
    return;
  }

  const nextTasks = state.tasks.map((existing) => existing.id === task.id ? nextTask : existing);
  if (!persistTasks(nextTasks)) {
    showCalendarMessage("Не удалось сохранить перенос. Проверьте настройки хранения браузера.");
    return;
  }
  render();
  const movedDate = dateFromKey(date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  showCalendarMessage(`Задача перенесена на ${movedDate} в ${nextTask.startTime}. Статус не изменён.`);
}

function requestTaskDeletion(taskId = state.editingTaskId) {
  if (!taskId) return;
  state.deletingTaskId = taskId;
  const task = state.tasks.find((item) => item.id === taskId);
  document.querySelector("#deleteConfirmTitle").textContent = task
    ? `Удалить задачу «${task.title}»?`
    : "Удалить задачу?";
  if (taskDialog.open) closeTaskDialog();
  deleteConfirmDialog.showModal();
}

function deleteTask() {
  const deletingId = state.deletingTaskId;
  if (!deletingId) return;
  const nextTasks = state.tasks.filter((task) => task.id !== deletingId);
  if (!persistTasks(nextTasks)) {
    showCalendarMessage("Не удалось удалить задачу. Проверьте настройки хранения браузера.");
    deleteConfirmDialog.close();
    return;
  }
  state.deletingTaskId = null;
  deleteConfirmDialog.close();
  render();
}

function exportBackup() {
  try {
    const backup = {
      schema: BACKUP_SCHEMA,
      schemaVersion: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: state.tasks,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = makeElement("a");
    link.href = url;
    link.download = `резервная-копия-планировщика-${dateToKey(new Date())}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showCalendarMessage(`Резервная копия экспортирована: ${state.tasks.length} задач.`);
  } catch {
    showCalendarMessage("Не удалось создать резервную копию. Попробуйте ещё раз.");
  }
}

function validateBackup(backup) {
  if (!backup || typeof backup !== "object" || Array.isArray(backup)) {
    return { error: "Файл не содержит объект резервной копии." };
  }
  if (backup.schema !== BACKUP_SCHEMA || backup.schemaVersion !== BACKUP_VERSION) {
    return { error: "Формат или версия файла резервной копии не поддерживается." };
  }
  if (typeof backup.exportedAt !== "string" || Number.isNaN(Date.parse(backup.exportedAt))) {
    return { error: "В резервной копии отсутствует корректная дата экспорта." };
  }
  if (!Array.isArray(backup.tasks)) return { error: "В резервной копии не найден список задач." };

  const ids = new Set();
  for (const [index, task] of backup.tasks.entries()) {
    const row = index + 1;
    if (!task || typeof task !== "object" || Array.isArray(task)) {
      return { error: `Запись ${row} не является задачей.` };
    }
    if (typeof task.id !== "string" || !task.id.trim() || ids.has(task.id)) {
      return { error: `У задачи №${row} отсутствует уникальный идентификатор.` };
    }
    ids.add(task.id);
    if (typeof task.title !== "string" || !task.title.trim() || task.title.length > 120) {
      return { error: `У задачи №${row} некорректное название.` };
    }
    if (typeof task.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)
      || Number.isNaN(dateFromKey(task.date).getTime()) || dateToKey(dateFromKey(task.date)) !== task.date) {
      return { error: `У задачи «${task.title.trim()}» некорректная дата.` };
    }
    if (typeof task.startTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.startTime)
      || typeof task.endTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(task.endTime)) {
      return { error: `У задачи «${task.title.trim()}» некорректно указано время.` };
    }
    const start = timeToMinutes(task.startTime);
    const end = timeToMinutes(task.endTime);
    if (start % 15 !== 0 || end % 15 !== 0 || start < PLANNING_START_MINUTES
      || start >= PLANNING_END_MINUTES || end > PLANNING_END_MINUTES || end <= start) {
      return { error: `У задачи «${task.title.trim()}» время должно быть в диапазоне 08:00–21:00 с шагом 15 минут.` };
    }
    if (!priorities.includes(task.priority) || !statuses.includes(task.status)) {
      return { error: `У задачи «${task.title.trim()}» некорректные приоритет или статус.` };
    }
    if (typeof task.note !== "string" || task.note.length > 1000 || typeof task.createdAt !== "string" || Number.isNaN(Date.parse(task.createdAt))
      || typeof task.updatedAt !== "string" || Number.isNaN(Date.parse(task.updatedAt))) {
      return { error: `У задачи «${task.title.trim()}» отсутствуют заметка или дата изменения.` };
    }
  }

  const byDate = new Map();
  backup.tasks.forEach((task) => {
    if (!byDate.has(task.date)) byDate.set(task.date, []);
    byDate.get(task.date).push(task);
  });
  for (const tasks of byDate.values()) {
    tasks.sort((left, right) => left.startTime.localeCompare(right.startTime));
    for (let index = 1; index < tasks.length; index += 1) {
      if (tasks[index].startTime < tasks[index - 1].endTime) {
        return { error: `В резервной копии пересекаются задачи «${tasks[index - 1].title}» и «${tasks[index].title}».` };
      }
    }
  }

  return { tasks: backup.tasks.map((task) => ({ ...task, title: task.title.trim() })) };
}

async function readBackupFile(file) {
  state.pendingImportTasks = null;
  try {
    const backup = JSON.parse(await file.text());
    const result = validateBackup(backup);
    if (result.error) {
      showCalendarMessage(result.error);
      return;
    }
    state.pendingImportTasks = result.tasks;
    document.querySelector("#backupConfirmText").textContent = `В файле задач: ${result.tasks.length}. Текущий список будет полностью заменён.`;
    backupConfirmDialog.showModal();
  } catch {
    showCalendarMessage("Не удалось прочитать JSON-файл. Проверьте, что это корректная резервная копия.");
  } finally {
    backupFile.value = "";
  }
}

function confirmBackupImport() {
  if (!state.pendingImportTasks) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.pendingImportTasks));
    state.tasks = state.pendingImportTasks;
    const count = state.tasks.length;
    state.pendingImportTasks = null;
    backupConfirmDialog.close();
    render();
    showCalendarMessage(`Импорт завершён. Загружено задач: ${count}.`);
  } catch {
    state.pendingImportTasks = null;
    backupConfirmDialog.close();
    showCalendarMessage("Не удалось сохранить резервную копию в браузере. Текущие данные не заменены.");
  }
}

function saveTask(event) {
  event.preventDefault();
  const task = {
    id: state.editingTaskId ?? (globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: taskTitle.value.trim(),
    date: taskDate.value,
    startTime: taskStart.value,
    endTime: taskEnd.value,
    priority: taskPriority.value,
    status: taskStatus.value,
    note: taskNote.value.trim(),
    createdAt: state.tasks.find((item) => item.id === state.editingTaskId)?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const error = validateTask(task);
  if (error) {
    showFormError(error);
    return;
  }

  const nextTasks = state.editingTaskId
    ? state.tasks.map((existing) => existing.id === state.editingTaskId ? task : existing)
    : [...state.tasks, task];
  if (!persistTasks(nextTasks)) return;

  state.date = dateFromKey(task.date);
  state.view = "week";
  closeTaskDialog();
  render();
}

function render() {
  updateHeader();
  updateFilterButtons();
  if (window.matchMedia("(max-width: 620px)").matches && state.view !== "month") renderMobileAgenda();
  else if (state.view === "month") renderMonth();
  else renderSchedule();
}

buildTimeOptions();
viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    render();
  });
});

taskFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter-type]");
  if (!button) return;
  const selectedValues = button.dataset.filterType === "priority"
    ? state.filters.priorities
    : state.filters.statuses;
  if (button.dataset.filterValue === "all") selectedValues.clear();
  else if (selectedValues.has(button.dataset.filterValue)) selectedValues.delete(button.dataset.filterValue);
  else selectedValues.add(button.dataset.filterValue);
  render();
});

previousButton.addEventListener("click", () => moveWeek(-1));
nextButton.addEventListener("click", () => moveWeek(1));
todayButton.addEventListener("click", () => {
  state.date = startOfDay(new Date());
  state.view = "week";
  render();
});
addTaskButton.addEventListener("click", () => openTaskDialog());
document.querySelector("#closeTaskDialog").addEventListener("click", closeTaskDialog);
document.querySelector("#cancelTask").addEventListener("click", closeTaskDialog);
document.querySelector("#deleteTask").addEventListener("click", requestTaskDeletion);
document.querySelector("#cancelDeleteTask").addEventListener("click", () => deleteConfirmDialog.close());
document.querySelector("#confirmDeleteTask").addEventListener("click", deleteTask);
document.querySelector("#exportBackup").addEventListener("click", exportBackup);
document.querySelector("#chooseBackup").addEventListener("click", () => backupFile.click());
backupFile.addEventListener("change", () => {
  const [file] = backupFile.files;
  if (file) readBackupFile(file);
});
document.querySelector("#cancelBackupImport").addEventListener("click", () => backupConfirmDialog.close());
document.querySelector("#confirmBackupImport").addEventListener("click", confirmBackupImport);
taskForm.addEventListener("submit", saveTask);
taskDialog.addEventListener("click", (event) => {
  if (event.target === taskDialog) closeTaskDialog();
});
taskDialog.addEventListener("close", () => {
  state.editingTaskId = null;
  taskForm.reset();
});
deleteConfirmDialog.addEventListener("close", () => {
  state.deletingTaskId = null;
});
deleteConfirmDialog.addEventListener("click", (event) => {
  if (event.target === deleteConfirmDialog) deleteConfirmDialog.close();
});
backupConfirmDialog.addEventListener("close", () => {
  state.pendingImportTasks = null;
});
backupConfirmDialog.addEventListener("click", (event) => {
  if (event.target === backupConfirmDialog) backupConfirmDialog.close();
});
window.matchMedia("(max-width: 620px)").addEventListener("change", render);

render();
