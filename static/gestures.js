// Comprehensive ASL 21-Point Hand Landmark & Gesture Asset Library
// Hand landmark indices conform to MediaPipe:
// 0: Wrist
// 1-4: Thumb (CMC, MCP, IP, TIP)
// 5-8: Index (MCP, PIP, DIP, TIP)
// 9-12: Middle (MCP, PIP, DIP, TIP)
// 13-16: Ring (MCP, PIP, DIP, TIP)
// 17-20: Pinky (MCP, PIP, DIP, TIP)

const ASL_DICTIONARY = {
    'A': {
        name: 'A',
        description: 'Fist with thumb resting upright beside index finger',
        emoji: '✊',
        landmarks: [
            [200, 360], // 0 Wrist
            [170, 330], [145, 290], [135, 245], [130, 200], // Thumb (upright)
            [175, 240], [175, 280], [175, 305], [175, 320], // Index (curled)
            [200, 240], [200, 280], [200, 305], [200, 320], // Middle (curled)
            [225, 245], [225, 285], [225, 305], [225, 320], // Ring (curled)
            [250, 255], [250, 290], [250, 310], [250, 325]  // Pinky (curled)
        ]
    },
    'B': {
        name: 'B',
        description: 'Four straight fingers pointing up, thumb folded across palm',
        emoji: '🖐️',
        landmarks: [
            [200, 360],
            [180, 325], [165, 300], [180, 285], [205, 285], // Thumb across palm
            [175, 240], [175, 180], [175, 130], [175, 80],  // Index up
            [200, 235], [200, 175], [200, 120], [200, 70],  // Middle up
            [225, 240], [225, 180], [225, 130], [225, 80],  // Ring up
            [250, 250], [250, 200], [250, 155], [250, 105]  // Pinky up
        ]
    },
    'C': {
        name: 'C',
        description: 'Curved hand forming a C shape',
        emoji: '🤏',
        landmarks: [
            [200, 360],
            [165, 320], [140, 285], [145, 245], [165, 210],
            [180, 235], [210, 195], [235, 195], [250, 215],
            [200, 235], [230, 195], [250, 200], [260, 225],
            [220, 240], [245, 205], [260, 215], [265, 240],
            [240, 250], [260, 220], [270, 235], [270, 255]
        ]
    },
    'D': {
        name: 'D',
        description: 'Index finger straight up, other fingers touch thumb to form O',
        emoji: '☝️',
        landmarks: [
            [200, 360],
            [175, 320], [160, 285], [170, 255], [195, 250],
            [175, 240], [175, 180], [175, 130], [175, 80], // Index pointing high
            [200, 240], [210, 260], [205, 275], [195, 260],
            [225, 245], [225, 270], [215, 285], [200, 270],
            [250, 255], [245, 280], [230, 295], [210, 285]
        ]
    },
    'E': {
        name: 'E',
        description: 'All four fingertips curled down tightly touching thumb',
        emoji: '✊',
        landmarks: [
            [200, 360],
            [170, 330], [150, 305], [165, 285], [195, 285],
            [175, 240], [175, 210], [175, 235], [175, 265],
            [200, 240], [200, 205], [200, 230], [200, 265],
            [225, 245], [225, 210], [225, 235], [225, 265],
            [250, 255], [250, 220], [250, 245], [250, 270]
        ]
    },
    'F': {
        name: 'F',
        description: 'Index & thumb tips touching in circle, middle/ring/pinky straight up',
        emoji: '👌',
        landmarks: [
            [200, 360],
            [165, 320], [145, 285], [155, 250], [175, 230], // Thumb touches index
            [175, 240], [170, 215], [165, 220], [175, 230], // Index touches thumb
            [200, 235], [200, 175], [200, 120], [200, 70],  // Middle up
            [225, 240], [225, 180], [225, 130], [225, 80],  // Ring up
            [250, 250], [250, 200], [250, 155], [250, 105]  // Pinky up
        ]
    },
    'G': {
        name: 'G',
        description: 'Index finger pointing horizontally to the side, thumb parallel',
        emoji: '👉',
        landmarks: [
            [200, 360],
            [180, 330], [160, 295], [130, 285], [100, 280], // Thumb horizontal
            [175, 240], [150, 230], [120, 225], [85, 225],  // Index horizontal
            [200, 240], [200, 275], [195, 300], [190, 315],
            [225, 245], [220, 280], [215, 305], [210, 320],
            [250, 255], [245, 290], [240, 310], [235, 325]
        ]
    },
    'H': {
        name: 'H',
        description: 'Index and middle fingers pointing horizontally together',
        emoji: '👉',
        landmarks: [
            [200, 360],
            [180, 330], [165, 305], [150, 290], [145, 275],
            [175, 240], [150, 225], [120, 220], [85, 220],  // Index horizontal
            [200, 240], [165, 245], [130, 245], [95, 245],  // Middle horizontal
            [225, 245], [220, 280], [215, 305], [210, 320],
            [250, 255], [245, 290], [240, 310], [235, 325]
        ]
    },
    'I': {
        name: 'I',
        description: 'Pinky finger straight up, all other fingers closed in fist',
        emoji: '🤙',
        landmarks: [
            [200, 360],
            [175, 330], [160, 300], [175, 280], [200, 280],
            [175, 240], [175, 280], [175, 305], [175, 320],
            [200, 240], [200, 280], [200, 305], [200, 320],
            [225, 245], [225, 285], [225, 305], [225, 320],
            [250, 250], [255, 195], [260, 145], [265, 95]   // Pinky pointing high
        ]
    },
    'L': {
        name: 'L',
        description: 'L shape formed by extending thumb and index finger at 90 degrees',
        emoji: '👆',
        landmarks: [
            [200, 360],
            [175, 330], [145, 305], [115, 295], [85, 290],  // Thumb out to side
            [175, 240], [175, 180], [175, 130], [175, 80],  // Index straight up
            [200, 240], [200, 280], [200, 305], [200, 320],
            [225, 245], [225, 285], [225, 305], [225, 320],
            [250, 255], [250, 290], [250, 310], [250, 325]
        ]
    },
    'O': {
        name: 'O',
        description: 'All fingertips touching thumb to form an O shape',
        emoji: '👌',
        landmarks: [
            [200, 360],
            [170, 325], [150, 290], [165, 250], [190, 230],
            [175, 240], [185, 195], [205, 205], [195, 230],
            [200, 240], [205, 195], [215, 205], [200, 230],
            [225, 245], [220, 205], [225, 215], [205, 235],
            [250, 255], [235, 215], [235, 225], [210, 240]
        ]
    },
    'U': {
        name: 'U',
        description: 'Index and middle fingers straight up together (connected)',
        emoji: '✌️',
        landmarks: [
            [200, 360],
            [175, 330], [160, 300], [175, 280], [200, 280],
            [185, 240], [185, 180], [185, 130], [185, 80],  // Index straight up
            [205, 240], [205, 180], [205, 130], [205, 80],  // Middle touching index
            [225, 245], [225, 285], [225, 305], [225, 320],
            [250, 255], [250, 290], [250, 310], [250, 325]
        ]
    },
    'V': {
        name: 'V',
        description: 'Peace sign with index and middle fingers spread apart in V',
        emoji: '✌️',
        landmarks: [
            [200, 360],
            [175, 330], [160, 300], [175, 280], [200, 280],
            [175, 240], [165, 185], [150, 135], [135, 85],  // Index spread left
            [200, 240], [210, 185], [225, 135], [240, 85],  // Middle spread right
            [225, 245], [225, 285], [225, 305], [225, 320],
            [250, 255], [250, 290], [250, 310], [250, 325]
        ]
    },
    'W': {
        name: 'W',
        description: 'Index, middle, and ring fingers spread up forming W',
        emoji: '🖐️',
        landmarks: [
            [200, 360],
            [175, 330], [165, 305], [180, 285], [205, 285],
            [175, 240], [160, 185], [145, 135], [130, 85],  // Index
            [200, 235], [200, 175], [200, 120], [200, 70],  // Middle
            [225, 240], [240, 185], [255, 135], [270, 85],  // Ring
            [250, 255], [250, 290], [250, 310], [250, 325]
        ]
    },
    'Y': {
        name: 'Y',
        description: 'Thumb and pinky extended wide, middle fingers curled',
        emoji: '🤙',
        landmarks: [
            [200, 360],
            [175, 330], [145, 310], [115, 295], [85, 280],  // Thumb out wide left
            [175, 240], [175, 280], [175, 305], [175, 320],
            [200, 240], [200, 280], [200, 305], [200, 320],
            [225, 245], [225, 285], [225, 305], [225, 320],
            [250, 250], [270, 220], [290, 195], [315, 170]  // Pinky out wide right
        ]
    }
};

