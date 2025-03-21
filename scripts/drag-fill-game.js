function startDragFillGame(terms, definitions) {
  const draggablesContainer = document.getElementById('draggables');
  const textArea = document.getElementById('text-area');
  const feedback = document.getElementById('feedback');
  const feedbackToggle = document.getElementById('feedbackToggle');
  const submitButton = document.getElementById('submitAnswers');
  const solveButton = document.getElementById('solveAll');
  const resetButton = document.getElementById('resetGame');
  const undoButton = document.getElementById('undoMove');
  const redoButton = document.getElementById('redoMove');
  const timerDisplay = document.getElementById('timer');
  const scoreDisplay = document.getElementById('score');

  let immediateFeedback = feedbackToggle.checked;
  let moveHistory = [], redoHistory = [];
  let timerInterval, secondsElapsed = 0, score = 0;

  const correctSound = new Audio('sounds/correct.mp3');
  const wrongSound = new Audio('sounds/wrong.mp3');

  // INIT
  populateDraggables(true);
  populateDefinitions(definitions);
  attachBlankListeners();
  startTimer();

  feedbackToggle.addEventListener('change', toggleFeedback);
  submitButton.addEventListener('click', checkAllAnswers);
  solveButton.addEventListener('click', solveAllAnswers);
  resetButton.addEventListener('click', resetGame);
  undoButton.addEventListener('click', undoMove);
  redoButton.addEventListener('click', redoMove);

  function toggleFeedback() {
    immediateFeedback = feedbackToggle.checked;
    evaluateAllBlanks();
  }

  function populateDraggables(sorted = false) {
    draggablesContainer.innerHTML = '';
    const sortedTerms = sorted ? [...terms].sort() : [...terms].sort(() => Math.random() - 0.5);

    sortedTerms.forEach(term => {
      const item = document.createElement('div');
      item.className = 'draggable';
      item.textContent = term;
      item.draggable = true;
      categorizeOption(item);

      item.addEventListener('dragstart', e => {
        if (item.classList.contains('disabled')) return e.preventDefault();
        item.classList.add('dragging');
        e.dataTransfer.setData('text/plain', term);
      });

      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      draggablesContainer.appendChild(item);
    });
  }

  function categorizeOption(item) {
    const len = item.textContent.length;
    item.classList.add(len <= 12 ? 'small-option' : len <= 20 ? 'medium-option' : 'large-option');
  }

  function populateDefinitions(definitions) {
    textArea.innerHTML = '';
    definitions.forEach((def, index) => {
      const p = document.createElement('p');
      p.innerHTML = `
        <span class="question-number">${index + 1}.</span>
        <strong data-index="${index}"></strong>
        <span class="definition-text">${def}</span>
      `;
      textArea.appendChild(p);
    });
  }

  function startTimer() {
    timerInterval = setInterval(() => {
      secondsElapsed++;
      timerDisplay.textContent = formatTime(secondsElapsed);
    }, 1000);
  }

  function formatTime(totalSeconds) {
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function updateScore(change) {
    score = Math.max(score + change, 0);
    scoreDisplay.textContent = score;
  }

  function attachBlankListeners() {
    const blanks = textArea.querySelectorAll('strong');
    blanks.forEach(blank => {
      blank.addEventListener('dragover', e => {
        e.preventDefault();
        blank.classList.add('droppable-hover');
      });

      blank.addEventListener('dragleave', () => blank.classList.remove('droppable-hover'));

      blank.addEventListener('drop', e => {
        e.preventDefault();
        blank.classList.remove('droppable-hover');

        const droppedTerm = e.dataTransfer.getData('text/plain');
        const index = parseInt(blank.dataset.index);
        const prevValue = blank.textContent;

        if (immediateFeedback && droppedTerm !== terms[index]) {
          animateReturn(droppedTerm);
          wrongSound.play();
          updateScore(-1);
          return;
        }

        moveHistory.push({ blankIndex: index, previousValue: prevValue, newValue: droppedTerm });
        redoHistory = [];

        blank.textContent = droppedTerm;
        markWordAsUsed(droppedTerm);

        if (immediateFeedback) checkSingleAnswer(blank, droppedTerm, index);
        updateScore(10);
      });
    });
  }

  function markWordAsUsed(word) {
    document.querySelectorAll('.draggable').forEach(item => {
      if (item.textContent === word) {
        item.classList.add('strikethrough', 'disabled');
        item.draggable = false;
        if (immediateFeedback) item.classList.add('correct-strike');
      }
    });
  }

  function clearWordStatus(word) {
    document.querySelectorAll('.draggable').forEach(item => {
      if (item.textContent === word) {
        item.classList.remove('strikethrough', 'correct-strike', 'disabled');
        item.draggable = true;
      }
    });
  }

  function undoMove() {
    if (!moveHistory.length) return;

    const { blankIndex, newValue } = moveHistory.pop();
    redoHistory.push({ blankIndex, previousValue: '', newValue });

    const blank = textArea.querySelector(`strong[data-index="${blankIndex}"]`);
    blank.textContent = '';
    clearWordStatus(newValue);
    evaluateAllBlanks();
  }

  function redoMove() {
    if (!redoHistory.length) return;

    const { blankIndex, newValue } = redoHistory.pop();
    moveHistory.push({ blankIndex, previousValue: '', newValue });

    const blank = textArea.querySelector(`strong[data-index="${blankIndex}"]`);
    blank.textContent = newValue;
    markWordAsUsed(newValue);
    evaluateAllBlanks();
  }

  function checkSingleAnswer(blank, term, index) {
    if (term === terms[index]) {
      applyAnswerStyles(blank, 'correct', '#28a745');
      correctSound.play();
    } else {
      applyAnswerStyles(blank, 'incorrect', '#dc3545');
    }
  }

  function applyAnswerStyles(blank, statusClass, color) {
    blank.classList.remove('correct', 'incorrect');
    blank.classList.add(statusClass);
    blank.style.border = `2px solid ${color}`;
  }

  function checkAllAnswers() {
    let allCorrect = true;
    textArea.querySelectorAll('strong').forEach((blank, index) => {
      const text = blank.textContent;
      if (text === terms[index]) {
        applyAnswerStyles(blank, 'correct', '#28a745');
        markWordAsUsed(text);
      } else {
        applyAnswerStyles(blank, 'incorrect', '#dc3545');
        allCorrect = false;
      }
    });

    feedback.textContent = allCorrect
      ? '✅ Excellent! All answers are correct!'
      : '❌ Some answers are incorrect. Please review.';
    feedback.style.color = allCorrect ? '#28a745' : '#dc3545';
  }

  function solveAllAnswers() {
    textArea.querySelectorAll('strong').forEach((blank, index) => {
      blank.textContent = terms[index];
      applyAnswerStyles(blank, 'correct', '#28a745');
      markWordAsUsed(terms[index]);
    });

    feedback.textContent = '✅ All answers have been filled in for you.';
    feedback.style.color = '#28a745';
  }

  function resetGame() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    score = 0;
    feedback.textContent = '';
    moveHistory = [];
    redoHistory = [];

    textArea.querySelectorAll('strong').forEach(blank => {
      blank.textContent = '';
      blank.classList.remove('correct', 'incorrect');
      blank.style.border = '2px dashed #ccc';
    });

    populateDraggables(true);
    attachBlankListeners();
    startTimer();
    updateScore(0);
  }

  function evaluateAllBlanks() {
    textArea.querySelectorAll('strong').forEach((blank, index) => {
      const text = blank.textContent;
      if (!text) {
        blank.classList.remove('correct', 'incorrect');
        blank.style.border = '2px dashed #ccc';
      } else if (text === terms[index]) {
        applyAnswerStyles(blank, 'correct', '#28a745');
        markWordAsUsed(text);
      } else {
        applyAnswerStyles(blank, 'incorrect', '#dc3545');
      }
    });
  }

  function animateReturn(word) {
    const item = Array.from(document.querySelectorAll('.draggable'))
      .find(div => div.textContent === word);
    if (!item) return;
    item.classList.add('shake');
    setTimeout(() => item.classList.remove('shake'), 500);
  }
}
