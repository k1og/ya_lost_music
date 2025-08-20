import { config } from './config'
import { DataSource } from "typeorm"
import path from 'path'
import { User } from './entities/user.entity'
import { PlaylistInfo } from './types'

export const db = new DataSource({
    type: "postgres",
    url: config.databaseUrl,
    logging: true,
    entities: [path.join(__dirname, './entities/*.*')],
})

export const waitForDbInitialization = () => new Promise<void>(
  (resolve) => {
    const interval = setInterval(
      () => {
        if (db.isInitialized) {
          clearInterval(interval)
          resolve()
        }
      },
      500
    )
  }
)

db.initialize().then(() => {
    console.log("DB has been initialized!")
}).catch((error) => {
    console.error("Error during DB initialization", error)
})

const userRepository = db.getRepository(User)

export const getUserByChatId = async (tgChatId: string) => {
    return await userRepository.findOneBy({ 
        id: tgChatId
    })
}

export const createUser = async (user: User) => {
    await userRepository.insert(user)
}

export const getAllUsers = async () => {
    return await userRepository.find()
}

export const updateTracksInfo = async (tgChatId: string, tracks: PlaylistInfo['tracks']) => {
    await userRepository.update({ id: tgChatId }, { tracksInfo: tracks })
}
