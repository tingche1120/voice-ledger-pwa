const defaultCategories = [
  "餐飲",
  "交通",
  "購物",
  "生活",
  "娛樂",
  "醫療",
  "教育",
  "保險",
  "房租 / 房貸",
  "貸款",
  "薪資",
  "退款",
  "其他",
];

const defaultCategoryHints = [
  { category: "保險", words: ["保險", "保費", "壽險", "醫療險", "車險", "旅平險"] },
  { category: "貸款", words: ["信貸", "車貸", "學貸", "貸款", "分期", "還款"] },
  { category: "房租 / 房貸", words: ["房貸", "房租", "租金", "管理費"] },
  { category: "餐飲", words: ["午餐", "晚餐", "早餐", "咖啡", "飲料", "便當", "餐", "星巴克"] },
  { category: "交通", words: ["捷運", "公車", "高鐵", "火車", "uber", "計程車", "加油", "停車"] },
  { category: "購物", words: ["購物", "衣服", "鞋", "蝦皮", "momo", "買"] },
  { category: "醫療", words: ["看醫生", "診所", "掛號", "藥", "牙醫"] },
  { category: "教育", words: ["補習", "買課程", "課程", "學費", "教材", "書籍", "考試", "報名費", "家教"] },
  { category: "薪資", words: ["薪水", "薪資", "獎金", "收入"] },
  { category: "退款", words: ["退款", "退費", "退貨"] },
];

const recordsKey = "voice-ledger-records";
const categoriesKey = "voice-ledger-categories";
const categoryHintsKey = "voice-ledger-category-hints";

let categories = loadCategories();
let categoryHints = loadCategoryHints();

const chartColors = ["#0f8f83", "#c5543f", "#d99a2b", "#4f6f9f", "#8a5fbf", "#28784a", "#bd5a88", "#59656f"];

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const sampleRecords = [
  record("午餐", 150, "餐飲", "expense", todayISO()),
  record("捷運", 35, "交通", "expense", todayISO()),
  record("還信貸", 8000, "貸款", "expense", todayISO()),
  record("繳保險", 3200, "保險", "expense", offsetISO(-1)),
  record("薪水", 58000, "薪資", "income", offsetISO(-3)),
];

let records = loadRecords();
let pendingItems = [];
let pendingMode = "create";
let currentFilter = "all";
let selectedDate = todayISO();
let visibleMonth = selectedDate.slice(0, 7);
let activeRecognition = null;
let voiceTranscript = "";
let holdStarted = false;
let ignoreNextClick = false;
let categoryDraftCategories = [];
let categoryDraftHints = [];
let calendarSwipeStart = null;

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  yearSelect: document.querySelector("#yearSelect"),
  monthSelect: document.querySelector("#monthSelect"),
  daySelect: document.querySelector("#daySelect"),
  todayButton: document.querySelector("#todayButton"),
  syncButton: document.querySelector("#syncButton"),
  searchButton: document.querySelector("#searchButton"),
  calendarPanel: document.querySelector(".calendar-panel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  selectedDaySummary: document.querySelector("#selectedDaySummary"),
  monthExpense: document.querySelector("#monthExpense"),
  monthIncome: document.querySelector("#monthIncome"),
  monthBalance: document.querySelector("#monthBalance"),
  recentList: document.querySelector("#recentList"),
  recordList: document.querySelector("#recordList"),
  chartList: document.querySelector("#chartList"),
  quickForm: document.querySelector("#quickForm"),
  quickText: document.querySelector("#quickText"),
  keyboardHint: document.querySelector("#keyboardHint"),
  micButton: document.querySelector("#micButton"),
  listenState: document.querySelector("#listenState"),
  confirmBackdrop: document.querySelector("#confirmBackdrop"),
  confirmMode: document.querySelector("#confirmMode"),
  confirmTitle: document.querySelector("#confirmTitle"),
  heardText: document.querySelector("#heardText"),
  pendingList: document.querySelector("#pendingList"),
  saveConfirm: document.querySelector("#saveConfirm"),
  cancelConfirm: document.querySelector("#cancelConfirm"),
  closeConfirm: document.querySelector("#closeConfirm"),
  monthDetailBackdrop: document.querySelector("#monthDetailBackdrop"),
  closeMonthDetail: document.querySelector("#closeMonthDetail"),
  monthDetailTitle: document.querySelector("#monthDetailTitle"),
  monthDetailSummary: document.querySelector("#monthDetailSummary"),
  monthDetailList: document.querySelector("#monthDetailList"),
  searchBackdrop: document.querySelector("#searchBackdrop"),
  closeSearch: document.querySelector("#closeSearch"),
  searchForm: document.querySelector("#searchForm"),
  searchText: document.querySelector("#searchText"),
  searchSummary: document.querySelector("#searchSummary"),
  searchResults: document.querySelector("#searchResults"),
  toast: document.querySelector("#toast"),
  speechSupport: document.querySelector("#speechSupport"),
  clearButton: document.querySelector("#clearButton"),
  backupJsonButton: document.querySelector("#backupJsonButton"),
  restoreJsonButton: document.querySelector("#restoreJsonButton"),
  restoreFileInput: document.querySelector("#restoreFileInput"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  categorySummary: document.querySelector("#categorySummary"),
  editCategoriesButton: document.querySelector("#editCategoriesButton"),
  categoryEditPanel: document.querySelector("#categoryEditPanel"),
  categoryForm: document.querySelector("#categoryForm"),
  categoryNameInput: document.querySelector("#categoryNameInput"),
  categoryWordsInput: document.querySelector("#categoryWordsInput"),
  categoryEditor: document.querySelector("#categoryEditor"),
  cancelCategoriesButton: document.querySelector("#cancelCategoriesButton"),
  saveCategoriesButton: document.querySelector("#saveCategoriesButton"),
  helpButton: document.querySelector("#helpButton"),
  helpBackdrop: document.querySelector("#helpBackdrop"),
  closeHelp: document.querySelector("#closeHelp"),
};

init();

function init() {
  els.todayLabel.textContent = new Intl.DateTimeFormat("zh-Hant", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  initDateControls();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  els.speechSupport.textContent = SpeechRecognition ? "可使用" : "用鍵盤麥克風";
  if (!SpeechRecognition) setKeyboardDictationMode();

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.nav));
  });

  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });

  els.yearSelect.addEventListener("change", handleDateControlChange);
  els.monthSelect.addEventListener("change", handleDateControlChange);
  els.daySelect.addEventListener("change", handleDateControlChange);
  els.todayButton.addEventListener("click", () => selectDate(todayISO()));
  els.syncButton.addEventListener("click", showSyncStatus);
  els.searchButton.addEventListener("click", openSearch);
  els.calendarPanel.addEventListener("pointerdown", startCalendarSwipe);
  els.calendarPanel.addEventListener("pointerup", finishCalendarSwipe);
  els.calendarPanel.addEventListener("pointercancel", cancelCalendarSwipe);
  els.calendarPanel.addEventListener("mousedown", startCalendarSwipe);
  els.calendarPanel.addEventListener("mouseup", finishCalendarSwipe);
  els.calendarPanel.addEventListener("mouseleave", cancelCalendarSwipe);

  els.quickForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handlePhrase(els.quickText.value);
  });

  els.micButton.addEventListener("pointerdown", startHoldVoiceInput);
  els.micButton.addEventListener("pointerup", stopHoldVoiceInput);
  els.micButton.addEventListener("pointercancel", stopHoldVoiceInput);
  els.micButton.addEventListener("pointerleave", stopHoldVoiceInput);
  els.micButton.addEventListener("click", handleMicClick);
  els.cancelConfirm.addEventListener("click", closeConfirm);
  els.closeConfirm.addEventListener("click", closeConfirm);
  els.saveConfirm.addEventListener("click", savePending);
  els.pendingList.addEventListener("input", updatePendingFromControl);
  els.pendingList.addEventListener("change", updatePendingFromControl);
  els.pendingList.addEventListener("click", handlePendingClick);
  els.confirmBackdrop.addEventListener("click", (event) => {
    if (event.target === els.confirmBackdrop) closeConfirm();
  });
  els.closeMonthDetail.addEventListener("click", closeMonthDetail);
  els.monthDetailBackdrop.addEventListener("click", (event) => {
    if (event.target === els.monthDetailBackdrop) closeMonthDetail();
  });
  els.closeSearch.addEventListener("click", closeSearch);
  els.searchBackdrop.addEventListener("click", (event) => {
    if (event.target === els.searchBackdrop) closeSearch();
  });
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    renderSearchResults();
  });
  els.searchResults.addEventListener("click", handleSearchResultClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.confirmBackdrop.hidden) closeConfirm();
    if (event.key === "Escape" && !els.monthDetailBackdrop.hidden) closeMonthDetail();
    if (event.key === "Escape" && !els.searchBackdrop.hidden) closeSearch();
    if (event.key === "Escape" && !els.helpBackdrop.hidden) closeHelp();
  });
  els.clearButton.addEventListener("click", () => {
    if (!window.confirm("要清空所有紀錄嗎？")) return;
    records = [];
    persist();
    render();
    showToast("已清空紀錄");
  });
  els.backupJsonButton.addEventListener("click", backupJSON);
  els.restoreJsonButton.addEventListener("click", () => els.restoreFileInput.click());
  els.restoreFileInput.addEventListener("change", restoreJSON);
  els.exportCsvButton.addEventListener("click", exportCSV);
  els.editCategoriesButton.addEventListener("click", openCategoryEditor);
  els.cancelCategoriesButton.addEventListener("click", closeCategoryEditor);
  els.saveCategoriesButton.addEventListener("click", saveCategoryEditor);
  els.categoryForm.addEventListener("submit", addCategoryFromForm);
  els.categoryEditor.addEventListener("change", handleCategoryEditorChange);
  els.categoryEditor.addEventListener("click", handleCategoryEditorClick);
  els.helpButton.addEventListener("click", openHelp);
  els.closeHelp.addEventListener("click", closeHelp);
  els.helpBackdrop.addEventListener("click", (event) => {
    if (event.target === els.helpBackdrop) closeHelp();
  });

  renderCategorySummary();
  render();
}

