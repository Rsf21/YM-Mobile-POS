document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("recapTableScroll");
  const leftButton = document.getElementById("recapScrollLeft");
  const rightButton = document.getElementById("recapScrollRight");

  if (!container || !leftButton || !rightButton) return;

  function updateButtons() {
    const maxScroll = container.scrollWidth - container.clientWidth;
    const canScroll = maxScroll > 2;

    leftButton.disabled = !canScroll || container.scrollLeft <= 1;
    rightButton.disabled = !canScroll || container.scrollLeft >= maxScroll - 1;
  }

  leftButton.addEventListener("click", () => {
    container.scrollBy({
      left: -250,
      behavior: "smooth",
    });
  });

  rightButton.addEventListener("click", () => {
    container.scrollBy({
      left: 250,
      behavior: "smooth",
    });
  });

  container.addEventListener("scroll", updateButtons);
  window.addEventListener("resize", updateButtons);

  updateButtons();
});
