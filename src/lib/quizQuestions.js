/**
 * Quiz question pool for Songkran Tournament quiz mode.
 * 10 random questions are selected per game using the room ID as seed.
 */

const QUESTION_POOL = [
  // ── General ──
  { cat: 'general', question: 'What does "Songkran" actually mean?', a: 'Water fight', b: 'New beginning', c: 'Astrological passage', d: 'Summer festival', correct: 'c' },
  { cat: 'general', question: 'Which planet is the hottest in our solar system?', a: 'Mercury', b: 'Venus', c: 'Mars', d: 'Jupiter', correct: 'b' },
  { cat: 'general', question: 'How many bones does an adult human have?', a: '186', b: '196', c: '206', d: '216', correct: 'c' },
  { cat: 'general', question: 'Which animal can sleep for 3 years?', a: 'Bear', b: 'Snail', c: 'Koala', d: 'Cat', correct: 'b' },
  { cat: 'general', question: 'What is the smallest country in the world?', a: 'Monaco', b: 'Nauru', c: 'Vatican City', d: 'San Marino', correct: 'c' },
  { cat: 'general', question: 'Which fruit floats in water?', a: 'Grape', b: 'Apple', c: 'Mango', d: 'Kiwi', correct: 'b' },
  { cat: 'general', question: 'How many hearts does an octopus have?', a: '1', b: '2', c: '3', d: '4', correct: 'c' },
  { cat: 'general', question: "What color is a polar bear's skin?", a: 'White', b: 'Pink', c: 'Black', d: 'Brown', correct: 'c' },
  { cat: 'general', question: 'Which country invented ice cream?', a: 'Italy', b: 'France', c: 'USA', d: 'China', correct: 'd' },
  { cat: 'general', question: 'What is the most spoken language in the world?', a: 'English', b: 'Spanish', c: 'Mandarin', d: 'Hindi', correct: 'c' },

  // ── Animals & Nature ──
  { cat: 'animals', question: 'What is a group of flamingos called?', a: 'A flock', b: 'A flamboyance', c: 'A parade', d: 'A colony', correct: 'b' },
  { cat: 'animals', question: 'Which bird can fly backwards?', a: 'Swift', b: 'Kingfisher', c: 'Hummingbird', d: 'Sparrow', correct: 'c' },
  { cat: 'animals', question: 'How long is an elephant pregnant?', a: '12 months', b: '16 months', c: '22 months', d: '28 months', correct: 'c' },
  { cat: 'animals', question: 'Which animal has the longest lifespan?', a: 'Elephant', b: 'Giant tortoise', c: 'Bowhead whale', d: 'Parrot', correct: 'c' },
  { cat: 'animals', question: "What is a baby kangaroo called?", a: 'Cub', b: 'Joey', c: 'Kit', d: 'Pup', correct: 'b' },
  { cat: 'animals', question: 'Which sea creature has blue blood?', a: 'Dolphin', b: 'Sea turtle', c: 'Horseshoe crab', d: 'Jellyfish', correct: 'c' },
  { cat: 'animals', question: 'How many legs does a lobster have?', a: '6', b: '8', c: '10', d: '12', correct: 'c' },
  { cat: 'animals', question: 'Which animal never sleeps?', a: 'Dolphin', b: 'Bullfrog', c: 'Ant', d: 'Shark', correct: 'b' },
  { cat: 'animals', question: 'What is the fastest land animal?', a: 'Lion', b: 'Cheetah', c: 'Gazelle', d: 'Horse', correct: 'b' },
  { cat: 'animals', question: 'Which animal has the best memory?', a: 'Dog', b: 'Dolphin', c: 'Elephant', d: 'Crow', correct: 'c' },

  // ── Science & Space ──
  { cat: 'science', question: 'What gas do plants breathe in?', a: 'Oxygen', b: 'Nitrogen', c: 'Carbon dioxide', d: 'Hydrogen', correct: 'c' },
  { cat: 'science', question: 'How many moons does Mars have?', a: '0', b: '1', c: '2', d: '3', correct: 'c' },
  { cat: 'science', question: 'What is the hardest natural substance?', a: 'Gold', b: 'Iron', c: 'Diamond', d: 'Titanium', correct: 'c' },
  { cat: 'science', question: 'Which element has the symbol "Au"?', a: 'Silver', b: 'Aluminum', c: 'Gold', d: 'Copper', correct: 'c' },
  { cat: 'science', question: 'What is the speed of light?', a: '200,000 km/s', b: '300,000 km/s', c: '400,000 km/s', d: '500,000 km/s', correct: 'b' },
  { cat: 'science', question: 'How many teeth does an adult human have?', a: '28', b: '30', c: '32', d: '34', correct: 'c' },
  { cat: 'science', question: 'What planet is known as the Red Planet?', a: 'Venus', b: 'Mars', c: 'Jupiter', d: 'Saturn', correct: 'b' },
  { cat: 'science', question: 'What is the largest organ in the human body?', a: 'Liver', b: 'Brain', c: 'Skin', d: 'Lungs', correct: 'c' },
  { cat: 'science', question: 'Which planet has the most moons?', a: 'Jupiter', b: 'Saturn', c: 'Uranus', d: 'Neptune', correct: 'b' },
  { cat: 'science', question: 'How many elements are in the periodic table?', a: '108', b: '112', c: '118', d: '124', correct: 'c' },

  // ── Geography & World ──
  { cat: 'geography', question: 'What is the longest river in the world?', a: 'Amazon', b: 'Nile', c: 'Yangtze', d: 'Mississippi', correct: 'b' },
  { cat: 'geography', question: 'Which desert is the largest in the world?', a: 'Gobi', b: 'Sahara', c: 'Antarctic', d: 'Arabian', correct: 'c' },
  { cat: 'geography', question: 'What is the capital of Australia?', a: 'Sydney', b: 'Melbourne', c: 'Canberra', d: 'Brisbane', correct: 'c' },
  { cat: 'geography', question: 'Which ocean is the deepest?', a: 'Atlantic', b: 'Indian', c: 'Pacific', d: 'Arctic', correct: 'c' },
  { cat: 'geography', question: 'How many continents are there?', a: '5', b: '6', c: '7', d: '8', correct: 'c' },
  { cat: 'geography', question: 'Which country has the most islands?', a: 'Indonesia', b: 'Philippines', c: 'Sweden', d: 'Japan', correct: 'c' },
  { cat: 'geography', question: 'What is the tallest mountain in the world?', a: 'K2', b: 'Kangchenjunga', c: 'Mount Everest', d: 'Lhotse', correct: 'c' },
  { cat: 'geography', question: 'Which country is known as the Land of the Rising Sun?', a: 'China', b: 'Thailand', c: 'Japan', d: 'Korea', correct: 'c' },
  { cat: 'geography', question: 'What is the largest lake in the world?', a: 'Lake Victoria', b: 'Lake Superior', c: 'Caspian Sea', d: 'Lake Baikal', correct: 'c' },
  { cat: 'geography', question: 'Which city is in two continents?', a: 'Cairo', b: 'Istanbul', c: 'Moscow', d: 'Dubai', correct: 'b' },

  // ── Food & Culture ──
  { cat: 'food', question: 'What is the main ingredient in guacamole?', a: 'Tomato', b: 'Avocado', c: 'Lime', d: 'Pepper', correct: 'b' },
  { cat: 'food', question: 'Which country is famous for sushi?', a: 'China', b: 'Korea', c: 'Japan', d: 'Thailand', correct: 'c' },
  { cat: 'food', question: 'What fruit is known as the King of Fruits in Southeast Asia?', a: 'Mango', b: 'Durian', c: 'Jackfruit', d: 'Pineapple', correct: 'b' },
  { cat: 'food', question: 'Which spice is the most expensive in the world?', a: 'Vanilla', b: 'Cardamom', c: 'Saffron', d: 'Cinnamon', correct: 'c' },
  { cat: 'food', question: 'What is the national dish of Thailand?', a: 'Som Tam', b: 'Pad Thai', c: 'Tom Yum', d: 'Green Curry', correct: 'b' },
  { cat: 'food', question: 'Which nut is used to make marzipan?', a: 'Cashew', b: 'Walnut', c: 'Almond', d: 'Pistachio', correct: 'c' },
  { cat: 'food', question: 'What color is wasabi?', a: 'Red', b: 'Yellow', c: 'Green', d: 'Brown', correct: 'c' },
  { cat: 'food', question: 'Where did pizza originate?', a: 'Greece', b: 'Italy', c: 'USA', d: 'Turkey', correct: 'b' },

  // ── Songkran ──
  { cat: 'songkran', question: 'When is Songkran traditionally celebrated in Thailand?', a: 'January 1–3', b: 'April 13–15', c: 'March 20–22', d: 'December 25–27', correct: 'b' },
  { cat: 'songkran', question: 'What does the word "Songkran" originate from?', a: 'A Thai word meaning "happiness"', b: 'A Khmer word meaning "rain season"', c: 'A Sanskrit word meaning "passage"', d: 'A Pali word meaning "celebration"', correct: 'c' },
  { cat: 'songkran', question: 'What does water symbolize during Songkran?', a: 'Wealth and prosperity', b: 'Cleansing, purification, and blessings', c: 'Harvest and fertility', d: 'Victory and power', correct: 'b' },
  { cat: 'songkran', question: 'What is "rod nam dam hua"?', a: 'A traditional Thai dance', b: 'A Thai dessert eaten during Songkran', c: 'Pouring scented water over elders\' hands to show respect', d: 'A water fight competition', correct: 'c' },
  { cat: 'songkran', question: 'Which activity is commonly performed at temples during Songkran?', a: 'Flying kites', b: 'Pouring water over Buddha images and making merit', c: 'Lighting fireworks', d: 'Running marathons', correct: 'b' },
  { cat: 'songkran', question: 'Songkran also marks which occasion?', a: 'Thai New Year', b: 'Thai Independence Day', c: "The King's Birthday", d: "Buddha's Enlightenment Day", correct: 'a' },
  { cat: 'songkran', question: 'Which country also celebrates a similar water festival?', a: 'Japan', b: 'Myanmar (Thingyan)', c: 'South Korea', d: 'China', correct: 'b' },
  { cat: 'songkran', question: "What material is traditionally used to create a paste applied to people's faces during Songkran?", a: 'Rice flour', b: 'Turmeric powder', c: 'Thanaka (din sor pong)', d: 'Coconut oil', correct: 'c' },
  { cat: 'songkran', question: 'What did UNESCO recognize Songkran as in 2023?', a: 'A World Heritage Site', b: 'An Intangible Cultural Heritage of Humanity', c: 'A Global Holiday', d: 'A Protected National Event', correct: 'b' },
  { cat: 'songkran', question: 'What do many Thai people traditionally do on the first day of Songkran (April 13)?', a: 'Have a water fight in the streets', b: 'Clean their homes and visit temples', c: 'Exchange gifts with friends', d: 'Wear costumes and dance', correct: 'b' },

  // ── Fun & Random ──
  { cat: 'fun', question: 'How many colors are in a rainbow?', a: '5', b: '6', c: '7', d: '8', correct: 'c' },
  { cat: 'fun', question: 'Which hand do most people write with?', a: 'Left', b: 'Right', c: 'Both equally', d: 'It varies by country', correct: 'b' },
  { cat: 'fun', question: 'What is the most common blood type?', a: 'A', b: 'B', c: 'O', d: 'AB', correct: 'c' },
  { cat: 'fun', question: 'How many players are on a soccer team?', a: '9', b: '10', c: '11', d: '12', correct: 'c' },
  { cat: 'fun', question: 'Which instrument has 88 keys?', a: 'Guitar', b: 'Accordion', c: 'Piano', d: 'Organ', correct: 'c' },
  { cat: 'fun', question: 'What year did the Titanic sink?', a: '1905', b: '1912', c: '1918', d: '1923', correct: 'b' },
  { cat: 'fun', question: 'What is the fear of spiders called?', a: 'Claustrophobia', b: 'Acrophobia', c: 'Arachnophobia', d: 'Ophidiophobia', correct: 'c' },
  { cat: 'fun', question: 'How many sides does a hexagon have?', a: '5', b: '6', c: '7', d: '8', correct: 'b' },
  { cat: 'fun', question: 'Which is the only mammal that can fly?', a: 'Flying squirrel', b: 'Sugar glider', c: 'Bat', d: 'Colugo', correct: 'c' },
  { cat: 'fun', question: 'What does "Wi-Fi" stand for?', a: 'Wireless Fidelity', b: 'Wide Frequency', c: 'Nothing specific', d: 'Wireless Field', correct: 'c' },
]

