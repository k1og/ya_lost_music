import TelegramBot from 'node-telegram-bot-api'
import axios from 'axios'
import schedule from 'node-schedule'
import 'reflect-metadata'
import { config } from './config';
import { createUser, getAllUsers, getUserByChatId, updateTracksInfo } from './db';
import { TrackInfo, PlaylistInfo, PlaylistChanges } from './types';

// TODO:
// const rule = new schedule.RecurrenceRule();
// rule.hour = 14
// rule.minute = 0
// rule.tz = 'Etc/UTC'

// const job = schedule.scheduleJob(rule, async () => {
//     const usernameKeys = await getAllUsers()
//     usernameKeys.forEach(async (usernameKey: string) => {
//         const tgChatId = getChatIdByUsernameKey(usernameKey)
//         if (!tgChatId) {
//             return
//         }
//         await checkForChanges(tgChatId)
//     })
// });

const checkForChanges = async (tgChatId: string) => {
    try {
        const user = await getUserByChatId(tgChatId)
        if (!user) {
            await bot.sendMessage(tgChatId, `Вы не зарегистрировали профиль`)
            return 
        }
        const oldTracksInfo = user.tracksInfo
        const newTracksInfo = (await getPlaylistInfo(user.username)).tracks
        const { deletedTracksStrings, newTracksStrings } = await checkForPlaylistChanges(oldTracksInfo, newTracksInfo)

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

const token = config.tgBotToken

const bot = new TelegramBot(token, {polling: true});

const profileUrlRegex = /https:\/\/music\.yandex\.ru\/users\/.*?\/playlists/

const getPlaylistInfoUrl = (username: string) => `https://music.yandex.ru/handlers/playlist.jsx?owner=${username}&kinds=3`

const trackInfoToString = (track: TrackInfo) => {
    const { artists, albums, title } = track
    const artistsName = artists.map(artist => artist.name).join(', ')
    const albumsName = albums.map(album => album.title).join(', ')
    const trackLink = getTrackLink(track)
    return `${artistsName} - ${albumsName} - ${title}\n${trackLink}`
}

const getTrackLink = (track: TrackInfo) => {
    const trackId = track.id;
    const albumId = track.albums.map(albumId => albumId.id).toString()
    return `https://music.yandex.ru/album/${albumId}/track/${trackId}`
}

const getPlaylistInfo = async (username: string): Promise<PlaylistInfo> => {
    const { data } = await axios.get(getPlaylistInfoUrl(username))
    const playlist = data.playlist as PlaylistInfo
    return playlist
}

const checkForPlaylistChanges = async (oldTracksInfo: Array<TrackInfo>, newTracksInfo: Array<TrackInfo>): Promise<PlaylistChanges> => {
    const deletedTracksStrings: Array<string> = []
    const newTracksStrings: Array<string> = []

    oldTracksInfo.forEach(track => {
        const foundIndex = newTracksInfo.findIndex(newTrack => newTrack.id === track.id)

        if (foundIndex !== -1) {
            return
        }

        deletedTracksStrings.push(trackInfoToString(track))
    })

    newTracksInfo.forEach(track => {
        const foundIndex = oldTracksInfo.findIndex(oldTrack => oldTrack.id === track.id)

        if (foundIndex !== -1) {
            return
        }

        newTracksStrings.push(trackInfoToString(track))
    })
    
    return {
        deletedTracksStrings,
        newTracksStrings,
    }
}

bot.on('message', async (msg, _metadata) => {
    if (msg.text === '/start') {
        await bot.sendMessage(
            msg.chat.id, 
            // TODO: update text
            // TODO: make link plain text
            'Отправьте ссылку на ваш профиль в Яндекс Музыке в формате https://music.yandex.ru/users/<USERNAME>/playlists\n' +
            '(Публичный доступ к фонотеке должен быть включен)\n\n' +
            // 'Проверка происходить в 14:00 по UTC. Так же вы можете использовать команду /check \n\n\n' +
            'Фил фри ту контрибьют - https://github.com/k1og/ya_lost_music'
        )

        return
    }

    const isRegisterCommand = !!(msg.text && profileUrlRegex.test(msg.text))
    if (isRegisterCommand) {
        try {
            const username = msg.text!.split('/')[msg.text!.split('/').length - 2]
            const playlist = await getPlaylistInfo(username)
            const tgChatId = msg.chat.id

            const user = await getUserByChatId(tgChatId.toString())
            const isOldUser = !user

            await createUser({ id: tgChatId.toString(), username, tracksInfo: playlist.tracks, timeToNotify: '12:00:00' })
            const successMessage = isOldUser ? `Успешно перерегистрировано` : `Успешно зарегистрировано`
            await bot.sendMessage(msg.chat.id, successMessage)
        } catch (error) {
            await bot.sendMessage(msg.chat.id, error)
        }

        return
    }

    if (msg.text === '/check') {
        const tgChatId = msg.chat.id
        await checkForChanges(tgChatId.toString())

        return
    }
})

process.on('SIGINT', function () { 
    console.log('gracefulShutdown')
    schedule.gracefulShutdown()
    .then(() => process.exit(0))
})
