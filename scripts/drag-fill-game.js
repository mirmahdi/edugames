// ===== Global DOM Elements =====
const chapterSelect = document.getElementById('chapterSelect');
const feedback = document.getElementById('feedback');
const title = document.querySelector('h1');
const gameContainer = document.getElementById('game-container');
const draggablesContainer = document.getElementById('draggables');
const textArea = document.getElementById('text-area');

// ===== Global Game State =====
let moveHistory = [];
let redoHistory = [];
let timerInterval;
let secondsElapsed = 0;
let score = 0;

// ===== Sound Effects =====
const correctSound = new Audio('sounds/correct.mp3');
const wrongSound = new Audio('sounds/wrong.mp3');

// ===== Initial Data Load =====
const urlParams = new URLSearchParams(window.location.search);
const initialDataFile = urlParams.get('data');

if (initialDataFile) {
  chapterSelect.value = initialDataFile;
  loadChapterData(initialDataFile);
} else {
  feedback.textContent = '⚠️ Please select a chapter to load.';
  feedback.style.color = '#dc3545';
  title.textContent = 'No Chapter Loaded';
}

// ===== Chapter Selection Listener =====
chapterSelect.addEventListener('change', () => {
  const selectedFile = chapterSelect.value;

  if (!selectedFile) {
    feedback.textContent = '⚠️ Please select a chapter to load.';
    feedback.style.color = '#dc3545';
    title.textContent = 'No Chapter Loaded';
    return;
  }

  loadChapterData(selectedFile);
});

// ===== Load Chapter Data with Transitions =====
function loadChapterData(jsonFile) {
  fadeOut(gameContainer, 300);

  fetch(`data/${jsonFile}`)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      title.textContent = `Drag & Fill Activity - ${jsonFile.replace('.json', '').replace(/_/g, ' ')}`;
      feedback.textContent = '';

      setTimeout(() => {
        resetAndStartGame(data.terms, data.definitions);
        fadeIn(gameContainer, 300);
      }, 300);
    })
    .catch(error => {
      console.error('Error loading data:', error);
      feedback.textContent = `❌ Failed to load data file: ${jsonFile}`;
      feedback.style.color = '#dc3545';
      title.textContent = 'Data Load Error';
    });
}

// ===== Reset and Start Game =====
function resetAndStartGame(terms, definitions) {
  clearInterval(timerInterval);
  draggablesContainer.innerHTML = '';
  textArea.innerHTML = '';
  feedback.textContent = '';
  document.getElementById('timer').textContent = '00:00';
  document.getElementById('score').textContent = '0';

  moveHistory = [];
  redoHistory = [];
  secondsElapsed = 0;
  score = 0;

  startDragFillGame(terms, definitions);
}

// ===== Fade Animations =====
function fadeOut(element, duration = 400) {
  element.style.opacity = 1;

  const step = 16 / duration;
  function animate() {
    const opacity = parseFloat(element.style.opacity);
    if (opacity > 0) {
      element.style.opacity = (opacity - step).toFixed(2);
      requestAnimationFrame(animate);
    } else {
      element.style.opacity = 0;
      element.style.display = 'none';
    }
  }

  animate();
}

function fadeIn(element, duration = 400) {
  element.style.display = 'block';
  element.style.opacity = 0;

  const step = 16 / duration;
  function animate() {
    const opacity = parseFloat(element.style.opacity);
    if (opacity < 1) {
      element.style.opacity = (opacity + step).toFixed(2);
      requestAnimationFrame(animate);
    } else {
      element.style.opacity = 1;
    }
  }

  animate();
}

// ===== Start Drag & Fill Game Logic =====
function startDragFillGame(terms, definitions) {
  immediateFeedback = document.getElementById('feedbackToggle').checked;

  populateDraggables(terms, true);
  populateDefinitions(definitions);
  attachBlankListeners(terms);
  startTimer();

  // Event Listeners
  document.getElementById('feedbackToggle').addEventListener('change', toggleFeedback);
  document.getElementById('submitAnswers').addEventListener('click', () => checkAllAnswers(terms));
  document.getElementById('solveAll').addEventListener('click', () => solveAllAnswers(terms));
  document.getElementById('resetGame').addEventListener('click', () => resetAndStartGame(terms, definitions));
  document.getElementById('undoMove').addEventListener('click', undoMove);
  document.getElementById('redoMove').addEventListener('click', redoMove);
}

