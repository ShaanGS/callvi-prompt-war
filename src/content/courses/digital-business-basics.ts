import type { z } from "zod";
import type { courseSchema } from "../schema";
import { L, NUMBER_NOT_HEARD, OPEN_UNGRADED, TEAM_AUTHORED_NOTE, terms } from "../helpers";

/**
 * Course 2 — Digital Basics for a Small Business (Tamil-first).
 * Team-authored. Not mentor-reviewed. See contentReview and reviewFlags.
 * Payment-safety guidance is deliberately general: it does not describe any
 * specific app's screens, and lesson dbb-02 is flagged for specialist review.
 */

export const digitalBusinessBasics: z.input<typeof courseSchema> = {
  id: "digital-business-basics",
  sortOrder: 2,
  title: L("Digital Basics for a Small Business", "சிறு தொழிலுக்கான டிஜிட்டல் அடிப்படைகள்"),
  summary: L(
    "Keep a simple daily record of sales and expenses, check digital payments safely, and organise customer orders without collecting more than you need.",
    "விற்பனையையும் செலவையும் தினமும் எளிமையாக எழுதி வைக்கவும், டிஜிட்டல் முறையில் வந்த பணத்தைப் பாதுகாப்பாகச் சரிபார்க்கவும், தேவைக்கு மேல் விவரங்கள் கேட்காமல் வாடிக்கையாளர் ஆர்டர்களை ஒழுங்காக வைக்கவும் கற்றுக்கொள்ளுங்கள்.",
  ),
  description: L(
    "A short, practical course for anyone who sells something, or is about to, and wants simple habits for records, payments and orders. You will use a notebook or your phone, small numbers and everyday examples. The course is educational: it does not give financial, legal or tax advice, and it does not explain how to use any particular app.",
    "ஏதாவது விற்பவர்களுக்கும், விற்கத் தொடங்க இருப்பவர்களுக்கும், கணக்கு, பணம், ஆர்டர் ஆகியவற்றுக்கு எளிய பழக்கங்களைக் கற்றுக்கொள்ள ஒரு குறுகிய, நடைமுறைப் பாடநெறி. ஒரு நோட்டுப் புத்தகம் அல்லது உங்கள் போன், சிறிய எண்கள், அன்றாட உதாரணங்கள் ஆகியவற்றைப் பயன்படுத்துவோம். இது கற்றலுக்கானது மட்டுமே: நிதி, சட்ட அல்லது வரி ஆலோசனை தராது; எந்த ஒரு குறிப்பிட்ட ஆப்பையும் எப்படிப் பயன்படுத்துவது என்றும் விளக்காது.",
  ),
  audience: L(
    "Learners who sell something small, or plan to, and want simple ways to keep track. No previous experience with accounts or digital tools is needed.",
    "சிறிய அளவில் ஏதாவது விற்பவர்கள் அல்லது விற்கத் திட்டமிடுபவர்கள். கணக்கு வைப்பதிலோ டிஜிட்டல் கருவிகளிலோ முன் அனுபவம் தேவையில்லை.",
  ),
  outcomes: [
    L("Keep a simple daily record of sales and expenses.", "விற்பனையையும் செலவையும் தினமும் எளிமையாகப் பதிவு செய்வது."),
    L(
      "Check that a digital payment has really arrived, and never share a PIN or OTP.",
      "டிஜிட்டல் முறையில் பணம் உண்மையில் வந்ததா என்று சரிபார்ப்பது; PIN, OTP-ஐ யாரிடமும் சொல்லாமல் இருப்பது.",
    ),
    L(
      "Organise customer orders and keep simple, private records.",
      "வாடிக்கையாளர் ஆர்டர்களை ஒழுங்குபடுத்தி, எளிய பதிவுகளைத் தனிப்பட்டதாக வைத்திருப்பது.",
    ),
  ],
  languages: ["ta-IN", "en-IN"],
  primaryLanguage: "ta-IN",
  level: "beginner",
  status: "published",
  contentReview: { status: "team_authored", note: TEAM_AUTHORED_NOTE },
  estimatedMinutes: 45,
  recommendationTerms: terms(
    ["record", "account", "notebook", "bookkeep", "expense", "sales", "payment", "upi", "otp", "pin", "phone", "mobile", "digital", "online", "order", "track", "scam", "fraud"],
    ["கணக்கு", "குறிப்பேடு", "நோட்டு", "பதிவு", "செலவு", "விற்பனை", "பேமெண்ட்", "பணம் அனுப்ப", "upi", "otp", "போன்", "மொபைல்", "டிஜிட்டல்", "ஆன்லைன்", "ஆர்டர்", "மோசடி", "ஏமாற்"],
  ),
  lessons: [
    // ---------------------------------------------------------------------
    {
      id: "dbb-01",
      sequence: 1,
      title: L("A daily sales and expense notebook", "தினசரி விற்பனை, செலவுக் குறிப்பேடு"),
      objective: L(
        "Write down each day's sales and expenses, and work out what is left at the end of the day.",
        "ஒவ்வொரு நாளின் விற்பனையையும் செலவையும் எழுதி, நாள் முடிவில் எவ்வளவு மீதம் இருக்கிறது என்று கணக்கிடுவது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "dbb-record-daily",
          title: L("What to write each day", "தினமும் என்ன எழுதுவது"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "A daily notebook has two parts: money that came in from sales, and money that went out on expenses. For each one, write three things: the date, what it was, and the amount in rupees. A paper notebook or the notes on your phone both work.",
                "தினசரி குறிப்பேட்டில் இரண்டு பகுதிகள் இருக்கும்: விற்பனையால் வந்த பணம், செலவுக்காகப் போன பணம். ஒவ்வொன்றுக்கும் மூன்று விஷயங்களை எழுதுங்கள்: தேதி, அது என்ன, ரூபாயில் தொகை. நோட்டுப் புத்தகமோ போனில் உள்ள குறிப்புகளோ — எதுவானாலும் சரி.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "Think of someone who sells flowers outside a temple. On one page she writes: 'Sales — 12 March — jasmine strings — ₹320.' Below it: 'Expenses — 12 March — flowers from the market — ₹150; thread — ₹20.' Anyone can read that page and understand her day.",
                "கோயில் வாசலில் பூ விற்கும் ஒருவரை நினைத்துப் பாருங்கள். ஒரு பக்கத்தில் அவர் எழுதுகிறார்: 'விற்பனை — மார்ச் 12 — மல்லிகைச் சரம் — ₹320.' அதற்குக் கீழே: 'செலவு — மார்ச் 12 — சந்தையில் பூ — ₹150; நூல் — ₹20.' அந்தப் பக்கத்தைப் படிக்கும் யாருக்கும் அவருடைய நாள் புரியும்.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "Take five minutes at the end of the day. First, write the date at the top. Second, list each sale: what you sold and how much you got. Third, list each expense: what you bought or paid for, and how much. Doing it at the same time every day makes it a habit. Writing as you go is even better, because small amounts are easy to forget.",
                "நாள் முடிவில் ஐந்து நிமிடம் எடுத்துக்கொள்ளுங்கள். முதலில், மேலே தேதியை எழுதுங்கள். இரண்டாவது, ஒவ்வொரு விற்பனையையும் எழுதுங்கள்: என்ன விற்றீர்கள், எவ்வளவு கிடைத்தது. மூன்றாவது, ஒவ்வொரு செலவையும் எழுதுங்கள்: என்ன வாங்கினீர்கள் அல்லது எதற்குப் பணம் கொடுத்தீர்கள், எவ்வளவு. தினமும் ஒரே நேரத்தில் செய்தால், அது பழக்கமாகிவிடும். நடக்கும்போதே எழுதுவது இன்னும் நல்லது, ஏனென்றால் சிறிய தொகைகள் எளிதில் மறந்துபோகும்.",
              ),
            },
          ],
          keyPoints: [
            L(
              "For every sale and every expense, write the date, what it was, and the amount.",
              "ஒவ்வொரு விற்பனைக்கும் ஒவ்வொரு செலவுக்கும் தேதி, அது என்ன, தொகை — மூன்றையும் எழுதுங்கள்.",
            ),
            L("Write small amounts too; they add up.", "சிறிய தொகைகளையும் எழுதுங்கள்; அவை சேர்ந்து பெரிதாகும்."),
          ],
          checkQuestion: L(
            "What three things would you write for each sale or expense?",
            "ஒவ்வொரு விற்பனைக்கும் செலவுக்கும் எந்த மூன்று விஷயங்களை எழுதுவீர்கள்?",
          ),
        },
        {
          id: "dbb-daily-total",
          title: L("What is left at the end of the day", "நாள் முடிவில் மீதம் எவ்வளவு"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "To see how the day went, add up all the sales, add up all the expenses, then take the expenses away from the sales. Sales minus expenses is what is left that day. If sales were ₹600 and expenses were ₹250, ₹350 is left.",
                "நாள் எப்படிப் போனது என்று பார்க்க, எல்லா விற்பனையையும் கூட்டுங்கள், எல்லாச் செலவையும் கூட்டுங்கள், பிறகு விற்பனையிலிருந்து செலவைக் கழியுங்கள். விற்பனை கழித்தல் செலவு — அதுதான் அன்று மீதம் இருப்பது. விற்பனை ₹600, செலவு ₹250 என்றால், ₹350 மீதம்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "Think of a water pot. Sales are the water you pour in; expenses are the water you take out. What is still in the pot at night is what is left from the day. If you take out more than you pour in, the pot gets emptier — that day, more went out than came in.",
                "ஒரு தண்ணீர்க் குடத்தை நினைத்துப் பாருங்கள். விற்பனை என்பது குடத்தில் ஊற்றும் தண்ணீர்; செலவு என்பது வெளியே எடுக்கும் தண்ணீர். இரவில் குடத்தில் மீதம் இருப்பதுதான் அன்றைய மீதம். ஊற்றியதைவிட அதிகமாக எடுத்தால் குடம் குறையும் — அன்று வந்ததைவிட அதிகமாகப் போயிருக்கிறது.",
              ),
            },
            {
              approach: "step_by_step",
              text: L(
                "Step one: add the sales — say ₹200 in the morning and ₹180 in the evening, so ₹380. Step two: add the expenses — say ₹100 for vegetables and ₹20 for bags, so ₹120. Step three: take the expenses away from the sales: 380 minus 120 is 260. So ₹260 is left that day.",
                "முதல் படி: விற்பனையைக் கூட்டுங்கள் — காலையில் ₹200, மாலையில் ₹180 என்றால், மொத்தம் ₹380. இரண்டாம் படி: செலவைக் கூட்டுங்கள் — காய்கறிக்கு ₹100, பைகளுக்கு ₹20 என்றால், மொத்தம் ₹120. மூன்றாம் படி: விற்பனையிலிருந்து செலவைக் கழியுங்கள் — 380 கழித்தல் 120 என்றால் 260. எனவே அன்று ₹260 மீதம்.",
              ),
            },
          ],
          keyPoints: [
            L("What is left that day = total sales − total expenses.", "அன்றைய மீதம் = மொத்த விற்பனை − மொத்தச் செலவு."),
            L(
              "This is a simple daily picture. Some things you buy last many days, so one day's number does not tell the whole story.",
              "இது ஒரு நாளின் எளிய கணக்கு மட்டுமே. நீங்கள் வாங்கும் சில பொருட்கள் பல நாட்களுக்குப் பயன்படும்; அதனால் ஒரு நாளின் எண் முழுக் கதையையும் சொல்லாது.",
            ),
          ],
          checkQuestion: L(
            "If sales were ₹300 and expenses were ₹100, what is left that day?",
            "விற்பனை ₹300, செலவு ₹100 என்றால், அன்று மீதம் எவ்வளவு?",
          ),
        },
      ],
      practice: [
        {
          id: "dbb-01-what-to-write",
          conceptId: "dbb-record-daily",
          kind: "explain",
          prompt: L(
            "Selvi sells murukku. Today she sold 6 packets for ₹180 in total, and she bought a bottle of oil for ₹90. What should she write in her notebook for the sale and for the expense?",
            "செல்வி முறுக்கு விற்கிறார். இன்று மொத்தம் ₹180-க்கு 6 பாக்கெட்டுகள் விற்றார், ₹90-க்கு ஒரு பாட்டில் எண்ணெய் வாங்கினார். விற்பனைக்கும் செலவுக்கும் அவர் தன் குறிப்பேட்டில் என்ன எழுத வேண்டும்?",
          ),
          hints: [L("For each one: the date, what it was, and how much.", "ஒவ்வொன்றுக்கும்: தேதி, அது என்ன, எவ்வளவு.")],
          modelAnswer: L(
            "Today's date. Sale: 6 packets of murukku, ₹180. Expense: oil, ₹90.",
            "இன்றைய தேதி. விற்பனை: 6 பாக்கெட் முறுக்கு, ₹180. செலவு: எண்ணெய், ₹90.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "writes-date",
                kind: "terms",
                description: L("Includes the date", "தேதியைச் சேர்க்கிறது"),
                terms: terms(["date", "today", "day"], ["தேதி", "இன்று", "இன்றைய", "நாள்"]),
              },
              {
                id: "writes-what",
                kind: "terms",
                description: L("Says what it was (murukku sold, oil bought)", "அது என்ன என்று சொல்கிறது (விற்ற முறுக்கு, வாங்கிய எண்ணெய்)"),
                terms: terms(
                  ["murukku", "packet", "oil", "item", "what she sold", "what she bought", "bottle"],
                  ["முறுக்கு", "பாக்கெட்", "எண்ணெய்", "பொருள்", "பாட்டில்", "என்ன விற்", "என்ன வாங்"],
                ),
              },
              {
                id: "writes-amount",
                kind: "terms",
                description: L("Includes the amount in rupees", "ரூபாயில் தொகையைச் சேர்க்கிறது"),
                terms: terms(
                  ["180", "90", "amount", "rupee", "rs", "price", "how much", "money"],
                  ["180", "90", "தொகை", "ரூபாய்", "எவ்வளவு", "விலை", "பணம்"],
                ),
              },
            ],
            requiredForCorrect: ["writes-date", "writes-what", "writes-amount"],
            feedback: {
              correct: L(
                "Yes. The date, what it was and the amount, for both the sale and the oil. Anyone could read those lines and understand them.",
                "ஆமாம். விற்பனைக்கும் எண்ணெய்க்கும் — தேதி, அது என்ன, தொகை. அந்த வரிகளைப் படிக்கும் யாருக்கும் புரியும்.",
              ),
              partial: L(
                "Good start. One of the three is missing — check that you have the date, what it was, and the amount.",
                "நல்ல தொடக்கம். மூன்றில் ஒன்று விடுபட்டுள்ளது — தேதி, அது என்ன, தொகை மூன்றும் இருக்கிறதா என்று பாருங்கள்.",
              ),
              needs_practice: L(
                "Let's build it together. For the sale: when was it, what was sold, and for how much? Then do the same for the oil.",
                "சேர்ந்து அமைப்போம். விற்பனைக்கு: எப்போது, என்ன விற்றார், எவ்வளவுக்கு? பிறகு எண்ணெய்க்கும் அதையே செய்யுங்கள்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "dbb-01-daily-total",
          conceptId: "dbb-daily-total",
          kind: "calculation",
          prompt: L(
            "Today Revathi's sales came to ₹450 and her expenses came to ₹170. How much is left for the day?",
            "இன்று ரேவதியின் விற்பனை ₹450, செலவு ₹170. அன்று மீதம் எவ்வளவு?",
          ),
          hints: [
            L("Take the expenses away from the sales.", "விற்பனையிலிருந்து செலவைக் கழியுங்கள்."),
            L("What is 450 minus 170?", "450 கழித்தல் 170 என்ன?"),
          ],
          modelAnswer: L("₹280, because ₹450 − ₹170 = ₹280.", "₹280, ஏனென்றால் ₹450 − ₹170 = ₹280."),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "left-280",
                kind: "numeric",
                description: L("What is left for the day is ₹280", "அன்றைய மீதம் ₹280"),
                expected: 280,
                tolerance: 0,
                commonMistakes: [
                  {
                    value: 620,
                    explanation: L(
                      "It looks like the sales and expenses were added together. Expenses are money going out, so take them away from the sales.",
                      "விற்பனையையும் செலவையும் கூட்டியது போலத் தெரிகிறது. செலவு என்பது வெளியே போகும் பணம்; அதனால் அதை விற்பனையிலிருந்து கழிக்க வேண்டும்.",
                    ),
                  },
                  {
                    value: 320,
                    explanation: L(
                      "It looks like a small slip in the subtraction. Try it in two steps: 450 minus 100 is 350, then 350 minus 70.",
                      "கழித்தலில் ஒரு சிறிய தவறு போலத் தெரிகிறது. இரண்டு படிகளாகச் செய்து பாருங்கள்: 450 கழித்தல் 100 என்றால் 350, பிறகு 350 கழித்தல் 70.",
                    ),
                  },
                ],
              },
            ],
            requiredForCorrect: ["left-280"],
            feedback: {
              correct: L("Correct: ₹450 − ₹170 = ₹280 left for the day.", "சரி: ₹450 − ₹170 = அன்று ₹280 மீதம்."),
              partial: L("Nearly. Check the subtraction once more.", "கிட்டத்தட்ட சரி. கழித்தலை இன்னொரு முறை சரிபாருங்கள்."),
              needs_practice: L(
                "Not quite. To find what is left, take the total expenses away from the total sales.",
                "சரியாக இல்லை. மீதத்தைக் கண்டுபிடிக்க, மொத்த விற்பனையிலிருந்து மொத்தச் செலவைக் கழியுங்கள்.",
              ),
              ungraded: NUMBER_NOT_HEARD,
            },
          },
        },
      ],
      realWorldAction: L(
        "For the next three days, write down every amount you spend or receive — even ₹10. At night, add up each side and see what is left.",
        "அடுத்த மூன்று நாட்களுக்கு, நீங்கள் செலவழிக்கும் அல்லது பெறும் ஒவ்வொரு தொகையையும் — ₹10 ஆனாலும் — எழுதுங்கள். இரவில் இரண்டு பக்கத்தையும் கூட்டி, மீதம் எவ்வளவு என்று பாருங்கள்.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "dbb-02",
      sequence: 2,
      title: L("Checking a digital payment safely", "டிஜிட்டல் பணத்தைப் பாதுகாப்பாகச் சரிபார்ப்பது"),
      objective: L(
        "Confirm that a payment has really arrived by checking your own app or account, and keep your PIN and OTP to yourself.",
        "உங்கள் சொந்த ஆப் அல்லது வங்கிக் கணக்கில் பார்த்து, பணம் உண்மையில் வந்ததா என்று உறுதி செய்வது; உங்கள் PIN, OTP-ஐ யாரிடமும் சொல்லாமல் இருப்பது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [
        L(
          "Payment-safety guidance is general and educational. It needs review by someone with digital-payments or financial-literacy training before wider deployment.",
          "பணப் பாதுகாப்பு பற்றிய வழிகாட்டல் பொதுவானது, கற்றலுக்கானது. பரவலாகப் பயன்படுத்துவதற்கு முன், டிஜிட்டல் பணப் பரிவர்த்தனை அல்லது நிதி அறிவுப் பயிற்சி பெற்ற ஒருவரால் சரிபார்க்கப்பட வேண்டும்.",
        ),
      ],
      concepts: [
        {
          id: "dbb-confirm-payment",
          title: L("Check your own app or account", "உங்கள் சொந்த ஆப்பில் அல்லது கணக்கில் பாருங்கள்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "When a customer pays you digitally, the money has arrived only when you can see it in your own trusted payment app, or in your own bank account or statement. A screenshot, or a message someone shows you or forwards to you, is not enough on its own. Pictures and messages can be made to look real.",
                "ஒரு வாடிக்கையாளர் டிஜிட்டல் முறையில் பணம் கொடுக்கும்போது, உங்கள் சொந்த நம்பகமான பேமெண்ட் ஆப்பிலோ, உங்கள் வங்கிக் கணக்கிலோ ஸ்டேட்மெண்டிலோ அதைப் பார்த்தால்தான் பணம் வந்திருக்கிறது. ஒருவர் காட்டும் அல்லது அனுப்பும் ஸ்கிரீன்ஷாட்டோ மெசேஜோ மட்டும் போதாது. படங்களையும் மெசேஜ்களையும் உண்மையானது போலத் தோன்றும்படி செய்ய முடியும்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "It is like being paid in cash. You count the notes in your own hand — you don't just trust someone who says, 'I've put it in your bag.' With digital money, your own app or account is your hand.",
                "இது ரொக்கமாகப் பணம் வாங்குவது போன்றது. நோட்டுகளை உங்கள் கையிலேயே எண்ணிப் பார்க்கிறீர்கள் — 'உங்கள் பையில் வைத்துவிட்டேன்' என்று ஒருவர் சொல்வதை மட்டும் நம்புவதில்லை. டிஜிட்டல் பணத்துக்கு, உங்கள் சொந்த ஆப் அல்லது கணக்குதான் உங்கள் கை.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A buyer forwards you a message that says '₹500 credited to your account' and asks you to hand over the goods. Before you do, open your own payment app or check your own bank account. If the ₹500 is not there, the payment has not arrived yet — whatever the message says.",
                "'உங்கள் கணக்கில் ₹500 வரவு வைக்கப்பட்டது' என்று ஒரு மெசேஜை வாங்குபவர் உங்களுக்கு அனுப்பி, பொருளைக் கொடுக்கச் சொல்கிறார். கொடுப்பதற்கு முன், உங்கள் சொந்த பேமெண்ட் ஆப்பைத் திறந்து பாருங்கள், அல்லது உங்கள் வங்கிக் கணக்கைச் சரிபாருங்கள். அங்கே ₹500 இல்லையென்றால், மெசேஜ் என்ன சொன்னாலும், பணம் இன்னும் வரவில்லை.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Money has arrived only when you see it in your own trusted app or account.",
              "உங்கள் சொந்த நம்பகமான ஆப்பிலோ கணக்கிலோ பார்த்தால்தான் பணம் வந்திருக்கிறது.",
            ),
            L(
              "A screenshot or a message someone shows you is not proof on its own.",
              "ஒருவர் காட்டும் ஸ்கிரீன்ஷாட்டோ மெசேஜோ மட்டும் ஆதாரம் ஆகாது.",
            ),
          ],
          checkQuestion: L(
            "Where would you look to be sure a customer's payment has arrived?",
            "வாடிக்கையாளரின் பணம் வந்துவிட்டது என்று உறுதியாகத் தெரிந்துகொள்ள எங்கே பார்ப்பீர்கள்?",
          ),
        },
        {
          id: "dbb-pin-otp",
          title: L("Your PIN and OTP stay with you", "PIN, OTP உங்களிடம் மட்டுமே"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "To receive money, you never need to enter your PIN or share an OTP. A PIN is used to approve money going out of your account. An OTP is a one-time code that shows it is really you. Never share your PIN or OTP with anyone — not a customer, not a friend, and not someone who says they are from a bank or a payment app.",
                "பணம் பெறுவதற்கு, உங்கள் PIN-ஐப் போடவோ OTP-ஐச் சொல்லவோ ஒருபோதும் தேவையில்லை. உங்கள் கணக்கிலிருந்து பணம் வெளியே போவதை அனுமதிக்கத்தான் PIN பயன்படுகிறது. OTP என்பது, அது உண்மையில் நீங்கள்தான் என்று காட்டும், ஒரு முறை மட்டுமே பயன்படும் குறியீடு. உங்கள் PIN-ஐயோ OTP-ஐயோ யாரிடமும் சொல்லாதீர்கள் — வாடிக்கையாளரிடமும் வேண்டாம், நண்பரிடமும் வேண்டாம், வங்கியிலிருந்தோ பேமெண்ட் ஆப்பிலிருந்தோ பேசுவதாகச் சொல்பவரிடமும் வேண்டாம்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "Your PIN is like the key to your house. Someone who wants to give you a gift can hand it to you at the door — they never need your key. If someone asks for your key so they can 'give' you something, stop there.",
                "உங்கள் PIN உங்கள் வீட்டுச் சாவி போன்றது. உங்களுக்குப் பரிசு கொடுக்க விரும்புபவர் வாசலிலேயே கொடுக்கலாம் — அவருக்கு உங்கள் சாவி ஒருபோதும் தேவையில்லை. உங்களுக்கு ஏதோ 'கொடுப்பதற்காக' ஒருவர் சாவியைக் கேட்டால், அங்கேயே நிறுத்துங்கள்.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A buyer says: 'I've sent you a request — just enter your PIN and the ₹600 will come to you.' That is not how receiving works. Entering your PIN would approve a payment from your account. Say no, and ask the buyer to send the money in the usual way.",
                "ஒரு வாங்குபவர் சொல்கிறார்: 'உங்களுக்கு ஒரு ரிக்வெஸ்ட் அனுப்பியிருக்கிறேன் — உங்கள் PIN-ஐப் போட்டால் ₹600 உங்களுக்கு வந்துவிடும்.' பணம் பெறுவது அப்படி இல்லை. PIN போட்டால், உங்கள் கணக்கிலிருந்து பணம் போவதை அனுமதித்ததாகிவிடும். மறுத்துவிடுங்கள்; வழக்கமான முறையில் பணத்தை அனுப்பச் சொல்லுங்கள்.",
              ),
            },
          ],
          keyPoints: [
            L("You never need a PIN or OTP to receive money.", "பணம் பெற PIN-ஓ OTP-ஓ ஒருபோதும் தேவையில்லை."),
            L(
              "Never share your PIN or OTP with anyone, even someone who says they are from a bank or app.",
              "வங்கியிலிருந்தோ ஆப்பிலிருந்தோ பேசுவதாகச் சொன்னாலும், உங்கள் PIN, OTP-ஐ யாரிடமும் சொல்லாதீர்கள்.",
            ),
            L(
              "If you are worried, end the call and contact your bank yourself, at the branch or on a number you already trust.",
              "சந்தேகமாக இருந்தால், அழைப்பைத் துண்டித்துவிட்டு, நீங்களே வங்கிக் கிளைக்குப் போயோ, உங்களுக்கு ஏற்கனவே நம்பகமாகத் தெரிந்த எண்ணிலோ வங்கியைத் தொடர்புகொள்ளுங்கள்.",
            ),
          ],
          checkQuestion: L(
            "Do you need your PIN to receive money from a customer?",
            "வாடிக்கையாளரிடமிருந்து பணம் பெற உங்கள் PIN தேவையா?",
          ),
        },
      ],
      practice: [
        {
          id: "dbb-02-screenshot",
          conceptId: "dbb-confirm-payment",
          kind: "decide",
          prompt: L(
            "A customer buys a box of sweets from you for ₹250. She shows you a screenshot on her phone that says 'Payment successful', and says she is in a hurry. What should you do before she leaves, and why?",
            "ஒரு வாடிக்கையாளர் உங்களிடம் ₹250-க்கு ஒரு பெட்டி இனிப்பு வாங்குகிறார். 'பணம் வெற்றிகரமாக அனுப்பப்பட்டது' என்று காட்டும் ஒரு ஸ்கிரீன்ஷாட்டைத் தன் போனில் காட்டி, அவசரமாகப் போக வேண்டும் என்கிறார். அவர் போவதற்கு முன் நீங்கள் என்ன செய்ய வேண்டும், ஏன்?",
          ),
          hints: [
            L(
              "Where does the money actually arrive — on her phone, or in your account?",
              "பணம் உண்மையில் எங்கே வந்து சேரும் — அவர் போனிலா, உங்கள் கணக்கிலா?",
            ),
          ],
          modelAnswer: L(
            "Check my own payment app or bank account to see that ₹250 has arrived. A screenshot on her phone is not proof that the money reached me.",
            "₹250 வந்திருக்கிறதா என்று என் சொந்த பேமெண்ட் ஆப்பிலோ வங்கிக் கணக்கிலோ பார்ப்பேன். அவர் போனில் உள்ள ஸ்கிரீன்ஷாட், பணம் எனக்கு வந்ததற்கு ஆதாரம் ஆகாது.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "check-own",
                kind: "terms",
                description: L(
                  "Checks in their own payment app or bank account",
                  "தன் சொந்த பேமெண்ட் ஆப்பில் அல்லது வங்கிக் கணக்கில் சரிபார்க்கிறது",
                ),
                terms: terms(
                  ["own", "my app", "my account", "my phone", "my bank", "my payment", "bank account", "statement", "balance", "arrived", "received"],
                  ["சொந்த", "என் ஆப்", "என் கணக்", "என் போன்", "என் வங்கி", "வங்கிக் கணக்", "ஸ்டேட்மெண்ட்", "பேலன்ஸ்", "இருப்பு", "வந்திருக்கிறதா", "வந்ததா"],
                ),
              },
              {
                id: "not-proof",
                kind: "terms",
                description: L("Says a screenshot alone is not proof", "ஸ்கிரீன்ஷாட் மட்டும் ஆதாரம் ஆகாது என்று சொல்கிறது"),
                terms: terms(
                  ["not proof", "no proof", "not enough", "fake", "can't trust", "cant trust", "cannot trust", "not trust", "edited", "not real"],
                  ["ஆதாரம் இல்லை", "ஆதாரம் ஆகாது", "போதாது", "போலி", "நம்ப முடியாது", "நம்பக் கூடாது", "நம்பக்கூடாது", "உண்மையானது இல்லை"],
                ),
              },
            ],
            requiredForCorrect: ["check-own"],
            feedback: {
              correct: L(
                "Yes. Check your own app or account before she leaves. Her screen alone does not show that the money reached you.",
                "ஆமாம். அவர் போவதற்கு முன் உங்கள் சொந்த ஆப்பிலோ கணக்கிலோ பாருங்கள். அவர் போன் திரை மட்டும், பணம் உங்களுக்கு வந்ததைக் காட்டாது.",
              ),
              partial: L(
                "You're right to be careful. Now say where you would check: your own payment app or bank account.",
                "கவனமாக இருப்பது சரி. இப்போது எங்கே சரிபார்ப்பீர்கள் என்று சொல்லுங்கள்: உங்கள் சொந்த பேமெண்ட் ஆப் அல்லது வங்கிக் கணக்கு.",
              ),
              needs_practice: L(
                "Being polite to a customer in a hurry is kind. But that screen is on her phone, not in your account. Before she leaves, look for the ₹250 in your own app or account.",
                "அவசரத்தில் இருக்கும் வாடிக்கையாளரிடம் மரியாதையாக இருப்பது நல்லதுதான். ஆனால் அந்தத் திரை அவர் போனில் இருக்கிறது, உங்கள் கணக்கில் இல்லை. அவர் போவதற்கு முன், உங்கள் சொந்த ஆப்பிலோ கணக்கிலோ ₹250 வந்ததா என்று பாருங்கள்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "dbb-02-otp-call",
          conceptId: "dbb-pin-otp",
          kind: "decide",
          prompt: L(
            "You get a phone call. The caller says: 'I'm calling from your bank. A customer has sent you ₹2,000. To receive it, tell me the OTP you just got.' What do you do, and why?",
            "உங்களுக்கு ஒரு போன் அழைப்பு வருகிறது. பேசுபவர் சொல்கிறார்: 'உங்கள் வங்கியிலிருந்து பேசுகிறேன். ஒரு வாடிக்கையாளர் உங்களுக்கு ₹2,000 அனுப்பியிருக்கிறார். அதைப் பெற, இப்போது வந்த OTP-ஐச் சொல்லுங்கள்.' நீங்கள் என்ன செய்வீர்கள், ஏன்?",
          ),
          hints: [L("Do you ever need an OTP to receive money?", "பணம் பெற எப்போதாவது OTP தேவைப்படுமா?")],
          modelAnswer: L(
            "I would not share the OTP, and I would end the call. You never need to share an OTP to receive money, even if the caller says they are from the bank. If I'm worried, I'll contact my bank myself.",
            "OTP-ஐச் சொல்ல மாட்டேன், அழைப்பைத் துண்டித்துவிடுவேன். வங்கியிலிருந்து பேசுவதாகச் சொன்னாலும், பணம் பெற OTP-ஐச் சொல்ல ஒருபோதும் தேவையில்லை. சந்தேகமாக இருந்தால், நானே என் வங்கியைத் தொடர்புகொள்வேன்.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "refuses",
                kind: "terms",
                description: L("Refuses to share the OTP or ends the call", "OTP-ஐச் சொல்ல மறுக்கிறது அல்லது அழைப்பைத் துண்டிக்கிறது"),
                terms: terms(
                  ["not share", "won't", "wont", "will not", "never", "refuse", "hang up", "end the call", "cut the call", "don't tell", "dont tell", "not tell", "don't give", "not give", "don't share", "dont share"],
                  ["சொல்ல மாட்டேன்", "சொல்லமாட்டேன்", "பகிர மாட்டேன்", "கொடுக்க மாட்டேன்", "மாட்டேன்", "சொல்லக் கூடாது", "சொல்லக்கூடாது", "துண்டி", "மறுத்து", "மறுப்பேன்"],
                ),
              },
              {
                id: "gives-reason",
                kind: "terms",
                description: L(
                  "Explains that an OTP is never needed to receive money",
                  "பணம் பெற OTP ஒருபோதும் தேவையில்லை என்று விளக்குகிறது",
                ),
                terms: terms(
                  ["receive", "not need", "don't need", "no need", "never need", "not needed", "scam", "fraud", "cheat"],
                  ["பெற", "தேவையில்லை", "தேவை இல்லை", "கேட்க மாட்டார்கள்", "மோசடி", "ஏமாற்"],
                ),
              },
            ],
            requiredForCorrect: ["refuses"],
            feedback: {
              correct: L(
                "That's the safe choice. No one needs your OTP to send you money, whoever they say they are.",
                "அதுதான் பாதுகாப்பான முடிவு. யார் என்று சொல்லிக்கொண்டாலும், உங்களுக்குப் பணம் அனுப்ப யாருக்கும் உங்கள் OTP தேவையில்லை.",
              ),
              partial: L(
                "You've spotted that something is wrong. Now say clearly what you would do: not share the OTP, and end the call.",
                "ஏதோ தவறு என்று கண்டுபிடித்துவிட்டீர்கள். இப்போது என்ன செய்வீர்கள் என்று தெளிவாகச் சொல்லுங்கள்: OTP-ஐச் சொல்ல மாட்டேன், அழைப்பைத் துண்டிப்பேன்.",
              ),
              needs_practice: L(
                "Please don't share it. To receive money you never need an OTP, even if the caller says they are from your bank. End the call, and contact your bank yourself if you are worried.",
                "தயவுசெய்து அதைச் சொல்லாதீர்கள். பேசுபவர் வங்கியிலிருந்து என்று சொன்னாலும், பணம் பெற OTP ஒருபோதும் தேவையில்லை. அழைப்பைத் துண்டியுங்கள்; சந்தேகமாக இருந்தால் நீங்களே உங்கள் வங்கியைத் தொடர்புகொள்ளுங்கள்.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Next time someone pays you digitally, find that payment in your own app or account before you hand anything over. You could also tell one family member: no one needs your PIN or OTP to send you money.",
        "அடுத்த முறை ஒருவர் உங்களுக்கு டிஜிட்டல் முறையில் பணம் அனுப்பும்போது, எதையும் கொடுப்பதற்கு முன் உங்கள் சொந்த ஆப்பிலோ கணக்கிலோ அந்தப் பணத்தை நீங்களே பாருங்கள். ஒரு குடும்ப உறுப்பினரிடமும் சொல்லலாம்: உங்களுக்குப் பணம் அனுப்ப யாருக்கும் உங்கள் PIN-ஓ OTP-ஓ தேவையில்லை.",
      ),
    },
    // ---------------------------------------------------------------------
    {
      id: "dbb-03",
      sequence: 3,
      title: L("Orders and customer details", "ஆர்டர்களும் வாடிக்கையாளர் விவரங்களும்"),
      objective: L(
        "Write a simple order record, and collect only the customer details the order needs.",
        "ஒரு எளிய ஆர்டர் பதிவை எழுதுவது; ஆர்டருக்குத் தேவையான வாடிக்கையாளர் விவரங்களை மட்டுமே கேட்பது.",
      ),
      estimatedMinutes: 15,
      reviewStatus: "team_authored",
      reviewFlags: [],
      concepts: [
        {
          id: "dbb-order-record",
          title: L("A simple order record", "எளிய ஆர்டர் பதிவு"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "When a customer orders something, write five things straight away: their name, what they want, how many, when they need it, and whether they have paid. With these five written down, you don't have to rely on memory.",
                "ஒரு வாடிக்கையாளர் ஏதாவது ஆர்டர் செய்யும்போது, உடனே ஐந்து விஷயங்களை எழுதுங்கள்: அவர் பெயர், என்ன வேண்டும், எத்தனை, எப்போது வேண்டும், பணம் கொடுத்தாரா இல்லையா. இந்த ஐந்தும் எழுதியிருந்தால், நினைவை மட்டும் நம்பியிருக்க வேண்டியதில்லை.",
              ),
            },
            {
              approach: "everyday_example",
              text: L(
                "A tailor's order book might say: 'Lakshmi — 2 blouses — ready by Thursday — ₹100 advance paid, ₹300 still to pay.' When Lakshmi comes on Thursday, the tailor knows exactly what to hand over and how much to collect.",
                "ஒரு தையல்காரரின் ஆர்டர் புத்தகத்தில் இப்படி இருக்கலாம்: 'லட்சுமி — 2 ரவிக்கை — வியாழனுக்குள் தயார் — ₹100 முன்பணம் கொடுத்தார், ₹300 பாக்கி.' வியாழக்கிழமை லட்சுமி வரும்போது, எதைக் கொடுப்பது, எவ்வளவு வாங்குவது என்று தையல்காரருக்குச் சரியாகத் தெரியும்.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "When an order comes in, ask yourself five quick questions. Who is it for? What do they want? How many? When? Paid, or not yet? If your note answers all five, it is complete.",
                "ஒரு ஆர்டர் வந்ததும், உங்களையே ஐந்து சிறிய கேள்விகள் கேளுங்கள். யாருக்கு? என்ன வேண்டும்? எத்தனை? எப்போது? பணம் கொடுத்தாரா, இன்னும் இல்லையா? உங்கள் குறிப்பு இந்த ஐந்துக்கும் பதில் சொன்னால், அது முழுமையானது.",
              ),
            },
          ],
          keyPoints: [
            L("An order record: name, what, how many, when, paid or not.", "ஆர்டர் பதிவு: பெயர், என்ன, எத்தனை, எப்போது, பணம் கொடுத்தாரா இல்லையா."),
            L("Write it down when the order comes in, not later.", "ஆர்டர் வந்தவுடனே எழுதுங்கள், பிறகு அல்ல."),
          ],
          checkQuestion: L(
            "What five things would you write when someone places an order?",
            "ஒருவர் ஆர்டர் கொடுக்கும்போது எந்த ஐந்து விஷயங்களை எழுதுவீர்கள்?",
          ),
        },
        {
          id: "dbb-only-needed",
          title: L("Collect only what you need", "தேவையானதை மட்டும் கேளுங்கள்"),
          explanations: [
            {
              approach: "plain",
              text: L(
                "Ask only for the details the order really needs. Usually that is a name and a phone number, and an address only if you deliver. You don't need a customer's Aadhaar number, bank details or other private information to take an order. Keep your order book or phone notes private, and don't share customers' details with others.",
                "ஆர்டருக்கு உண்மையில் தேவையான விவரங்களை மட்டுமே கேளுங்கள். பொதுவாக ஒரு பெயர், ஒரு போன் நம்பர் போதும்; வீட்டுக்குக் கொண்டு போய்க் கொடுப்பதாக இருந்தால் மட்டும் முகவரி. ஆர்டர் எடுக்க வாடிக்கையாளரின் ஆதார் எண், வங்கி விவரங்கள், அல்லது வேறு தனிப்பட்ட தகவல்கள் தேவையில்லை. உங்கள் ஆர்டர் புத்தகத்தையோ போன் குறிப்புகளையோ தனிப்பட்டதாக வைத்திருங்கள்; வாடிக்கையாளர்களின் விவரங்களை மற்றவர்களிடம் பகிராதீர்கள்.",
              ),
            },
            {
              approach: "analogy",
              text: L(
                "Think of a guest coming to your home. You ask their name and how they are — you don't ask to see their bank passbook. A customer is similar: ask what you need to serve them well, and nothing more.",
                "உங்கள் வீட்டுக்கு ஒரு விருந்தினர் வருவதை நினைத்துப் பாருங்கள். அவர் பெயரைக் கேட்பீர்கள், நலம் விசாரிப்பீர்கள் — அவருடைய வங்கிப் பாஸ்புக்கைக் காட்டச் சொல்ல மாட்டீர்கள். வாடிக்கையாளரும் அப்படித்தான்: அவருக்கு நன்றாகச் சேவை செய்யத் தேவையானதை மட்டும் கேளுங்கள், அதற்கு மேல் வேண்டாம்.",
              ),
            },
            {
              approach: "question_led",
              text: L(
                "Before asking for any detail, ask yourself: do I need this to make the order, deliver it, or get paid for it? If the answer is no, don't ask. Less information also means less to keep safe.",
                "எந்த விவரத்தையும் கேட்பதற்கு முன் உங்களையே கேளுங்கள்: இந்த ஆர்டரைச் செய்யவோ, கொண்டு போய்க் கொடுக்கவோ, பணம் வாங்கவோ இது எனக்குத் தேவையா? இல்லை என்றால், கேட்காதீர்கள். குறைவான தகவல் என்றால், பாதுகாக்க வேண்டியதும் குறைவு.",
              ),
            },
          ],
          keyPoints: [
            L(
              "Ask only for what the order needs: usually a name, a phone number, and an address if you deliver.",
              "ஆர்டருக்குத் தேவையானதை மட்டும் கேளுங்கள்: பொதுவாகப் பெயர், போன் நம்பர், கொண்டு போய்க் கொடுப்பதாக இருந்தால் முகவரி.",
            ),
            L(
              "You don't need Aadhaar numbers, bank details or other private information to take an order.",
              "ஆர்டர் எடுக்க ஆதார் எண், வங்கி விவரங்கள், வேறு தனிப்பட்ட தகவல்கள் தேவையில்லை.",
            ),
            L("Keep customers' details private.", "வாடிக்கையாளர் விவரங்களைத் தனிப்பட்டதாக வைத்திருங்கள்."),
          ],
          checkQuestion: L(
            "Before you ask a customer for a detail, what question can you ask yourself?",
            "வாடிக்கையாளரிடம் ஒரு விவரத்தைக் கேட்பதற்கு முன், உங்களையே என்ன கேள்வி கேட்கலாம்?",
          ),
        },
      ],
      practice: [
        {
          id: "dbb-03-order-record",
          conceptId: "dbb-order-record",
          kind: "explain",
          prompt: L(
            "Priya calls you. She wants 3 packets of ragi laddu, she will collect them on Sunday morning, and she will pay when she collects. Say the order record you would write.",
            "பிரியா உங்களை அழைக்கிறார். அவருக்கு 3 பாக்கெட் ராகி லட்டு வேண்டும்; ஞாயிறு காலை வந்து வாங்கிக்கொள்வார்; வாங்கும்போது பணம் கொடுப்பார். நீங்கள் எழுதும் ஆர்டர் பதிவைச் சொல்லுங்கள்.",
          ),
          hints: [L("Name, what, how many, when, paid or not.", "பெயர், என்ன, எத்தனை, எப்போது, பணம் கொடுத்தாரா இல்லையா.")],
          modelAnswer: L(
            "Priya — 3 packets of ragi laddu — Sunday morning — not paid yet, will pay on collection.",
            "பிரியா — 3 பாக்கெட் ராகி லட்டு — ஞாயிறு காலை — இன்னும் பணம் கொடுக்கவில்லை, வாங்கும்போது கொடுப்பார்.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "has-name",
                kind: "terms",
                description: L("Includes the customer's name (Priya)", "வாடிக்கையாளர் பெயரைச் சேர்க்கிறது (பிரியா)"),
                terms: terms(["priya"], ["பிரியா"]),
              },
              {
                id: "has-what",
                kind: "terms",
                description: L("Says what and how many (3 packets of ragi laddu)", "என்ன, எத்தனை என்று சொல்கிறது (3 பாக்கெட் ராகி லட்டு)"),
                terms: terms(["laddu", "ladoo", "ladu", "ragi", "three", "3", "packet"], ["லட்டு", "ராகி", "கேழ்வரகு", "மூன்று", "3", "பாக்கெட்"]),
              },
              {
                id: "has-when",
                kind: "terms",
                description: L("Says when (Sunday morning)", "எப்போது என்று சொல்கிறது (ஞாயிறு காலை)"),
                terms: terms(["sunday", "morning"], ["ஞாயிறு", "ஞாயிற்று", "காலை"]),
              },
              {
                id: "has-paid",
                kind: "terms",
                description: L("Says she has not paid yet", "இன்னும் பணம் கொடுக்கவில்லை என்று சொல்கிறது"),
                terms: terms(
                  ["not paid", "unpaid", "pay later", "will pay", "when she collect", "on collection", "due", "pending", "to pay", "not yet"],
                  ["கொடுக்கவில்லை", "செலுத்தவில்லை", "பாக்கி", "நிலுவை", "வாங்கும்போது", "பிறகு", "இன்னும் இல்லை", "கொடுப்பார்"],
                ),
              },
            ],
            requiredForCorrect: ["has-name", "has-what", "has-when", "has-paid"],
            feedback: {
              correct: L(
                "Complete: the name, what and how many, when, and that she hasn't paid yet. On Sunday you'll know exactly what to hand over, and that payment is still due.",
                "முழுமையாக இருக்கிறது: பெயர், என்ன, எத்தனை, எப்போது, இன்னும் பணம் கொடுக்கவில்லை என்பது. ஞாயிறன்று எதைக் கொடுக்க வேண்டும், பணம் இன்னும் வர வேண்டும் என்பது உங்களுக்குச் சரியாகத் தெரியும்.",
              ),
              partial: L(
                "Good start. Something is missing — check for the name, what and how many, when, and whether she has paid.",
                "நல்ல தொடக்கம். ஏதோ ஒன்று விடுபட்டுள்ளது — பெயர், என்ன, எத்தனை, எப்போது, பணம் கொடுத்தாரா என்று சரிபாருங்கள்.",
              ),
              needs_practice: L(
                "Let's build it with five questions: who is it for, what do they want, how many, when, and have they paid?",
                "ஐந்து கேள்விகளோடு சேர்ந்து அமைப்போம்: யாருக்கு, என்ன வேண்டும், எத்தனை, எப்போது, பணம் கொடுத்தாரா?",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
        {
          id: "dbb-03-only-needed",
          conceptId: "dbb-only-needed",
          kind: "decide",
          prompt: L(
            "Rani delivers vegetables to homes. For a new customer, she is thinking of asking for: name, phone number, delivery address, Aadhaar number and monthly income. Which does she need, and which should she not ask for?",
            "ராணி வீடுகளுக்குக் காய்கறி கொண்டு போய்க் கொடுக்கிறார். ஒரு புதிய வாடிக்கையாளரிடம் இவற்றைக் கேட்கலாம் என்று நினைக்கிறார்: பெயர், போன் நம்பர், வீட்டு முகவரி, ஆதார் எண், மாத வருமானம். இவற்றில் அவருக்கு எது தேவை, எதைக் கேட்கக் கூடாது?",
          ),
          hints: [
            L(
              "For each one, ask: does Rani need this to deliver the vegetables and get paid?",
              "ஒவ்வொன்றுக்கும் கேளுங்கள்: காய்கறியைக் கொண்டு போய்க் கொடுக்கவும் பணம் வாங்கவும் ராணிக்கு இது தேவையா?",
            ),
          ],
          modelAnswer: L(
            "She needs the name, phone number and delivery address. She should not ask for the Aadhaar number or monthly income — the order doesn't need them.",
            "பெயர், போன் நம்பர், வீட்டு முகவரி தேவை. ஆதார் எண்ணையும் மாத வருமானத்தையும் கேட்கக் கூடாது — ஆர்டருக்கு அவை தேவையில்லை.",
          ),
          rubric: {
            mode: "auto",
            criteria: [
              {
                id: "keeps-needed",
                kind: "terms",
                description: L("Keeps what delivery needs (name, phone, address)", "டெலிவரிக்குத் தேவையானதை வைக்கிறது (பெயர், போன், முகவரி)"),
                terms: terms(["name", "phone", "mobile", "address", "contact"], ["பெயர்", "போன்", "மொபைல்", "முகவரி", "தொலைபேசி", "கைபேசி"]),
                minMatches: 2,
              },
              {
                id: "drops-private",
                kind: "terms",
                description: L("Says Aadhaar and income are not needed", "ஆதாரும் வருமானமும் தேவையில்லை என்று சொல்கிறது"),
                terms: terms(
                  ["not need", "don't need", "dont need", "do not need", "no need", "not ask", "shouldn't ask", "should not", "not required", "unnecessary", "not necessary", "private"],
                  ["தேவையில்லை", "தேவை இல்லை", "கேட்கக் கூடாது", "கேட்கக்கூடாது", "வேண்டாம்", "அவசியமில்லை", "அவசியம் இல்லை", "கேட்க மாட்டேன்", "தனிப்பட்ட"],
                ),
              },
            ],
            requiredForCorrect: ["keeps-needed", "drops-private"],
            feedback: {
              correct: L(
                "Yes. Name, phone and address are enough to deliver. Aadhaar and income are private, and the order doesn't need them.",
                "ஆமாம். கொண்டு போய்க் கொடுக்க பெயர், போன், முகவரி போதும். ஆதாரும் வருமானமும் தனிப்பட்டவை; ஆர்டருக்கு அவை தேவையில்லை.",
              ),
              partial: L(
                "Part of the way there. Say both: what Rani needs for delivery, and which details she should leave out.",
                "பாதி சரி. இரண்டையும் சொல்லுங்கள்: கொண்டு போய்க் கொடுக்க ராணிக்கு எது தேவை, எந்த விவரங்களைக் கேட்கக் கூடாது.",
              ),
              needs_practice: L(
                "Go through the list one by one and ask: does Rani need this to deliver vegetables and get paid? Aadhaar and monthly income are private and not needed for an order.",
                "பட்டியலை ஒவ்வொன்றாகப் பார்த்துக் கேளுங்கள்: காய்கறியைக் கொண்டு போய்க் கொடுக்கவும் பணம் வாங்கவும் ராணிக்கு இது தேவையா? ஆதார் எண்ணும் மாத வருமானமும் தனிப்பட்டவை, ஆர்டருக்குத் தேவையில்லை.",
              ),
              ungraded: OPEN_UNGRADED,
            },
          },
        },
      ],
      realWorldAction: L(
        "Set aside one page in a notebook, or one note on your phone, for orders. Write the next order — or a practice one — with the five details, and nothing more private than you need.",
        "ஒரு நோட்டுப் புத்தகத்தில் ஒரு பக்கத்தையோ, போனில் ஒரு குறிப்பையோ ஆர்டர்களுக்காக ஒதுக்குங்கள். அடுத்த ஆர்டரை — அல்லது ஒரு பயிற்சி ஆர்டரை — அந்த ஐந்து விவரங்களுடன் எழுதுங்கள்; தேவைக்கு மேல் தனிப்பட்ட தகவல் வேண்டாம்.",
      ),
    },
  ],
};
