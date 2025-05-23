export const sendTelegramMessage = async ({
  message,
  botToken,
  chatId,
}: {
  message: string,
  botToken: string,
  chatId: string
}) => {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'MarkdownV2', // Enable Telegram's MarkdownV2 formatting
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Telegram API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`);
  }
  
  return response.ok;
};