function initDateControls() {
  const thisYear = new Date().getFullYear();
  for (let year = thisYear - 5; year <= thisYear + 2; year += 1) {
    els.yearSelect.append(new Option(`${year} 年`, year));
  }
  for (let month = 1; month <= 12; month += 1) {
    els.monthSelect.append(new Option(`${month} 月`, month));
  }
  syncDateControls();
}

function syncDateControls() {
  const [year, month, day] = selectedDate.split("-").map(Number);
  ensureYearOption(year);
  els.yearSelect.value = String(year);
  els.monthSelect.value = String(month);
  refreshDayOptions(year, month, day);
}

function ensureYearOption(year) {
  const value = String(year);
  if ([...els.yearSelect.options].some((option) => option.value === value)) return;
  els.yearSelect.append(new Option(`${year} 年`, year));
  [...els.yearSelect.options]
    .sort((a, b) => Number(a.value) - Number(b.value))
    .forEach((option) => els.yearSelect.append(option));
}

function refreshDayOptions(year, month, selectedDay) {
  const dayCount = daysInMonth(year, month);
  els.daySelect.innerHTML = "";
  for (let day = 1; day <= dayCount; day += 1) {
    els.daySelect.append(new Option(`${day} 日`, day));
  }
  els.daySelect.value = String(Math.min(selectedDay, dayCount));
}

function handleDateControlChange() {
  const year = Number(els.yearSelect.value);
  const month = Number(els.monthSelect.value);
  const day = Math.min(Number(els.daySelect.value), daysInMonth(year, month));
  selectedDate = localISO(new Date(year, month - 1, day));
  visibleMonth = selectedDate.slice(0, 7);
  syncDateControls();
  render();
}

function selectDate(iso) {
  selectedDate = iso;
  visibleMonth = iso.slice(0, 7);
  syncDateControls();
  render();
}

function startCalendarSwipe(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (isInteractiveCalendarTarget(event.target)) {
    calendarSwipeStart = null;
    return;
  }
  calendarSwipeStart = { x: event.clientX, y: event.clientY };
}

