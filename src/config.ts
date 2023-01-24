type Config = {
    databaseUrl: string
    tgBotToken: string
}

export const config: Config = {
    databaseUrl: process.env.DB_URL || 'redis://:yamusic@127.0.0.1:6380/0',
    tgBotToken: process.env.TG_BOT_TOKEN || ''
}
