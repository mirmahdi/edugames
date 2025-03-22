const chapterSelect = document.getElementById('chapter');
const difficultySelect = document.getElementById('difficulty');
const newGameButton = document.getElementById('newGameButton');
const endGameButton = document.getElementById('endGameButton');
const hintText = document.getElementById('hintText');
const wordDisplay = document.getElementById('wordDisplay');
const definitionDisplay = document.getElementById('definition');
const keyboardContainer = document.getElementById('keyboard');
const wrongGuessesDisplay = document.getElementById('wrongGuesses');
const maxGuessesDisplay = document.getElementById('maxGuesses');
const timerDisplay = document.getElementById('timer');
const chapterDropdownContainer = document.querySelector('.chapter-dropdown'); // Target the chapter dropdown container

let terms = [];
let definitions = [];
let currentWord = '';
let currentDefinition = '';
let guessedLetters = [];
let wrongGuesses = 0;
let maxWrongGuesses = 6;
let gameActive = false;
let timerInterval;
let secondsElapsed = 0;

const parts = [
    document.querySelector('.head'),
    document.querySelector('.body'),
    document.querySelector('.left-arm'),
    document.querySelector('.right-arm'),
    document.querySelector('.left-leg'),
    document.querySelector('.right-leg')
];

function resetTimer() {
    clearInterval(timerInterval);
    secondsElapsed = 0;
    updateTimerDisplay();
}

