# Callvi voice demo

For the hackathon exercise, use the [customer-call demo](PROMPT_WAR.md). For the longer business course below, open the configured service or [localhost](http://localhost:3000/). Choose Tamil and allow microphone access. A fresh browser profile starts a new learner. Use the same profile for the return call.

## A short, real learning session

The featured course is **Small Business Starter / சிறு தொழில் தொடக்கம்**. Its first lesson takes a learner from a vague business idea to a clear offer, a first customer group and an explanation of the customer's need. The following lessons cover costs and a customer role-play. Everything is spoken; no typed onboarding is required.

1. Tap **கால்வியுடன் பேசுங்கள்**. Callvi briefly explains the service and asks what would help today. You can ask what the service does or say you are not ready; this should not launch a lesson.
2. When ready, give a goal: “வீட்டுல முறுக்கு செஞ்சு எங்க தெருவில விக்க கத்துக்கணும். இப்போ கத்துக்க ஆரம்பிக்கலாம்.” Answer memory permission honestly when asked. For the saved-progress demo: “ஆமா, நினைவில் வச்சுக்கோங்க.” Confirm the goal, then choose the small-business course when offered.
3. Try asking “புரியல, இன்னும் சிம்பிளா ஒரு example சொல்லுங்க.” Callvi should change its explanation, not grade that request as an answer.
4. Answer in your own words. For example, “வீட்டுல முறுக்கு செஞ்சு பக்கத்து குடும்பங்களுக்கு விப்பேன்.” The app assesses the actual answer; it does not award automatic success. An incomplete answer should get one missing-detail question.
5. Continue if time permits. The next task asks whether Kala should sell idli batter to everyone or begin with nearby working families, and why. The following task asks what difficulty ready-made batter solves.
6. Say “இன்னிக்கு போதும். விட்ட இடத்தை save பண்ணிட்டு call-ஐ முடிச்சிடுங்க.” Wait for the saved confirmation and call ending.
7. In the same browser, tap **கால்வியுடன் தொடருங்கள்**. The call still asks what you need today. Say “போன தடவை விட்ட lesson-ஐ இப்போ தொடரலாம்.” Callvi should retrieve the real stopping point and teach the next idea. Merely calling back or saying hello must not start teaching.

You can interrupt or ask to slow down. These are live AI responses, so exact wording varies. The End control closes the session too. Progress is saved only after consent. An anonymous profile does not follow someone across devices.

## What is real

Speech generation and recognition use ElevenLabs. The application owns consent, curriculum, rubric-based assessment and checkpoints; production stores them in Supabase. The blue orb and call states follow the voice SDK. The voice is Janani, selected for native Tamil–English conversation; Tamil is intentionally colloquial and uses familiar English words lightly.

The content is authored by the project team, not certified training. The app does not promise earnings, place orders, contact customers, recommend a particular selling price, or offer live phone-number calling. A passing scripted regression does not guarantee every accent, background-noise condition or open-ended answer will work identically.
