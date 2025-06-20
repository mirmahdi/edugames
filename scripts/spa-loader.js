// scripts/spa-loader.js

document.addEventListener('DOMContentLoaded', async () => {
  console.log("SPA Loader initialized");

  // --- Base Path Calculation ---
  let basePath = '/';
  try {
      let scriptTag = document.querySelector('script[src$="spa-loader.js"]');
      if (scriptTag) {
          let scriptSrc = scriptTag.src;
          let scriptUrl = new URL(scriptSrc);
          basePath = scriptUrl.pathname.substring(0, scriptUrl.pathname.indexOf('/scripts/')) + '/';
      } else {
          let path = window.location.pathname;
          basePath = path.substring(0, path.lastIndexOf('/') + 1);
           if (!basePath.startsWith('/')) { basePath = '/' + basePath; }
      }
  } catch (e) { console.error("Error calculating base path, defaulting to '/':", e); basePath = '/'; }
  window.appBasePath = basePath;
  console.log(`Calculated Base Path: ${basePath}`);

  // --- Global Configuration ---
  window.DATA_PATH = `${window.appBasePath}data/`;
  window.DEFAULT_COURSE = 'is451'; // Fallback if needed
  window.allowedCourses = []; // Populated dynamically
  window.courseTitleMap = {}; // Populated dynamically
  window.coursesList = null; // Populated dynamically (full course objects)

  // --- DOM Element References ---
  const headerPlaceholder = document.getElementById('header-placeholder');
  const footerPlaceholder = document.getElementById('footer-placeholder');
  const contentArea = document.getElementById('content-area');
  const tooltipElement = document.getElementById('tooltip');

  // --- Game and Path Mappings ---
  const gameHtmlToFile = {
    'html/hangman.html': 'scripts/hangman.js',
    'html/matching-cards.html': 'scripts/matching-cards.js',
    'html/drag-fill.html': 'scripts/drag-fill.js',
    'html/main.html': null
  };
  const buttonIdToHtmlPath = {
    playHangmanBtn: 'html/hangman.html',
    playMatchingBtn: 'html/matching-cards.html',
    playDragFillBtn: 'html/drag-fill.html'
  };
  const gameParamToHtmlPath = {
    'hangman': 'html/hangman.html',
    'matching': 'html/matching-cards.html',
    'dragfill': 'html/drag-fill.html'
  };

  // --- Flags for State Management ---
  window.loadedDirectlyToGame = false; // Tracks initial direct game load
  window.showCourseSelection = true; // Persistent decision flag (default to show)

   // --- Fetch Course List FIRST ---
   try {
    const coursesUrl = `${window.DATA_PATH}courses.json`;
    console.log(`Fetching course list from: ${coursesUrl}`);
    const response = await fetch(coursesUrl);
    if (!response.ok) throw new Error(`Failed to fetch courses.json: ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.courses) || data.courses.length === 0) {
        throw new Error("Invalid or empty courses data structure in courses.json");
    }
    window.coursesList = data.courses; // Store the array of course objects globally
    // Populate dynamic globals
    window.allowedCourses = window.coursesList.map(c => c.id);
    window.coursesList.forEach(c => { window.courseTitleMap[c.id] = c.title; }); // Populate global map
    console.log("Successfully loaded course list:", window.allowedCourses);

  } catch (error) {
    console.error("FATAL: Could not load courses.json. Application cannot proceed reliably.", error);
    contentArea.innerHTML = `<p style='color:red; text-align: center;'>Error: Could not load necessary course configuration.</p>`;
    // Optionally hide header/footer if core config fails
    if(headerPlaceholder) headerPlaceholder.innerHTML = '';
    if(footerPlaceholder) footerPlaceholder.innerHTML = '';
    return; // Stop execution
  }
  // --- End Fetch Course List ---


  // --- URL Parameter Parsing ---
  function parseUrlParams(query) {
    const params = {};
    const searchParams = new URLSearchParams(query);
    searchParams.forEach((value, key) => {
        params[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return params;
  }
  // Initialize global game parameters object from current URL search string
  window.gameParams = parseUrlParams(window.location.search);
  console.log("Initial window.gameParams:", window.gameParams);

  // --- Determine initial course selection visibility (Runs ONCE) ---
  const initialCourseParam = window.gameParams.course;
  if (initialCourseParam && window.allowedCourses.includes(initialCourseParam)) {
      console.log(`Initial load: Valid course '${initialCourseParam}' found. Course selection will be hidden persistently.`);
      window.showCourseSelection = false; // Set persistent flag to HIDE
  } else {
      if (initialCourseParam) { console.warn(`Initial load: Course '${initialCourseParam}' invalid/disallowed. Selection will be shown.`); }
      else { console.log("Initial load: No course parameter. Selection will be shown."); }
      window.showCourseSelection = true; // Set persistent flag to SHOW
      // Clear invalid course from initial state immediately
      if (initialCourseParam && !window.allowedCourses.includes(initialCourseParam)){
          delete window.gameParams.course;
      }
  }
  // --- End initial visibility decision ---


  // --- Core Functions ---

  /** Updates the header: home button visibility and course title display. */
  function updateHeader() {
    const homeButton = document.getElementById('home-button');
    const courseTitleDiv = document.getElementById('header-course-title');
    const currentContentUrl = contentArea.dataset.loadedUrl || ''; // Get tracked URL

    // 1. Update Course Title
    if (courseTitleDiv) {
        const currentCourseId = window.gameParams.course;
        // Use the dynamically loaded global map
        courseTitleDiv.textContent = (currentCourseId && window.courseTitleMap[currentCourseId])
                                     ? window.courseTitleMap[currentCourseId]
                                     : ''; // Show title or clear if no valid course
    } else { console.warn("Header course title placeholder not found during updateHeader."); }

    // 2. Update Home Button Visibility
    if (homeButton) {
        const isGamePage = !!gameHtmlToFile[currentContentUrl] && currentContentUrl !== 'html/main.html';
        // Show if it's a game page AND not the initial direct load
        homeButton.style.display = (isGamePage && !window.loadedDirectlyToGame) ? 'block' : 'none';
    } else { console.warn("Home button not found during updateHeader."); }
  }


  /** Loads HTML content, calls cleanup, updates content, handles post-load actions. */
  async function loadHTML(url, targetElement) {
    if (!url || !targetElement) {
        console.error("loadHTML: Invalid URL or targetElement.", { url, targetElement });
        return;
    }
    const fullUrl = `${window.appBasePath}${url}`;
    try {
      // console.log(`Loading HTML: ${fullUrl}`); // Verbose
      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`Fetch failed for ${url}: ${response.status}`);
      const text = await response.text();

      if (tooltipElement) tooltipElement.style.display = 'none'; // Hide tooltip

      // Call Cleanup BEFORE Injecting New HTML into main content area
      if (targetElement.id === 'content-area' && typeof window.currentGameCleanup === 'function') {
          console.log("Calling currentGameCleanup...");
          try { window.currentGameCleanup(); } catch (e) { console.error("Cleanup error:", e); }
          window.currentGameCleanup = null; // Reset reference
      }

      targetElement.innerHTML = text; // Inject content
      targetElement.dataset.loadedUrl = url; // Track loaded URL on contentArea

      // Post-load actions
      if (targetElement.id === 'content-area') {
        handleContentLoaded(url); // Handle scripts/listeners for main content
      } else if (targetElement.id === 'header-placeholder') {
        setupHomeButtonListener(); // Setup listener for header button
        updateHeader(); // Update header display immediately after loading it
      }

    } catch (error) {
        console.error(`Error loading content for ${url} into #${targetElement.id}:`, error);
        targetElement.innerHTML = `<p style='color:red; text-align: center;'>Error loading content. Check console.</p>`;
        if (targetElement.id === 'content-area') targetElement.dataset.loadedUrl = ''; // Clear tracker
    }
  }

  /** Handles post-content load: script injection, listeners, header update. */
  function handleContentLoaded(loadedUrl) {
     // Script Injection / Listener Initialization
     const gameScript = gameHtmlToFile[loadedUrl];
     if (gameScript) {
       console.log(`Game page ${loadedUrl} loaded, injecting script: ${gameScript}`);
       // Game script itself needs to check for window.gameParams.course
       setTimeout(() => injectScript(gameScript), 50);
     } else if (loadedUrl === 'html/main.html') {
       console.log("Main HTML loaded, initializing listeners.");
       initializeMainPageListeners(); // Initialize listeners for main.html
     } else {
       console.log(`Loaded non-game/non-main content: ${loadedUrl}`);
     }
     // Always update header after new content is loaded and listeners potentially attached
     updateHeader();
  }

  /** Injects script with cache busting, removing old script first. */
	function injectScript(scriptRelativePath) {
        const fullScriptSrc = `${window.appBasePath}${scriptRelativePath}`;
        // Remove existing script first
        const existingScript = document.querySelector(`script[src^="${fullScriptSrc}"]`);
        if (existingScript) {
            try { existingScript.remove(); } catch (e) { console.error(`InjectScript: Error removing:`, e); }
        }
        // Create and append new script
        const script = document.createElement('script');
        script.src = fullScriptSrc + '?_=' + Date.now(); // Cache busting
        script.type = 'text/javascript';
        script.onload = () => console.log(`InjectScript: Script loaded: ${scriptRelativePath}`);
        script.onerror = (e) => console.error(`InjectScript: Error loading script ${script.src}:`, e);
        document.body.appendChild(script);
	}

    /** Sets up the event listener for the Home button. */
    function setupHomeButtonListener() {
      const homeButton = document.getElementById('home-button');
      if (homeButton) {
          if (!homeButton.dataset.listenerAttached) {
              homeButton.addEventListener('click', handleHomeButtonClick);
              homeButton.dataset.listenerAttached = 'true';
          }
      } else { console.error("Failed to find Home button (#home-button)."); }
    }

    /** Handles Home button clicks: loads main.html, updates URL state. */
   function handleHomeButtonClick() {
       console.log("Home button clicked.");
       window.loadedDirectlyToGame = false; // Reset flag

       if (document.getElementById('home-button')) {
           document.getElementById('home-button').style.display = 'none'; // Hide button
       }

       // Clear ONLY game-specific parameters from state; keep course
       delete window.gameParams.game;
       delete window.gameParams.gameType;
       delete window.gameParams.chapter;
       delete window.gameParams.cards;
       console.log("Cleared game-specific params. Current state:", window.gameParams);

       // Load main.html content
       loadHTML('html/main.html', contentArea); // Triggers initializeMainPageListeners

       // Update URL bar: Keep ONLY course param if it exists, otherwise clear URL search
       const url = new URL(window.location);
       const courseValue = window.gameParams.course;
       if (courseValue && window.allowedCourses.includes(courseValue)) { // Ensure course is still valid
           url.search = `?course=${encodeURIComponent(courseValue)}`;
       } else {
           url.search = ''; // Clear all params if no valid course
           delete window.gameParams.course; // Ensure state matches URL
       }
       history.pushState({ page: 'main' }, 'Educational Games Hub', url.toString());
       // updateHeader() will be called by handleContentLoaded
   }


    /** Initializes listeners and UI state for main.html. */
    function initializeMainPageListeners() {
        console.log("Initializing main page listeners...");
        const currentContentArea = document.getElementById('content-area'); // Ensure we query the right area
        if (!currentContentArea || !window.coursesList) {
             console.error("Cannot initialize main listeners: contentArea or coursesList missing.");
             return;
        }

        const courseSelectionSection = currentContentArea.querySelector('.course-selection');
        const courseOptions = currentContentArea.querySelector('#courseOptions'); // Fieldset
        const selectionHint = currentContentArea.querySelector('#selectionHint');
        const playButtons = currentContentArea.querySelectorAll('.play-button');
        const gameCards = currentContentArea.querySelectorAll('.game-card');

        // Use current global state for selected course
        let selectedCourse = window.gameParams.course || null;
        let courseIsValid = selectedCourse && window.allowedCourses.includes(selectedCourse);

        // --- Apply Visibility based on the PERSISTENT flag ---
        if (courseSelectionSection) {
            courseSelectionSection.style.display = window.showCourseSelection ? 'block' : 'none';
            // console.log(`Course selection section display set to: ${courseSelectionSection.style.display}`); // Debug
        } else { console.warn("Could not find .course-selection section in main.html content."); }

        // --- Dynamically build/update radio buttons IF section is visible ---
        if (courseOptions && window.showCourseSelection) {
            // console.log("Building/updating course radio buttons."); // Debug
            let radioHTML = '<legend class="sr-only">Available Courses</legend>';
            window.coursesList.forEach(course => {
                const isChecked = course.id === selectedCourse; // Check against current state
                radioHTML += `
                    <div>
                      <input type="radio" id="main_course_${course.id}" name="main_course_select" value="${course.id}" ${isChecked ? 'checked' : ''}>
                      <label for="main_course_${course.id}">${course.title}</label>
                    </div>`;
            });
            courseOptions.innerHTML = radioHTML; // Populate fieldset

            // Attach listener to the fieldset
            if (!courseOptions.dataset.listenerAttached) {
                courseOptions.addEventListener('change', (event) => {
                    if (event.target.type === 'radio' && event.target.name === 'main_course_select') {
                        selectedCourse = event.target.value; // Update local state variable first
                        if (window.allowedCourses.includes(selectedCourse)) {
                            window.gameParams.course = selectedCourse; // Update global state
                            console.log(`Course selected via radio: ${selectedCourse}`);
                            updateHeader(); // Update header title
                            updateGameButtonStates(); // Update game buttons
                        } else { /* Error case, should not happen */ }
                    }
                });
                courseOptions.dataset.listenerAttached = 'true';
            }
        } else if (window.showCourseSelection) {
             console.warn("Course selection fieldset (#courseOptions) not found.");
        } else { /* Selection hidden, do nothing */ }


        // Function to update game button states
        function updateGameButtonStates() {
            const courseIsCurrentlyValid = selectedCourse && window.allowedCourses.includes(selectedCourse);
            if (selectionHint) { selectionHint.style.display = courseIsCurrentlyValid ? 'none' : 'block'; }
            playButtons.forEach(button => { button.disabled = !courseIsCurrentlyValid; });
        }

        // Tooltip Logic (attaching listeners)
        const localTooltipElement = document.getElementById('tooltip'); // Re-find tooltip element for safety
        if (localTooltipElement && gameCards.length > 0) {
           gameCards.forEach(card => {
                const description = card.dataset.description || "No description.";
                const buttonId = card.dataset.buttonId;
                const button = card.querySelector('.play-button') || currentContentArea.querySelector(`#${buttonId}`);
                const triggers = card.querySelectorAll('.tooltip-trigger');
                triggers.forEach(trigger => {
                  // Remove potentially old listeners before adding new ones
                  trigger.removeEventListener('mouseover', handleTooltipMouseover);
                  trigger.removeEventListener('mouseout', handleTooltipMouseout);
                  // Add listeners using named handlers defined below
                  trigger.addEventListener('mouseover', (event) => handleTooltipMouseover(event, trigger, button, description));
                  trigger.addEventListener('mouseout', handleTooltipMouseout);
                });
           });
        } else if (!localTooltipElement) { console.warn("Tooltip element not found for main page."); }

        // Tooltip Mouseover Handler (uses local 'selectedCourse' variable)
        function handleTooltipMouseover(event, trigger, button, description) {
            if (!localTooltipElement) return;
            let ttText = "";
            const isBtn = trigger.classList.contains('play-button');
            // Check validity based on the *current* local selectedCourse state
            const isCourseValidNow = selectedCourse && window.allowedCourses.includes(selectedCourse);
            ttText = (isBtn && !isCourseValidNow) ? "Please select a valid course first." : description;
            localTooltipElement.textContent = ttText;
            localTooltipElement.style.left = `${event.pageX + 10}px`;
            localTooltipElement.style.top = `${event.pageY + 15}px`;
            localTooltipElement.style.display = 'block';
       }
       // Tooltip Mouseout Handler
       function handleTooltipMouseout() {
            if (localTooltipElement) localTooltipElement.style.display = 'none';
       }

        // Play Button Click Listener (delegated, uses separate handler)
        if (!currentContentArea.dataset.playButtonListener) {
            currentContentArea.addEventListener('click', handlePlayButtonClick); // Use the specific handler below
            currentContentArea.dataset.playButtonListener = 'true';
        }

        updateGameButtonStates(); // Set initial button states
        console.log("Main page listeners initialization finished.");
    } // <<<--- End of initializeMainPageListeners


    /** Handles clicks on Play Game buttons. Loads game WITHOUT changing URL. */
    function handlePlayButtonClick(event) {
        const button = event.target.closest('.play-button');
        if (button && !button.disabled) {
            const buttonId = button.id;
            const gameHtmlUrl = buttonIdToHtmlPath[buttonId];
            // Validate using current global state
            const currentSelectedCourse = window.gameParams.course;
            const courseIsValidOnClick = currentSelectedCourse && window.allowedCourses.includes(currentSelectedCourse);

            if (gameHtmlUrl && courseIsValidOnClick) {
                // Set gameType and specific game params in global state
                if (buttonId === 'playMatchingBtn') {
                    window.gameParams.gameType = 'matching';
                    const mainContentArea = document.getElementById('content-area'); // Need context
                    const numSelect = mainContentArea?.querySelector('#matchingCardsNum');
                    if (numSelect && numSelect.value) window.gameParams.cards = numSelect.value;
                    else delete window.gameParams.cards;
                 } else if (buttonId === 'playDragFillBtn') {
                     window.gameParams.gameType = 'dragfill';
                     delete window.gameParams.cards;
                 } else if (buttonId === 'playHangmanBtn') {
                     window.gameParams.gameType = 'hangman';
                     delete window.gameParams.cards;
                 } else { delete window.gameParams.gameType; }

                console.log("Loading game via button click. Params:", window.gameParams);
                window.loadedDirectlyToGame = false; // Set flag: Navigating manually

                loadHTML(gameHtmlUrl, contentArea); // Load game content

                // --- URL Update Disabled ---
                console.log("URL update disabled for main page game selection.");
                // history.pushState() is intentionally omitted here.
                // --- End URL Update Disabled ---

            } else if (!courseIsValidOnClick) { console.warn("Play click ignored: No valid course selected."); button.disabled = true; }
            else { console.warn(`No game URL found for button ID: ${buttonId}`); }
        } else if (button && button.disabled) { /* Click on disabled button */ }
    } // <<<--- End of handlePlayButtonClick


  // --- Initial Page Load Sequence ---
  console.log("Performing initial page routing...");
  try {
    // window.showCourseSelection flag was determined after fetching courses.json

    // Load Header & Footer first
    await loadHTML('html/header.html', headerPlaceholder); // updateHeader called after load
    await loadHTML('html/footer.html', footerPlaceholder);
    console.log("Header and Footer loaded.");

    // Determine Initial Content
    let contentUrlToLoad = 'html/main.html';
    window.loadedDirectlyToGame = false; // Default assumption

    const initialCourse = window.gameParams.course; // Use the potentially cleaned course param
    const initialGame = window.gameParams.gameType || window.gameParams.game;

    console.log(`Checking initial params: course=${initialCourse}, game/gameType=${initialGame}`);

    // Route to game if game type is valid
    if (initialGame && gameParamToHtmlPath[initialGame]) {
        contentUrlToLoad = gameParamToHtmlPath[initialGame];
        window.loadedDirectlyToGame = true; // It's a direct load to a game view
        console.log(`Routing directly to game page: ${contentUrlToLoad}.`);
        if (!window.gameParams.gameType) window.gameParams.gameType = initialGame; // Ensure gameType

        // Check course validity for this direct game load
        if (!initialCourse || !window.allowedCourses.includes(initialCourse)) {
             console.log("Direct game load initiated WITHOUT a valid course parameter.");
             delete window.gameParams.course; // Ensure state is clean if invalid course was passed
        } else {
             console.log(`Direct game load initiated WITH valid course: ${initialCourse}`);
        }
    } else {
        // Fallback to main page
         if (initialGame && !gameParamToHtmlPath[initialGame]){
             console.warn(`Invalid initial game type requested ('${initialGame}'). Falling back to main.`);
             // Clean URL if needed
             const url = new URL(window.location); url.search = ''; history.replaceState({ page: 'main' }, 'Educational Games Hub', url.toString());
             delete window.gameParams.course; delete window.gameParams.game; delete window.gameParams.gameType; // Clear state
         }
         console.log("Routing to main page (default or fallback).");
         contentUrlToLoad = 'html/main.html';
         window.loadedDirectlyToGame = false;
         // initializeMainPageListeners will use showCourseSelection flag
    }

    // Load the determined initial content
    await loadHTML(contentUrlToLoad, contentArea); // Triggers handleContentLoaded -> updateHeader & potentially listeners/scripts
    console.log(`Initial content loaded: ${contentUrlToLoad}`);
    console.log("Initial page routing and loading complete.");

    // --- Handle Back/Forward Navigation ---
    window.addEventListener('popstate', (event) => {
        console.log("Popstate event triggered:", event.state);
        window.gameParams = parseUrlParams(window.location.search); // Update state from URL
        console.log("Params after popstate:", window.gameParams);

        const currentCourse = window.gameParams.course;
        const currentGame = window.gameParams.gameType || window.gameParams.game;
        let urlToLoad = 'html/main.html';
        window.loadedDirectlyToGame = false; // History navigation is not direct load

        // Determine content based on potentially changed URL params
        if (currentGame && gameParamToHtmlPath[currentGame]) {
            // Route to game, whether course is present or not
             urlToLoad = gameParamToHtmlPath[currentGame];
             if (currentCourse && window.allowedCourses.includes(currentCourse)){
                 console.log(`Popstate: Navigating to game with course: ${urlToLoad}`);
             } else {
                 console.log(`Popstate: Navigating to game without course: ${urlToLoad}`);
                 // Ensure course param is cleared from state if invalid/missing in URL
                  if(!window.allowedCourses.includes(currentCourse)) delete window.gameParams.course;
             }
        } else {
             // Navigate to Main page
             console.log(`Popstate: Navigating to main page.`);
             urlToLoad = 'html/main.html';
             // Ensure course param in state matches URL for main page consistency
             if (!currentCourse || !window.allowedCourses.includes(currentCourse)) delete window.gameParams.course;
        }

        loadHTML(urlToLoad, contentArea); // Load content, which will trigger header/listener updates
    });

  } catch (error) {
    console.error("FATAL Error during initial page load sequence:", error);
    if (contentArea) contentArea.innerHTML = `<p style="color: red; text-align: center;">Failed to load. Check console.</p>`;
  }

	// --- Window Resize Listener ---
	window.addEventListener('resize', handleWindowResize);
	let lastWindowWidth = window.innerWidth;
	function handleWindowResize() {
		const currentWidth = window.innerWidth;
		const breakpoint = 768;
		if ((lastWindowWidth <= breakpoint && currentWidth > breakpoint) ||
				(lastWindowWidth > breakpoint && currentWidth <= breakpoint)) {
			// console.log(`Window resized across breakpoint: ${lastWindowWidth}px -> ${currentWidth}px`);
		}
		lastWindowWidth = currentWidth;
	}
	setTimeout(handleWindowResize, 100); // Initial check

}); // End of DOMContentLoaded listener