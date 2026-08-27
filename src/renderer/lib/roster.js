// Lineup slot is the grouping. Org titles (Developer, Coach, Artist) are badges
// and can stack on a starter or bench player.

import { isNaevii } from './profile.js';

export function nextLineupSlot(slot) {
  return slot === 'bench' ? 'starter' : 'bench';
}

export function normalizeSlot(slot) {
  if (slot === 'bench' || slot === 'staff' || slot === 'fa') return slot;
  return 'starter';
}

export function normalizeMember(member) {
  if (!member) return member;
  if (member.slot === 'staff' && (isNaevii(member.gamertag) || isNaevii(member.name))) {
    return { ...member, slot: 'starter' };
  }
  return member;
}

export function isStaffMember(member) {
  return normalizeMember(member)?.slot === 'staff';
}

export function isFreeAgent(member) {
  return normalizeMember(member)?.slot === 'fa';
}

export function isMemberDisabled(member) {
  if (!member) return false;
  if (member.disabled === true) return true;
  return String(member.handles?._disabled || '') === '1';
}

export function isPlayingMember(member) {
  return !isMemberDisabled(member) && !isStaffMember(member) && !isFreeAgent(member);
}

export function showsCompetitiveStats(member) {
  if (!member) return false;
  if (isNaevii(member.gamertag) || isNaevii(member.name)) return true;
  const title = String(member.title || '').toLowerCase();
  if (/\borg\s*owner\b/.test(title) || title === 'owner') return true;
  if (isStaffMember(member) || isFreeAgent(member)) return false;
  return isPlayingMember(member);
}

export function isBench(member) {
  return isPlayingMember(member) && member?.slot === 'bench';
}

export function isStarter(member) {
  return isPlayingMember(member) && member?.slot !== 'bench';
}

export function splitRoster(members) {
  const list = (members || []).map(normalizeMember);
  const active = list.filter((m) => !isMemberDisabled(m));
  return {
    starters: active.filter(isStarter),
    bench: active.filter(isBench),
    staff: active.filter(isStaffMember),
    freeAgents: active.filter(isFreeAgent),
    disabled: list.filter(isMemberDisabled),
  };
}

export function defaultSlot(members) {
  return splitRoster(members).starters.length >= 4 ? 'bench' : 'starter';
}

export function memberOrgGroup(member) {
  const title = String(member?.title || '').toLowerCase();
  if (isFreeAgent(member) || /free\s*agent|\bf\/?a\b/.test(title)) return 'fa';
  if (/\b(org\s*owner|admin|general\s*manager|\bgm\b|super\s*admin|developer)\b/.test(title)) return 'admins';
  if (/\bcoach\b/.test(title)) return 'coaches';
  if (isStaffMember(member)) return 'staff';
  return 'players';
}
