import schedule from 'node-schedule'
import TelegramBot from "node-telegram-bot-api";
import { getAllUsers, getUserByChatId, createUser, updateTracksInfo, updateUsername } from "./db";
import { timeStringToHourMinute, getUsernameFromProfileUrl, getPlaylistInfo, generateRandomTimeString, checkForPlaylistChanges } from "./utils";

export const scheduleNotificationForUser = (bot: TelegramBot, tgChatId: string, time: string) => {
    const [hour, minute] = timeStringToHourMinute(time)
    schedule.scheduleJob({ rule: `${minute} ${hour} * * *`, tz: 'Etc/UTC' }, () => {
        checkCommand(bot, tgChatId)
    })
};

export const rescheduleNotificationsAfterRestart = async (bot: TelegramBot) => {
    try {
        const users = await getAllUsers()

        users.forEach((user) => {
            scheduleNotificationForUser(bot, user.id, user.timeToNotify)
        })
        console.log('Notifications rescheduled')
    } catch (error) {
        console.error('Error during notification reschedule', error)
    }
}

export const registerCommand = async (bot: TelegramBot, msg: TelegramBot.Message) => {
    const tgChatId = msg.chat.id
    try {
        const username = getUsernameFromProfileUrl(msg.text!)
        const playlist = await getPlaylistInfo(username)

        const user = await getUserByChatId(tgChatId.toString())
        const isRegisteredUser = !!user

        const timeToNotify = generateRandomTimeString()
        if (!isRegisteredUser) {
            await createUser({ id: tgChatId.toString(), username, tracksInfo: playlist.tracks, timeToNotify })
            scheduleNotificationForUser(bot, tgChatId.toString(), timeToNotify)
        } else {
            await updateUsername(tgChatId.toString(), username)
        }
        const successMessage = isRegisteredUser ? `Успешно перерегистрировано` : `Успешно зарегистрировано`
        await bot.sendMessage(tgChatId, successMessage + `\nПроверка будет происходить в по ${isRegisteredUser ? user.timeToNotify : timeToNotify} UTC. Так же вы можете использовать команду /check`)
    } catch (error) {
        await bot.sendMessage(tgChatId, error)
    }
}

export const checkCommand = async (bot: TelegramBot, tgChatId: string) => {
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

export const startCommand = async (bot: TelegramBot, tgChatId: string) => {
    await bot.sendMessage(
        tgChatId, 
        'Отправьте ссылку на ваш профиль в Яндекс Музыке в формате https://music.yandex.ru/users/<USERNAME>/playlists\n' +
        '(Публичный доступ к фонотеке должен быть включен)'
    )
}