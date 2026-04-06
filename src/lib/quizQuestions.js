/**
 * Quiz question pool for Songkran Tournament quiz mode.
 * 10 random questions are selected per game using the room ID as seed.
 */

const QUESTION_POOL = [
  // ── Original 10 ──
  { question: 'What does "Songkran" actually mean?', a: 'Water fight', b: 'New beginning', c: 'Astrological passage', d: 'Summer festival', correct: 'c' },
  { question: 'Which planet is the hottest in our solar system?', a: 'Mercury', b: 'Venus', c: 'Mars', d: 'Jupiter', correct: 'b' },
  { question: 'How many bones does an adult human have?', a: '186', b: '196', c: '206', d: '216', correct: 'c' },
  { question: 'Which animal can sleep for 3 years?', a: 'Bear', b: 'Snail', c: 'Koala', d: 'Cat', correct: 'b' },
  { question: 'What is the smallest country in the world?', a: 'Monaco', b: 'Nauru', c: 'Vatican City', d: 'San Marino', correct: 'c' },
  { question: 'Which fruit floats in water?', a: 'Grape', b: 'Apple', c: 'Mango', d: 'Kiwi', correct: 'b' },
  { question: 'How many hearts does an octopus have?', a: '1', b: '2', c: '3', d: '4', correct: 'c' },
  { question: "What color is a polar bear's skin?", a: 'White', b: 'Pink', c: 'Black', d: 'Brown', correct: 'c' },
  { question: 'Which country invented ice cream?', a: 'Italy', b: 'France', c: 'USA', d: 'China', correct: 'd' },
  { question: 'What is the most spoken language in the world?', a: 'English', b: 'Spanish', c: 'Mandarin', d: 'Hindi', correct: 'c' },

  // ── Animals & Nature ──
  { question: 'What is a group of flamingos called?', a: 'A flock', b: 'A flamboyance', c: 'A parade', d: 'A colony', correct: 'b' },
  { question: 'Which bird can fly backwards?', a: 'Swift', b: 'Kingfisher', c: 'Hummingbird', d: 'Sparrow', correct: 'c' },
  { question: 'How long is an elephant pregnant?', a: '12 months', b: '16 months', c: '22 months', d: '28 months', correct: 'c' },
  { question: 'Which animal has the longest lifespan?', a: 'Elephant', b: 'Giant tortoise', c: 'Bowhead whale', d: 'Parrot', correct: 'c' },
  { question: "What is a baby kangaroo called?", a: 'Cub', b: 'Joey', c: 'Kit', d: 'Pup', correct: 'b' },
  { question: 'Which sea creature has blue blood?', a: 'Dolphin', b: 'Sea turtle', c: 'Horseshoe crab', d: 'Jellyfish', correct: 'c' },
  { question: 'How many legs does a lobster have?', a: '6', b: '8', c: '10', d: '12', correct: 'c' },
  { question: 'Which animal never sleeps?', a: 'Dolphin', b: 'Bullfrog', c: 'Ant', d: 'Shark', correct: 'b' },
  { question: 'What is the fastest land animal?', a: 'Lion', b: 'Cheetah', c: 'Gazelle', d: 'Horse', correct: 'b' },
  { question: 'Which animal has the best memory?', a: 'Dog', b: 'Dolphin', c: 'Elephant', d: 'Crow', correct: 'c' },

  // ── Science & Space ──
  { question: 'What gas do plants breathe in?', a: 'Oxygen', b: 'Nitrogen', c: 'Carbon dioxide', d: 'Hydrogen', correct: 'c' },
  { question: 'How many moons does Mars have?', a: '0', b: '1', c: '2', d: '3', correct: 'c' },
  { question: 'What is the hardest natural substance?', a: 'Gold', b: 'Iron', c: 'Diamond', d: 'Titanium', correct: 'c' },
  { question: 'Which element has the symbol "Au"?', a: 'Silver', b: 'Aluminum', c: 'Gold', d: 'Copper', correct: 'c' },
  { question: 'What is the speed of light?', a: '200,000 km/s', b: '300,000 km/s', c: '400,000 km/s', d: '500,000 km/s', correct: 'b' },
  { question: 'How many teeth does an adult human have?', a: '28', b: '30', c: '32', d: '34', correct: 'c' },
  { question: 'What planet is known as the Red Planet?', a: 'Venus', b: 'Mars', c: 'Jupiter', d: 'Saturn', correct: 'b' },
  { question: 'What is the largest organ in the human body?', a: 'Liver', b: 'Brain', c: 'Skin', d: 'Lungs', correct: 'c' },
  { question: 'Which planet has the most moons?', a: 'Jupiter', b: 'Saturn', c: 'Uranus', d: 'Neptune', correct: 'b' },
  { question: 'How many elements are in the periodic table?', a: '108', b: '112', c: '118', d: '124', correct: 'c' },

  // ── Geography & World ──
  { question: 'What is the longest river in the world?', a: 'Amazon', b: 'Nile', c: 'Yangtze', d: 'Mississippi', correct: 'b' },
  { question: 'Which desert is the largest in the world?', a: 'Gobi', b: 'Sahara', c: 'Antarctic', d: 'Arabian', correct: 'c' },
  { question: 'What is the capital of Australia?', a: 'Sydney', b: 'Melbourne', c: 'Canberra', d: 'Brisbane', correct: 'c' },
  { question: 'Which ocean is the deepest?', a: 'Atlantic', b: 'Indian', c: 'Pacific', d: 'Arctic', correct: 'c' },
  { question: 'How many continents are there?', a: '5', b: '6', c: '7', d: '8', correct: 'c' },
  { question: 'Which country has the most islands?', a: 'Indonesia', b: 'Philippines', c: 'Sweden', d: 'Japan', correct: 'c' },
  { question: 'What is the tallest mountain in the world?', a: 'K2', b: 'Kangchenjunga', c: 'Mount Everest', d: 'Lhotse', correct: 'c' },
  { question: 'Which country is known as the Land of the Rising Sun?', a: 'China', b: 'Thailand', c: 'Japan', d: 'Korea', correct: 'c' },
  { question: 'What is the largest lake in the world?', a: 'Lake Victoria', b: 'Lake Superior', c: 'Caspian Sea', d: 'Lake Baikal', correct: 'c' },
  { question: 'Which city is in two continents?', a: 'Cairo', b: 'Istanbul', c: 'Moscow', d: 'Dubai', correct: 'b' },

  // ── Food & Culture ──
  { question: 'What is the main ingredient in guacamole?', a: 'Tomato', b: 'Avocado', c: 'Lime', d: 'Pepper', correct: 'b' },
  { question: 'Which country is famous for sushi?', a: 'China', b: 'Korea', c: 'Japan', d: 'Thailand', correct: 'c' },
  { question: 'What fruit is known as the King of Fruits in Southeast Asia?', a: 'Mango', b: 'Durian', c: 'Jackfruit', d: 'Pineapple', correct: 'b' },
  { question: 'Which spice is the most expensive in the world?', a: 'Vanilla', b: 'Cardamom', c: 'Saffron', d: 'Cinnamon', correct: 'c' },
  { question: 'What is the national dish of Thailand?', a: 'Som Tam', b: 'Pad Thai', c: 'Tom Yum', d: 'Green Curry', correct: 'b' },
  { question: 'Which nut is used to make marzipan?', a: 'Cashew', b: 'Walnut', c: 'Almond', d: 'Pistachio', correct: 'c' },
  { question: 'What color is wasabi?', a: 'Red', b: 'Yellow', c: 'Green', d: 'Brown', correct: 'c' },
  { question: 'Where did pizza originate?', a: 'Greece', b: 'Italy', c: 'USA', d: 'Turkey', correct: 'b' },

  // ── Fun & Random ──
  { question: 'How many colors are in a rainbow?', a: '5', b: '6', c: '7', d: '8', correct: 'c' },
  { question: 'Which hand do most people write with?', a: 'Left', b: 'Right', c: 'Both equally', d: 'It varies by country', correct: 'b' },
  { question: 'What is the most common blood type?', a: 'A', b: 'B', c: 'O', d: 'AB', correct: 'c' },
  { question: 'How many players are on a soccer team?', a: '9', b: '10', c: '11', d: '12', correct: 'c' },
  { question: 'Which instrument has 88 keys?', a: 'Guitar', b: 'Accordion', c: 'Piano', d: 'Organ', correct: 'c' },
  { question: 'What year did the Titanic sink?', a: '1905', b: '1912', c: '1918', d: '1923', correct: 'b' },
  { question: 'What is the fear of spiders called?', a: 'Claustrophobia', b: 'Acrophobia', c: 'Arachnophobia', d: 'Ophidiophobia', correct: 'c' },
  { question: 'How many sides does a hexagon have?', a: '5', b: '6', c: '7', d: '8', correct: 'b' },
  { question: 'Which is the only mammal that can fly?', a: 'Flying squirrel', b: 'Sugar glider', c: 'Bat', d: 'Colugo', correct: 'c' },
  { question: 'What does "Wi-Fi" stand for?', a: 'Wireless Fidelity', b: 'Wide Frequency', c: 'Nothing specific', d: 'Wireless Field', correct: 'c' },
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
 * Pick QUIZ_COUNT random questions from the pool, seeded by roomId.
 * Both host and players call this with the same roomId → same questions.
 */
export function getQuizQuestions(roomId) {
  const rng = mulberry32(hashString(String(roomId)))
  const indices = Array.from({ length: QUESTION_POOL.length }, (_, i) => i)
  // Fisher-Yates shuffle with seeded RNG
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, QUIZ_COUNT).map((i) => QUESTION_POOL[i])
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
