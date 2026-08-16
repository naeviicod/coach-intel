// Paste these from the Supabase dashboard: Settings -> API, after creating the
// project. Both are meant to be public — they identify the project and are safe
// to ship inside the built app. Access is controlled by Row Level Security, not
// by keeping this file secret.
//
// The Discord Client ID/Secret do NOT go here — paste those into the Supabase
// dashboard instead (Authentication -> Providers -> Discord). This app never
// holds the Discord client secret.
const SUPABASE_URL = 'https://buzqhwoaoiyeqkvmsghm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Vj7goY5FSRNIFQPip5ixmw_TJJdJAql';

module.exports = { SUPABASE_URL, SUPABASE_ANON_KEY };
