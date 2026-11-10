import { legalPage } from './legal-page';

export function privacyPage(): string {
  return legalPage(
    'Auto Post AI privacy policy',
    `
    <p>Effective 10 November 2026. This policy describes what Auto Post AI stores when you use the WhatsApp assistant and the studio at studio.alzahaby.cloud.</p>
    <h2>Who we are</h2>
    <p>Auto Post AI is operated by Primal VR Technologies. Questions about this policy go to <a href="mailto:primalvrtech@gmail.com">primalvrtech@gmail.com</a>.</p>
    <h2>Data we store</h2>
    <ul>
      <li>Your WhatsApp phone number and profile name</li>
      <li>The briefs, edits, and button replies you send</li>
      <li>The headline, caption, hashtags, call to action, and preview image we generate</li>
      <li>Your brand profile: name, industry, website, color, logo, description, and tone</li>
      <li>The Facebook Page id, Instagram account id, and access token you connect, stored encrypted</li>
      <li>Publish status, scheduled time, and error text for each post</li>
    </ul>
    <h2>How we use it</h2>
    <p>We use that data to draft posts, show them to you for approval, and publish them to the Facebook Page and Instagram account you connected. A model provider may process the brief to write the caption. A design provider may process the caption to make the preview image.</p>
    <h2>How long we keep it</h2>
    <p>We keep the account and its posts until you delete them, or until we close the account. Published copies remain on Facebook and Instagram until you remove them there.</p>
    <h2>Deletion</h2>
    <p>From the same WhatsApp number, send <strong>delete my data</strong>. Instructions are also at <a href="/data-deletion">the data deletion page</a>.</p>
    <p>The <a href="/terms">terms of service</a> explain the rules for using Auto Post AI.</p>
    `,
  );
}