function startTimer() {
    timerInterval = setInterval(() => {
        secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
    const seconds = String(secondsElapsed % 60).padStart(2, '0');
    timerDisplay.textContent = `${minutes}:${seconds}`;
}

function resetGame() {
    guessedLetters = [];
    wrongGuesses = 0;
    wrongGuessesDisplay.innerText = wrongGuesses;
    wordDisplay.innerHTML = '';
    definitionDisplay.innerText = '';
    keyboardContainer.innerHTML = '';
    clearInterval(timerInterval);
    resetTimer();

    parts.forEach(part => part.classList.remove('show'));

    maxWrongGuesses = parseInt(difficultySelect.value);
    maxGuessesDisplay.innerText = maxWrongGuesses;
    gameActive = false;

    // Remove any existing ribbons
    document.querySelectorAll('.ribbon').forEach(ribbon => ribbon.remove());
}

function loadChapter(dataFile) {
    fetch(dataFile)
        .then(response => response.json())
        .then(data => {
            terms = data.terms;
            definitions = data.definitions;
            enableNewGame();
        });
}

function enableNewGame() {
    newGameButton.disabled = false;
    endGameButton.disabled = true; // Disable End Game initially
    hintText.style.display = 'none';
}

function startNewGame() {
    resetGame();

    if (!terms.length) {
        alert('Please select a chapter!');
        return;
    }

    disableDifficulty();
    resetTimer();
    startTimer();

    const index = Math.floor(Math.random() * terms.length);
    currentWord = terms[index].toUpperCase();
    currentDefinition = definitions[index];

    definitionDisplay.innerText = currentDefinition;
    displayWord();
    createKeyboard();
    gameActive = true;
    endGameButton.disabled = false; // Enable End Game when game starts
}

function endGame(revealAnswer = false) {
    clearInterval(timerInterval);
    enableDifficulty();
    gameActive = false;
    endGameButton.disabled = true;
    newGameButton.disabled = false;

    if (revealAnswer) {
        displayWord('lose'); // Show the full word with unguessed letters in dark red
    }
}

function disableDifficulty() {
    difficultySelect.disabled = true;
}

function enableDifficulty() {
    difficultySelect.disabled = false;
}

function displayWord(winLoseState = null) {
    wordDisplay.innerHTML = '';

    const words = currentWord.split(' ');

    words.forEach((word, wordIndex) => {
        const wordContainer = document.createElement('div');
        wordContainer.style.display = 'flex';
        wordContainer.style.gap = '10px';

        [...word].forEach(letter => {
            const letterElement = document.createElement('div');
            letterElement.classList.add('word-letter');

            if (guessedLetters.includes(letter)) {
                letterElement.innerText = letter;
                if (winLoseState === 'win') {
                    letterElement.classList.add('revealed-correct'); // Dark green on win
                }
            } else if (winLoseState) {
                letterElement.innerText = letter;
                if (winLoseState === 'lose') {
                    letterElement.classList.add('revealed-wrong'); // Dark red for unguessed on lose
                }
            }

            wordContainer.appendChild(letterElement);
        });

        wordDisplay.appendChild(wordContainer);

        if (wordIndex < words.length - 1) {
            const space = document.createElement('div');
            space.classList.add('word-space');
            wordDisplay.appendChild(space);
        }
    });
}

function createKeyboard() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    letters.split('').forEach(letter => {
        const btn = document.createElement('button');
        btn.innerText = letter;
        btn.addEventListener('click', () => handleGuess(letter, btn));
        keyboardContainer.appendChild(btn);
    });
}

function handleGuess(letter, button) {
    button.disabled = true;

    if (currentWord.includes(letter)) {
        guessedLetters.push(letter);
        button.classList.add('correct');
        flashScore('green');
        displayWord();

        const fullyGuessed = [...currentWord.replace(/ /g, '')].every(l => guessedLetters.includes(l));
        if (fullyGuessed) {
            flashScore('green');
            displayWord('win');
            showWinAnimation();
            clearInterval(timerInterval);
            setTimeout(() => {
                alert('🎉 You won!');
                endGame();
            }, 300);
        }
    } else {
        wrongGuesses++;
        wrongGuessesDisplay.innerText = wrongGuesses;
        button.classList.add('wrong');
        flashScore('red');

        const totalParts = parts.length;
        const step = totalParts / maxWrongGuesses;
        const partsToShow = Math.min(parts.length, Math.ceil(wrongGuesses * step));

        for (let i = 0; i < partsToShow; i++) {
            parts[i].classList.add('show');
        }

        if (wrongGuesses >= maxWrongGuesses) {
            finishHangman();
            displayWord('lose');
            clearInterval(timerInterval);
            setTimeout(() => {
                alert(`☠️ Game Over! The word was: ${currentWord}`);
                endGame();
            }, 300);
        }
    }
}

function finishHangman() {
    parts.forEach(part => part.classList.add('show'));
}

function flashScore(color) {
    const wrongScoreValue = document.getElementById('wrongGuesses');

    clearFlashes();

    if (color === 'green') {
        wrongScoreValue.classList.add('flash-green');
    } else if (color === 'red') {
        wrongScoreValue.classList.add('flash-red');
    }

    setTimeout(() => {
        clearFlashes();
    }, 500);
}

function clearFlashes() {
    const wrongScoreValue = document.getElementById('wrongGuesses');
    wrongScoreValue.classList.remove('flash-green', 'flash-red');
}

function showWinAnimation() {
    for (let i = 0; i < 10; i++) {
        const ribbon = document.createElement('div');
        ribbon.classList.add('ribbon');
        ribbon.style.left = `${Math.random() * 100}vw`;
        ribbon.style.top = `${Math.random() * 100}vh`;
        document.body.appendChild(ribbon);
        setTimeout(() => ribbon.remove(), 3000); // Remove after animation
    }
}

difficultySelect.addEventListener('change', () => {
    maxGuessesDisplay.innerText = difficultySelect.value;

    if (gameActive) {
        const confirmReset = confirm("Changing difficulty will reset the game. Continue?");
        if (confirmReset) {
            enableDifficulty();
            resetGame();
            disableDifficulty();
        }
    }
});

chapterSelect.addEventListener('change', () => {
    const selectedFile = chapterSelect.value;
    if (selectedFile) {
        loadChapter(selectedFile);
        enableDifficulty();
        resetGame();
        endGameButton.disabled = true;
    } else {
        newGameButton.disabled = true;
        hintText.style.display = 'block';
    }
});

newGameButton.addEventListener('click', () => {
    startNewGame();
});

endGameButton.addEventListener('click', () => {
    if (gameActive) {
        const confirmEnd = confirm("Are you sure you want to end the game?");
        if (confirmEnd) {
            endGame(true); // Pass true to reveal the answer
        }
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    let dataParam = params.get('data');

    if (dataParam) {
        if (!dataParam.endsWith('.json')) {
            dataParam += '.json';
        }
        if (!dataParam.startsWith('data/')) {
            dataParam = 'data/' + dataParam;
        }

        console.log('URL param detected:', dataParam); // Debug log
        chapterSelect.value = dataParam;
        loadChapter(dataParam);
        enableNewGame();
        chapterDropdownContainer.classList.add('hidden'); // Hide chapter dropdown
        console.log('Chapter dropdown hidden:', chapterDropdownContainer.classList); // Debug log
    } else {
        chapterDropdownContainer.classList.remove('hidden'); // Show chapter dropdown
        console.log('No URL param, showing chapter dropdown'); // Debug log
    }
});