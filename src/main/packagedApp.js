const fs = require('fs');

const PACKAGED_APP = '/Applications/Coach Intel.app';

function packagedAppPath() {
  return PACKAGED_APP;
}

function packagedAppInstalled() {
  try {
    return fs.existsSync(PACKAGED_APP);
  } catch {
    return false;
  }
}

// Unpackaged `electron .` must not steal coachintel:// or the Dock name
// once the real app lives in /Applications.
function shouldClaimProtocol(isPackaged, packagedExists = packagedAppInstalled()) {
  return Boolean(isPackaged) || !packagedExists;
}

module.exports = { PACKAGED_APP, packagedAppPath, packagedAppInstalled, shouldClaimProtocol };
