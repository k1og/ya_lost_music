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

// type NumberRangeFromZero<L, C extends any[] = [], R = L> = 
//   C['length'] extends L
//       ? R
//       : NumberRangeFromZero<L, [...C, 0], C['length'] | R>

// export type NumberRange<L, H> = L | Exclude<NumberRangeFromZero<H>, NumberRangeFromZero<L>>

// type Hours = NumberRange<0, 23>
// type Minutes = NumberRange<0, 59>
// type Seconds = NumberRange<0, 59>

// export type Time = `${Hours}:${Minutes}:${Seconds}`