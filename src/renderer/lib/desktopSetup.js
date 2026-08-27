const DISPLAY_NAME_MAX_LENGTH = 80;
const CONTROL_OR_BIDI = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;
const EMAIL_ONLY = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function safeMemberName({ profile, linkedNames } = {}) {
  const candidates = [profile?.display_name, ...(Array.isArray(linkedNames) ? linkedNames : [])];
  for (const candidate of candidates) {
    const value = String(candidate || '').replace(CONTROL_OR_BIDI, '').trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
    if (value && !EMAIL_ONLY.test(value)) return value;
  }
  return null;
}

export function welcomeCopy(memberName) {
  const name = safeMemberName({ profile: { display_name: memberName } });
  if (name) {
    return {
      title: `Welcome to Coach Intel, ${name}`,
      lineOne: `Thank you for downloading Coach Intel, ${name}. Prepare smarter, improve your strategy and take your game to the next level.`,
      lineTwo: 'Click Continue to complete setup and get started.',
    };
  }
  return {
    title: 'Welcome to Coach Intel',
    lineOne: 'Thank you for downloading Coach Intel. Prepare smarter, improve your strategy and take your game to the next level.',
    lineTwo: 'Click Continue to complete setup and get started.',
  };
}
