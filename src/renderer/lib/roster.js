// Lineup slot is the grouping. Org titles (Developer, Coach, Artist) are badges
// and can stack on a starter or bench player.

import { isNaevii } from './profile.js';

export function nextLineupSlot(slot) {
  return slot === 'bench' ? 'starter' : 'bench';
}

export function normalizeSlot(slot) {
  if (slot === 'bench' || slot === 'staff') return slot;
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

export function isPlayingMember(member) {
  return !isStaffMember(member);
}

export function isBench(member) {
  return isPlayingMember(member) && member?.slot === 'bench';
}

export function isStarter(member) {
  return isPlayingMember(member) && member?.slot !== 'bench';
}

export function splitRoster(members) {
  const list = (members || []).map(normalizeMember);
  return {
    starters: list.filter(isStarter),
    bench: list.filter(isBench),
    staff: list.filter(isStaffMember),
  };
}

export function defaultSlot(members) {
  return splitRoster(members).starters.length >= 4 ? 'bench' : 'starter';
}
