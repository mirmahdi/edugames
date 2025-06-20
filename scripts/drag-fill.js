/* drag-fill.js (Adapted for SPA with IIFE) */

(function() { // START OF IIFE
    'use strict';

    // ===== Log Access to Global Config =====
    // Verify that the global variables set by spa-loader.js are accessible
    console.log(`Drag-Fill IIFE executing.`);
    console.log(` - Using global DATA_PATH: ${window.DATA_PATH || 'Not Found!'}`);
    console.log(` - Using global DEFAULT_COURSE: ${window.DEFAULT_COURSE || 'Not Found!'}`);
    console.log(` - Using global allowedCourses: ${window.allowedCourses ? window.allowedCourses.join(', ') : 'Not Found!'}`);

    // ===== LOCAL Constants & Variable Declarations =====
    // Variables declared here are scoped to this IIFE execution

    // Determine course for this instance, using global config and params
    const course = (window.gameParams && window.gameParams.course && window.allowedCourses && window.allowedCourses.includes(window.gameParams.course.toLowerCase()))
                   ? window.gameParams.course.toLowerCase()
                   : window.DEFAULT_COURSE; // Use global default if params invalid/missing
    console.log("Drag-Fill initializing with course:", course);

    // DOM References (will be assigned in getDOMReferences)
    let chapterSelect, selectWrapper, submitButton, solveButton, resetButton, undoButton, redoButton,
        scoreDisplay, timerDisplay, feedbackToggle, draggablesContainer, textArea,
        feedbackArea, gameContainer, buttonContainer, chapterSelectionArea;

    // Game State (local to this IIFE)
    let courseData = null; // Holds the loaded JSON data for the course
    let currentChapterTerms = []; // Store { term: '...', definition: '...' } pairs for the selected chapter
    let draggableElements = []; // Array of the draggable word elements
    let dropTargetElements = []; // Array of the <strong> blank elements
    let currentScore = 0;
    let timerInterval = null;
    let secondsElapsed = 0;
    let gameActive = false; // Flag if game is running (timer active, interactions enabled)
    let immediateFeedback = true; // Default based on HTML checkbox? Check in init.
    let moveHistory = []; // For undo functionality: { itemId, fromId, toId, swappedItemId? }
    let redoHistory = []; // For redo functionality

    // Drag & Drop State
    let draggedItem = null; // Reference to the element currently being dragged

    // Sound Manager
    const soundManager = {
        sounds: {
            correct: 'assets/sfx/confirm-soft.mp3',
            wrong: 'assets/sfx/wrong-buzz.mp3',
            check: 'assets/sfx/alert-soft.mp3',
            solve: 'assets/sfx/success-chime.mp3',
            reset: 'assets/sfx/game-start.mp3'
        },
        enabled: true,
        audioElements: {},

        init() {
            // Load saved sound preference
            const savedSoundPref = localStorage.getItem('dragFillSoundEnabled');
            if (savedSoundPref !== null) {
                this.enabled = savedSoundPref === 'true';
                const soundToggle = document.getElementById('soundToggle');
                if (soundToggle) {
                    soundToggle.checked = this.enabled;
                }
            }

            // Preload all sound files
            for (const [key, path] of Object.entries(this.sounds)) {
                const audio = new Audio(path);
                audio.preload = 'auto';
                this.audioElements[key] = audio;
            }
        },

        play(soundName) {
            if (!this.enabled) return;
            const audio = this.audioElements[soundName];
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.log('Audio play failed:', e));
            }
        },

        toggle() {
            this.enabled = !this.enabled;
            localStorage.setItem('dragFillSoundEnabled', this.enabled);
        }
    };

    // Initialize sound manager
    soundManager.init();

    // Add sound toggle event listener
    const soundToggle = document.getElementById('soundToggle');
    if (soundToggle) {
        soundToggle.addEventListener('change', () => {
            soundManager.toggle();
        });
    }

    /** Initializes the game setup and event listeners. */
    function initializeGame() {
        // Get DOM references
        getDOMReferences();
        
        // Set up event listeners
        if (submitButton) submitButton.addEventListener('click', checkAnswers);
        if (solveButton) solveButton.addEventListener('click', solveAll);
        if (resetButton) resetButton.addEventListener('click', resetGame);
        if (feedbackToggle) {
            feedbackToggle.addEventListener('change', () => {
                immediateFeedback = feedbackToggle.checked;
                updateButtonStates();
            });
        }

        // ... rest of initialization ...
    }

    /** Gets references to DOM elements and sets up event listeners. */
    function getDOMReferences() {
        console.log("Drag-Fill: Getting DOM references...");
        let criticalElementsFound = true;

        selectWrapper = document.getElementById('select-wrapper');
        submitButton = document.getElementById('submitAnswers');
        solveButton = document.getElementById('solveAll');
        resetButton = document.getElementById('resetGame');
        undoButton = document.getElementById('undoMove');
        redoButton = document.getElementById('redoMove');
        scoreDisplay = document.getElementById('score');
        timerDisplay = document.getElementById('timer');
        feedbackToggle = document.getElementById('feedbackToggle');
        draggablesContainer = document.getElementById('draggables'); // Word bank
        textArea = document.getElementById('text-area'); // Definitions/blanks area
        feedbackArea = document.getElementById('feedback');
        gameContainer = document.getElementById('game-container'); // Overall container for text area
        buttonContainer = document.getElementById('button-container'); // Container for action buttons
        chapterSelectionArea = document.getElementById('chapter-selection-area');

        // Check critical elements
        if (!selectWrapper) { console.error("Drag-Fill: #select-wrapper NOT FOUND!"); criticalElementsFound = false; }
        if (!submitButton) { console.error("Drag-Fill: #submitAnswers button NOT FOUND!"); criticalElementsFound = false; }
        if (!solveButton) { console.error("Drag-Fill: #solveAll button NOT FOUND!"); criticalElementsFound = false; }
        if (!resetButton) { console.error("Drag-Fill: #resetGame button NOT FOUND!"); criticalElementsFound = false; }
        if (!undoButton || !redoButton) { console.warn("Drag-Fill: Undo/Redo buttons missing."); }
        if (!scoreDisplay || !timerDisplay) { console.warn("Drag-Fill: Score/Timer display missing."); }
        if (!feedbackToggle) { console.warn("Drag-Fill: Feedback toggle missing."); }
        if (!draggablesContainer) { console.error("Drag-Fill: #draggables container NOT FOUND!"); criticalElementsFound = false; }
        if (!textArea) { console.error("Drag-Fill: #text-area NOT FOUND!"); criticalElementsFound = false; }
        if (!feedbackArea) { console.warn("Drag-Fill: Feedback area missing."); }
        if (!gameContainer) { console.error("Drag-Fill: #game-container NOT FOUND!"); criticalElementsFound = false; }
        if (!buttonContainer) { console.warn("Drag-Fill: Button container missing."); }
        if (!chapterSelectionArea) { console.warn("Drag-Fill: Chapter selection area missing."); }

        console.log(`Drag-Fill: DOM references obtained. Critical elements found: ${criticalElementsFound}`);
        return criticalElementsFound;
    }

    /** Clears any existing timer interval and resets elapsed time. */
    function resetTimer() {
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        secondsElapsed = 0;
        updateTimerDisplay();
    }

    /** Starts the game timer, updating every second. */
    function startTimer() {
        resetTimer();
        gameActive = true; // Mark game as active when timer starts
        console.log("Drag-Fill: Timer started.");
        timerInterval = setInterval(() => {
            if (!gameActive) { // Safety check
                 console.warn("Drag-Fill: Timer interval detected inactive game, stopping timer.");
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
            console.log("Drag-Fill: Timer stopped.");
        }
        gameActive = false; // Mark game as inactive
    }

    /** Updates the timer display element (e.g., "01:23"). */
    function updateTimerDisplay() {
        if (!timerDisplay) return;
        const minutes = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
        const seconds = String(secondsElapsed % 60).padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${seconds}`;
    }

    /** Updates the score display element. */
    function updateScoreDisplay() {
        if (scoreDisplay) {
            scoreDisplay.textContent = currentScore;
        } else {
             console.warn("Cannot update score display - element not found.");
        }
    }

    /** Updates the enabled/disabled state of game control buttons. */
    function updateButtonStates() {
        // Determine conditions for enabling buttons
        const chapterSelectedAndLoaded = chapterSelect && chapterSelect.value && currentChapterTerms.length > 0;
        const canStartOrReset = chapterSelect && chapterSelect.value; // Can reset if chapter selected, even if no terms
        const itemsPlaced = dropTargetElements.some(target => target.children.length > 0 && target.children[0].classList.contains('draggable'));
        const gameInProgress = gameActive && itemsPlaced;

        // Set button disabled states
        if (submitButton) submitButton.disabled = !gameInProgress || immediateFeedback; // Disable if game not running, nothing placed, OR immediate feedback is on
        if (solveButton) solveButton.disabled = !chapterSelectedAndLoaded || !gameActive; // Disable if game not ready/active
        if (resetButton) resetButton.disabled = !canStartOrReset || (!gameActive && !itemsPlaced); // Disable if cannot start, or if game not active AND nothing placed
        if (undoButton) undoButton.disabled = moveHistory.length === 0 || !gameActive; // Disable if no history or game not active
        if (redoButton) redoButton.disabled = redoHistory.length === 0 || !gameActive; // Disable if no history or game not active

        // Enable/disable interactions based on gameActive state
        // Draggables and drop targets should only be interactive when gameActive
        const interactionAllowed = gameActive;
        if (draggablesContainer) draggablesContainer.style.pointerEvents = interactionAllowed ? 'auto' : 'none';
        if (textArea) textArea.style.pointerEvents = interactionAllowed ? 'auto' : 'none';
        draggableElements.forEach(el => el.draggable = interactionAllowed); // Explicitly set draggable attribute

         // console.log(`Button States Updated: Submit(${submitButton?.disabled}), Solve(${solveButton?.disabled}), Reset(${resetButton?.disabled}), Undo(${undoButton?.disabled}), Redo(${redoButton?.disabled})`);
    }

    /**
     * Fetches course data JSON, populates the chapter dropdown,
     * and handles pre-selection based on URL parameters.
     */
    function loadCourseDataAndMenu() {
        if (!selectWrapper) {
            console.error("Drag-Fill: Cannot load chapters - #select-wrapper missing.");
            if(feedbackArea) feedbackArea.textContent = 'Error: UI element missing.';
            return;
        }

        const courseDataFile = `${course}.json`;
        if (!window.DATA_PATH) {
             console.error("Drag-Fill: Global window.DATA_PATH is not defined!");
             if(feedbackArea) feedbackArea.textContent = 'Error: Configuration missing.';
             return;
        }
        const courseDataPath = `${window.DATA_PATH}${courseDataFile}`;

        // Update titles
        const h1Title = document.querySelector('#content-area h1');
        if (h1Title) h1Title.textContent = `Drag & Fill (${course.toUpperCase()})`;
        document.title = `Drag & Fill (${course.toUpperCase()})`;

        // Show loading state
        selectWrapper.innerHTML = '<p class="label-text">Loading chapters...</p>';
        resetUI(); // Reset UI elements to initial state before loading

        console.log(`Drag-Fill: Fetching course data from: ${courseDataPath}`);
        fetch(courseDataPath)
            .then(response => {
                if (!response.ok) throw new Error(`Data file not found or invalid: ${response.statusText} (${response.status})`);
                return response.json();
            })
            .then(data => {
                courseData = data; // Store locally
                console.log("Drag-Fill: Course data loaded.");
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

                if(feedbackArea) feedbackArea.textContent = 'Please select a chapter.'; // Initial prompt

								// Pre-select chapter from URL if valid
								const chapterIdFromParams = window.gameParams ? window.gameParams.chapter : null;
								if (chapterIdFromParams) {
										const chapterExists = courseData.chapters.some(ch => ch.chapter_id === chapterIdFromParams);
										if (chapterExists) {
												console.log(`Drag-Fill: Pre-selecting chapter from URL: ${chapterIdFromParams}`);
												chapterSelect.value = chapterIdFromParams;
												loadChapter(chapterIdFromParams); // Load the chapter data
												
												// Hide chapter selection area as required when preselected from URL
												if (chapterSelectionArea) {
														chapterSelectionArea.style.display = 'none'; // Hide selection UI on all devices
												}
										} else {
												console.warn(`Drag-Fill: Chapter ID "${chapterIdFromParams}" from URL not found.`);
												resetUI(); // Reset UI, keep prompt visible
										}
								}
            })
            .catch(error => {
                console.error('Drag-Fill: Error loading or processing course data:', error);
                selectWrapper.innerHTML = `<p style="color:red;">Error loading chapters!</p>`;
                if (feedbackArea) feedbackArea.textContent = `Failed to load course data: ${error.message}`;
                courseData = null;
                resetUI();
            });
    }

    /** Resets the game UI to its initial state (clears scores, timers, game areas). */
    function resetUI() {
        console.log("Drag-Fill: Resetting UI...");
        // Reset scores, timers, feedback
        currentScore = 0;
        updateScoreDisplay();
        resetTimer(); // Stops timer and resets display, sets gameActive = false implicitly
        if (feedbackArea) feedbackArea.textContent = ''; // Clear feedback message

        // Hide game area, clear dynamic content
        if (gameContainer) gameContainer.style.display = 'none';
        if (draggablesContainer) draggablesContainer.innerHTML = '';
        if (textArea) textArea.innerHTML = '';

        // Clear internal state arrays
        currentChapterTerms = [];
        draggableElements = [];
        dropTargetElements = [];
        moveHistory = [];
        redoHistory = [];
        draggedItem = null;

        updateButtonStates(); // Update button disabled states based on reset
        console.log("Drag-Fill: UI reset complete.");
    }

    /**
     * Loads term/definition data for the selected chapter and sets up the game area.
     * @param {string} chapterId - The ID of the chapter to load.
     */
    function loadChapter(chapterId) {
        resetUI(); // Start with a clean slate before loading new chapter data

        if (!chapterId) {
            console.warn("Drag-Fill: loadChapter called with no chapterId.");
             if (feedbackArea) feedbackArea.textContent = 'Please select a chapter.';
            updateButtonStates(); // Ensure buttons are disabled
            return;
        }
        if (!courseData) {
            console.error("Drag-Fill: Cannot load chapter - course data not available.");
            if(feedbackArea) feedbackArea.textContent = 'Error: Course data not loaded.';
            return;
        }

        console.log(`Drag-Fill: Loading chapter ID: ${chapterId}`);
        const chapter = courseData.chapters.find(ch => ch.chapter_id === chapterId);

        if (!chapter || !Array.isArray(chapter.term_definitions)) {
            console.error(`Drag-Fill: Chapter data invalid or not found for ID: ${chapterId}`);
            if(feedbackArea) feedbackArea.textContent = `Error loading chapter data. Please try another.`;
            updateButtonStates();
            return;
        }

        // Filter for valid pairs and store them
        currentChapterTerms = chapter.term_definitions
            .filter(td => td && typeof td.term === 'string' && td.term.trim() && typeof td.definition === 'string' && td.definition.trim())
            .map((td, index) => ({ // Add a unique ID for drag/drop tracking
                id: `term-${chapterId}-${index}`,
                term: td.term.trim(),
                definition: td.definition.trim()
            }));

        if (currentChapterTerms.length === 0) {
            console.warn(`Drag-Fill: No valid terms found in chapter ${chapterId}.`);
            if (feedbackArea) feedbackArea.textContent = 'No terms found in this chapter. Please select another.';
            updateButtonStates(); // Ensure buttons reflect no available game
            return;
        }

        console.log(`Drag-Fill: Loaded ${currentChapterTerms.length} terms.`);
        if (feedbackArea) feedbackArea.textContent = 'Drag words to the blanks!'; // Update prompt

        // Setup the game board and start the timer
        setupGameArea();
        if (gameContainer) gameContainer.style.display = 'block'; // Show game area now
        startTimer(); // Start the timer for the new game
        updateButtonStates(); // Enable relevant buttons for active game
    }

    /** Populates the word bank and the definitions/blanks area. */
    function setupGameArea() {
        if (!draggablesContainer || !textArea || currentChapterTerms.length === 0) {
             console.error("Drag-Fill: Cannot setup game area - missing elements or data.");
             return;
        }

        // Clear previous game elements
        draggablesContainer.innerHTML = '';
        textArea.innerHTML = '';
        draggableElements = [];
        dropTargetElements = [];

        // Create shuffled list of term strings for the word bank
        const termsToDrag = shuffleArray([...currentChapterTerms.map(item => item.term)]);

        // Create draggable elements for the word bank
        termsToDrag.forEach((term, index) => {
            const draggable = document.createElement('div');
            // Use term text for ID generation to link back? Or simple index? Index safer.
            draggable.id = `drag-${index}`; // Unique ID for the draggable element itself
            draggable.dataset.term = term; // Store the term text
            draggable.classList.add('draggable');
            // Optional: Add size classes based on term length
            if (term.length > 18) draggable.classList.add('large-option');
            else if (term.length > 10) draggable.classList.add('medium-option');
            else draggable.classList.add('small-option');
            draggable.textContent = term;
            draggable.draggable = true; // Make it draggable
            // Add event listeners for drag operations
            draggable.addEventListener('dragstart', handleDragStart);
            draggable.addEventListener('dragend', handleDragEnd);
            draggablesContainer.appendChild(draggable);
            draggableElements.push(draggable); // Store reference
        });

        // Create definition lines with drop targets (using original, unshuffled order)
        currentChapterTerms.forEach((item, index) => {
            const p = document.createElement('p'); // Container for number, blank, definition

            const qNum = document.createElement('span'); // Question number
            qNum.classList.add('question-number');
            qNum.textContent = `${index + 1}.`;

            const strong = document.createElement('strong'); // This is the drop target (blank)
            strong.id = `drop-${index}`; // Unique ID for the drop target
            strong.dataset.correctTerm = item.term; // Store the correct answer on the target
            // Add drop zone event listeners
            strong.addEventListener('dragover', handleDragOver);
            strong.addEventListener('dragenter', handleDragEnter);
            strong.addEventListener('dragleave', handleDragLeave);
            strong.addEventListener('drop', handleDrop);
            dropTargetElements.push(strong); // Store reference

            const span = document.createElement('span'); // Definition text
            span.classList.add('definition-text');
            span.textContent = item.definition;

            // Assemble the line
            p.appendChild(qNum);
            p.appendChild(strong); // Blank
            p.appendChild(span); // Definition
            textArea.appendChild(p);
        });
        console.log("Drag-Fill: Game area setup complete with draggables and drop targets.");
    }

    // --- Drag and Drop Handlers ---

    function handleDragStart(e) {
        // Prevent dragging if game not active
        if (!gameActive) {
            e.preventDefault();
            return;
        }
        draggedItem = e.target; // Store reference to the item being dragged
        // Add visual feedback class after a tiny delay
        setTimeout(() => draggedItem?.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
        // Set data to be transferred (e.g., the ID of the dragged element)
        e.dataTransfer.setData('text/plain', draggedItem.id);
        console.log(`Drag Start: ${draggedItem.id} ('${draggedItem.textContent}')`);
    }

    function handleDragEnd(e) {
        // Remove visual feedback class regardless of drop outcome
        // Use optional chaining in case draggedItem became null unexpectedly
        draggedItem?.classList.remove('dragging');
        draggedItem = null; // Clear reference after drag operation ends
        // console.log("Drag End");
    }

    function handleDragOver(e) {
        // Prevent default to allow dropping
        e.preventDefault();
        // Optional: set drop effect visual cue
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragEnter(e) {
        e.preventDefault();
        const targetElement = e.target.closest('strong');
        // Add hover effect only if the target is an empty drop target
        if (targetElement && targetElement.children.length === 0) {
            targetElement.classList.add('droppable-hover');
        }
    }

    function handleDragLeave(e) {
        const targetElement = e.target.closest('strong');
        // Remove hover effect when dragging leaves the target
        if (targetElement) {
            targetElement.classList.remove('droppable-hover');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const dropTarget = e.target.closest('strong');
        if (!dropTarget) return;

        const draggedItem = document.querySelector('.dragging');
        if (!draggedItem) return;

        // Check if the drop is correct
        const isCorrect = checkAnswer(draggedItem.dataset.term, dropTarget.dataset.correctTerm);
        
        // Play appropriate sound
        if (isCorrect) {
            soundManager.play('correct');
        } else {
            soundManager.play('wrong');
        }

        // Update card width to match placeholder
        draggedItem.style.width = dropTarget.offsetWidth + 'px';
        draggedItem.style.minWidth = dropTarget.style.minWidth;
        draggedItem.style.maxWidth = dropTarget.style.maxWidth;

        dropTarget.classList.remove('droppable-hover'); // Remove hover styling

        const sourceContainer = draggedItem.parentElement; // Where the item came from (word bank or another target)
        const targetIsEmpty = dropTarget.children.length === 0;
        const draggedItemId = draggedItem.id;
        const draggedItemTerm = draggedItem.dataset.term;
        const dropTargetId = dropTarget.id;
        let sourceId = sourceContainer.id || 'draggables'; // Use container ID or default to word bank

        console.log(`Drop: Item ${draggedItemId} ('${draggedItemTerm}') onto Target ${dropTargetId}`);

        // --- Handle different drop scenarios ---
        if (targetIsEmpty) {
            // Scenario 1: Dropping onto an empty target
            recordMove(draggedItemId, sourceId, dropTargetId); // Record move before DOM change
            dropTarget.appendChild(draggedItem); // Move the item
            if (immediateFeedback) {
                checkSingleAnswer(dropTarget); // Check answer if feedback is on
            }
        } else if (dropTarget.contains(draggedItem)) {
             // Scenario 2: Dropped item back onto itself - do nothing
             console.log("Dropped onto self - no action.");
             return;
        } else {
             // Scenario 3: Dropping onto a target that already contains another draggable item (SWAP)
             const existingItem = dropTarget.children[0];
             if (!existingItem || !existingItem.classList.contains('draggable')) {
                 console.warn("Drop target contained unexpected content.", dropTarget.innerHTML);
                 return; // Target should only contain draggables
             }
             const existingItemId = existingItem.id;

             console.log(`Swap: ${draggedItemId} with ${existingItemId}`);
             recordMove(draggedItemId, sourceId, dropTargetId, existingItemId); // Record the swap move

             // Perform the visual swap in the DOM
             sourceContainer.appendChild(existingItem); // Move existing item to where draggedItem came from
             dropTarget.appendChild(draggedItem);      // Move dragged item into the target

             // Re-check answers if immediate feedback is on
             if (immediateFeedback) {
                 checkSingleAnswer(dropTarget); // Check the target with the new item
                 // If the source was *also* a drop target, check it too
                 if (sourceContainer.tagName === 'STRONG') {
                     checkSingleAnswer(sourceContainer);
                 }
             }
        }

        // After any successful drop/move:
        redoHistory = []; // Clear redo history because a new action was taken
        updateButtonStates(); // Update button enabled states

        if (immediateFeedback) {
            const isCorrect = checkAnswer(draggedItemTerm, dropTarget.dataset.correctTerm);
            if (isCorrect) {
                soundManager.play('correct');
            } else {
                soundManager.play('wrong');
            }
        }
    }

    // --- Answer Checking Logic ---

    /** Checks a single drop target immediately if immediateFeedback is on. */
    function checkSingleAnswer(dropTarget) {
        if (!dropTarget) return;

        // Clear previous feedback classes
        dropTarget.classList.remove('correct', 'incorrect');
        const placedItem = dropTarget.children[0];

        if (!placedItem || !placedItem.classList.contains('draggable')) {
            // Target is empty or contains non-draggable content
             if (placedItem) placedItem.classList.remove('correct-strike', 'incorrect-strike'); // Clear item style if any
            return;
        }

        // Clear previous item feedback classes
        placedItem.classList.remove('correct-strike', 'incorrect-strike');

        const placedTerm = placedItem.dataset.term;
        const correctTerm = dropTarget.dataset.correctTerm;

        if (placedTerm === correctTerm) {
            dropTarget.classList.add('correct');
            // console.log(`Immediate Check: ${dropTarget.id} CORRECT ('${placedTerm}')`);
        } else {
            dropTarget.classList.add('incorrect');
            placedItem.classList.add('incorrect-strike'); // Visually strike through incorrect word
            console.log(`Immediate Check: ${dropTarget.id} INCORRECT ('${placedTerm}', needed '${correctTerm}')`);
             // Optional: Add shake animation for visual feedback on incorrect placement
             dropTarget.classList.add('shake');
             setTimeout(() => dropTarget.classList.remove('shake'), 500);
        }
    }

    /** Checks all answers when the "Check Answers" button is clicked. */
    function checkAllAnswers() {
        if (!gameActive && moveHistory.length === 0) {
             console.log("Check All: No game active or nothing placed.");
             if(feedbackArea) feedbackArea.textContent = "Drag some words first!";
             return;
        }
        console.log("Drag-Fill: Checking all answers...");
        stopTimer(); // Stop timer when checking final answers

        let correctCount = 0;
        let totalPlaced = 0;
        currentScore = 0; // Reset score for final calculation

        dropTargetElements.forEach(target => {
            // Clear previous feedback (immediate or prior check)
            target.classList.remove('correct', 'incorrect', 'shake');
            const placedItem = target.children[0];

            if (placedItem && placedItem.classList.contains('draggable')) {
                totalPlaced++;
                const placedTerm = placedItem.dataset.term;
                const correctTerm = target.dataset.correctTerm;
                // Clear previous item styling
                placedItem.classList.remove('correct-strike', 'incorrect-strike');

                if (placedTerm === correctTerm) {
                    correctCount++;
                    target.classList.add('correct'); // Mark target green
                    currentScore += 5; // Points for correct
                } else {
                    target.classList.add('incorrect'); // Mark target red
                    placedItem.classList.add('incorrect-strike'); // Strike through incorrect word
                    currentScore -= 1; // Penalty for incorrect
                }
            } else {
                // Target is empty, ensure no feedback styles remain
                target.classList.remove('correct', 'incorrect');
            }
        });

        // Ensure score doesn't go below zero
        currentScore = Math.max(0, currentScore);
        updateScoreDisplay(); // Update score display

        // Display summary feedback message
        if (feedbackArea) {
            if (totalPlaced === 0) {
                 feedbackArea.textContent = "You haven't placed any words yet!";
            } else if (correctCount === currentChapterTerms.length) {
                feedbackArea.textContent = `🎉 Perfect! You matched all ${correctCount} terms correctly! Final Score: ${currentScore}`;
            } else if (correctCount === totalPlaced) {
                 feedbackArea.textContent = `👍 Good job! You correctly placed all ${correctCount} words you attempted. Final Score: ${currentScore}`;
            } else {
                feedbackArea.textContent = `🤔 You matched ${correctCount} out of ${currentChapterTerms.length} terms correctly. Final Score: ${currentScore}. Review the incorrect items.`;
            }
        }

        updateButtonStates(); // Update buttons (likely disable Submit, enable Reset)
        console.log(`Check All Results: ${correctCount}/${currentChapterTerms.length} correct. Score: ${currentScore}`);
        soundManager.play('check');
    }

    /** Solves the puzzle by placing all terms correctly. */
    function solveAllAnswers() {
        if (!gameActive && moveHistory.length === 0) {
             console.log("Solve All: Cannot solve, game not started or nothing loaded.");
             return; // Don't solve if nothing loaded/started
        }
        console.log("Drag-Fill: Solving all answers...");
        stopTimer(); // Stop timer
        if(feedbackArea) feedbackArea.textContent = 'Showing correct answers...';
        currentScore = 0; // No score when solved automatically
        updateScoreDisplay();
        moveHistory = []; // Clear history as state is now fixed
        redoHistory = [];

        // Create a map of term text to the corresponding draggable DOM element
        const termToElementMap = new Map();
        draggableElements.forEach(el => termToElementMap.set(el.dataset.term, el));

        // Place the correct draggable element into each drop target
        dropTargetElements.forEach(target => {
            const correctTerm = target.dataset.correctTerm;
            const correctElement = termToElementMap.get(correctTerm);

            // Prepare the target: clear existing content and styles
            target.innerHTML = '';
            target.classList.remove('incorrect', 'droppable-hover', 'shake');
            target.classList.add('correct'); // Mark target as correct

            if (correctElement) {
                 // Prepare the element: clear any feedback styles
                 correctElement.classList.remove('incorrect-strike', 'correct-strike', 'dragging');
                 correctElement.draggable = false; // Make it non-draggable after solving
                 target.appendChild(correctElement); // Move the correct element into the target
            } else {
                // This indicates a mismatch between terms and draggables - should not happen
                 target.textContent = `Error!`;
                 target.style.color = 'red';
                 console.error(`Solve All Error: Could not find draggable element for term '${correctTerm}'`);
            }
        });

        // Move any leftover draggables (should be none if setup is correct) back to the word bank? Or just disable them.
        // Disabling seems simpler.
        draggableElements.forEach(el => el.draggable = false);
        if (draggablesContainer) draggablesContainer.style.pointerEvents = 'none'; // Disable word bank interaction


        updateButtonStates(); // Update buttons (disable most except Reset)
        console.log("Drag-Fill: Solve complete.");
        soundManager.play('solve');
    }

    /** Handles the click of the Reset button. */
    function handleResetGame() {
        console.log("Drag-Fill: Reset button clicked.");
        // Optional confirmation
        // if (!confirm("Are you sure you want to reset this chapter? Your progress will be lost.")) {
        //     return;
        // }
        stopTimer(); // Stop any active timer

        // Reload the currently selected chapter to reset everything for that chapter
        if (chapterSelect && chapterSelect.value) {
            const currentChapterId = chapterSelect.value;
            console.log(`Resetting chapter: ${currentChapterId}`);
            loadChapter(currentChapterId); // Reload chapter handles UI reset and game setup
            if(feedbackArea) feedbackArea.textContent = 'Game reset.';
             // Clear message after a delay
             setTimeout(() => { if(feedbackArea && feedbackArea.textContent === 'Game reset.') feedbackArea.textContent = ''; }, 2000);
        } else {
            // No chapter selected, just ensure basic UI is reset
            console.log("Resetting UI (no chapter selected).");
            resetUI();
            if(feedbackArea) feedbackArea.textContent = 'Please select a chapter to start.';
        }
        soundManager.play('reset');
    }

    // --- Undo/Redo Logic ---

    /** Records a move (placement or swap) to the history stack. */
    function recordMove(itemId, fromId, toId, swappedItemId = null) {
        // Simple validation
        if (!itemId || !fromId || !toId) {
            console.error("RecordMove Error: Missing required IDs.", { itemId, fromId, toId });
            return;
        }
        const move = { itemId, fromId, toId, swappedItemId };
        moveHistory.push(move);
        // console.log("Move Recorded:", move);
    }

    /** Reverts the last move recorded in the history stack. */
    function undoLastMove() {
        if (moveHistory.length === 0 || !gameActive) {
            console.log("Undo: No history or game not active.");
            return;
        }
        const lastMove = moveHistory.pop(); // Get last move and remove from history
        redoHistory.push(lastMove); // Add it to the redo stack

        console.log("Undoing Move:", lastMove);

        const itemToMove = document.getElementById(lastMove.itemId);
        // Find original container: Use ID, default to word bank if ID matches or is missing/invalid
        const originalContainer = (lastMove.fromId === 'draggables' || !document.getElementById(lastMove.fromId))
                                  ? draggablesContainer
                                  : document.getElementById(lastMove.fromId);
        const currentContainer = document.getElementById(lastMove.toId); // Where the item *currently* is (should be)

        // --- Perform Undo ---
        // 1. Validate elements exist
        if (!itemToMove || !originalContainer || !currentContainer) {
            console.error("Undo Error: Item or containers not found!", lastMove);
            // Attempt to put history back? Or just log error and update state?
            moveHistory.push(lastMove); // Put back if failed?
            redoHistory.pop();          // Remove from redo
            updateButtonStates();
            return;
        }

        // 2. Move the main item back to its original container
        originalContainer.appendChild(itemToMove);

        // 3. If it was a swap, move the swapped item back to the *current* container
        if (lastMove.swappedItemId) {
            const swappedItem = document.getElementById(lastMove.swappedItemId);
            // After the main item moved (step 2), the swapped item should be in the original container
            if (swappedItem && originalContainer.contains(swappedItem)) {
                 currentContainer.appendChild(swappedItem);
            } else {
                 console.error("Undo Error (Swap): Swapped item not found in original container!", lastMove);
                 // Attempt recovery: try placing in word bank?
                 if (swappedItem) draggablesContainer.appendChild(swappedItem);
            }
        }

        // --- Update Feedback ---
        // Clear or re-check feedback on affected containers
        [originalContainer, currentContainer].forEach(container => {
             if (container && container.tagName === 'STRONG') { // Only check drop targets
                 if (immediateFeedback) {
                     checkSingleAnswer(container);
                 } else {
                     // If not immediate feedback, just clear visual styles
                     container.classList.remove('correct', 'incorrect', 'shake');
                     const item = container.children[0];
                     if (item) item.classList.remove('correct-strike', 'incorrect-strike');
                 }
             }
        });


        updateButtonStates(); // Update button states after undo
    }

    /** Re-applies the last undone move from the redo stack. */
    function redoLastMove() {
        if (redoHistory.length === 0 || !gameActive) {
            console.log("Redo: No redo history or game not active.");
            return;
        }
        const moveToRedo = redoHistory.pop(); // Get last undone move
        moveHistory.push(moveToRedo); // Add it back to the main history

        console.log("Redoing Move:", moveToRedo);

        const itemToMove = document.getElementById(moveToRedo.itemId);
        const targetContainer = document.getElementById(moveToRedo.toId); // Where it should go
        // Determine source container based on 'fromId'
        const sourceContainer = (moveToRedo.fromId === 'draggables' || !document.getElementById(moveToRedo.fromId))
                                  ? draggablesContainer
                                  : document.getElementById(moveToRedo.fromId);

        // --- Perform Redo ---
        // 1. Validate elements
        if (!itemToMove || !targetContainer || !sourceContainer) {
            console.error("Redo Error: Item or containers not found!", moveToRedo);
            redoHistory.push(moveToRedo); // Put back if failed?
            moveHistory.pop();          // Remove from history
            updateButtonStates();
            return;
        }

        // 2. Handle swap case first: Move the swapped item (if any) back to the source container
        if (moveToRedo.swappedItemId) {
             const swappedItem = document.getElementById(moveToRedo.swappedItemId);
             // The swapped item should currently be in the target container after the undo
             if (swappedItem && targetContainer.contains(swappedItem)) {
                 sourceContainer.appendChild(swappedItem);
             } else {
                  console.error("Redo Error (Swap): Swapped item not found in target container!", moveToRedo);
                  // Attempt recovery?
                  if (swappedItem) draggablesContainer.appendChild(swappedItem);
             }
        }

        // 3. Move the main item to the target container
        targetContainer.appendChild(itemToMove);

        // --- Update Feedback ---
        // Clear or re-check feedback on affected containers
         [sourceContainer, targetContainer].forEach(container => {
             if (container && container.tagName === 'STRONG') { // Only check drop targets
                 if (immediateFeedback) {
                     checkSingleAnswer(container);
                 } else {
                     // Clear visual styles if not immediate
                     container.classList.remove('correct', 'incorrect', 'shake');
                     const item = container.children[0];
                     if (item) item.classList.remove('correct-strike', 'incorrect-strike');
                 }
             }
         });

        updateButtonStates(); // Update buttons after redo
    }


    // ===== Event Listeners Setup =====

    /** Sets up initial event listeners for buttons, controls, and dropdowns. */
    function setupEventListeners() {
        console.log("Drag-Fill: Setting up event listeners...");

        if (!submitButton || !solveButton || !resetButton || !undoButton || !redoButton || !feedbackToggle) {
             console.error("Drag-Fill: Cannot setup listeners - one or more required control elements missing.");
             return; // Abort if required buttons/toggles aren't found
        }

        // --- Button Listeners ---
        // Check if listeners already attached using a data attribute to prevent duplicates
        if (!submitButton.dataset.listener) {
            submitButton.addEventListener('click', checkAllAnswers);
            submitButton.dataset.listener = 'true';
        }
        if (!solveButton.dataset.listener) {
            solveButton.addEventListener('click', solveAllAnswers);
            solveButton.dataset.listener = 'true';
        }
        if (!resetButton.dataset.listener) {
            resetButton.addEventListener('click', handleResetGame);
            resetButton.dataset.listener = 'true';
        }
        if (!undoButton.dataset.listener) {
            undoButton.addEventListener('click', undoLastMove);
            undoButton.dataset.listener = 'true';
        }
        if (!redoButton.dataset.listener) {
            redoButton.addEventListener('click', redoLastMove);
            redoButton.dataset.listener = 'true';
        }

        // --- Feedback Toggle Listener ---
        if (!feedbackToggle.dataset.listener) {
            feedbackToggle.addEventListener('change', handleFeedbackToggleChange);
            feedbackToggle.dataset.listener = 'true';
             // Set initial state based on checkbox default checked state
             immediateFeedback = feedbackToggle.checked;
             console.log(`Initial Immediate Feedback state: ${immediateFeedback}`);
        }

        console.log("Drag-Fill: Base event listeners setup complete.");
        // Chapter dropdown listener is set up *after* the dropdown is created in loadCourseDataAndMenu
    }

    /** Attaches the event listener specifically to the chapter dropdown. */
    function setupChapterDropdownListener() {
         if (!chapterSelect) {
            console.error("Drag-Fill: Cannot setup listener: chapterSelect is null/not found.");
             // Try to find it again in case it was *just* added
             chapterSelect = document.getElementById('chapterSelect');
             if (!chapterSelect) {
                 console.error("Drag-Fill: Still cannot find chapterSelect. Listener NOT attached.");
                 return; // Give up
             }
         }
         // Attach listener (consider removing old one if re-attaching, but IIFE usually avoids this need)
         // chapterSelect.removeEventListener('change', handleChapterChange);
         chapterSelect.addEventListener('change', handleChapterChange);
         console.log("Drag-Fill: Chapter dropdown listener attached.");
    }

    // --- Event Handler Functions ---

    /** Handles changes to the immediate feedback toggle. */
    function handleFeedbackToggleChange(e) {
        immediateFeedback = e.target.checked;
        console.log(`Immediate Feedback Toggled: ${immediateFeedback}`);
        // Apply change immediately
        if (immediateFeedback) {
            // If turning ON, check all currently placed answers
            console.log("Checking existing answers due to feedback toggle ON.");
            dropTargetElements.forEach(target => {
                if (target.children.length > 0) checkSingleAnswer(target);
            });
        } else {
            // If turning OFF, clear all existing feedback styles
            console.log("Clearing feedback styles due to feedback toggle OFF.");
            dropTargetElements.forEach(target => {
                 target.classList.remove('correct', 'incorrect', 'shake');
                 const item = target.children[0];
                 if (item) item.classList.remove('correct-strike', 'incorrect-strike');
            });
        }
         updateButtonStates(); // Submit button state depends on this toggle
    }

    /** Handles changes in the chapter selection dropdown. */
    function handleChapterChange() {
        if (!chapterSelect) return;
        const selectedChapterId = chapterSelect.value;
        console.log(`Chapter selection changed to: ${selectedChapterId || 'None'}`);
        // Stop any active game before loading new chapter data
        if (gameActive) {
            console.log("Chapter changed mid-game. Stopping current game.");
            stopTimer(); // Stop timer, marks gameActive = false
        }
        // Load the selected chapter (loadChapter handles resetting UI)
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

    // Add the missing checkAnswer function
    function checkAnswer(placedTerm, correctTerm) {
        return placedTerm === correctTerm;
    }

    // ===== Game Initialization Function =====
    /** Main function to initialize the Drag & Fill game setup. */
    function initializeDragFill() {
        console.log("Drag-Fill: Initializing game inside IIFE...");

        // 1. Get DOM References and check if critical ones exist
        if (!getDOMReferences()) {
             console.error("Drag-Fill: Initialization aborted due to missing critical DOM elements.");
             // Display error message in UI if possible
             if(feedbackArea) feedbackArea.textContent = "Error: Failed to load game UI elements.";
             else if (document.body) document.body.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Error: Failed to load Drag & Fill game UI.</p>";
             return; // Stop initialization
        }

        // 2. Setup Event Listeners for buttons, toggle, etc.
        console.log("Drag-Fill: Setting up base event listeners.");
        setupEventListeners();

        // 3. Load Course Data and Populate Chapter Dropdown
        // This is async and will handle subsequent setup steps (like setting up dropdown listener)
        console.log("Drag-Fill: Initiating course data load.");
        loadCourseDataAndMenu();

        // 4. Set Initial UI State (mostly done via resetUI called in loadCourseDataAndMenu)
        console.log("Drag-Fill: Applying initial UI state via resetUI.");
        resetUI(); // Ensure clean state initially

        console.log("Drag-Fill: Initialization sequence complete.");
    }

// ===== Cleanup Function =====
    /** Cleans up resources used by the Drag & Fill game (timers, listeners, state). */
    function cleanupDragFill() {
        console.log("DragFill: Cleaning up...");

        // 1. Stop Timers
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log("DragFill: Timer cleared.");
        }
        gameActive = false; // Ensure game is marked inactive

        // 2. Remove Event Listeners (Optional but recommended for complex scenarios)
        // Since the container #content-area is usually cleared, listeners on elements
        // *within* it are often removed automatically. If listeners were attached
        // to `document` or `window`, they would *definitely* need removal here.
        // For this specific setup, explicit removal might be redundant but safer:
        // submitButton?.removeEventListener('click', checkAllAnswers);
        // solveButton?.removeEventListener('click', solveAllAnswers);
        // resetButton?.removeEventListener('click', handleResetGame);
        // undoButton?.removeEventListener('click', undoLastMove);
        // redoButton?.removeEventListener('click', redoLastMove);
        // feedbackToggle?.removeEventListener('change', handleFeedbackToggleChange);
        // chapterSelect?.removeEventListener('change', handleChapterChange);
        // Add removal for drag/drop listeners if necessary, though they are on elements
        // that should be removed from the DOM.

        // 3. Null out references to release memory and prevent stale references
        courseData = null;
        currentChapterTerms = []; // Reset arrays
        draggableElements = [];
        dropTargetElements = [];
        moveHistory = [];
        redoHistory = [];
        draggedItem = null;

        // DOM References (optional, helps garbage collection)
        chapterSelect = null;
        selectWrapper = null;
        submitButton = null;
        solveButton = null;
        resetButton = null;
        undoButton = null;
        redoButton = null;
        scoreDisplay = null;
        timerDisplay = null;
        feedbackToggle = null;
        draggablesContainer = null;
        textArea = null;
        feedbackArea = null;
        gameContainer = null;
        buttonContainer = null;
        chapterSelectionArea = null;

        console.log("DragFill: Cleanup complete.");
    }

    // ===== Assign cleanup function to global scope =====
    // This allows spa-loader.js to call the correct cleanup function before loading new content
    window.currentGameCleanup = cleanupDragFill;

    // ===== Start Initialization =====
    // This is the main entry point for the game when its script is loaded.
    initializeDragFill(); // Calls the main setup function defined earlier in this file

})(); // END OF IIFE