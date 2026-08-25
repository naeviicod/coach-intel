const DEFAULT_URL = 'https://buzqhwoaoiyeqkvmsghm.supabase.co';
const DEFAULT_KEY = 'sb_publishable_Vj7goY5FSRNIFQPip5ixmw_TJJdJAql';

function supabasePublicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY,
  };
}

module.exports = { supabasePublicConfig };
