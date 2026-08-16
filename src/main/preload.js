const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cci', {
  getOrg: () => ipcRenderer.invoke('cci:getOrg'),
  saveOrg: (org) => ipcRenderer.invoke('cci:saveOrg', org),

  getTeams: () => ipcRenderer.invoke('cci:getTeams'),
  getTeam: (teamId) => ipcRenderer.invoke('cci:getTeam', teamId),
  saveTeam: (team) => ipcRenderer.invoke('cci:saveTeam', team),
  deleteTeam: (teamId) => ipcRenderer.invoke('cci:deleteTeam', teamId),

  getMembers: (teamId) => ipcRenderer.invoke('cci:getMembers', teamId),
  getMember: (teamId, memberId) => ipcRenderer.invoke('cci:getMember', teamId, memberId),
  saveMember: (teamId, member) => ipcRenderer.invoke('cci:saveMember', teamId, member),
  deleteMember: (teamId, memberId) => ipcRenderer.invoke('cci:deleteMember', teamId, memberId),

  getMatches: (teamId) => ipcRenderer.invoke('cci:getMatches', teamId),

  getStrats: (teamId) => ipcRenderer.invoke('cci:getStrats', teamId),
  getStrat: (teamId, stratId) => ipcRenderer.invoke('cci:getStrat', teamId, stratId),
  saveStrat: (teamId, strat) => ipcRenderer.invoke('cci:saveStrat', teamId, strat),
  deleteStrat: (teamId, stratId) => ipcRenderer.invoke('cci:deleteStrat', teamId, stratId),
  duplicateStrat: (teamId, stratId) => ipcRenderer.invoke('cci:duplicateStrat', teamId, stratId),
  restoreStratVersion: (teamId, stratId, version) => ipcRenderer.invoke('cci:restoreStratVersion', teamId, stratId, version),

  getNotes: (teamId) => ipcRenderer.invoke('cci:getNotes', teamId),
  saveNote: (teamId, note) => ipcRenderer.invoke('cci:saveNote', teamId, note),
  deleteNote: (teamId, noteId) => ipcRenderer.invoke('cci:deleteNote', teamId, noteId),

  getTasks: (teamId) => ipcRenderer.invoke('cci:getTasks', teamId),
  saveTask: (teamId, task) => ipcRenderer.invoke('cci:saveTask', teamId, task),
  deleteTask: (teamId, taskId) => ipcRenderer.invoke('cci:deleteTask', teamId, taskId),

  // Planning & prep (Calendar, Scrim Hub, VOD Library, Veto Lab).
  getEvents: (teamId) => ipcRenderer.invoke('cci:getEvents', teamId),
  saveEvent: (teamId, event) => ipcRenderer.invoke('cci:saveEvent', teamId, event),
  deleteEvent: (teamId, eventId) => ipcRenderer.invoke('cci:deleteEvent', teamId, eventId),

  getScrims: (teamId) => ipcRenderer.invoke('cci:getScrims', teamId),
  saveScrim: (teamId, scrim) => ipcRenderer.invoke('cci:saveScrim', teamId, scrim),
  deleteScrim: (teamId, scrimId) => ipcRenderer.invoke('cci:deleteScrim', teamId, scrimId),

  getVods: (teamId) => ipcRenderer.invoke('cci:getVods', teamId),
  saveVod: (teamId, vod) => ipcRenderer.invoke('cci:saveVod', teamId, vod),
  deleteVod: (teamId, vodId) => ipcRenderer.invoke('cci:deleteVod', teamId, vodId),

  getVetoes: (teamId) => ipcRenderer.invoke('cci:getVetoes', teamId),
  saveVeto: (teamId, veto) => ipcRenderer.invoke('cci:saveVeto', teamId, veto),
  deleteVeto: (teamId, vetoId) => ipcRenderer.invoke('cci:deleteVeto', teamId, vetoId),

  // Scouting & Rankings (org-level).
  getOpponents: () => ipcRenderer.invoke('cci:getOpponents'),
  getOpponent: (opponentId) => ipcRenderer.invoke('cci:getOpponent', opponentId),
  saveOpponent: (opponent) => ipcRenderer.invoke('cci:saveOpponent', opponent),
  deleteOpponent: (opponentId) => ipcRenderer.invoke('cci:deleteOpponent', opponentId),

  getRankings: () => ipcRenderer.invoke('cci:getRankings'),
  saveRankings: (rankings) => ipcRenderer.invoke('cci:saveRankings', rankings),

  deleteAllData: () => ipcRenderer.invoke('cci:deleteAllData'),
  getAppVersion: () => ipcRenderer.invoke('cci:getAppVersion'),
  setTrafficLights: (collapsed) => ipcRenderer.invoke('cci:setTrafficLights', collapsed),

  getNeedsReview: (teamId) => ipcRenderer.invoke('cci:getNeedsReview', teamId),
  listScoreboards: (teamId) => ipcRenderer.invoke('cci:listScoreboards', teamId),
  importScoreboards: (teamId, payload) => ipcRenderer.invoke('cci:importScoreboards', teamId, payload),
  deleteScoreboard: (teamId, filename, bucket) => ipcRenderer.invoke('cci:deleteScoreboard', teamId, filename, bucket),
  pickScoreboards: () => ipcRenderer.invoke('cci:pickScoreboards'),
  pickScoreboardFolder: () => ipcRenderer.invoke('cci:pickScoreboardFolder'),
  getMetaKnowledge: () => ipcRenderer.invoke('cci:getMetaKnowledge'),
  getCdlRuleset: () => ipcRenderer.invoke('cci:getCdlRuleset'),
  updateCdlRulesetMeta: (updates) => ipcRenderer.invoke('cci:updateCdlRulesetMeta', updates),
  addCdlMap: (map) => ipcRenderer.invoke('cci:addCdlMap', map),
  updateCdlMap: (mapId, updates) => ipcRenderer.invoke('cci:updateCdlMap', mapId, updates),
  deactivateCdlMap: (mapId) => ipcRenderer.invoke('cci:deactivateCdlMap', mapId),
  restoreCdlMap: (mapId) => ipcRenderer.invoke('cci:restoreCdlMap', mapId),
  removeCdlMap: (mapId, opts) => ipcRenderer.invoke('cci:removeCdlMap', mapId, opts),
  updateCdlMapModes: (mapId, activeModes) => ipcRenderer.invoke('cci:updateCdlMapModes', mapId, activeModes),

  pickImage: () => ipcRenderer.invoke('cci:pickImage'),
  copyImage: (sourcePath, destRelative) => ipcRenderer.invoke('cci:copyImage', sourcePath, destRelative),
  saveMapArt: (sourcePath, mapName, layoutKey) => ipcRenderer.invoke('cci:saveMapArt', sourcePath, mapName, layoutKey),
  dataUrlForPath: (relative) => ipcRenderer.invoke('cci:dataUrlForPath', relative),

  // Discord integration. Every call resolves to { ok: true, data } or
  // { ok: false, code, message }; secrets are stripped in the main process.
  discord: {
    getState: () => ipcRenderer.invoke('cci:discordGetState'),
    beginConnect: (payload) => ipcRenderer.invoke('cci:discordBeginConnect', payload),
    completeConnect: (payload) => ipcRenderer.invoke('cci:discordCompleteConnect', payload),
    cancelConnect: () => ipcRenderer.invoke('cci:discordCancelConnect'),
    listChannels: (payload) => ipcRenderer.invoke('cci:discordListChannels', payload),
    listRoles: () => ipcRenderer.invoke('cci:discordListRoles'),
    saveChannels: (payload) => ipcRenderer.invoke('cci:discordSaveChannels', payload),
    savePreferences: (payload) => ipcRenderer.invoke('cci:discordSavePreferences', payload),
    test: (payload) => ipcRenderer.invoke('cci:discordTest', payload),
    share: (payload) => ipcRenderer.invoke('cci:discordShare', payload),
    publish: (eventId, payload) => ipcRenderer.invoke('cci:discordPublish', eventId, payload),
    verify: (payload) => ipcRenderer.invoke('cci:discordVerify', payload),
    disconnect: (payload) => ipcRenderer.invoke('cci:discordDisconnect', payload),
    audit: (payload) => ipcRenderer.invoke('cci:discordAudit', payload),
  },

  openExternal: (url) => ipcRenderer.invoke('cci:openExternal', url),

  onDeepLink: (callback) => {
    const listener = (_event, route) => callback(route);
    ipcRenderer.on('cci:deepLink', listener);
    return () => ipcRenderer.removeListener('cci:deepLink', listener);
  },

  // Auth (Supabase, sign in with Discord).
  auth: {
    getState: () => ipcRenderer.invoke('cci:authGetState'),
    signInWithDiscord: () => ipcRenderer.invoke('cci:authSignInWithDiscord'),
    signOut: () => ipcRenderer.invoke('cci:authSignOut'),
    listProfiles: () => ipcRenderer.invoke('cci:authListProfiles'),
    updateRole: (userId, role) => ipcRenderer.invoke('cci:authUpdateRole', userId, role),
    // Fires with { session, error } — session is set on a successful sign-in,
    // error is a user-facing message when a sign-in was rejected (e.g. not a
    // member of the org's Discord server) or otherwise failed.
    onAuthStateChanged: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('cci:authStateChanged', listener);
      return () => ipcRenderer.removeListener('cci:authStateChanged', listener);
    },
  },
});
