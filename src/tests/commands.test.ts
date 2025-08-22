
import { describe, it, expect, beforeEach, afterAll, beforeAll, jest, afterEach } from '@jest/globals';
import { db, getUserByChatId, createUser, getAllUsers, updateTracksInfo, waitForDbInitialization, updateUsername } from '../db';
import { User } from '../entities/user.entity';
import { checkCommand, registerCommand, rescheduleNotificationsAfterRestart } from '../commands';
import TelegramBot from 'node-telegram-bot-api';
import { getPlaylistInfoUrl, getUsernameFromProfileUrl } from '../utils';
import schedule from 'node-schedule'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
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
    return waitForDbInitialization();
  })

  beforeEach(async () => {
    await schedule.gracefulShutdown()
    return db.getRepository(User).clear();
  });

  afterAll(async () => {
    await schedule.gracefulShutdown()
    await db.getRepository(User).clear();
    await db.destroy()
  })

    describe('register command',() => {
      const mockHttpHandlers = [
        http.get('https://music.yandex.ru/handlers/playlist.jsx', () => {
          return HttpResponse.json({
              playlist: {
                tracks: []
              }
          })
        }),
      ]

      const mockHttpServer = setupServer(...mockHttpHandlers)
        
      beforeAll(() => mockHttpServer.listen())

      afterAll(() => mockHttpServer.close())

      afterEach(() => mockHttpServer.resetHandlers())

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

    describe('check command', () => {
      const mockHttpHandlers = [
        http.get('https://music.yandex.ru/handlers/playlist.jsx', () => {
          return HttpResponse.json({
              playlist: {
                tracks: [
                  { albums: [{ id: 1, title: 'album'}], artists: [{ name: 'artist' }], id: 'id', title: 'song' },
                  { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' }
                ]
              }
          })
        }),
      ]

      const mockHttpServer = setupServer(...mockHttpHandlers)
        
      beforeAll(() => mockHttpServer.listen())

      afterAll(() => mockHttpServer.close())

      afterEach(() => mockHttpServer.resetHandlers())

      it('not registered', async () => {
        await checkCommand(bot, msg.chat.id.toString())

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(msg.chat.id.toString(), `Вы не зарегистрировали профиль`)
      })

      it('no changes', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [
            { albums: [{ id: 1, title: 'album'}], artists: [{ name: 'artist' }], id: 'id', title: 'song' },
            { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' }
          ],
          timeToNotify: '12:03:00'
        })

        await checkCommand(bot, msg.chat.id.toString())

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(msg.chat.id.toString(), `Никаких изменений`)
      })

      it('deleted tracks', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [
            { albums: [{ id: 1, title: 'album'}], artists: [{ name: 'artist' }], id: 'id', title: 'song' },
            { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' },
            { albums: [{ id: 3, title: 'album3'}], artists: [{ name: 'artist3' }], id: 'id3', title: 'song3' }
          ],
          timeToNotify: '12:03:00'
        })

        await checkCommand(bot, msg.chat.id.toString())

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(
          msg.chat.id.toString(), 
          `Удаленные треки:\nartist3 - album3 - song3\nhttps://music.yandex.ru/album/3/track/id3`
        )
      })

      it('added tracks', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [
            { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' }
          ],
          timeToNotify: '12:03:00'
        })

        await checkCommand(bot, msg.chat.id.toString())

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(1)
        expect(bot.sendMessage).toHaveBeenCalledWith(
          msg.chat.id.toString(), 
          `Новые треки:\nartist - album - song\nhttps://music.yandex.ru/album/1/track/id`
        )
      })

      it('added and deleted tracks', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [
            { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' },
            { albums: [{ id: 4, title: 'album4'}], artists: [{ name: 'artist4' }], id: 'id4', title: 'song4' }
          ],
          timeToNotify: '12:03:00'
        })

        await checkCommand(bot, msg.chat.id.toString())

        expect(bot.sendMessage).toHaveBeenCalled()
        expect(bot.sendMessage).toHaveBeenCalledTimes(2)
        expect(bot.sendMessage).toHaveBeenCalledWith(
          msg.chat.id.toString(), 
          `Новые треки:\nartist - album - song\nhttps://music.yandex.ru/album/1/track/id`
        )
        expect(bot.sendMessage).toHaveBeenCalledWith(
          msg.chat.id.toString(), 
          `Удаленные треки:\nartist4 - album4 - song4\nhttps://music.yandex.ru/album/4/track/id4`
        )
      })

      it('tracks updated in db', async () => {
        await createUser({
          id: msg.chat.id.toString(),
          username: getUsernameFromProfileUrl(msg.text!),
          tracksInfo: [],
          timeToNotify: '12:03:00'
        })

        await checkCommand(bot, msg.chat.id.toString())

        const user = await getUserByChatId(msg.chat.id.toString())

        expect(user?.tracksInfo).toEqual([
          { albums: [{ id: 1, title: 'album'}], artists: [{ name: 'artist' }], id: 'id', title: 'song' },
          { albums: [{ id: 2, title: 'album2'}], artists: [{ name: 'artist2' }], id: 'id2', title: 'song2' }
        ])
      })
    })

    it('reschedule jobs', async () => {
      const newUser1Id = '123'
      const newUser1 = { id: newUser1Id, timeToNotify: '12:00:00', tracksInfo: [], username: 'idk'}

      const newUser2Id = '456'
      const newUser2 = { id: newUser2Id, timeToNotify: '12:00:00', tracksInfo: [], username: 'idk2'}

      await createUser(newUser1);
      await createUser(newUser2);

      await rescheduleNotificationsAfterRestart(bot)

      expect(Object.keys(schedule.scheduledJobs).length).toBe(2)
      // @ts-ignore
      expect(schedule.scheduledJobs[Object.keys(schedule.scheduledJobs)[0]].nextInvocation()._date.toFormat('HH:mm:ss')).toBe('12:00:00')
      // @ts-ignore
      expect(schedule.scheduledJobs[Object.keys(schedule.scheduledJobs)[1]].nextInvocation()._date.toFormat('HH:mm:ss')).toBe('12:00:00')
    })
})