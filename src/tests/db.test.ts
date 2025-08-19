
import { describe, it, expect, beforeEach, afterAll, beforeAll } from '@jest/globals';
import { db, getUserByChatId, createUser, getAllUsers, updateTracksInfo } from '../db';
import { User } from '../entities/user.entity';
import { PlaylistInfo } from '../types';

const waitForDbInitialization = () => new Promise<void>(
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

describe('User Repository', () => {
  beforeAll(() => {
    return waitForDbInitialization()
  })

  beforeEach(() => {
    return db.getRepository(User).clear();
  });

  afterAll(async () => {
    await db.getRepository(User).clear();
    await db.destroy()
  })

  it('should create a user', async () => {
    const newUserId = '123'
    const newUser = { id: newUserId, timeToNotify: '15:20:00', tracksInfo: [], username: 'idk'}
    await createUser(newUser);

    const user = await getUserByChatId(newUserId);
    console.log(user)
    expect(user).toEqual(newUser);
  });

  it('should create a user only if he is not exists already and not update existing', async () => {
    const newUserId = '123'
    const newUser = { id: newUserId, timeToNotify: '12:00:00', tracksInfo: [], username: 'idk'}

    await createUser(newUser);

    let caughtError
    try {
      await createUser({...newUser, timeToNotify: '24:00:00'});
      
    } catch (error) {
      caughtError = error
    }
    expect(caughtError).toBeDefined();
  });

  it('should get all users', async () => {
    const newUser1Id = '123'
    const newUser1 = { id: newUser1Id, timeToNotify: '12:00:00', tracksInfo: [], username: 'idk'}

    const newUser2Id = '456'
    const newUser2 = { id: newUser2Id, timeToNotify: '12:00:00', tracksInfo: [], username: 'idk2'}

    await createUser(newUser1);
    await createUser(newUser2);

    const users = await getAllUsers();
    expect(users).toEqual([newUser1, newUser2]);
  });

  it('should update tracks info', async () => {
    const newUserId = '123'
    const newUser = { id: newUserId, timeToNotify: '12:34:00', tracksInfo: [], username: 'idk'}
    await createUser(newUser);

    const tracks: PlaylistInfo['tracks'] = [
      { id: 'track1', title: 'Track 1', albums: [], artists: [] },
      { id: 'track2', title: 'Track 2', albums: [], artists: [] }
    ];

    await updateTracksInfo(newUser.id, tracks);

    const user = await getUserByChatId(newUser.id);
    expect(user!.tracksInfo).toEqual(tracks);
  });
});