const QUIZ_COUNT = 10

/**
 * Seeded PRNG — simple mulberry32. Same seed = same sequence.
 */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

/**
 * Hash a string to a 32-bit integer for seeding.
 */
function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return h
}

/**
 * Available quiz categories for the category picker.
 */
export const QUIZ_CATEGORIES = [
  { id: 'all', emoji: '🎯', label: 'All Categories' },
  { id: 'general', emoji: '💡', label: 'General' },
  { id: 'animals', emoji: '🐘', label: 'Animals & Nature' },
  { id: 'science', emoji: '🔬', label: 'Science & Space' },
  { id: 'geography', emoji: '🌍', label: 'Geography' },
  { id: 'food', emoji: '🍜', label: 'Food & Culture' },
  { id: 'songkran', emoji: '💦', label: 'Songkran' },
  { id: 'fun', emoji: '🎲', label: 'Fun & Random' },
]

/**
 * Pick QUIZ_COUNT random questions from the pool, seeded deterministically.
 * Both host and players call this with the same seed → same questions.
 *
 * @param {string} roomId — room code (fallback seed via hash)
 * @param {number|null} quizSeed — per-game numeric seed (takes priority when present)
 * @param {string|null} category — filter by category id (null or 'all' = no filter)
 */
export function getQuizQuestions(roomId, quizSeed, category) {
  const pool = category && category !== 'all'
    ? QUESTION_POOL.filter(q => q.cat === category)
    : QUESTION_POOL
  const seed = quizSeed != null ? quizSeed : hashString(String(roomId))
  const rng = mulberry32(seed)
  const indices = Array.from({ length: pool.length }, (_, i) => i)
  // Fisher-Yates shuffle with seeded RNG
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, Math.min(QUIZ_COUNT, pool.length)).map((i) => pool[i])
}

// Keep backward-compat export for ZONE_COLORS
export const QUIZ_QUESTIONS = QUESTION_POOL // only used for pool size if needed

export const ZONE_LABELS = ['A', 'B', 'C', 'D']

export const ZONE_COLORS = {
  a: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.4)', text: '#fca5a5', name: 'Red' },
  b: { bg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.4)', text: '#93c5fd', name: 'Blue' },
  c: { bg: 'rgba(34,197,94,0.18)', border: 'rgba(34,197,94,0.4)', text: '#86efac', name: 'Green' },
  d: { bg: 'rgba(251,191,36,0.18)', border: 'rgba(251,191,36,0.4)', text: '#fde68a', name: 'Gold' },
}