// Fill in remaining alphabet letters with geometric landmark projections
const DEFAULT_PALM = [
    [200, 360],
    [170, 330], [145, 300], [135, 265], [130, 230],
    [175, 240], [175, 280], [175, 305], [175, 320],
    [200, 240], [200, 280], [200, 305], [200, 320],
    [225, 245], [225, 285], [225, 305], [225, 320],
    [250, 255], [250, 290], [250, 310], [250, 325]
];

// Common Phrase / Everyday Word Gestures
const COMMON_PHRASES = {
    'HELLO': {
        name: 'HELLO',
        description: 'Open hand salute gesture touching forehead and moving outwards',
        emoji: '👋',
        sequence: ['H', 'E', 'L', 'L', 'O']
    },
    'THANK YOU': {
        name: 'THANK YOU',
        description: 'Flat hand touching chin/lips and extending outwards towards person',
        emoji: '🙏',
        sequence: ['T', 'H', 'A', 'N', 'K', ' ', 'Y', 'O', 'U']
    },
    'PLEASE': {
        name: 'PLEASE',
        description: 'Flat palm rubbing in circular motion on the chest',
        emoji: '🤲',
        sequence: ['P', 'L', 'E', 'A', 'S', 'E']
    },
    'YES': {
        name: 'YES',
        description: 'Fist nodding up and down like a head nod',
        emoji: '✊',
        sequence: ['Y', 'E', 'S']
    },
    'NO': {
        name: 'NO',
        description: 'Index and middle fingers snapping down to meet the thumb',
        emoji: '🤏',
        sequence: ['N', 'O']
    },
    'HELP': {
        name: 'HELP',
        description: 'Closed fist with thumb up resting on flat palm moving upwards',
        emoji: '🆘',
        sequence: ['H', 'E', 'L', 'P']
    },
    'LOVE': {
        name: 'I LOVE YOU',
        description: 'Thumb, index, and pinky extended (ILY ASL sign)',
        emoji: '🤟',
        sequence: ['I', ' ', 'L', 'O', 'V', 'E', ' ', 'Y', 'O', 'U']
    },
    'GOODBYE': {
        name: 'GOODBYE',
        description: 'Open hand waving fingers gently',
        emoji: '👋',
        sequence: ['G', 'O', 'O', 'D', 'B', 'Y', 'E']
    }
};

