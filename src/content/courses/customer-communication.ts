import type { z } from "zod";
import type { courseSchema } from "../schema";
import { L, OPEN_UNGRADED, TEAM_AUTHORED_NOTE, terms } from "../helpers";

/**
 * Course 3 — Customer Communication (Tamil-first).
 * Team-authored. Not mentor-reviewed. See contentReview and reviewFlags.
 * Builds on sbs-03 (Small Business Starter) with new scenarios: specific and
 * honest descriptions, open/closed questions, reflecting back, and handling
 * price concerns and "I'll think about it" without pressure.
 */

export const customerCommunication: z.input<typeof courseSchema> = {
  id: "customer-communication",
  sortOrder: 3,
  title: L("Customer Communication", "வாடிக்கையாளருடன் பேசுவது"),
  summary: L(
    "Introduce what you offer clearly and honestly, ask good questions and listen, and respond calmly to questions, doubts and 'it's too expensive'.",
    "நீங்கள் வழங்குவதைத் தெளிவாகவும் நேர்மையாகவும் அறிமுகப்படுத்தவும், நல்ல கேள்விகள் கேட்டுக் கவனமாகக் கேட்கவும், கேள்விகள், தயக்கங்கள், 'விலை அதிகம்' போன்றவற்றுக்கு அமைதியாகப் பதில் சொல்லவும் கற்றுக்கொள்ளுங்கள்.",
  ),
  description: L(
    "A short, practical course for anyone who talks to customers, or would like to feel more confident doing it. It goes further than the basics of introducing a product: specific and honest descriptions, open and closed questions, checking that you understood, and handling price concerns without pressure. You will practise with short, everyday conversations. The course is educational and does not promise more sales.",
    "வாடிக்கையாளர்களிடம் பேசுபவர்களுக்கும், இன்னும் தன்னம்பிக்கையுடன் பேச விரும்புபவர்களுக்கும் ஒரு குறுகிய, நடைமுறைப் பாடநெறி. ஒரு பொருளை அறிமுகப்படுத்தும் அடிப்படையைவிட இன்னும் ஆழமாகப் போகிறது: குறிப்பான, நேர்மையான விவரிப்பு, திறந்த கேள்விகளும் மூடிய கேள்விகளும், புரிந்துகொண்டதைச் சரிபார்ப்பது, அழுத்தம் கொடுக்காமல் விலை பற்றிய கவலைகளுக்குப் பதில் சொல்வது. சிறிய, அன்றாட உரையாடல்களோடு பயிற்சி செய்வீர்கள். இது கற்றலுக்கானது மட்டுமே; அதிக விற்பனையை உறுதியளிக்காது.",
  ),
  audience: L(
    "Anyone who sells a product or service, or plans to, and wants to talk with customers more clearly and calmly. No previous experience is needed.",
    "ஒரு பொருளையோ சேவையையோ விற்பவர்கள் அல்லது விற்கத் திட்டமிடுபவர்கள், வாடிக்கையாளர்களுடன் இன்னும் தெளிவாகவும் அமைதியாகவும் பேச விரும்புபவர்கள். முன் அனுபவம் தேவையில்லை.",
  ),
  outcomes: [
    L(
      "Introduce a product or service clearly, with specific and honest details.",
      "ஒரு பொருளையோ சேவையையோ குறிப்பான, நேர்மையான விவரங்களுடன் தெளிவாக அறிமுகப்படுத்துவது.",
    ),
    L(
      "Ask what a customer needs, and check you understood, before recommending something.",
      "எதையாவது பரிந்துரைப்பதற்கு முன், வாடிக்கையாளருக்கு என்ன தேவை என்று கேட்டு, புரிந்துகொண்டதைச் சரிபார்ப்பது.",
    ),
    L(
      "Respond politely to common questions and concerns, and practise a short conversation.",
      "பொதுவான கேள்விகளுக்கும் கவலைகளுக்கும் மரியாதையாகப் பதில் சொல்வது; ஒரு சிறிய உரையாடலைப் பழகுவது.",
    ),
  ],
  languages: ["ta-IN", "en-IN"],
  primaryLanguage: "ta-IN",
  level: "beginner",
  status: "published",
  contentReview: { status: "team_authored", note: TEAM_AUTHORED_NOTE },
  estimatedMinutes: 45,
  recommendationTerms: terms(
    ["talk", "speak", "communicat", "customer", "conversation", "sell", "confiden", "convinc", "explain", "polite", "listen", "question", "objection", "negotiat", "shy", "nervous"],
    ["பேச", "வாடிக்கையாளர்", "தொடர்பு", "உரையாட", "விற்க", "விற்ப", "தன்னம்பிக்கை", "விளக்க", "மரியாதை", "கேள்வி", "கவனித்து", "தயக்க", "கூச்ச", "பயம்"],
  ),
  lessons: [
    // ---------------------------------------------------------------------
    {
      id: "cc-01",
      sequence: 1,
      title: L("A clear and honest introduction", "தெளிவான, நேர்மையான அறிமுகம்"),
      objective: L(
        "Replace vague words with specific facts, and leave out claims you cannot back up.",
        "பொதுவான வார்த்தைகளுக்குப் பதிலாகக் குறிப்பான உண்மைகளைச் சொல்வது; நிரூபிக்க முடியாத கூற்றுகளைத் தவிர்ப்பது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "cc-specific-intro",
          title: L("Specific, not vague", "பொதுவாக அல்ல, குறிப்பாக"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Words like 'good quality' or 'very nice' are easy to say, but a customer can't picture them. Specific details help more: what exactly you offer, for whom, when, and what it costs or includes. A specific detail is also something the customer can check, and that builds trust.",
                "'நல்ல தரம்', 'மிகவும் நன்றாக இருக்கும்' போன்ற வார்த்தைகளைச் சொல்வது எளிது, ஆனால் வாடிக்கையாளரால் அவற்றை மனதில் பார்க்க முடியாது. குறிப்பான விவரங்கள் அதிகம் உதவும்: நீங்கள் சரியாக என்ன வழங்குகிறீர்கள், யாருக்கு, எப்போது, விலை என்ன அல்லது அதில் என்ன அடங்கும். குறிப்பான விவரத்தை வாடிக்கையாளர் சரிபார்க்கவும் முடியும்; அது நம்பிக்கையை வளர்க்கும்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "Compare two ways of describing tuition. 'I teach maths well.' Or: 'I teach maths to classes 6 to 8, Monday to Friday, 5 to 6 in the evening, in groups of five, at my home.' The second one answers a parent's questions before they ask.",
                "டியூஷனை விவரிக்கும் இரண்டு வழிகளை ஒப்பிட்டுப் பாருங்கள். 'நான் கணக்கு நன்றாகச் சொல்லித் தருவேன்.' அல்லது: '6 முதல் 8-ஆம் வகுப்பு வரை, திங்கள் முதல் வெள்ளி வரை, மாலை 5 முதல் 6 மணி வரை, ஐந்து பேர் கொண்ட குழுவாக, என் வீட்டில் கணக்கு சொல்லித் தருகிறேன்.' இரண்டாவது, பெற்றோர் கேட்பதற்கு முன்பே அவர்களின் கேள்விகளுக்குப் பதில் சொல்கிறது.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "First, say your introduction the way you usually would. Second, find any vague word — 'good', 'nice', 'best', 'quality'. Third, replace each one with a fact: a time, a number, a price, or what is included. Finally, say it again. It will usually be just as short, and much clearer.",
                "முதலில், வழக்கமாகச் சொல்வது போலவே உங்கள் அறிமுகத்தைச் சொல்லுங்கள். இரண்டாவது, அதில் உள்ள பொதுவான வார்த்தைகளைக் கண்டுபிடியுங்கள் — 'நல்ல', 'அருமையான', 'சிறந்த', 'தரமான'. மூன்றாவது, ஒவ்வொன்றுக்கும் பதிலாக ஒரு உண்மையைச் சொல்லுங்கள்: ஒரு நேரம், ஒரு எண், ஒரு விலை, அல்லது அதில் என்ன அடங்கும். கடைசியாக, மீண்டும் சொல்லிப் பாருங்கள். பெரும்பாலும் அதே அளவு சுருக்கமாக இருக்கும், ஆனால் இன்னும் தெளிவாக இருக்கும்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Swap vague words for specific facts: a time, a number, a price, what's included.",
              "பொதுவான வார்த்தைகளுக்குப் பதிலாகக் குறிப்பான உண்மைகள்: நேரம், எண், விலை, என்ன அடங்கும்.",
            ),
            L(
              "Specific details are easier for a customer to picture and to trust.",
              "குறிப்பான விவரங்களை வாடிக்கையாளர் எளிதாக மனதில் பார்க்கவும் நம்பவும் முடியும்.",
            ),
          ],
          checkQuestion: L(
            "What is one vague word you might use, and what fact could replace it?",
            "நீங்கள் பயன்படுத்தக்கூடிய ஒரு பொதுவான வார்த்தை என்ன, அதற்குப் பதிலாக என்ன உண்மையைச் சொல்லலாம்?",
          ),
        },
        {
          id: "cc-honest-claims",
          title: L("Only claims you can back up", "நிரூபிக்கக்கூடியதை மட்டும் சொல்லுங்கள்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Some claims sound strong but can't be true, or can't be checked: 'the best in the city', 'it cures illness', 'results guaranteed'. Avoid them. Health claims especially can mislead someone or cause harm. Say what you know is true — what goes into it, how you make it, how you work.",
                "சில கூற்றுகள் வலுவாகத் தோன்றும், ஆனால் உண்மையாக இருக்க முடியாது அல்லது சரிபார்க்க முடியாது: 'நகரத்திலேயே சிறந்தது', 'நோயைக் குணப்படுத்தும்', 'பலன் உறுதி'. இவற்றைத் தவிருங்கள். குறிப்பாக உடல்நலம் பற்றிய கூற்றுகள் ஒருவரைத் தவறாக வழிநடத்தலாம் அல்லது பாதிக்கலாம். உண்மை என்று உங்களுக்குத் தெரிந்ததைச் சொல்லுங்கள் — அதில் என்ன சேர்க்கிறீர்கள், எப்படிச் செய்கிறீர்கள், எப்படி வேலை செய்கிறீர்கள்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "A customer's trust is like a clean white cloth. One false claim leaves a stain that is hard to wash out, even if everything else you said was true.",
                "வாடிக்கையாளரின் நம்பிக்கை ஒரு சுத்தமான வெள்ளைத் துணி போன்றது. நீங்கள் சொன்ன மற்ற எல்லாம் உண்மையாக இருந்தாலும், ஒரு பொய்யான கூற்று அதில் எளிதில் போகாத கறையை விட்டுச்செல்லும்.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Before you make a claim, ask yourself two questions. Can I show this is true? Would I be comfortable if the customer checked? For a home beauty service, 'all your pimples will disappear in a week' fails both. 'I use a fresh towel and clean tools for every customer' passes both.",
                "ஒரு கூற்றைச் சொல்வதற்கு முன், உங்களையே இரண்டு கேள்விகள் கேளுங்கள். இது உண்மை என்று என்னால் காட்ட முடியுமா? வாடிக்கையாளர் சரிபார்த்தால் எனக்குத் தயக்கம் இல்லாமல் இருக்குமா? வீட்டில் செய்யும் அழகு சேவைக்கு, 'ஒரே வாரத்தில் எல்லாப் பருக்களும் போய்விடும்' என்பது இரண்டிலும் தோற்றுவிடும். 'ஒவ்வொரு வாடிக்கையாளருக்கும் புதிய துண்டும் சுத்தமான கருவிகளும் பயன்படுத்துகிறேன்' என்பது இரண்டிலும் சரியாக இருக்கும்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Avoid claims like 'best in the city', 'cures illness' or 'guaranteed'.",
              "'நகரத்திலேயே சிறந்தது', 'நோயைக் குணப்படுத்தும்', 'உறுதி' போன்ற கூற்றுகளைத் தவிருங்கள்.",
            ),
            L(
              "Say what you can show: ingredients, method, how you work.",
              "உங்களால் காட்டக்கூடியதைச் சொல்லுங்கள்: பொருட்கள், செய்முறை, நீங்கள் வேலை செய்யும் விதம்.",
            ),
          ],
          checkQuestion: L(
            "What two questions can you ask yourself before making a claim?",
            "ஒரு கூற்றைச் சொல்வதற்கு முன் உங்களையே என்ன இரண்டு கேள்விகள் கேட்கலாம்?",
          ),
        },
      ],
      practice: [
        {
          id: "cc-01-specific-intro",
          conceptId: "cc-specific-intro",
          kind: "role_play",
          prompt: L(
            "Anitha does clothing alterations at home. Most jobs are ready in two days, and shortening a pair of trousers costs ₹50. A new customer asks what she does. Introduce Anitha's service in two or three sentences, using specific details instead of vague words.",
            "அனிதா வீட்டிலேயே துணிகளை ஆல்டர் செய்து தருகிறார். பெரும்பாலான வேலைகள் இரண்டு நாளில் தயாராகிவிடும்; ஒரு பேண்ட்டின் நீளத்தைக் குறைக்க ₹50. ஒரு புதிய வாடிக்கையாளர் அவர் என்ன செய்கிறார் என்று கேட்கிறார். பொதுவான வார்த்தைகளுக்குப் பதிலாகக் குறிப்பான விவரங்களைப் பயன்படுத்தி, அனிதாவின் சேவையை இரண்டு மூன்று வாக்கியங்களில் அறிமுகப்படுத்துங்கள்.",
          ),
          hints: [
            L("Use at least one fact: the two days, or the ₹50 price.", "குறைந்தது ஒரு உண்மையைப் பயன்படுத்துங்கள்: இரண்டு நாள், அல்லது ₹50 விலை."),
          ],
          modelAnswer: L(
            "I do clothing alterations at home — shortening, loosening or fitting your clothes. Most jobs are ready in two days, and shortening a pair of trousers is ₹50.",
            "நான் வீட்டிலேயே துணிகளை ஆல்டர் செய்து தருகிறேன் — நீளம் குறைப்பது, தளர்த்துவது, அளவுக்குச் சரி செய்வது. பெரும்பாலான வேலைகள் இரண்டு நாளில் தயாராகிவிடும்; ஒரு பேண்ட்டின் நீளத்தைக் குறைக்க ₹50.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "says-service",
                kind: "terms",
                description: L("Says what the service is (alterations)", "சேவை என்ன என்று சொல்கிறது (ஆல்டரேஷன்)"),
                terms: terms(
                  ["alter", "stitch", "tailor", "shorten", "fit", "loosen", "tighten", "hem", "clothes"],
                  ["ஆல்டர்", "தைக்க", "தையல்", "நீளம்", "அளவு", "தளர்த்", "துணி"],
                ),
              },
              {
                id: "specific-detail",
                kind: "terms",
                description: L("Includes a specific fact (two days or ₹50)", "ஒரு குறிப்பான உண்மையைச் சேர்க்கிறது (இரண்டு நாள் அல்லது ₹50)"),
                terms: terms(
                  ["two days", "2 days", "50", "fifty", "rupee", "days", "ready"],
                  ["இரண்டு நாள்", "2 நாள்", "50", "ஐம்பது", "ரூபாய்", "நாளில்", "தயார்"],
                ),
              },
            ],
            requiredForCorrect: ["says-service", "specific-detail"],
            feedback: {
              correct: L(
                "Clear and specific: the customer knows what Anitha does and has a real fact to go on.",
                "தெளிவாகவும் குறிப்பாகவும் இருக்கிறது: அனிதா என்ன செய்கிறார் என்று வாடிக்கையாளருக்குத் தெரிகிறது; நம்புவதற்கு ஒரு உண்மையான தகவலும் இருக்கிறது.",
              ),
              partial: L(
                "Good start. Add the missing piece — say what she does, and include one fact, like the two days or the ₹50 price.",
                "நல்ல தொடக்கம். விடுபட்டதைச் சேருங்கள் — அவர் என்ன செய்கிறார் என்று சொல்லி, இரண்டு நாள் அல்லது ₹50 விலை போன்ற ஒரு உண்மையையும் சேருங்கள்.",
              ),
              needs_practice: L(
                "Let's try again. Start with 'I do alterations at home…', then add one fact: how long it takes, or what it costs.",
                "மீண்டும் முயற்சி செய்வோம். 'நான் வீட்டிலேயே ஆல்டர் செய்து தருகிறேன்…' என்று தொடங்கி, ஒரு உண்மையைச் சேருங்கள்: எவ்வளவு நாள் ஆகும், அல்லது விலை என்ன.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "cc-01-fix-claim",
          conceptId: "cc-honest-claims",
          kind: "decide",
          prompt: L(
            "Kavitha makes hair oil at home in small batches, with coconut oil and curry leaves. She plans to tell customers: 'This is the best oil in the city, and it will stop all hair fall.' What is the problem with this, and what could she say instead?",
            "கவிதா வீட்டில் தேங்காய் எண்ணெயும் கறிவேப்பிலையும் சேர்த்து, சிறிய அளவில் தலைமுடி எண்ணெய் தயாரிக்கிறார். வாடிக்கையாளர்களிடம் இப்படிச் சொல்ல நினைக்கிறார்: 'இதுதான் நகரத்திலேயே சிறந்த எண்ணெய், எல்லா முடி உதிர்வையும் நிறுத்திவிடும்.' இதில் என்ன பிரச்சனை, அதற்குப் பதிலாக அவர் என்ன சொல்லலாம்?",
          ),
          hints: [
            L(
              "Can Kavitha prove either claim? What does she know for certain about her oil?",
              "இந்த இரண்டு கூற்றுகளில் எதையாவது கவிதாவால் நிரூபிக்க முடியுமா? தன் எண்ணெயைப் பற்றி அவருக்கு உறுதியாக என்ன தெரியும்?",
            ),
          ],
          modelAnswer: L(
            "She can't prove it is the best in the city or that it stops hair fall, so those claims could mislead people. She could say: 'I make this at home in small batches, with coconut oil and curry leaves.'",
            "நகரத்திலேயே சிறந்தது என்றோ, முடி உதிர்வை நிறுத்தும் என்றோ அவரால் நிரூபிக்க முடியாது; அதனால் அந்தக் கூற்றுகள் மக்களைத் தவறாக வழிநடத்தலாம். அவர் இப்படிச் சொல்லலாம்: 'தேங்காய் எண்ணெயும் கறிவேப்பிலையும் சேர்த்து, இதை வீட்டில் சிறிய அளவில் தயாரிக்கிறேன்.'",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "spots-problem",
                kind: "terms",
                description: L("Says the claims can't be proved or could mislead", "அந்தக் கூற்றுகளை நிரூபிக்க முடியாது அல்லது தவறாக வழிநடத்தலாம் என்று சொல்கிறது"),
                terms: terms(
                  ["prove", "proof", "exaggerat", "not true", "untrue", "false", "lie", "mislead", "overclaim", "promise", "guarantee", "honest", "can't know", "cannot know"],
                  ["நிரூபிக்க", "ஆதாரம்", "மிகைப்படுத்", "உண்மை இல்லை", "உண்மையில்லை", "பொய்", "தவறாக", "வாக்குறுதி", "நேர்மை", "உறுதியாகச் சொல்ல முடியாது"],
                ),
              },
              {
                id: "honest-alternative",
                kind: "terms",
                description: L(
                  "Suggests something true instead (made at home, coconut oil and curry leaves)",
                  "அதற்குப் பதிலாக உண்மையான ஒன்றைச் சொல்கிறது (வீட்டில் தயாரிப்பது, தேங்காய் எண்ணெய், கறிவேப்பிலை)",
                ),
                terms: terms(
                  ["home", "small batch", "coconut", "curry", "ingredient", "what goes in", "made with"],
                  ["வீட்டில்", "தேங்காய்", "கறிவேப்பிலை", "சிறிய அளவில்", "சேர்த்து", "தயாரிக்கிறேன்", "பொருட்கள்"],
                ),
              },
            ],
            requiredForCorrect: ["spots-problem", "honest-alternative"],
            feedback: {
              correct: L(
                "Yes. Neither claim can be proved, and the hair-fall claim could mislead people. Saying what goes into the oil and how she makes it is honest, and still useful.",
                "ஆமாம். இரண்டு கூற்றுகளையும் நிரூபிக்க முடியாது; முடி உதிர்வு பற்றிய கூற்று மக்களைத் தவறாக வழிநடத்தலாம். எண்ணெயில் என்ன சேர்க்கிறார், எப்படித் தயாரிக்கிறார் என்று சொல்வது நேர்மையானது, பயனுள்ளதும் கூட.",
              ),
              partial: L(
                "You're on the right track. Make sure you say both: why the claims are a problem, and what true thing she could say instead.",
                "சரியான பாதையில் இருக்கிறீர்கள். இரண்டையும் சொல்லுங்கள்: அந்தக் கூற்றுகள் ஏன் பிரச்சனை, அதற்குப் பதிலாக அவர் என்ன உண்மையைச் சொல்லலாம்.",
              ),
              needs_practice: L(
                "Look again at the two claims: 'best in the city' and 'stops all hair fall'. Can Kavitha show either one is true? Then think of something she does know, like what goes into the oil.",
                "அந்த இரண்டு கூற்றுகளையும் மீண்டும் பாருங்கள்: 'நகரத்திலேயே சிறந்தது', 'எல்லா முடி உதிர்வையும் நிறுத்தும்'. இவற்றில் எதையாவது உண்மை என்று கவிதாவால் காட்ட முடியுமா? பிறகு அவருக்கு உறுதியாகத் தெரிந்த ஒன்றை யோசியுங்கள் — எண்ணெயில் என்ன சேர்க்கிறார் என்பது போல.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Say or write an introduction for something you offer, or would like to. Find one vague word and replace it with a fact. Remove any claim you couldn't show to be true.",
        "நீங்கள் வழங்கும் — அல்லது வழங்க விரும்பும் — ஒன்றுக்கான அறிமுகத்தைச் சொல்லிப் பாருங்கள் அல்லது எழுதுங்கள். அதில் ஒரு பொதுவான வார்த்தையைக் கண்டுபிடித்து, ஒரு உண்மையால் மாற்றுங்கள். உண்மை என்று காட்ட முடியாத எந்தக் கூற்றையும் நீக்குங்கள்.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "cc-02",
      sequence: 2,
      title: L("Listening and asking useful questions", "கவனித்துக் கேட்பதும் பயனுள்ள கேள்விகளும்"),
      objective: L(
        "Use open questions to learn what a customer needs, closed questions to confirm details, and repeat back what you heard.",
        "வாடிக்கையாளரின் தேவையைத் தெரிந்துகொள்ளத் திறந்த கேள்விகளையும், விவரங்களை உறுதி செய்ய மூடிய கேள்விகளையும் பயன்படுத்துவது; கேட்டதைத் திரும்பச் சொல்லிச் சரிபார்ப்பது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "cc-open-closed",
          title: L("Open and closed questions", "திறந்த கேள்விகளும் மூடிய கேள்விகளும்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "A closed question gets a short answer — yes, no, or one word. 'Do you need it by Friday?' An open question invites the customer to explain. 'What will you use it for?' Open questions help you learn the need. Closed questions help you confirm a detail. Start open, then close.",
                "மூடிய கேள்விக்குச் சுருக்கமான பதில் வரும் — ஆமாம், இல்லை, அல்லது ஒரு வார்த்தை. 'வெள்ளிக்கிழமைக்குள் வேண்டுமா?' திறந்த கேள்வி, வாடிக்கையாளரை விளக்கிச் சொல்ல அழைக்கிறது. 'இதை எதற்குப் பயன்படுத்தப் போகிறீர்கள்?' தேவையைத் தெரிந்துகொள்ளத் திறந்த கேள்விகள் உதவும். ஒரு விவரத்தை உறுதி செய்ய மூடிய கேள்விகள் உதவும். முதலில் திறந்த கேள்வி, பிறகு மூடிய கேள்வி.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A parent calls about tuition. If you ask, 'Does your son need help with maths?', you may just hear 'yes'. If you ask, 'Which part of maths does he find hard?', you might hear, 'Word problems — he can do the sums, but the story confuses him.' Now you know what to offer.",
                "டியூஷன் பற்றி ஒரு பெற்றோர் அழைக்கிறார். 'உங்கள் மகனுக்குக் கணக்கில் உதவி வேண்டுமா?' என்று கேட்டால், 'ஆமாம்' என்று மட்டும் பதில் வரலாம். 'கணக்கில் எந்தப் பகுதி அவனுக்குக் கடினமாக இருக்கிறது?' என்று கேட்டால், 'கதைக் கணக்குகள் — கூட்டல் கழித்தல் தெரியும், ஆனால் கேள்வியைப் படித்தால் குழம்பிவிடுகிறான்' என்று பதில் வரலாம். இப்போது என்ன வழங்குவது என்று உங்களுக்குத் தெரியும்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "A closed question is like a light switch: on or off. An open question is like opening a window: more comes in than you expected. You need both — the window to learn, the switch to decide.",
                "மூடிய கேள்வி ஒரு விளக்கு ஸ்விட்ச் போன்றது: போடலாம் அல்லது அணைக்கலாம். திறந்த கேள்வி ஜன்னலைத் திறப்பது போன்றது: நீங்கள் எதிர்பார்த்ததைவிட அதிகம் உள்ளே வரும். இரண்டும் தேவை — தெரிந்துகொள்ள ஜன்னல், முடிவு செய்ய ஸ்விட்ச்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Open questions (what, how, which, tell me) help you learn the need.",
              "திறந்த கேள்விகள் (என்ன, எப்படி, எந்த, சொல்லுங்கள்) தேவையைத் தெரிந்துகொள்ள உதவும்.",
            ),
            L(
              "Closed questions (do you, is it, will you) help you confirm a detail.",
              "மூடிய கேள்விகள் ('…வேண்டுமா?', '…சரியா?') ஒரு விவரத்தை உறுதி செய்ய உதவும்.",
            ),
          ],
          checkQuestion: L(
            "Can you turn 'Do you want a blouse?' into an open question?",
            "'ரவிக்கை வேண்டுமா?' என்பதை ஒரு திறந்த கேள்வியாக மாற்ற முடியுமா?",
          ),
        },
        {
          id: "cc-reflect-back",
          title: L("Repeating back to check", "கேட்டதைத் திரும்பச் சொல்லிச் சரிபார்ப்பது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "After a customer explains, say back the main points in a few words and ask if you got it right. This shows you were listening, and it catches mistakes before you start work — not after.",
                "வாடிக்கையாளர் விளக்கிய பிறகு, முக்கியமான விஷயங்களைச் சில வார்த்தைகளில் திரும்பச் சொல்லி, சரியாகப் புரிந்துகொண்டீர்களா என்று கேளுங்கள். நீங்கள் கவனமாகக் கேட்டீர்கள் என்று இது காட்டும்; வேலையைத் தொடங்குவதற்கு முன்பே — பிறகு அல்ல — தவறுகளைக் கண்டுபிடிக்கவும் உதவும்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A customer of a home beauty service says: 'I have a wedding on Sunday. I want something simple, and my skin gets dry easily.' You reply: 'So — a simple look for a Sunday wedding, and products that suit dry skin. Is that right?' If you misheard anything, she can correct you now.",
                "வீட்டில் அழகு சேவை செய்பவரிடம் ஒரு வாடிக்கையாளர் சொல்கிறார்: 'ஞாயிற்றுக்கிழமை ஒரு கல்யாணம் இருக்கிறது. எளிமையாக இருக்க வேண்டும், என் தோல் சீக்கிரம் வறண்டுவிடும்.' நீங்கள் சொல்கிறீர்கள்: 'அப்படியென்றால் — ஞாயிறு கல்யாணத்துக்கு எளிமையான அலங்காரம், வறண்ட தோலுக்கு ஏற்ற பொருட்கள். சரியா?' ஏதாவது தவறாகக் கேட்டிருந்தால், அவர் இப்போதே திருத்திவிடலாம்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "First, listen to the end without interrupting. Second, pick out the key details — who, what, when, and anything they like or don't like. Third, say those details back in one short sentence. Fourth, ask, 'Did I get that right?' Fifth, if they correct you, thank them and repeat the corrected version.",
                "முதலில், இடைமறிக்காமல் முழுவதும் கேளுங்கள். இரண்டாவது, முக்கிய விவரங்களைத் தேர்ந்தெடுங்கள் — யாருக்கு, என்ன, எப்போது, அவர்களுக்குப் பிடித்தது அல்லது பிடிக்காதது. மூன்றாவது, அந்த விவரங்களை ஒரு சிறிய வாக்கியத்தில் திரும்பச் சொல்லுங்கள். நான்காவது, 'நான் சரியாகப் புரிந்துகொண்டேனா?' என்று கேளுங்கள். ஐந்தாவது, அவர்கள் திருத்தினால், நன்றி சொல்லி, திருத்தியதை மீண்டும் சொல்லுங்கள்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Say back the main points in a few words, then ask 'Is that right?'",
              "முக்கிய விஷயங்களைச் சில வார்த்தைகளில் திரும்பச் சொல்லி, 'சரியா?' என்று கேளுங்கள்.",
            ),
            L(
              "It is easier to fix a misunderstanding before you start than after.",
              "தொடங்கிய பிறகு திருத்துவதைவிட, தொடங்குவதற்கு முன் தவறான புரிதலைத் திருத்துவது எளிது.",
            ),
          ],
          checkQuestion: L(
            "Why is it useful to repeat back what a customer said?",
            "வாடிக்கையாளர் சொன்னதைத் திரும்பச் சொல்வது ஏன் பயனுள்ளது?",
          ),
        },
      ],
      practice: [
        {
          id: "cc-02-open-or-closed",
          conceptId: "cc-open-closed",
          kind: "decide",
          prompt: L(
            "You sell vegetables. Which of these is an open question, and why? First: 'Do you want carrots today?' Second: 'What are you planning to cook this week?'",
            "நீங்கள் காய்கறி விற்கிறீர்கள். இவற்றில் எது திறந்த கேள்வி, ஏன்? முதலாவது: 'இன்று கேரட் வேண்டுமா?' இரண்டாவது: 'இந்த வாரம் என்ன சமைக்கப் போகிறீர்கள்?'",
          ),
          hints: [
            L("Which one can be answered with just 'yes' or 'no'?", "எதற்கு 'ஆமாம்' அல்லது 'இல்லை' என்று மட்டும் பதில் சொல்ல முடியும்?"),
          ],
          modelAnswer: L(
            "The second one is open. The customer has to explain what they'll cook, so I learn which vegetables they might need. The first can be answered with just yes or no.",
            "இரண்டாவதுதான் திறந்த கேள்வி. என்ன சமைக்கப் போகிறார் என்று வாடிக்கையாளர் விளக்க வேண்டும்; அதனால் அவருக்கு என்ன காய்கறி தேவைப்படலாம் என்று எனக்குத் தெரியும். முதலாவதுக்கு ஆமாம் அல்லது இல்லை என்று மட்டும் பதில் சொல்லலாம்.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "picks-second",
                kind: "terms",
                description: L("Chooses the second question", "இரண்டாவது கேள்வியைத் தேர்ந்தெடுக்கிறது"),
                terms: terms(["second", "cook", "planning", "this week", "what are you"], ["இரண்டாவது", "சமைக்க", "இந்த வாரம்", "என்ன சமை"]),
              },
              {
                id: "gives-reason",
                kind: "terms",
                description: L(
                  "Explains why: the customer can say more than yes or no",
                  "காரணம் சொல்கிறது: வாடிக்கையாளர் ஆமாம், இல்லை என்பதற்கு மேல் சொல்ல முடியும்",
                ),
                terms: terms(
                  ["yes or no", "yes/no", "explain", "more", "talk", "detail", "tell", "share", "learn", "not just"],
                  ["ஆமாம் அல்லது இல்லை", "ஆமாம் இல்லை", "விளக்க", "அதிக", "பேச", "விவர", "சொல்ல", "தெரிந்து", "தெரியும்"],
                ),
              },
            ],
            requiredForCorrect: ["picks-second", "gives-reason"],
            feedback: {
              correct: L(
                "Yes. The second question is open — the customer explains, and you learn what they might need. The first can be answered with just yes or no.",
                "ஆமாம். இரண்டாவது கேள்வி திறந்தது — வாடிக்கையாளர் விளக்குவார், அவருக்கு என்ன தேவைப்படலாம் என்று நீங்கள் தெரிந்துகொள்வீர்கள். முதலாவதுக்கு ஆமாம் அல்லது இல்லை என்று மட்டும் பதில் சொல்லலாம்.",
              ),
              partial: L(
                "Part of the way there. Say which question is open, and why — think about how long the customer's answer could be.",
                "பாதி சரி. எது திறந்த கேள்வி, ஏன் என்று சொல்லுங்கள் — வாடிக்கையாளரின் பதில் எவ்வளவு நீளமாக இருக்கலாம் என்று யோசியுங்கள்.",
              ),
              needs_practice: L(
                "Try answering each question yourself. 'Do you want carrots?' — yes or no. 'What are you planning to cook?' — that needs an explanation. The one that needs an explanation is the open question.",
                "ஒவ்வொரு கேள்விக்கும் நீங்களே பதில் சொல்லிப் பாருங்கள். 'கேரட் வேண்டுமா?' — ஆமாம் அல்லது இல்லை. 'என்ன சமைக்கப் போகிறீர்கள்?' — அதற்கு விளக்கம் தேவை. விளக்கம் தேவைப்படுவதுதான் திறந்த கேள்வி.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "cc-02-reflect-back",
          conceptId: "cc-reflect-back",
          kind: "role_play",
          prompt: L(
            "At your tailoring shop, a customer says: 'I need a churidar for my daughter's school function next Friday. She's twelve, and she doesn't like tight sleeves.' Repeat back what you heard, and check that you understood.",
            "உங்கள் தையல் கடையில் ஒரு வாடிக்கையாளர் சொல்கிறார்: 'அடுத்த வெள்ளிக்கிழமை என் மகளின் பள்ளி விழாவுக்கு ஒரு சுடிதார் வேண்டும். அவளுக்குப் பன்னிரண்டு வயது, இறுக்கமான கை அவளுக்குப் பிடிக்காது.' நீங்கள் கேட்டதைத் திரும்பச் சொல்லி, சரியாகப் புரிந்துகொண்டீர்களா என்று சரிபாருங்கள்.",
          ),
          hints: [
            L(
              "Pick out who, what, when and what she doesn't like. Then ask 'Is that right?'",
              "யாருக்கு, என்ன, எப்போது, எது பிடிக்காது என்பதைத் தேர்ந்தெடுங்கள். பிறகு 'சரியா?' என்று கேளுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "So, a churidar for your twelve-year-old daughter, ready before next Friday's school function, with loose sleeves. Is that right?",
            "அப்படியென்றால், உங்கள் பன்னிரண்டு வயது மகளுக்கு ஒரு சுடிதார், அடுத்த வெள்ளிக்கிழமை பள்ளி விழாவுக்கு முன் தயாராக, தளர்வான கையுடன். சரியா?",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "repeats-details",
                kind: "terms",
                description: L(
                  "Repeats at least two key details (churidar, daughter, Friday, sleeves)",
                  "குறைந்தது இரண்டு முக்கிய விவரங்களைத் திரும்பச் சொல்கிறது (சுடிதார், மகள், வெள்ளிக்கிழமை, கை)",
                ),
                terms: terms(
                  ["churidar", "friday", "twelve", "12", "daughter", "sleeve", "loose", "school", "function"],
                  ["சுடிதார்", "வெள்ளி", "பன்னிரண்டு", "12", "மகள்", "கை", "தளர்வ", "லூஸ்", "பள்ளி", "விழா", "இறுக்க"],
                ),
                minMatches: 2,
              },
              {
                id: "checks-understanding",
                kind: "terms",
                description: L("Checks they understood (for example, 'Is that right?')", "புரிந்துகொண்டதைச் சரிபார்க்கிறது (உதாரணமாக, 'சரியா?')"),
                terms: terms(
                  ["right", "correct", "is that", "did i", "understand", "okay", "am i"],
                  ["சரியா", "சரிதானே", "சரி தானே", "புரிந்து", "இல்லையா", "தானே"],
                ),
              },
            ],
            requiredForCorrect: ["repeats-details", "checks-understanding"],
            feedback: {
              correct: L(
                "Well done: you repeated the key details and checked. If anything was misheard, the customer can correct it now, before any cloth is cut.",
                "நன்றாகச் செய்தீர்கள்: முக்கிய விவரங்களைத் திரும்பச் சொல்லிச் சரிபார்த்தீர்கள். ஏதாவது தவறாகக் கேட்டிருந்தால், துணியை வெட்டுவதற்கு முன்பே வாடிக்கையாளர் திருத்திவிடலாம்.",
              ),
              partial: L(
                "Good start. Make sure you do both: repeat the main details — who, what, when, the sleeves — and end with 'Is that right?'",
                "நல்ல தொடக்கம். இரண்டையும் செய்யுங்கள்: முக்கிய விவரங்களை — யாருக்கு, என்ன, எப்போது, கை — திரும்பச் சொல்லுங்கள்; கடைசியில் 'சரியா?' என்று கேளுங்கள்.",
              ),
              needs_practice: L(
                "Try starting with 'So…', then say the details back: a churidar, for whom, by when, and the sleeves. Finish with 'Is that right?'",
                "'அப்படியென்றால்…' என்று தொடங்கி, விவரங்களைத் திரும்பச் சொல்லுங்கள்: சுடிதார், யாருக்கு, எப்போதுக்குள், கை எப்படி. கடைசியில் 'சரியா?' என்று கேளுங்கள்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "In your next conversation — with a customer, a neighbour or a family member — ask one open question, listen to the end, and repeat back what you heard before you reply.",
        "உங்கள் அடுத்த உரையாடலில் — வாடிக்கையாளரோ, பக்கத்து வீட்டுக்காரரோ, குடும்ப உறுப்பினரோ — ஒரு திறந்த கேள்வி கேட்டு, முழுவதும் கவனமாகக் கேட்டு, பதில் சொல்வதற்கு முன் நீங்கள் கேட்டதைத் திரும்பச் சொல்லுங்கள்.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "cc-03",
      sequence: 3,
      title: L("Responding to questions, doubts and objections", "கேள்விகள், தயக்கங்கள், மறுப்புகளுக்குப் பதில் சொல்வது"),
      objective: L(
        "Respond to 'it's too expensive' and 'I'll think about it' calmly and honestly, without pressure, and practise a short conversation.",
        "'விலை அதிகம்', 'யோசித்துச் சொல்கிறேன்' போன்றவற்றுக்கு அழுத்தம் கொடுக்காமல், அமைதியாகவும் நேர்மையாகவும் பதில் சொல்வது; ஒரு சிறிய உரையாடலைப் பழகுவது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "cc-price-objection",
          title: L("When a customer says 'too expensive'", "'விலை அதிகம்' என்று வாடிக்கையாளர் சொல்லும்போது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "When a customer says the price is too high, don't argue and don't take it personally. First, acknowledge it: 'I understand.' Then explain honestly what the price includes. If you genuinely have a smaller or simpler option, you can mention it. Then leave the decision to them.",
                "விலை அதிகம் என்று வாடிக்கையாளர் சொன்னால், வாதம் செய்யாதீர்கள், மனம் வருந்தவும் வேண்டாம். முதலில், அதை ஏற்றுக்கொள்ளுங்கள்: 'புரிகிறது.' பிறகு, அந்த விலையில் என்ன அடங்கும் என்று நேர்மையாக விளக்குங்கள். உண்மையிலேயே சிறிய அல்லது எளிய வேறு வாய்ப்பு இருந்தால், அதைச் சொல்லலாம். பிறகு முடிவை அவர்களிடமே விட்டுவிடுங்கள்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A parent says, '₹800 a month for tuition is too much.' The tutor replies: 'I understand, it's a real amount for a family. It covers four classes a week, and I check homework every day. I also have a two-days-a-week group for ₹450, if that suits you better.' No pressure, no exaggeration — just clear information.",
                "ஒரு பெற்றோர் சொல்கிறார்: 'டியூஷனுக்கு மாதம் ₹800 அதிகம்.' ஆசிரியர் பதில் சொல்கிறார்: 'புரிகிறது, ஒரு குடும்பத்துக்கு இது சிறிய தொகை அல்ல. இதில் வாரத்துக்கு நான்கு வகுப்புகள் அடங்கும், தினமும் வீட்டுப்பாடத்தைச் சரிபார்க்கிறேன். உங்களுக்கு வசதியாக இருந்தால், வாரத்துக்கு இரண்டு நாள் வகுப்பும் ₹450-க்கு இருக்கிறது.' அழுத்தம் இல்லை, மிகைப்படுத்தல் இல்லை — தெளிவான தகவல் மட்டும்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "Use four steps. One: acknowledge — 'I understand.' Two: explain honestly what is included. Three: only if you really have one, mention a smaller option. Four: let them decide — 'It's your choice.' Never invent a discount that 'ends today', and never make the customer feel small.",
                "நான்கு படிகளைப் பயன்படுத்துங்கள். ஒன்று: ஏற்றுக்கொள்ளுங்கள் — 'புரிகிறது.' இரண்டு: என்ன அடங்கும் என்று நேர்மையாக விளக்குங்கள். மூன்று: உண்மையில் இருந்தால் மட்டும், ஒரு சிறிய வாய்ப்பைச் சொல்லுங்கள். நான்கு: முடிவை அவர்களிடம் விடுங்கள் — 'உங்கள் விருப்பம்.' 'இன்று மட்டும் தள்ளுபடி' என்று பொய்யாகச் சொல்லாதீர்கள்; வாடிக்கையாளரைச் சிறுமைப்படுத்தவும் வேண்டாம்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Acknowledge, explain what's included, offer a real alternative if you have one, and let them decide.",
              "ஏற்றுக்கொள்ளுங்கள், என்ன அடங்கும் என்று விளக்குங்கள், உண்மையான வேறு வாய்ப்பு இருந்தால் சொல்லுங்கள், முடிவை அவர்களிடம் விடுங்கள்.",
            ),
            L("Never pressure, argue or invent a deadline.", "ஒருபோதும் அழுத்தம் கொடுக்காதீர்கள், வாதம் செய்யாதீர்கள், பொய்யான கெடு சொல்லாதீர்கள்."),
          ],
          checkQuestion: L(
            "What is the first thing to say when a customer says your price is too high?",
            "உங்கள் விலை அதிகம் என்று வாடிக்கையாளர் சொன்னால், முதலில் என்ன சொல்ல வேண்டும்?",
          ),
        },
        {
          id: "cc-customer-unsure",
          title: L("When the customer is unsure", "வாடிக்கையாளர் தயங்கும்போது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "'I'll think about it' or 'I'm not sure' is a fair answer. Respect it. Say something like 'That's fine, there's no hurry,' and make it easy to come back — share your number, or say when you are available. A customer who feels respected is more comfortable coming back.",
                "'யோசித்துச் சொல்கிறேன்', 'உறுதியாகத் தெரியவில்லை' — இவை நியாயமான பதில்கள். அவற்றை மதியுங்கள். 'பரவாயில்லை, அவசரம் இல்லை' என்பது போலச் சொல்லுங்கள்; மீண்டும் வருவதை எளிதாக்குங்கள் — உங்கள் நம்பரைக் கொடுங்கள், அல்லது நீங்கள் எப்போது இருப்பீர்கள் என்று சொல்லுங்கள். மதிக்கப்பட்டதாக உணரும் வாடிக்கையாளர், திரும்ப வர வசதியாக உணர்வார்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "Think of inviting someone into your home. You open the door and welcome them — you don't pull them in by the hand. Respecting 'I'll think about it' is like keeping the door open.",
                "ஒருவரை உங்கள் வீட்டுக்கு அழைப்பதை நினைத்துப் பாருங்கள். கதவைத் திறந்து வரவேற்பீர்கள் — கையைப் பிடித்து உள்ளே இழுக்க மாட்டீர்கள். 'யோசித்துச் சொல்கிறேன்' என்பதை மதிப்பது, கதவைத் திறந்தே வைத்திருப்பது போன்றது.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Think back to a time a seller kept pushing you. How did it feel? Now think of a seller who said, 'No problem, come back any time.' Which one would you rather go back to? Your customers may feel the same way.",
                "ஒரு விற்பனையாளர் உங்களைத் திரும்பத் திரும்ப வற்புறுத்திய ஒரு நேரத்தை நினைத்துப் பாருங்கள். எப்படி இருந்தது? இப்போது, 'பரவாயில்லை, எப்போது வேண்டுமானாலும் வாருங்கள்' என்று சொன்ன ஒரு விற்பனையாளரை நினைத்துப் பாருங்கள். யாரிடம் திரும்பப் போக விரும்புவீர்கள்? உங்கள் வாடிக்கையாளர்களும் அப்படியே உணரலாம்.",
              ),
            },
          ],
          keyPoints: [
            L("'I'll think about it' is a fair answer. Respect it.", "'யோசித்துச் சொல்கிறேன்' என்பது நியாயமான பதில். அதை மதியுங்கள்."),
            L(
              "Make it easy to come back: share your number, or when you are available.",
              "மீண்டும் வருவதை எளிதாக்குங்கள்: உங்கள் நம்பரை, அல்லது நீங்கள் இருக்கும் நேரத்தைச் சொல்லுங்கள்.",
            ),
          ],
          checkQuestion: L(
            "What could you say when a customer says 'I'll think about it'?",
            "'யோசித்துச் சொல்கிறேன்' என்று வாடிக்கையாளர் சொன்னால் நீங்கள் என்ன சொல்லலாம்?",
          ),
        },
      ],
      practice: [
        {
          id: "cc-03-too-expensive",
          conceptId: "cc-price-objection",
          kind: "role_play",
          prompt: L(
            "You do bridal mehndi. A customer says: '₹1,500? That's too expensive.' Your price covers both hands and both feet, henna you mix fresh yourself, and about three hours of work. You also offer hands only for ₹800. Reply respectfully.",
            "நீங்கள் கல்யாணப் பெண்களுக்கு மெஹந்தி போடுகிறீர்கள். ஒரு வாடிக்கையாளர் சொல்கிறார்: '₹1,500-ஆ? ரொம்ப அதிகம்.' உங்கள் விலையில் இரண்டு கைகள், இரண்டு கால்கள், நீங்களே புதிதாகக் கலக்கும் மருதாணி, சுமார் மூன்று மணி நேர வேலை — எல்லாம் அடங்கும். கைகளுக்கு மட்டும் ₹800-க்கும் போடுகிறீர்கள். மரியாதையாகப் பதில் சொல்லுங்கள்.",
          ),
          hints: [
            L(
              "Acknowledge first, then say what's included, then mention the hands-only option and let her choose.",
              "முதலில் ஏற்றுக்கொள்ளுங்கள், பிறகு என்ன அடங்கும் என்று சொல்லுங்கள், பிறகு கைகளுக்கு மட்டும் உள்ள வாய்ப்பைச் சொல்லி, அவரையே தேர்ந்தெடுக்க விடுங்கள்.",
            ),
          ],
          modelAnswer: L(
            "I understand — it is a big amount. The ₹1,500 covers both hands and both feet, with henna I mix fresh myself, and it takes about three hours. If you prefer, I can do the hands only for ₹800. Whatever suits you.",
            "புரிகிறது — இது பெரிய தொகைதான். ₹1,500-ல் இரண்டு கைகளும் இரண்டு கால்களும் அடங்கும்; நானே புதிதாகக் கலக்கும் மருதாணி; சுமார் மூன்று மணி நேரம் ஆகும். உங்களுக்கு விருப்பமென்றால், கைகளுக்கு மட்டும் ₹800-க்குப் போடுகிறேன். உங்களுக்கு எது வசதியோ அப்படியே.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "acknowledges",
                kind: "terms",
                description: L("Acknowledges the customer's concern", "வாடிக்கையாளரின் கவலையை ஏற்றுக்கொள்கிறது"),
                terms: terms(
                  ["understand", "i see", "fair", "i know", "big amount", "true", "of course"],
                  ["புரிகிறது", "புரியுது", "புரிந்து", "நியாயம்", "பெரிய தொகை", "உண்மைதான்", "சரிதான்"],
                ),
              },
              {
                id: "explains-included",
                kind: "terms",
                description: L(
                  "Explains what the price includes (hands, feet, fresh henna, three hours)",
                  "விலையில் என்ன அடங்கும் என்று விளக்குகிறது (கைகள், கால்கள், புதிய மருதாணி, மூன்று மணி நேரம்)",
                ),
                terms: terms(
                  ["hand", "feet", "foot", "henna", "fresh", "three hours", "3 hours", "include", "cover"],
                  ["கை", "கால்", "மருதாணி", "மூன்று மணி", "3 மணி", "அடங்கும்", "புதிதாக", "கலக்கும்"],
                ),
              },
              {
                id: "offers-choice",
                kind: "terms",
                description: L("Mentions the hands-only option or leaves the choice to her", "கைகளுக்கு மட்டும் உள்ள வாய்ப்பைச் சொல்கிறது அல்லது முடிவை அவரிடம் விடுகிறது"),
                terms: terms(
                  ["800", "hands only", "only hands", "only the hands", "choice", "suits you", "up to you", "prefer"],
                  ["800", "கைகளுக்கு மட்டும்", "விருப்ப", "வசதி", "உங்கள் முடிவு"],
                ),
              },
            ],
            requiredForCorrect: ["acknowledges", "explains-included"],
            feedback: {
              correct: L(
                "Respectful and honest: you acknowledged her concern and explained what the price includes, without pushing.",
                "மரியாதையாகவும் நேர்மையாகவும் இருக்கிறது: அவருடைய கவலையை ஏற்றுக்கொண்டு, அழுத்தம் கொடுக்காமல், விலையில் என்ன அடங்கும் என்று விளக்கினீர்கள்.",
              ),
              partial: L(
                "Good start. Make sure you both acknowledge her concern ('I understand') and explain what the ₹1,500 includes.",
                "நல்ல தொடக்கம். அவருடைய கவலையை ஏற்றுக்கொள்வது ('புரிகிறது'), ₹1,500-ல் என்ன அடங்கும் என்று விளக்குவது — இரண்டையும் செய்யுங்கள்.",
              ),
              needs_practice: L(
                "Try the steps: begin with 'I understand', then say what the price covers — hands, feet, fresh henna, three hours. You can then mention the ₹800 option.",
                "படிகளை முயற்சியுங்கள்: 'புரிகிறது' என்று தொடங்கி, விலையில் என்ன அடங்கும் என்று சொல்லுங்கள் — கைகள், கால்கள், புதிய மருதாணி, மூன்று மணி நேரம். பிறகு ₹800 வாய்ப்பைச் சொல்லலாம்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "cc-03-think-about-it",
          conceptId: "cc-customer-unsure",
          kind: "role_play",
          prompt: L(
            "You have just explained your weekly vegetable delivery to a neighbour. She says: 'Hmm, I'll think about it.' What would you say? Keep it short.",
            "உங்கள் வாராந்திரக் காய்கறி டெலிவரியைப் பற்றி ஒரு பக்கத்து வீட்டுக்காரரிடம் இப்போதுதான் விளக்கினீர்கள். அவர் சொல்கிறார்: 'ம்ம், யோசித்துச் சொல்கிறேன்.' நீங்கள் என்ன சொல்வீர்கள்? சுருக்கமாகச் சொல்லுங்கள்.",
          ),
          hints: [
            L("Respect her answer, and make it easy for her to come back.", "அவருடைய பதிலை மதியுங்கள்; அவர் மீண்டும் வருவதை எளிதாக்குங்கள்."),
          ],
          modelAnswer: L(
            "Of course, take your time. I'll leave my number with you — message me whenever you'd like to try it for a week.",
            "சரி, நிதானமாக யோசியுங்கள். என் நம்பரைக் கொடுக்கிறேன் — ஒரு வாரம் முயற்சி செய்து பார்க்க விரும்பினால், எப்போது வேண்டுமானாலும் மெசேஜ் செய்யுங்கள்.",
          ),
          rubric: {
            mode: "open",
            criteria: [
              {
                id: "respects",
                kind: "terms",
                description: L("Respects her decision without pressure", "அழுத்தம் கொடுக்காமல் அவருடைய முடிவை மதிக்கிறது"),
                terms: terms(
                  ["of course", "take your time", "no problem", "sure", "okay", "fine", "your choice", "no hurry", "no rush", "whenever"],
                  ["சரி", "நிதானமாக", "பரவாயில்லை", "தாராளமாக", "உங்கள் விருப்பம்", "அவசரம் இல்லை", "அவசரமில்லை", "எப்போது வேண்டுமானாலும்"],
                ),
              },
              {
                id: "door-open",
                kind: "terms",
                description: L("Makes it easy to come back (number, message, when available)", "மீண்டும் வருவதை எளிதாக்குகிறது (நம்பர், மெசேஜ், இருக்கும் நேரம்)"),
                terms: terms(
                  ["number", "call", "message", "come back", "any time", "anytime", "contact", "later", "let me know"],
                  ["நம்பர்", "எண்", "அழை", "கூப்பிட", "மெசேஜ்", "தொடர்பு", "பிறகு", "திரும்ப வா"],
                ),
              },
            ],
            requiredForCorrect: ["respects"],
            feedback: {
              correct: L(
                "That respects her decision, with no pressure. Sharing your number, or when you're available, makes it easy for her to come back.",
                "அது அழுத்தம் இல்லாமல் அவருடைய முடிவை மதிக்கிறது. உங்கள் நம்பரையோ நீங்கள் இருக்கும் நேரத்தையோ சொன்னால், அவர் மீண்டும் வருவது எளிதாகும்.",
              ),
              partial: L(
                "Making it easy to reach you is helpful. Also say clearly that it's fine for her to take her time.",
                "உங்களைத் தொடர்புகொள்வதை எளிதாக்கியது உதவியாக இருக்கிறது. நிதானமாக யோசிக்கலாம், பரவாயில்லை என்பதையும் தெளிவாகச் சொல்லுங்கள்.",
              ),
              needs_practice: L(
                "Try not to push her to decide now. Start with something like 'Of course, take your time,' then say how she can reach you.",
                "இப்போதே முடிவு செய்யும்படி அவரை வற்புறுத்த வேண்டாம். 'சரி, நிதானமாக யோசியுங்கள்' போன்ற ஒன்றில் தொடங்கி, உங்களை எப்படித் தொடர்புகொள்ளலாம் என்று சொல்லுங்கள்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Practise a short conversation with a family member or friend. They play a customer who says 'It's too expensive' or 'I'll think about it'. Reply calmly, then swap roles.",
        "ஒரு குடும்ப உறுப்பினரோடு அல்லது நண்பரோடு ஒரு சிறிய உரையாடலைப் பழகுங்கள். அவர் 'விலை அதிகம்' அல்லது 'யோசித்துச் சொல்கிறேன்' என்று சொல்லும் வாடிக்கையாளராக நடிக்கட்டும். நீங்கள் அமைதியாகப் பதில் சொல்லுங்கள், பிறகு பாத்திரங்களை மாற்றிக்கொள்ளுங்கள்.",
      ),
    },
  ],
};
