import TelegramBot from 'node-telegram-bot-api'
import schedule from 'node-schedule'
import 'reflect-metadata'
import { config } from './config';
import { waitForDbInitialization } from './db';
import { profileUrlRegex } from './utils';
import { rescheduleNotificationsAfterRestart, startCommand, registerCommand, checkCommand } from './commands';

const bootstrap = async () => {
    await waitForDbInitialization()

    const bot = new TelegramBot(config.tgBotToken, {polling: true});
    
    await rescheduleNotificationsAfterRestart(bot)

    bot.on('message', async (msg, _metadata) => {
        if (msg.text === '/start') {
            await startCommand(bot, msg.chat.id.toString())

            return
        }

        const isRegisterCommand = !!(msg.text && profileUrlRegex.test(msg.text))
        if (isRegisterCommand) {
            await registerCommand(bot, msg)

            return
        }

        if (msg.text === '/check') {
            await checkCommand(bot, msg.chat.id.toString())

            return
        }
    })
}

bootstrap()

process.on('SIGINT', function () { 
    console.log('gracefulShutdown')
    schedule.gracefulShutdown()
    .then(() => process.exit(0))
})
