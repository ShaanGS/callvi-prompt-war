import type { z } from "zod";
import type { courseSchema } from "../schema";
import { L, OPEN_UNGRADED, TEAM_AUTHORED_NOTE, terms } from "../helpers";

const title = L("Rehearse a customer call", "வாடிக்கையாளர் அழைப்புக்குப் பயிற்சி");
const objective = L("Quote a price and agree on a realistic pickup time.", "விலையையும் துணியை எப்போது தர முடியும் என்பதையும் தெளிவாகச் சொல்லுங்கள்.");
const question = L(
  "You shorten trousers for 50 rupees and need two days. I'm your customer: can you do mine for 40 rupees by tomorrow? Answer me as you would on the phone.",
  "பேண்ட் நீளம் குறைக்க உங்க கூலி ஐம்பது ரூபாய். வேலைக்கு ரெண்டு நாள் வேணும். நான் உங்க வாடிக்கையாளர்: நாற்பது ரூபாய்க்கு நாளைக்குள்ள முடிச்சுத் தர முடியுமா? போனில் பேசுவது போல பதில் சொல்லுங்க.",
);

export const customerCall: z.input<typeof courseSchema> = {
  id: "customer-call", title, sortOrder: 4, level: "beginner", status: "published",
  languages: ["ta-IN", "en-IN"], primaryLanguage: "ta-IN", estimatedMinutes: 3,
  audience: L("Home-based sellers practising a customer conversation.", "வீட்டிலிருந்து தொழில் செய்து வாடிக்கையாளரிடம் பேசிப் பழக விரும்புபவர்கள்."),
  summary: objective, outcomes: [objective],
  description: L("Take the seller's part in a tailoring call. Hear which detail the customer still needs, then try again.", "தையல் வேலை கேட்டு ஒருவர் போன் செய்கிறார். நீங்கள் பதில் சொல்லுங்கள். விடுபட்ட தகவலைக் கேட்டு மறுபடியும் முயலலாம்."),
  contentReview: { status: "team_authored", note: TEAM_AUTHORED_NOTE },
  recommendationTerms: terms(["customer call", "rehears", "tailor", "pickup", "alterations", "quote a price"], ["தையல்", "வாடிக்கையாளர் அழைப்பு", "பேண்ட்", "விலை பேச", "கஸ்டமர் கால்"]),
  lessons: [{
    id: "call-quote", sequence: 1, title, objective, estimatedMinutes: 3, reviewStatus: "team_authored",
    concepts: [{
      id: "call-price-time", title: objective, keyPoints: [objective],
      explanations: [
        { approach: "plain", text: L("Before accepting a job, tell the customer your price and the time you need.", "வேலையை ஏற்கும் முன், உங்க கூலியையும் எவ்வளவு நேரம் வேணும்னும் சொல்லுங்க.") },
        { approach: "everyday_example", text: L("Imagine promising a cake for tonight when it takes all day tomorrow to bake. Give a pickup time you can keep.", "நாளைக்குத்தான் கேக் செய்ய முடியும் என்றால், இன்னிக்கே தர்றேன்னு சொல்ல முடியாதுல்ல? அதே மாதிரி முடிக்கக்கூடிய நேரத்தைச் சொல்லுங்க.") },
      ],
      checkQuestion: L("What does the customer need to know before agreeing?", "சரி சொல்வதற்கு முன் வாடிக்கையாளருக்கு என்ன தெரியணும்?"),
    }],
    practice: [{
      id: "call-counteroffer", conceptId: "call-price-time", kind: "role_play", prompt: question,
      hints: [L("Think about the price and the pickup separately.", "கூலியையும் முடிக்கிற நாளையும் தனித்தனியா யோசிங்க.")],
      modelAnswer: L("I can shorten them for 50 rupees and have them ready in two days. Would that work?", "ஐம்பது ரூபாய் ஆகும். ரெண்டு நாள்ல முடிச்சுத் தருவேன். உங்களுக்கு அது சரியா?"),
      rubric: {
        mode: "open", requiredForCorrect: ["quoted-fee", "pickup-time"],
        criteria: [
          { id: "quoted-fee", kind: "terms", description: L("your usual fee", "உங்க வழக்கமான கூலி"), terms: terms(["50", "fifty rupees", "fifty bucks", "costs fifty", "charge fifty"], ["ஐம்பது", "அம்பது", "ஐம்பதுக்கு", "ஐம்பதுதான்"]) },
          { id: "pickup-time", kind: "terms", description: L("when the trousers will be ready", "பேண்ட் எப்போது தயாராகும்"), terms: terms(["two days", "2 days", "day after tomorrow"], ["ரெண்டு நாள்", "இரண்டு நாள்", "இரண்டு நாட்", "ரெண்டு நாள", "இரண்டு நாள", "நாளை மறுநாள்", "நாளை மறுநாள", "நாளைக்கு மறுநாள்"]) },
        ],
        feedback: {
          correct: L("I heard your fee and when I can collect the trousers.", "உங்க கூலியும் எப்போ வந்து வாங்கிக்கலாம்னும் புரிஞ்சுது."),
          partial: L("I heard one detail. Let's finish the reply.", "ஒரு விஷயம் புரிஞ்சுது. இன்னொன்றையும் சொல்லிப் பாருங்க."),
          needs_practice: L("Try giving the customer an offer you can keep.", "உங்களால் செய்யக்கூடியதை வாடிக்கையாளரிடம் சொல்லிப் பாருங்க."),
          ungraded: OPEN_UNGRADED,
        },
      },
    }],
    realWorldAction: L("Practise giving a friend the price and pickup time for a service you offer.", "நீங்க செய்ற ஒரு வேலைக்கு எவ்வளவு கூலி, எப்போ தர முடியும்னு ஒரு தோழியிடம் சொல்லிப் பழகுங்க."),
  }],
};
