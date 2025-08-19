import { Config } from "./types";

export const config: Config = {
    databaseUrl: process.env.DB_URL || 'postgres://dm:dm@127.0.0.1:5432/dm_dev?sslmode=disable',
    tgBotToken: process.env.TG_BOT_TOKEN || ''
}
