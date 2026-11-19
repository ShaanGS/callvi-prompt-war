import type { z } from "zod";
import type { courseSchema } from "../schema";
import { L, NUMBER_NOT_HEARD, OPEN_UNGRADED, TEAM_AUTHORED_NOTE, terms } from "../helpers";

/**
 * Course 1 — Small Business Starter (flagship, Tamil-first).
 * Team-authored. Not mentor-reviewed. See contentReview and reviewFlags.
 */

const WHAT_IS_OFFERED = terms(
  [
    "make",
    "sell",
    "stitch",
    "cook",
    "teach",
    "offer",
    "provide",
    "bake",
    "tailor",
    "murukku",
    "snack",
    "batter",
    "tuition",
    "service",
    "product",
    "pickle",
  ],
  [
    "செய்",
    "செஞ்ச",
    "செஞ்சி",
    "விக்க",
    "விப்ப",
    "விற்",
    "ஸ்நாக்",
    "ஸ்னாக்",
    "தைக்",
    "சமை",
    "கற்று",
    "வழங்க",
    "முறுக்கு",
    "மாவு",
    "டியூஷன்",
    "சேவை",
    "பொருள்",
    "தின்பண்ட",
    "ஊறுகாய்",
  ],
);

export const smallBusinessStarter: z.input<typeof courseSchema> = {
  id: "small-business-starter",
  sortOrder: 1,
  title: L("Small Business Starter", "சிறு தொழில் தொடக்கம்"),
  summary: L(
    "Turn a home-business idea into a clear offer, understand simple costs, and practise your first customer conversation.",
    "வீட்டிலிருந்து ஒரு business பண்ணலாம்னு நினைக்கிறீங்களா? என்ன விக்கலாம், செலவு என்ன, customer-கிட்ட எப்படிப் பேசலாம் — ஒண்ணொண்ணா பழகலாம்.",
  ),
  description: L(
    "A short, practical course for anyone thinking about a small home-based or local business, or who already sells something and wants to understand it better. You will work with small, clear numbers and everyday examples. The course is educational: it does not tell you what price to charge and it does not promise any income.",
    "வீட்டிலிருந்தோ அருகிலோ ஒரு சிறு தொழில் தொடங்க நினைப்பவர்களுக்கும், ஏற்கனவே ஏதாவது விற்று அதை இன்னும் நன்றாகப் புரிந்துகொள்ள விரும்புபவர்களுக்கும் ஒரு குறுகிய, நடைமுறைப் பாடநெறி. சிறிய, தெளிவான எண்களையும் அன்றாட உதாரணங்களையும் பயன்படுத்துவோம். இது கற்றலுக்கானது மட்டுமே: எந்த விலை வைக்க வேண்டும் என்று சொல்லாது, எந்த வருமானத்தையும் உறுதியளிக்காது.",
  ),
  audience: L(
    "Learners exploring a small home-based or local business. No previous business experience is needed.",
    "வீட்டிலிருந்து அல்லது உள்ளூரில் ஒரு சிறு தொழில் பற்றி யோசிப்பவர்கள். முன் அனுபவம் தேவையில்லை.",
  ),
  outcomes: [
    L(
      "Describe a product or service and a possible customer.",
      "ஒரு பொருளையோ சேவையையோ, அதை வாங்கக்கூடிய ஒரு வாடிக்கையாளரையோ விவரிப்பது.",
    ),
    L(
      "Tell cost, selling price and simple profit apart using small examples.",
      "சிறிய உதாரணங்களைக் கொண்டு செலவு, விற்பனை விலை, எளிய லாபம் ஆகியவற்றை வேறுபடுத்துவது.",
    ),
    L(
      "Practise introducing a product and answering a customer's question.",
      "ஒரு பொருளை அறிமுகப்படுத்தவும், வாடிக்கையாளரின் கேள்விக்குப் பதில் சொல்லவும் பழகுவது.",
    ),
  ],
  languages: ["ta-IN", "en-IN"],
  primaryLanguage: "ta-IN",
  level: "beginner",
  status: "published",
  contentReview: { status: "team_authored", note: TEAM_AUTHORED_NOTE },
  estimatedMinutes: 24,
  recommendationTerms: terms(
    [
      "business",
      "sell",
      "selling",
      "price",
      "pricing",
      "cost",
      "profit",
      "customer",
      "product",
      "shop",
      "home business",
      "snack",
      "food",
      "tailoring",
      "start",
      "earn",
      "small business",
      "own business",
    ],
    [
      "முறுக்கு",
      "விக்க",
      "விப்ப",
      "பிசினஸ்",
      "ஸ்நாக்",
      "தொழில்",
      "வியாபார",
      "விற்க",
      "விற்ப",
      "விலை",
      "செலவு",
      "லாப",
      "வாடிக்கையாளர்",
      "பொருள்",
      "கடை",
      "சொந்த",
      "சுய தொழில்",
      "தையல்",
      "உணவு",
      "தின்பண்ட",
    ],
  ),
  lessons: [
    // ---------------------------------------------------------------------
    {
      id: "sbs-01",
      sequence: 1,
      title: L("A business idea and its customer", "தொழில் யோசனையும் அதன் வாடிக்கையாளரும்"),
      objective: L(
        "Describe what you could offer, who might buy it, and what need it meets.",
        "நீங்கள் என்ன வழங்கலாம், யார் வாங்கக்கூடும், அது அவர்களின் எந்தத் தேவையை நிறைவேற்றும் என்று விவரிப்பது.",
      ),
      estimatedMinutes: 8,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "sbs-offer",
          title: L("What you offer", "நீங்கள் வழங்குவது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Start with what you can make or do, and who it could help. For example, homemade murukku for families nearby. A clear offer is easier to explain than just saying you want to start a business.",
                "Business-ன்னா முதல்ல பெரிய கடை தேவைன்னு இல்ல. நீங்க என்ன செய்ய முடியும், யாருக்கு விக்கலாம் — இதைத் தெளிவா சொன்னா போதும். வீட்டுல முறுக்கு செஞ்சு பக்கத்துல இருக்கிற குடும்பங்களுக்கு விக்கிறதும் ஒரு தொடக்கம்தான்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A neighbour makes fresh murukku on Saturdays and sells it in small packets to families on her street. Her customer can picture exactly what they will get.",
                "உங்க பக்கத்து வீட்டுல ஒருத்தங்க சனிக்கிழமை முறுக்கு செய்து சின்ன packet-ல விக்கிறாங்கன்னு வைங்க. என்ன கிடைக்கும், யாருக்கு உதவும் — customer-க்கு உடனே புரியும் இல்லையா?",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Build one sentence with two pieces: what you make, then who it is for. You do not need a business name or a polished sales pitch yet.",
                "ஒரு வரியை ரெண்டு பகுதியா நினைச்சுக்கலாம். முதல்ல என்ன செய்வீங்க; அடுத்து யாருக்குச் செய்வீங்க. இப்போ business பெயரோ, பெரிய sales பேச்சோ தேவையில்லை.",
              ),
            },
          ],
          keyPoints: [
            L(
              "A product is something you make or sell; a service is work you do for someone.",
              "பொருள் என்பது நீங்கள் செய்யும் அல்லது விற்கும் ஒன்று; சேவை என்பது ஒருவருக்காக நீங்கள் செய்யும் வேலை.",
            ),
            L(
              "Describe your offer in one clear sentence: what it is and who it is for.",
              "நீங்கள் வழங்குவதை ஒரு தெளிவான வாக்கியத்தில் சொல்லுங்கள்: அது என்ன, யாருக்காக.",
            ),
          ],
          checkQuestion: L("In one sentence, what could you offer?", "ஒரே வாக்கியத்தில், நீங்கள் என்ன வழங்க முடியும்?"),
        },
        {
          id: "sbs-customer",
          title: L("Who the customer is", "வாடிக்கையாளர் யார்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Your first customer does not have to be everyone. Pick a nearby group with a clear need, like working families who have little time to prepare breakfast.",
                "முதல்ல எல்லாருக்கும் விக்கணும்னு நினைக்க வேண்டாம். உங்க பக்கத்துல யாருக்கு இது தேவைன்னு பாருங்க. காலையில சமைக்க நேரமில்லாத, வேலைக்குப் போற குடும்பங்கள் மாதிரி ஒரு group-ல தொடங்கலாம்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "It is like cooking for someone: knowing who will eat helps you decide what to make. Knowing your customer helps you shape your offer.",
                "யாருக்குச் சமைக்கிறோம்னு தெரிஞ்சா அதுக்கேத்த மாதிரி செய்வோம் இல்லையா? Business-லயும் அதேதான். யார் வாங்குவாங்கன்னு தெரிஞ்சா அவங்களுக்கு ஏத்த மாதிரி செய்யலாம்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "Someone stitching blouses might start with women nearby who need one for a family function. That is a clearer first customer than everyone in the city.",
                "Blouse தைக்கிறீங்கன்னு வைங்க. Function-க்கு blouse தேவைப்படுற பக்கத்து வீட்டுப் பெண்கள்கிட்ட முதல்ல பேசலாம். ஊர்ல இருக்கிற எல்லாரும்னு சொல்றதைவிட இது தெளிவான தொடக்கம்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Start with one kind of customer, not everyone.",
              "எல்லோரையும் அல்ல, ஒரு வகை வாடிக்கையாளரிலிருந்து தொடங்குங்கள்.",
            ),
            L(
              "A clear customer helps you decide what to make and how to talk about it.",
              "வாடிக்கையாளர் தெளிவாக இருந்தால், என்ன செய்வது, எப்படிப் பேசுவது என்று முடிவு செய்வது எளிது.",
            ),
          ],
          checkQuestion: L(
            "Who might be the first customer for your offer?",
            "நீங்கள் வழங்குவதை முதலில் யார் வாங்கக்கூடும்?",
          ),
        },
        {
          id: "sbs-customer-need",
          title: L("What the customer needs", "வாடிக்கையாளரின் தேவை"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "People buy something because it helps them. It might save time, be convenient, or be available nearby. Find out which problem your offer could solve.",
                "நம்ம பொருள் வாங்கினா அவங்களுக்கு என்ன உதவி கிடைக்கும்? நேரம் மிச்சமாகுமா, பக்கத்துலயே கிடைக்குமா, வேலை சுலபமாகுமா? இதைத் தெரிஞ்சுக்கிட்டா என்ன சொல்லி விக்கணும்னு தெளிவாகும்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A busy family may not have time to grind idli batter. Ready-made batter helps with that job. The batter is the product; saving time is the need it meets.",
                "காலையில அவசரமா கிளம்புற வீட்டுல தினமும் மாவு அரைக்க நேரம் இருக்காது. ரெடியா இட்லி மாவு கிடைச்சா ஒரு வேலை குறையும். மாவு பொருள்; நேரம் மிச்சமாவது அவங்களுக்கு உதவி.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Think about what is difficult for the customer today. Then check your guess by asking them; do not assume you already know.",
                "அவங்களுக்கு எந்த வேலை கஷ்டமா இருக்கும்னு யோசிங்க. ஆனா நாம நினைக்கிறதே சரின்னு முடிவு பண்ண வேண்டாம். அவங்ககிட்ட கேட்டுத்தான் தெரிஞ்சுக்கணும்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "A need is the problem or wish behind a purchase.",
              "ஒரு பொருளை வாங்குவதற்குப் பின்னால் இருக்கும் சிரமம் அல்லது விருப்பமே தேவை.",
            ),
            L("Check your guess by asking real people.", "உங்கள் ஊகத்தை உண்மையான மனிதர்களிடம் கேட்டுச் சரிபாருங்கள்."),
          ],
          checkQuestion: L(
            "What difficulty might your customer have that your offer could help with?",
            "நீங்கள் வழங்குவது உதவக்கூடிய எந்தச் சிரமம் உங்கள் வாடிக்கையாளருக்கு இருக்கலாம்?",
          ),
        },
      ],
      practice: [
        {
          id: "sbs-01-offer-sentence",
          conceptId: "sbs-offer",
          kind: "explain",
          prompt: L(
            "What could you make or sell, and who is it for? Try one sentence. You can use the murukku example if you do not have an idea yet.",
            "நீங்க என்ன செய்யலாம் இல்ல விக்கலாம், யாருக்கு? ஒரு வரியில சொல்லிப் பாருங்க. இன்னும் idea இல்லன்னா முறுக்கு example-ஐ எடுத்துக்கலாம்.",
          ),
          hints: [
            L(
              "Start with 'I make…' or 'I sell…', then add who it is for.",
              "'நான் … செய்கிறேன்' அல்லது 'நான் … விற்கிறேன்' என்று தொடங்கி, பிறகு யாருக்காக என்று சேர்த்துச் சொல்லுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "I make fresh murukku in small packets for working families on my street.",
            "என் தெருவில் வேலைக்குச் செல்லும் குடும்பங்களுக்காக, சிறிய பாக்கெட்டுகளில் புதிய முறுக்கு செய்கிறேன்.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "says-what",
                kind: "terms",
                description: L("Says what is offered", "என்ன வழங்கப்படுகிறது என்று சொல்கிறது"),
                terms: WHAT_IS_OFFERED,
              },
              {
                id: "says-who",
                kind: "terms",
                description: L("Says who it is for", "யாருக்காக என்று சொல்கிறது"),
                terms: terms(
                  [
                    "for",
                    "customer",
                    "people",
                    "famil",
                    "women",
                    "student",
                    "worker",
                    "neighbour",
                    "neighbor",
                    "office",
                    "children",
                    "parent",
                  ],
                  [
                    "க்காக",
                    "ங்களுக்கு",
                    "பேருக்கு",
                    "வீட்டுக்கு",
                    "கஸ்டமர்",
                    "தெரு",
                    "வாடிக்கையாளர்",
                    "மக்கள்",
                    "குடும்ப",
                    "பெண்",
                    "மாணவ",
                    "வேலைக்கு",
                    "பக்கத்து",
                    "அலுவலக",
                    "குழந்தை",
                    "பெற்றோர்",
                  ],
                ),
              },
            ],
            requiredForCorrect: ["says-what", "says-who"],
            feedback: {
              correct: L(
                "Clear: your sentence says what you offer and who it is for.",
                "என்ன விக்கிறீங்க, யாருக்குன்னு தெளிவா சொன்னீங்க.",
              ),
              partial: L(
                "Good start. Your sentence covers part of it. Add the missing piece so a customer knows both what it is and who it is for.",
                "ஒரு பகுதியைச் சொன்னீங்க. என்ன விக்கிறீங்க, யாருக்குன்னு ரெண்டையும் சேர்த்துச் சொல்லலாம்.",
              ),
              needs_practice: L(
                "Let's try once more. Say what you make or do, and then who it is for.",
                "பரவாயில்லை, சின்னதா தொடங்கலாம். என்ன செய்வீங்க, யாருக்கு விப்பீங்கன்னு சொல்லிப் பாருங்க.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "sbs-01-first-customer",
          conceptId: "sbs-customer",
          kind: "decide",
          prompt: L(
            "Kala sells fresh idli batter. Should she start with everyone in the city, or working families on her street who have little time in the morning? Choose one and tell me why.",
            "கலா இட்லி மாவு விக்கிறாங்க. ஊர்ல இருக்கிற எல்லார்கிட்டயும் தொடங்கலாமா, இல்ல காலையில நேரமில்லாத அவங்க தெருவில இருக்கிற வேலைக்குப் போற குடும்பங்கள்கிட்டயா? எதைத் தேர்ந்தெடுப்பீங்க, ஏன்?",
          ),
          hints: [
            L(
              "Think about who Kala can actually reach and who has a clear need.",
              "கலா உண்மையில் யாரை அடைய முடியும், யாருக்குத் தெளிவான தேவை இருக்கிறது என்று யோசியுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "Working families on her street, because they are nearby and need to save time in the morning.",
            "அவர் தெருவில் வேலைக்குச் செல்லும் குடும்பங்கள், ஏனென்றால் அவர்கள் அருகில் இருக்கிறார்கள், காலையில் அவர்களுக்கு நேரம் மிச்சமாக வேண்டும்.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "chooses-street",
                kind: "terms",
                description: L(
                  "Chooses the working families on her street",
                  "அவர் தெருவில் வேலைக்குச் செல்லும் குடும்பங்களைத் தேர்ந்தெடுக்கிறது",
                ),
                terms: terms(
                  ["street", "famil", "second", "neighbour", "neighbor", "nearby", "working"],
                  ["தெரு", "குடும்ப", "இரண்டாவது", "வேலைக்கு", "பக்கத்து"],
                ),
              },
              {
                id: "gives-reason",
                kind: "terms",
                description: L(
                  "Gives a reason, such as time, nearness or a clear need",
                  "நேரம், அருகாமை, தெளிவான தேவை போன்ற ஒரு காரணத்தைச் சொல்கிறது",
                ),
                terms: terms(
                  ["time", "morning", "near", "busy", "specific", "clear", "close", "need", "reach"],
                  ["டைம்", "பக்கத்துல", "அவசர", "நேர", "காலை", "அருகில்", "தேவை", "தெளிவ", "பக்கத்தில்"],
                ),
              },
            ],
            requiredForCorrect: ["chooses-street", "gives-reason"],
            feedback: {
              correct: L(
                "Yes. Working families on her street are a clear first customer: they are close by and have a real need to save time.",
                "அவங்க தெருவில இருக்கிற குடும்பங்களைத் தேர்ந்தெடுத்து, அதுக்குக் காரணமும் சொன்னீங்க.",
              ),
              partial: L(
                "Part of the way there. Say which group you choose and give one reason, such as time or being nearby.",
                "எந்த group-ன்னும், ஏன் அவங்கள்னும் சேர்த்துச் சொன்னா பதில் தெளிவாகும்.",
              ),
              needs_practice: L(
                "'Everyone in the city' is hard to reach and doesn't tell Kala what people need. A smaller, nearby group with a clear need is a better start.",
                "எல்லார்கிட்டயும் தொடங்குறது கஷ்டம். அருகில இருக்கிற, நேரம் தேவைப்படுற குடும்பங்களை நினைச்சுப் பாருங்க.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "sbs-01-customer-need",
          conceptId: "sbs-customer-need",
          kind: "explain",
          prompt: L(
            "How does Kala’s ready-made idli batter help a busy family in the morning?",
            "கலாவோட ரெடியான இட்லி மாவு, காலையில அவசரமா கிளம்புற ஒரு குடும்பத்துக்கு எப்படி உதவும்?",
          ),
          hints: [
            L(
              "What is hard for a busy family in the morning?",
              "காலையில் பரபரப்பான ஒரு குடும்பத்துக்கு எது கடினமாக இருக்கும்?",
            ),
          ],
          modelAnswer: L(
            "It saves them the time and effort of grinding batter themselves on busy mornings.",
            "பரபரப்பான காலை நேரங்களில் தாங்களே மாவு அரைக்கும் நேரத்தையும் சிரமத்தையும் அது மிச்சப்படுத்துகிறது.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "names-need",
                kind: "terms",
                description: L(
                  "Names a need such as saving time, freshness or convenience",
                  "நேரம் மிச்சம், புதுமை, வசதி போன்ற ஒரு தேவையைச் சொல்கிறது",
                ),
                terms: terms(
                  ["time", "quick", "busy", "save", "morning", "fresh", "easy", "convenien", "grind", "effort", "work"],
                  ["டைம்", "ஈஸி", "சுலப", "நேர", "சீக்கிர", "மிச்ச", "அவசர", "புதி", "எளி", "அரைக்க", "சிரம", "வசதி"],
                ),
              },
            ],
            requiredForCorrect: ["names-need"],
            feedback: {
              correct: L(
                "That's the need: the batter saves time and effort on busy mornings.",
                "ஆமாம், மாவு அரைக்கிற வேலை குறைஞ்சு நேரம் மிச்சமாகும். அந்த உதவியைத்தான் customer வாங்குறாங்க.",
              ),
              partial: L(
                "You're close. Try to name the difficulty the batter removes.",
                "அவங்க எந்த வேலையைச் சுலபமா முடிக்கலாம்னு சொல்லிப் பாருங்க.",
              ),
              needs_practice: L(
                "Think about the customer rather than the batter: what is hard for a busy family in the morning?",
                "மாவு எப்படி இருக்குன்னு மட்டும் இல்ல; அதை வாங்குற குடும்பத்துக்கு என்ன உதவின்னு யோசிக்கலாம்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Ask two people you already know whether they would want your offer, and what matters to them. Listen first; there is no need to sell or spend money.",
        "உங்களுக்குத் தெரிஞ்ச ரெண்டு பேர்கிட்ட, இப்படிச் செஞ்சா வாங்குவீங்களா, உங்களுக்கு எது முக்கியம்னு கேட்டுப் பாருங்க. இப்போ விக்கவோ, பணம் செலவழிக்கவோ வேண்டாம்; அவங்க சொல்றதைக் கேட்டா போதும்.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "sbs-02",
      sequence: 2,
      title: L("Cost, price and profit", "செலவு, விலை, லாபம்"),
      objective: L(
        "List the direct costs of a batch, work out the cost of one item, and explain why the selling price is different from the cost.",
        "ஒரு தொகுப்புக்கான நேரடிச் செலவுகளைப் பட்டியலிட்டு, ஒரு பொருளின் செலவைக் கணக்கிட்டு, விற்பனை விலை செலவிலிருந்து ஏன் வேறுபடுகிறது என்று விளக்குவது.",
      ),
      estimatedMinutes: 8,
      reviewStatus: "team_authored",
      reviewFlags: [
        L(
          "Pricing content is basic and educational. It needs review by a small-business mentor before wider deployment.",
          "விலை தொடர்பான உள்ளடக்கம் அடிப்படையானது, கற்றலுக்கானது. பரவலாகப் பயன்படுத்துவதற்கு முன் ஒரு சிறு தொழில் வழிகாட்டியால் சரிபார்க்கப்பட வேண்டும்.",
        ),
      ],
      concepts: [
        {
          id: "sbs-direct-costs",
          title: L("Direct costs", "நேரடிச் செலவுகள்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Count what you use to make a batch: ingredients, packets, and cooking fuel. Even small costs matter. Your time and other business costs matter too when you later decide a price.",
                "முறுக்கு செய்ய மாவு, எண்ணெய் வாங்குற செலவு மட்டும் இல்ல. Packet cover, சமைக்கிற gas — இதுக்கும் செலவு இருக்கு. சின்ன தொகையா இருந்தாலும் எழுதி வையுங்க; விலை முடிவு பண்ணும்போது உங்க நேரத்தையும் கணக்கில் எடுக்கணும்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "For a batch of laddu, flour, sugar, ghee, boxes and cooking gas all cost money. Forgetting the boxes or gas makes the batch look cheaper than it really is.",
                "லட்டு செய்றோம்னு வைங்க. மாவு, சர்க்கரை, நெய், பெட்டி, gas — எல்லாத்துக்கும் பணம் போகுது. பெட்டிச் செலவை மறந்துட்டா நிஜமான செலவு தெரியாம போயிடும்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "Imagine making one batch from start to finish. Note the ingredients, then the packing, then what you used for cooking. Keep the costs together.",
                "ஒரு தடவை முறுக்கு செய்றதை ஆரம்பத்திலிருந்து நினைச்சுப் பாருங்க. என்னென்ன வாங்குனீங்க, எதுல pack பண்ணுனீங்க, சமைக்க என்ன பயன்படுத்துனீங்க — அதை எழுதினா செலவுப் பட்டியல் ரெடி.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Direct costs: ingredients, packaging and fuel used for a batch.",
              "நேரடிச் செலவுகள்: ஒரு தொகுப்புக்கான மூலப்பொருட்கள், பேக்கேஜிங், எரிபொருள்.",
            ),
            L(
              "Small costs add up, so write them all down.",
              "சிறிய செலவுகளும் சேர்ந்து பெரிதாகும், அதனால் எல்லாவற்றையும் எழுதுங்கள்.",
            ),
          ],
          checkQuestion: L(
            "What would you spend money on to make one batch of your product?",
            "உங்கள் பொருளின் ஒரு தொகுப்பைச் செய்ய எதற்கெல்லாம் பணம் செலவிடுவீர்கள்?",
          ),
        },
        {
          id: "sbs-unit-cost",
          title: L("Cost of one item", "ஒரு பொருளின் செலவு"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "To find the ingredient cost of one packet, divide the batch ingredient cost by the number of packets. This is only one part of the total cost; packing, fuel and your time still matter.",
                "ஒரு packet-க்கு எவ்வளவு செலவுன்னு தெரிஞ்சுக்க, மொத்தச் செலவை எத்தனை packet வந்துச்சோ அதால பிரிக்கணும். இது ingredients செலவு மட்டும்தான்; cover, gas, உங்க நேரம் தனியா இருக்கு.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "If ingredients for six packets cost sixty rupees, each packet uses ten rupees of ingredients. Share the batch cost equally across the packets.",
                "ஆறு packet செய்ய அறுபது ரூபாய் ingredients செலவாச்சுன்னா, ஒரு packet-க்கு பத்து ரூபாய். மொத்தச் செலவை எல்லா packet-க்கும் சமமா பிரிக்கிறோம், அவ்வளவுதான்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "First find the batch ingredient cost. Then count the packets. Divide that cost by the packet count, without adding the two numbers.",
                "முதல்ல மொத்த ingredients செலவை எடுத்துக்கோங்க. அடுத்து எத்தனை packet-ன்னு பாருங்க. செலவை packet எண்ணிக்கையால வகுக்கணும்; ரெண்டையும் கூட்டக்கூடாது.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Cost of one item = total batch cost ÷ number of items.",
              "ஒரு பொருளின் செலவு = தொகுப்பின் மொத்தச் செலவு ÷ பொருட்களின் எண்ணிக்கை.",
            ),
            L("Include all the direct costs in the total.", "மொத்தத்தில் எல்லா நேரடிச் செலவுகளையும் சேருங்கள்."),
          ],
          checkQuestion: L(
            "If a batch costs ₹60 and makes 6 packets, what does one packet cost?",
            "ஒரு தொகுப்புக்கு ₹60 செலவாகி, அது 6 பாக்கெட்டுகள் தந்தால், ஒரு பாக்கெட்டுக்கு என்ன செலவு?",
          ),
        },
        {
          id: "sbs-cost-vs-price",
          title: L("Cost, selling price and profit", "செலவு, விற்பனை விலை, லாபம்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Cost is what you spend; selling price is what the customer pays. What remains after all the relevant costs is profit. Counting ingredients alone misses packing, fuel and your work.",
                "செலவுன்னா நீங்க கொடுக்கிற பணம். விலைன்னா customer கொடுக்கிற பணம். எல்லாச் செலவும் போக மீதி இருந்தாத்தான் லாபம்; ingredients செலவை மட்டும் பாத்தா போதாது.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "Suppose ingredients cost ten rupees and the cover costs two more. Selling for ten would not even cover those costs. This is an example, not a price recommendation.",
                "Ingredients பத்து ரூபாய், cover ரெண்டு ரூபாய்னு வைங்க. பத்து ரூபாய்க்கே வித்தா cover செலவுகூட திரும்ப வராது. இது கணக்குப் புரிய ஒரு example; உங்க பொருளுக்கு இதே விலை வைங்கன்னு அர்த்தம் இல்ல.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "List ingredients, packing, fuel and other relevant costs, including your time. Compare that with the selling price. Learn what nearby customers pay before deciding your own price.",
                "மாவு, எண்ணெய், cover, gas, உங்க நேரம் — எல்லாத்தையும் கணக்கில் எடுங்க. அதுக்குப் பிறகுதான் விலையோட ஒப்பிடணும். பக்கத்துல என்ன விலைக்கு வாங்குறாங்கன்னும் தெரிஞ்சுக்கோங்க.",
              ),
            },
          ],
          keyPoints: [
            L("Profit = selling price − cost.", "லாபம் = விற்பனை விலை − செலவு."),
            L(
              "A price must cover all relevant costs, including your time.",
              "விலை உங்கள் நேரம் உட்பட எல்லாத் தொடர்புடைய செலவுகளையும் ஈடுகட்ட வேண்டும்.",
            ),
            L(
              "Find out what customers nearby pay before deciding.",
              "முடிவு செய்வதற்கு முன் அருகிலுள்ள வாடிக்கையாளர்கள் எவ்வளவு கொடுக்கிறார்கள் என்று தெரிந்துகொள்ளுங்கள்.",
            ),
          ],
          checkQuestion: L(
            "In your own words, what is the difference between cost and selling price?",
            "உங்கள் சொந்த வார்த்தைகளில், செலவுக்கும் விற்பனை விலைக்கும் என்ன வித்தியாசம்?",
          ),
        },
      ],
      practice: [
        {
          id: "sbs-02-batch-costs",
          conceptId: "sbs-direct-costs",
          kind: "explain",
          prompt: L(
            "Meena makes a batch of murukku using rice flour, oil, plastic covers and cooking gas. What direct costs should she count?",
            "மீனா முறுக்கு செய்ய மாவு, எண்ணெய், cover வாங்குறாங்க; சமைக்க gas பயன்படுத்துறாங்க. இந்தத் தடவை என்னென்ன செலவைக் கணக்கில் எடுக்கணும்?",
          ),
          hints: [
            L(
              "Think of three groups: what goes into the murukku, what it is packed in, and what is used to cook it.",
              "மூன்று பிரிவுகளாக யோசியுங்கள்: முறுக்கில் என்ன போகிறது, எதில் அடைக்கப்படுகிறது, சமைக்க எது பயன்படுகிறது.",
            ),
          ],
          modelAnswer: L(
            "Rice flour and oil, the plastic covers, and the gas used for cooking.",
            "அரிசி மாவும் எண்ணெயும், பிளாஸ்டிக் கவர்கள், சமைக்கப் பயன்பட்ட எரிவாயு.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "ingredients",
                kind: "terms",
                description: L("Ingredients (flour, oil)", "மூலப்பொருட்கள் (மாவு, எண்ணெய்)"),
                terms: terms(["flour", "oil", "ingredient", "rice"], ["மாவு", "எண்ணெய்", "மூலப்பொருள்", "அரிசி"]),
              },
              {
                id: "packaging",
                kind: "terms",
                description: L("Packaging (covers)", "பேக்கேஜிங் (கவர்கள்)"),
                terms: terms(
                  ["cover", "packet", "packag", "bag", "plastic"],
                  ["கவர்", "பாக்கெட்", "பை", "பிளாஸ்டிக்", "பேக்கேஜ்"],
                ),
              },
              {
                id: "fuel",
                kind: "terms",
                description: L("Fuel (gas)", "எரிபொருள் (எரிவாயு)"),
                terms: terms(
                  ["gas", "stove", "fuel", "cylinder"],
                  ["எரிவாயு", "கேஸ்", "காஸ்", "அடுப்பு", "சிலிண்டர்", "எரிபொருள்"],
                ),
              },
            ],
            requiredForCorrect: ["ingredients", "packaging", "fuel"],
            feedback: {
              correct: L(
                "Yes: the flour and oil, the covers and the gas are all direct costs of the batch.",
                "மாவு, எண்ணெய், cover, gas — எல்லாச் செலவையும் சேர்த்தீங்க.",
              ),
              partial: L(
                "You named some of the costs. At least one is missing — check ingredients, packaging and the gas.",
                "சில செலவுகளைச் சொன்னீங்க. Ingredients, cover, gas — இதுல ஏதாவது விட்டுப் போச்சான்னு பாருங்க.",
              ),
              needs_practice: L(
                "Let's go through it together: what goes into the murukku, what is it packed in, and what cooks it?",
                "சேர்ந்து பார்ப்போம். முறுக்குல என்ன போகுது, எதுல pack பண்றோம், எதால சமைக்கிறோம்னு நினைச்சுப் பாருங்க.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "sbs-02-unit-cost",
          conceptId: "sbs-unit-cost",
          kind: "calculation",
          prompt: L(
            "Ingredients for ten packets cost one hundred and twenty rupees. What is the ingredient cost of one packet?",
            "பத்து packet செய்ய ingredients-க்கு நூத்தி இருபது ரூபாய் செலவாகுது. அப்போ ஒரு packet-க்கு ingredients செலவு எவ்வளவு?",
          ),
          hints: [
            L("Share ₹120 equally across 10 packets.", "₹120-ஐ 10 பாக்கெட்டுகளுக்குச் சமமாகப் பகிருங்கள்."),
            L("What is 120 divided by 10?", "120-ஐ 10-ஆல் வகுத்தால் என்ன?"),
          ],
          modelAnswer: L(
            "₹12 per packet, because ₹120 ÷ 10 = ₹12.",
            "ஒரு பாக்கெட்டுக்கு ₹12, ஏனென்றால் ₹120 ÷ 10 = ₹12.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "unit-cost-12",
                kind: "numeric",
                description: L("Cost per packet is ₹12", "ஒரு பாக்கெட்டின் செலவு ₹12"),
                expected: 12,
                tolerance: 0,
                commonMistakes: [
                  {
                    value: 120,
                    explanation: L(
                      "₹120 is the cost for all 10 packets together. Divide it by the number of packets.",
                      "₹120 என்பது 10 பாக்கெட்டுகளுக்கும் சேர்ந்த செலவு. அதை பாக்கெட்டுகளின் எண்ணிக்கையால் வகுங்கள்.",
                    ),
                  },
                  {
                    value: 1200,
                    explanation: L(
                      "It looks like 120 was multiplied by 10. To share a cost across packets, divide instead.",
                      "120-ஐ 10-ஆல் பெருக்கியது போலத் தெரிகிறது. செலவைப் பாக்கெட்டுகளுக்குப் பகிர, வகுக்க வேண்டும்.",
                    ),
                  },
                  {
                    value: 110,
                    explanation: L(
                      "It looks like 10 was taken away from 120. To find the cost of one packet, divide 120 by 10.",
                      "120-லிருந்து 10-ஐக் கழித்தது போலத் தெரிகிறது. ஒரு பாக்கெட்டின் செலவுக்கு, 120-ஐ 10-ஆல் வகுங்கள்.",
                    ),
                  },
                ],
              },
            ],
            requiredForCorrect: ["unit-cost-12"],
            feedback: {
              correct: L(
                "Correct: ₹120 ÷ 10 = ₹12 per packet. Remember this is only the ingredient cost — covers and gas would add to it.",
                "சரி, ஒரு packet-க்கு ingredients செலவு பன்னிரண்டு ரூபாய். Cover, gas, உங்க நேரம் இதுல சேர்க்கலைன்னு நினைவில் வச்சுக்கோங்க.",
              ),
              partial: L("Nearly. Check the division once more.", "கணக்கை இன்னொரு தடவை பாத்துக்கலாம்."),
              needs_practice: L(
                "Not quite. To find the cost of one packet, divide the total cost by the number of packets.",
                "மொத்தச் செலவை ஒரு packet செலவா எடுத்துக்க வேண்டாம். பத்து packet-க்கும் சமமா பிரிச்சுப் பாருங்க.",
              ),
              ungraded: NUMBER_NOT_HEARD,
            },
          },
        },
        {
          id: "sbs-02-price-covers-costs",
          conceptId: "sbs-cost-vs-price",
          kind: "explain",
          prompt: L(
            "A packet’s ingredients cost twelve rupees. Why should Meena not choose a selling price based only on those twelve rupees?",
            "ஒரு packet-க்கு ingredients செலவு பன்னிரண்டு ரூபாய். அதைப் பாத்துட்டு பன்னிரண்டு ரூபாய்க்கே விக்கலாம்னு மீனா முடிவு பண்ணினா என்ன செலவு விடுபடும்?",
          ),
          hints: [
            L("What other things did Meena spend money or time on?", "மீனா வேறு எதற்கெல்லாம் பணமோ நேரமோ செலவிட்டார்?"),
          ],
          modelAnswer: L(
            "Because ₹12 only covers ingredients. Covers, gas, travel and her time also cost something, so at ₹12 she would make a loss. She should also find out what customers nearby pay.",
            "ஏனென்றால் ₹12 மூலப்பொருட்களை மட்டுமே ஈடுகட்டும். கவர், எரிவாயு, போக்குவரத்து, அவருடைய நேரம் — இவற்றுக்கும் செலவு உண்டு; அதனால் ₹12-க்கு விற்றால் நஷ்டம் ஆகும். அருகிலுள்ள வாடிக்கையாளர்கள் எவ்வளவு கொடுக்கிறார்கள் என்றும் அவர் தெரிந்துகொள்ள வேண்டும்.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "other-costs",
                kind: "terms",
                description: L(
                  "Mentions other costs such as covers, gas, travel or time",
                  "கவர், எரிவாயு, போக்குவரத்து, நேரம் போன்ற மற்ற செலவுகளைச் சொல்கிறது",
                ),
                terms: terms(
                  [
                    "cover",
                    "gas",
                    "travel",
                    "transport",
                    "time",
                    "labour",
                    "labor",
                    "effort",
                    "packet",
                    "bus",
                    "electric",
                    "other cost",
                  ],
                  [
                    "கேசு",
                    "காசு",
                    "கவர்",
                    "எரிவாயு",
                    "கேஸ்",
                    "போக்குவரத்து",
                    "நேர",
                    "உழைப்பு",
                    "பஸ்",
                    "மின்சார",
                    "பாக்கெட்",
                    "மற்ற செலவு",
                  ],
                ),
              },
              {
                id: "no-profit",
                kind: "terms",
                description: L(
                  "Explains that nothing would be left, or there would be a loss",
                  "எதுவும் மீதம் இருக்காது அல்லது நஷ்டம் ஆகும் என்று விளக்குகிறது",
                ),
                terms: terms(
                  ["profit", "loss", "nothing left", "no money", "earn", "left over", "lose"],
                  ["லாப", "நஷ்ட", "மீதம்", "வருமான", "இழப்பு"],
                ),
              },
            ],
            requiredForCorrect: ["other-costs"],
            feedback: {
              correct: L(
                "Right: the price has to cover more than ingredients — covers, gas, travel and her time all count.",
                "ஆமாம், ingredients தவிர மற்ற செலவுகளையும் கணக்கில் எடுக்கணும்னு கண்டுபிடிச்சீங்க.",
              ),
              partial: L(
                "You're right that she would not make money. Can you name the other costs that ₹12 leaves out?",
                "சில விஷயங்களைச் சொன்னீங்க. Cover, gas, உங்க நேரம் மாதிரி இன்னும் என்ன செலவிருக்குன்னு பாருங்க.",
              ),
              needs_practice: L(
                "Think about everything Meena spends, not just the ingredients: the covers, the gas, travel and her time.",
                "Ingredients பணம் மட்டும் திரும்ப வந்தா போதாது. Cover-க்கும் gas-க்கும் நீங்க கொடுத்த பணமும் செலவுதான்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Next time you make a batch of anything, write down every cost and how many pieces it makes. Then work out the cost of one piece.",
        "அடுத்த முறை எதையாவது ஒரு தொகுப்பாகச் செய்யும்போது, ஒவ்வொரு செலவையும், அது எத்தனை துண்டுகள் தருகிறது என்பதையும் எழுதுங்கள். பிறகு ஒரு துண்டின் செலவைக் கணக்கிடுங்கள்.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "sbs-03",
      sequence: 3,
      title: L("Talking about your product", "உங்கள் பொருளைப் பற்றிப் பேசுவது"),
      objective: L(
        "Introduce what you offer clearly, ask a customer what they need, and answer a common question honestly.",
        "நீங்கள் வழங்குவதைத் தெளிவாக அறிமுகப்படுத்தவும், வாடிக்கையாளருக்கு என்ன தேவை என்று கேட்கவும், ஒரு பொதுவான கேள்விக்கு நேர்மையாகப் பதில் சொல்லவும்.",
      ),
      estimatedMinutes: 8,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "sbs-introduce-offer",
          title: L("Introducing your offer", "நீங்கள் வழங்குவதை அறிமுகப்படுத்துவது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "A short introduction needs what you sell, one honest benefit, and how someone can get it. Two or three sentences are enough; you do not need a memorised speech.",
                "Customer-கிட்ட பெரிய speech தேவையில்லை. என்ன விக்கிறீங்க, அதுல என்ன நல்ல விஷயம் இருக்கு, எப்படி வாங்கலாம் — இதை ரெண்டு வரியில சொன்னா போதும்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "For example: I make fresh murukku at home on Saturdays. I pack it the same day. You can order by Friday evening. Only make claims that are true for your product.",
                "உதாரணமா, சனிக்கிழமை வீட்டுல முறுக்கு செய்றேன்; அன்னிக்கே pack பண்ணிடுவேன்; வெள்ளிக்கிழமை சாயங்காலத்துக்குள்ள order சொல்லுங்கன்னு பேசலாம். உங்க பொருளுக்கு உண்மையான விஷயத்தை மட்டும் சொல்லணும்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "Start with what you make. Add one real benefit. Finish with when or how to order, in words you would normally use.",
                "நான் என்ன செய்றேன்னு முதல்ல சொல்லுங்க. அதுல ஒரு நல்ல விஷயத்தைச் சேருங்க. கடைசியில எப்படி order பண்ணலாம்னு சொல்லுங்க — நீங்க வழக்கமா பேசுற மாதிரியே போதும்.",
              ),
            },
          ],
          keyPoints: [
            L("What it is, why it's useful, how to get it.", "அது என்ன, ஏன் பயனுள்ளது, எப்படிப் பெறுவது."),
            L("Only say things that are true.", "உண்மையானதை மட்டுமே சொல்லுங்கள்."),
          ],
          checkQuestion: L(
            "How would you begin introducing your product?",
            "உங்கள் பொருளை அறிமுகப்படுத்த எப்படித் தொடங்குவீர்கள்?",
          ),
        },
        {
          id: "sbs-ask-need",
          title: L("Asking what the customer needs", "வாடிக்கையாளரின் தேவையைக் கேட்பது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Before suggesting a product, ask one question about the customer’s need. It could be how many people it is for or when they need it. Listen to the answer before recommending anything.",
                "எந்த packet கொடுக்கலாம்னு சொல்றதுக்கு முன்னாடி, ஒரு கேள்வி கேளுங்க. எத்தனை பேருக்கு வேணும், இல்ல எப்போ வேணும்னு கேட்கலாம். பதிலைக் கேட்டுட்டுத்தான் சொல்லணும்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "A tailor measures before cutting cloth. Asking what the customer needs is the same idea: find the fit before offering a solution.",
                "தையல் பண்ணும்போது அளவு எடுத்துட்டுத்தானே துணி வெட்டுவோம்? அதே மாதிரி, அவங்களுக்கு என்ன வேணும்னு கேட்டுட்டு நம்ம பொருளைச் சொல்லலாம்.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Choose one useful thing to find out: who it is for, how much they need, or when they need it. Ask just that first.",
                "யாருக்கு, எவ்வளவு, எப்போ — இதுல முதல்ல என்ன தெரிஞ்சுக்கணும்னு ஒரு கேள்வியைத் தேர்ந்தெடுங்க. ஒரே நேரத்துல எல்லாத்தையும் கேட்க வேண்டாம்.",
              ),
            },
          ],
          keyPoints: [
            L("Ask one question at a time.", "ஒரு நேரத்தில் ஒரு கேள்வி கேளுங்கள்."),
            L("Listen to the answer before suggesting anything.", "எதையும் பரிந்துரைப்பதற்கு முன் பதிலைக் கேளுங்கள்."),
          ],
          checkQuestion: L(
            "What is one question you could ask a customer before suggesting something?",
            "எதையாவது பரிந்துரைப்பதற்கு முன் ஒரு வாடிக்கையாளரிடம் கேட்கக்கூடிய ஒரு கேள்வி என்ன?",
          ),
        },
        {
          id: "sbs-answer-question",
          title: L("Answering a question honestly", "கேள்விக்கு நேர்மையாகப் பதில் சொல்வது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Be clear about what you can and cannot do. If you do not know a shelf-life or delivery answer, say you will check. Do not promise a delivery or food-storage claim you cannot support.",
                "உங்களால என்ன செய்ய முடியுமோ அதைத் தெளிவா சொல்லுங்க. தினமும் delivery முடியலனா முடியாதுன்னு சொல்லலாம். எவ்வளவு நாள் நல்லா இருக்கும்னு தெரியலனா, சரிபாத்துட்டுச் சொல்றேன்னு சொல்லணும்; ஊகமா சொல்லக்கூடாது.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "If a customer asks whether your murukku stays good for a month and you have not checked that, do not say yes. Say you will check rather than inventing a shelf-life.",
                "இந்த முறுக்கு ஒரு மாசம் நல்லா இருக்குமான்னு கேட்டா, நாம சரிபாக்காம ஆமாம்னு சொல்லக்கூடாது. அதை உறுதியா தெரிஞ்சுக்கிட்டுச் சொல்றேன்னு சொல்லலாம். நேர்மையா பேசுறதுதான் நம்பிக்கையை வளர்க்கும்.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Ask yourself whether you can keep the promise. If not, state the limit and offer an option you can actually provide.",
                "இந்த வாக்குறுதியைக் காப்பாத்த முடியுமான்னு முதல்ல யோசிங்க. முடியலனா, என்ன செய்ய முடியும்னு ஒரு வழியைச் சொல்லுங்க. இல்லாத வசதியை இருக்குன்னு சொல்ல வேண்டாம்.",
              ),
            },
          ],
          keyPoints: [
            L("Answer with what is true.", "உண்மையானதைச் சொல்லுங்கள்."),
            L(
              "If you don't know, say you will check.",
              "தெரியவில்லை என்றால், பார்த்துச் சொல்கிறேன் என்று சொல்லுங்கள்.",
            ),
          ],
          checkQuestion: L(
            "What would you say if a customer asked something you weren't sure about?",
            "உங்களுக்கு உறுதியாகத் தெரியாத ஒன்றை வாடிக்கையாளர் கேட்டால் என்ன சொல்வீர்கள்?",
          ),
        },
      ],
      practice: [
        {
          id: "sbs-03-introduce",
          conceptId: "sbs-introduce-offer",
          kind: "role_play",
          prompt: L(
            "I’m your neighbour asking what you sell. Introduce your product, or the murukku example, in two or three sentences.",
            "நான் உங்க பக்கத்து வீட்டு customer-ன்னு வைங்க. என்ன விக்கிறீங்கன்னு கேட்கிறேன். உங்க பொருளையோ, முறுக்கு example-ஐயோ ரெண்டு மூணு வரியில சொல்லிப் பாருங்க.",
          ),
          hints: [
            L(
              "Say what it is, why it's useful, and how to get it.",
              "அது என்ன, ஏன் பயனுள்ளது, எப்படிப் பெறுவது என்று சொல்லுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "I make fresh murukku at home every Saturday. I use clean oil and pack it the same day. You can order a packet from me by Friday evening.",
            "ஒவ்வொரு சனிக்கிழமையும் வீட்டில் புதிய முறுக்கு செய்கிறேன். சுத்தமான எண்ணெய் பயன்படுத்தி, அன்றே பாக்கெட் செய்கிறேன். வெள்ளிக்கிழமை மாலைக்குள் என்னிடம் ஒரு பாக்கெட் ஆர்டர் செய்யலாம்.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "says-what",
                kind: "terms",
                description: L("Says what is offered", "என்ன வழங்கப்படுகிறது என்று சொல்கிறது"),
                terms: WHAT_IS_OFFERED,
              },
              {
                id: "why-useful",
                kind: "terms",
                description: L(
                  "Gives one honest reason it is useful",
                  "அது பயனுள்ளது என்பதற்கு ஒரு நேர்மையான காரணம் சொல்கிறது",
                ),
                terms: terms(
                  [
                    "fresh",
                    "homemade",
                    "home made",
                    "clean",
                    "tasty",
                    "quality",
                    "save",
                    "quick",
                    "pure",
                    "healthy",
                    "good",
                  ],
                  [
                    "புது",
                    "ஃப்ரெஷ்",
                    "வீட்டுல",
                    "புதி",
                    "வீட்டில்",
                    "சுத்த",
                    "சுவை",
                    "தரம்",
                    "மிச்ச",
                    "ஆரோக்கிய",
                    "நல்ல",
                  ],
                ),
              },
              {
                id: "how-to-get",
                kind: "terms",
                description: L("Says how or when to get it", "அதை எப்படி அல்லது எப்போது பெறலாம் என்று சொல்கிறது"),
                terms: terms(
                  [
                    "order",
                    "call",
                    "deliver",
                    "every",
                    "available",
                    "saturday",
                    "sunday",
                    "monday",
                    "evening",
                    "morning",
                    "come",
                    "pick",
                    "get",
                  ],
                  [
                    "ஆடர்",
                    "சொல்லுங்க",
                    "வாங்கிக்க",
                    "ஆர்டர்",
                    "அழை",
                    "கொண்டு வந்து",
                    "ஒவ்வொரு",
                    "கிடைக்கும்",
                    "கிழமை",
                    "மாலை",
                    "காலை",
                    "வந்து",
                    "வாங்க",
                  ],
                ),
              },
            ],
            requiredForCorrect: ["says-what", "why-useful"],
            feedback: {
              correct: L(
                "That's a clear introduction: the customer knows what it is and why it's worth trying.",
                "என்ன விக்கிறீங்கன்னும் அதுல என்ன பயனுன்னும் தெளிவா சொன்னீங்க.",
              ),
              partial: L(
                "Good start. Add one honest reason it is useful, so the customer knows why it's worth trying.",
                "ஒரு நல்ல பகுதி இருக்கு. பொருள் என்ன, அதுல என்ன நல்ல விஷயம், எப்படி வாங்கலாம்னு சேர்த்துப் பாருங்க.",
              ),
              needs_practice: L(
                "Try the three steps: 'I make…', one reason it's useful, and how to get it.",
                "மனப்பாடம் தேவையில்லை. நான் என்ன செய்றேன்னு உங்க வழக்கமான பேச்சுல தொடங்குங்க.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "sbs-03-ask-question",
          conceptId: "sbs-ask-need",
          kind: "role_play",
          prompt: L(
            "I’m a customer saying: I need some snacks. What one question would you ask before suggesting a packet?",
            "நான் customer-ஆ பேசுறேன்: எனக்குக் கொஞ்சம் snacks வேணும். எந்த packet கொடுக்கலாம்னு சொல்றதுக்கு முன்னாடி என்ன ஒரு கேள்வி கேட்பீங்க?",
          ),
          hints: [L("Who is it for, how many, or when?", "யாருக்கு, எத்தனை, அல்லது எப்போது?")],
          modelAnswer: L("Is it for your family or for guests?", "இது குடும்பத்துக்கா, விருந்தினர்களுக்கா?"),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "asks-question",
                kind: "terms",
                description: L(
                  "Asks the customer a question about their need",
                  "வாடிக்கையாளரின் தேவை பற்றி ஒரு கேள்வி கேட்கிறது",
                ),
                terms: terms(
                  ["what", "which", "how many", "how much", "when", "who", "do you", "would you", "is it", "for whom"],
                  [
                    "எப்போ",
                    "எத்தன",
                    "யாருக்க",
                    "வேணுமா",
                    "என்ன",
                    "எந்த",
                    "எத்தனை",
                    "எவ்வளவு",
                    "எப்போது",
                    "யாருக்கு",
                    "வேண்டுமா",
                    "பிடிக்குமா",
                    "ா?",
                  ],
                ),
              },
            ],
            requiredForCorrect: ["asks-question"],
            feedback: {
              correct: L(
                "Good question. Now you would listen to the answer before suggesting anything.",
                "பொருத்தமான ஒரு கேள்வி கேட்டீங்க. பதிலைக் கேட்ட பிறகு packet-ஐ பரிந்துரைக்கலாம்.",
              ),
              partial: L(
                "Nearly. Turn it into one clear question for the customer.",
                "Customer-க்கு என்ன தேவைன்னு தெரிஞ்சுக்க ஒரு கேள்வியா கேட்டுப் பாருங்க.",
              ),
              needs_practice: L(
                "That sounds like a suggestion rather than a question. Try asking who it is for, or how many people.",
                "முதல்ல விக்க முயற்சி செய்ய வேண்டாம். எத்தனை பேருக்கு, இல்ல எப்போ வேணும்னு ஒரு கேள்வி கேட்கலாம்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "sbs-03-honest-answer",
          conceptId: "sbs-answer-question",
          kind: "role_play",
          prompt: L(
            "A customer asks for daily home delivery. You can deliver only on Saturdays near your street. How would you answer honestly?",
            "Customer கேட்கிறாங்க: தினமும் வீட்டுக்குக் கொண்டு வந்து தர முடியுமா? உங்களால சனிக்கிழமை மட்டும், உங்க தெரு பக்கத்துலதான் தர முடியும். நேர்மையா என்ன பதில் சொல்வீங்க?",
          ),
          hints: [
            L(
              "Say what you can do, and offer another way if you can.",
              "உங்களால் முடிவதைச் சொல்லுங்கள், முடிந்தால் வேறொரு வழியையும் சொல்லுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "I can't deliver every day. I deliver on Saturdays near my street, or you can order and pick it up from me.",
            "தினமும் கொண்டு வந்து தர முடியாது. சனிக்கிழமைகளில் என் தெருவுக்கு அருகில் கொண்டு வந்து தருவேன், அல்லது ஆர்டர் செய்துவிட்டு என்னிடம் வந்து வாங்கிக்கொள்ளலாம்.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "honest-limit",
                kind: "terms",
                acceptsNegation: true,
                description: L(
                  "States the real limit honestly (Saturdays only)",
                  "உண்மையான வரம்பை நேர்மையாகச் சொல்கிறது (சனிக்கிழமை மட்டும்)",
                ),
                terms: terms(
                  [
                    "saturday",
                    "only saturday",
                    "saturday only",
                    "saturdays only",
                    "not every day",
                    "cannot deliver every day",
                    "cant deliver every day",
                    "can not deliver every day",
                    "once a week",
                    "weekly",
                  ],
                  [
                    "சனிக்கிழமை",
                    "சனிக்கிழமை மட்டும்",
                    "சனிக்கிழமைகளில்",
                    "சனி மட்டும்",
                    "தினமும் முடியாது",
                    "தினமும் இல்லை",
                    "வாரம் ஒரு",
                  ],
                ),
              },
              {
                id: "offers-alternative",
                kind: "terms",
                description: L("Offers another way to get it", "அதைப் பெற வேறொரு வழியைச் சொல்கிறது"),
                terms: terms(
                  ["pick", "collect", "come", "order", "nearby", "instead", "another"],
                  ["வந்து", "வாங்கி", "ஆர்டர்", "அருகில்", "பதிலாக"],
                ),
              },
            ],
            requiredForCorrect: ["honest-limit"],
            feedback: {
              correct: L(
                "Honest and clear. Saying what you can really do keeps the customer's trust.",
                "செய்ய முடியாததை வாக்குறுதி கொடுக்காம உங்க வரம்பைச் சொன்னீங்க.",
              ),
              partial: L(
                "Offering another way is helpful. Also say clearly that you can't deliver every day.",
                "எப்போ, எங்க தர முடியும்னு இன்னும் தெளிவா சொல்லலாம்.",
              ),
              needs_practice: L(
                "Be careful not to promise daily delivery. Say what you can really do: Saturdays, near your street.",
                "தினமும் முடியாதுன்னா நேர்மையா சொல்லலாம். சனிக்கிழமை மட்டும் தர முடியும்னு ஒரு வழியையும் சொல்லுங்க.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Practise your two- or three-sentence introduction aloud with a family member or friend, and ask them one question about what they would need.",
        "உங்கள் இரண்டு மூன்று வாக்கிய அறிமுகத்தை ஒரு குடும்ப உறுப்பினரிடமோ நண்பரிடமோ சத்தமாகச் சொல்லிப் பழகுங்கள்; அவர்களுக்கு என்ன தேவை என்று ஒரு கேள்வியும் கேளுங்கள்.",
      ),
    },
  ],
};
