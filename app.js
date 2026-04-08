// ===== Typing Speed Test — Vanilla JS Engine =====

(function () {
  'use strict';

  // WORDS is loaded globally via words.js <script> tag

  // ===== State =====
  const state = {
    duration: 60,
    timeLeft: 60,
    started: false,
    finished: false,
    timerInterval: null,
    startTime: 0,

    words: [],           // shuffled words for this session
    currentIndex: 0,     // index of current word
    typedResults: [],    // { word, typed, correct }
    typedCharsNum: 0,    // chars in correct words
    mistakes: 0,

    currentInput: '',
  };

  const STORAGE_KEY = 'typing-test-results';

  // ===== DOM =====
  const dom = {
    input: document.getElementById('test-input'),
    wordsInner: document.getElementById('words-inner'),
    wordsContainer: document.getElementById('words-container'),
    indicator: document.getElementById('start-indicator'),
    timerValue: document.getElementById('timer-value'),
    timerProgress: document.getElementById('timer-progress'),
    timerTrack: document.getElementById('timer-track'),
    wpmValue: document.getElementById('wpm-value'),
    cpmValue: document.getElementById('cpm-value'),
    accValue: document.getElementById('acc-value'),
    typingArea: document.getElementById('typing-area'),
    resetBtn: document.getElementById('reset-btn'),
    durationSelector: document.getElementById('duration-selector'),
    resultsOverlay: document.getElementById('results-overlay'),
    resultWpm: document.getElementById('result-wpm'),
    resultCpm: document.getElementById('result-cpm'),
    resultAcc: document.getElementById('result-acc'),
    resultsTitle: document.getElementById('results-title'),
    resultsSubtitle: document.getElementById('results-subtitle'),
    resultsEmoji: document.getElementById('results-emoji'),
    btnTryAgain: document.getElementById('btn-try-again'),
    btnSaveResult: document.getElementById('btn-save-result'),
    themeToggle: document.getElementById('theme-toggle'),
    leaderboardSidebar: document.getElementById('leaderboard-sidebar'),
    leaderboardTab: document.getElementById('leaderboard-tab'),
    leaderboardBody: document.getElementById('leaderboard-body'),
    leaderboardTable: document.getElementById('leaderboard-table'),
    leaderboardEmpty: document.getElementById('leaderboard-empty'),
    leaderboardClear: document.getElementById('leaderboard-clear'),
  };

  // ===== Word Management =====
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function generateWords() {
    let pool = [];
    while (pool.length < 600) {
      pool = pool.concat(shuffle(WORDS));
    }
    return pool;
  }

  // ===== Word Rendering =====
  const VISIBLE_WORDS = 80;

  // Each entry: { el, chars: [...charEls], wrongInserts: [] }
  let wordData = [];

  function buildWords() {
    dom.wordsInner.innerHTML = '';
    wordData = [];

    const frag = document.createDocumentFragment();
    const count = Math.min(VISIBLE_WORDS, state.words.length);

    for (let i = 0; i < count; i++) {
      const wd = createWordData(state.words[i], i);
      wordData.push(wd);
      frag.appendChild(wd.el);
    }

    dom.wordsInner.appendChild(frag);

    if (wordData.length > 0) {
      wordData[0].el.classList.add('current');
    }

    // Reset scroll without animation
    dom.wordsInner.style.transition = 'none';
    dom.wordsInner.style.transform = 'translateX(0)';
    // Force reflow, then restore transition
    dom.wordsInner.offsetWidth;
    dom.wordsInner.style.transition = '';
  }

  function createWordData(word, index) {
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    wordEl.dataset.index = index;

    const chars = [];
    for (let i = 0; i < word.length; i++) {
      const charEl = document.createElement('span');
      charEl.className = 'char pending';
      charEl.textContent = word[i];
      wordEl.appendChild(charEl);
      chars.push(charEl);
    }

    return { el: wordEl, chars, wrongInserts: [] };
  }

  // ===== Update Current Word Display =====
  // Wrong chars are INSERTED between correct and pending — they never
  // replace the expected characters. Original chars always show expected text.
  //
  // "keep" typed as "kedd" → k(correct) e(correct) d̶d̶(wrong inserts) e(pending) p(pending)

  function clearWrongInserts(wd) {
    for (let i = 0; i < wd.wrongInserts.length; i++) {
      const el = wd.wrongInserts[i];
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    wd.wrongInserts.length = 0;
  }

  function updateCurrentWord() {
    const wd = wordData[state.currentIndex];
    if (!wd) return;

    const word = state.words[state.currentIndex];
    const input = state.currentInput;
    const chars = wd.chars;

    // Clear previous wrong inserts
    clearWrongInserts(wd);

    // Count leading correct characters (break at first mismatch)
    let correctCount = 0;
    for (let i = 0; i < input.length && i < word.length; i++) {
      if (input[i] === word[i]) correctCount++;
      else break;
    }

    // Update original chars — correct or pending, text never changes
    for (let i = 0; i < chars.length; i++) {
      chars[i].className = i < correctCount ? 'char correct' : 'char pending';
    }

    // Insert wrong typed chars (everything after the correct streak)
    const wrongInput = input.slice(correctCount);
    if (wrongInput.length > 0) {
      // Insert before the first pending char, or append if all matched
      const insertBefore = correctCount < chars.length ? chars[correctCount] : null;
      for (let i = 0; i < wrongInput.length; i++) {
        const wrongEl = document.createElement('span');
        wrongEl.className = 'char wrong';
        wrongEl.textContent = wrongInput[i];
        if (insertBefore) {
          wd.el.insertBefore(wrongEl, insertBefore);
        } else {
          wd.el.appendChild(wrongEl);
        }
        wd.wrongInserts.push(wrongEl);
      }
    }
  }

  // ===== Horizontal scroll =====
  // CSS transition handles the smooth animation. JS just sets the target.
  // Transition is on .words-inner in CSS (1s ease-out).
  let currentScrollX = 0;

  function updateScrollTarget() {
    const wd = wordData[state.currentIndex];
    if (!wd) return;

    const containerWidth = dom.wordsContainer.clientWidth;
    const target = Math.max(0, wd.el.offsetLeft - containerWidth * 0.2);

    if (target === currentScrollX) return;

    currentScrollX = target;
    dom.wordsInner.style.transform = `translateX(-${currentScrollX}px)`;
  }

  function scrollBackForBackspace() {
    const wd = wordData[state.currentIndex];
    if (!wd) return;

    const visiblePos = wd.el.offsetLeft - currentScrollX;
    if (visiblePos >= 0) return;

    const containerWidth = dom.wordsContainer.clientWidth;
    currentScrollX = Math.max(0, wd.el.offsetLeft - containerWidth * 0.2);
    dom.wordsInner.style.transform = `translateX(-${currentScrollX}px)`;
  }

  // ===== Metrics =====
  function updateMetrics() {
    const total = state.typedResults.length;
    const correctWords = Math.max(0, total - state.mistakes);
    const acc = total > 0 ? Math.round((correctWords / total) * 100) : 0;

    // Live metrics show cumulative counts — rate is calculated on results screen
    dom.wpmValue.textContent = correctWords;
    dom.cpmValue.textContent = state.typedCharsNum;
    dom.accValue.textContent = acc;
  }

  function renderTimer() {
    dom.timerValue.textContent = state.timeLeft;
    const fraction = state.timeLeft / state.duration;
    const offset = 332 - (332 * fraction);
    dom.timerProgress.style.strokeDashoffset = offset + 'px';
  }

  // ===== Timer =====
  function startTimer() {
    if (state.started) return;
    state.started = true;
    state.startTime = Date.now();

    dom.indicator.classList.add('hidden');

    let lastSecond = state.duration;
    state.timerInterval = setInterval(() => {
      const elapsed = (Date.now() - state.startTime) / 1000;
      const remaining = Math.max(0, state.duration - elapsed);
      const currentSecond = Math.ceil(remaining);

      if (currentSecond !== lastSecond) {
        lastSecond = currentSecond;
        state.timeLeft = currentSecond;
        renderTimer();
      }

      if (remaining <= 0) {
        endTest();
      }
    }, 200);

    // Smooth CSS transition for the ring
    requestAnimationFrame(() => {
      dom.timerProgress.style.transition = `stroke-dashoffset ${state.duration}s linear`;
      dom.timerProgress.style.strokeDashoffset = '332px';
    });
  }

  function endTest() {
    state.finished = true;
    clearInterval(state.timerInterval);
    state.timeLeft = 0;
    renderTimer();
    dom.input.blur();
    dom.input.disabled = true;
    showResults();
  }

  // ===== Input Handling =====
  function handleInput() {
    if (state.finished) return;
    if (!state.started) startTimer();

    const value = dom.input.value;

    if (value.endsWith(' ')) {
      submitWord();
      return;
    }

    state.currentInput = value;
    updateCurrentWord();
  }

  function handleKeydown(e) {
    if (state.finished) return;

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (state.currentInput.length > 0) {
        submitWord();
      }
    }

    // Backspace into previous word
    if (e.key === 'Backspace' && state.currentInput === '' && dom.input.value === '') {
      e.preventDefault();
      goBackToPreviousWord();
    }
  }

  // ===== Backspace to previous word =====
  function goBackToPreviousWord() {
    if (state.currentIndex === 0) return;

    const prevIndex = state.currentIndex - 1;
    const prevWd = wordData[prevIndex];
    if (!prevWd) return;

    // Un-mark current word
    const currentWd = wordData[state.currentIndex];
    if (currentWd) {
      currentWd.el.classList.remove('current');
    }

    // Restore previous word's result from typedResults
    const prevResult = state.typedResults.pop();
    if (prevResult) {
      if (!prevResult.correct) {
        state.mistakes--;
      } else {
        state.typedCharsNum -= prevResult.typed.length;
      }
    }

    // Restore the previous word element
    prevWd.el.classList.remove('typed', 'wrong');
    prevWd.el.classList.add('current');

    // Move state back
    state.currentIndex = prevIndex;
    state.currentInput = prevResult ? prevResult.typed : '';
    dom.input.value = state.currentInput;

    // Re-render the word with the previous typed input (sync — it's rendering)
    updateCurrentWord();

    // Everything else async
    requestAnimationFrame(() => {
      updateMetrics();
      scrollBackForBackspace();
    });
  }

  function submitWord() {
    const currentWord = state.words[state.currentIndex];
    const typed = state.currentInput.trim();

    if (typed === '') {
      dom.input.value = '';
      return;
    }

    const isCorrect = typed === currentWord;

    state.typedResults.push({ word: currentWord, typed, correct: isCorrect });

    if (!isCorrect) {
      state.mistakes++;
    } else {
      state.typedCharsNum += typed.length;
    }

    // Mark the current word as typed
    const wd = wordData[state.currentIndex];
    if (wd) {
      wd.el.classList.remove('current');
      wd.el.classList.add('typed');
      if (!isCorrect) wd.el.classList.add('wrong');

      // Remove wrong inserts, reset all original chars to base state
      clearWrongInserts(wd);
      wd.chars.forEach(c => { c.className = 'char'; });
    }

    // Move to next word
    state.currentIndex++;
    state.currentInput = '';
    dom.input.value = '';

    // Extend words if running low
    if (state.currentIndex >= state.words.length - 30) {
      const newWords = shuffle(WORDS);
      state.words = state.words.concat(newWords);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < newWords.length; i++) {
        const wd = createWordData(newWords[i], wordData.length);
        wordData.push(wd);
        frag.appendChild(wd.el);
      }
      dom.wordsInner.appendChild(frag);
    }

    // Mark new current word
    if (wordData[state.currentIndex]) {
      wordData[state.currentIndex].el.classList.add('current');
    }

    // Everything non-rendering is async — never block input
    requestAnimationFrame(() => {
      updateMetrics();
      updateScrollTarget();
    });
  }

  // ===== Results =====
  function showResults() {
    const total = state.typedResults.length;
    const correctWords = Math.max(0, total - state.mistakes);
    const cpm = state.typedCharsNum;
    const acc = total > 0 ? Math.round((correctWords / total) * 100) : 0;

    const minutesFactor = 60 / state.duration;
    const scaledWpm = Math.round(correctWords * minutesFactor);
    const scaledCpm = Math.round(cpm * minutesFactor);

    dom.resultWpm.textContent = scaledWpm;
    dom.resultCpm.textContent = scaledCpm;
    dom.resultAcc.textContent = acc;

    let title, excl, msg, emoji;
    if (scaledWpm < 30) {
      title = "You're a Turtle.";
      excl = "Well...";
      msg = "Keep at it, speed comes with practice!";
      emoji = "🐢";
    } else if (scaledWpm < 40) {
      title = "You're a T-Rex.";
      excl = "Nice!";
      msg = "Those tiny arms are getting faster!";
      emoji = "🦖";
    } else if (scaledWpm < 60) {
      title = "You're a Rabbit.";
      excl = "Neat!";
      msg = "Quick fingers, solid rhythm!";
      emoji = "🐇";
    } else if (scaledWpm < 80) {
      title = "You're an Octopus.";
      excl = "Impressive!";
      msg = "Eight arms couldn't type faster!";
      emoji = "🐙";
    } else if (scaledWpm < 100) {
      title = "You're a Cheetah.";
      excl = "Blazing!";
      msg = "Fastest fingers in the savanna!";
      emoji = "🐆";
    } else {
      title = "You're a Falcon.";
      excl = "Legendary!";
      msg = "Your fingers break the sound barrier!";
      emoji = "🦅";
    }

    dom.resultsEmoji.textContent = emoji;
    dom.resultsTitle.textContent = title;
    dom.resultsSubtitle.innerHTML =
      `${excl} You type with the speed of <span class="highlight">${scaledWpm} WPM</span> ` +
      `(${scaledCpm} CPM). Your accuracy was <span class="bold">${acc}%</span>. ${msg}`;

    // Prepare result for saving
    lastResult = {
      wpm: scaledWpm,
      cpm: scaledCpm,
      acc: acc,
      duration: state.duration,
      date: Date.now(),
    };
    dom.btnSaveResult.textContent = 'Save result';
    dom.btnSaveResult.classList.remove('saved');

    dom.resultsOverlay.classList.add('visible');
  }

  // ===== Reset =====
  function resetTest() {
    clearInterval(state.timerInterval);

    state.timeLeft = state.duration;
    state.started = false;
    state.finished = false;
    state.timerInterval = null;
    state.startTime = 0;
    state.words = generateWords();
    state.currentIndex = 0;
    state.typedResults = [];
    state.typedCharsNum = 0;
    state.mistakes = 0;
    state.currentInput = '';

    dom.input.disabled = false;
    dom.input.value = '';
    dom.indicator.classList.remove('hidden');
    dom.resultsOverlay.classList.remove('visible');

    // Reset timer visuals
    dom.timerProgress.style.transition = 'none';
    dom.timerProgress.style.strokeDashoffset = '0px';

    currentScrollX = 0;
    buildWords();
    updateMetrics();
    renderTimer();

    setTimeout(() => dom.input.focus(), 100);
  }

  // ===== Theme Toggle =====
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  function setCookie(name, value, days) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      dom.themeToggle.textContent = '☀️';
      dom.timerTrack.setAttribute('stroke', '#3a3532');
    } else {
      document.documentElement.removeAttribute('data-theme');
      dom.themeToggle.textContent = '🌙';
      dom.timerTrack.setAttribute('stroke', '#ddd6ca');
    }
  }

  function initTheme() {
    const saved = getCookie('theme');
    if (saved) {
      applyTheme(saved);
    }
  }

  dom.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.hasAttribute('data-theme');
    const newTheme = isDark ? 'light' : 'dark';
    applyTheme(newTheme);
    setCookie('theme', newTheme, 365);
  });

  // ===== Event Listeners =====
  dom.input.addEventListener('input', handleInput);
  dom.input.addEventListener('keydown', handleKeydown);

  dom.typingArea.addEventListener('click', () => {
    if (!state.finished) dom.input.focus();
  });

  dom.input.addEventListener('blur', () => {
    if (state.started && !state.finished) {
      setTimeout(() => dom.input.focus(), 10);
    }
  });

  dom.resetBtn.addEventListener('click', resetTest);
  dom.btnTryAgain.addEventListener('click', resetTest);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.resultsOverlay.classList.contains('visible')) {
      resetTest();
    }
  });

  dom.durationSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('.duration-btn');
    if (!btn) return;
    if (state.started && !state.finished) return;

    const time = parseInt(btn.dataset.time, 10);
    state.duration = time;
    state.timeLeft = time;

    dom.durationSelector.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    resetTest();
  });

  dom.input.addEventListener('paste', (e) => e.preventDefault());

  // ===== Leaderboard — localStorage =====
  let lastResult = null; // holds the most recent result for saving

  function loadResults() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveResultToStorage() {
    if (!lastResult) return;
    const results = loadResults();
    results.push(lastResult);
    // Sort by WPM descending, keep top 20
    results.sort((a, b) => b.wpm - a.wpm);
    if (results.length > 20) results.length = 20;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    lastResult = null;
    dom.btnSaveResult.textContent = 'Saved!';
    dom.btnSaveResult.classList.add('saved');
    renderLeaderboard();
  }

  function clearResults() {
    localStorage.removeItem(STORAGE_KEY);
    renderLeaderboard();
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const mon = d.toLocaleString('default', { month: 'short' });
    return `${mon} ${d.getDate()}, ${d.getFullYear()}`;
  }

  function formatDuration(secs) {
    if (secs < 120) return secs + 's';
    return Math.round(secs / 60) + 'min';
  }

  function renderLeaderboard() {
    const results = loadResults();
    if (results.length === 0) {
      dom.leaderboardTable.style.display = 'none';
      dom.leaderboardEmpty.style.display = '';
      return;
    }
    dom.leaderboardTable.style.display = '';
    dom.leaderboardEmpty.style.display = 'none';

    dom.leaderboardBody.innerHTML = '';
    const bestWpm = results[0].wpm;

    results.forEach((r, i) => {
      const tr = document.createElement('tr');
      if (r.wpm === bestWpm) tr.className = 'best-row';
      tr.innerHTML =
        `<td class="col-rank">${i + 1}</td>` +
        `<td class="col-wpm">${r.wpm}</td>` +
        `<td>${r.cpm}</td>` +
        `<td>${r.acc}%</td>` +
        `<td>${formatDuration(r.duration)}</td>` +
        `<td class="col-date">${formatDate(r.date)}</td>`;
      dom.leaderboardBody.appendChild(tr);
    });
  }

  dom.btnSaveResult.addEventListener('click', saveResultToStorage);
  dom.leaderboardClear.addEventListener('click', clearResults);
  dom.leaderboardTab.addEventListener('click', () => {
    dom.leaderboardSidebar.classList.toggle('open');
  });

  // ===== Init =====
  initTheme();
  resetTest();
  renderLeaderboard();

})();