// Rich Categorized Word Database for Word-Level Studio & Practice Mode
const WORD_DATABASE = [
    // Greetings & Social
    { 
        id: 'hello', 
        word: 'HELLO', 
        category: 'Greetings', 
        emoji: '👋', 
        description: 'Standard friendly greeting', 
        meaning: 'Used to express a greeting or acknowledge arrival of someone.',
        howToSign: 'Extend flat hand with fingers closed. Place index finger edge near your temple, then move your hand upward and outward in a gentle salute motion.',
        exampleSentence: '"Hello! How are you today?"',
        culturalNote: 'Always accompany with a warm smile and direct eye contact.',
        sequence: ['H', 'E', 'L', 'L', 'O'], 
        tip: 'Salute outward from forehead' 
    },
    { 
        id: 'goodbye', 
        word: 'GOODBYE', 
        category: 'Greetings', 
        emoji: '👋', 
        description: 'Farewell greeting', 
        meaning: 'Used to express good wishes when parting or leaving.',
        howToSign: 'Raise open hand with palm facing forward towards the person. Gently fold your four fingers down towards your palm and open them repeatedly like a friendly wave.',
        exampleSentence: '"Goodbye, see you tomorrow at school!"',
        culturalNote: 'In ASL, saying goodbye often involves waving until the other person leaves vision.',
        sequence: ['G', 'O', 'O', 'D', 'B', 'Y', 'E'], 
        tip: 'Open palm gentle wave' 
    },
    { 
        id: 'welcome', 
        word: 'WELCOME', 
        category: 'Greetings', 
        emoji: '🤝', 
        description: 'Warm greeting to guests', 
        meaning: 'A friendly greeting to a new arrival or reply to "thank you".',
        howToSign: 'Hold open dominant hand out to the side with palm facing upward. Sweep the hand inward toward your torso/waist in an inviting curve.',
        exampleSentence: '"Welcome to our home!"',
        culturalNote: 'A welcoming facial expression with slightly raised eyebrows enhances the warmth.',
        sequence: ['W', 'E', 'L', 'C', 'O', 'M', 'E'], 
        tip: 'Sweeping open palm gesture' 
    },
    { 
        id: 'good_morning', 
        word: 'GOOD MORNING', 
        category: 'Greetings', 
        emoji: '🌅', 
        description: 'Morning greeting', 
        meaning: 'Polite greeting used in the morning until noon.',
        howToSign: 'First sign GOOD (fingers on chin falling into resting palm), then sign MORNING (rest non-dominant hand in elbow crease while dominant open hand rises like the sun).',
        exampleSentence: '"Good morning! Did you sleep well?"',
        culturalNote: 'Compound sign: combines the concepts of positive goodness and sunrise.',
        sequence: ['G', 'O', 'O', 'D', ' ', 'M', 'O', 'R', 'N', 'I', 'N', 'G'], 
        tip: 'Sign GOOD then sunrise motion' 
    },
    { 
        id: 'good_night', 
        word: 'GOOD NIGHT', 
        category: 'Greetings', 
        emoji: '🌙', 
        description: 'Night farewell', 
        meaning: 'A conventional farewell expressed at night before sleep.',
        howToSign: 'First sign GOOD, then place dominant bent hand over non-dominant horizontal forearm and arch downward, mimicking the setting of the sun into nighttime.',
        exampleSentence: '"Good night, have sweet dreams!"',
        culturalNote: 'Often paired with a soft facial expression and relaxed posture.',
        sequence: ['G', 'O', 'O', 'D', ' ', 'N', 'I', 'G', 'H', 'T'], 
        tip: 'Sign GOOD then sunset curve' 
    },
    { 
        id: 'how_are_you', 
        word: 'HOW ARE YOU', 
        category: 'Greetings', 
        emoji: '❓', 
        description: 'Inquiry on well-being', 
        meaning: 'Polite inquiry asking someone about their health, state, or feelings.',
        howToSign: 'Place both curved hands with knuckles together against chest. Rotate hands forward until palms face upward, then point index finger toward the person (YOU).',
        exampleSentence: '"It is great to see you, how are you?"',
        culturalNote: 'Furrow your eyebrows slightly when asking questions to signal genuine inquiry.',
        sequence: ['H', 'O', 'W', ' ', 'A', 'R', 'E', ' ', 'Y', 'O', 'U'], 
        tip: 'Curled hands rotating outwards' 
    },
    { 
        id: 'nice_to_meet_you', 
        word: 'NICE TO MEET YOU', 
        category: 'Greetings', 
        emoji: '🤝', 
        description: 'Meeting expression', 
        meaning: 'Polite phrase spoken when meeting someone for the first time.',
        howToSign: 'Slide dominant flat palm over non-dominant flat palm (NICE), then bring both upright index fingers toward each other until knuckles touch (MEET YOU).',
        exampleSentence: '"My name is Alex. Nice to meet you!"',
        culturalNote: 'The touching index fingers represent two individuals coming face to face.',
        sequence: ['N', 'I', 'C', 'E', ' ', 'M', 'E', 'E', 'T', ' ', 'Y', 'O', 'U'], 
        tip: 'Slide palms then index meeting' 
    },

    // Essentials & Polite
    { 
        id: 'please', 
        word: 'PLEASE', 
        category: 'Essentials', 
        emoji: '🤲', 
        description: 'Polite request marker', 
        meaning: 'Used to ask for something politely or show respect.',
        howToSign: 'Place open dominant palm flat against the center of your chest. Rub in a smooth clockwise circular motion 2 to 3 times.',
        exampleSentence: '"Could you please pass the water?"',
        culturalNote: 'A gentle nod of the head accompanies this sign to reinforce politeness.',
        sequence: ['P', 'L', 'E', 'A', 'S', 'E'], 
        tip: 'Circular palm on chest' 
    },
    { 
        id: 'thank_you', 
        word: 'THANK YOU', 
        category: 'Essentials', 
        emoji: '🙏', 
        description: 'Expression of gratitude', 
        meaning: 'An expression of gratitude, appreciation, or acknowledgement.',
        howToSign: 'Place fingertips of flat dominant hand touching your chin or lips. Move hand outward and downward toward the recipient with open palm facing upward.',
        exampleSentence: '"Thank you for your wonderful help!"',
        culturalNote: 'Be sure to smile and look directly at the person receiving your gratitude.',
        sequence: ['T', 'H', 'A', 'N', 'K', ' ', 'Y', 'O', 'U'], 
        tip: 'Fingertips from chin to forward' 
    },
    { 
        id: 'yes', 
        word: 'YES', 
        category: 'Essentials', 
        emoji: '✊', 
        description: 'Affirmative response', 
        meaning: 'Used to confirm agreement, consent, or positive answer.',
        howToSign: 'Make an S-shape fist at chest height. Bend your wrist so the fist nods up and down twice, resembling a nodding head.',
        exampleSentence: '"Yes, I understand the plan."',
        culturalNote: 'Nodding your head concurrently is an essential non-manual grammatical marker in ASL.',
        sequence: ['Y', 'E', 'S'], 
        tip: 'S-fist nodding up and down' 
    },
    { 
        id: 'no', 
        word: 'NO', 
        category: 'Essentials', 
        emoji: '🤏', 
        description: 'Negative response', 
        meaning: 'Used to express refusal, denial, or negative response.',
        howToSign: 'Extend index and middle fingers together, with thumb beneath them. Snap index and middle fingertips quickly down to meet the thumb tip.',
        exampleSentence: '"No, I have not eaten yet."',
        culturalNote: 'Slight head shake from side to side accompanies the sign.',
        sequence: ['N', 'O'], 
        tip: 'Index & middle snapping to thumb' 
    },
    { 
        id: 'sorry', 
        word: 'SORRY', 
        category: 'Essentials', 
        emoji: '😔', 
        description: 'Apology / regret', 
        meaning: 'An expression of apology, regret, or sympathy.',
        howToSign: 'Make an A-shape fist (thumb resting on side of index). Place knuckles/palm side over your heart and rub in a clockwise circle.',
        exampleSentence: '"I am sorry for being late today."',
        culturalNote: 'An apologetic or empathetic facial expression is vital to convey sincerity.',
        sequence: ['S', 'O', 'R', 'R', 'Y'], 
        tip: 'A-fist circular rub on chest' 
    },
    { 
        id: 'help', 
        word: 'HELP', 
        category: 'Essentials', 
        emoji: '🆘', 
        description: 'Request for assistance', 
        meaning: 'The action of providing aid, support, or relief.',
        howToSign: 'Place dominant A-fist with thumb pointing upward on top of the open palm of non-dominant hand. Lift both hands together upward.',
        exampleSentence: '"Can you help me with this task?"',
        culturalNote: 'Help is a directional verb in ASL: moving it toward yourself means "help me", moving it outward means "help you".',
        sequence: ['H', 'E', 'L', 'P'], 
        tip: 'A-fist lifted by flat palm' 
    },
    { 
        id: 'stop', 
        word: 'STOP', 
        category: 'Essentials', 
        emoji: '🛑', 
        description: 'Halt / cease action', 
        meaning: 'To cease movement, discontinue an action, or bring to an end.',
        howToSign: 'Hold non-dominant hand open with palm facing upward. Bring dominant open hand down sharply with its pinky edge chopping into non-dominant palm.',
        exampleSentence: '"Please stop and wait for the signal."',
        culturalNote: 'A firm, definitive motion indicates urgency or command.',
        sequence: ['S', 'T', 'O', 'P'], 
        tip: 'Dominant hand chops down into palm' 
    },

    // Daily Needs & Health (Micro-Signs)
    { 
        id: 'tablet', 
        word: 'TABLET', 
        category: 'Essentials', 
        emoji: '💊', 
        description: 'Medicine / Pill / Tablet', 
        meaning: 'A small solid piece of medicine or pharmaceutical tablet taken for health or healing.',
        howToSign: 'Form a small pinch with dominant Thumb and Index fingertips (like holding a small pill) and bring it toward your mouth.',
        exampleSentence: '"I need to have my medicine / tablet with water."',
        culturalNote: 'Universal mimetic sign for taking a medicinal tablet or capsule.',
        sequence: ['T', 'A', 'B', 'L', 'E', 'T'], 
        tip: 'Pinch thumb and index like holding a pill' 
    },
    { 
        id: 'food', 
        word: 'FOOD', 
        category: 'Food & Drink', 
        emoji: '🍲', 
        description: 'Food / Meal / Nutrition', 
        meaning: 'Any nutritious substance that people or animals eat or drink in order to maintain life and growth.',
        howToSign: 'Form a flattened O shape with all 5 fingertips touching. Bring fingers to lips and tap lightly twice.',
        exampleSentence: '"I would like to have some food, I am feeling hungry."',
        culturalNote: 'Double tap signifies the noun FOOD, single tap represents the verb EAT.',
        sequence: ['F', 'O', 'O', 'D'], 
        tip: 'Tapered fingertips tapping lips twice' 
    },
    { 
        id: 'want', 
        word: 'WANT', 
        category: 'Essentials', 
        emoji: '🤲', 
        description: 'Desire / Wish / Need', 
        meaning: 'To have a desire to possess, do, or receive something.',
        howToSign: 'Hold both open clawed hands with palms facing upward in front of you. Pull your hands towards your chest while curling fingers.',
        exampleSentence: '"I want to drink some water."',
        culturalNote: 'Pulling motion towards the body represents drawing the desired item closer.',
        sequence: ['W', 'A', 'N', 'T'], 
        tip: 'Clawed palms pulling towards chest' 
    },
    { 
        id: 'sleep', 
        word: 'SLEEP', 
        category: 'Essentials', 
        emoji: '🛏️', 
        description: 'Rest / Sleep / Tired', 
        meaning: 'A condition of body and mind that recurs for several hours every night, in which the nervous system is inactive.',
        howToSign: 'Hold your flat hand slightly tilted against the side of your cheek or bring an open hand from forehead down to chin while closing fingertips.',
        exampleSentence: '"I am feeling very tired and would like to sleep."',
        culturalNote: 'Closing eyes and tilting head slightly adds expressive depth.',
        sequence: ['S', 'L', 'E', 'E', 'P'], 
        tip: 'Tilted hand resting against cheek' 
    },
    { 
        id: 'restroom', 
        word: 'RESTROOM', 
        category: 'Essentials', 
        emoji: '🚻', 
        description: 'Bathroom / Toilet / Washroom', 
        meaning: 'A room equipped with toilets and washbasins for public or private hygiene.',
        howToSign: 'Form a T-handshape (closed fist with thumb poking between index and middle knuckles) and shake your hand gently side-to-side twice.',
        exampleSentence: '"Excuse me, where is the nearest restroom?"',
        culturalNote: 'The T-handshape stands for Toilet, shaken for grammatical emphasis.',
        sequence: ['R', 'E', 'S', 'T', 'R', 'O', 'O', 'M'], 
        tip: 'T-fist shaking side to side' 
    },
    { 
        id: 'me', 
        word: 'ME', 
        category: 'Essentials', 
        emoji: '☝️', 
        description: 'I / Me / Myself', 
        meaning: 'The person speaking or signing; first-person singular pronoun.',
        howToSign: 'Point your index fingertip directly towards the center of your chest.',
        exampleSentence: '"Could you please help me?"',
        culturalNote: 'Direct deictic pointing is standard ASL pronoun syntax.',
        sequence: ['M', 'E'], 
        tip: 'Index pointing directly to chest' 
    },

    // Two-Handed Signs
    { 
        id: 'book', 
        word: 'BOOK', 
        category: 'Essentials', 
        emoji: '📖', 
        description: 'Reading book / manual', 
        meaning: 'A written or printed work consisting of pages glued or sewn together.',
        howToSign: 'Hold both flat open hands with pinky edges touching side-by-side, then open your palms upward like opening a book.',
        exampleSentence: '"I am reading an interesting book."',
        culturalNote: 'Visual mimetic sign of opening a book.',
        sequence: ['B', 'O', 'O', 'K'], 
        tip: 'Palms together then opening like book' 
    },
    { 
        id: 'house', 
        word: 'HOUSE', 
        category: 'Essentials', 
        emoji: '🏠', 
        description: 'House / Building / Shelter', 
        meaning: 'A building for human habitation, especially one that is lived in by a family.',
        howToSign: 'Touch the fingertips of both flat angled hands together at the top to form a roof (^), then separate and move them down.',
        exampleSentence: '"Welcome to our house!"',
        culturalNote: 'The peaked hands form the iconic triangular roofline of a home.',
        sequence: ['H', 'O', 'U', 'S', 'E'], 
        tip: 'Fingertips touching forming roof shape' 
    },
    { 
        id: 'more', 
        word: 'MORE', 
        category: 'Essentials', 
        emoji: '➕', 
        description: 'Greater quantity / Additional', 
        meaning: 'A greater or additional amount or degree.',
        howToSign: 'Bring the fingertips and thumbs of both tapered hands together, and tap the fingertips of both hands against each other twice.',
        exampleSentence: '"Could I please have more water?"',
        culturalNote: 'One of the earliest signs taught in ASL baby sign language.',
        sequence: ['M', 'O', 'R', 'E'], 
        tip: 'Both tapered hands tapping fingertips' 
    },
    { 
        id: 'play', 
        word: 'PLAY', 
        category: 'Essentials', 
        emoji: '🎮', 
        description: 'Recreation / Gaming / Fun', 
        meaning: 'Engage in activity for enjoyment and recreation rather than a serious or practical purpose.',
        howToSign: 'Form Y-handshapes (Shaka signs with thumb & pinky out) with both hands and rotate your wrists back and forth playfully.',
        exampleSentence: '"The children want to play outside."',
        culturalNote: 'The oscillating motion signifies dynamic playful action.',
        sequence: ['P', 'L', 'A', 'Y'], 
        tip: 'Both Y-hands rotating side to side' 
    },

    // Food & Drink
    { 
        id: 'water', 
        word: 'WATER', 
        category: 'Food & Drink', 
        emoji: '💧', 
        description: 'Clear liquid essential', 
        meaning: 'Clear colorless liquid necessary for all life.',
        howToSign: 'Form the ASL letter W with your three middle fingers upright. Tap your index fingertip against your chin twice.',
        exampleSentence: '"I would like a glass of cold water."',
        culturalNote: 'One of the most frequently used basic emergency and everyday signs.',
        sequence: ['W', 'A', 'T', 'E', 'R'], 
        tip: 'W-hand index taps on chin' 
    },
    { 
        id: 'food', 
        word: 'FOOD', 
        category: 'Food & Drink', 
        emoji: '🍲', 
        description: 'Meal / nourishment', 
        meaning: 'Any nutritious substance consumed to maintain life and health.',
        howToSign: 'Bring fingertips and thumb of dominant hand together into a squashed O shape. Tap fingertips to your lips twice.',
        exampleSentence: '"The food at the dinner was delicious."',
        culturalNote: 'Tapping once means EAT (verb), tapping twice means FOOD (noun).',
        sequence: ['F', 'O', 'O', 'D'], 
        tip: 'Squashed O-hand tapping lips' 
    },
    { 
        id: 'eat', 
        word: 'EAT', 
        category: 'Food & Drink', 
        emoji: '🍎', 
        description: 'Consuming food', 
        meaning: 'The action of putting food into the mouth and swallowing it.',
        howToSign: 'Form a flattened O shape with your dominant fingertips touching thumb. Move hand to mouth and tap lips once firmly.',
        exampleSentence: '"Let us eat lunch together at noon."',
        culturalNote: 'Single motion differentiates the verb "eat" from the noun "food".',
        sequence: ['E', 'A', 'T'], 
        tip: 'Fingertips to mouth once' 
    },
    { 
        id: 'drink', 
        word: 'DRINK', 
        category: 'Food & Drink', 
        emoji: '🥤', 
        description: 'Consuming beverage', 
        meaning: 'The action of taking liquid into the mouth and swallowing.',
        howToSign: 'Form a C-hand shape as if holding a small glass or cup. Bring hand to your mouth and tilt upward as if taking a sip.',
        exampleSentence: '"What would you like to drink?"',
        culturalNote: 'A natural mimetic sign understood across many international sign languages.',
        sequence: ['D', 'R', 'I', 'N', 'K'], 
        tip: 'C-hand tipping to mouth' 
    },
    { 
        id: 'tea', 
        word: 'TEA', 
        category: 'Food & Drink', 
        emoji: '🍵', 
        description: 'Brewed hot beverage', 
        meaning: 'A hot beverage made by steeping cured tea leaves in water.',
        howToSign: 'Make an O shape with non-dominant hand like a teacup. Form an F shape with dominant hand and swirl thumb & index over the cup as if stirring a tea bag.',
        exampleSentence: '"I enjoy hot green tea in the evening."',
        culturalNote: 'Visual metaphor of dipping and swirling a tea bag inside a teacup.',
        sequence: ['T', 'E', 'A'], 
        tip: 'F-hand swirling in O-cup' 
    },
    { 
        id: 'coffee', 
        word: 'COFFEE', 
        category: 'Food & Drink', 
        emoji: '☕', 
        description: 'Roasted coffee beverage', 
        meaning: 'A popular brewed beverage made from ground roasted coffee beans.',
        howToSign: 'Stack dominant S-fist on top of non-dominant stationary S-fist. Rotate dominant fist in a circular grinding motion on top.',
        exampleSentence: '"Would you like black coffee or with milk?"',
        culturalNote: 'Mimics the old-fashioned manual coffee grinder mechanism.',
        sequence: ['C', 'O', 'F', 'F', 'E', 'E'], 
        tip: 'Fists grinding in circular motion' 
    },

    // Daily Life & Places
    { 
        id: 'home', 
        word: 'HOME', 
        category: 'Daily Life', 
        emoji: '🏠', 
        description: 'Residence / living place', 
        meaning: 'The place where one lives permanently as a member of a household.',
        howToSign: 'Form a flattened O shape with dominant hand. Touch fingertips to your cheek near the mouth, then move back and touch near your ear.',
        exampleSentence: '"I am heading home after work today."',
        culturalNote: 'Combines the signs for EAT (mouth) and SLEEP (ear/bed) to represent HOME.',
        sequence: ['H', 'O', 'M', 'E'], 
        tip: 'Flat O-hand cheek to jaw' 
    },
    { 
        id: 'work', 
        word: 'WORK', 
        category: 'Daily Life', 
        emoji: '💼', 
        description: 'Job / labor task', 
        meaning: 'Activity involving mental or physical effort done to achieve purpose or earn livelihood.',
        howToSign: 'Make fists with both hands (S-shapes). Tap the heel/wrist of dominant fist onto the back of non-dominant wrist twice.',
        exampleSentence: '"She starts her new work assignment on Monday."',
        culturalNote: 'Represents the active exertion of hands at labor.',
        sequence: ['W', 'O', 'R', 'K'], 
        tip: 'Dominant fist tapping base wrist' 
    },
    { 
        id: 'school', 
        word: 'SCHOOL', 
        category: 'Daily Life', 
        emoji: '🏫', 
        description: 'Learning institution', 
        meaning: 'An institution for educating children or instruction in specialized skills.',
        howToSign: 'Hold non-dominant hand flat facing upward. Clap dominant flat palm down onto non-dominant palm twice in a horizontal clapping motion.',
        exampleSentence: '"The students are learning sign language at school."',
        culturalNote: 'Resembles a teacher clapping hands to call a classroom to attention.',
        sequence: ['S', 'C', 'H', 'O', 'O', 'L'], 
        tip: 'Clapping flat hands twice' 
    },
    { 
        id: 'friend', 
        word: 'FRIEND', 
        category: 'Daily Life', 
        emoji: '🧑‍🤝‍🧑', 
        description: 'Close companion', 
        meaning: 'A person with whom one has a bond of mutual affection and trust.',
        howToSign: 'Hook your dominant curved index finger over non-dominant curved index finger. Unhook, flip hands, and hook them in the reverse direction.',
        exampleSentence: '"He has been my best friend for many years."',
        culturalNote: 'Interlocking index fingers symbolizes an unbreakable friendship bond.',
        sequence: ['F', 'R', 'I', 'E', 'N', 'D'], 
        tip: 'Hook index fingers together' 
    },
    { 
        id: 'family', 
        word: 'FAMILY', 
        category: 'Daily Life', 
        emoji: '👨‍👩‍👧‍👦', 
        description: 'Relatives / household', 
        meaning: 'A group of one or more parents and their children living together as a unit.',
        howToSign: 'Form F-handshapes with both hands with thumbs and index fingers touching in front of you. Move both hands in a forward circle until pinkies touch.',
        exampleSentence: '"My family is celebrating dinner together."',
        culturalNote: 'The enclosing circle represents the protective circle of relatives.',
        sequence: ['F', 'A', 'M', 'I', 'L', 'Y'], 
        tip: 'F-hands circling to touch pinkies' 
    },
    { 
        id: 'love', 
        word: 'LOVE', 
        category: 'Daily Life', 
        emoji: '❤️', 
        description: 'Deep affection', 
        meaning: 'An intense feeling of deep affection, care, and attachment.',
        howToSign: 'Make fists with both hands (S-shapes). Cross your wrists and hug your arms tightly against your chest over your heart.',
        exampleSentence: '"I love spending time with all of you."',
        culturalNote: 'Warm facial expression with head tilted slightly adds genuine affection.',
        sequence: ['L', 'O', 'V', 'E'], 
        tip: 'Crossed fists over chest' 
    },
    { 
        id: 'time', 
        word: 'TIME', 
        category: 'Daily Life', 
        emoji: '⏰', 
        description: 'Temporal measurement', 
        meaning: 'The indefinite continued progress of existence and events in the past, present, and future.',
        howToSign: 'With non-dominant hand held flat or fist, tap your dominant curved index fingertip onto your non-dominant wrist twice.',
        exampleSentence: '"What time does the conference begin?"',
        culturalNote: 'Directly references the traditional position of a wristwatch.',
        sequence: ['T', 'I', 'M', 'E'], 
        tip: 'Tap index finger on wrist watch area' 
    },

    // Feelings & States
    { 
        id: 'happy', 
        word: 'HAPPY', 
        category: 'Feelings', 
        emoji: '😊', 
        description: 'Feeling joyful', 
        meaning: 'Feeling or showing pleasure, joy, or contentment.',
        howToSign: 'Hold one or both flat open hands against chest with palms facing inward. Brush upward repeatedly in gentle lifting strokes.',
        exampleSentence: '"I am so happy to see everyone smiling."',
        culturalNote: 'A bright smile and lifted eyebrows are essential non-manual markers for HAPPY.',
        sequence: ['H', 'A', 'P', 'P', 'Y'], 
        tip: 'Open palm brushing chest upward' 
    },
    { 
        id: 'sad', 
        word: 'SAD', 
        category: 'Feelings', 
        emoji: '😢', 
        description: 'Feeling down / sorrow', 
        meaning: 'Feeling or showing sorrow, unhappiness, or grief.',
        howToSign: 'Hold both open hands in front of your face with palms facing inward. Slowly drop your hands downward while tilting your head and looking down.',
        exampleSentence: '"She felt sad after hearing the news."',
        culturalNote: 'Facial grammar: downcast eyes, drooping mouth, and lowered head are mandatory.',
        sequence: ['S', 'A', 'D'], 
        tip: 'Open hands dropping in front of face' 
    },
    { 
        id: 'good', 
        word: 'GOOD', 
        category: 'Feelings', 
        emoji: '👍', 
        description: 'Positive condition', 
        meaning: 'To be desired or approved of; of high quality or standard.',
        howToSign: 'Touch fingers of dominant flat hand to your lips or chin. Move hand downward into the open palm of non-dominant hand.',
        exampleSentence: '"Everything looks good and ready to go."',
        culturalNote: 'Direct, confident eye contact with a gentle nod reinforces the sign.',
        sequence: ['G', 'O', 'O', 'D'], 
        tip: 'Hand from chin into resting palm' 
    },
    { 
        id: 'bad', 
        word: 'BAD', 
        category: 'Feelings', 
        emoji: '👎', 
        description: 'Negative condition', 
        meaning: 'Of poor quality or a low standard; not satisfactory.',
        howToSign: 'Touch fingertips of dominant flat hand to lips/chin, then turn palm sharply downward and outward as if pushing something negative away.',
        exampleSentence: '"The rainy weather was bad for the picnic."',
        culturalNote: 'Slight grimace or frown communicates the negative aspect of the word.',
        sequence: ['B', 'A', 'D'], 
        tip: 'Hand from chin turning down' 
    },
    { 
        id: 'tired', 
        word: 'TIRED', 
        category: 'Feelings', 
        emoji: '🥱', 
        description: 'Needing rest', 
        meaning: 'In need of sleep or rest; weary from physical or mental exertion.',
        howToSign: 'Place bent fingertips of both hands on sides of your chest. Roll your hands downward so palms face inward and shoulders drop.',
        exampleSentence: '"After a long workday, I feel very tired."',
        culturalNote: 'Dropping shoulders, exhalation, and tired eyes dramatically express exhaustion.',
        sequence: ['T', 'I', 'R', 'E', 'D'], 
        tip: 'Bent hands dropping on chest' 
    },
    { 
        id: 'excited', 
        word: 'EXCITED', 
        category: 'Feelings', 
        emoji: '🤩', 
        description: 'High enthusiasm', 
        meaning: 'Very enthusiastic, eager, and full of energy.',
        howToSign: 'Extend middle fingers inward while other fingers remain straight. Alternately brush middle fingertips upward against your chest in rapid circular strokes.',
        exampleSentence: '"We are so excited for the upcoming trip!"',
        culturalNote: 'Wide energetic eyes and an animated smile convey true excitement.',
        sequence: ['E', 'X', 'C', 'I', 'T', 'E', 'D'], 
        tip: 'Middle fingers alternately brushing chest' 
    },

    // Questions
    { 
        id: 'who', 
        word: 'WHO', 
        category: 'Questions', 
        emoji: '❓', 
        description: 'Inquiring about a person', 
        meaning: 'What or which person or people.',
        howToSign: 'Place thumb of dominant hand on your chin with index finger extended upright. Wiggle your index finger back and forth like a trigger.',
        exampleSentence: '"Who is speaking at the seminar?"',
        culturalNote: 'WH-Question rule: Furrow your eyebrows and lean forward slightly.',
        sequence: ['W', 'H', 'O'], 
        tip: 'Index finger wiggling at chin' 
    },
    { 
        id: 'what', 
        word: 'WHAT', 
        category: 'Questions', 
        emoji: '❓', 
        description: 'Inquiring about a thing', 
        meaning: 'Asking for information specifying something.',
        howToSign: 'Hold both hands open at waist level with palms facing upward. Shake both hands back and forth horizontally in a short side-to-side motion.',
        exampleSentence: '"What is your favorite book?"',
        culturalNote: 'Eyebrows furrowed down and head tilted is essential grammar for WHAT.',
        sequence: ['W', 'H', 'A', 'T'], 
        tip: 'Palms up shaking side to side' 
    },
    { 
        id: 'where', 
        word: 'WHERE', 
        category: 'Questions', 
        emoji: '📍', 
        description: 'Inquiring about location', 
        meaning: 'In or to what place or position.',
        howToSign: 'Hold dominant index finger pointing upward with palm facing forward. Shake your index finger back and forth side to side.',
        exampleSentence: '"Where is the nearest library?"',
        culturalNote: 'Furrow your eyebrows and look toward the direction of inquiry.',
        sequence: ['W', 'H', 'E', 'R', 'E'], 
        tip: 'Index finger shaking side to side' 
    },
    { 
        id: 'when', 
        word: 'WHEN', 
        category: 'Questions', 
        emoji: '⏳', 
        description: 'Inquiring about time', 
        meaning: 'At what time or period.',
        howToSign: 'Hold non-dominant index finger pointing up stationary. Circle dominant index finger around the stationary tip once and touch its tip.',
        exampleSentence: '"When will the presentation begin?"',
        culturalNote: 'Furrow eyebrows; represents a clock hand completing a revolution.',
        sequence: ['W', 'H', 'E', 'N'], 
        tip: 'Index circling other index tip' 
    },
    { 
        id: 'why', 
        word: 'WHY', 
        category: 'Questions', 
        emoji: '🤔', 
        description: 'Inquiring about reason', 
        meaning: 'For what reason or purpose.',
        howToSign: 'Touch fingers of open dominant hand to your temple. Pull hand away and downward while transitioning fingers into a Y-handshape.',
        exampleSentence: '"Why did you choose this field of study?"',
        culturalNote: 'Furrow eyebrows deeply as this is an investigative question.',
        sequence: ['W', 'H', 'Y'], 
        tip: 'Hand at temple pulling into Y-shape' 
    },
    { 
        id: 'how', 
        word: 'HOW', 
        category: 'Questions', 
        emoji: '⚙️', 
        description: 'Inquiring about method', 
        meaning: 'In what way or by what manner or means.',
        howToSign: 'Hold both curved hands with knuckles touching and palms facing inward. Roll hands outward until palms face upward toward the sky.',
        exampleSentence: '"How do you solve this puzzle?"',
        culturalNote: 'Keep eyebrows furrowed and head tilted slightly forward.',
        sequence: ['H', 'O', 'W'], 
        tip: 'Knuckles rotating outwards' 
    }
];

