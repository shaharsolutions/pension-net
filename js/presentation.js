      const slides = document.querySelectorAll(".slide");
      let current = 0;
      function showSlide(index) {
        slides.forEach((s, i) => s.classList.toggle("active", i === index));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      document.getElementById("nextBtn").onclick = () => {
        current = (current + 1) % slides.length;
        showSlide(current);
      };
      document.getElementById("prevBtn").onclick = () => {
        current = (current - 1 + slides.length) % slides.length;
        showSlide(current);
      };