function finishCalendarSwipe(event) {
  if (!calendarSwipeStart) return;
  const deltaX = event.clientX - calendarSwipeStart.x;
  const deltaY = event.clientY - calendarSwipeStart.y;
  calendarSwipeStart = null;

  if (Math.abs(deltaX) < 55 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
  shiftCalendarMonth(deltaX < 0 ? -1 : 1);
}

function cancelCalendarSwipe() {
  calendarSwipeStart = null;
}

function isInteractiveCalendarTarget(target) {
  return Boolean(target.closest(".calendar-controls, input, select, textarea, a"));
}

function shiftCalendarMonth(monthDelta) {
  const [year, month, day] = selectedDate.split("-").map(Number);
  const targetMonth = new Date(year, month - 1 + monthDelta, 1);
  const targetYear = targetMonth.getFullYear();
  const targetMonthNumber = targetMonth.getMonth() + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonthNumber));
  selectedDate = localISO(new Date(targetYear, targetMonthNumber - 1, targetDay));
  visibleMonth = selectedDate.slice(0, 7);
  syncDateControls();
  render();
}

function showScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  document.querySelector(`#${name}Screen`).classList.add("active");
  document.querySelectorAll(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === name);
  });
}

function showSyncStatus() {
  showToast("目前資料只存在本機，請到設定備份 JSON");
}

function openSearch() {
  els.searchBackdrop.hidden = false;
  renderSearchResults();
  window.setTimeout(() => els.searchText.focus(), 0);
}

function closeSearch() {
  els.searchBackdrop.hidden = true;
}

function openHelp() {
  els.helpBackdrop.hidden = false;
}

function closeHelp() {
  els.helpBackdrop.hidden = true;
}

function renderSearchResults() {
  const keyword = els.searchText.value.trim().toLowerCase();
  const rows = keyword
    ? records
        .filter((item) => `${item.date} ${item.note} ${item.category} ${item.type === "income" ? "收入" : "支出"}`.toLowerCase().includes(keyword))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""))
    : [];

  els.searchSummary.textContent = keyword ? `找到 ${rows.length} 筆` : "輸入關鍵字後會列出所有符合紀錄";
  els.searchResults.innerHTML = "";

  if (!keyword) return;
  if (!rows.length) {
    els.searchResults.innerHTML = '<p class="eyebrow">沒有符合的紀錄</p>';
    return;
  }

  rows.forEach((item) => {
    const button = document.createElement("button");
    button.className = "search-result";
    button.type = "button";
    button.dataset.date = item.date;
    button.innerHTML = `
      <strong>${formatDateWithYear(item.date)}</strong>
      <span>${escapeHTML(item.note)}｜${escapeHTML(item.category)}</span>
      <b class="${item.type}">${item.type === "expense" ? "-" : "+"}${formatCurrency(item.amount)}</b>
    `;
    els.searchResults.append(button);
  });
}

function handleSearchResultClick(event) {
  const item = event.target.closest("[data-date]");
  if (!item) return;
  selectDate(item.dataset.date);
  closeSearch();
  showToast(`已跳到 ${formatFullDate(item.dataset.date)}`);
}

function handleMicClick() {
  if (!supportsWebSpeech()) {
    openKeyboardDictation();
    return;
  }
  if (ignoreNextClick) {
    ignoreNextClick = false;
    return;
  }
  startVoiceInput({ holdMode: false });
}

function startHoldVoiceInput(event) {
  if (!supportsWebSpeech()) {
    openKeyboardDictation();
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) return;
  ignoreNextClick = true;
  holdStarted = startVoiceInput({ holdMode: true });
}

function stopHoldVoiceInput() {
  if (!holdStarted) return;
  holdStarted = false;
  stopVoiceInput();
}

function startVoiceInput({ holdMode } = { holdMode: false }) {
  const SpeechRecognition = supportsWebSpeech();
  if (!SpeechRecognition) {
    openKeyboardDictation();
    return false;
  }

  if (activeRecognition) {
    if (!holdMode) stopVoiceInput();
    return false;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-TW";
  recognition.continuous = holdMode;
  recognition.interimResults = holdMode;
  activeRecognition = recognition;
  voiceTranscript = "";

  els.listenState.classList.add("listening");
  els.listenState.querySelector("p").textContent = holdMode ? "放開後解析" : "正在聽";

  recognition.onresult = (event) => {
    let finalText = "";
    let previewText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalText += transcript;
      else previewText += transcript;
    }
    if (finalText) voiceTranscript += finalText;
    els.quickText.value = `${voiceTranscript}${previewText}`.trim();
    if (!holdMode && voiceTranscript) stopVoiceInput();
  };

  recognition.onerror = () => {
    els.quickText.focus();
    activeRecognition = null;
    holdStarted = false;
    resetListenState();
    showToast("語音沒有成功，請用鍵盤麥克風或文字輸入");
  };

  recognition.onend = () => {
    const text = (voiceTranscript || els.quickText.value).trim();
    activeRecognition = null;
    holdStarted = false;
    resetListenState();
    if (text) handlePhrase(text);
  };

  recognition.start();
  return true;
}

function stopVoiceInput() {
  if (!activeRecognition) return;
  els.listenState.querySelector("p").textContent = "解析中";
  activeRecognition.stop();
}

function resetListenState() {
  els.listenState.classList.remove("listening");
  const SpeechRecognition = supportsWebSpeech();
  els.listenState.querySelector("p").textContent = SpeechRecognition ? "按住說話，放開解析" : "點一下用鍵盤麥克風";
}

function supportsWebSpeech() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function setKeyboardDictationMode() {
  els.listenState.querySelector("p").textContent = "開啟鍵盤";
  els.micButton.setAttribute("aria-label", "開啟鍵盤麥克風輸入");
  els.micButton.title = "開啟鍵盤麥克風輸入";
  els.quickText.placeholder = "點鍵盤麥克風後說：午餐一百 星巴克兩百";
  els.keyboardHint.hidden = false;
}

function openKeyboardDictation() {
  setKeyboardDictationMode();
  els.quickText.focus({ preventScroll: false });
  showToast("請按鍵盤上的麥克風說話");
}

function handlePhrase(rawText) {
  const text = rawText.trim();
  if (!text) return;
  openPending(parsePhrase(text), { mode: "create", heard: text });
}

