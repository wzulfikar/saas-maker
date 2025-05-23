export const sendSlackMessage = async ({
  message,
  webhookUrl,
  username = 'SaaS Maker',
  icon_emoji = ':robot_face:',
}: {
  message: string,
  webhookUrl: string,
  username?: string,
  icon_emoji?: string
}) => {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
      username,
      icon_emoji,
      mrkdwn: true,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Slack API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
  }
  
  return response.ok;
};
