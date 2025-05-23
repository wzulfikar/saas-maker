import { sendSlackMessage } from "./helpers/sendSlackMessage"
import { sendTelegramMessage } from "./helpers/sendTelegramMessage"

type Notifier = 'SLACK' | 'TELEGRAM'

type NotifierOptions = {
  icon?: string
}

const DEFAULT_USERNAME = 'SaaS Maker'
const DEFAULT_ICON_SLACK = ':robot_face:'

/**
 * Send message to site admin
 */
const notifyAdmin = async (message: string): Promise<void> => {
  const { notifier, notifierName, notifierSecret, notifierOptions } = notifyAdmin

  if (!notifier) {
    throw new Error('Notifier not set. Please set the SAAS_MAKER_NOTIFIER environment variable.')
  }
  if (!notifierSecret) {
    throw new Error('Notifier secret not set. Please set the SAAS_MAKER_NOTIFIER_SECRET environment variable.')
  }

  switch (notifier) {
    case 'SLACK': {
      await sendSlackMessage({
        message,
        webhookUrl: notifierSecret,
        username: notifierName ?? DEFAULT_USERNAME,
        icon_emoji: notifierOptions.icon ?? DEFAULT_ICON_SLACK,
      })
      break
    }
    case 'TELEGRAM': {
      // For Telegram, notifierSecret should be in format: "botToken:chatId"
      const [botToken, chatId] = notifierSecret.split(':')
      if (!botToken || !chatId) {
        throw new Error('Telegram notifier secret must be in format: "botToken:chatId"')
      }
      await sendTelegramMessage({
        message,
        botToken,
        chatId,
      })
      break
    }
  }
}

notifyAdmin.notifier = process.env.SAAS_MAKER_NOTIFIER as Notifier | undefined
notifyAdmin.notifierName = process.env.SAAS_MAKER_NOTIFIER_NAME || DEFAULT_USERNAME
notifyAdmin.notifierOptions = {} as NotifierOptions
/**
 * Secret string to authenticate with the notifier. For Slack, this will be the webhook URL.
 */
notifyAdmin.notifierSecret = process.env.SAAS_MAKER_NOTIFIER_SECRET

export { notifyAdmin }
