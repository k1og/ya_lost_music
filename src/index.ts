import TelegramBot from 'node-telegram-bot-api'
import axios from 'axios'
import schedule from 'node-schedule'
import 'reflect-metadata'
import { config } from './config';
import { createUser, getAllUsers, getUserByChatId, updateTracksInfo, waitForDbInitialization } from './db';
import { getPlaylistInfo, generateRandomTimeString, checkForPlaylistChanges, profileUrlRegex } from './utils';

const scheduleNotificationForUser = (tgChatId: string, time: string) => {
    const [hour, minute] = time.split(':')
    schedule.scheduleJob({ rule: `${minute} ${hour} * * *`, tz: 'Etc/UTC' }, () => {
        checkCommand(tgChatId)
    })
};

const rescheduleNotificationsAfterRestart = async () => {
    try {
        const users = await getAllUsers()

        users.forEach((user) => {
            scheduleNotificationForUser(user.id, user.timeToNotify)
        })
        console.log('Notifications rescheduled')
    } catch (error) {
        console.error('Error during notification reschedule', error)
    }
}

const registerCommand = async (msg: TelegramBot.Message) => {
    try {
        const username = msg.text!.split('/')[msg.text!.split('/').length - 2]
        const playlist = await getPlaylistInfo(username)
        const tgChatId = msg.chat.id

        const user = await getUserByChatId(tgChatId.toString())
        const isOldUser = !user

        const timeToNotify = generateRandomTimeString()
        await createUser({ id: tgChatId.toString(), username, tracksInfo: playlist.tracks, timeToNotify })
        scheduleNotificationForUser(tgChatId.toString(), timeToNotify)
        const successMessage = isOldUser ? `Успешно перерегистрировано` : `Успешно зарегистрировано`
        await bot.sendMessage(msg.chat.id, successMessage + `\nПроверка будет происходить в по ${timeToNotify} UTC. Так же вы можете использовать команду /check`)
    } catch (error) {
        await bot.sendMessage(msg.chat.id, error)
    }
}

const checkCommand = async (tgChatId: string) => {
    try {
        const user = await getUserByChatId(tgChatId)
        if (!user) {
            await bot.sendMessage(tgChatId, `Вы не зарегистрировали профиль`)
            return 
        }
        const oldTracksInfo = user.tracksInfo
        const newTracksInfo = (await getPlaylistInfo(user.username)).tracks
        const { deletedTracksStrings, newTracksStrings } = checkForPlaylistChanges(oldTracksInfo, newTracksInfo)

        if (!deletedTracksStrings.length && !newTracksStrings.length) {
            await bot.sendMessage(tgChatId, `Никаких изменений`)
        }

        if (deletedTracksStrings.length) {
            await bot.sendMessage(tgChatId, `Удаленные треки:\n ${deletedTracksStrings.join('\n')}`)
        }

        if (newTracksStrings.length) {
            await bot.sendMessage(tgChatId, `Новые треки:\n ${newTracksStrings.join('\n')}`)
        }

        await updateTracksInfo(tgChatId, newTracksInfo)

    } catch (error) {
        await bot.sendMessage(tgChatId, error)
    }
}

const startCommand = async (tgChatId: string) => {
    await bot.sendMessage(
        tgChatId, 
        'Отправьте ссылку на ваш профиль в Яндекс Музыке в формате https://music.yandex.ru/users/<USERNAME>/playlists\n' +
        '(Публичный доступ к фонотеке должен быть включен)'
    )
}

const bot = new TelegramBot(config.tgBotToken, {polling: true});

const bootstrap = async () => {
    await waitForDbInitialization()

    await rescheduleNotificationsAfterRestart()

    bot.on('message', async (msg, _metadata) => {
        if (msg.text === '/start') {
            await startCommand(msg.chat.id.toString())

            return
        }

        const isRegisterCommand = !!(msg.text && profileUrlRegex.test(msg.text))
        if (isRegisterCommand) {
            await registerCommand(msg)

            return
        }

        if (msg.text === '/check') {
            await checkCommand(msg.chat.id.toString())

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
