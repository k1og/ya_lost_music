import TelegramBot from 'node-telegram-bot-api'
import Redis from 'ioredis'
import axios from 'axios'
// import schedule from 'node-schedule'
import { config } from './config';

const redis = new Redis(config.databaseUrl)

const token = config.tgBotToken

const bot = new TelegramBot(token, {polling: true});

const profileUrlRegex = /https:\/\/music\.yandex\.ru\/users\/.*?\/playlists/

const getPlaylistInfoUrl = (username: string) => `https://music.yandex.ru/handlers/playlist.jsx?owner=${username}&kinds=3`

type ArtistInfo = {
    name: string
}
type AlbumInfo = {
    title: string
}

type TrackInfo = {
    id: string
    artists: Array<ArtistInfo>
    albums: Array<AlbumInfo>
    title: string
}

type PlaylistInfo = {
    tracks: Array<TrackInfo>
}

type PlaylistChanges = {
    deletedTracksStrings: Array<string>
    newTracksStrings: Array<string>
}

const trackInfoToString = (track: TrackInfo) => {
    const { artists, albums, title } = track
    const artistsName = artists.map(artist => artist.name).join(', ')
    const albumsName = albums.map(album => album.title).join(', ')
    return `${artistsName} - ${albumsName} - ${title}`
}

const getPlaylistInfo = async (username: string): Promise<PlaylistInfo> => {
    const { data } = await axios.get(getPlaylistInfoUrl(username))
    const playlist = data.playlist as PlaylistInfo
    return playlist
}

const checkForChanges = async (oldTracksInfo: Array<TrackInfo>, newTracksInfo: Array<TrackInfo>): Promise<PlaylistChanges> => {
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
            'Я з**бався терять песни, из-за того, что кнопки переключения треков находятся рядом с кнопками "Нравится" и "Не рекомендовать"\n' +
            'Я просто мискликаю, не замечая этого и всё, прощай, песенка, я даже не вспомню о твоем существовании\n' +
            'Поэтому вместо того, чтобы РАБотать, написал бота, который трекает изменения содержимого в плейлисте "Мне нравится"\n\n' +
            // TODO: make link plain text
            'Отправьте ссылку на ваш профиль в Яндекс Музыке в формате https://music.yandex.ru/users/<USERNAME>/playlists\n' +
            '(Публичный доступ к фонотеке должен быть включен)\n\n' +
            'P.S. Оно работает медленно для больших плейлистов, может когда-нибудь у меня дойдут руки до оптимизации.\n' +
            'Но, если что, фил фри ту контрибьют - https://github.com/k1og/ya_lost_music'
        )

        return
    }

    const isRegisterCommand = !!(msg.text && profileUrlRegex.test(msg.text))
    if (isRegisterCommand) {
        const username = msg.text!.split('/')[msg.text!.split('/').length - 1 - 1]
        try {
            const playlist = await getPlaylistInfo(username)
            const oldUsername = await redis.get(msg.chat.id.toString())

            if (oldUsername) {
                await redis.del(msg.chat.id.toString())
                await redis.del(oldUsername)
            }
            
            await redis.set(msg.chat.id.toString(), username)
            await redis.set(username, JSON.stringify(playlist.tracks))
            const successMessage = oldUsername ? `Успешно перерегистрировано` : `Успешно зарегистрировано`
            await bot.sendMessage(msg.chat.id, successMessage)
        } catch (error) {
            await bot.sendMessage(msg.chat.id, error)
        }

        return
    }

    if (msg.text === '/check') {
        try {
            const username = await redis.get(msg.chat.id.toString())
            if (!username) {
                await bot.sendMessage(msg.chat.id, `Вы не зарегистрировали профиль`)
                return 
            }
            const tracksString = await redis.get(username)
            if (!tracksString) {
                throw new Error('TODO: add meaningful error')
            }
            const oldTracksInfo = JSON.parse(tracksString) as Array<TrackInfo>
            const newTracksInfo = (await getPlaylistInfo(username)).tracks
            const { deletedTracksStrings, newTracksStrings } = await checkForChanges(oldTracksInfo, newTracksInfo)

            if (!deletedTracksStrings.length && !newTracksStrings.length) {
                await bot.sendMessage(msg.chat.id, `Никаких изменений`)
            }

            if (deletedTracksStrings.length) {
                await bot.sendMessage(msg.chat.id, `Удаленные треки:\n ${deletedTracksStrings.join('\n')}`)
            }

            if (newTracksStrings.length) {
                await bot.sendMessage(msg.chat.id, `Новые треки:\n ${newTracksStrings.join('\n')}`)
            }

            await redis.set(username, JSON.stringify(newTracksInfo))

        } catch (error) {
            await bot.sendMessage(msg.chat.id, error)
        }

        return
    }
})