// ==============================
// Scroll Progress Bar
// ==============================
const scrollProgress = document.getElementById('scrollProgress');

function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    scrollProgress.style.width = progress + '%';
}

// ==============================
// Navbar Scroll Effect
// ==============================
const navbar = document.getElementById('navbar');

function updateNavbar() {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

// ==============================
// Scroll Reveal (basic)
// ==============================
const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .scale-reveal');

const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('active');
        }
    });
}, {
    threshold: 0.1,
    rootMargin: '0px 0px -60px 0px'
});

revealElements.forEach(el => revealObserver.observe(el));

// ==============================
// Staggered Reveal (feature cards)
// ==============================
const staggerElements = document.querySelectorAll('.stagger-reveal');

const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const delay = parseInt(entry.target.dataset.delay || 0);
            setTimeout(() => {
                entry.target.classList.add('active');
            }, delay * 120); // 120ms stagger between cards
        }
    });
}, {
    threshold: 0.05,
    rootMargin: '0px 0px -40px 0px'
});

staggerElements.forEach(el => staggerObserver.observe(el));

// ==============================
// Counter Animation (stats section)
// ==============================
const statNumbers = document.querySelectorAll('.stat-number');
let countersStarted = false;

function animateCounters() {
    if (countersStarted) return;
    countersStarted = true;

    statNumbers.forEach(stat => {
        const target = parseInt(stat.dataset.target);
        const duration = 2000; // 2 seconds
        const startTime = performance.now();

        function easeOutExpo(t) {
            return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
        }

        function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = easeOutExpo(progress);
            const current = Math.floor(eased * target);

            // Format with commas for thousands
            let formatted = current.toLocaleString('he-IL');
            
            // Add prefix/suffix with spans for better layout
            const prefix = stat.dataset.prefix ? `<span class="stat-prefix">${stat.dataset.prefix}</span>` : '';
            const suffix = stat.dataset.suffix ? `<span class="stat-suffix">${stat.dataset.suffix}</span>` : '';
            
            if (progress >= 1) {
                stat.innerHTML = prefix + `<span class="stat-value">${target.toLocaleString('he-IL')}</span>` + suffix;
                return;
            }

            stat.innerHTML = prefix + `<span class="stat-value">${formatted}</span>` + suffix;

            requestAnimationFrame(updateCounter);
        }

        requestAnimationFrame(updateCounter);
    });
}

const statsSection = document.querySelector('.stats-section');
if (statsSection) {
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
            }
        });
    }, { threshold: 0.3 });

    statsObserver.observe(statsSection);
}

// ==============================
// Timeline Scroll Fill
// ==============================
const timelineFill = document.getElementById('timelineFill');
const timelineSection = document.querySelector('.how-it-works-section');
const timelineItems = document.querySelectorAll('.timeline-item');

function updateTimeline() {
    if (!timelineSection || !timelineFill) return;

    const sectionRect = timelineSection.getBoundingClientRect();
    const sectionHeight = sectionRect.height;
    const viewportHeight = window.innerHeight;

    // Calculate how far through the section we've scrolled
    const scrolledIntoSection = viewportHeight - sectionRect.top;
    const progress = Math.max(0, Math.min(1, scrolledIntoSection / (sectionHeight + viewportHeight * 0.3)));

    timelineFill.style.height = (progress * 100) + '%';

    // Activate timeline items based on scroll progress
    timelineItems.forEach((item, index) => {
        const itemProgress = (index + 1) / (timelineItems.length + 0.5);
        if (progress >= itemProgress * 0.7) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ==============================
// Parallax for floating cards
// ==============================
document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.floating-card');
    const mouseX = e.clientX / window.innerWidth - 0.5;
    const mouseY = e.clientY / window.innerHeight - 0.5;

    cards.forEach((card, index) => {
        const speed = (index + 1) * 15;
        const x = mouseX * speed;
        const y = mouseY * speed;
        card.style.transform = `translate(${x}px, ${y}px)`;
    });
});

// ==============================
// Smooth Scroll for anchor links
// ==============================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ==============================
// Tilt Effect on Feature Cards
// ==============================
const featureCards = document.querySelectorAll('.feature-card');

featureCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
});

// ==============================
// Testimonial Cards Hover Glow
// ==============================
const testimonialCards = document.querySelectorAll('.testimonial-card');

testimonialCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(99, 102, 241, 0.04), white 70%)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.background = 'white';
    });
});

// ==============================
// Combined Scroll Handler (optimized via rAF)
// ==============================
let ticking = false;

window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            updateScrollProgress();
            updateNavbar();
            updateTimeline();
            ticking = false;
        });
        ticking = true;
    }
});

// Initial calls
updateScrollProgress();
updateNavbar();
