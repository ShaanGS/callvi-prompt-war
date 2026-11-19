// Callvi imports sarvam-conv-ai-sdk only through its browser entry, which maps
// `speaker` to false. This stub replaces the native module (GHSA-w5fc-gj3h-26rx,
// no fixed version) so nothing vulnerable is installed. If anything ever does
// load it, fail loudly rather than silently play no audio.
throw new Error("The native speaker module is not available in Callvi; use the browser SDK entry.");
