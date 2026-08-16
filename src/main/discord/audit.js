// Append-only audit trail for Discord integration activity.
//
// Records actor, organization, timestamp, action, target, and result. Entries are
// passed through redaction so a token can never reach the log, even if a caller
// accidentally includes one in a detail field.

const fs = require('fs/promises');
const path = require('path');

const { redactObject } = require('./redact');

const MAX_ENTRIES = 1000;

function createAuditLog({ dataRoot }) {
  const filePath = path.join(dataRoot, 'org', 'integrations', 'discord-audit.json');

  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      return Array.isArray(parsed.entries) ? parsed.entries : [];
    } catch (err) {
      if (err.code === 'ENOENT' || err instanceof SyntaxError) return [];
      throw err;
    }
  }

  /**
   * @param {object} entry
   * @param {string} entry.action        one of AUDIT_ACTIONS
   * @param {string} [entry.actor]       Coach Intel display name performing the action
   * @param {string} [entry.organization]
   * @param {string} [entry.target]      what was acted on (#channel, guild name, event id)
   * @param {'SUCCESS'|'FAILURE'|'SKIPPED'} [entry.result]
   * @param {object} [entry.detail]      extra context; redacted before writing
   */
  async function record(entry) {
    const entries = await read();
    entries.push(
      redactObject({
        timestamp: new Date().toISOString(),
        actor: entry.actor || 'Coach',
        organization: entry.organization || null,
        action: entry.action,
        target: entry.target || null,
        result: entry.result || 'SUCCESS',
        detail: entry.detail || null,
      })
    );
    const trimmed = entries.slice(-MAX_ENTRIES);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify({ entries: trimmed }, null, 2) + '\n', 'utf-8');
    return trimmed[trimmed.length - 1];
  }

  async function recent(limit = 50) {
    const entries = await read();
    return entries.slice(-limit).reverse();
  }

  async function clear() {
    await fs.rm(filePath, { force: true });
  }

  return { filePath, read, record, recent, clear, MAX_ENTRIES };
}

module.exports = { createAuditLog, MAX_ENTRIES };
