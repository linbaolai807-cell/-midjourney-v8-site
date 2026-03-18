/* =============================================
   Midjourney V8 Guide - Main JavaScript
   ============================================= */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================
    // Navigation
    // =========================================
    const navbar = document.getElementById('navbar');
    const mobileToggle = document.getElementById('mobile-toggle');
    const navLinks = document.getElementById('nav-links');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            mobileToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });

        // Close mobile menu on link click
        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileToggle.classList.remove('active');
                navLinks.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }

    // =========================================
    // Prompt Generator
    // =========================================
    const subjectInput = document.getElementById('gen-subject');
    const extraInput = document.getElementById('gen-extra');
    const outputBox = document.getElementById('output-box');
    const btnCopy = document.getElementById('btn-copy');
    const btnRandom = document.getElementById('btn-random');
    const paramAr = document.getElementById('param-ar');
    const paramStylize = document.getElementById('param-stylize');
    const paramChaos = document.getElementById('param-chaos');
    const paramHd = document.getElementById('param-hd');
    const paramV8 = document.getElementById('param-v8');
    const stylizeVal = document.getElementById('stylize-val');
    const chaosVal = document.getElementById('chaos-val');

    // State
    const state = {
        subject: '',
        style: '',
        lighting: '',
        composition: '',
        extra: ''
    };

    // Chip selection
    document.querySelectorAll('.gen-chips').forEach(chipGroup => {
        chipGroup.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const groupId = chipGroup.id;
                const wasActive = chip.classList.contains('active');

                // Deselect all in group
                chipGroup.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));

                if (!wasActive) {
                    chip.classList.add('active');
                    if (groupId === 'gen-style') state.style = chip.dataset.value;
                    else if (groupId === 'gen-lighting') state.lighting = chip.dataset.value;
                    else if (groupId === 'gen-composition') state.composition = chip.dataset.value;
                } else {
                    if (groupId === 'gen-style') state.style = '';
                    else if (groupId === 'gen-lighting') state.lighting = '';
                    else if (groupId === 'gen-composition') state.composition = '';
                }

                updatePrompt();
            });
        });
    });

    // Input listeners
    if (subjectInput) {
        subjectInput.addEventListener('input', (e) => {
            state.subject = e.target.value;
            updatePrompt();
        });
    }

    if (extraInput) {
        extraInput.addEventListener('input', (e) => {
            state.extra = e.target.value;
            updatePrompt();
        });
    }

    // Param listeners
    if (paramStylize) {
        paramStylize.addEventListener('input', (e) => {
            stylizeVal.textContent = e.target.value;
            updatePrompt();
        });
    }

    if (paramChaos) {
        paramChaos.addEventListener('input', (e) => {
            chaosVal.textContent = e.target.value;
            updatePrompt();
        });
    }

    [paramAr, paramHd, paramV8].forEach(el => {
        if (el) el.addEventListener('change', updatePrompt);
    });

    // Update prompt output
    function updatePrompt() {
        const parts = [];

        if (state.subject) parts.push(state.subject);
        if (state.style) parts.push(state.style);
        if (state.lighting) parts.push(state.lighting);
        if (state.composition) parts.push(state.composition);
        if (state.extra) parts.push(state.extra);

        // Parameters
        const params = [];
        if (paramAr && paramAr.value) params.push(paramAr.value);
        if (paramStylize && paramStylize.value !== '100') params.push(`--stylize ${paramStylize.value}`);
        if (paramChaos && paramChaos.value !== '0') params.push(`--chaos ${paramChaos.value}`);
        if (paramHd && paramHd.checked) params.push('--hd');
        if (paramV8 && paramV8.checked) params.push('--v 8');

        if (parts.length === 0 && params.length <= 1) {
            outputBox.innerHTML = '<p class="output-placeholder">Start building your prompt above...</p>';
            return;
        }

        let prompt = parts.join(', ');
        if (params.length > 0) {
            prompt += ' ' + params.join(' ');
        }

        outputBox.textContent = prompt;
    }

    // Copy button
    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            const text = outputBox.textContent;
            if (!text || text === 'Start building your prompt above...') return;

            navigator.clipboard.writeText(text).then(() => {
                showToast('✅ Prompt copied to clipboard!');
                outputBox.classList.add('copied');
                setTimeout(() => outputBox.classList.remove('copied'), 2000);
            }).catch(() => {
                // Fallback
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('✅ Prompt copied!');
            });
        });
    }

    // Random prompt
    if (btnRandom) {
        btnRandom.addEventListener('click', generateRandomPrompt);
    }

    function generateRandomPrompt() {
        const subjects = [
            'a mystical forest with glowing mushrooms and fairy lights',
            'a futuristic cyberpunk cityscape at night with neon signs',
            'a serene Japanese garden with cherry blossoms and a koi pond',
            'a majestic dragon perched on a crystal mountain peak',
            'an astronaut floating in a nebula filled with colorful cosmic dust',
            'a cozy coffee shop interior with warm lighting and rain outside',
            'a powerful warrior princess with ornate golden armor',
            'an underwater palace made of coral and bioluminescent creatures',
            'a steampunk airship flying over Victorian London',
            'a magical library with floating books and glowing runes',
            'a portrait of an elegant woman in a field of sunflowers',
            'a cute robot exploring an alien planet with purple vegetation',
            'an ancient temple hidden in a misty mountain valley',
            'a whimsical treehouse village connected by rope bridges',
            'a sleek sports car driving through a neon-lit tunnel'
        ];

        const styles = ['photorealistic', 'digital art', 'oil painting', 'watercolor', 
                        'anime', '3D render', 'cyberpunk', 'fantasy art', 'cinematic',
                        'studio ghibli style'];
        
        const lightings = ['golden hour lighting', 'dramatic lighting', 'soft diffused light',
                          'neon lighting', 'studio lighting', 'natural sunlight',
                          'volumetric fog', 'backlit silhouette'];
        
        const compositions = ['close-up shot', 'wide angle shot', "bird's eye view",
                             'low angle shot', 'portrait shot', 'macro photography'];

        // Set random values
        state.subject = subjects[Math.floor(Math.random() * subjects.length)];
        state.style = styles[Math.floor(Math.random() * styles.length)];
        state.lighting = lightings[Math.floor(Math.random() * lightings.length)];
        state.composition = compositions[Math.floor(Math.random() * compositions.length)];
        state.extra = '';

        // Update UI
        if (subjectInput) subjectInput.value = state.subject;
        if (extraInput) extraInput.value = '';

        // Update chips
        updateChipUI('gen-style', state.style);
        updateChipUI('gen-lighting', state.lighting);
        updateChipUI('gen-composition', state.composition);

        // Random params
        if (paramHd) paramHd.checked = Math.random() > 0.5;

        updatePrompt();
    }

    function updateChipUI(groupId, value) {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.value === value);
        });
    }

    // =========================================
    // Toast Notification
    // =========================================
    function showToast(message) {
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // =========================================
    // Intersection Observer for Animations
    // =========================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.feature-card, .tutorial-card, .comparison-card, .blog-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(el);
    });

    // Add visible class styles dynamically
    const style = document.createElement('style');
    style.textContent = `.visible { opacity: 1 !important; transform: translateY(0) !important; }`;
    document.head.appendChild(style);

    // Stagger animation for grid items
    document.querySelectorAll('.features-grid, .tutorials-grid, .blog-grid').forEach(grid => {
        const gridObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const children = entry.target.children;
                    Array.from(children).forEach((child, index) => {
                        child.style.transitionDelay = `${index * 0.1}s`;
                        setTimeout(() => child.classList.add('visible'), 50);
                    });
                    gridObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });
        gridObserver.observe(grid);
    });

    // =========================================
    // Smooth scroll for anchor links
    // =========================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const offset = navbar.offsetHeight + 20;
                const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
});
