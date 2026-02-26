import { createClient } from '@supabase/supabase-js';

const PROXY_URL = 'http://localhost:3000/supabase-api';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYXd4cWVuenZ2am1hbm1nb2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjY2NjksImV4cCI6MjA4NzY0MjY2OX0.2BFvflLqj6-oP7lXSzeM5qJk2vcY1yX1v-P0UOFfN2Y';

const supabase = createClient(PROXY_URL, ANON_KEY);

async function testSync() {
    console.log('1. Checking connection...');
    const { data: sheets, error: fetchErr } = await supabase.from('dms_sheets').select('*');
    if (fetchErr) {
        console.error('Fetch error:', fetchErr);
        return;
    }
    console.log('Existing sheets:', sheets);

    console.log('\n2. Attempting to insert test sheet using Anon Key (mimicking web app)...');
    const testId = `sync-test-${Date.now()}`;
    const { error: insertErr } = await supabase.from('dms_sheets').insert({
        id: testId,
        name: 'Sync Test',
        columns: ['TestCol']
    });

    if (insertErr) {
        console.error('Insert error (might be RLS):', insertErr);
    } else {
        console.log('Insert successful! RLS is allowing writes.');
        await supabase.from('dms_sheets').delete().eq('id', testId);
    }
}

testSync().catch(console.error);
