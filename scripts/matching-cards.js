let gameData = null;
let selectedTerm = null;
let selectedDefinition = null;

let score = 0;
let moves = 0;
let matchedPairs = 0;
let totalPairs = 0;

let timerInterval;
let elapsedSeconds = 0;

function $(id) {
    return document.getElementById(id);
}

function updateScoreboard() {
    $('score').innerText = score;
    $('moves').innerText = moves;
    $('matched').innerText = matchedPairs;
    $('remaining').innerText = totalPairs - matchedPairs;

    const progress = matchedPairs / totalPairs * 100;
    $('progressBar').value = progress;
}

function startTimer() {
    elapsedSeconds = 0;
    $('timer').innerText = '00:00';

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
        const secs = String(elapsedSeconds % 60).padStart(2, '0');
        $('timer').innerText = `${mins}:${secs}`;
    }, 1000);
}

function flashScore(color) {
    const scoreBlock = $('scoreBlock');
    const flashClass = color === 'green' ? 'flash-green' : 'flash-red';
    scoreBlock.classList.add(flashClass);
    setTimeout(() => {
        scoreBlock.classList.remove(flashClass);
    }, 500);
}

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function renderCards(terms, definitions) {
    $('termsContainer').innerHTML = '';
    $('definitionsContainer').innerHTML = '';
    $('matchedPairsContainer').innerHTML = '';

    terms.forEach((term, index) => {
        const div = document.createElement('div');
        div.className = 'card term';
        div.innerText = term;
        div.dataset.index = index;
        div.addEventListener('click', () => handleCardClick('term', div));
        div.addEventListener('mouseover', () => handleHover(div, 'term'));
        $('termsContainer').appendChild(div);
    });

    definitions.forEach((definition, index) => {
        const div = document.createElement('div');
        div.className = 'card definition';
        div.innerText = definition;
        div.dataset.index = index;
        div.addEventListener('click', () => handleCardClick('definition', div));
        div.addEventListener('mouseover', () => handleHover(div, 'definition'));
        $('definitionsContainer').appendChild(div);
    });
}

function handleHover(card, type) {
    if ((selectedTerm && type === 'term' && selectedTerm !== card) ||
        (selectedDefinition && type === 'definition' && selectedDefinition !== card)) {
        card.classList.add('not-allowed');
    } else {
        card.classList.remove('not-allowed');
    }
}

function handleCardClick(type, card) {
    if (card.classList.contains('not-allowed')) return;

    if (type === 'term') {
        if (selectedTerm === card) {
            deselect(card);
            selectedTerm = null;
            return;
        }
        deselect(selectedTerm);
        select(card);
        selectedTerm = card;

    } else if (type === 'definition') {
        if (selectedDefinition === card) {
            deselect(card);
            selectedDefinition = null;
            return;
        }
        deselect(selectedDefinition);
        select(card);
        selectedDefinition = card;
    }

    if (selectedTerm && selectedDefinition) {
        moves++;
        if (selectedTerm.dataset.index === selectedDefinition.dataset.index) {
            score += 10;
            matchedPairs++;
            flashScore('green');
            addMatchedPair(selectedTerm.innerText, selectedDefinition.innerText);
            selectedTerm.remove();
            selectedDefinition.remove();
        } else {
            score -= 2;
            flashScore('red');
        }

        deselect(selectedTerm);
        deselect(selectedDefinition);
        selectedTerm = selectedDefinition = null;

        updateScoreboard();

        if (matchedPairs === totalPairs) {
            clearInterval(timerInterval);
            alert('Congratulations! You matched all pairs.');
        }
    }
}

function select(card) {
    if (!card) return;
    card.classList.add('selected');
}

function deselect(card) {
    if (!card) return;
    card.classList.remove('selected');
}

function addMatchedPair(term, definition) {
    const div = document.createElement('div');
    div.className = 'matched-pair';
    div.innerHTML = `<h3>${term}</h3><p>${definition}</p>`;
    $('matchedPairsContainer').appendChild(div);
}

function loadGame(dataFile, numberOfCards = null) {
    fetch(dataFile)
        .then(response => response.json())
        .then(data => {
            gameData = data;
            totalPairs = data.terms.length;

            if (numberOfCards && numberOfCards < totalPairs) {
                totalPairs = numberOfCards;
                gameData.terms = data.terms.slice(0, numberOfCards);
                gameData.definitions = data.definitions.slice(0, numberOfCards);
            }

            score = 0;
            moves = 0;
            matchedPairs = 0;

            updateScoreboard();
            renderCards(shuffle([...gameData.terms]), shuffle([...gameData.definitions]));
            startTimer();
        });
}

$('newGameButton').addEventListener('click', () => {
    const chapterFile = $('chapter').value;
    const urlParams = new URLSearchParams(window.location.search);
    const cardsNum = urlParams.get('cards');

    if (chapterFile) {
        loadGame(chapterFile, cardsNum ? parseInt(cardsNum) : null);
    } else {
        alert('Please select a chapter first.');
    }
});

$('chapter').addEventListener('change', () => {
    const selected = $('chapter').value;
    if (selected) {
        const urlParams = new URLSearchParams(window.location.search);
        const cardsNum = urlParams.get('cards');

        loadGame(selected, cardsNum ? parseInt(cardsNum) : null);
    }
});

window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    let dataParam = params.get('data');
    const cardsNum = params.get('cards');

    if (dataParam) {
        // ✅ Append ".json" if it's missing
        if (!dataParam.endsWith('.json')) {
            dataParam += '.json';
        }

        // ✅ Prepend "data/" if not already included
        if (!dataParam.startsWith('data/')) {
            dataParam = 'data/' + dataParam;
        }

        // ✅ Select the dropdown item if it exists
        $('chapter').value = dataParam;

        loadGame(dataParam, cardsNum ? parseInt(cardsNum) : null);
    }
});
