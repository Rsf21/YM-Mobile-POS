(() => {
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  if (!passwordInput || !togglePassword) return;

  togglePassword.addEventListener("click", () => {
    const show = passwordInput.type === "password";

    passwordInput.type = show ? "text" : "password";
    togglePassword.textContent = show ? "Sembunyikan" : "Tampilkan";

    togglePassword.setAttribute(
      "aria-label",
      show ? "Sembunyikan password" : "Tampilkan password",
    );
  });
})();
