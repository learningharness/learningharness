import { For } from 'solid-js';
import { setupGuide } from './setup-guide.js';
export function SetupGuide(props: { host: string }) {
  const guide = () => setupGuide(props.host);
  return <section class="dd-setup" aria-label="LearningHarness setup"><h2>{guide().title}</h2><ol><For each={guide().steps}>{step => <li>{step}</li>}</For></ol><p>{guide().returnHint}</p><small>Memory stays on this device. Learning uses your existing host connection and allowance. Anonymous usage metadata is on by default; you can switch it off in Learn settings. Selected work and learner context are sent to your host’s model for learning.</small></section>;
}