/**
 * Gets landmark points for a letter or fallback
 */
function getLandmarksForChar(char) {
    const upper = char.toUpperCase();
    if (ASL_DICTIONARY[upper]) {
        return ASL_DICTIONARY[upper];
    }
    return {
        name: upper,
        description: `Fingerspelling letter '${upper}'`,
        emoji: '🖐️',
        landmarks: DEFAULT_PALM
    };
}

/**
 * Filters words by category
 */
function filterWordsByCategory(category) {
    if (!category || category === 'All') return WORD_DATABASE;
    return WORD_DATABASE.filter(item => item.category === category);
}

/**
 * Searches words by query substring
 */
function searchWords(query) {
    if (!query) return WORD_DATABASE;
    const q = query.trim().toUpperCase();
    return WORD_DATABASE.filter(item => item.word.includes(q) || item.category.toUpperCase().includes(q) || item.description.toUpperCase().includes(q));
}

/**
 * Renders hand landmarks and skeletal bone connections onto HTML Canvas
 */
function renderHandSkeleton(ctx, landmarks, width = 400, height = 400, highlightPoint = -1) {
    ctx.clearRect(0, 0, width, height);

    // Background styling
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Draw subtle grid overlay
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    if (!landmarks || landmarks.length < 21) return;

    // Bone connection lines
    const connections = [
        // Palm / Base
        [0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [13, 17],
        // Thumb
        [1, 2], [2, 3], [3, 4],
        // Index
        [5, 6], [6, 7], [7, 8],
        // Middle
        [9, 10], [10, 11], [11, 12],
        // Ring
        [13, 14], [14, 15], [15, 16],
        // Pinky
        [17, 18], [18, 19], [19, 20]
    ];

    // Glow effect for bones
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#6366f1';
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    connections.forEach(([p1, p2]) => {
        const pt1 = landmarks[p1];
        const pt2 = landmarks[p2];
        ctx.beginPath();
        ctx.moveTo(pt1[0], pt1[1]);
        ctx.lineTo(pt2[0], pt2[1]);
        ctx.stroke();
    });

    // Draw 21 joint landmark nodes
    landmarks.forEach((pt, idx) => {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], idx === highlightPoint ? 8 : (idx % 4 === 0 ? 6 : 4), 0, Math.PI * 2);
        
        if (idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20) {
            // Fingertips: Emerald green
            ctx.shadowColor = '#10b981';
            ctx.fillStyle = '#10b981';
        } else if (idx === 0) {
            // Wrist: Bright Amber
            ctx.shadowColor = '#f59e0b';
            ctx.fillStyle = '#f59e0b';
        } else {
            // Joints: Violet
            ctx.shadowColor = '#818cf8';
            ctx.fillStyle = '#ffffff';
        }
        ctx.fill();
    });

    ctx.shadowBlur = 0; // Reset shadow
}

// Export functions to window
window.ASL_DICTIONARY = ASL_DICTIONARY;
window.COMMON_PHRASES = COMMON_PHRASES;
window.WORD_DATABASE = WORD_DATABASE;
window.filterWordsByCategory = filterWordsByCategory;
window.searchWords = searchWords;
window.getLandmarksForChar = getLandmarksForChar;
window.renderHandSkeleton = renderHandSkeleton;

