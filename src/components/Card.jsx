import { useState } from 'preact/hooks';
import { displayRatingFor, setRating, showToast, showCardDetails } from '../store/styleStore';
import { copyToClipboard } from '../lib/utils';
import './Card.css';

const StarSVG = ({ filled }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20"
    fill={filled ? '#f5a623' : 'none'} stroke="#ffffff" strokeWidth="1.5"
    strokeLinejoin="round" strokeLinecap="round" role="img" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

export default function Card({ item }) {
  const [flashing, setFlashing] = useState(false);
  const rating = displayRatingFor(item);

  const triggerFlash = () => {
    setFlashing(true);
    setTimeout(() => setFlashing(false), 400);
  };

  const handleClick = (e) => {
    const starEl = e.target.closest('.star');
    if (starEl) {
      e.stopPropagation();
      const newRating = parseInt(starEl.dataset.star);
      setRating(item.id, newRating === rating ? 0 : newRating);
      return;
    }

    if (e.target.closest('.card-copy-btn')) return;

    window.dispatchEvent(new CustomEvent('viewer-open', { detail: { id: item.id } }));
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    copyToClipboard(item.artist).then(() => {
      triggerFlash();
      showToast('Prompt copied!');
    });
  };

  const handleStarKey = (e, starNum) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setRating(item.id, starNum === rating ? 0 : starNum);
    }
  };

  return (
    <div
      class={`card ${flashing ? 'flash' : ''}`}
      data-id={item.id}
      data-artist={item.artist}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <img class="card__image" src={item.image} alt={item.artist} loading="lazy" />

      {item.source === 'style' && (
        <span class="card__source-badge">Style</span>
      )}

      <div class="star-rating-container" role="toolbar" aria-label="Rating controls">
        {[1, 2, 3, 4, 5].map(i => (
          <span
            key={i}
            class="star"
            data-star={i}
            title={`${i} star${i > 1 ? 's' : ''}`}
            role="button"
            tabIndex="0"
            aria-label={`Rate ${i} star${i > 1 ? 's' : ''}`}
            aria-pressed={i <= rating}
            onKeyDown={(e) => handleStarKey(e, i)}
          >
            <StarSVG filled={i <= rating} />
          </span>
        ))}
      </div>

      {showCardDetails.value && (
        <div class="card__info">
          <h3 class="card__name">{item.name}</h3>
          <p class="card__artist">{item.artist}</p>
          {(item.categories || []).length > 0 && (
            <div class="card__categories">
              {item.categories.map(cat => (
                <span key={cat} class="card__category">{cat}</span>
              ))}
            </div>
          )}
          <button class="card-copy-btn" onClick={handleCopy} title="Copy prompt" aria-label="Copy prompt">Copy</button>
        </div>
      )}
    </div>
  );
}
