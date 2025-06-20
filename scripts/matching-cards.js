/* matching-cards.js (Adapted for SPA with IIFE) */

(function() { // START OF IIFE
    'use strict';

    // ===== Log Access to Global Config =====
    // Verify that the global variables set by spa-loader.js are accessible
    console.log(`Matching Cards IIFE executing.`);
    console.log(` - Using global DATA_PATH: ${window.DATA_PATH || 'Not Found!'}`);
    console.log(` - Using global DEFAULT_COURSE: ${window.DEFAULT_COURSE || 'Not Found!'}`);
    console.log(` - Using global allowedCourses: ${window.allowedCourses ? window.allowedCourses.join(', ') : 'Not Found!'}`);

    // ===== LOCAL Constants & Variable Declarations =====
    // Variables declared here are scoped to this IIFE execution

    // Determine course for this instance, using global config and params
    const course = (window.gameParams && window.gameParams.course && window.allowedCourses && window.allowedCourses.includes(window.gameParams.course.toLowerCase()))
                   ? window.gameParams.course.toLowerCase()
                   : window.DEFAULT_COURSE; // Use global default if params invalid/missing
    console.log("Matching Cards initializing with course:", course);

    // Determine max cards from URL params (?cards=N), default to a high number (effectively 'max') if not specified or invalid
    const requestedCardsParam = window.gameParams ? parseInt(window.gameParams.cards, 10) : NaN;
    const maxPairs = (!isNaN(requestedCardsParam) && requestedCardsParam > 0) ? requestedCardsParam : 999; // Use 999 as practical 'max'
    console.log(`Matching Cards requested pairs: ${maxPairs === 999 ? 'Max' : maxPairs}`);


    // DOM References (will be assigned in getDOMReferences)
    let newGameButton, chapterSelect, selectWrapper, termsContainer, definitionsContainer,
        matchedPairsContainer, scoreDisplay, movesDisplay, matchedDisplay, remainingDisplay,
        progressBar, timerDisplay, scoreBlock, chapterSelectionArea, endGameButton, soundToggle;

    // Game State (local to this IIFE)
    let courseData = null; // Holds the loaded JSON data for the course
    let currentChapterPairs = []; // Store { term: '...', definition: '...', id: '...' } pairs for the current game
    let allCards = []; // References to all card DOM elements created
    let selectedTermCard = null; // Reference to the currently selected term card element
    let selectedDefinitionCard = null; // Reference to the currently selected definition card element
    let matchedPairsCount = 0; // Count of successfully matched pairs
    let totalPairs = 0; // Total number of pairs in the current game round
    let movesCount = 0; // Count of attempted matches (clicks on pairs)
    let currentScore = 0;
    let timerInterval = null; // Stores the interval ID for the game timer
    let secondsElapsed = 0; // Tracks elapsed time for the current game
    let gameActive = false; // Flag indicating if a game is currently in progress and accepting input
    let interactionAllowed = true; // Flag to temporarily disable clicks during animations/checks

    // Sound Manager for all game sounds
    const soundManager = {
        sounds: {
            correct: new Audio('assets/sfx/confirm-soft.mp3'),
            wrong: new Audio('assets/sfx/wrong-buzz.mp3'),
            newGame: new Audio('assets/sfx/game-start.mp3'),
            win: new Audio('assets/sfx/success-chime.mp3')
        },
        isEnabled: true,
        init: function() {
            // Load saved sound preference from localStorage
            const savedSoundState = localStorage.getItem('matchingCardsSoundEnabled');
            this.isEnabled = savedSoundState === null ? true : savedSoundState === 'true';
            
            // Set initial checkbox state
            const soundToggle = document.getElementById('soundToggle');
            if (soundToggle) {
                soundToggle.checked = this.isEnabled;
                soundToggle.addEventListener('change', (e) => {
                    this.isEnabled = e.target.checked;
                    localStorage.setItem('matchingCardsSoundEnabled', this.isEnabled);
                });
            }
        },
        play: function(soundName) {
            if (this.sounds[soundName] && this.isEnabled) {
                this.sounds[soundName].currentTime = 0; // Reset to start
                this.sounds[soundName].play().catch(error => {
                    console.warn(`Failed to play sound ${soundName}:`, error);
                });
            }
        }
    };

    // ===== Function Definitions =====

    /**
     * Finds and assigns references to essential DOM elements.
     * Logs errors if critical elements are not found.
     * @returns {boolean} - True if all critical elements were found, false otherwise.
     */
    function getDOMReferences() {
        console.log("Matching Cards: Getting DOM references...");
        let criticalElementsFound = true;

        newGameButton = document.getElementById('newGameButton');
        selectWrapper = document.getElementById('select-wrapper');
        termsContainer = document.getElementById('termsContainer');
        definitionsContainer = document.getElementById('definitionsContainer');
        matchedPairsContainer = document.getElementById('matchedPairsContainer'); // Optional area
        scoreDisplay = document.getElementById('score');
        movesDisplay = document.getElementById('moves');
        matchedDisplay = document.getElementById('matched');
        remainingDisplay = document.getElementById('remaining');
        progressBar = document.getElementById('progressBar');
        timerDisplay = document.getElementById('timer');
        scoreBlock = document.getElementById('scoreBlock'); // Container for score for flashing effect
        chapterSelectionArea = document.getElementById('chapter-selection-area');
        endGameButton = document.getElementById('endGameButton');
        soundToggle = document.getElementById('soundToggle');
        // chapterSelect will be found later inside selectWrapper

        // Check critical elements
        if (!newGameButton) { console.error("Matching Cards: #newGameButton NOT FOUND!"); criticalElementsFound = false; }
        if (!selectWrapper) { console.error("Matching Cards: #select-wrapper NOT FOUND!"); criticalElementsFound = false; }
        if (!termsContainer) { console.error("Matching Cards: #termsContainer NOT FOUND!"); criticalElementsFound = false; }
        if (!definitionsContainer) { console.error("Matching Cards: #definitionsContainer NOT FOUND!"); criticalElementsFound = false; }
        if (!scoreDisplay || !movesDisplay || !matchedDisplay || !remainingDisplay) { console.warn("Matching Cards: One or more scoreboard elements missing."); }
        if (!progressBar) { console.warn("Matching Cards: Progress bar missing."); }
        if (!timerDisplay) { console.warn("Matching Cards: Timer display missing."); }
        if (!scoreBlock) { console.warn("Matching Cards: Score block for flashing missing."); }
        if (!chapterSelectionArea) { console.warn("Matching Cards: Chapter selection area missing."); }
        if (!endGameButton) { console.warn("Matching Cards: End Game button missing."); }
        if (!soundToggle) { console.warn("Matching Cards: Sound toggle missing."); }
        // matchedPairsContainer is optional

        // Initialize sound manager after getting DOM references
        soundManager.init();

        console.log(`Matching Cards: DOM references obtained. Critical elements found: ${criticalElementsFound}`);
        return criticalElementsFound;
    }

    /** Clears any existing timer interval and resets elapsed time. */
    function resetTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        secondsElapsed = 0;
        updateTimerDisplay(); // Set display to 00:00
    }

    /** Starts the game timer, updating every second. */
    function startTimer() {
        resetTimer(); // Ensure no previous timer is running
        gameActive = true; // Mark game as active
        interactionAllowed = true; // Ensure interactions are allowed at start
        console.log("Matching Cards: Timer started.");
        timerInterval = setInterval(() => {
             if (!gameActive) { // Safety check
                 console.warn("Matching Cards: Timer interval detected inactive game, stopping timer.");
                 clearInterval(timerInterval);
                 timerInterval = null;
                 return;
            }
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }

    /** Stops the game timer and marks the game as inactive. */
    function stopTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log("Matching Cards: Timer stopped.");
        }
        gameActive = false; // Mark game as inactive
        interactionAllowed = false; // Prevent clicks after game ends
    }

    /** Updates the timer display element (e.g., "01:23"). */
    function updateTimerDisplay() {
        if (!timerDisplay) return;
        const minutes = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const seconds = String(secondsElapsed % 60).padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${seconds}`;
    }

    /** Updates all scoreboard display elements (score, moves, matched, remaining, progress bar). */
    function updateScoreboard() {
        if (scoreDisplay) scoreDisplay.textContent = currentScore;
        if (movesDisplay) movesDisplay.textContent = movesCount;
        if (matchedDisplay) matchedDisplay.textContent = matchedPairsCount;
        if (remainingDisplay) remainingDisplay.textContent = Math.max(0, totalPairs - matchedPairsCount); // Ensure not negative
        if (progressBar) {
            progressBar.value = totalPairs > 0 ? (matchedPairsCount / totalPairs) * 100 : 0;
        }
    }

    /** Adds a temporary flashing background color to the score block. */
    function flashScore(type) { // 'correct' or 'incorrect'
        if (!scoreBlock) return;
        const className = type === 'correct' ? 'flash-green' : 'flash-red';
        scoreBlock.classList.add(className);
        // Remove the class after the animation duration (e.g., 500ms)
        setTimeout(() => {
            scoreBlock.classList.remove(className);
        }, 500);
    }

    /**
     * Fetches course data JSON, populates the chapter dropdown,
     * and handles pre-selection based on URL parameters.
     */
    function loadCourseDataAndMenu() {
        if (!selectWrapper) {
            console.error("Matching Cards: Cannot load chapters - #select-wrapper missing.");
            // Optionally display error in UI
            return;
        }

        const courseDataFile = `${course}.json`;
         if (!window.DATA_PATH) {
             console.error("Matching Cards: Global window.DATA_PATH is not defined!");
             if(selectWrapper) selectWrapper.innerHTML = '<p style="color:red;">Error: Config missing.</p>';
             return;
        }
        const courseDataPath = `${window.DATA_PATH}${courseDataFile}`;

        // Update titles
        const h1Title = document.querySelector('#content-area h1');
        if (h1Title) h1Title.textContent = `Matching Cards (${course.toUpperCase()})`;
        document.title = `Matching Cards (${course.toUpperCase()})`;

        // Show loading state
        selectWrapper.innerHTML = '<p>Loading chapters...</p>';
        resetGame(); // Reset game state and UI elements to initial defaults

        console.log(`Matching Cards: Fetching course data from: ${courseDataPath}`);
        fetch(courseDataPath)
            .then(response => {
                if (!response.ok) throw new Error(`Data file not found or invalid: ${response.statusText} (${response.status})`);
                return response.json();
            })
            .then(data => {
                courseData = data; // Store locally
                console.log("Matching Cards: Course data loaded.");
                if (!courseData || !Array.isArray(courseData.chapters) || courseData.chapters.length === 0) {
                    throw new Error('Invalid or empty course data structure in JSON file.');
                }

                // Build dropdown HTML
                let selectHTML = `<select id="chapterSelect"><option value="">-- Select Chapter --</option>`;
                courseData.chapters.forEach(chapter => {
                     const chapterRef = chapter.chapter_ref || `Ch ${chapter.chapter_id || '??'}`;
                     const chapterTitle = chapter.chapter_title || 'Untitled Chapter';
                     const chapterId = chapter.chapter_id;
                      if (!chapterId) {
                          console.warn("Skipping chapter due to missing chapter_id:", chapter);
                          return;
                      }
                     const displayText = `${chapterRef}: ${chapterTitle}`;
                    selectHTML += `<option value="${chapterId}">${displayText}</option>`;
                });
                selectHTML += `</select>`;
                selectWrapper.innerHTML = selectHTML; // Inject dropdown

                // Get reference and attach listener
                chapterSelect = document.getElementById('chapterSelect');
                if (!chapterSelect) throw new Error("Failed to find #chapterSelect after injection.");
                setupChapterDropdownListener();

                // Don't display chapter selection prompt here, resetGame handles initial state

                // Pre-select chapter from URL if valid
                const chapterIdFromParams = window.gameParams ? window.gameParams.chapter : null;
								if (chapterIdFromParams) {
										const chapterExists = courseData.chapters.some(ch => ch.chapter_id === chapterIdFromParams);
										if (chapterExists) {
												console.log(`Matching Cards: Pre-selecting chapter from URL: ${chapterIdFromParams}`);
												chapterSelect.value = chapterIdFromParams;
												loadChapter(chapterIdFromParams); // Load chapter data but don't start game yet
												
												// Hide chapter selection area as required when preselected from URL
												if (chapterSelectionArea) {
														chapterSelectionArea.style.display = 'none'; // Hide selector on all devices
												}
										} else {
												console.warn(`Matching Cards: Chapter ID "${chapterIdFromParams}" from URL not found.`);
												resetGame(); // Reset UI, keep prompt visible
										}
								}
						})
            .catch(error => {
                console.error('Matching Cards: Error loading or processing course data:', error);
                selectWrapper.innerHTML = `<p style="color:red;">Error loading chapters!</p>`;
                courseData = null;
                resetGame();
            });
    }

    /** Resets the game state and UI elements to their initial default. */
    function resetGame() {
        console.log("Matching Cards: Resetting game state and UI...");
        // Reset game state variables
        stopTimer(); // Stops timer and sets gameActive = false, interactionAllowed = false
        currentScore = 0;
        movesCount = 0;
        matchedPairsCount = 0;
        totalPairs = 0;
        currentChapterPairs = [];
        allCards = [];
        selectedTermCard = null;
        selectedDefinitionCard = null;
        // interactionAllowed = false; // Keep false until game starts

        // Reset UI elements
        if (termsContainer) termsContainer.innerHTML = '';
        if (definitionsContainer) definitionsContainer.innerHTML = '';
        if (matchedPairsContainer) matchedPairsContainer.innerHTML = ''; // Clear matched area if used
        updateScoreboard(); // Update displays to 0/defaults (incl. progress bar)

        // Reset button states
        if (newGameButton) newGameButton.disabled = true; // Disable until a chapter with terms is loaded
        if (endGameButton) endGameButton.disabled = true; // Always disable End Game button on reset

        // Ensure chapter selection prompt is appropriate
        if (selectWrapper && !chapterSelect) { // If dropdown hasn't been built yet
             selectWrapper.innerHTML = '<p>Select a chapter to begin.</p>';
        } else if (chapterSelect && !chapterSelect.value) { // If dropdown exists but no selection
             // Maybe add a hint message element instead of modifying selectWrapper
        }

        console.log("Matching Cards: Game reset complete.");
    }

    /**
     * Loads term/definition data for the selected chapter. Does NOT start the game.
     * @param {string} chapterId - The ID of the chapter to load.
     */
    function loadChapter(chapterId) {
        resetGame(); // Start fresh, resets UI and state vars

        if (!chapterId) {
            console.warn("Matching Cards: loadChapter called with no chapterId.");
            // UI is already reset, prompt should be visible
            if (newGameButton) newGameButton.disabled = true;
            return;
        }
        if (!courseData) {
            console.error("Matching Cards: Cannot load chapter - course data not available.");
            if (selectWrapper) selectWrapper.innerHTML = '<p style="color:red;">Error: Data unavailable.</p>';
            return;
        }

        console.log(`Matching Cards: Loading chapter ID: ${chapterId}`);
        const chapter = courseData.chapters.find(ch => ch.chapter_id === chapterId);

        if (!chapter || !Array.isArray(chapter.term_definitions)) {
            console.error(`Matching Cards: Chapter data invalid or not found for ID: ${chapterId}`);
            if (selectWrapper) selectWrapper.innerHTML = '<p style="color:red;">Error loading chapter.</p>';
            if (newGameButton) newGameButton.disabled = true;
            return;
        }

        // Filter for valid pairs and add a unique ID for matching
        let validPairs = chapter.term_definitions
            .filter(td => td && typeof td.term === 'string' && td.term.trim() && typeof td.definition === 'string' && td.definition.trim())
            .map((td, index) => ({
                term: td.term.trim(),
                definition: td.definition.trim(),
                id: `pair-${chapterId}-${index}` // Unique ID per pair within chapter
             }));

        // Shuffle the valid pairs
        validPairs = shuffleArray(validPairs);
        // Slice according to the maxPairs requested (maxPairs = 999 means take all)
        currentChapterPairs = validPairs.slice(0, maxPairs);
        totalPairs = currentChapterPairs.length;

        if (totalPairs === 0) {
            console.warn(`Matching Cards: No valid terms found (or requested 0) in chapter ${chapterId}.`);
            if(termsContainer) termsContainer.innerHTML = '<p>No terms available for this chapter.</p>';
            if (newGameButton) newGameButton.disabled = true; // Cannot start game
        } else {
            console.log(`Matching Cards: Prepared ${totalPairs} pairs for chapter ${chapterId}. Ready to start.`);
            if (newGameButton) newGameButton.disabled = false; // Enable "New Game" button
            if(termsContainer) termsContainer.innerHTML = '<p>Click "New Game" to begin!</p>'; // Prompt
        }

        updateScoreboard(); // Update remaining/total counts etc.
    }

    /** Sets up and starts a new game round with the currently loaded chapter pairs. */
    function startGame() {
        if (currentChapterPairs.length === 0) {
            console.warn("Matching Cards: Cannot start game, no pairs loaded/available.");
            return;
        }
        if (gameActive) {
             console.warn("Matching Cards: Cannot start new game, one is already active.");
             return;
        }

        console.log("Matching Cards: Starting new game round...");
        // Reset only the state needed for a new round, keep loaded pairs
        stopTimer(); // Ensure timer is stopped, sets gameActive=false
        currentScore = 0;
        movesCount = 0;
        matchedPairsCount = 0;
        selectedTermCard = null;
        selectedDefinitionCard = null;

        // Enable End Game button since game is starting
        if (endGameButton) endGameButton.disabled = false;

        // Clear containers
        if (termsContainer) termsContainer.innerHTML = '';
        if (definitionsContainer) definitionsContainer.innerHTML = '';
        if (matchedPairsContainer) matchedPairsContainer.innerHTML = '';

        // Create separate shuffled lists for terms and definitions
        const terms = shuffleArray(currentChapterPairs.map(p => ({ text: p.term, pairId: p.id })));
        const definitions = shuffleArray(currentChapterPairs.map(p => ({ text: p.definition, pairId: p.id })));

        // Create and display card elements
        terms.forEach(termData => createCard('term', termData.text, termData.pairId));
        definitions.forEach(defData => createCard('definition', defData.text, defData.pairId));

        startTimer(); // Start the clock, sets gameActive = true, interactionAllowed = true
        updateScoreboard(); // Update displays for the start of the game
        if (newGameButton) newGameButton.disabled = true; // Disable "New Game" while game is active
        console.log("Matching Cards: Game setup complete and timer started.");

        soundManager.play('win');
    }

    /** Creates a single card DOM element and adds it to the appropriate container. */
    function createCard(type, text, pairId) {
        const card = document.createElement('div');
        card.classList.add('card', type); // Add 'card' and 'term'/'definition' classes
        card.textContent = text;
        card.dataset.pairId = pairId; // Store the unique pair ID for matching logic
        card.addEventListener('click', handleCardClick); // Add click listener

        // Append to the correct container
        const container = (type === 'term') ? termsContainer : definitionsContainer;
        if (container) {
            container.appendChild(card);
            allCards.push(card); // Keep track of all card elements for potential cleanup/reset
        } else {
            console.error(`Matching Cards: Container for card type '${type}' not found!`);
        }
    }

    /** Handles clicks on term or definition cards. */
    function handleCardClick(event) {
        // Ignore clicks if interaction is temporarily blocked or game isn't active
        if (!interactionAllowed || !gameActive) {
            return;
        }

        const clickedCard = event.currentTarget;

        // Ignore clicks if card not found, already matched, or already selected
        if (!clickedCard || clickedCard.classList.contains('matched') || clickedCard.classList.contains('selected')) {
            return;
        }

        const cardType = clickedCard.classList.contains('term') ? 'term' : 'definition';

        // --- Selection Logic ---
        clickedCard.classList.add('selected'); // Highlight the clicked card

        if (cardType === 'term') {
            // If another term was already selected, deselect it first
            if (selectedTermCard && selectedTermCard !== clickedCard) {
                selectedTermCard.classList.remove('selected');
            }
            selectedTermCard = clickedCard; // Store reference to the selected term card
        } else { // cardType is 'definition'
            // If another definition was already selected, deselect it first
            if (selectedDefinitionCard && selectedDefinitionCard !== clickedCard) {
                selectedDefinitionCard.classList.remove('selected');
            }
            selectedDefinitionCard = clickedCard; // Store reference
        }

        // --- Check for Match ---
        // Only proceed if one of each type has been selected
        if (selectedTermCard && selectedDefinitionCard) {
            interactionAllowed = false; // Block further clicks during check/animation
            movesCount++; // Increment move counter
            console.log(`Checking match: Term PairID=${selectedTermCard.dataset.pairId} vs Def PairID=${selectedDefinitionCard.dataset.pairId}`);

            const termCardToProcess = selectedTermCard; // Capture references before resetting
            const defCardToProcess = selectedDefinitionCard;

            // Reset selection state immediately for next turn (variables, not visuals yet)
            selectedTermCard = null;
            selectedDefinitionCard = null;

            if (termCardToProcess.dataset.pairId === defCardToProcess.dataset.pairId) {
                // --- Match Found ---
                soundManager.play('correct');
                console.log("Match FOUND!");
                currentScore += 10;
                flashScore('correct'); // Visual feedback on score
                matchedPairsCount++; // Increment matched pairs counter

                // Apply 'matched' style and move to matched pairs area
                setTimeout(() => {
                    termCardToProcess.classList.add('matched');
                    defCardToProcess.classList.add('matched');
                    termCardToProcess.classList.remove('selected');
                    defCardToProcess.classList.remove('selected');

                    // Move matched pair to the matched pairs container
                    addToMatchedAreaDisplay(termCardToProcess.textContent, defCardToProcess.textContent);

                    // Remove the original cards
                    termCardToProcess.remove();
                    defCardToProcess.remove();

                    interactionAllowed = true; // Re-allow clicks
                    updateScoreboard(); // Update score display
                    checkWinCondition(); // Check if game is won
                }, 500); // Delay for visual feedback

            } else {
                // --- No Match ---
                soundManager.play('wrong');
                console.log("Match FAILED!");
                currentScore = Math.max(0, currentScore - 2); // Penalize, score cannot go below 0
                flashScore('incorrect'); // Visual feedback on score

                // Add shake animation for visual feedback
                termCardToProcess.classList.add('shake');
                defCardToProcess.classList.add('shake');

                // Remove 'selected' and 'shake' styles after a longer delay
                setTimeout(() => {
                    termCardToProcess.classList.remove('selected', 'shake');
                    defCardToProcess.classList.remove('selected', 'shake');
                    interactionAllowed = true; // Re-allow clicks
                    updateScoreboard(); // Update score display
                }, 1000); // Longer delay for mismatch feedback
            }
        }
    }

    /** Adds a matched pair to the matched pairs display area. */
    function addToMatchedAreaDisplay(term, definition) {
        if (!matchedPairsContainer) return;

        const pairDiv = document.createElement('div');
        pairDiv.classList.add('matched-pair');

        const termH3 = document.createElement('h3');
        termH3.textContent = term;
        const defP = document.createElement('p');
        defP.textContent = definition;

        pairDiv.appendChild(termH3);
        pairDiv.appendChild(defP);
        matchedPairsContainer.prepend(pairDiv);
    }

    /** Checks if all pairs have been matched and ends the game if so. */
    function checkWinCondition() {
        if (matchedPairsCount === totalPairs) {
            soundManager.play('win');
            console.log("Matching Cards: All pairs matched! Player WINS!");
            stopTimer(); // Stop the clock, sets gameActive = false

             // Provide clear win feedback
             // Example: Use the timer display area or create a modal/overlay
             if(timerDisplay) { // Re-purpose timer display for win message
                 timerDisplay.textContent = `WIN! ${formatTime(secondsElapsed)}`;
                 timerDisplay.style.color = 'green'; // Example styling
                 timerDisplay.style.fontWeight = 'bold';
             }
             // Could also add text like "Final Score: XX" to score display
             if (scoreDisplay) scoreDisplay.textContent = `${currentScore} 🎉`;


             if(newGameButton) newGameButton.disabled = false; // Allow starting a new game
             // Could trigger a confetti animation or other celebration
        }
    }

    /** Ends the current game by matching all remaining cards. */
    function endGame() {
        if (!gameActive) return;

        // Reset scoreboard
        currentScore = 0;
        movesCount = 0;
        updateScoreboard();

        // Get all unmatched cards
        const unmatchedCards = Array.from(document.querySelectorAll('.card:not(.matched)'));
        
        // Group cards by pair ID
        const cardsByPair = {};
        unmatchedCards.forEach(card => {
            const pairId = card.dataset.pairId;
            if (!cardsByPair[pairId]) {
                cardsByPair[pairId] = [];
            }
            cardsByPair[pairId].push(card);
        });

        // Match and move all remaining pairs
        Object.values(cardsByPair).forEach(pair => {
            if (pair.length === 2) {
                const [termCard, defCard] = pair;
                
                // Add matched class and move to matched area
                termCard.classList.add('matched');
                defCard.classList.add('matched');
                
                // Move to matched pairs container
                addToMatchedAreaDisplay(termCard.textContent, defCard.textContent);
                
                // Remove original cards
                termCard.remove();
                defCard.remove();
            }
        });

        // Play win sound
        soundManager.play('win');
        
        // End the game
        gameActive = false;
        interactionAllowed = false;
        stopTimer();
        
        // Update matched pairs count
        matchedPairsCount = totalPairs;
        updateScoreboard();
    }

    // ===== Event Listeners Setup =====

    /** Sets up initial event listeners for buttons and controls. */
    function setupEventListeners() {
        console.log("Matching Cards: Setting up event listeners...");
        if (!newGameButton) {
            console.error("Matching Cards: New Game button not found for listener setup.");
            return; // Cannot attach listener
        }

        // Prevent duplicate listeners if initialization happens multiple times (unlikely with IIFE)
        if (!newGameButton.dataset.listener) {
            newGameButton.addEventListener('click', startGame);
            newGameButton.dataset.listener = 'true';
        }

        // Add end game button listener
        if (endGameButton && !endGameButton.dataset.listener) {
            endGameButton.addEventListener('click', endGame);
            endGameButton.dataset.listener = 'true';
        }

        console.log("Matching Cards: Event listeners setup complete.");
        // Chapter dropdown listener setup happens after dropdown is created
    }

    /** Attaches the event listener specifically to the chapter dropdown. */
     function setupChapterDropdownListener() {
         if (!chapterSelect) {
             console.error("Matching Cards: Cannot setup listener: chapterSelect is null/not found.");
             chapterSelect = document.getElementById('chapterSelect'); // Try finding again
             if (!chapterSelect) {
                 console.error("Matching Cards: Still cannot find chapterSelect. Listener NOT attached.");
                 return; // Give up
             }
         }
         // Attach the listener
         chapterSelect.addEventListener('change', handleChapterChange);
         console.log("Matching Cards: Chapter dropdown listener attached.");
    }

    // --- Event Handler Functions ---

    /** Handles changes in the chapter selection dropdown. */
    function handleChapterChange() {
        if (!chapterSelect) return;
        const selectedChapterId = chapterSelect.value;
        console.log(`Chapter selection changed to: ${selectedChapterId || 'None'}`);
        // If a game is active, stop it before loading new chapter
        if (gameActive) {
             console.warn("Matching Cards: Chapter changed mid-game. Stopping current game.");
             stopTimer(); // Stop timer and mark inactive
             // Optionally confirm with user?
        }
        // Load the selected chapter's data (this also calls resetGame)
        loadChapter(selectedChapterId);
    }

    // ===== Utility Functions =====

    /** Shuffles an array in place using the Fisher-Yates algorithm. */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]; // Swap elements
        }
        return array;
    }

    /** Formats seconds into MM:SS format */
    function formatTime(totalSeconds) {
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    // ===== Game Initialization Function =====
    /** Main function to initialize the Matching Cards game setup. */
    function initializeMatchingGame() {
        console.log("Matching Cards: Initializing game inside IIFE...");

        // 1. Get DOM References and check if critical ones exist
        if (!getDOMReferences()) {
            console.error("Matching Cards: Initialization aborted due to missing critical DOM elements.");
            // Display error message in UI if possible
             if(document.body) {
                 const errorMsg = document.createElement('p');
                 errorMsg.textContent = "Error: Failed to initialize Matching Cards game UI. Check console.";
                 errorMsg.style.color = 'red'; errorMsg.style.textAlign = 'center'; errorMsg.style.padding = '20px';
                 const contentArea = document.getElementById('content-area');
                 if (contentArea) contentArea.prepend(errorMsg); else document.body.prepend(errorMsg);
            }
            return; // Stop initialization
        }

        // 2. Setup Event Listeners for buttons (dropdown listener set after load)
        console.log("Matching Cards: Setting up base event listeners.");
        setupEventListeners();

        // 3. Load Course Data and Populate Chapter Dropdown (async)
        console.log("Matching Cards: Initiating course data load.");
        loadCourseDataAndMenu();

        // 4. Set Initial UI State (mostly done via resetGame called in loadCourseDataAndMenu)
        console.log("Matching Cards: Applying initial UI state via resetGame.");
        resetGame(); // Ensure clean state initially

        console.log("Matching Cards: Initialization sequence complete.");
    }

    // ===== Cleanup Function =====
    /** Cleans up resources used by the Hangman game (timers, listeners). */
    function cleanupMatchingCards() {
        console.log("Hangman: Cleaning up...");
        // 1. Stop Timers
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log("Hangman: Timer cleared.");
        }
        gameActive = false; // Ensure game is marked inactive

        // 2. Remove Event Listeners (Optional but good practice for complex cases)
        // If you attached listeners to 'document' or 'window', remove them here.
        // Listeners on elements *within* #content-area are usually removed automatically
        // when innerHTML is replaced, but explicit removal is safest.
        // newGameButton?.removeEventListener('click', startNewGame); // Requires button ref to still be valid
        // chapterSelect?.removeEventListener('change', handleChapterChange);
        // difficultySelect?.removeEventListener('change', handleDifficultyChange);
        // endGameButton?.removeEventListener('click', handleEndGameClick);
        // Consider using AbortController for fetch/listeners if needed.

        // 3. Null out references (helps garbage collection, optional)
        courseData = null; terms = []; definitions = []; guessedLetters = []; partsElements = [];
        difficultySelect = null; newGameButton = null; endGameButton = null; hintText = null;
        wordDisplay = null; definitionDisplay = null; keyboardContainer = null; wrongGuessesDisplay = null;
        maxGuessesDisplay = null; timerDisplay = null; selectWrapper = null; chapterSelect = null;
        matchingCardSVG = null;
        console.log("Hangman: Cleanup complete.");
    }

    // ===== Assign cleanup function to global scope =====
    window.currentGameCleanup = cleanupMatchingCards;

    // ===== Start Initialization =====
		initializeMatchingGame();

})(); // END OF IIFE