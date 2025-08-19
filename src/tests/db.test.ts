import { beforeEach, afterAll, describe, test, expect } from "@jest/globals";
import { setUsername, getUsername, setTracksInfo, getTracksInfo, deleteUsersInfo, getChatIdByUsernameKey, redis } from "../db";
import { PlaylistInfo } from "../types";

describe("Db functions", () => {
  beforeEach(() => {
    return redis.flushdb()
  });

  afterAll(() => {
    redis.quit()
  })

  describe("Username by chatId", () => {
    test("should return the username for a given tgChatId", async () => {
      const tgChatId = "123";
      const username = "testuser";
      await setUsername(tgChatId, username);

      const result = await getUsername(tgChatId);
      expect(result).toEqual(username);
    });

    test("should return null if the username does not exist", async () => {
      const tgChatId = "123";

      const result = await getUsername(tgChatId);
      expect(result).toBeNull();
    });
  });

  describe("Tracks info", () => {
    test("should return the tracks info for a given username", async () => {
      const username = "testuser";
      const tracks: PlaylistInfo["tracks"] = [
        {
          id: "1",
          title: "Track 1",
          artists: [],
          albums: [],
        },
      ];
      await setTracksInfo(username, tracks);

      const result = await getTracksInfo(username);
      expect(result).toEqual(JSON.stringify(tracks));
    });

    test("should return null if the tracks info does not exist", async () => {
      const username = "testuser";

      const result = await getTracksInfo(username);
      expect(result).toBeNull();
    });
  });

  describe("deleteUsersInfo", () => {
    test("should delete both the username and tracks info for a given tgChatId and username", async () => {
      const tgChatId = "123";
      const username = "testuser";
      await setUsername(tgChatId, username);
      await setTracksInfo(username, []);

      await deleteUsersInfo(tgChatId, username);

      const usernameResult = await getUsername(tgChatId);
      const tracksInfoResult = await getTracksInfo(username);

      expect(usernameResult).toBeNull();
      expect(tracksInfoResult).toBeNull();
    });
  });

  describe("getChatIdByUsernameKey", () => {
    test("should return the tgChatId for a given username key", () => {
      const usernameKey = "ya_music_username_123";
      const expectedTgChatId = "123";

      const result = getChatIdByUsernameKey(usernameKey);

      expect(result).toEqual(expectedTgChatId);
    });

    test("should return null if the username key does not match the pattern", () => {
      const usernameKey = "invalid_username_key";
      const expectedTgChatId = null;

      const result = getChatIdByUsernameKey(usernameKey);

      expect(result).toEqual(expectedTgChatId);
    });
  });
});
