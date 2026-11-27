import type { TopicConfig, TopicId } from '../types';

export const COACH_COCO_IMAGE = '/src/assets/images/coach_coco_1795257914088.jpg';

export const TOPICS: TopicConfig[] = [
  {
    id: 'food',
    title: 'My Favorite Food',
    koreanTitle: '내가 가장 좋아하는 음식',
    tagline: 'Describe its taste, share a memory, and tell friends why to try it.',
    imageUrl: '/src/assets/images/topic_food_1795257913906.jpg',
    imageAlt: 'Warm bowl of Korean tteokbokki and golden hotteok on a wooden table',
    cardCategoryLabel: 'Food Pick',
    planningQuestions: [
      {
        key: 'q1',
        question: '1. What is your favorite food?',
        koreanHint: '가장 좋아하는 음식은 무엇인가요?',
        placeholder: 'e.g., tteokbokki / ramen / fried rice',
      },
      {
        key: 'q2',
        question: '2. What does it look or taste like?',
        koreanHint: '모양이나 맛은 어떤가요?',
        placeholder: 'e.g., warm, sweet, and a little spicy',
      },
      {
        key: 'q3',
        question: '3. When or who do you usually eat it with?',
        koreanHint: '보통 언제, 누구와 함께 먹나요?',
        placeholder: 'e.g., on weekends with my family',
      },
      {
        key: 'q4',
        question: '4. Why should a friend try it?',
        koreanHint: '친구에게 왜 추천하고 싶나요?',
        placeholder: 'e.g., because it is delicious and makes me happy',
      },
    ],
    level1Outline: [
      'My favorite food is ______.',
      'It is ______ and ______.',
      'I usually eat it ______ (with ______).',
      'You should try it because ______.',
    ],
    level1Expressions: [
      'sweet / spicy / salty / crispy',
      'warm and soft',
      'on cold days / on weekends',
      'with my family / with my friends',
      'You should try it because...',
    ],
    level2Prompts: [
      'Sentence 1: Name the food you want to recommend.',
      'Sentence 2: Describe its taste, color, or ingredients.',
      'Sentence 3: Share when or with whom you enjoy eating it.',
      'Sentence 4: Give one clear reason why your friend should try it.',
    ],
    level2Keywords: ['taste', 'warm / fresh', 'usually', 'and / but / because / so', 'should try'],
    sampleParagraph:
      'My favorite food is hotteok. It is warm and sweet. I usually eat it on cold days. You should try it because it is really delicious!',
    sampleNote: 'Notice how each sentence answers one planning question clearly in simple English.',
  },
  {
    id: 'place',
    title: 'My Favorite Place',
    koreanTitle: '내가 가장 좋아하는 장소',
    tagline: 'Paint a picture of a special spot and explain why others will enjoy visiting.',
    imageUrl: '/src/assets/images/topic_place_1795257914635.jpg',
    imageAlt: 'Sunlit neighborhood library terrace overlooking green park trees',
    cardCategoryLabel: 'Place Pick',
    planningQuestions: [
      {
        key: 'q1',
        question: '1. What is your favorite place?',
        koreanHint: '가장 좋아하는 장소는 어디인가요?',
        placeholder: 'e.g., the town library / the river park',
      },
      {
        key: 'q2',
        question: '2. What can you see or feel there?',
        koreanHint: '그곳에서 무엇을 보거나 느낄 수 있나요?',
        placeholder: 'e.g., tall green trees, quiet, and bright sunlight',
      },
      {
        key: 'q3',
        question: '3. What do you usually do there?',
        koreanHint: '그곳에서 보통 무엇을 하나요?',
        placeholder: 'e.g., read comic books and listen to music',
      },
      {
        key: 'q4',
        question: '4. Why should a friend visit this place?',
        koreanHint: '친구에게 왜 이곳을 추천하나요?',
        placeholder: 'e.g., because it is peaceful and relaxing',
      },
    ],
    level1Outline: [
      'My favorite place is ______.',
      'It is ______ and has ______.',
      'I usually ______ there.',
      'You should visit it because ______.',
    ],
    level1Expressions: [
      'quiet / cozy / bright / peaceful',
      'many books / green trees',
      'after class / on Saturdays',
      'read books / take a walk / rest',
      'You should visit it because...',
    ],
    level2Prompts: [
      'Sentence 1: Introduce your favorite place.',
      'Sentence 2: Describe what it looks or feels like.',
      'Sentence 3: Tell what you usually do when you go there.',
      'Sentence 4: Recommend the place with a clear reason.',
    ],
    level2Keywords: ['peaceful / cozy', 'trees / books', 'usually', 'and / but / because / so', 'should visit'],
    sampleParagraph:
      'My favorite place is my town library. It is quiet and has many green trees outside. I usually read comic books there after class. You should visit it because it helps you feel calm!',
    sampleNote: 'Notice how simple connectors ("and", "because") join ideas smoothly.',
  },
  {
    id: 'hobby',
    title: 'My Favorite Hobby',
    koreanTitle: '내가 가장 좋아하는 취미',
    tagline: 'Share what you love doing in your free time and invite a friend to join in.',
    imageUrl: '/src/assets/images/topic_hobby_1795257914550.jpg',
    imageAlt: 'Sketchbook, colored pencils, headphones, and badminton shuttlecock on a linen desk',
    cardCategoryLabel: 'Hobby Pick',
    planningQuestions: [
      {
        key: 'q1',
        question: '1. What is your favorite hobby?',
        koreanHint: '가장 좋아하는 취미는 무엇인가요?',
        placeholder: 'e.g., drawing pictures / playing badminton',
      },
      {
        key: 'q2',
        question: '2. When or how often do you do it?',
        koreanHint: '언제 또는 얼마나 자주 하나요?',
        placeholder: 'e.g., every weekend / twice a week',
      },
      {
        key: 'q3',
        question: '3. How do you feel when you do it?',
        koreanHint: '그 취미를 할 때 어떤 기분이 드나요?',
        placeholder: 'e.g., happy, relaxed, and full of energy',
      },
      {
        key: 'q4',
        question: '4. Why should a friend try this hobby?',
        koreanHint: '친구가 왜 이 취미를 해보면 좋을까요?',
        placeholder: 'e.g., because it is fun and easy to start',
      },
    ],
    level1Outline: [
      'My favorite hobby is ______.',
      'I usually do it ______.',
      'When I do it, I feel ______.',
      'You should try it because ______.',
    ],
    level1Expressions: [
      'fun / exciting / relaxing / creative',
      'every weekend / in my free time',
      'feel happy / forget stress',
      'easy to learn',
      'You should try it because...',
    ],
    level2Prompts: [
      'Sentence 1: State your favorite hobby.',
      'Sentence 2: Tell when or how often you do it.',
      'Sentence 3: Describe how it makes you feel.',
      'Sentence 4: Explain why your friend should try it too.',
    ],
    level2Keywords: ['free time', 'every weekend', 'feel happy', 'and / but / because / so', 'should try'],
    sampleParagraph:
      'My favorite hobby is playing badminton. I usually play it in the park on Saturdays. It is fast and exciting, so I always smile. You should try it because it keeps you healthy!',
    sampleNote: 'Notice how "so" shows a result and "because" explains the reason.',
  },
];

export function getTopicById(id: TopicId): TopicConfig {
  return TOPICS.find((t) => t.id === id) ?? TOPICS[0];
}
