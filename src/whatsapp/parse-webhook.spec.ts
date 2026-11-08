import { parseButtonId, parseWebhook, readHubQuery } from './parse-webhook';

const textPayload = {
  entry: [
    {
      changes: [
        {
          value: {
            contacts: [{ wa_id: '15551230000', profile: { name: 'Lina' } }],
            messages: [
              {
                from: '15551230000',
                id: 'wamid.1',
                type: 'text',
                text: { body: '20% off whitening' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('parseWebhook', () => {
  it('reads a text brief and the sender profile name', () => {
    expect(parseWebhook(textPayload)).toEqual([
      {
        messageId: 'wamid.1',
        from: '15551230000',
        name: 'Lina',
        kind: 'text',
        text: '20% off whitening',
      },
    ]);
  });

  it('reads an approval button and ignores delivery statuses', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [{ id: 'wamid.1', status: 'delivered' }],
                messages: [
                  {
                    from: '15551230000',
                    id: 'wamid.2',
                    type: 'interactive',
                    interactive: {
                      type: 'button_reply',
                      button_reply: { id: 'approve:post_1', title: 'Approve' },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseWebhook(payload)).toEqual([
      {
        messageId: 'wamid.2',
        from: '15551230000',
        name: undefined,
        kind: 'button',
        buttonId: 'approve:post_1',
      },
    ]);
    expect(parseWebhook({ entry: [{ changes: [{ value: { statuses: [{ status: 'read' }] } }] }] })).toEqual([]);
  });

  it('parses button ids and hub challenge query params', () => {
    expect(parseButtonId('edit:clh123abc')).toEqual({ action: 'edit', postId: 'clh123abc' });
    expect(parseButtonId('nope')).toBeNull();
    expect(readHubQuery({ 'hub.mode': 'subscribe', 'hub.verify_token': 't', 'hub.challenge': '99' })).toEqual({
      mode: 'subscribe',
      token: 't',
      challenge: '99',
    });
  });
});
