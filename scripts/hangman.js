/* hangman.js (Adapted for SPA with IIFE) */

(function() { // START OF IIFE
    'use strict'; // Enforce stricter parsing and error handling

    // ===== Log Access to Global Config =====
    // Verify that the global variables set by spa-loader.js are accessible
    console.log(`Hangman IIFE executing.`);
    console.log(` - Using global DATA_PATH: ${window.DATA_PATH || 'Not Found!'}`);
    console.log(` - Using global DEFAULT_COURSE: ${window.DEFAULT_COURSE || 'Not Found!'}`);
    console.log(` - Using global allowedCourses: ${window.allowedCourses ? window.allowedCourses.join(', ') : 'Not Found!'}`);

    // ===== LOCAL Constants & Variable Declarations =====
    // Variables declared here are scoped to this IIFE execution

    // Determine course for this instance, using global config and params
    const course = (window.gameParams && window.gameParams.course && window.allowedCourses && window.allowedCourses.includes(window.gameParams.course.toLowerCase()))
                   ? window.gameParams.course.toLowerCase()
                   : window.DEFAULT_COURSE; // Use global default if params invalid/missing
    console.log("Hangman initializing with course:", course);

    // DOM References (will be assigned in getDOMReferences)
    let difficultySelect, newGameButton, endGameButton, hintText, wordDisplay, definitionDisplay,
        keyboardContainer, wrongGuessesDisplay, maxGuessesDisplay, timerDisplay,
        selectWrapper, chapterSelect, hangmanSVG, partsElements,
        gameContainer; // <<<--- ADD gameContainer REFERENCE

    // Game State Variables (scoped locally to this IIFE)
    let courseData = null; // Holds the loaded JSON data for the course
    let terms = []; // Array of terms for the selected chapter
    let definitions = []; // Array of definitions corresponding to terms
    let currentWord = ''; // The word being guessed
    let currentDefinition = ''; // The definition for the current word
    let guessedLetters = []; // Array of letters guessed by the player
    let wrongGuesses = 0; // Count of incorrect guesses
    let maxWrongGuesses = 6; // Max allowed wrong guesses (determined by difficulty)
    let gameActive = false; // Flag indicating if a game is currently in progress
    let timerInterval = null; // Stores the interval ID for the game timer
    let secondsElapsed = 0; // Tracks elapsed time for the current game

    // Audio Context for error sound (initialized lazily)
    let audioContext = null; // <<<--- ADD for audio

    // Sound Manager for all game sounds
    const soundManager = {
        sounds: {
            correct: new Audio('assets/sfx/confirm-soft.mp3'),
            wrong: new Audio('assets/sfx/wrong-buzz.mp3'),
            newGame: new Audio('assets/sfx/game-start.mp3'),
            endGame: new Audio('assets/sfx/alert-soft.mp3'),
            win: new Audio('assets/sfx/success-chime.mp3'),
            lose: new Audio('assets/sfx/wrong-high.mp3')
        },
        isEnabled: true,
        init: function() {
            // Load saved sound preference from localStorage
            const savedSoundState = localStorage.getItem('hangmanSoundEnabled');
            this.isEnabled = savedSoundState === null ? true : savedSoundState === 'true';
            
            // Set initial checkbox state
            const soundToggle = document.getElementById('hangmanSoundToggle');
            if (soundToggle) {
                soundToggle.checked = this.isEnabled;
                // Remove any existing event listeners
                soundToggle.removeEventListener('change', this.handleSoundToggle);
                // Add new event listener
                this.handleSoundToggle = (e) => {
                    this.isEnabled = e.target.checked;
                    localStorage.setItem('hangmanSoundEnabled', this.isEnabled);
                };
                soundToggle.addEventListener('change', this.handleSoundToggle);
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
      console.log("Hangman: Getting DOM references...");
      let criticalElementsFound = true; // Assume success initially

      difficultySelect = document.getElementById('difficulty');
      newGameButton = document.getElementById('newGameButton');
      endGameButton = document.getElementById('endGameButton');
      hintText = document.getElementById('hintText');
      wordDisplay = document.getElementById('wordDisplay');
      definitionDisplay = document.getElementById('definition');
      keyboardContainer = document.getElementById('keyboard');
      wrongGuessesDisplay = document.getElementById('wrongGuesses');
      maxGuessesDisplay = document.getElementById('maxGuesses');
      timerDisplay = document.getElementById('timer');
      selectWrapper = document.getElementById('chapter-selection-area');
      chapterSelect = document.getElementById('chapterSelect');
      hangmanSVG = document.getElementById('hangmanSVG');
      gameContainer = document.querySelector('.game-container');

      // Initialize sound manager after getting DOM references
      soundManager.init();

      // Check critical elements required for basic functionality
      if (!difficultySelect) { console.warn("Hangman: #difficulty select NOT FOUND!"); /* Might be acceptable */ }
      if (!newGameButton) { console.error("Hangman: #newGameButton NOT FOUND!"); criticalElementsFound = false; }
      if (!endGameButton) { console.warn("Hangman: #endGameButton NOT FOUND!"); /* Less critical */ }
      if (!wordDisplay) { console.error("Hangman: #wordDisplay NOT FOUND!"); criticalElementsFound = false; }
      if (!definitionDisplay) { console.error("Hangman: #definition NOT FOUND!"); criticalElementsFound = false; }
      if (!keyboardContainer) { console.error("Hangman: #keyboard container NOT FOUND!"); criticalElementsFound = false; }
      if (!selectWrapper) { console.error("Hangman: #chapter-selection-area NOT FOUND!"); criticalElementsFound = false; }
      if (!chapterSelect) { console.error("Hangman: #chapterSelect NOT FOUND!"); criticalElementsFound = false; }
      if (!hangmanSVG) { console.error("Hangman SVG element (#hangmanSVG) not found"); /* Degrades gracefully */ }
      if (!wrongGuessesDisplay || !maxGuessesDisplay) { console.warn("Scoreboard elements missing."); }
      if (!timerDisplay) { console.warn("Timer display missing."); }
      if (!gameContainer) { console.error("Hangman: .game-container NOT FOUND!"); criticalElementsFound = false; }

      if (hangmanSVG) {
        partsElements = [
          hangmanSVG.querySelector('.head'),
          hangmanSVG.querySelector('.body'),
          hangmanSVG.querySelector('.left-arm'),
          hangmanSVG.querySelector('.right-arm'),
          hangmanSVG.querySelector('.left-leg'),
          hangmanSVG.querySelector('.right-leg')
        ].filter(el => el); // Filter out nulls if some parts are missing in SVG
          if (partsElements.length < 6) console.warn(`Hangman: Found only ${partsElements.length} SVG parts.`);
      } else {
        partsElements = [];
      }

      // Set initial max guesses display based on dropdown's default value
        if (difficultySelect) {
            maxWrongGuesses = parseInt(difficultySelect.value, 10) || 6;
        } else {
            maxWrongGuesses = 6; // Fallback if dropdown missing
        }
        if (maxGuessesDisplay) maxGuessesDisplay.innerText = maxWrongGuesses;
        else console.warn("Cannot display Max Guesses - element missing.");

        console.log(`Hangman: DOM references obtained. Critical elements found: ${criticalElementsFound}`);
        return criticalElementsFound;
    }

    /** Clears any existing timer interval and resets elapsed time. */
    function resetTimer() {
      if (timerInterval !== null) {
         clearInterval(timerInterval);
         timerInterval = null;
         // console.log("Timer cleared.");
      }
      secondsElapsed = 0;
      updateTimerDisplay(); // Set display to 00:00
    }

    /** Starts the game timer, updating every second. */
    function startTimer() {
      resetTimer(); // Ensure no previous timer is running
      gameActive = true; // Mark game as active
      console.log("Timer started.");
      timerInterval = setInterval(() => {
        // Safety check: stop timer if game becomes inactive unexpectedly
        if (!gameActive) {
             console.warn("Timer interval detected inactive game, stopping timer.");
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
            console.log("Timer stopped.");
        }
        gameActive = false; // Mark game as inactive whenever timer stops
    }


    /** Updates the timer display element (e.g., "01:23"). */
    function updateTimerDisplay() {
      if (!timerDisplay) return; // Do nothing if element not found
      const minutes = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
      const seconds = String(secondsElapsed % 60).padStart(2, '0');
      timerDisplay.textContent = `${minutes}:${seconds}`;
    }

    /**
     * Fetches course data JSON, populates the chapter dropdown,
     * and handles pre-selection based on URL parameters.
     */
    function loadCourseDataAndMenu() {
      if (!selectWrapper || !chapterSelect) {
        console.error("Hangman: Cannot load chapters - chapter selection elements not found.");
        if(hintText) { hintText.textContent = 'Error: UI elements missing.'; hintText.style.display = 'block'; }
        if(newGameButton) newGameButton.disabled = true;
        return;
      }

      const courseDataFile = `${course}.json`;
      // Use the global DATA_PATH from window object
      if (!window.DATA_PATH) {
           console.error("Hangman: Global window.DATA_PATH is not defined!");
           if(hintText) { hintText.textContent = 'Error: Configuration missing.'; hintText.style.display = 'block'; }
           if(newGameButton) newGameButton.disabled = true;
           return;
      }
      const courseDataPath = `${window.DATA_PATH}${courseDataFile}`;

      // Update dynamic title elements if they exist in the loaded HTML
      const h1Title = document.querySelector('h1'); // Look for any H1 in the document
      if (h1Title) {
          h1Title.textContent = `Hangman (${course.toUpperCase()})`;
      }
      document.title = `Hangman (${course.toUpperCase()})`; // Update browser tab title

      // Show loading state
      chapterSelect.innerHTML = '<option value="">Loading chapters...</option>';
      if (hintText) { hintText.textContent = 'Loading course data...'; hintText.style.display = 'block'; }
      if (newGameButton) newGameButton.disabled = true;
      if (endGameButton) endGameButton.disabled = true;
      resetGameUI(false); // Reset UI without affecting chapter loading status

      console.log(`Hangman: Fetching course data from: ${courseDataPath}`);
      fetch(courseDataPath)
        .then(response => {
          if (!response.ok) {
              throw new Error(`Course data file not found or invalid: ${courseDataPath} (Status: ${response.status})`);
          }
          return response.json();
        })
        .then(data => {
          courseData = data; // Store data locally within IIFE scope
          console.log("Hangman: Course data loaded successfully", courseData ? "✓" : "✗");

          if (!courseData || !Array.isArray(courseData.chapters) || courseData.chapters.length === 0) {
            throw new Error('Invalid or empty course data structure in JSON file.');
          }

          // Build dropdown HTML dynamically
          let selectHTML = '<option value="">-- Select Chapter --</option>';
          courseData.chapters.forEach(chapter => {
            // Ensure chapter has necessary properties
            const chapterRef = chapter.chapter_ref || `Ch ${chapter.chapter_id || 'Unknown'}`;
            const chapterTitle = chapter.chapter_title || 'Untitled Chapter';
            const chapterId = chapter.chapter_id;
            if (!chapterId) {
                 console.warn("Skipping chapter due to missing chapter_id:", chapter);
                 return; // Skip chapters without an ID
            }
            const displayText = `${chapterRef}: ${chapterTitle}`;
            selectHTML += `<option value="${chapterId}">${displayText}</option>`;
          });
          chapterSelect.innerHTML = selectHTML; // Replace loading text with options

          setupChapterDropdownListener(); // Set up listener for the dropdown

          if(hintText) hintText.textContent = 'Please select a chapter.'; // Update hint

          // Check for chapter pre-selection from URL params (window.gameParams)
          const chapterIdFromParams = window.gameParams ? window.gameParams.chapter : null;
          if (chapterIdFromParams) {
            // Check if the chapter ID from params actually exists in the loaded data
            const chapterExists = courseData.chapters.some(ch => ch.chapter_id === chapterIdFromParams);
            if (chapterExists) {
              console.log(`Hangman: Pre-selecting chapter from URL: ${chapterIdFromParams}`);
              chapterSelect.value = chapterIdFromParams; // Set dropdown value
              loadChapter(chapterIdFromParams); // Load data for this chapter
              
              // Hide chapter selection area as required when preselected from URL
              if(selectWrapper) {
                selectWrapper.style.display = 'none'; // Hide on all devices when preselected
              }
            } else {
               console.warn(`Hangman: Chapter ID "${chapterIdFromParams}" from URL not found in course data.`);
               resetGameUI(true); // Reset UI, keep prompt to select chapter
            }
          }
        })
        .catch(error => {
          console.error('Hangman: Error loading or processing course data:', error);
          chapterSelect.innerHTML = '<option value="">Error loading chapters!</option>';
          if(hintText) { hintText.textContent = `Failed to load course data. ${error.message}`; hintText.style.display = 'block'; }
          if (newGameButton) newGameButton.disabled = true;
          courseData = null; // Ensure courseData is null on error
          resetGameUI(true);
        });
    }

    /**
     * Resets the game UI elements to their default state (e.g., clears word display, keyboard).
     * @param {boolean} promptSelectChapter - If true, shows the "Select a chapter" message.
     */
     function resetGameUI(promptSelectChapter = true) {
        // console.log("Resetting Game UI...");
        // Reset core game variables that affect UI state directly
        guessedLetters = [];
        wrongGuesses = 0;
        gameActive = false; // Ensure game is marked inactive during UI reset

        if (wrongGuessesDisplay) wrongGuessesDisplay.innerText = wrongGuesses;
        if (wordDisplay) wordDisplay.innerHTML = ''; // Clear the word display area
        if (keyboardContainer) keyboardContainer.innerHTML = ''; // Clear the keyboard area

        // MODIFIED: Handle hintText visibility
        if (hintText) {
            hintText.style.display = 'none'; // Hide hint by default on reset
            hintText.textContent = ''; // Clear any previous win/loss message
        }

        if (definitionDisplay) {
             if (promptSelectChapter) {
                definitionDisplay.innerText = 'Select a chapter to start!';
                if (hintText) { // Show prompt in hint area if definition area is used this way
                     hintText.textContent = 'Please select a chapter.';
                     hintText.style.display = 'block';
                }
             } else if (!gameActive && terms.length > 0) {
                 // If reset happens AFTER loading a chapter but BEFORE starting game
                 definitionDisplay.innerText = 'Click New Game!';
             } else if (!gameActive && chapterSelect && chapterSelect.value && terms.length === 0) {
                  // If reset happens after loading a chapter with NO terms
                  definitionDisplay.innerText = 'No terms found in this chapter.';
                  if (hintText) {
                       hintText.textContent = 'No terms found. Select another chapter.';
                       hintText.style.display = 'block';
                  }
             } else {
                 // Default state or loading state
                 // definitionDisplay.innerText = 'Loading...'; // Or keep previous content?
             }
        }

        resetTimer(); // Stop and reset the timer display

        // Hide all hangman parts by removing the 'show' class
        if (partsElements) partsElements.forEach(part => part?.classList.remove('show'));

        // Update max guesses display based on current difficulty selection
        if (difficultySelect) {
            maxWrongGuesses = parseInt(difficultySelect.value, 10) || 6;
        } else {
             maxWrongGuesses = 6; // Default if no difficulty selector
        }
        if (maxGuessesDisplay) maxGuessesDisplay.innerText = maxWrongGuesses;

        // MODIFIED: Ensure hint is hidden when resetting if not prompting
        if (hintText && !promptSelectChapter) {
             hintText.style.display = 'none';
        }
        
				if (endGameButton) endGameButton.disabled = true; // Can't end if not started/reset
        enableDifficulty(); // Allow difficulty change before a new game starts
        enableNewGameButton(); // This function now also manages hint visibility based on state
        document.querySelectorAll('.ribbon').forEach(ribbon => ribbon.remove()); // Clean up any leftover win animation elements
    }


    /**
     * Loads the terms and definitions for a specific chapter ID.
     * @param {string} chapterId - The unique ID of the chapter to load.
     */
    function loadChapter(chapterId) {
        // Reset game state related to the *previous* chapter before loading new one
        resetGameUI(false); // Reset UI but don't prompt selection yet
        terms = [];
        definitions = [];

        if (!chapterId) {
            console.warn("Hangman: loadChapter called with no chapterId.");
            resetGameUI(true); // Reset UI and prompt selection
            return;
        }
        if (!courseData) {
            console.error("Hangman: Attempted to load chapter before course data was available.");
            if (hintText) { hintText.textContent = 'Error: Course data not loaded.'; hintText.style.display = 'block'; }
            resetGameUI(true);
            return;
        }

        console.log(`Hangman: Loading chapter data for ID: ${chapterId}`);
        if (hintText) { hintText.textContent = 'Processing chapter...'; hintText.style.display = 'block'; }
        if (definitionDisplay) definitionDisplay.innerText = 'Loading terms...';

        const chapter = courseData.chapters.find(ch => ch.chapter_id === chapterId);

        if (!chapter || !Array.isArray(chapter.term_definitions)) {
            console.error(`Hangman: Chapter data not found or invalid for ID: ${chapterId}`);
            if(hintText) { hintText.textContent = `Failed to load chapter data for ID ${chapterId}.`; hintText.style.display = 'block'; }
            resetGameUI(true); // Reset UI, prompt selection again
            return;
        }

        // Filter for valid term/definition pairs (both must exist and be non-empty strings)
        const validTermDefs = chapter.term_definitions.filter(td =>
             td && typeof td.term === 'string' && td.term.trim() &&
             typeof td.definition === 'string' && td.definition.trim()
        );
        terms = validTermDefs.map(td => td.term.trim());
        definitions = validTermDefs.map(td => td.definition.trim());

        if (terms.length === 0) {
            console.warn(`Hangman: Chapter ID ${chapterId} loaded but contains no valid terms.`);
            if(hintText) { hintText.textContent = `No terms found in this chapter. Select another.`; hintText.style.display = 'block'; }
            if (definitionDisplay) definitionDisplay.innerText = 'No terms found in this chapter.';
        } else {
            console.log(`Hangman: Loaded ${terms.length} terms for chapter ID ${chapterId}`);
            if(hintText) hintText.style.display = 'none'; // Hide hint if terms loaded successfully
            if (definitionDisplay) definitionDisplay.innerText = 'Click New Game!'; // Prompt to start
        }

        enableNewGameButton(); // Update button state now that terms (or lack thereof) are known
    }

    /** Enables or disables the "New Game" button based on game state and data availability. */
    function enableNewGameButton() {
      const chapterSelected = chapterSelect && chapterSelect.value;
      const termsAvailable = terms && terms.length > 0;
      // Can enable ONLY if a chapter is selected, terms are loaded, and game is NOT active
      const canEnable = chapterSelected && termsAvailable && !gameActive;

      // console.log(`EnableNewGame Check: chapterSelected=${!!chapterSelected}, termsAvailable=${termsAvailable}, gameActive=${gameActive}, canEnable=${canEnable}`);

      if (newGameButton) {
        newGameButton.disabled = !canEnable;
        // console.log(`EnableNewGame: Setting newGameButton.disabled = ${!canEnable}`);
      } else {
         // This shouldn't happen if getDOMReferences worked, but log error if it does
         console.error("EnableNewGameButton: newGameButton reference is missing!");
      }

      // MODIFIED: Manage hint visibility based on state (ensure win/loss message is cleared if showing prompts)
      if (hintText) {
        if (gameActive) {
            hintText.style.display = 'none'; // Hide hints/messages during active game
            hintText.textContent = ''; // Clear text
        } else if (canEnable) {
            hintText.style.display = 'none'; // Ready to play, hide hint
             hintText.textContent = ''; // Clear text
        } else if (!chapterSelected) {
            hintText.textContent = 'Select a chapter first!';
            hintText.style.display = 'block';
        } else if (!termsAvailable) { // Chapter selected, but no terms
            hintText.textContent = 'No terms found in this chapter.';
            hintText.style.display = 'block';
        } else {
            // If game just ended, the win/loss message might be showing.
            // Don't automatically hide it here unless a new action makes it irrelevant.
            // Visibility is set in checkWin/checkLoss and reset in resetGameUI.
        }
			}
      // End game button should only be enabled when a game is active
      if (endGameButton) {
          endGameButton.disabled = !gameActive;
      }
    }

    /** Starts a new Hangman game round. */
    function startNewGame() {
      if (!gameActive) {
          soundManager.play('newGame');
          // Prevent starting if requirements not met
          if (!terms || terms.length === 0) {
              console.warn("Hangman: Cannot start new game, no terms available.");
              if (hintText) { hintText.textContent = 'No terms available. Select a different chapter.'; hintText.style.display = 'block';}
              return; // Do not proceed
          }
          if (gameActive) {
              console.warn("Hangman: Tried to start a new game while one is already active.");
              return; // Don't start if already active
          }

          console.log("Hangman: Starting new game...");
          // Reset game state variables for the new round
          guessedLetters = [];
          wrongGuesses = 0;
          currentWord = '';
          currentDefinition = '';

          // Update UI for new game start
          if (wrongGuessesDisplay) wrongGuessesDisplay.innerText = wrongGuesses;
          if (wordDisplay) wordDisplay.innerHTML = ''; // Clear previous word display
          if (keyboardContainer) keyboardContainer.innerHTML = ''; // Clear previous keyboard
          if (partsElements) partsElements.forEach(part => part?.classList.remove('show')); // Hide hangman parts
          document.querySelectorAll('.ribbon').forEach(ribbon => ribbon.remove()); // Clean up win animation

          // ADD: Attach keyboard listener
          window.addEventListener('keydown', handleKeyPress); // <<<--- ADD THIS LINE

          disableDifficulty(); // Prevent changing difficulty mid-game
          startTimer(); // Resets and starts the game timer, marks gameActive = true

          // Select a random term/definition pair from the loaded chapter data
          const index = Math.floor(Math.random() * terms.length);
          let selectedTerm = terms[index] || '';
          currentDefinition = definitions[index];

          // Remove parentheses and their contents for display/gameplay purposes
          // This keeps the original term intact in the definition but removes parentheses for guessing
          currentWord = selectedTerm.toUpperCase().replace(/\(.*?\)/g, '').trim();

          // If the term had only content in parentheses (unlikely, but possible), don't leave an empty word
          if (currentWord === '') {
              currentWord = selectedTerm.toUpperCase();
          }
          // Basic validation of selected pair
          if (typeof currentWord !== 'string' || currentWord.length === 0 || typeof currentDefinition !== 'string') {
            console.error(`Hangman: Invalid data retrieved at index ${index} for chapter. Term: '${currentWord}', Def: '${currentDefinition}'`);
            if (hintText) { hintText.textContent = 'Error: Invalid term/definition data encountered. Try selecting chapter again.'; hintText.style.display = 'block';}
            stopTimer(); // Stop timer as game failed to start properly
            enableDifficulty();
            resetGameUI(true); // Reset UI fully
            return; // Abort start
          }
          // console.log(`Hangman: Selected word (for debugging): ${currentWord}`); // Avoid logging answer in production

          // Display the definition and set up the game board
          if (definitionDisplay) definitionDisplay.innerText = currentDefinition;
          displayWord(); // Display underscores for the word length
          createKeyboard(); // Create clickable keyboard buttons

          // Update button states for active game
          if (endGameButton) endGameButton.disabled = false; // Enable End Game button
          if (newGameButton) newGameButton.disabled = true; // Disable New Game button
          if (hintText) hintText.style.display = 'none'; // Hide hints during active game

          console.log("Hangman: New game started successfully.");
      }
    }

    /**
     * Ends the current game, optionally revealing the answer.
     * @param {boolean} revealAnswer - If true, display the word with missed letters highlighted.
     */
    function endGame(revealAnswer = false) {
      if (gameActive) {
          soundManager.play('endGame');
          console.log(`Hangman: Ending game. Reveal answer: ${revealAnswer}`);
          stopTimer(); // Stops timer and marks gameActive = false

          // ADD: Remove keyboard listener
          window.removeEventListener('keydown', handleKeyPress); // <<<--- ADD THIS LINE

          enableDifficulty(); // Re-enable difficulty selection for next game

          // Disable keyboard interactions
          const keyboardButtons = keyboardContainer?.querySelectorAll('button');
          if (keyboardButtons) keyboardButtons.forEach(btn => btn.disabled = true);

          if (revealAnswer) {
            displayWord('lose'); // Show missed letters in red
          }

          enableNewGameButton(); // Update button states (New Game should become enabled)
          console.log("Hangman: Game ended.");
      }
    }

    /** Disables the difficulty dropdown. */
    function disableDifficulty() { if (difficultySelect) difficultySelect.disabled = true; }
    /** Enables the difficulty dropdown. */
    function enableDifficulty() { if (difficultySelect) difficultySelect.disabled = false; }

		/**
     * Updates the word display area with underscores or letters, wrapping words correctly.
     * @param {'win' | 'lose' | null} [winLoseState=null] - Optional state to control display style after game ends.
     */
    function displayWord(winLoseState = null) {
        if (!wordDisplay) return;
        wordDisplay.innerHTML = ''; // Clear previous state
        if (!currentWord) return; // Exit if no word is set

        const words = currentWord.split(/(\s+)/); // Split by spaces, keeping spaces as elements

        words.forEach(wordPart => {
            if (wordPart.trim().length === 0) {
                // It's a space or multiple spaces
                const spaceElement = document.createElement('div');
                spaceElement.classList.add('word-space');
                // Add multiple space elements if needed, or adjust styling
                spaceElement.innerHTML = ' '.repeat(wordPart.length > 1 ? 2 : 1); // Add non-breaking spaces visually
                wordDisplay.appendChild(spaceElement);
            } else {
                // It's a word
                const wordSpan = document.createElement('span');
                wordSpan.classList.add('hangman-word'); // Class for styling the word wrapper

                [...wordPart].forEach(char => {
                    const letterElement = document.createElement('div');
                    letterElement.classList.add('word-letter'); // Keep this for individual letter styling

                    if (winLoseState === 'win') {
                        letterElement.innerText = char;
                        letterElement.classList.add('revealed-correct');
                    } else if (winLoseState === 'lose') {
                        letterElement.innerText = char;
                        letterElement.classList.add(guessedLetters.includes(char) ? 'revealed-correct' : 'revealed-wrong');
                    } else if (guessedLetters.includes(char)) {
                        letterElement.innerText = char;
                    } else {
                        letterElement.innerText = ''; // Underscore handled by CSS border
                    }
                    wordSpan.appendChild(letterElement);
                });
                wordDisplay.appendChild(wordSpan);
            }
        });
    }

		/** Creates and displays the interactive keyboard buttons. */
    function createKeyboard() {
      if (!keyboardContainer) return;
      keyboardContainer.innerHTML = ''; // Clear previous keyboard
      // Create a button for each letter, digit, and symbol
      // MODIFIED: Added 0-9, -, /
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/'.split('').forEach(char => { // <<<--- CHANGED HERE
        const btn = document.createElement('button');
        btn.innerText = char;
        btn.addEventListener('click', () => handleGuess(char, btn));
        // If game resets but keeps state (unlikely now), re-disable guessed letters:
        // if (guessedLetters.includes(letter)) btn.disabled = true;
        keyboardContainer.appendChild(btn);
      });
    }

    /** Plays an error sound when a wrong guess is made */
    function playErrorSound() {
        soundManager.play('wrong');
    }

    /**
     * Handles the logic when a player clicks a letter button on the keyboard.
     * @param {string} letter - The letter that was guessed.
     * @param {HTMLButtonElement} btn - The button element that was clicked.
     */
    function handleGuess(letter, btn) {
        if (!gameActive || guessedLetters.includes(letter)) return;

        guessedLetters.push(letter);
        btn.disabled = true;

        if (currentWord.includes(letter)) {
            soundManager.play('correct');
            console.log(`Guess ${letter} is CORRECT`);
            btn.classList.add('correct'); // Style button as correct
            displayWord(); // Update word display to reveal the letter
            checkWin(); // Check if this correct guess results in a win
        } else {
            playErrorSound(); // This now uses soundManager.play('wrong')
            console.log(`Guess ${letter} is WRONG`);
            btn.classList.add('wrong'); // Style button as wrong
            wrongGuesses++;
            if (wrongGuessesDisplay) wrongGuessesDisplay.innerText = wrongGuesses; // Update wrong guess count display

            // Reveal the next part of the hangman drawing
            if (wrongGuesses > 0 && wrongGuesses <= partsElements.length) {
              const partToShow = partsElements[wrongGuesses - 1]; // Get the part corresponding to the guess count
              if (partToShow) {
                  partToShow.classList.add('show'); // Make the part visible (e.g., change color via CSS)
                  console.log(`Showing hangman part ${wrongGuesses}`);
              } else {
                  console.warn(`Could not find hangman part element for wrong guess number ${wrongGuesses}`);
              }
            } else if (wrongGuesses > partsElements.length) {
                // This case handles difficulties where maxWrongGuesses might be > 6
                console.warn(`Wrong guesses (${wrongGuesses}) exceeds available SVG parts (${partsElements.length})`);
            }
            checkLoss(); // Check if this incorrect guess results in a loss
        }
    }

/**
     * Handles physical keyboard key presses for guessing letters.
     * @param {KeyboardEvent} event - The keydown event object.
     */
    function handleKeyPress(event) {
        if (!gameActive) return; // Only process keys if game is active

        const key = event.key.toUpperCase();
        const rawKey = event.key;

        // Define valid characters (match the on-screen keyboard)
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/';

        // Check if it's an invalid character first
        const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete'];

        if (!validChars.includes(key)) {
            // --- Invalid Game Key ---
            if (!ignoredKeys.includes(rawKey) && !event.ctrlKey && !event.metaKey && !event.altKey) {
                 console.log(`Invalid key pressed: ${rawKey}`);
                 event.preventDefault(); // Prevent default action for invalid keys
                 playErrorSound();
                 if (gameContainer) {
                    gameContainer.classList.add('error-flash');
                    setTimeout(() => {
                        gameContainer?.classList.remove('error-flash');
                    }, 400);
                 }
            }
            // If it was an ignored key, do nothing and exit
            return;
        }

        // --- If we reach here, the key IS a valid game character (A-Z, 0-9, -, /) ---
        event.preventDefault(); // Prevent default actions for valid game keys too

        let targetButton = null;
        if (keyboardContainer) {
            // Find the specific button for the pressed key
            const buttons = keyboardContainer.querySelectorAll('button');
            buttons.forEach(btn => {
                if (btn.innerText === key) {
                    targetButton = btn;
                }
            });
        }

        if (targetButton) {
            // Button found, now check if it's disabled (already guessed)
            if (targetButton.disabled) {
                // --- Repeated Valid Key Press ---
                console.log(`Repeated key press for already guessed: ${key}`);
                playErrorSound(); // Play error sound
                // Trigger visual feedback (flash)
                if (gameContainer) {
                    gameContainer.classList.add('error-flash');
                    setTimeout(() => {
                        gameContainer?.classList.remove('error-flash');
                    }, 400); // Match CSS animation duration
                }
            } else {
                // --- First Time Valid Key Press ---
                // Button exists and is ENABLED: Process the guess by simulating click
                targetButton.click();
            }
        } else {
            // Button not found for a valid character (shouldn't happen if keyboard is built correctly)
            console.warn(`Keyboard button for valid key '${key}' not found.`);
        }
    }

    /** Checks if the player has won the game. */
    function checkWin() {
      // Must have a word and game must be active
      if (!currentWord || !gameActive) return;

      // Get all unique letters in the word (ignoring spaces and case)
      const wordLetters = [...new Set(currentWord.replace(/\s/g, ''))];

      // Check if every unique letter in the word is present in the guessedLetters array
      // Also handle edge case where the word might be empty or only spaces (should be prevented by validation)
      const allGuessed = wordLetters.length > 0 && wordLetters.every(letter => guessedLetters.includes(letter));
      const emptyWordWin = currentWord.length > 0 && wordLetters.length === 0; // e.g., word was " "

      if (allGuessed || emptyWordWin) {
          console.log("Hangman: Player WINS!");

          // MODIFIED: Use hintText for win message
          if (hintText) {
              hintText.textContent = "🎉 You Won! 🎉";
              hintText.style.display = 'block'; // Make sure hint area is visible
          } else { // Fallback if hintText is missing
              if (definitionDisplay) definitionDisplay.innerText = "🎉 You Won! 🎉";
          }

          displayWord('win'); // Show full word styled as 'win'
          showWinAnimation(); // Trigger visual celebration
          endGame(false); // End the game, don't reveal answer (already won)
          soundManager.play('win');
      }
    }

    /** Checks if the player has lost the game. */
    function checkLoss() {
      if (!gameActive) return;
      if (wrongGuesses >= maxWrongGuesses) {
        console.log("Hangman: Player LOSES!");
        // MODIFIED: Use hintText for lose message
        if (hintText) {
             hintText.textContent = `😢 You Lost! The word was: ${currentWord}`;
             hintText.style.display = 'block'; // Make sure hint area is visible
        } else { // Fallback
             if (definitionDisplay) definitionDisplay.innerText = `😢 You Lost! The word was: ${currentWord}`;
        }
        endGame(true);
        soundManager.play('lose');
      }
    }

    /** Displays a simple win animation (e.g., floating ribbons). */
    function showWinAnimation() {
        if (!document.body) return;
        // Try to contain ribbons within the game area or content area if possible
        const container = document.querySelector('.game-container') || document.getElementById('content-area') || document.body;
        const rect = container.getBoundingClientRect();

        for (let i = 0; i < 25; i++) { // Create multiple ribbon elements
            const ribbon = document.createElement('div');
            ribbon.classList.add('ribbon'); // Assign CSS class for styling and animation

            // Position randomly near the bottom of the container/viewport
            const startX = Math.random() * rect.width + rect.left + window.scrollX;
            const startY = rect.bottom + window.scrollY - Math.random() * 50 - 20; // Start slightly above bottom edge

            ribbon.style.position = 'absolute'; // Ensure absolute positioning
            ribbon.style.left = `${startX}px`;
            ribbon.style.top = `${startY}px`;
            ribbon.style.backgroundColor = `hsl(${Math.random() * 360}, 100%, 70%)`; // Random color
            // Randomize animation parameters slightly
            const duration = Math.random() * 1.5 + 2.5;
            const delay = Math.random() * 0.5;
            ribbon.style.animationDuration = `${duration}s`;
            ribbon.style.animationDelay = `${delay}s`;

            document.body.appendChild(ribbon); // Append to body to ensure visibility above other elements

            // Remove the ribbon element after its animation completes + buffer
            setTimeout(() => ribbon.remove(), (duration + delay) * 1000 + 500);
        }
    }


    // ===== Event Listeners Setup =====

    /** Sets up initial event listeners for buttons and controls. */
    function setupEventListeners() {
      console.log("Hangman: Setting up event listeners...");

      // Difficulty Changer
      if (difficultySelect) {
        // Use a named function or remove/re-add listener carefully if needed,
        // but with IIFE, direct attachment is usually fine once.
        difficultySelect.addEventListener('change', handleDifficultyChange);
      } else {
           console.warn("Difficulty select element not found during listener setup.");
      }

      // New Game Button
      if (newGameButton) {
        newGameButton.addEventListener('click', startNewGame);
      } else {
           // This is critical, should have been caught by getDOMReferences
           console.error("New Game button element not found during listener setup.");
      }

      // End Game Button
      if (endGameButton) {
        endGameButton.addEventListener('click', handleEndGameClick);
      } else {
           console.warn("End Game button element not found during listener setup.");
      }

      console.log("Hangman: Event listeners setup complete.");
    }

     /** Attaches the event listener to the chapter dropdown. */
    function setupChapterDropdownListener() {
      if (!chapterSelect) {
        console.error("Hangman: Cannot setup listener: chapterSelect is not available.");
        // Attempt to find it again in case it was just added to DOM
        chapterSelect = document.getElementById('chapterSelect');
        if (!chapterSelect) {
             console.error("Hangman: Still cannot find chapterSelect after re-check. Listener not attached.");
             return; // Give up if still not found
        }
      }
      // Remove listener first? Only needed if this function could somehow be called multiple times
      // without the element being replaced. With innerHTML replacement, it's usually safe.
      // chapterSelect.removeEventListener('change', handleChapterChange);
      chapterSelect.addEventListener('change', handleChapterChange);
      console.log("Hangman: Chapter dropdown listener attached.");
    }

    // --- Event Handler Functions ---

    function handleDifficultyChange() {
        if (!difficultySelect) return;
        const newMax = parseInt(difficultySelect.value, 10);
        if (isNaN(newMax) || newMax < 1) {
            console.warn("Invalid difficulty value selected:", difficultySelect.value);
            // Optionally revert to previous value or a default
            difficultySelect.value = maxWrongGuesses.toString();
            return;
        }
        console.log(`Difficulty changed to: ${newMax} max wrong guesses.`);
        maxWrongGuesses = newMax; // Update the setting
        if (maxGuessesDisplay) maxGuessesDisplay.innerText = maxWrongGuesses; // Update display

        // If game is active, changing difficulty usually applies to the *next* game.
        // Force-ending the current game might be jarring.
        if (gameActive) {
           console.log("Difficulty change will apply to the next game.");
           // To end current game immediately:
           // if (confirm("Changing difficulty mid-game will end the current word. Continue?")) {
           //   endGame(true); // End and reveal
           // } else {
           //   difficultySelect.value = (/* store previous maxWrongGuesses */).toString(); // Revert dropdown if cancelled
           //   maxWrongGuesses = /* restore previous */; // Restore setting
           //   if (maxGuessesDisplay) maxGuessesDisplay.innerText = maxWrongGuesses;
           // }
        }
    }

    function handleEndGameClick() {
        if (gameActive) {
            // Optional: Confirm before ending
            // if (confirm("Are you sure you want to end this game? The word will be revealed.")) {
                 console.log("User initiated End Game.");
                 endGame(true); // End and reveal the answer
            // }
        } else {
            console.log("End Game button clicked but game not active.");
        }
    }

    function handleChapterChange() {
        if (!chapterSelect) return;
        const selectedChapterId = chapterSelect.value;
        console.log(`Chapter selection changed to: ${selectedChapterId || 'None'}`);
        // If a game is active when chapter changes, end it (without reveal)
        if (gameActive) {
            console.log("Chapter changed mid-game. Ending current game.");
            endGame(false); // End game gracefully
        }
        // Load the selected chapter (or reset if "-- Select --" chosen)
        loadChapter(selectedChapterId);
    }

    // ===== Game Initialization Function =====
    /** Main function to initialize the Hangman game setup. */
    function initializeHangmanGame() {
      console.log("Hangman: Initializing game inside IIFE...");

      // 1. Get DOM References and check if critical ones exist
      if (!getDOMReferences()) {
        console.error("Hangman: Initialization aborted due to missing critical DOM elements.");
        // Display error to user if possible
        if(document.body) { // Basic check if body exists
             const errorMsg = document.createElement('p');
             errorMsg.textContent = "Error: Failed to initialize Hangman game UI. Check console.";
             errorMsg.style.color = 'red';
             errorMsg.style.textAlign = 'center';
             errorMsg.style.padding = '20px';
             const contentArea = document.getElementById('content-area');
             if (contentArea) contentArea.prepend(errorMsg); else document.body.prepend(errorMsg);
        }
        return; // Stop initialization
      }

      // 2. Setup Event Listeners for buttons, difficulty, etc.
      console.log("Hangman: Setting up base event listeners.");
      setupEventListeners();

      // 3. Load Course Data and Populate Chapter Dropdown
      // This function handles async data fetching and subsequent UI updates/listener setup for the dropdown
      console.log("Hangman: Initiating course data load.");
      loadCourseDataAndMenu();

      // 4. Set Initial UI State (some parts done in loadCourseDataAndMenu/resetGameUI)
      console.log("Hangman: Applying initial UI state.");
      resetGameUI(true); // Ensure UI is in default state, prompting chapter selection

      console.log("Hangman: Initialization sequence complete.");
    }

    // ===== Cleanup Function =====
    /** Cleans up resources used by the Hangman game (timers, listeners). */
    function cleanupHangman() {
        console.log("Hangman: Cleaning up...");
        // 1. Stop Timers
        if (timerInterval !== null) {
            clearInterval(timerInterval);
            timerInterval = null;
            console.log("Hangman: Timer cleared.");
        }
        gameActive = false; // Ensure game is marked inactive

        // ADD: Remove keyboard listener (ensure it's removed on cleanup)
        window.removeEventListener('keydown', handleKeyPress); // <<<--- ADD THIS LINE

        // 2. Remove Event Listeners (Optional but good practice for complex cases)
        // If you attached listeners to 'document' or 'window', remove them here.
        // Listeners on elements *within* #content-area are usually removed automatically
        // when innerHTML is replaced, but explicit removal is safest.
        // newGameButton?.removeEventListener('click', startNewGame); // Requires button ref to still be valid
        // chapterSelect?.removeEventListener('change', handleChapterChange);
        // difficultySelect?.removeEventListener('change', handleDifficultyChange);
        // endGameButton?.removeEventListener('click', handleEndGameClick);
        // Consider using AbortController for fetch/listeners if needed.

        // ADD: Close Audio Context if it was created
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close().then(() => {
                 console.log("Hangman: AudioContext closed.");
            }).catch(e => {
                 console.warn("Hangman: Error closing AudioContext:", e);
            });
            audioContext = null; // Clear reference
        }

        // 3. Null out references (helps garbage collection, optional)
        courseData = null; terms = []; definitions = []; guessedLetters = []; partsElements = [];
        difficultySelect = null; newGameButton = null; endGameButton = null; hintText = null;
        wordDisplay = null; definitionDisplay = null; keyboardContainer = null; wrongGuessesDisplay = null;
        maxGuessesDisplay = null; timerDisplay = null; selectWrapper = null; chapterSelect = null;
        hangmanSVG = null;
        console.log("Hangman: Cleanup complete.");
    }

    // ===== Assign cleanup function to global scope =====
    window.currentGameCleanup = cleanupHangman;

    // ===== Start Initialization =====
    initializeHangmanGame();

})(); // END OF IIFE