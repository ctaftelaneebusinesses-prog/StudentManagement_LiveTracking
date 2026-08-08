/** Curated static content for the games that aren't proceduralizable (arithmetic/pattern games generate their own questions — see generators.ts). Kept small and hand-picked rather than pulled from a database, since Learning Games content isn't something Super Admin manages (see backend/src/config/learningGames.ts). */

export const VOCABULARY_WORDS: { word: string; meaning: string }[] = [
  { word: "Diligent", meaning: "Hard-working and careful" },
  { word: "Curious", meaning: "Eager to learn or know" },
  { word: "Generous", meaning: "Willing to give freely" },
  { word: "Honest", meaning: "Truthful and sincere" },
  { word: "Brave", meaning: "Showing courage" },
  { word: "Humble", meaning: "Not proud or boastful" },
  { word: "Patient", meaning: "Able to wait calmly" },
  { word: "Creative", meaning: "Having original ideas" },
  { word: "Loyal", meaning: "Faithful to a person or cause" },
  { word: "Cheerful", meaning: "Noticeably happy" },
  { word: "Ancient", meaning: "Very old, from long ago" },
  { word: "Enormous", meaning: "Extremely large" },
  { word: "Fragile", meaning: "Easily broken" },
  { word: "Gigantic", meaning: "Very large in size" },
  { word: "Joyful", meaning: "Full of happiness" },
  { word: "Mysterious", meaning: "Difficult to understand or explain" },
  { word: "Peculiar", meaning: "Strange or unusual" },
  { word: "Radiant", meaning: "Shining brightly" },
  { word: "Swift", meaning: "Moving very fast" },
  { word: "Vivid", meaning: "Producing strong, clear images" },
];

export const GENERAL_KNOWLEDGE: { question: string; options: string[]; correctIndex: number }[] = [
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], correctIndex: 1 },
  { question: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
  { question: "Which gas do plants absorb from the air?", options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"], correctIndex: 1 },
  { question: "What is the capital of India?", options: ["Mumbai", "New Delhi", "Kolkata", "Chennai"], correctIndex: 1 },
  { question: "How many days are there in a leap year?", options: ["364", "365", "366", "367"], correctIndex: 2 },
  { question: "Which organ pumps blood through the body?", options: ["Lungs", "Brain", "Heart", "Liver"], correctIndex: 2 },
  { question: "What do bees produce?", options: ["Milk", "Honey", "Silk", "Wax only"], correctIndex: 1 },
  { question: "Which is the tallest mountain in the world?", options: ["K2", "Kangchenjunga", "Mount Everest", "Makalu"], correctIndex: 2 },
  { question: "How many colors are there in a rainbow?", options: ["5", "6", "7", "8"], correctIndex: 2 },
  { question: "What is the freezing point of water in Celsius?", options: ["0°C", "10°C", "32°C", "-10°C"], correctIndex: 0 },
  { question: "Which animal is known as the 'Ship of the Desert'?", options: ["Horse", "Camel", "Elephant", "Goat"], correctIndex: 1 },
  { question: "What is the smallest prime number?", options: ["0", "1", "2", "3"], correctIndex: 2 },
  { question: "Which country is known as the Land of the Rising Sun?", options: ["China", "Japan", "Thailand", "Korea"], correctIndex: 1 },
  { question: "How many legs does a spider have?", options: ["6", "8", "10", "4"], correctIndex: 1 },
  { question: "What is the main language spoken in Brazil?", options: ["Spanish", "Portuguese", "French", "English"], correctIndex: 1 },
  { question: "Which planet is closest to the Sun?", options: ["Earth", "Venus", "Mercury", "Mars"], correctIndex: 2 },
  { question: "What is H2O commonly known as?", options: ["Salt", "Water", "Oxygen", "Hydrogen"], correctIndex: 1 },
  { question: "Which shape has three sides?", options: ["Square", "Triangle", "Circle", "Pentagon"], correctIndex: 1 },
  { question: "How many players are there in a cricket team?", options: ["9", "10", "11", "12"], correctIndex: 2 },
];

export const WORD_MATCH_PAIRS: { word: string; meaning: string }[] = [
  { word: "Sun", meaning: "Star at the center of our solar system" },
  { word: "Moon", meaning: "Earth's natural satellite" },
  { word: "River", meaning: "A flowing body of water" },
  { word: "Forest", meaning: "A large area covered with trees" },
  { word: "Mountain", meaning: "A very high landform" },
  { word: "Ocean", meaning: "A very large body of salt water" },
  { word: "Library", meaning: "A place with many books" },
  { word: "Teacher", meaning: "A person who helps students learn" },
];

export const SPELLING_WORDS: { word: string; hint: string }[] = [
  { word: "SCHOOL", hint: "A place where you learn" },
  { word: "FRIEND", hint: "Someone you like and trust" },
  { word: "GARDEN", hint: "A place where plants grow" },
  { word: "PENCIL", hint: "Used for writing or drawing" },
  { word: "PLANET", hint: "Earth is one of these" },
  { word: "ANIMAL", hint: "A living creature like a dog or cat" },
  { word: "WEATHER", hint: "Sunny, rainy, or cloudy conditions" },
  { word: "JOURNEY", hint: "A trip from one place to another" },
  { word: "KITCHEN", hint: "A room where food is cooked" },
  { word: "RAINBOW", hint: "Colorful arc seen after rain" },
];

export const MEMORY_ICONS = ["🍎", "🚗", "⭐", "🎈", "🐱", "🌙", "🌸", "⚽", "🎨", "🎵", "🍀", "🔔"];

export const SHAPE_ICONS = ["🔺", "🟦", "🟢", "⬛", "⭐", "🔶", "❤️", "💠"];
