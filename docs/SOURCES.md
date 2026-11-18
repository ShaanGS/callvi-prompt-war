# Technical and research references

Accessed 4 November 2026. Confirm pricing, plan access, number allocation, service availability and API behaviour in the team's actual provider accounts before implementation or presentation.

## Voice infrastructure

- Sarvam browser Web SDK: https://docs.sarvam.ai/voice-agents/deploy/sdks/web
  - Official TypeScript `ConversationAgent` and `BrowserAudioInterface` integration, session lifecycle, callbacks, microphone permissions and server-side API-key proxy guidance. Verify the current SDK contract before implementing.

- Sarvam Voice Agents overview: https://docs.sarvam.ai/voice-agents/introduction
  - Managed platform for building, testing, deploying and monitoring voice agents; supports phone number deployment and provider integrations.
- Sarvam Voice Agents quickstart: https://docs.sarvam.ai/voice-agents/quickstart
  - Agent creation, prompt, language/voice selection, testing and deployment to a phone number.
- Sarvam deploy with code: https://docs.sarvam.ai/voice-agents/deploy/deploy-with-code
  - API, WebSocket and TypeScript/Python SDK integration; keep credentials server-side.
- Sarvam runtime architecture: https://docs.sarvam.ai/voice-agents/build/run-time
  - Listen/think/speak loop, harness, turn-taking, interruption handling and transport separation.
- Sarvam voice-agent models: https://docs.sarvam.ai/voice-agents/build/models
  - Saaras speech recognition, Bulbul speech synthesis, managed LLM orchestration and current BYO-model limitation.
- Sarvam voice-agent tools: https://docs.sarvam.ai/voice-agents/build/tools
  - Global/state-level tools and context control.
- Sarvam API tool: https://docs.sarvam.ai/voice-agents/build/tools/https-tool
  - External API callbacks, on-start/on-end lifecycle tools, caller identifier, transcript and interaction ID.
- Sarvam real-time streaming STT: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/realtime-streaming
  - WebSocket partial transcripts and Tamil language code support.
- Sarvam Bulbul v4 Flash TTS best practices: https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/best-practices
  - Tamil support, streaming output and telephony-oriented considerations.

## Alternative custom real-time voice path (future option)

- OpenAI Realtime API: https://developers.openai.com/api/docs/guides/realtime
- OpenAI telephony and SIP: https://developers.openai.com/api/docs/guides/voice-sip
  - SIP or an application audio bridge can connect phone calls to a real-time voice model. This is an alternative architecture, not the selected default for the Tamil-first MVP.

## Literature starting point from the team's poster

- Cole, Joshi & Schoar (2024), “Heuristics on Call”, *The World Bank Economic Review*, 38(3), 580–597.
  - The team's poster cites this as evidence that phone-based business training improved business practices but did not establish higher sales or profits. Consult the full paper before presenting detailed findings or extrapolating outcomes.
