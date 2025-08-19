export type Config = {
    databaseUrl: string
    tgBotToken: string
}

export type ArtistInfo = {
    name: string
}

export type AlbumInfo = {
    id: number
    title: string
}

export type TrackInfo = {
    id: string
    artists: Array<ArtistInfo>
    albums: Array<AlbumInfo>
    title: string
}

export type PlaylistInfo = {
    tracks: Array<TrackInfo>
}

export type PlaylistChanges = {
    deletedTracksStrings: Array<string>
    newTracksStrings: Array<string>
}
