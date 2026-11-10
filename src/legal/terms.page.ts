import { legalPage } from './legal-page';

export function termsPage(): string {
  return legalPage(
    'Auto Post AI terms of service',
    `
    <p>Effective 10 November 2026. These terms cover the Auto Post AI WhatsApp assistant and the studio at studio.alzahaby.cloud.</p>
    <h2>The service</h2>
    <p>Auto Post AI drafts social posts from messages you send and, after you approve or schedule them, publishes them to a Facebook Page and Instagram account you connect. Access is limited to phone numbers enabled by the operator.</p>
    <h2>Your accounts and content</h2>
    <p>You must own or administer the Facebook Page and Instagram account you connect. You are responsible for the briefs you send and for the posts you approve. Do not request content you do not have the right to publish.</p>
    <h2>Publishing</h2>
    <p>A post goes out only after you approve it or after a time you schedule. Facebook and Instagram can reject a post under their own rules. Auto Post AI does not promise reach, engagement, or that a post will stay online.</p>
    <h2>Availability</h2>
    <p>The service can be interrupted for maintenance, provider outages, or account limits. We can disable a phone number that misuses the service.</p>
    <h2>Contact</h2>
    <p>Primal VR Technologies, <a href="mailto:primalvrtech@gmail.com">primalvrtech@gmail.com</a>.</p>
    <p>Read the <a href="/privacy/whatsapp">privacy policy</a> for what we store and how to delete it.</p>
    `,
  );
}
