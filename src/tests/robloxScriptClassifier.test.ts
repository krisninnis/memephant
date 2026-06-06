import {
  classifyRobloxScript,
  type RobloxScriptClassification,
} from '../utils/robloxScriptClassifier';

describe('classifyRobloxScript', () => {
  describe('non-script paths return null', () => {
    it('returns null for a Roblox place file (.rbxlx)', () => {
      expect(classifyRobloxScript('game.rbxlx')).toBeNull();
      expect(classifyRobloxScript('src/place/Game.rbxlx')).toBeNull();
    });

    it('returns null for other non-Luau files', () => {
      expect(classifyRobloxScript('README.md')).toBeNull();
      expect(classifyRobloxScript('src/client/styles.css')).toBeNull();
      expect(classifyRobloxScript('assets/sound.luau.txt')).toBeNull();
      expect(classifyRobloxScript('')).toBeNull();
    });

    it('returns null for non-string input', () => {
      // @ts-expect-error exercising the runtime guard
      expect(classifyRobloxScript(undefined)).toBeNull();
      // @ts-expect-error exercising the runtime guard
      expect(classifyRobloxScript(null)).toBeNull();
    });
  });

  describe('filename suffix (basis "filename")', () => {
    it('classifies *.client.lua and *.client.luau as LocalScript', () => {
      expect(classifyRobloxScript('src/Bar.client.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'LocalScript',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/Bar.client.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'LocalScript',
        basis: 'filename',
      });
    });

    it('classifies *.server.lua and *.server.luau as Script', () => {
      expect(classifyRobloxScript('src/Foo.server.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/Foo.server.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'filename',
      });
    });

    it('classifies the three init.* forms', () => {
      expect(classifyRobloxScript('src/thing/init.client.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'LocalScript',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/thing/init.client.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'LocalScript',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/thing/init.server.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/thing/init.server.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/thing/init.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'ModuleScript',
        basis: 'filename',
      });
      expect(classifyRobloxScript('src/thing/init.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'ModuleScript',
        basis: 'filename',
      });
    });

    it('is case-insensitive on the filename suffix', () => {
      expect(classifyRobloxScript('src/Bar.CLIENT.LUA')?.runContext).toBe('LocalScript');
      expect(classifyRobloxScript('src/Foo.Server.Luau')?.runContext).toBe('Script');
      expect(classifyRobloxScript('src/Init.LUAU')?.runContext).toBe('ModuleScript');
    });

    it('lets the filename suffix win over a conflicting path segment', () => {
      // server/ folder but .client suffix -> LocalScript via filename.
      expect(classifyRobloxScript('src/server/Bar.client.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'LocalScript',
        basis: 'filename',
      });
      // client/ folder but .server suffix -> Script via filename.
      expect(classifyRobloxScript('src/client/Foo.server.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'filename',
      });
    });
  });

  describe('path heuristic (basis "path")', () => {
    it('classifies LocalScript folder families', () => {
      const localFolders = [
        'client',
        'StarterPlayer',
        'StarterPlayerScripts',
        'StarterCharacterScripts',
        'StarterGui',
        'PlayerScripts',
        'ReplicatedFirst',
      ];
      for (const folder of localFolders) {
        expect(classifyRobloxScript(`src/${folder}/Thing.lua`)).toEqual<RobloxScriptClassification>({
          runContext: 'LocalScript',
          basis: 'path',
        });
      }
    });

    it('classifies server Script folder families', () => {
      const serverFolders = ['server', 'ServerScriptService', 'ServerStorage'];
      for (const folder of serverFolders) {
        expect(classifyRobloxScript(`src/${folder}/Thing.luau`)).toEqual<RobloxScriptClassification>({
          runContext: 'Script',
          basis: 'path',
        });
      }
    });

    it('classifies ModuleScript folder families', () => {
      const moduleFolders = ['shared', 'common', 'ReplicatedStorage', 'modules'];
      for (const folder of moduleFolders) {
        expect(classifyRobloxScript(`src/${folder}/Thing.lua`)).toEqual<RobloxScriptClassification>({
          runContext: 'ModuleScript',
          basis: 'path',
        });
      }
    });

    it('matches path segments case-insensitively', () => {
      expect(classifyRobloxScript('SRC/CLIENT/Thing.lua')?.runContext).toBe('LocalScript');
      expect(classifyRobloxScript('src/SERVERSTORAGE/Thing.lua')?.runContext).toBe('Script');
      expect(classifyRobloxScript('src/Shared/Thing.lua')?.runContext).toBe('ModuleScript');
    });

    it('normalises Windows-style backslash separators', () => {
      expect(classifyRobloxScript('src\\server\\Thing.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'Script',
        basis: 'path',
      });
    });

    it('prioritises LocalScript over server over module when families collide', () => {
      // client (Local) + server both present -> LocalScript wins.
      expect(classifyRobloxScript('client/server/Thing.lua')?.runContext).toBe('LocalScript');
      // server + shared both present -> Script wins over ModuleScript.
      expect(classifyRobloxScript('server/shared/Thing.lua')?.runContext).toBe('Script');
    });

    it('only matches whole segments, not substrings', () => {
      // "myclient" is not the segment "client" -> no path signal -> Unknown.
      expect(classifyRobloxScript('myclient/Thing.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'Unknown',
        basis: 'none',
      });
    });
  });

  describe('Unknown fallback (basis "none")', () => {
    it('returns Unknown for a plain script with no filename or path signal', () => {
      expect(classifyRobloxScript('Baz.lua')).toEqual<RobloxScriptClassification>({
        runContext: 'Unknown',
        basis: 'none',
      });
      expect(classifyRobloxScript('src/utils/Helpers.luau')).toEqual<RobloxScriptClassification>({
        runContext: 'Unknown',
        basis: 'none',
      });
    });
  });

  describe('acceptance example', () => {
    it('classifies the canonical server/client/shared trio', () => {
      expect(classifyRobloxScript('src/server/Foo.server.lua')?.runContext).toBe('Script');
      expect(classifyRobloxScript('src/client/Bar.client.luau')?.runContext).toBe('LocalScript');
      expect(classifyRobloxScript('src/shared/Baz.lua')?.runContext).toBe('ModuleScript');
    });
  });
});
