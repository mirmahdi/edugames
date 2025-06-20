  <!-- JavaScript (No changes needed for these updates) -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      const courseOptions = document.getElementById('courseOptions');
      const selectionHint = document.getElementById('selectionHint');
      const playButtons = document.querySelectorAll('.play-button');
      const matchingCardsNumSelect = document.getElementById('matchingCardsNum');
      const tooltipElement = document.getElementById('tooltip');
      const gameCards = document.querySelectorAll('.game-card'); // Get all game cards

      const gameUrls = {
        playHangmanBtn: 'hangman.html',
        playMatchingBtn: 'matching-cards.html',
        playDragFillBtn: 'drag-fill.html'
      };

      let selectedCourse = null;

      function updateGameLinks() {
        const courseIsSelected = !!selectedCourse; // True if a course is selected

        if (courseIsSelected) {
          selectionHint.style.display = 'none';
        } else {
          selectionHint.style.display = 'block';
        }

        playButtons.forEach(button => {
            button.disabled = !courseIsSelected; // Enable only if course is selected
            const baseUrl = gameUrls[button.id];
            if (baseUrl && courseIsSelected) {
              button.onclick = () => {
                if (!selectedCourse) return;
                let finalUrl = `${baseUrl}?course=${selectedCourse}`;
                if (button.id === 'playMatchingBtn') {
                  const cardsValue = matchingCardsNumSelect.value;
                  if (cardsValue) {
                    finalUrl += `&cards=${cardsValue}`;
                  }
                }
                window.location.href = finalUrl;
              };
            } else {
                button.onclick = null; // Remove handler if disabled
            }
        });
      }

      courseOptions.addEventListener('change', (event) => {
        if (event.target.type === 'radio' && event.target.name === 'course') {
          selectedCourse = event.target.value;
          updateGameLinks();
        }
      });

      // --- Tooltip Logic ---
      gameCards.forEach(card => {
          const description = card.dataset.description || "No description available."; // Get game description
          const buttonId = card.dataset.buttonId;
          const button = document.getElementById(buttonId);
          const triggers = card.querySelectorAll('.tooltip-trigger'); // Title container and button

          triggers.forEach(trigger => {
              trigger.addEventListener('mouseover', (event) => {
                  if (!tooltipElement) return;

                  let tooltipText = "";

                  // Check if the trigger is the button itself or inside the title container
                  const isButton = trigger.classList.contains('play-button');
                  const isTitleArea = trigger.classList.contains('game-title-container') || trigger.closest('.game-title-container');

                  if (isButton) {
                      // Button behavior: Show hint if disabled, description if enabled
                      tooltipText = (button && button.disabled) ? "Please select a course first." : description;
                  } else if (isTitleArea) {
                      // Title/Icon behavior: Always show the game description
                      tooltipText = description;
                  } else {
                      // Fallback for any other potential triggers (unlikely)
                      tooltipText = description;
                  }

                  tooltipElement.textContent = tooltipText;

                  // Positioning (relative to mouse)
                  const x = event.pageX + 10;
                  const y = event.pageY + 15;

                  tooltipElement.style.left = `${x}px`;
                  tooltipElement.style.top = `${y}px`;
                  tooltipElement.style.display = 'block'; // Show
              });

              trigger.addEventListener('mouseout', () => {
                  if (tooltipElement) {
                      tooltipElement.style.display = 'none'; // Hide
                  }
              });
          });
      });


      // Initial check
      const initiallySelected = courseOptions.querySelector('input[name="course"]:checked');
      if (initiallySelected) {
          selectedCourse = initiallySelected.value;
      }
      updateGameLinks(); // Set initial state

    });
  </script>