function openPending(items, { mode, heard }) {
  pendingItems = items.map((item) => ({ ...item }));
  pendingMode = mode;
  els.confirmMode.textContent = mode === "edit" ? "編輯紀錄" : "我聽到";
  els.confirmTitle.textContent = mode === "edit" ? "修改這筆" : `準備記錄 ${pendingItems.length} 筆`;
  els.heardText.textContent = heard ? `「${heard}」` : "";
  els.saveConfirm.textContent = mode === "edit" ? "儲存修改" : "全部儲存";
  renderPending();
  els.confirmBackdrop.hidden = false;
}

function parsePhrase(text) {
  const compact = normalizeFullWidthDigits(text).replace(/[，,、。；;]/g, " ").replace(/\s+/g, " ").trim();
  const items = segmentPhraseByDate(compact).flatMap((segment) => parseLedgerItems(segment.text, segment.date));
  if (items.length) return items;

  const parsedDate = extractLedgerDate(compact);
  return parseLedgerItems(parsedDate.text, parsedDate.date, { fallback: true });
}

function parseLedgerItems(content, date, { fallback = false } = {}) {
  const amountPattern = "[0-9０-９]+(?:[,.，][0-9０-９]+)?|[零一二兩三四五六七八九十百千萬]+";
  const matcher = new RegExp(`([^0-9０-９零一二兩三四五六七八九十百千萬]+?)\\s*(${amountPattern})`, "g");
  const items = [];
  let match;

  while ((match = matcher.exec(content))) {
    const note = cleanNote(match[1]);
    const amount = parseAmount(match[2]);
    if (!note || !amount) continue;
    const type = inferType(`${note}${match[2]}`);
    const category = inferCategory(note, type);
    items.push(draftRecord(note, amount, category, type, date));
  }

  if (items.length || !fallback) return items;

  const lowered = content.toLowerCase();
  const type = inferType(lowered);
  const amount = extractAmount(lowered);
  const category = inferCategory(lowered, type);
  return [draftRecord(cleanNote(content) || category, amount, category, type, date)];
}

function segmentPhraseByDate(text) {
  const tokens = findDateTokens(text);
  if (!tokens.length) {
    const parsedDate = extractLedgerDate(text);
    return [{ date: parsedDate.date, text: parsedDate.text }];
  }

  const segments = [];
  if (tokens[0].index > 0) {
    const leadingText = text.slice(0, tokens[0].index).trim();
    if (leadingText) segments.push({ date: selectedDate, text: leadingText });
  }

  tokens.forEach((token, index) => {
    const next = tokens[index + 1];
    const segmentText = text.slice(token.end, next ? next.index : text.length).trim();
    if (segmentText) segments.push({ date: token.date, text: segmentText });
  });

  return segments;
}

function findDateTokens(text) {
  const dateNumber = "[0-9０-９一二兩三四五六七八九十]{1,3}";
  const tokenPattern =
    new RegExp(`(?:\\d{4}\\s*年\\s*)?${dateNumber}\\s*月\\s*${dateNumber}\\s*(?:日|號)?|(?:\\d{4}[\\/.-])?\\d{1,2}[\\/.-]\\d{1,2}|大前天|前天|昨天|今天|今日|明天|大後天|後天`, "g");
  const tokens = [];
  let match;

  while ((match = tokenPattern.exec(text))) {
    const date = relativeDateISO(match[0]) || explicitDateTokenISO(match[0]);
    if (!date) continue;
    tokens.push({
      date,
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  return tokens;
}

function extractLedgerDate(text) {
  const explicitToken = findDateTokens(text)[0];
  if (explicitToken) {
    return {
      date: explicitToken.date,
      text: `${text.slice(0, explicitToken.index)} ${text.slice(explicitToken.end)}`.replace(/\s+/g, " ").trim(),
    };
  }

  const relativeDates = relativeDateOptions().map((option) => ({ ...option, pattern: new RegExp(option.word, "g") }));

  for (const option of relativeDates) {
    if (!option.pattern.test(text)) continue;
    return {
      date: offsetISO(option.offset),
      text: text.replace(option.pattern, " ").replace(/\s+/g, " ").trim(),
    };
  }

  return { date: selectedDate, text };
}

function selectedCalendarYear() {
  return Number(els.yearSelect?.value) || Number(selectedDate.slice(0, 4));
}

function explicitDateTokenISO(token) {
  const dateNumber = "([0-9０-９一二兩三四五六七八九十]{1,3})";
  const monthDate = token.match(new RegExp(`^(?:(\\d{4})\\s*年\\s*)?${dateNumber}\\s*月\\s*${dateNumber}\\s*(?:日|號)?$`));
  if (monthDate) {
    const year = Number(monthDate[1]) || selectedCalendarYear();
    const month = parseDateNumber(monthDate[2]);
    const day = parseDateNumber(monthDate[3]);
    return dateFromParts(year, month, day);
  }

  const slashDate = token.match(/^(?:(\d{4})[\/.-])?(\d{1,2})[\/.-](\d{1,2})$/);
  if (!slashDate) return null;
  const year = Number(slashDate[1]) || selectedCalendarYear();
  const month = Number(slashDate[2]);
  const day = Number(slashDate[3]);
  return dateFromParts(year, month, day);
}

function parseDateNumber(value) {
  const normalized = normalizeFullWidthDigits(value);
  return /\d/.test(normalized) ? Number(normalized) : chineseToNumber(normalized);
}

function relativeDateOptions() {
  return [
    { word: "大前天", offset: -3 },
    { word: "前天", offset: -2 },
    { word: "昨天", offset: -1 },
    { word: "今天", offset: 0 },
    { word: "今日", offset: 0 },
    { word: "明天", offset: 1 },
    { word: "大後天", offset: 3 },
    { word: "後天", offset: 2 },
  ];
}

function relativeDateISO(word) {
  const option = relativeDateOptions().find((item) => item.word === word);
  return option ? offsetISO(option.offset) : null;
}

function dateFromParts(year, month, day) {
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return localISO(date);
}

function draftRecord(note, amount, category, type, date, id = createId()) {
  return { id, note, amount, category, type, date, createdAt: new Date().toISOString() };
}

function cleanNote(value) {
  return value
    .replace(/大前天|前天|昨天|今天|今日|明天|大後天|後天|支出|收入|花了|用了|付了|繳了|繳|還了|買了|記一下/g, "")
    .trim();
}

function inferType(text) {
  return /薪水|薪資|獎金|收入|退款|退費|收到/.test(text) ? "income" : "expense";
}

function inferCategory(text, type) {
  const lowered = text.toLowerCase();
  let bestMatch = null;
  for (const hint of categoryHints) {
    for (const word of hint.words) {
      const normalizedWord = word.toLowerCase();
      if (!lowered.includes(normalizedWord)) continue;
      if (!bestMatch || normalizedWord.length > bestMatch.word.length) bestMatch = { category: hint.category, word: normalizedWord };
    }
  }
  if (bestMatch) return bestMatch.category;
  return type === "income" ? "薪資" : "其他";
}

function extractAmount(text) {
  const amountPattern = /[0-9０-９]+(?:[,.，][0-9０-９]+)?|[零一二兩三四五六七八九十百千萬]+/;
  const match = text.match(amountPattern);
  return match ? parseAmount(match[0]) : 0;
}

function parseAmount(text) {
  const arabic = text.match(/[0-9０-９]/);
  if (arabic) {
    return Number(text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 65248)).replace(/[,，]/g, ""));
  }
  return chineseToNumber(text);
}

function normalizeFullWidthDigits(text) {
  return text.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 65248));
}

