// Native work-following entry points need selected public work or explicit focus.
// The general teaching engine can also serve callers with their own lesson context.
export function requireWorkContext(session){
 if(session?.hasWorkContext||session?.learningFocus?.trim()||session?.context?.codingOpening?.text||session?.workSelection?.task||session?.trace?.length)return;
 throw Error('I have not received task details yet. Add a focus in Learn, or wait for the next public activity. Work sent while learning was Off is not captured.');
}
