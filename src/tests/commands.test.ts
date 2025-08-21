
import { describe, it, expect, beforeEach, afterAll, beforeAll, jest, afterEach } from '@jest/globals';
import { db, getUserByChatId, createUser, getAllUsers, updateTracksInfo, waitForDbInitialization, updateUsername } from '../db';
import { User } from '../entities/user.entity';
import { registerCommand } from '../commands';
import TelegramBot from 'node-telegram-bot-api';
import { getPlaylistInfoUrl, getUsernameFromProfileUrl } from '../utils';
import schedule from 'node-schedule'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

export const mockHttpHandlers = [
  http.get('https://music.yandex.ru/handlers/playlist.jsx', () => {
    return HttpResponse.json({
        playlist: {
          tracks: []
        }
    })
  }),
]

const mockHttpServer = setupServer(...mockHttpHandlers)

const bot = {
  sendMessage: jest.fn<(chatId: string, message: string) => Promise<void>>().mockResolvedValue(),
} as unknown as TelegramBot;

const msg = {
  chat: {
    id: 12345678
  },
  text: `https://music.yandex.ru/users/johndoe/playlists`
} as unknown as TelegramBot.Message;


describe('Bot commands', () => {
  beforeAll(() => {
    mockHttpServer.listen();
    return waitForDbInitialization();
  })

  beforeEach(async () => {
    await schedule.gracefulShutdown()
    return db.getRepository(User).clear();
  });

  afterAll(async () => {
    mockHttpServer.close()
    await schedule.gracefulShutdown()
    await db.getRepository(User).clear();
    await db.destroy()
  })

  afterEach(() => mockHttpServer.resetHandlers())
    describe('register command',() => {
      it('check if user is registered', async () => {
        await registerCommand(bot, msg)
        const user = await getUserByChatId(msg.chat.id.toString());
        const scheduledJobNextInvocation = schedule.scheduledJobs[Object.keys(schedule.scheduledJobs)[0]].nextInvocation()
        
        expect(user).toEqual({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [],
          // @ts-ignore
          timeToNotify: `${scheduledJobNextInvocation._date.toFormat('HH:mm:ss')}`
        })
      })

      it('check if new user is not registered if already exist', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [],
          timeToNotify: '12:03:00'
        })

        await registerCommand(bot, msg)
        const users = await getAllUsers()
        expect(users.length).toBe(1)
      })

      it('success registration message has been sent', async () => {
        await registerCommand(bot, msg)
          // @ts-ignore
        const scheduledJobTime = schedule.scheduledJobs[Object.keys(schedule.scheduledJobs)[0]].nextInvocation()._date.toFormat('HH:mm:ss')

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(msg.chat.id, `Успешно зарегистрировано\nПроверка будет происходить в по ${scheduledJobTime} UTC. Так же вы можете использовать команду /check`)
      })

      it('success reregistration message has been sent', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [],
          timeToNotify: '12:03:00'
        })

        await registerCommand(bot, msg)

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(msg.chat.id, `Успешно перерегистрировано\nПроверка будет происходить в по 12:03:00 UTC. Так же вы можете использовать команду /check`)
      })

      it('notification should be scheduled', async () => {
        await registerCommand(bot, msg)
        expect(Object.keys(schedule.scheduledJobs).length).toBe(1)
      })

      it('notification should not be rescheduled if user already registered', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [],
          timeToNotify: '12:03:00'
        })

        await registerCommand(bot, msg)
        expect(Object.keys(schedule.scheduledJobs).length).toBe(0)
      })

      it('update username if user already registered', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: 'oldusername',
          tracksInfo: [],
          timeToNotify: '12:03:00'
        })

        await registerCommand(bot, msg)
        await updateUsername(msg.chat.id.toString(), 'new username');

        const user = await getUserByChatId(msg.chat.id.toString());
        expect(user!.username).toEqual('new username');
      })
    })

})