function chineseToNumber(input) {
  input = normalizeColloquialNumber(input);
  const digit = { 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const unit = { 十: 10, 百: 100, 千: 1000, 萬: 10000 };
  let total = 0;
  let section = 0;
  let number = 0;

  for (const char of input) {
    if (digit[char] !== undefined) {
      number = digit[char];
    } else if (char === "萬") {
      section = (section + number) * unit[char];
      total += section;
      section = 0;
      number = 0;
    } else if (unit[char]) {
      section += (number || 1) * unit[char];
      number = 0;
    }
  }

  return total + section + number;
}

function normalizeColloquialNumber(input) {
  const digits = "一二兩三四五六七八九";
  return input
    .replace(new RegExp(`([${digits}])萬([${digits}])$`), "$1萬$2千")
    .replace(new RegExp(`([${digits}])千([${digits}])$`), "$1千$2百")
    .replace(new RegExp(`([${digits}])百([${digits}])$`), "$1百$2十");
}

function renderPending() {
  els.pendingList.innerHTML = "";
  if (!pendingItems.length) {
    els.pendingList.innerHTML = '<p class="eyebrow">沒有可儲存的紀錄</p>';
    els.saveConfirm.disabled = true;
    return;
  }
  els.saveConfirm.disabled = false;

  pendingItems.forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "pending-card";
    card.dataset.index = index;
    card.innerHTML = `
      <div class="pending-card-head">
        <strong>第 ${index + 1} 筆</strong>
        <button class="mini-danger" type="button" data-pending-remove="${index}" aria-label="刪除第 ${index + 1} 筆">刪除</button>
      </div>
      <div class="pending-grid">
        <label>
          <span>類型</span>
          <select data-field="type">
            <option value="expense" ${item.type === "expense" ? "selected" : ""}>支出</option>
            <option value="income" ${item.type === "income" ? "selected" : ""}>收入</option>
          </select>
        </label>
        <label>
          <span>金額</span>
          <input data-field="amount" inputmode="decimal" value="${item.amount || ""}" />
        </label>
        <label>
          <span>分類</span>
          <select data-field="category">${categoryOptions(item.category)}</select>
        </label>
        <label>
          <span>日期</span>
          <input data-field="date" type="date" value="${item.date}" />
        </label>
      </div>
      <label class="note-field">
        <span>備註</span>
        <input data-field="note" value="${escapeHTML(item.note)}" />
      </label>
      <div class="date-shortcuts" aria-label="日期快速選擇">
        <button type="button" data-pending-date="${index}" data-value="${todayISO()}">今天</button>
        <button type="button" data-pending-date="${index}" data-value="${offsetISO(-1)}">昨天</button>
        <button type="button" data-pending-date="${index}" data-value="${selectedDate}">選取日</button>
      </div>
    `;
    els.pendingList.append(card);
  });
}

function categoryOptions(selected) {
  return categories.map((name) => `<option value="${escapeHTML(name)}" ${name === selected ? "selected" : ""}>${escapeHTML(name)}</option>`).join("");
}

function updatePendingFromControl(event) {
  const control = event.target.closest("[data-field]");
  if (!control) return;
  const card = control.closest("[data-index]");
  const item = pendingItems[Number(card.dataset.index)];
  const field = control.dataset.field;
  item[field] = field === "amount" ? Number(control.value) || 0 : control.value;
}

function handlePendingClick(event) {
  const remove = event.target.closest("[data-pending-remove]");
  if (remove) {
    pendingItems.splice(Number(remove.dataset.pendingRemove), 1);
    renderPending();
    return;
  }
  const dateButton = event.target.closest("[data-pending-date]");
  if (dateButton) {
    const index = Number(dateButton.dataset.pendingDate);
    pendingItems[index].date = dateButton.dataset.value;
    renderPending();
  }
}

function savePending() {
  if (!pendingItems.length) return;
  const cleaned = pendingItems.map((item) => ({
    ...item,
    note: item.note.trim() || item.category,
    amount: Number(item.amount) || 0,
    updatedAt: new Date().toISOString(),
  }));

  if (pendingMode === "edit") {
    const update = cleaned[0];
    records = records.map((item) => (item.id === update.id ? { ...item, ...update } : item));
    selectedDate = update.date;
    visibleMonth = update.date.slice(0, 7);
    showToast("已儲存修改");
  } else {
    records = [...cleaned, ...records];
    selectedDate = cleaned[0].date;
    visibleMonth = selectedDate.slice(0, 7);
    showToast(`已記錄 ${cleaned.length} 筆`);
  }

  persist();
  syncDateControls();
  render();
  closeConfirm();
  els.quickText.value = "";
}

function closeConfirm() {
  els.confirmBackdrop.hidden = true;
  pendingItems = [];
  pendingMode = "create";
}

function editRecord(id) {
  const item = records.find((recordItem) => recordItem.id === id);
  if (!item) return;
  if (!els.monthDetailBackdrop.hidden) closeMonthDetail();
  openPending([{ ...item }], { mode: "edit", heard: item.note });
}

