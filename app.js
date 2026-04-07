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
    _cursorTimeout: null,
  };

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
    themeToggle: document.getElementById('theme-toggle'),
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
  // All words are rendered upfront as span elements.
  // Each word is a .word containing .char spans for each letter.
  // The cursor is a single element moved between words.

  const VISIBLE_WORDS = 80; // Render this many words at a time
  let wordElements = [];    // DOM references to .word elements

  function buildWords() {
    dom.wordsInner.innerHTML = '';
    wordElements = [];

    const frag = document.createDocumentFragment();
    const count = Math.min(VISIBLE_WORDS, state.words.length);

    for (let i = 0; i < count; i++) {
      const wordEl = createWordElement(state.words[i], i);
      wordElements.push(wordEl);
      frag.appendChild(wordEl);
    }

    dom.wordsInner.appendChild(frag);

    // Mark current word & position cursor
    if (wordElements.length > 0) {
      wordElements[0].classList.add('current');
    }

    // Reset scroll
    dom.wordsInner.style.transform = 'translateY(0)';
  }

  function createWordElement(word, index) {
    const wordEl = document.createElement('span');
    wordEl.className = 'word';
    wordEl.dataset.index = index;

    for (let i = 0; i < word.length; i++) {
      const charEl = document.createElement('span');
      charEl.className = 'char pending';
      charEl.textContent = word[i];
      wordEl.appendChild(charEl);
    }

    return wordEl;
  }

  // ===== Update Current Word Display =====
  function updateCurrentWord() {
    const wordEl = wordElements[state.currentIndex];
    if (!wordEl) return;

    const word = state.words[state.currentIndex];
    const input = state.currentInput;

    // Remove any previous extra chars
    const existingExtras = wordEl.querySelectorAll('.char.extra');
    existingExtras.forEach(el => el.remove());

    const chars = wordEl.querySelectorAll('.char:not(.extra)');

    // Update each character's state
    for (let i = 0; i < chars.length; i++) {
      if (i < input.length) {
        if (input[i] === word[i]) {
          chars[i].className = 'char correct';
          chars[i].textContent = word[i]; // ensure correct char shown
        } else {
          chars[i].className = 'char wrong';
          chars[i].textContent = input[i]; // show what was actually typed
          chars[i].dataset.expected = word[i]; // remember expected
        }
      } else {
        chars[i].className = 'char pending';
        // Restore original character if it was previously overwritten
        if (chars[i].dataset.expected) {
          chars[i].textContent = chars[i].dataset.expected;
          delete chars[i].dataset.expected;
        }
      }
    }

    // Show extra typed characters beyond word length
    if (input.length > word.length) {
      for (let i = word.length; i < input.length; i++) {
        const extraEl = document.createElement('span');
        extraEl.className = 'char extra';
        extraEl.textContent = input[i];
        wordEl.appendChild(extraEl);
      }
    }

  }

  // ===== Auto-scroll words =====
  function scrollToCurrentWord() {
    const wordEl = wordElements[state.currentIndex];
    if (!wordEl) return;

    // Use offsetTop (relative to wordsInner, unaffected by transform)
    const lineHeight = parseFloat(getComputedStyle(dom.wordsContainer).lineHeight) || 40;
    const wordOffset = wordEl.offsetTop;

    // Scroll so current word is on the first line
    // Only scroll forward (never backward during normal typing)
    const targetScroll = Math.floor(wordOffset / lineHeight) * lineHeight;
    dom.wordsInner.style.transform = `translateY(-${targetScroll}px)`;
  }

  // ===== Metrics =====
  function updateMetrics() {
    const total = state.typedResults.length;
    const wpm = Math.max(0, total - state.mistakes);
    const cpm = state.typedCharsNum;
    const acc = total > 0 ? Math.round(((total - state.mistakes) / total) * 100) : 0;

    dom.wpmValue.textContent = wpm;
    dom.cpmValue.textContent = cpm;
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
    }, 50);

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

    // Space = submit word
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
    const wordEl = wordElements[state.currentIndex];
    if (wordEl) {
      wordEl.classList.remove('current');
      wordEl.classList.add('typed');
      if (!isCorrect) wordEl.classList.add('wrong');

      // Remove extra chars & cursor from this word
      const extras = wordEl.querySelectorAll('.char.extra');
      extras.forEach(el => el.remove());

      // Reset char display to show original word (faded)
      const chars = wordEl.querySelectorAll('.char');
      const word = state.words[state.currentIndex];
      chars.forEach((c, i) => {
        c.className = 'char';
        // Restore original character if it was overwritten by a mistype
        if (c.dataset.expected) {
          c.textContent = c.dataset.expected;
          delete c.dataset.expected;
        }
      });
    }

    // Move to next word
    state.currentIndex++;
    state.currentInput = '';
    dom.input.value = '';

    // Extend words if running low
    if (state.currentIndex >= state.words.length - 30) {
      const newWords = shuffle(WORDS);
      state.words = state.words.concat(newWords);
      // Build new DOM elements
      const frag = document.createDocumentFragment();
      for (let i = 0; i < newWords.length; i++) {
        const idx = wordElements.length;
        const el = createWordElement(newWords[i], idx);
        wordElements.push(el);
        frag.appendChild(el);
      }
      dom.wordsInner.appendChild(frag);
    }

    // Mark new current word
    if (wordElements[state.currentIndex]) {
      wordElements[state.currentIndex].classList.add('current');
    }

    scrollToCurrentWord();
    updateMetrics();
  }

  // ===== Results =====
  function showResults() {
    const total = state.typedResults.length;
    const wpm = Math.max(0, total - state.mistakes);
    const cpm = state.typedCharsNum;
    const acc = total > 0 ? Math.round(((total - state.mistakes) / total) * 100) : 0;

    const minutesFactor = 60 / state.duration;
    const scaledWpm = Math.round(wpm * minutesFactor);
    const scaledCpm = Math.round(cpm * minutesFactor);

    dom.resultWpm.textContent = scaledWpm;
    dom.resultCpm.textContent = scaledCpm;
    dom.resultAcc.textContent = acc;

    let title, excl, msg, emoji;
    if (scaledWpm < 30) {
      title = "You're a Turtle."; excl = "Well..."; msg = "It could be better!"; emoji = "🐢";
    } else if (scaledWpm < 40) {
      title = "You're a T-REX."; excl = "Nice!"; msg = "Keep practicing!"; emoji = "🦖";
    } else if (scaledWpm < 60) {
      title = "You're an Octopus."; excl = "Neat!"; msg = "Good job!"; emoji = "🐙";
    } else {
      title = "You're an Octopus."; excl = "Awesome!"; msg = "Congratulations!"; emoji = "🐙";
    }

    dom.resultsEmoji.textContent = emoji;
    dom.resultsTitle.textContent = title;
    dom.resultsSubtitle.innerHTML =
      `${excl} You type with the speed of <span class="highlight">${scaledWpm} WPM</span> ` +
      `(${scaledCpm} CPM). Your accuracy was <span class="bold">${acc}%</span>. ${msg}`;

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
    // else default is light (no data-theme attribute)
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

  // ===== Init =====
  initTheme();
  resetTest();

})();
