// Model generation is asynchronous; short UI bridge calls have separate deadlines.
export const EXPERIENCE_TIMEOUT_MS=5*60*1000;
export const EXPERIENCE_POLL_TIMEOUT_MS=EXPERIENCE_TIMEOUT_MS+15000;