function deleteRecord(id) {
  const item = records.find((recordItem) => recordItem.id === id);
  records = records.filter((recordItem) => recordItem.id !== id);
  persist();
  render();
  refreshMonthDetail();
  showToast(`已刪除：${item?.note || "紀錄"}`);
}

function render() {
  const monthRecords = records.filter((item) => item.date.startsWith(visibleMonth));
  const expense = sum(monthRecords.filter((item) => item.type === "expense"));
  const income = sum(monthRecords.filter((item) => item.type === "income"));

  els.monthExpense.textContent = formatCurrency(expense);
  els.monthIncome.textContent = formatCurrency(income);
  els.monthBalance.textContent = formatCurrency(income - expense);
  renderCalendar();
  renderSelectedDaySummary();
  renderRecords(els.recentList, records.slice(0, 5));

  const filtered = currentFilter === "all" ? records : records.filter((item) => item.type === currentFilter);
  renderRecords(els.recordList, filtered);
  renderChart(monthRecords);
}

function renderCalendar() {
  const [year, month] = visibleMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const dayCount = daysInMonth(year, month);
  const weeks = Math.ceil((firstDay + dayCount) / 7);
  const activity = activityByDate();
  els.calendarGrid.innerHTML = "";

  for (let week = 0; week < weeks; week += 1) {
    const weekLabel = document.createElement("div");
    weekLabel.className = "week-number";
    const firstVisibleDay = Math.max(1, week * 7 - firstDay + 1);
    weekLabel.textContent = `W${weekOfYear(new Date(year, month - 1, firstVisibleDay))}`;
    els.calendarGrid.append(weekLabel);

    for (let weekday = 0; weekday < 7; weekday += 1) {
      const cellIndex = week * 7 + weekday;
      const day = cellIndex - firstDay + 1;
      const button = document.createElement("button");
      button.className = "calendar-day";

      if (day < 1 || day > dayCount) {
        button.classList.add("empty");
        button.disabled = true;
        els.calendarGrid.append(button);
        continue;
      }

      const iso = localISO(new Date(year, month - 1, day));
      const marks = activity.get(iso) || { expense: false, income: false };
      button.type = "button";
      button.classList.toggle("selected", iso === selectedDate);
      button.classList.toggle("today", iso === todayISO());
      button.innerHTML = `
        <span>${day}</span>
        <span class="day-marks">
          ${marks.expense ? '<i class="mark expense"></i>' : ""}
          ${marks.income ? '<i class="mark income"></i>' : ""}
        </span>
      `;
      button.addEventListener("click", () => selectDate(iso));
      els.calendarGrid.append(button);
    }
  }
}

function renderSelectedDaySummary() {
  const rows = records.filter((item) => item.date === selectedDate);
  const expense = sum(rows.filter((item) => item.type === "expense"));
  const income = sum(rows.filter((item) => item.type === "income"));
  els.selectedDaySummary.innerHTML = `
    <strong>${formatFullDate(selectedDate)}</strong>
    <span>支出 ${formatCurrency(expense)}｜收入 ${formatCurrency(income)}｜${rows.length} 筆</span>
    <button class="detail-button" id="monthDetailButton" type="button">明細</button>
  `;
  document.querySelector("#monthDetailButton").addEventListener("click", openMonthDetail);
}

function openMonthDetail() {
  renderMonthDetail();
  els.monthDetailBackdrop.hidden = false;
}

function renderMonthDetail() {
  const monthRecords = records
    .filter((item) => item.date.startsWith(visibleMonth))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const expense = sum(monthRecords.filter((item) => item.type === "expense"));
  const income = sum(monthRecords.filter((item) => item.type === "income"));
  const [year, month] = visibleMonth.split("-").map(Number);
  els.monthDetailTitle.textContent = `${year} 年 ${month} 月明細`;
  els.monthDetailSummary.innerHTML = `
    <strong>支出 ${formatCurrency(expense)}</strong>
    <strong>收入 ${formatCurrency(income)}</strong>
    <span>${monthRecords.length} 筆</span>
  `;
  renderRecords(els.monthDetailList, monthRecords);
}

function closeMonthDetail() {
  els.monthDetailBackdrop.hidden = true;
}

function refreshMonthDetail() {
  if (els.monthDetailBackdrop.hidden) return;
  renderMonthDetail();
}

function activityByDate() {
  const map = new Map();
  records.forEach((item) => {
    const marks = map.get(item.date) || { expense: false, income: false };
    marks[item.type] = true;
    map.set(item.date, marks);
  });
  return map;
}

function renderRecords(target, rows) {
  target.innerHTML = "";
  if (!rows.length) {
    target.innerHTML = '<p class="eyebrow">目前沒有紀錄</p>';
    return;
  }
  rows.forEach((item) => {
    const row = document.createElement("article");
    row.className = "record-row";
    row.innerHTML = `
      <div class="record-icon">${iconFor(item.category)}</div>
      <div class="record-main">
        <strong>${escapeHTML(item.note)}</strong>
        <span>${formatFullDate(item.date)}｜${item.category}</span>
      </div>
      <div class="record-side">
        <div class="record-amount ${item.type}">${item.type === "expense" ? "-" : "+"}${formatCurrency(item.amount)}</div>
        <div class="record-actions">
          <button type="button" data-edit="${item.id}" aria-label="編輯 ${escapeHTML(item.note)}">編輯</button>
          <button type="button" data-delete="${item.id}" aria-label="刪除 ${escapeHTML(item.note)}">刪除</button>
        </div>
      </div>
    `;
    row.querySelector("[data-edit]").addEventListener("click", () => editRecord(item.id));
    row.querySelector("[data-delete]").addEventListener("click", () => deleteRecord(item.id));
    target.append(row);
  });
}

