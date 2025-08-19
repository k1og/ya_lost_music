import Redis from 'ioredis'
import { config } from './config'
import { PlaylistInfo } from './types'

export const redis = new Redis(config.databaseUrl)

const getUsernameDatabaseKey = (tgChatId: string) => `ya_music_username_${tgChatId}`
const getTracksInfoDatabaseKey = (yaMusicUsername: string) => `ya_music_tracks_${yaMusicUsername}`

export const getUsername = async (tgChatId: string) => {
    return await redis.get(getUsernameDatabaseKey(tgChatId))
}

export const getTracksInfo = async (username: string) => {
    return await redis.get(getTracksInfoDatabaseKey(username))
}

export const deleteUsersInfo = async (tgChatId: string, username: string) => {
    await redis.del(getUsernameDatabaseKey(tgChatId))
    await redis.del(getTracksInfoDatabaseKey(username))
}

export const setTracksInfo = async (username: string, tracks: PlaylistInfo['tracks']) => {
    await redis.set(getTracksInfoDatabaseKey(username), JSON.stringify(tracks))
}

export const setUsername = async (tgChatId: string, username: string) => {
    await redis.set(getUsernameDatabaseKey(tgChatId), username)
}

export const getAllUsernameKeys = async () => {
    return await redis.keys(getUsernameDatabaseKey('*'))
}

export const getChatIdByUsernameKey = (usernameKey: string) => {
    if (!usernameKey.startsWith(getUsernameDatabaseKey(''))) {
        return null
    }
    return usernameKey.replace(getUsernameDatabaseKey(''), '')
}
