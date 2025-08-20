import { describe, it, expect } from "@jest/globals";
import { TrackInfo } from '../types';
import { checkForPlaylistChanges, generateRandomTimeString, getUsernameFromProfileUrl, profileUrlRegex, timeStringToHourMinute, trackInfoToString } from '../utils'

describe('checkForPlaylistChanges', () => {
  it('should return empty arrays when there are no changes', () => {
    const oldTracksInfo: Array<TrackInfo> = [
      { id: '1', artists: [{ name: 'Artist1' }], albums: [{ title: 'Album1', id: 1 }], title: 'Track1' },
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];
    const newTracksInfo: Array<TrackInfo> = [
      { id: '1', artists: [{ name: 'Artist1' }], albums: [{ title: 'Album1', id: 1 }], title: 'Track1' },
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];

    const result = checkForPlaylistChanges(oldTracksInfo, newTracksInfo);

    expect(result.deletedTracksStrings.length).toBe(0);
    expect(result.newTracksStrings.length).toBe(0);
  });

  it('should return deleted tracks when there are changes', () => {
    const oldTracksInfo: Array<TrackInfo> = [
      { id: '1', artists: [{ name: 'Artist1' }], albums: [{ title: 'Album1', id: 2 }], title: 'Track1' },
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];
    const newTracksInfo: Array<TrackInfo> = [
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];

    const result = checkForPlaylistChanges(oldTracksInfo, newTracksInfo);

    expect(result.deletedTracksStrings).toEqual(['Artist1 - Album1 - Track1\nhttps://music.yandex.ru/album/2/track/1']);
    expect(result.newTracksStrings.length).toBe(0);
  });

  it('should return new tracks when there are changes', () => {
    const oldTracksInfo: Array<TrackInfo> = [
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];
    const newTracksInfo: Array<TrackInfo> = [
      { id: '1', artists: [{ name: 'Artist1' }], albums: [{ title: 'Album1', id: 1 }], title: 'Track1' },
      { id: '2', artists: [{ name: 'Artist2' }], albums: [{ title: 'Album2', id: 2 }], title: 'Track2' }
    ];

    const result = checkForPlaylistChanges(oldTracksInfo, newTracksInfo);

    expect(result.deletedTracksStrings.length).toBe(0);
    expect(result.newTracksStrings).toEqual(['Artist1 - Album1 - Track1\nhttps://music.yandex.ru/album/1/track/1']);
  });
});

describe('trackInfoToString', () => {
  const track: TrackInfo = {
    id: '123',
    title: 'Track Title',
    artists: [{ name: 'Artist Name' }],
    albums: [{ title: 'Album Title', id: 1 }]
  };

  it('should return a string with the correct format', () => {
    const result = trackInfoToString(track);
    expect(result).toBe('Artist Name - Album Title - Track Title\nhttps://music.yandex.ru/album/1/track/123');
  });
});

describe('profileUrlRegex', () => {
  it('should match a valid profile URL', () => {
    expect(profileUrlRegex.test('https://music.yandex.ru/users/johndoe/playlists')).toBe(true);
  });

  it('should not match an invalid profile URL', () => {
    expect(profileUrlRegex.test('https://music.yandex.ru/users/johndoe/invalid')).toBe(false);
  });
});

describe("generateRandomTimeString", () => {
  it("should return a string in the format 'HH:MM:SS'", () => {
    const result = generateRandomTimeString();
    expect(result).toMatch(/^\d+:\d+:\d+$/);
  });

  it("should not return hours > 24, minutes > 60", () => {
    const results = Array.from({ length: 5 }, () => generateRandomTimeString());
    results.forEach(result => {
      const [hour, minute] = timeStringToHourMinute(result)
      expect(Number(hour)).toBeLessThan(24)
      expect(Number(minute)).toBeLessThan(60)
    })
  });
});

describe('timeStringToHourMinute', () => {
    it('should return the hour and minute from a valid time string', () => {
        const time = '14:30:00';
        const expectedOutput = ['14', '30'];
        expect(timeStringToHourMinute(time)).toEqual(expectedOutput);
    });

    it('should handle leading zeros in the hour and minute', () => {
        const time = '09:05:00';
        const expectedOutput = ['09', '05'];
        expect(timeStringToHourMinute(time)).toEqual(expectedOutput);
    });
});

describe('getUsernameFromProfileUrl', () => {
  it('should match a valid profile username', () => {
    expect(getUsernameFromProfileUrl('https://music.yandex.ru/users/johndoe/playlists')).toBe('johndoe');
  });

  it('should not match an invalid profile username', () => {
    expect(getUsernameFromProfileUrl('asdf')).toBeUndefined();
  });
})