function renderChart(monthRecords) {
  const expenses = monthRecords.filter((item) => item.type === "expense");
  const totals = new Map();
  expenses.forEach((item) => totals.set(item.category, (totals.get(item.category) || 0) + item.amount));
  const sortedTotals = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const totalExpense = sum(expenses);
  const max = Math.max(...totals.values(), 1);
  els.chartList.innerHTML = "";

  if (!sortedTotals.length) {
    els.chartList.innerHTML = '<p class="eyebrow">本月還沒有支出</p>';
    return;
  }

  const piePanel = document.createElement("article");
  piePanel.className = "pie-panel";
  let cursor = 0;
  const segments = sortedTotals.map(([category, amount], index) => {
    const percent = (amount / totalExpense) * 100;
    const start = cursor;
    cursor += percent;
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`;
  });
  piePanel.innerHTML = `
    <div class="pie-visual" style="background: conic-gradient(${segments.join(", ")})" role="img" aria-label="本月支出分類比例"></div>
    <div class="pie-copy">
      <strong>支出分類比例</strong>
      <span>本月支出 ${formatCurrency(totalExpense)}</span>
      <div class="pie-legend">
        ${sortedTotals
          .map(([category, amount], index) => {
            const color = chartColors[index % chartColors.length];
            return `<span><i style="background:${color}"></i>${escapeHTML(category)} ${formatPercent(amount / totalExpense)}</span>`;
          })
          .join("")}
      </div>
    </div>
  `;
  els.chartList.append(piePanel);

  sortedTotals.forEach(([category, amount]) => {
      const row = document.createElement("article");
      row.className = "chart-row";
      row.innerHTML = `
        <strong>${category}</strong>
        <strong>${formatCurrency(amount)}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (amount / max) * 100)}%"></div></div>
      `;
      els.chartList.append(row);
    });
}

function record(note, amount, category, type, date) {
  return { id: createId(), note, amount, category, type, date, createdAt: new Date().toISOString() };
}

function sum(rows) {
  return rows.reduce((total, item) => total + Number(item.amount), 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("zh-Hant-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value) {
  return new Intl.NumberFormat("zh-Hant-TW", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFullDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("zh-Hant", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatDateWithYear(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("zh-Hant", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function todayISO() {
  return localISO(new Date());
}

function offsetISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localISO(date);
}

function localISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function weekOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOffset = Math.floor((date - start) / 86400000);
  return Math.floor((dayOffset + start.getDay()) / 7) + 1;
}

function iconFor(category) {
  const map = {
    餐飲: "食",
    交通: "行",
    購物: "買",
    生活: "家",
    娛樂: "樂",
    醫療: "醫",
    教育: "學",
    保險: "保",
    "房租 / 房貸": "房",
    貸款: "貸",
    薪資: "薪",
    退款: "退",
  };
  return map[category] || "記";
}

function renderCategorySummary() {
  const preview = categories.slice(0, 4).join("、");
  const suffix = categories.length > 4 ? ` 等 ${categories.length} 個分類` : `${categories.length} 個分類`;
  els.categorySummary.innerHTML = `
    <span>分類與關鍵字</span>
    <strong>${escapeHTML(preview)}${preview ? "，" : ""}${suffix}</strong>
  `;
}

function openCategoryEditor() {
  categoryDraftCategories = [...categories];
  categoryDraftHints = cloneCategoryHints(categoryHints);
  els.categorySummary.hidden = true;
  els.editCategoriesButton.hidden = true;
  els.categoryEditPanel.hidden = false;
  renderCategorySettings();
}

function closeCategoryEditor() {
  categoryDraftCategories = [];
  categoryDraftHints = [];
  els.categoryNameInput.value = "";
  els.categoryWordsInput.value = "";
  els.categoryEditPanel.hidden = true;
  els.categorySummary.hidden = false;
  els.editCategoriesButton.hidden = false;
}

function saveCategoryEditor() {
  collectCategoryDraftFromEditor();
  const removedCategories = categories.filter((category) => !categoryDraftCategories.includes(category));
  categories = [...categoryDraftCategories];
  categoryHints = cloneCategoryHints(categoryDraftHints).filter((hint) => categories.includes(hint.category));
  persistCategorySettings();

  if (removedCategories.length) {
    records = records.map((item) =>
      removedCategories.includes(item.category) ? { ...item, category: "其他", updatedAt: new Date().toISOString() } : item
    );
    persist();
  }

  renderCategorySummary();
  closeCategoryEditor();
  render();
  showToast("分類設定已儲存");
}

function collectCategoryDraftFromEditor() {
  els.categoryEditor.querySelectorAll(".category-row").forEach((row) => {
    const category = row.dataset.category;
    const input = row.querySelector("input");
    if (category && input) setDraftCategoryWords(category, parseKeywordList(input.value));
  });
}

function renderCategorySettings() {
  els.categoryEditor.innerHTML = "";
  categoryDraftCategories.forEach((category) => {
    const row = document.createElement("article");
    row.className = "category-row";
    row.dataset.category = category;
    const words = wordsForCategory(category, categoryDraftHints).join("、");
    row.innerHTML = `
      <div>
        <strong>${escapeHTML(category)}</strong>
        <input value="${escapeHTML(words)}" aria-label="${escapeHTML(category)} 關鍵字" placeholder="關鍵字，用、分隔" />
      </div>
      <button type="button" data-category-remove="${escapeHTML(category)}" ${category === "其他" ? "disabled" : ""}>刪除</button>
    `;
    els.categoryEditor.append(row);
  });
}

function addCategoryFromForm(event) {
  event.preventDefault();
  const name = els.categoryNameInput.value.trim();
  if (!name) return;
  if (categoryDraftCategories.includes(name)) {
    showToast("分類已存在");
    return;
  }
  categoryDraftCategories = [...categoryDraftCategories.filter((item) => item !== "其他"), name, "其他"];
  categoryDraftHints = [...categoryDraftHints, { category: name, words: parseKeywordList(els.categoryWordsInput.value) }];
  els.categoryNameInput.value = "";
  els.categoryWordsInput.value = "";
  renderCategorySettings();
}

function handleCategoryEditorChange(event) {
  const input = event.target.closest(".category-row input");
  if (!input) return;
  const category = input.closest("[data-category]").dataset.category;
  setDraftCategoryWords(category, parseKeywordList(input.value));
  renderCategorySettings();
}

function handleCategoryEditorClick(event) {
  const remove = event.target.closest("[data-category-remove]");
  if (!remove) return;
  const category = remove.dataset.categoryRemove;
  if (category === "其他") return;
  categoryDraftCategories = categoryDraftCategories.filter((item) => item !== category);
  if (!categoryDraftCategories.includes("其他")) categoryDraftCategories.push("其他");
  categoryDraftHints = categoryDraftHints.filter((hint) => hint.category !== category);
  renderCategorySettings();
}

function wordsForCategory(category, hints = categoryHints) {
  return hints.find((hint) => hint.category === category)?.words || [];
}

function setDraftCategoryWords(category, words) {
  const next = categoryDraftHints.filter((hint) => hint.category !== category);
  if (words.length) next.push({ category, words });
  categoryDraftHints = next;
}

function parseKeywordList(value) {
  return uniqueStrings(String(value).split(/[、,，\s]+/));
}

function cloneCategoryHints(hints) {
  return hints.map((hint) => ({ category: hint.category, words: [...hint.words] }));
}

function persistCategorySettings() {
  localStorage.setItem(categoriesKey, JSON.stringify(categories));
  localStorage.setItem(categoryHintsKey, JSON.stringify(categoryHints));
}

function loadCategories() {
  try {
    const saved = uniqueStrings(JSON.parse(localStorage.getItem(categoriesKey)));
    if (!saved.length) return [...defaultCategories];
    return mergeDefaultCategories(saved);
  } catch {
    return [...defaultCategories];
  }
}

function loadCategoryHints() {
  try {
    const saved = normalizeCategoryHints(JSON.parse(localStorage.getItem(categoryHintsKey)));
    return mergeDefaultCategoryHints(saved.length ? saved : []);
  } catch {
    return defaultCategoryHints.map((hint) => ({ ...hint, words: [...hint.words] }));
  }
}

function mergeDefaultCategories(saved) {
  const merged = [...saved];
  defaultCategories.forEach((category) => {
    if (merged.includes(category)) return;
    const otherIndex = merged.indexOf("其他");
    if (otherIndex >= 0) merged.splice(otherIndex, 0, category);
    else merged.push(category);
  });
  return merged.includes("其他") ? merged : [...merged, "其他"];
}

function mergeDefaultCategoryHints(saved) {
  const merged = cloneCategoryHints(saved);
  defaultCategoryHints.forEach((defaultHint) => {
    const existing = merged.find((hint) => hint.category === defaultHint.category);
    if (existing) existing.words = uniqueStrings([...existing.words, ...defaultHint.words]);
    else if (categories.includes(defaultHint.category)) merged.push({ category: defaultHint.category, words: [...defaultHint.words] });
  });
  return merged;
}

function normalizeCategoryHints(value) {
  return normalizeCategoryHintsFor(value, categories);
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
}

async function backupJSON() {
  const backup = {
    app: "日日記帳",
    version: 2,
    exportedAt: new Date().toISOString(),
    categories,
    categoryHints,
    records,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  await shareOrDownload(blob, `日日記帳備份-${todayISO()}.json`, "備份已建立");
}

async function exportCSV() {
  const header = ["日期", "類型", "分類", "金額", "備註", "建立時間", "更新時間"];
  const rows = records.map((item) => [
    item.date,
    item.type === "income" ? "收入" : "支出",
    item.category,
    item.amount,
    item.note,
    item.createdAt || "",
    item.updatedAt || "",
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  await shareOrDownload(blob, `日日記帳紀錄-${todayISO()}.csv`, "CSV 已建立");
}

async function restoreJSON(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    const importedCategories = Array.isArray(payload) ? [] : normalizeImportedCategories(payload.categories);
    const nextCategories = importedCategories.length ? importedCategories : categories;
    const importedHints = Array.isArray(payload) ? [] : normalizeCategoryHintsFor(payload.categoryHints, nextCategories);
    const importedRecords = normalizeImportedRecords(Array.isArray(payload) ? payload : payload.records, nextCategories);
    if (!importedRecords.length) {
      showToast("備份檔沒有可還原的紀錄");
      return;
    }
    if (!window.confirm(`要用備份檔取代目前 ${records.length} 筆紀錄嗎？`)) return;
    if (importedCategories.length) {
      categories = nextCategories;
      categoryHints = importedHints.length ? importedHints : [];
      persistCategorySettings();
      closeCategoryEditor();
      renderCategorySummary();
    }
    records = importedRecords;
    persist();
    selectedDate = records[0]?.date || todayISO();
    visibleMonth = selectedDate.slice(0, 7);
    syncDateControls();
    render();
    showToast(`已還原 ${records.length} 筆紀錄`);
  } catch {
    showToast("備份檔讀取失敗");
  }
}

function normalizeImportedRecords(value, allowedCategories = categories) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const amount = Number(item?.amount);
      const type = item?.type === "income" ? "income" : "expense";
      const fallbackCategory = type === "income" && allowedCategories.includes("薪資") ? "薪資" : "其他";
      const category = allowedCategories.includes(item?.category) ? item.category : fallbackCategory;
      const date = typeof item?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : todayISO();
      const note = String(item?.note || category).trim();
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return {
        id: item?.id || createId(),
        note,
        amount,
        category,
        type,
        date,
        createdAt: item?.createdAt || new Date().toISOString(),
        updatedAt: item?.updatedAt,
      };
    })
    .filter(Boolean);
}

function normalizeImportedCategories(value) {
  const saved = uniqueStrings(value);
  if (!saved.length) return [];
  return saved.includes("其他") ? saved : [...saved, "其他"];
}

function normalizeCategoryHintsFor(value, allowedCategories) {
  if (!Array.isArray(value)) return [];
  return value
    .map((hint) => ({
      category: String(hint?.category || "").trim(),
      words: uniqueStrings(hint?.words),
    }))
    .filter((hint) => hint.category && allowedCategories.includes(hint.category));
}

async function shareOrDownload(blob, fileName, successMessage) {
  const file = typeof File === "function" ? new File([blob], fileName, { type: blob.type }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      showToast(successMessage);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast(successMessage);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function persist() {
  localStorage.setItem(recordsKey, JSON.stringify(records));
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(recordsKey));
    if (!Array.isArray(saved)) return [...sampleRecords];
    return saved.filter((item) => item && item.id && item.note && Number.isFinite(Number(item.amount)));
  } catch {
    return [...sampleRecords];
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.hidden = true;
  }, 2100);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}
