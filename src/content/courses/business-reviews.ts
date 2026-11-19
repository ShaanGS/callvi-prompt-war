import type { Course, Exercise } from "../schema";
import { L } from "../helpers";

/** Authored transfer questions. Do not reveal the teaching example first. */
const prompts: Record<string, Exercise["prompt"]> = {
  "sbs-01-offer-sentence": L(
    "Imagine a neighbour asks about your business for the first time. In one sentence, say what you offer and who it is for.",
    "புதுசா ஒரு பக்கத்து வீட்டுக்காரங்க உங்க business பத்தி கேக்குறாங்க. என்ன விக்கிறீங்க, யாருக்காகன்னு ஒரு வாக்கியத்துல சொல்ல முடியுமா?",
  ),
  "sbs-01-first-customer": L(
    "For a home snack business, choose one nearby group to approach first and tell me why those people might find it useful.",
    "வீட்டுல snacks செஞ்சு விக்கிற business-க்கு, முதல்ல பக்கத்துல யார்கிட்ட பேசுவீங்க? அவங்களுக்கு அது ஏன் உதவியா இருக்கும்?",
  ),
  "sbs-01-customer-need": L(
    "A neighbour buys ready-made batter instead of grinding it at home. What everyday problem might that solve?",
    "பக்கத்து வீட்டுல ஒருத்தங்க மாவு அரைக்காம வாங்கிக்கிறாங்க. அவங்களோட எந்த தினசரி சிரமத்துக்கு அது உதவும்?",
  ),
  "sbs-02-batch-costs": L(
    "You are planning a fresh batch of murukku. Apart from your time, name three kinds of costs to write down before working out the cost per packet.",
    "புதுசா முறுக்கு செய்யப் போறீங்க. உங்க நேரம் தவிர, பாக்கெட் செலவு கணக்குப் போடுறதுக்கு முன்னாடி எந்த மூணு வகை செலவை எழுதுவீங்க?",
  ),
  "sbs-02-unit-cost": L(
    "Here is a new batch: 180 rupees total cost for 10 equal packets. What is the cost of one packet?",
    "இந்த முறை வேற batch. மொத்த செலவு நூத்தி எண்பது ரூபா, பத்து சமமான பாக்கெட். ஒரு பாக்கெட்டோட செலவு எவ்வளவு?",
  ),
  "sbs-02-price-covers-costs": L(
    "A seller counts only flour and oil before calling the rest profit. What other costs should she include, and why?",
    "ஒருத்தங்க மாவு, எண்ணெய் செலவு மட்டும் எடுத்துட்டு மீதியெல்லாம் லாபம்னு சொல்றாங்க. இன்னும் என்ன செலவை சேர்க்கணும்? ஏன்?",
  ),
  "sbs-03-introduce": L(
    "I am a new neighbour: what do you sell, why might it help me, and how can I get it? Give me a short introduction.",
    "நான் புதுசா வந்த பக்கத்து வீட்டுக்காரங்க. என்ன விக்கிறீங்க, எனக்கு எப்படி உதவும், எப்படி வாங்கலாம்? சின்னதா அறிமுகம் பண்ணுங்க.",
  ),
  "sbs-03-ask-question": L(
    "I am a customer saying: I might want some snacks for my family. Ask me one useful question before suggesting an order.",
    "நான் customer: வீட்டுக்கு கொஞ்சம் snacks வாங்கலாம்னு இருக்கேன். Order சொல்லுறதுக்கு முன்னாடி என்கிட்ட ஒரு உதவியான கேள்வி கேளுங்க.",
  ),
  "sbs-03-honest-answer": L(
    "A new customer wants you to deliver every morning. You can only deliver on Saturdays nearby. Reply without promising something you cannot do.",
    "புது customer தினமும் காலைல delivery கேக்குறாங்க. உங்களால பக்கத்துல சனிக்கிழமை மட்டும் தான் தர முடியும். முடியாததை சொல்லாம எப்படி பதில் சொல்வீங்க?",
  ),
};

export function withBusinessReviews(course: Course): Course {
  return {
    ...course,
    lessons: course.lessons.map((lesson) => ({
      ...lesson,
      practice: [
        ...lesson.practice,
        ...lesson.practice.map((base): Exercise => {
          const review: Exercise = {
            ...base,
            id: `${base.id}-review`,
            purpose: "review",
            prompt: prompts[base.id],
            rubric: { ...base.rubric, version: base.rubric.version + 1 },
          };
          if (base.id !== "sbs-02-unit-cost") return review;
          return {
            ...review,
            modelAnswer: L(
              "180 divided by 10 is 18 rupees per packet.",
              "நூத்தி எண்பதை பத்தால வகுத்தா, ஒரு பாக்கெட்டுக்கு பதினெட்டு ரூபா.",
            ),
            hints: [
              L(
                "Divide the new total, 180, by the 10 equal packets.",
                "இந்த புது மொத்த செலவு நூத்தி எண்பதை, பத்து பாக்கெட்டுக்கு பிரிச்சுப் பாருங்க.",
              ),
            ],
            rubric: {
              ...review.rubric,
              feedback: {
                ...review.rubric.feedback,
                correct: L(
                  "Correct: 180 divided by 10 is 18 rupees per packet for this new batch.",
                  "சரி, இந்த புது batch-ல ஒரு பாக்கெட்டுக்கு பதினெட்டு ரூபா செலவு.",
                ),
                needs_practice: L(
                  "Not quite for this new batch. Divide this batch's total cost by its packet count.",
                  "இந்த புது batch-க்கு இன்னொரு தடவை பாத்துக்கலாம். இதோட மொத்த செலவை பாக்கெட் எண்ணிக்கையால பிரிச்சுப் பாருங்க.",
                ),
              },
              criteria: review.rubric.criteria.map((c) =>
                c.kind === "numeric"
                  ? {
                      ...c,
                      expected: 18,
                      description: L("Cost per packet is 18 rupees", "ஒரு பாக்கெட் செலவு பதினெட்டு ரூபா"),
                      commonMistakes: [],
                    }
                  : c,
              ),
            },
          };
        }),
      ],
    })),
  };
}
