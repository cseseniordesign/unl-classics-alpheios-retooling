// ─── Questions Modal ─────────────────────────────────────────────────────────

export function setupQuestionsModal() {
    const questionsBtn   = document.getElementById('questions');
    const questionsModal = document.getElementById('questionsModal');

    if (!questionsBtn || !questionsModal) return;

    const closeBtn = questionsModal.querySelector('.close');

    questionsBtn.addEventListener('click', () => {
        questionsModal.style.display = 'flex';
    });

    closeBtn?.addEventListener('click', () => {
        questionsModal.style.display = 'none';
    });
}
