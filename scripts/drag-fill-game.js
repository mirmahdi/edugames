function startDragFillGame(terms) {
  const draggablesContainer = document.getElementById('draggables');
  const blanks = document.querySelectorAll('#text-area strong');
  const feedback = document.getElementById('feedback');

  // Populate draggable terms and shuffle
  const shuffledTerms = [...terms].sort(() => Math.random() - 0.5);
  
  shuffledTerms.forEach(term => {
    const item = document.createElement('div');
    item.classList.add('draggable');
    item.textContent = term;
    item.draggable = true;

    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', term);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    draggablesContainer.appendChild(item);
  });

  blanks.forEach((blank, index) => {
    blank.addEventListener('dragover', (e) => {
      e.preventDefault();
      blank.style.borderColor = '#007BFF';
    });

    blank.addEventListener('dragleave', () => {
      blank.style.borderColor = '#ccc';
    });

    blank.addEventListener('drop', (e) => {
      e.preventDefault();
      const droppedTerm = e.dataTransfer.getData('text/plain');

      // Match term with the correct blank by index
      if (droppedTerm === terms[index]) {
        blank.textContent = droppedTerm;
        blank.style.border = '2px solid #28a745';

        // Remove draggable term from list
        const draggableItems = document.querySelectorAll('.draggable');
        draggableItems.forEach(item => {
          if (item.textContent === droppedTerm) {
            item.remove();
          }
        });

        checkCompletion();
      } else {
        feedback.textContent = `Oops! "${droppedTerm}" doesn't belong here. Try again.`;
        feedback.style.color = '#dc3545';
      }

      blank.style.borderColor = '#ccc';
    });
  });

  function checkCompletion() {
    const filled = [...blanks].every(blank => blank.textContent.trim() !== '_____');
    if (filled) {
      feedback.textContent = '✅ Well done! All blanks are correctly filled.';
      feedback.style.color = '#28a745';
    } else {
      feedback.textContent = '';
    }
  }
}
