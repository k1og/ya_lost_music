import axios from "axios";
import { TrackInfo, PlaylistInfo, PlaylistChanges } from "./types";

export const profileUrlRegex = /https:\/\/music\.yandex\.ru\/users\/.*?\/playlists/

export const getPlaylistInfoUrl = (username: string) => `https://music.yandex.ru/handlers/playlist.jsx?owner=${username}&kinds=3`

export const getTrackLink = (track: TrackInfo) => {
    const trackId = track.id;
    const albumId = track.albums.map(albumId => albumId.id).toString()
    return `https://music.yandex.ru/album/${albumId}/track/${trackId}`
}

export const trackInfoToString = (track: TrackInfo) => {
    const { artists, albums, title } = track
    const artistsName = artists.map(artist => artist.name).join(', ')
    const albumsName = albums.map(album => album.title).join(', ')
    const trackLink = getTrackLink(track)
    return `${artistsName} - ${albumsName} - ${title}\n${trackLink}`
}

export const getPlaylistInfo = async (username: string): Promise<PlaylistInfo> => {
    const { data } = await axios.get(getPlaylistInfoUrl(username))
    const playlist = data.playlist as PlaylistInfo
    return playlist
}

export const checkForPlaylistChanges = (oldTracksInfo: Array<TrackInfo>, newTracksInfo: Array<TrackInfo>): PlaylistChanges => {
    const deletedTracksStrings: Array<string> = []
    const newTracksStrings: Array<string> = []
    const newTracksDict = {}
    const oldTracksDict = {}

    newTracksInfo.forEach(track => {
        newTracksDict[track.id] = track
    })

    oldTracksInfo.forEach((track) => {
        if (!newTracksDict[track.id]) {
          deletedTracksStrings.push(trackInfoToString(track))
        }
    })

    oldTracksInfo.forEach(track => {
        oldTracksDict[track.id] = track
    })

    newTracksInfo.forEach(track => {
        if (!oldTracksDict[track.id]) {
            newTracksStrings.push(trackInfoToString(track))
        }
    })
    
    return {
        deletedTracksStrings,
        newTracksStrings,
    }
}

export const randomInteger = (min: number, max: number) => {
  const rand = min + Math.random() * (max + 1 - min);
  return Math.floor(rand);
}

export const generateRandomTimeString = (): string => {
    return `${randomInteger(0, 23)}:${randomInteger(0, 59)}:00`
}
