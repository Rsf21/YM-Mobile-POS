document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("faqSearch");
  const categoryButtons = document.querySelectorAll(".faq-category");
  const faqItems = document.querySelectorAll(".faq-item");
  const emptyState = document.getElementById("faqEmpty");

  let activeCategory = "all";

  function filterFaq() {
    const keyword = searchInput.value.toLowerCase().trim();
    let visibleCount = 0;

    faqItems.forEach((item) => {
      const question = item
        .querySelector(".faq-question")
        .textContent.toLowerCase();
      const answer = item
        .querySelector(".faq-answer")
        .textContent.toLowerCase();

      const matchesCategory =
        activeCategory === "all" || item.dataset.category === activeCategory;

      const matchesSearch =
        question.includes(keyword) || answer.includes(keyword);

      const visible = matchesCategory && matchesSearch;

      item.hidden = !visible;

      if (!visible) {
        item.classList.remove("open");
      }

      if (visible) visibleCount++;
    });

    emptyState.hidden = visibleCount > 0;
  }

  categoryButtons.forEach((button) => {
    button.addEventListener("click", () => {
      categoryButtons.forEach((item) => item.classList.remove("active"));

      button.classList.add("active");
      activeCategory = button.dataset.category;

      filterFaq();
    });
  });

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");

    question.addEventListener("click", () => {
      item.classList.toggle("open");
    });
  });

  searchInput.addEventListener("input", filterFaq);
});