// ===== Populate Draggable Terms =====
function populateDraggables(terms, sorted = false) {
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

// ===== Categorize Option by Length =====
function categorizeOption(item) {
  const len = item.textContent.length;
  item.classList.add(len <= 12 ? 'small-option' : len <= 20 ? 'medium-option' : 'large-option');
}

// ===== Populate Definitions and Blanks =====
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

// ===== Attach Drag & Drop Listeners to Blanks =====
function attachBlankListeners(terms) {
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

      if (immediateFeedback) checkSingleAnswer(blank, droppedTerm, index, terms);
      updateScore(10);
    });
  });
}

// ===== Immediate Feedback Toggle =====
function toggleFeedback() {
  immediateFeedback = document.getElementById('feedbackToggle').checked;
  evaluateAllBlanks();
}

// ===== Check a Single Answer =====
function checkSingleAnswer(blank, term, index, terms) {
  if (term === terms[index]) {
    applyAnswerStyles(blank, 'correct', '#28a745');
    correctSound.play();
  } else {
    applyAnswerStyles(blank, 'incorrect', '#dc3545');
  }
  markWordAsUsed(term);
}

// ===== Apply Answer Styles =====
function applyAnswerStyles(blank, statusClass, color) {
  blank.classList.remove('correct', 'incorrect');
  blank.classList.add(statusClass);
  blank.style.border = `2px solid ${color}`;
}

// ===== Mark a Word as Used =====
function markWordAsUsed(word) {
  document.querySelectorAll('.draggable').forEach(item => {
    if (item.textContent === word) {
      item.classList.add('strikethrough', 'disabled');
      item.draggable = false;
      if (immediateFeedback) item.classList.add('correct-strike');
    }
  });
}

// ===== Clear Word Status =====
function clearWordStatus(word) {
  document.querySelectorAll('.draggable').forEach(item => {
    if (item.textContent === word) {
      item.classList.remove('strikethrough', 'correct-strike', 'disabled');
      item.draggable = true;
    }
  });
}

// ===== Undo Move =====
function undoMove() {
  if (!moveHistory.length) return;

  const { blankIndex, newValue } = moveHistory.pop();
  redoHistory.push({ blankIndex, previousValue: '', newValue });

  const blank = textArea.querySelector(`strong[data-index="${blankIndex}"]`);
  blank.textContent = '';
  clearWordStatus(newValue);

  evaluateAllBlanks();
}

// ===== Redo Move =====
function redoMove() {
  if (!redoHistory.length) return;

  const { blankIndex, newValue } = redoHistory.pop();
  moveHistory.push({ blankIndex, previousValue: '', newValue });

  const blank = textArea.querySelector(`strong[data-index="${blankIndex}"]`);
  blank.textContent = newValue;
  markWordAsUsed(newValue);

  evaluateAllBlanks();
}

// ===== Evaluate All Blanks (Immediate Feedback) =====
function evaluateAllBlanks() {
  const blanks = textArea.querySelectorAll('strong');

  blanks.forEach((blank, index) => {
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

// ===== Check All Answers on Submit =====
function checkAllAnswers(terms) {
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

// ===== Solve All Answers =====
function solveAllAnswers(terms) {
  textArea.querySelectorAll('strong').forEach((blank, index) => {
    blank.textContent = terms[index];
    applyAnswerStyles(blank, 'correct', '#28a745');
    markWordAsUsed(terms[index]);
  });

  feedback.textContent = '✅ All answers have been filled in for you.';
  feedback.style.color = '#28a745';
}

// ===== Animate Return of Word =====
function animateReturn(word) {
  const item = Array.from(document.querySelectorAll('.draggable'))
    .find(div => div.textContent === word);

  if (!item) return;

  item.classList.add('shake');
  setTimeout(() => item.classList.remove('shake'), 500);
}

// ===== Start the Timer =====
function startTimer() {
  timerInterval = setInterval(() => {
    secondsElapsed++;
    document.getElementById('timer').textContent = formatTime(secondsElapsed);
  }, 1000);
}

// ===== Format Timer Display =====
function formatTime(totalSeconds) {
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

// ===== Update Score =====
function updateScore(change) {
  score = Math.max(score + change, 0);
  document.getElementById('score').textContent = score;
}
