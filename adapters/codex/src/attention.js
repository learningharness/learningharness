// A browser heartbeat is not evidence that the learner noticed a suggestion.
// Only an explicit close acknowledges the visible invitation here.
export function markPanelVisibility(engine, sessionId, input, now=Date.now()) {
  if (!sessionId || input.closed !== true) return false;
  const session=engine.session(sessionId);
  const goals=session.reviewOffer??session.upcomingGoals??(!session.moment?session.goals:null);
  if (goals?.id && !session.seenOpportunityIds?.includes(goals.id)) session.seenOpportunityIds=[...(session.seenOpportunityIds??[]),goals.id].slice(-100);
  if (input.closed===true) session.nudgeSuppressedUntil=now+300000;
  return true;
}
