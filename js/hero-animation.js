/**
 * hero-animation.js
 * =============================================================================
 * Handles the typing animation for the Homepage Hero section.
 * - Respects prefers-reduced-motion
 * - Uses requestAnimationFrame for smooth natural pacing
 * - Prevents layout shifts by targeting a spacer-backed element
 */

export const initHeroAnimation = () => {
  const targetEl = document.getElementById('hp-hero-typing-target');
  if (!targetEl) return;

  const textToType = "Beautiful Locs. Expert Care. Styles That Last.";
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // If user prefers reduced motion, skip animation and show text instantly
  if (reducedMotion) {
    targetEl.textContent = textToType;
    targetEl.classList.remove('typing'); // Optional: remove blinking caret if desired
    return;
  }

  // Animation settings
  const typingSpeedMs = 50; // ms per character
  let charIndex = 0;
  let lastTime = 0;

  // Ensure the caret is visible while typing
  targetEl.classList.add('typing');

  const typeCharacter = (timestamp) => {
    if (!lastTime) lastTime = timestamp;

    const progress = timestamp - lastTime;

    if (progress > typingSpeedMs) {
      targetEl.textContent += textToType.charAt(charIndex);
      charIndex++;
      lastTime = timestamp;
    }

    if (charIndex < textToType.length) {
      requestAnimationFrame(typeCharacter);
    } else {
      // Animation complete.
      // We leave the 'typing' class on so the caret continues to blink.
    }
  };

  // Small delay before typing starts to let the fade-in animation complete
  setTimeout(() => {
    requestAnimationFrame(typeCharacter);
  }, 600); // 600ms delay
};
